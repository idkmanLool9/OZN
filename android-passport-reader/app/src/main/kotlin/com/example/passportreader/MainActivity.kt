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
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        cloud = SupabaseClient.get(this)

        // ScanMrz opent NfcRead zelf direct — geen round-trip nodig
        binding.btnScan.setOnClickListener {
            startActivity(Intent(this, ScanMrzActivity::class.java))
        }
        binding.loginCard.setOnClickListener {
            if (cloud.isLoggedIn) confirmLogout() else openLogin()
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
                updateLoginCard()
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
}
