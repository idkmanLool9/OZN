package com.example.passportreader

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

/**
 * Bewaart de laatste N succesvolle NFC-scans in EncryptedSharedPreferences
 * (privacy-gevoelig — naam + docnr). Alleen voor de Recent-sectie op het
 * hoofdscherm; geen sync naar server, geen langetermijn-archief.
 *
 * Wordt automatisch geleegd bij uitloggen.
 */
object RecentScans {

    private const val PREFS = "recent_scans"
    private const val KEY = "items_json"
    private const val MAX = 5

    data class Entry(
        val name: String,
        val docNo: String,
        val timestamp: Long,
    )

    private fun prefs(ctx: Context) = EncryptedSharedPreferences.create(
        ctx,
        PREFS,
        MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun list(ctx: Context): List<Entry> {
        val raw = prefs(ctx).getString(KEY, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                Entry(
                    name = o.optString("name"),
                    docNo = o.optString("docNo"),
                    timestamp = o.optLong("ts"),
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun add(ctx: Context, name: String, docNo: String) {
        val current = list(ctx).toMutableList()
        // Verwijder duplicaten op docNo
        current.removeAll { it.docNo == docNo }
        // Nieuw vooraan
        current.add(0, Entry(name, docNo, System.currentTimeMillis()))
        // Trim tot MAX
        while (current.size > MAX) current.removeAt(current.size - 1)

        val arr = JSONArray()
        current.forEach {
            arr.put(JSONObject().apply {
                put("name", it.name)
                put("docNo", it.docNo)
                put("ts", it.timestamp)
            })
        }
        prefs(ctx).edit().putString(KEY, arr.toString()).apply()
    }

    fun clear(ctx: Context) {
        prefs(ctx).edit().remove(KEY).apply()
    }
}
