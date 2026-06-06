package com.example.passportreader

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Self-update mechanisme. Checkt GitHub Releases of er een nieuwere versie
 * beschikbaar is en downloadt + installeert die zonder dat de gebruiker
 * via browser het APK-bestand hoeft op te halen.
 *
 * Werking:
 *  1. GET https://api.github.com/repos/idkmanLool9/uitvaart/releases/latest
 *  2. Parse "Versie X.Y.Z (build N)" uit het body-veld → vergelijk met
 *     BuildConfig.VERSION_CODE
 *  3. Als nieuwer beschikbaar: download .apk naar cacheDir/update.apk
 *  4. Start Intent.ACTION_VIEW met FileProvider-URI → Android installer
 *     opent en de gebruiker tikt 1x "Installeren"
 *
 * Op API 26+ heeft de app eenmalig de "Install unknown apps"-toggle nodig
 * voor zichzelf. Bij eerste update opent app de juiste settings-pagina.
 */
object AppUpdater {

    private const val TAG = "AppUpdater"
    private const val RELEASE_URL =
        "https://api.github.com/repos/idkmanLool9/uitvaart/releases/latest"

    /** Cache-TTL: hergebruik vorig API-resultaat als check < deze tijd geleden.
     *  GitHub's anonymous API limit is 60/uur per IP — caching voorkomt
     *  dat we daar tegenaan lopen bij meerdere onResume-events. */
    private const val CACHE_TTL_MS = 10L * 60 * 1000  // 10 minuten

    private const val PREFS = "app_updater_cache"
    private const val KEY_LAST_CHECK = "last_check_ms"
    private const val KEY_LAST_RESULT = "last_result_json"

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()

    private val mainHandler = Handler(Looper.getMainLooper())

    data class UpdateInfo(
        val versionName: String,
        val versionCode: Int,
        val downloadUrl: String,
        val releaseNotes: String,
    )

    /** Resultaat van een update-check. Sealed class zodat caller expliciet
     *  alle drie de cases kan onderscheiden (geen verwarring meer tussen
     *  "geen update" en "fout"). */
    sealed class CheckResult {
        /** Nieuwer beschikbaar — actie nodig. */
        data class UpdateAvailable(val info: UpdateInfo) : CheckResult()
        /** Geen update — caller toont "je bent up-to-date" met current. */
        data class UpToDate(val currentVersion: String, val currentBuild: Int) : CheckResult()
        /** Check faalde — caller toont foutmelding met reden. */
        data class Error(val reason: String) : CheckResult()
    }

