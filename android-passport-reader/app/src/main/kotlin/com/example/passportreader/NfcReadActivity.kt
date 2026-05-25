package com.example.passportreader

import android.app.PendingIntent
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.passportreader.databinding.ActivityNfcReadBinding
import com.example.passportreader.model.PassportData
import com.example.passportreader.mrz.MrzInfo
import com.example.passportreader.nfc.PassportNfcReader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class NfcReadActivity : AppCompatActivity() {

    private lateinit var binding: ActivityNfcReadBinding
    private var nfcAdapter: NfcAdapter? = null
    private lateinit var mrz: MrzInfo
    private val reader = PassportNfcReader()

    @Volatile private var processing = false
    private var lastTag: Tag? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNfcReadBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val parsed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(MrzInfo.EXTRA_KEY, MrzInfo::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra<MrzInfo>(MrzInfo.EXTRA_KEY)
        }
        if (parsed == null) { finish(); return }
        mrz = parsed

        val docLabel = if (mrz.documentType == "ID") "ID-kaart" else "Paspoort"
        binding.status.text = "$docLabel · ${mrz.documentNumber}\n" +
            "Geboren: ${formatYYMMDD(mrz.birthDateYYMMDD)}\n" +
            "Verloopt: ${formatYYMMDD(mrz.expiryDateYYMMDD)}"

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter == null) {
            binding.title.text = "Dit toestel heeft geen NFC"
            binding.progress.visibility = View.GONE
            return
        }
        if (!nfcAdapter!!.isEnabled) {
            binding.title.text = "Zet NFC aan in instellingen"
            binding.progress.visibility = View.GONE
        }

        binding.btnDone.setOnClickListener { finish() }
        binding.btnRetry.setOnClickListener {
            binding.btnRetry.visibility = View.GONE
            binding.progress.visibility = View.VISIBLE
            binding.status.text = getString(R.string.nfc_retry_prompt)
            val tag = lastTag
            if (tag != null) startReading(tag)
        }
    }

    override fun onResume() {
        super.onResume()
        val intent = Intent(this, javaClass)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_MUTABLE else 0
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)
        nfcAdapter?.enableForegroundDispatch(this, pendingIntent, null, null)
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (processing) return
        val tag: Tag? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
        }
        if (tag != null) {
            lastTag = tag
            startReading(tag)
        }
    }

    private fun startReading(tag: Tag) {
        processing = true
        binding.btnRetry.visibility = View.GONE
        binding.btnDone.visibility = View.GONE
        binding.details.visibility = View.GONE
        binding.photo.visibility = View.GONE
        binding.status.text = getString(R.string.nfc_step_connecting)
        binding.progress.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val data = withContext(Dispatchers.IO) {
                    reader.read(tag, mrz) { stage ->
                        lifecycleScope.launch { binding.status.text = stageLabel(stage) }
                    }
                }
                showResult(data)
            } catch (e: Exception) {
                e.printStackTrace()
                binding.status.text = "${getString(R.string.nfc_error_prefix)}: " +
                    (e.message ?: "onbekende fout")
                binding.progress.visibility = View.GONE
                binding.btnRetry.visibility = View.VISIBLE
                processing = false
            }
        }
    }

    private fun stageLabel(stage: PassportNfcReader.Stage): String = when (stage) {
        PassportNfcReader.Stage.CONNECTING -> getString(R.string.nfc_step_connecting)
        PassportNfcReader.Stage.PACE       -> getString(R.string.nfc_step_pace)
        PassportNfcReader.Stage.BAC        -> getString(R.string.nfc_step_bac)
        PassportNfcReader.Stage.DG1        -> getString(R.string.nfc_step_dg1)
        PassportNfcReader.Stage.DG2        -> getString(R.string.nfc_step_dg2)
    }

    private fun showResult(d: PassportData) {
        binding.progress.visibility = View.GONE
        binding.title.text = getString(R.string.result_title)
        binding.status.text = getString(R.string.nfc_done)
        binding.btnDone.visibility = View.VISIBLE
        binding.btnRetry.visibility = View.GONE
        binding.details.visibility = View.VISIBLE
        binding.details.removeAllViews()

        d.faceImageJpeg?.let { bytes ->
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bmp != null) {
                binding.photo.setImageBitmap(bmp)
                binding.photo.visibility = View.VISIBLE
            }
        }

        addRow("Voornaam", d.givenNames)
        addRow("Achternaam", d.surname)
        addRow("Nationaliteit", d.nationality)
        addRow("Documentnummer", d.documentNumber, mono = true)
        addRow("Geboortedatum", formatYYMMDD(d.dateOfBirth), mono = true)
        addRow("Verloopdatum", formatYYMMDD(d.dateOfExpiry), mono = true)
        addRow("Geslacht", when (d.gender) {
            "MALE" -> "M"
            "FEMALE" -> "V"
            else -> d.gender
        })
    }

    private fun addRow(label: String, value: String?, mono: Boolean = false) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 12, 0, 12)
        }
        val lblTv = TextView(this).apply {
            text = label
            setTextColor(Color.parseColor("#6B7280"))
            textSize = 13f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val valTv = TextView(this).apply {
            text = value ?: "—"
            setTextColor(Color.parseColor("#0B1220"))
            textSize = 14f
            setTypeface(if (mono) Typeface.MONOSPACE else Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        row.addView(lblTv); row.addView(valTv)
        binding.details.addView(row)
    }

    private fun formatYYMMDD(raw: String?): String? {
        if (raw == null || raw.length != 6) return raw
        val yy = raw.substring(0, 2).toIntOrNull() ?: return raw
        val mm = raw.substring(2, 4)
        val dd = raw.substring(4, 6)
        // ICAO 9303 conventie: dob in verleden, expiry in (nabije) toekomst.
        // YY > (huidigeYY + 10) → 19xx, anders 20xx.
        val thisYY = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR) % 100
        val century = if (yy > thisYY + 10) "19" else "20"
        return "$dd-$mm-$century${"%02d".format(yy)}"
    }
}
