package com.example.passportreader

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.example.passportreader.cloud.SupabaseClient
import com.example.passportreader.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var cloud: SupabaseClient

    private val loginLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            updateLoginCard()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Apply opgeslagen theme-keuze VOOR setContentView, anders flikkert
        // het scherm bij eerste open
        SettingsActivity.applyStoredTheme(this)

        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        cloud = SupabaseClient.get(this)

        binding.btnScan.setOnClickListener {
            startActivity(Intent(this, ScanMrzActivity::class.java))
        }
        binding.loginCard.setOnClickListener {
            if (cloud.isLoggedIn) confirmLogout() else openLogin()
        }
        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        binding.version.text = getString(
            R.string.main_version,
            BuildConfig.VERSION_NAME,
            BuildConfig.VERSION_CODE
        )
    }

    override fun onResume() {
        super.onResume()
        updateLoginCard()
        // Recente-scans-lijst herladen — wordt gevuld zodra de cache er
        // is (commit 8, "recent scans persistence")
        renderRecent()
    }

    private fun openLogin() {
        loginLauncher.launch(Intent(this, LoginActivity::class.java))
    }

    private fun confirmLogout() {
        AlertDialog.Builder(this)
            .setTitle(R.string.main_logout_confirm_title)
            .setMessage(getString(R.string.main_logged_in_as, cloud.email ?: "—"))
            .setNegativeButton(R.string.main_logout_confirm_cancel, null)
            .setPositiveButton(R.string.main_logout_confirm_yes) { _, _ ->
                cloud.logout()
                RecentScans.clear(this)
                updateLoginCard()
                renderRecent()
            }
            .show()
    }

    private fun updateLoginCard() {
        if (cloud.isLoggedIn) {
            binding.loginStatus.text = getString(R.string.main_logged_in_as, cloud.email ?: "—")
            binding.loginAction.text = getString(R.string.main_logout)
            binding.loginDot.setBackgroundResource(R.drawable.bg_status_dot_online)
        } else {
            binding.loginStatus.text = getString(R.string.main_logged_out)
            binding.loginAction.text = getString(R.string.main_login)
            binding.loginDot.setBackgroundResource(R.drawable.bg_status_dot_offline)
        }
    }

    /** Vult de Recent-sectie met de laatste N scans uit
     *  EncryptedSharedPreferences. */
    private fun renderRecent() {
        val items = RecentScans.list(this)
        binding.recentList.removeAllViews()
        if (items.isEmpty()) {
            binding.recentList.visibility = android.view.View.GONE
            binding.recentEmpty.visibility = android.view.View.VISIBLE
            return
        }
        binding.recentList.visibility = android.view.View.VISIBLE
        binding.recentEmpty.visibility = android.view.View.GONE

        val inflater = layoutInflater
        items.forEachIndexed { index, entry ->
            val row = inflater.inflate(
                R.layout.item_recent_scan,
                binding.recentList,
                false
            )
            row.findViewById<android.widget.TextView>(R.id.name).text = entry.name
            row.findViewById<android.widget.TextView>(R.id.docNo).text =
                "Doc. ${entry.docNo} · ${formatRelative(entry.timestamp)}"
            row.findViewById<android.widget.TextView>(R.id.avatar).text =
                initials(entry.name)
            binding.recentList.addView(row)

            if (index < items.lastIndex) {
                val divider = android.view.View(this).apply {
                    layoutParams = android.widget.LinearLayout.LayoutParams(
                        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                        (0.5f * resources.displayMetrics.density).toInt().coerceAtLeast(1),
                    ).apply { setMargins(
                        (16 * resources.displayMetrics.density).toInt(), 0, 0, 0
                    )}
                    setBackgroundColor(
                        androidx.core.content.ContextCompat.getColor(
                            this@MainActivity, R.color.hair
                        )
                    )
                }
                binding.recentList.addView(divider)
            }
        }
    }

    private fun initials(name: String): String {
        val words = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return "?"
        val first = words.first().firstOrNull()?.uppercase() ?: ""
        val last  = if (words.size > 1) words.last().firstOrNull()?.uppercase() ?: "" else ""
        return (first + last).ifBlank { "?" }
    }

    private fun formatRelative(ts: Long): String {
        val diffMs = System.currentTimeMillis() - ts
        val diffMin = diffMs / 60_000
        return when {
            diffMin < 1 -> "Zojuist"
            diffMin < 60 -> "${diffMin}m geleden"
            diffMin < 60 * 24 -> "${diffMin / 60}u geleden"
            else -> {
                val days = diffMin / (60 * 24)
                if (days < 7) "${days}d geleden"
                else {
                    val fmt = java.text.SimpleDateFormat("d MMM", java.util.Locale("nl"))
                    fmt.format(java.util.Date(ts))
                }
            }
        }
    }
}