    /** Checkt async of er een nieuwere release is. Callback krijgt een
     *  expliciete CheckResult zodat caller drie cases kan tonen.
     *
     *  Caching: als forceFresh=false en de laatste succesvolle check is
     *  < CACHE_TTL_MS geleden, hergebruiken we het cached resultaat
     *  zonder GitHub te bellen (voorkomt rate-limit bij meerdere
     *  onResume-events kort na elkaar). Settings → Zoek updates roept
     *  met forceFresh=true zodat handmatige check altijd live is. */
    @JvmOverloads
    fun checkForUpdate(
        context: Context? = null,
        forceFresh: Boolean = false,
        callback: (CheckResult) -> Unit
    ) {
        // Cache-pad: gebruik vorige succesvolle response als nog geldig
        if (!forceFresh && context != null) {
            val cached = readCache(context)
            if (cached != null) {
                Log.d(TAG, "Cache-hit (TTL nog geldig)")
                mainHandler.post { callback(cached) }
                return
            }
        }
        Thread {
            val result: CheckResult = try {
                val req = Request.Builder()
                    .url(RELEASE_URL)
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "PassportReader/${BuildConfig.VERSION_NAME}")
                    .build()
                val resp = http.newCall(req).execute()
                if (!resp.isSuccessful) {
                    val code = resp.code
                    Log.w(TAG, "Release-check faalde: HTTP $code")
                    CheckResult.Error("Server-fout HTTP $code (GitHub bereikbaar?)")
                } else {
                    val body = resp.body?.string() ?: ""
                    val json = JSONObject(body)
                    val name = json.optString("name")
                    val bodyText = json.optString("body")
                    val assets = json.optJSONArray("assets")
                    val apk = (0 until (assets?.length() ?: 0))
                        .map { assets!!.getJSONObject(it) }
                        .firstOrNull {
                            it.optString("name").endsWith(".apk", ignoreCase = true)
                        }
                    val downloadUrl = apk?.optString("browser_download_url")
                        ?.takeIf { it.isNotBlank() }

                    // Parse "build 14" uit het release-body
                    val buildMatch = Regex("build\\s+(\\d+)", RegexOption.IGNORE_CASE)
                        .find(bodyText)
                    val remoteBuild = buildMatch?.groupValues?.get(1)?.toIntOrNull()

                    // Parse "1.2.2" uit naam ("Passport Reader v1.2.2")
                    val verMatch = Regex("""(\d+\.\d+\.\d+)""").find(name)
                    val remoteVersion = verMatch?.groupValues?.get(1)

                    Log.d(TAG, "Remote build=$remoteBuild ($remoteVersion), " +
                        "local=${BuildConfig.VERSION_CODE} (${BuildConfig.VERSION_NAME})")

                    when {
                        remoteBuild == null ->
                            CheckResult.Error("Kon versie-info niet lezen uit release")
                        downloadUrl == null ->
                            CheckResult.Error("Geen APK in release gevonden")
                        remoteBuild > BuildConfig.VERSION_CODE ->
                            CheckResult.UpdateAvailable(
                                UpdateInfo(
                                    versionName = remoteVersion ?: "?",
                                    versionCode = remoteBuild,
                                    downloadUrl = downloadUrl,
                                    releaseNotes = bodyText,
                                )
                            )
                        else -> CheckResult.UpToDate(
                            currentVersion = BuildConfig.VERSION_NAME,
                            currentBuild = BuildConfig.VERSION_CODE,
                        )
                    }
                }
            } catch (e: java.net.UnknownHostException) {
                CheckResult.Error("Geen internetverbinding")
            } catch (e: java.net.SocketTimeoutException) {
                CheckResult.Error("Verbinding met GitHub timed out")
            } catch (e: Exception) {
                Log.w(TAG, "Release-check exception", e)
                CheckResult.Error("Onverwachte fout: ${e.javaClass.simpleName} ${e.message ?: ""}")
            }
            // Cache alleen succesvolle resultaten (UpToDate of UpdateAvailable)
            if (context != null && result !is CheckResult.Error) {
                writeCache(context, result)
            }
            mainHandler.post { callback(result) }
        }.start()
    }

    /** Backward-compat: oude callback-vorm die alleen UpdateInfo? gaf.
     *  Wordt nog gebruikt door MainActivity-banner; intern wrap nieuwe API. */
    fun checkForUpdateLegacy(context: Context, callback: (UpdateInfo?) -> Unit) {
        checkForUpdate(context, forceFresh = false) { result ->
            when (result) {
                is CheckResult.UpdateAvailable -> callback(result.info)
                else -> callback(null)
            }
        }
    }

    // ─── Cache (SharedPreferences) ────────────────────────────────────── //

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun readCache(ctx: Context): CheckResult? {
        val p = prefs(ctx)
        val ts = p.getLong(KEY_LAST_CHECK, 0)
        if (ts <= 0 || (System.currentTimeMillis() - ts) > CACHE_TTL_MS) return null
        val json = p.getString(KEY_LAST_RESULT, null) ?: return null
        return try {
            val o = JSONObject(json)
            when (o.optString("type")) {
                "uptodate" -> CheckResult.UpToDate(
                    currentVersion = o.optString("version"),
                    currentBuild = o.optInt("build"),
                )
                "update" -> CheckResult.UpdateAvailable(
                    UpdateInfo(
                        versionName = o.optString("version"),
                        versionCode = o.optInt("build"),
                        downloadUrl = o.optString("url"),
                        releaseNotes = o.optString("notes"),
                    )
                )
                else -> null
            }
        } catch (_: Exception) { null }
    }

    private fun writeCache(ctx: Context, result: CheckResult) {
        val json = JSONObject().apply {
            when (result) {
                is CheckResult.UpToDate -> {
                    put("type", "uptodate")
                    put("version", result.currentVersion)
                    put("build", result.currentBuild)
                }
                is CheckResult.UpdateAvailable -> {
                    put("type", "update")
                    put("version", result.info.versionName)
                    put("build", result.info.versionCode)
                    put("url", result.info.downloadUrl)
                    put("notes", result.info.releaseNotes)
                }
                is CheckResult.Error -> return  // niet cachen
            }
        }.toString()
        prefs(ctx).edit()
            .putLong(KEY_LAST_CHECK, System.currentTimeMillis())
            .putString(KEY_LAST_RESULT, json)
            .apply()
    }

    /** Downloadt het APK-bestand met progress-callbacks (0-100). De
     *  onComplete-callback krijgt het File-object op succes of null op fout. */
    fun downloadApk(
        ctx: Context,
        url: String,
        onProgress: (Int) -> Unit,
        onComplete: (File?) -> Unit,
    ) {
        Thread {
            try {
                val req = Request.Builder().url(url).build()
                val resp = http.newCall(req).execute()
                if (!resp.isSuccessful) {
                    Log.w(TAG, "APK-download faalde: HTTP ${resp.code}")
                    mainHandler.post { onComplete(null) }
                    return@Thread
                }
                val total = resp.body?.contentLength() ?: -1L
                val updateDir = File(ctx.cacheDir, "updates")
                updateDir.mkdirs()
                val dest = File(updateDir, "update.apk")
                if (dest.exists()) dest.delete()

                resp.body!!.byteStream().use { input ->
                    dest.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        var read = 0L
                        var lastReported = -1
                        while (true) {
                            val n = input.read(buf)
                            if (n <= 0) break
                            out.write(buf, 0, n)
                            read += n
                            if (total > 0) {
                                val pct = ((read * 100) / total).toInt()
                                if (pct != lastReported) {
                                    lastReported = pct
                                    mainHandler.post { onProgress(pct) }
                                }
                            }
                        }
                        out.flush()
                    }
                }
                mainHandler.post { onComplete(dest) }
            } catch (e: Exception) {
                Log.w(TAG, "APK-download exception", e)
                mainHandler.post { onComplete(null) }
            }
        }.start()
    }

    /** Open Android's system installer voor het gegeven APK-bestand. Op
     *  API 26+ vereist dit eenmalig dat "Install unknown apps" voor deze
     *  app aanstaat — we openen de juiste settings-pagina als dat niet zo
     *  is, anders direct de installer. */
    fun installApk(ctx: Context, apk: File): Boolean {
        // Android 8+ "install unknown apps" check
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !ctx.packageManager.canRequestPackageInstalls()) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${ctx.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            return false  // gebruiker komt terug, retry mogelijk
        }

        try {
            val uri = FileProvider.getUriForFile(
                ctx, "${ctx.packageName}.fileprovider", apk
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Install-intent failed", e)
            return false
        }
    }
}
