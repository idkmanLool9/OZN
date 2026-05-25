package com.example.passportreader.cloud

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.example.passportreader.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Lichte Supabase REST-client — geen volwaardige SDK, alleen wat nodig is:
 *  - Auth: signInWithPassword + sessie-persistentie (EncryptedSharedPreferences)
 *  - DB: lijst dossiers, update één dossier
 *  - Storage: upload bytes naar publieke bucket 'overledenen'
 *
 * Bewust geen async-framework: alle netwerkcalls draaien op Dispatchers.IO.
 */
class SupabaseClient private constructor(context: Context) {

    private val url = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val anonKey = BuildConfig.SUPABASE_ANON_KEY

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS) // upload van foto's
        .build()

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "supabase_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    // ─── Sessie ──────────────────────────────────────────────────────────
    data class Session(val accessToken: String, val refreshToken: String, val email: String)

    var session: Session? = null
        private set

    init {
        val at = prefs.getString("access", null)
        val rt = prefs.getString("refresh", null)
        val em = prefs.getString("email", null)
        if (at != null && rt != null && em != null) {
            session = Session(at, rt, em)
        }
    }

    val isLoggedIn: Boolean get() = session != null
    val email: String? get() = session?.email

    private fun saveSession(s: Session) {
        session = s
        prefs.edit()
            .putString("access", s.accessToken)
            .putString("refresh", s.refreshToken)
            .putString("email", s.email)
            .apply()
    }

    fun logout() {
        session = null
        prefs.edit().clear().apply()
    }

    // ─── Auth: e-mail + wachtwoord ───────────────────────────────────────
    suspend fun signIn(email: String, password: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email.trim())
            put("password", password)
        }.toString().toRequestBody(JSON)
        val req = Request.Builder()
            .url("$url/auth/v1/token?grant_type=password")
            .header("apikey", anonKey)
            .header("Content-Type", "application/json")
            .post(body)
            .build()
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw SupabaseException(parseErrorMessage(text) ?: "Login mislukt (${resp.code})")
            val json = JSONObject(text)
            val access = json.optString("access_token")
            val refresh = json.optString("refresh_token")
            val user = json.optJSONObject("user")
            val em = user?.optString("email") ?: email
            if (access.isBlank() || refresh.isBlank()) throw SupabaseException("Lege sessie ontvangen")
            saveSession(Session(access, refresh, em))
        }
    }

    /** Eenmalig de access-token verversen via refresh-token. */
    private suspend fun refreshSession(): Boolean = withContext(Dispatchers.IO) {
        val cur = session ?: return@withContext false
        val body = JSONObject().apply {
            put("refresh_token", cur.refreshToken)
        }.toString().toRequestBody(JSON)
        val req = Request.Builder()
            .url("$url/auth/v1/token?grant_type=refresh_token")
            .header("apikey", anonKey)
            .header("Content-Type", "application/json")
            .post(body)
            .build()
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) return@withContext false
            val json = JSONObject(text)
            val access = json.optString("access_token")
            val refresh = json.optString("refresh_token", cur.refreshToken)
            if (access.isBlank()) return@withContext false
            saveSession(cur.copy(accessToken = access, refreshToken = refresh))
            return@withContext true
        }
    }

    // ─── REST helper met auto-refresh bij 401 ────────────────────────────
    private fun authHeaders(): Headers {
        val s = session ?: throw SupabaseException("Niet ingelogd")
        return Headers.Builder()
            .add("apikey", anonKey)
            .add("Authorization", "Bearer ${s.accessToken}")
            .build()
    }

    private suspend fun execute(req: Request): Response = withContext(Dispatchers.IO) {
        val first = http.newCall(req).execute()
        if (first.code != 401) return@withContext first
        first.close()
        // 401: probeer één keer te verversen, dan opnieuw met nieuwe token
        if (!refreshSession()) {
            logout()
            throw SupabaseException("Sessie verlopen — log opnieuw in")
        }
        val s = session!!
        val retry = req.newBuilder()
            .header("Authorization", "Bearer ${s.accessToken}")
            .build()
        http.newCall(retry).execute()
    }

    // ─── Dossiers ────────────────────────────────────────────────────────
    data class DossierSummary(
        val id: Long,
        val dossierNummer: String?,
        val voornaam: String?,
        val achternaam: String?,
        val gezinsnummer: String?,
        val status: String?,
    ) {
        val displayName: String
            get() = listOfNotNull(voornaam, achternaam)
                .filter { it.isNotBlank() }.joinToString(" ").ifBlank { "(naam onbekend)" }
    }

    suspend fun listDossiers(query: String? = null): List<DossierSummary> {
        val cols = "id,dossier_nummer,voornaam,achternaam,gezinsnummer,status"
        val sb = StringBuilder("$url/rest/v1/dossiers?select=$cols&order=updated_at.desc")
        if (!query.isNullOrBlank()) {
            val q = query.trim().replace(",", " ")
            // OR-filter over voornaam, achternaam, dossier_nummer, gezinsnummer.
            // PostgREST 'or=(field.ilike.*x*,field.ilike.*x*,...)'
            val like = "*${q.replace(" ", "*")}*"
            sb.append("&or=(voornaam.ilike.$like,achternaam.ilike.$like,dossier_nummer.ilike.$like,gezinsnummer.ilike.$like)")
        }
        val req = Request.Builder()
            .url(sb.toString())
            .headers(authHeaders())
            .header("Accept", "application/json")
            .get()
            .build()
        execute(req).use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw SupabaseException(parseErrorMessage(text) ?: "Dossiers ophalen mislukt (${resp.code})")
            val arr = JSONArray(text)
            return List(arr.length()) { i ->
                val o = arr.getJSONObject(i)
                DossierSummary(
                    id = o.optLong("id"),
                    dossierNummer = o.optStringOrNull("dossier_nummer"),
                    voornaam = o.optStringOrNull("voornaam"),
                    achternaam = o.optStringOrNull("achternaam"),
                    gezinsnummer = o.optStringOrNull("gezinsnummer"),
                    status = o.optStringOrNull("status"),
                )
            }
        }
    }

    /** Patch een dossier met de meegegeven velden. Lege string == niet veranderen. */
    suspend fun updateDossier(id: Long, patch: Map<String, Any?>) {
        val body = JSONObject().apply {
            for ((k, v) in patch) if (v != null) put(k, v)
        }.toString().toRequestBody(JSON)
        val req = Request.Builder()
            .url("$url/rest/v1/dossiers?id=eq.$id")
            .headers(authHeaders())
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .patch(body)
            .build()
        execute(req).use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw SupabaseException(parseErrorMessage(text) ?: "Bijwerken mislukt (${resp.code})")
        }
    }

    // ─── Storage: upload pasfoto ─────────────────────────────────────────
    /** Upload bytes naar bucket 'overledenen' onder pad <key>. Overschrijft als al bestaat. */
    suspend fun uploadOverledeneFoto(dossierId: Long, jpegBytes: ByteArray): String {
        val path = "$dossierId/foto.jpg"
        val body = jpegBytes.toRequestBody(JPEG)
        val req = Request.Builder()
            .url("$url/storage/v1/object/overledenen/$path")
            .headers(authHeaders())
            .header("Content-Type", "image/jpeg")
            .header("x-upsert", "true")
            .header("Cache-Control", "3600")
            .post(body)
            .build()
        execute(req).use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw SupabaseException(parseErrorMessage(text) ?: "Foto-upload mislukt (${resp.code})")
        }
        return path
    }

    // ─── Helpers ─────────────────────────────────────────────────────────
    private fun JSONObject.optStringOrNull(key: String): String? =
        if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

    private fun parseErrorMessage(body: String): String? = try {
        val o = JSONObject(body)
        o.optString("error_description").ifBlank {
            o.optString("msg").ifBlank {
                o.optString("message").ifBlank {
                    o.optString("error").ifBlank { null }
                }
            }
        }?.takeIf { it.isNotBlank() }
    } catch (_: Exception) { null }

    class SupabaseException(msg: String) : Exception(msg)

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private val JPEG = "image/jpeg".toMediaType()

        @Volatile private var instance: SupabaseClient? = null

        fun get(context: Context): SupabaseClient =
            instance ?: synchronized(this) {
                instance ?: SupabaseClient(context.applicationContext).also { instance = it }
            }
    }
}
