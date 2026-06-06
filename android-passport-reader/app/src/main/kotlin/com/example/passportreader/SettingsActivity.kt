package com.example.passportreader

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import com.example.passportreader.cloud.SupabaseClient
import com.example.passportreader.databinding.ActivitySettingsBinding

/**
 * Settings-scherm in iOS Settings-stijl. Grouped lists per categorie:
 *   - Weergave: theme-keuze (System / Light / Dark)
 *   - Account: ingelogde gebruiker + log uit
 *   - Over: versie + privacybeleid
 *
 * Theme-keuze wordt opgeslagen in EncryptedSharedPreferences zodat 'ie
 * over restarts heen blijft, en direct toegepast via AppCompatDelegate.
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var cloud: SupabaseClient

    companion object {
        private const val PREFS = "app_settings"
        private const val KEY_THEME = "theme_mode"

        const val THEME_SYSTEM = 0
        const val THEME_LIGHT = 1
        const val THEME_DARK = 2

        /** Lees opgeslagen theme + pas toe op app-start (call from Application
         *  of MainActivity onCreate vóór setContentView). */
        fun applyStoredTheme(ctx: Context) {
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val mode = prefs.getInt(KEY_THEME, THEME_SYSTEM)
            AppCompatDelegate.setDefaultNightMode(
                when (mode) {
                    THEME_LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
                    THEME_DARK -> AppCompatDelegate.MODE_NIGHT_YES
                    else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                }
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        cloud = SupabaseClient.get(this)

        binding.btnClose.setOnClickListener { finish() }

        binding.cellTheme.setOnClickListener { showThemePicker() }
        binding.cellLogout.setOnClickListener { confirmLogout() }
        binding.cellUpdate.setOnClickListener { triggerUpdateCheck() }
        binding.cellPrivacy.setOnClickListener {
            try {
                startActivity(Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://idkmanlool9.github.io/uitvaart/privacy.html")))
            } catch (_: Exception) {}
        }

        binding.versionValue.text = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"
        refreshAccountCell()
        refreshThemeValue()
    }

    private fun refreshAccountCell() {
        if (cloud.isLoggedIn) {
            binding.accountEmail.text = cloud.email ?: "—"
            binding.cellLogout.visibility = android.view.View.VISIBLE
        } else {
            binding.accountEmail.text = getString(R.string.settings_account_none)
            binding.cellLogout.visibility = android.view.View.GONE
        }
    }

    private fun refreshThemeValue() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val mode = prefs.getInt(KEY_THEME, THEME_SYSTEM)
        binding.themeValue.text = when (mode) {
            THEME_LIGHT -> getString(R.string.settings_theme_light)
            THEME_DARK -> getString(R.string.settings_theme_dark)
            else -> getString(R.string.settings_theme_system)
        }
    }

    private fun showThemePicker() {
        val options = arrayOf(
            getString(R.string.settings_theme_system),
            getString(R.string.settings_theme_light),
            getString(R.string.settings_theme_dark),
        )
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val current = prefs.getInt(KEY_THEME, THEME_SYSTEM)

        AlertDialog.Builder(this)
            .setTitle(R.string.settings_theme)
            .setSingleChoiceItems(options, current) { dialog, which ->
                prefs.edit().putInt(KEY_THEME, which).apply()
                AppCompatDelegate.setDefaultNightMode(
                    when (which) {
                        THEME_LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
                        THEME_DARK -> AppCompatDelegate.MODE_NIGHT_YES
                        else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                    }
                )
                refreshThemeValue()
                dialog.dismiss()
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    /** Handmatige update-check. Toont nu expliciet onderscheid tussen
     *  "geen update beschikbaar", "nieuwere versie gevonden", en
     *  "check faalde" — vs. de oude versie die altijd "je bent up to
     *  date" zei, ook bij fouten. */
    private fun triggerUpdateCheck() {
        binding.updateSpinner.visibility = android.view.View.VISIBLE
        binding.cellUpdate.isClickable = false

        // Settings → Zoek updates is een expliciete user-actie, dus
        // forceFresh: cache overslaan en altijd live GitHub bellen
        AppUpdater.checkForUpdate(this, forceFresh = true) { result ->
            binding.updateSpinner.visibility = android.view.View.GONE
            binding.cellUpdate.isClickable = true

            when (result) {
                is AppUpdater.CheckResult.UpdateAvailable -> {
                    AlertDialog.Builder(this)
                        .setTitle(getString(R.string.settings_update_available,
                            result.info.versionName))
                        .setMessage(result.info.releaseNotes.take(400))
                        .setNegativeButton(R.string.update_dismiss, null)
                        .setPositiveButton(R.string.update_install) { _, _ ->
                            downloadAndInstall(result.info)
                        }
                        .show()
                }
                is AppUpdater.CheckResult.UpToDate -> {
                    android.widget.Toast.makeText(
                        this,
                        getString(R.string.settings_uptodate, result.currentVersion),
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                }
                is AppUpdater.CheckResult.Error -> {
                    AlertDialog.Builder(this)
                        .setTitle(R.string.settings_update_check_failed)
                        .setMessage(result.reason)
                        .setPositiveButton(android.R.string.ok, null)
                        .show()
                }
            }
        }
    }

    private fun downloadAndInstall(info: AppUpdater.UpdateInfo) {
        val progress = android.app.ProgressDialog(this).apply {
            setTitle(getString(R.string.update_install))
            setMessage(getString(R.string.update_subtitle_downloading, 0))
            setCancelable(false)
            isIndeterminate = false
            setProgressStyle(android.app.ProgressDialog.STYLE_HORIZONTAL)
            max = 100
            show()
        }
        AppUpdater.downloadApk(
            this,
            info.downloadUrl,
            onProgress = { pct ->
                progress.progress = pct
                progress.setMessage(getString(R.string.update_subtitle_downloading, pct))
            },
            onComplete = { file ->
                progress.dismiss()
                if (file == null) {
                    android.widget.Toast.makeText(
                        this, R.string.update_subtitle_failed,
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                } else {
                    AppUpdater.installApk(this, file)
                }
            }
        )
    }

    private fun confirmLogout() {
        AlertDialog.Builder(this)
            .setTitle(R.string.main_logout_confirm_title)
            .setMessage(R.string.settings_logout_confirm)
            .setNegativeButton(R.string.main_logout_confirm_cancel, null)
            .setPositiveButton(R.string.main_logout_confirm_yes) { _, _ ->
                cloud.logout()
                RecentScans.clear(this)
                refreshAccountCell()
            }
            .show()
    }
}
