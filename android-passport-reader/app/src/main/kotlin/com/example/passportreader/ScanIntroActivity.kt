package com.example.passportreader

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.example.passportreader.databinding.ActivityScanIntroBinding

/**
 * Pre-scan intro-scherm met instructie + illustratie. Stuurt na "Begin scan"
 * door naar ScanMrzActivity. Helpt nieuwe gebruikers begrijpen waar ze de
 * camera op moeten richten.
 *
 * Help-icoon rechtsboven opent een korte tip-dialog met scan-instructies.
 */
class ScanIntroActivity : AppCompatActivity() {

    private lateinit var binding: ActivityScanIntroBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityScanIntroBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnHelp.setOnClickListener { showHelpDialog() }
        binding.btnStart.setOnClickListener {
            startActivity(Intent(this, ScanMrzActivity::class.java))
            // Sluit intro zodat back uit ScanMrz direct naar Main gaat
            finish()
        }
    }

    private fun showHelpDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.intro_help_title)
            .setMessage(R.string.intro_help_body)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }
}
