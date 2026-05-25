package com.example.passportreader

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.example.passportreader.cloud.SupabaseClient
import com.example.passportreader.databinding.ActivityMainBinding
import com.example.passportreader.mrz.MrzInfo

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var cloud: SupabaseClient

    private val scanLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data ?: return@registerForActivityResult
            val mrz = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                data.getParcelableExtra(MrzInfo.EXTRA_KEY, MrzInfo::class.java)
            } else {
                @Suppress("DEPRECATION")
                data.getParcelableExtra<MrzInfo>(MrzInfo.EXTRA_KEY)
            }
            if (mrz != null) {
                val intent = Intent(this, NfcReadActivity::class.java).apply {
                    putExtra(MrzInfo.EXTRA_KEY, mrz)
                }
                startActivity(intent)
            }
        }

    private val loginLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            updateLoginCard()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        cloud = SupabaseClient.get(this)

        binding.btnScan.setOnClickListener {
            scanLauncher.launch(Intent(this, ScanMrzActivity::class.java))
        }
        binding.btnLoginAction.setOnClickListener {
            if (cloud.isLoggedIn) {
                cloud.logout()
                updateLoginCard()
            } else {
                loginLauncher.launch(Intent(this, LoginActivity::class.java))
            }
        }
    }

    override fun onResume() {
        super.onResume()
        updateLoginCard()
    }

    private fun updateLoginCard() {
        if (cloud.isLoggedIn) {
            binding.loginStatus.text = getString(R.string.main_logged_in_as, cloud.email ?: "—")
            binding.btnLoginAction.text = getString(R.string.main_logout)
            binding.loginDot.setBackgroundResource(R.drawable.bg_status_dot_online)
        } else {
            binding.loginStatus.text = getString(R.string.main_logged_out)
            binding.btnLoginAction.text = getString(R.string.main_login)
            binding.loginDot.setBackgroundResource(R.drawable.bg_status_dot_offline)
        }
    }
}
