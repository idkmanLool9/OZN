package com.example.passportreader

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
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
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.passportreader.cloud.SupabaseClient
import com.example.passportreader.databinding.ActivityNfcReadBinding
import com.example.passportreader.databinding.ItemStepBinding
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

    private lateinit var stepConnect: ItemStepBinding
    private lateinit var stepCrypto:  ItemStepBinding
    private lateinit var stepDg1:     ItemStepBinding
    private lateinit var stepDg2:     ItemStepBinding

    private var pulseAnimator: AnimatorSet? = null

    @Volatile private var processing = false
    private var lastTag: Tag? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNfcReadBinding.inflate(layoutInflater)
        setContentView(binding.root)

        stepConnect = binding.stepConnect
        stepCrypto  = binding.stepCrypto
        stepDg1     = binding.stepDg1
        stepDg2     = binding.stepDg2
        stepConnect.stepLabel.setText(R.string.step_connect)
        stepCrypto.stepLabel.setText(R.string.step_crypto)
        stepDg1.stepLabel.setText(R.string.step_dg1)
        stepDg2.stepLabel.setText(R.string.step_dg2)

        val parsed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(MrzInfo.EXTRA_KEY, MrzInfo::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra<MrzInfo>(MrzInfo.EXTRA_KEY)
        }
        if (parsed == null) { finish(); return }
        mrz = parsed

        val docLabel = if (mrz.documentType == "ID") "ID-kaart" else "Paspoort"
        binding.docInfo.text = "$docLabel · ${mrz.documentNumber}\n" +
            "Geboren ${formatYYMMDD(mrz.birthDateYYMMDD)} · " +
            "verloopt ${formatYYMMDD(mrz.expiryDateYYMMDD)}"

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter == null) {
            binding.title.text = "Dit toestel heeft geen NFC"
            stopPulse()
            return
        }
        if (!nfcAdapter!!.isEnabled) {
            binding.title.text = "Zet NFC aan in instellingen"
            stopPulse()
        }

        binding.btnDone.setOnClickListener { finish() }
        binding.btnCouple.setOnClickListener { onCoupleClicked() }
        binding.btnRetry.setOnClickListener {
            binding.btnRetry.visibility = View.GONE
            binding.errorMsg.visibility = View.GONE
            resetSteps()
            binding.stepsCard.visibility = View.GONE
            startPulse()
            val tag = lastTag
            if (tag != null) startReading(tag)
        }

        startPulse()
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

    override fun onDestroy() {
        super.onDestroy()
        pulseAnimator?.cancel()
        pulseAnimator = null
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
        binding.errorMsg.visibility = View.GONE
        resetSteps()
        binding.stepsCard.visibility = View.VISIBLE
        setStepState(stepConnect, StepState.ACTIVE)

        lifecycleScope.launch {
            try {
                val data = withContext(Dispatchers.IO) {
                    reader.read(tag, mrz) { stage ->
                        lifecycleScope.launch { onStage(stage) }
                    }
                }
                showResult(data)
            } catch (e: Exception) {
                e.printStackTrace()
                binding.errorMsg.text = "${getString(R.string.nfc_error_prefix)}: " +
                    (e.message ?: "onbekende fout")
                binding.errorMsg.visibility = View.VISIBLE
                binding.btnRetry.visibility = View.VISIBLE
                stopPulse()
                processing = false
            }
        }
    }

    private fun onStage(stage: PassportNfcReader.Stage) {
        when (stage) {
            PassportNfcReader.Stage.CONNECTING -> {
                setStepState(stepConnect, StepState.ACTIVE)
            }
            PassportNfcReader.Stage.PACE -> {
                setStepState(stepConnect, StepState.DONE)
                stepCrypto.stepLabel.setText(R.string.step_crypto_pace)
                setStepState(stepCrypto, StepState.ACTIVE)
            }
            PassportNfcReader.Stage.BAC -> {
                setStepState(stepConnect, StepState.DONE)
                stepCrypto.stepLabel.setText(R.string.step_crypto_bac)
                setStepState(stepCrypto, StepState.ACTIVE)
            }
            PassportNfcReader.Stage.DG1 -> {
                setStepState(stepCrypto, StepState.DONE)
                setStepState(stepDg1, StepState.ACTIVE)
            }
            PassportNfcReader.Stage.DG2 -> {
                setStepState(stepDg1, StepState.DONE)
                setStepState(stepDg2, StepState.ACTIVE)
            }
        }
    }

    private enum class StepState { PENDING, ACTIVE, DONE }

    private fun setStepState(step: ItemStepBinding, state: StepState) {
        when (state) {
            StepState.PENDING -> {
                step.stepIcon.setImageResource(R.drawable.ic_step_pending)
                step.stepLabel.setTextColor(Color.parseColor("#6B7280"))
            }
            StepState.ACTIVE -> {
                step.stepIcon.setImageResource(R.drawable.ic_step_active)
                step.stepLabel.setTextColor(Color.parseColor("#0B1220"))
            }
            StepState.DONE -> {
                step.stepIcon.setImageResource(R.drawable.ic_step_done)
                step.stepLabel.setTextColor(Color.parseColor("#0B1220"))
            }
        }
    }

    private fun resetSteps() {
        setStepState(stepConnect, StepState.PENDING)
        setStepState(stepCrypto,  StepState.PENDING)
        setStepState(stepDg1,     StepState.PENDING)
        setStepState(stepDg2,     StepState.PENDING)
        stepCrypto.stepLabel.setText(R.string.step_crypto)
    }

    private fun startPulse() {
        if (pulseAnimator != null) return
        val ring = binding.pulseRing
        ring.visibility = View.VISIBLE
        val scaleX = ObjectAnimator.ofFloat(ring, "scaleX", 1f, 1.25f)
        val scaleY = ObjectAnimator.ofFloat(ring, "scaleY", 1f, 1.25f)
        val alpha  = ObjectAnimator.ofFloat(ring, "alpha", 0.6f, 0f)
        val set = AnimatorSet().apply {
            playTogether(scaleX, scaleY, alpha)
            duration = 1400
            interpolator = AccelerateDecelerateInterpolator()
        }
        set.addListener(object : android.animation.AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) {
                ring.scaleX = 1f; ring.scaleY = 1f; ring.alpha = 0.6f
                if (pulseAnimator != null) set.start()
            }
        })
        pulseAnimator = set
        set.start()
    }

    private fun stopPulse() {
        pulseAnimator?.cancel()
        pulseAnimator = null
        binding.pulseRing.visibility = View.GONE
    }

    private var lastResult: PassportData? = null

    private fun onCoupleClicked() {
        val data = lastResult ?: return
        val cloud = SupabaseClient.get(this)
        if (!cloud.isLoggedIn) {
            startActivity(Intent(this, LoginActivity::class.java))
            return
        }
        val i = Intent(this, DossierPickerActivity::class.java)
            .putExtra(PassportData.EXTRA_KEY, data)
        startActivity(i)
    }

    private fun showResult(d: PassportData) {
        lastResult = d
        stopPulse()
        binding.readingState.visibility = View.GONE
        binding.resultState.visibility = View.VISIBLE
        binding.details.removeAllViews()

        val cloud = SupabaseClient.get(this)
        binding.btnCouple.text = if (cloud.isLoggedIn)
            getString(R.string.nfc_couple_button)
        else
            getString(R.string.nfc_couple_login_first)

        d.faceImageJpeg?.let { bytes ->
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bmp != null) binding.photo.setImageBitmap(bmp)
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
            setPadding(0, 14, 0, 14)
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
        val thisYY = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR) % 100
        val century = if (yy > thisYY + 10) "19" else "20"
        return "$dd-$mm-$century${"%02d".format(yy)}"
    }
}
