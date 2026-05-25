package com.example.passportreader

import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.example.passportreader.databinding.ActivityMainBinding
import com.example.passportreader.mrz.MrzInfo

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val scanLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val mrz = result.data?.getParcelableExtra<MrzInfo>(MrzInfo.EXTRA_KEY)
            if (mrz != null) {
                // Naar NFC-stap
                val intent = Intent(this, NfcReadActivity::class.java).apply {
                    putExtra(MrzInfo.EXTRA_KEY, mrz)
                }
                startActivity(intent)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnScan.setOnClickListener {
            scanLauncher.launch(Intent(this, ScanMrzActivity::class.java))
        }
    }
}
