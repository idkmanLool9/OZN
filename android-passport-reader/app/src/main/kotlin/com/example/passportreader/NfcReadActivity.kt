package com.example.passportreader

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.util.Log
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
    private lateinit var stepExtra:   ItemStepBinding

    private val pulseAnimators = mutableListOf<AnimatorSet>()

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
        stepExtra   = binding.stepExtra
        stepConnect.stepLabel.setText(R.string.step_connect)
        stepCrypto.stepLabel.setText(R.string.step_crypto)
        stepDg1.stepLabel.setText(R.string.step_dg1)
        stepDg2.stepLabel.setText(R.string.step_dg2)
        stepExtra.stepLabel.setText(R.string.step_extra)

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
        binding.btnCancel.setOnClickListener { finish() }
        binding.btnCouple.setOnClickListener { onCoupleClicked() }
        binding.btnDelete.setOnClickListener { onDeleteClicked() }
        binding.btnRetry.setOnClickListener {
            binding.btnRetry.visibility = View.GONE
            binding.errorMsg.visibility = View.GONE
            resetSteps()
            binding.stepsCardWrap.visibility = View.GONE
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
        pulseAnimators.forEach { it.cancel() }
        pulseAnimators.clear()
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
        binding.stepsCardWrap.visibility = View.VISIBLE
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
            PassportNfcReader.Stage.EXTRA -> {
                setStepState(stepDg2, StepState.DONE)
                setStepState(stepExtra, StepState.ACTIVE)
            }
        }
    }

    private enum class StepState { PENDING, ACTIVE, DONE }

    private fun setStepState(step: ItemStepBinding, state: StepState) {
        val muted = androidx.core.content.ContextCompat.getColor(this, R.color.muted)
        val ink = androidx.core.content.ContextCompat.getColor(this, R.color.ink)
        when (state) {
            StepState.PENDING -> {
                step.stepIcon.setImageResource(R.drawable.ic_step_pending)
                step.stepLabel.setTextColor(muted)
            }
            StepState.ACTIVE -> {
                step.stepIcon.setImageResource(R.drawable.ic_step_active)
                step.stepLabel.setTextColor(ink)
            }
            StepState.DONE -> {
                step.stepIcon.setImageResource(R.drawable.ic_step_done)
                step.stepLabel.setTextColor(ink)
            }
        }
    }

    private fun resetSteps() {
        setStepState(stepConnect, StepState.PENDING)
        setStepState(stepCrypto,  StepState.PENDING)
        setStepState(stepDg1,     StepState.PENDING)
        setStepState(stepDg2,     StepState.PENDING)
        setStepState(stepExtra,   StepState.PENDING)
        stepCrypto.stepLabel.setText(R.string.step_crypto)
    }

    /** Concentrische sonar-rings rond NFC-icoon. Drie ringen, elk 600ms
     *  gestaggerd voor "ping"-effect zoals iOS AirDrop/Find My. */
    private fun startPulse() {
        if (pulseAnimators.isNotEmpty()) return
        val rings = listOf(binding.pulseRing1, binding.pulseRing2, binding.pulseRing3)
        rings.forEachIndexed { idx, ring ->
            ring.visibility = View.VISIBLE
            val set = buildRingAnimator(ring)
            set.startDelay = (idx * 600L)
            set.start()
            pulseAnimators += set
        }
    }

    private fun buildRingAnimator(ring: View): AnimatorSet {
        val scaleX = ObjectAnimator.ofFloat(ring, "scaleX", 0.6f, 1.5f)
        val scaleY = ObjectAnimator.ofFloat(ring, "scaleY", 0.6f, 1.5f)
        val alpha  = ObjectAnimator.ofFloat(ring, "alpha", 0.7f, 0f)
        val set = AnimatorSet().apply {
            playTogether(scaleX, scaleY, alpha)
            duration = 1800
            interpolator = AccelerateDecelerateInterpolator()
        }
        set.addListener(object : android.animation.AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) {
                ring.scaleX = 0.6f; ring.scaleY = 0.6f; ring.alpha = 0.7f
                if (pulseAnimators.isNotEmpty()) set.start()
            }
        })
        return set
    }

    private fun stopPulse() {
        pulseAnimators.forEach { it.cancel() }
        pulseAnimators.clear()
        binding.pulseRing1.visibility = View.GONE
        binding.pulseRing2.visibility = View.GONE
        binding.pulseRing3.visibility = View.GONE
    }

    /** Render de paspoort-card naar een JPEG en schrijf naar internal cache
     *  als 'pending_passport_card.jpg'. DossierPickerActivity gebruikt deze
     *  file om bij het koppelen óók een upload naar Supabase te doen.
     *  Gebruikt View.post() omdat de layout pas in de volgende frame klaar is. */
    private fun capturePassportCardAfterLayout() {
        val cardView = binding.passportCard.root
        cardView.post {
            try {
                val w = cardView.width
                val h = cardView.height
                if (w <= 0 || h <= 0) return@post
                val bmp = android.graphics.Bitmap.createBitmap(
                    w, h, android.graphics.Bitmap.Config.ARGB_8888
                )
                val canvas = android.graphics.Canvas(bmp)
                // Wit fallback achter de gradient zodat transparante delen niet
                // zwart worden
                canvas.drawColor(android.graphics.Color.WHITE)
                cardView.draw(canvas)

                val baos = java.io.ByteArrayOutputStream()
                bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 92, baos)
                bmp.recycle()

                val file = java.io.File(cacheDir, "pending_passport_card.jpg")
                file.writeBytes(baos.toByteArray())
            } catch (_: Exception) {
                // Niet-fataal: koppelen werkt nog steeds, alleen zonder card-image
            }
        }
    }

    /** Vult de paspoort-kaart visualisatie met data uit de chip. De layout
     *  is een visuele representatie van de echte NL paspoort-datapagina:
     *  rode header, foto links, gestructureerde data rechts, gele MRZ
     *  onderaan. */
    private fun bindPassportCard(d: PassportData) {
        // binding.passportCard is een ViewPassportCardNlBinding (geen View);
        // de werkelijke View-tree is binding.passportCard.root.
        val root: View = binding.passportCard.root

        // Foto (DG2) — gebruik decodeFace() voor JPEG2000-fallback via OpenCV.
        // Native BitmapFactory kan geen JP2 lezen en veel NL paspoorten/
        // ID-kaarten gebruiken JP2 voor de pasfoto.
        // BELANGRIJK: foto wordt standaard zwart-wit getoond zoals op de
        // echte paspoort-datapagina. Toggle "Toon in kleur" wisselt.
        val photo = root.findViewById<android.widget.ImageView>(R.id.pcPhoto)
        val face = d.faceImageJpeg
        val bmp = if (face != null && face.isNotEmpty()) decodeFace(face) else null
        if (bmp != null) {
            photo.setImageBitmap(bmp)
            photo.setBackgroundColor(android.graphics.Color.TRANSPARENT)
            applyGrayscaleFilter(photo, !showFaceInColor)
        } else {
            photo.setImageResource(R.drawable.ic_person_placeholder)
        }

        // Nationaliteit + landnaam (NL labels)
        val natCode = d.nationality?.uppercase() ?: ""
        root.findViewById<android.widget.TextView>(R.id.pcNationalityCode).text = natCode
        root.findViewById<android.widget.TextView>(R.id.pcNationalityLabel).text =
            nationalityLabel(natCode)

        // Documentnummer rechtsboven
        root.findViewById<android.widget.TextView>(R.id.pcDocNumber).text =
            d.documentNumber ?: ""

        // Doc-type (P voor passport, I voor ID)
        // We hebben dit niet direct, dus infer uit doc-nummer of nationaliteit
        root.findViewById<android.widget.TextView>(R.id.pcDocType).text = "P"

        // Surname + e/v Molenaar split
        val surname = d.surname?.trim() ?: ""
        val (surnameMain, surnameSecondary) = splitMarriedName(surname)
        root.findViewById<android.widget.TextView>(R.id.pcSurname).text = surnameMain
        val secView = root.findViewById<android.widget.TextView>(R.id.pcSurnameSecondary)
        if (surnameSecondary != null) {
            secView.text = surnameSecondary
            secView.visibility = View.VISIBLE
        } else {
            secView.visibility = View.GONE
        }

        // Voornamen
        root.findViewById<android.widget.TextView>(R.id.pcGivenNames).text =
            d.givenNames?.trim() ?: ""

        // Geboortedatum (YYMMDD → "10 MAA/MAR 1965")
        root.findViewById<android.widget.TextView>(R.id.pcDob).text =
            formatPassportDate(d.dateOfBirth)

        // Geslacht (M/F → M / V/F)
        root.findViewById<android.widget.TextView>(R.id.pcSex).text = when (d.gender?.uppercase()) {
            "F", "FEMALE" -> "V/F"
            "M", "MALE"   -> "M/M"
            else -> "—"
        }

        // Datum van afgifte (YYYYMMDD → "30 AUG/AUG 2021"). Als de chip
        // geen DG12 had: afleiden uit verloopdatum + leeftijd (NL geeft 5j
        // voor minderjarigen, 10j voor volwassenen).
        val issueDateStr = formatIssueDate(d.dateOfIssue)
            .ifBlank { formatPassportDate(estimateIssueYymmdd(d.dateOfBirth, d.dateOfExpiry)) }
        root.findViewById<android.widget.TextView>(R.id.pcIssueDate).text = issueDateStr

        // Verloopdatum
        root.findViewById<android.widget.TextView>(R.id.pcExpiry).text =
            formatPassportDate(d.dateOfExpiry)

        // Autoriteit — chip-data niet altijd gevuld; verberg label én value
        // wanneer leeg zodat de card er compact en klaar uitziet
        val authText = d.issuingAuthority?.takeIf { it.isNotBlank() }
        root.findViewById<android.widget.TextView>(R.id.pcAuthority).apply {
            if (authText != null) {
                text = authText
                visibility = View.VISIBLE
            } else {
                visibility = View.GONE
            }
        }
        root.findViewById<android.widget.TextView>(R.id.pcAuthorityLabel)?.visibility =
            if (authText != null) View.VISIBLE else View.GONE

        // Handtekening (DG7)
        val sigView = root.findViewById<android.widget.ImageView>(R.id.pcSignature)
        val sigBytes = d.signatureImageJpeg
        if (sigBytes != null && sigBytes.isNotEmpty()) {
            val sigBmp = BitmapFactory.decodeByteArray(sigBytes, 0, sigBytes.size)
            sigView.setImageBitmap(sigBmp)
            sigView.visibility = View.VISIBLE
        } else {
            sigView.visibility = View.GONE
        }

        // MRZ reconstrueren uit chip-data (chip slaat MRZ niet exact op)
        val (mrz1, mrz2) = reconstructMrz(d)
        root.findViewById<android.widget.TextView>(R.id.pcMrz1).text = mrz1
        root.findViewById<android.widget.TextView>(R.id.pcMrz2).text = mrz2
    }

    /** Schat de uitgiftedatum o.b.v. NL-conventie:
     *  - 0-18 jaar: 5 jaar geldig
     *  - 18+: 10 jaar geldig
     *  Returns YYMMDD-string (zoals dateOfBirth/Expiry) of "" als
     *  onbepaalbaar. Wordt alleen aangeroepen als DG12.dateOfIssue
     *  echt leeg is.
     */
    private fun estimateIssueYymmdd(dobYymmdd: String?, expiryYymmdd: String?): String {
        if (expiryYymmdd == null || expiryYymmdd.length != 6 ||
            !expiryYymmdd.all { it.isDigit() }) return ""
        val expYy = expiryYymmdd.substring(0, 2).toInt()
        val expMm = expiryYymmdd.substring(2, 4)
        val expDd = expiryYymmdd.substring(4, 6)
        val thisYY = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR) % 100
        // Expiry is altijd in de toekomst t.o.v. dit eeuw-tellen
        val expYear = (if (expYy > thisYY + 10) 1900 else 2000) + expYy

        // Validity-jaren bepalen via geboortedatum (als beschikbaar)
        val validity = if (dobYymmdd != null && dobYymmdd.length == 6 &&
                           dobYymmdd.all { it.isDigit() }) {
            val dobYy = dobYymmdd.substring(0, 2).toInt()
            val dobYear = (if (dobYy > thisYY + 10) 1900 else 2000) + dobYy
            val ageAtExpiry = expYear - dobYear
            // Als persoon bij expiry-jaar ≤ 23 → 5-jarig (minor at issue, 5j)
            // Anders 10-jarig (volwassene)
            if (ageAtExpiry <= 23) 5 else 10
        } else 10
        val issueYear = expYear - validity
        val issueYy = "%02d".format(issueYear % 100)
        return "$issueYy$expMm$expDd"
    }

    /** "10 MAA/MAR 1965" stijl zoals op echte NL paspoort. */
    private fun formatPassportDate(yymmdd: String?): String {
        if (yymmdd == null || yymmdd.length != 6 || !yymmdd.all { it.isDigit() }) return ""
        val yy = yymmdd.substring(0, 2).toInt()
        val mm = yymmdd.substring(2, 4).toInt()
        val dd = yymmdd.substring(4, 6).toInt()
        val thisYY = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR) % 100
        val century = if (yy > thisYY + 10) 1900 else 2000
        val year = century + yy
        if (mm !in 1..12) return "$dd / $mm / $year"
        val nl = arrayOf("JAN", "FEB", "MAA", "APR", "MEI", "JUN",
                         "JUL", "AUG", "SEP", "OKT", "NOV", "DEC")
        val en = arrayOf("JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                         "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
        return "%02d %s/%s %d".format(dd, nl[mm - 1], en[mm - 1], year)
    }

    /** Voor YYYYMMDD-formaat (DG12 issue-date). */
    private fun formatIssueDate(yyyymmdd: String?): String {
        if (yyyymmdd == null || yyyymmdd.length != 8 || !yyyymmdd.all { it.isDigit() }) return ""
        val year = yyyymmdd.substring(0, 4).toInt()
        val mm = yyyymmdd.substring(4, 6).toInt()
        val dd = yyyymmdd.substring(6, 8).toInt()
        if (mm !in 1..12) return "$dd / $mm / $year"
        val nl = arrayOf("JAN", "FEB", "MAA", "APR", "MEI", "JUN",
                         "JUL", "AUG", "SEP", "OKT", "NOV", "DEC")
        val en = arrayOf("JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                         "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
        return "%02d %s/%s %d".format(dd, nl[mm - 1], en[mm - 1], year)
    }

    /** ISO-3-letter landcode → nederlandse landnaam (voor de echte
     *  paspoort-stijl waar het volledige adjectief staat). */
    private fun nationalityLabel(code: String): String = when (code.uppercase()) {
        "NLD" -> "Nederlandse"
        "DEU" -> "Duitse"
        "BEL" -> "Belgische"
        "FRA" -> "Franse"
        "GBR" -> "Britse"
        "USA" -> "Amerikaanse"
        "TUR" -> "Turkse"
        "MAR" -> "Marokkaanse"
        "POL" -> "Poolse"
        "ITA" -> "Italiaanse"
        "ESP" -> "Spaanse"
        "PRT" -> "Portugese"
        else -> code
    }

    /** "De Bruijn e/v Molenaar" → ("De Bruijn", "e/v Molenaar"). */
    private fun splitMarriedName(surname: String): Pair<String, String?> {
        val markers = listOf(" e/v ", " w/v ", " geb. ", " geboren ")
        for (m in markers) {
            val idx = surname.indexOf(m, ignoreCase = true)
            if (idx > 0) {
                val main = surname.substring(0, idx).trim()
                val secondary = surname.substring(idx).trim()
                return main to secondary
            }
        }
        return surname to null
    }

    /** Reconstrueer MRZ-lijnen uit chip-data voor visuele weergave.
     *  Check-digits via ICAO 9303 mod-37-3. */
    private fun reconstructMrz(d: PassportData): Pair<String, String> {
        val nat = (d.nationality ?: "NLD").take(3).padEnd(3, '<')
        val surnameClean = (d.surname ?: "")
            .uppercase()
            .replace(Regex("[^A-Z ]"), "")
            .trim()
            .replace(' ', '<')
        val givenClean = (d.givenNames ?: "")
            .uppercase()
            .replace(Regex("[^A-Z ]"), "")
            .trim()
            .replace(' ', '<')
        val line1Pre = "P<$nat$surnameClean<<$givenClean"
        val line1 = line1Pre.padEnd(44, '<').take(44)

        val docNum = (d.documentNumber ?: "")
            .uppercase()
            .replace(Regex("[^A-Z0-9]"), "")
            .take(9)
            .padEnd(9, '<')
        val docCheck = mrzCheck(docNum)
        val dob = (d.dateOfBirth ?: "000000").take(6).padEnd(6, '<')
        val dobCheck = mrzCheck(dob)
        val sex = when (d.gender?.uppercase()) {
            "F", "FEMALE" -> "F"
            "M", "MALE" -> "M"
            else -> "<"
        }
        val exp = (d.dateOfExpiry ?: "000000").take(6).padEnd(6, '<')
        val expCheck = mrzCheck(exp)

        val personal = (d.bsn ?: "").take(14).padEnd(14, '<')
        val personalCheck = if (d.bsn != null) mrzCheck(personal.trimEnd('<')) else "<"

        // Composite check over docnum+check+dob+check+exp+check+personal+check
        val composite = docNum + docCheck + dob + dobCheck + exp + expCheck +
                       personal + personalCheck
        val finalCheck = mrzCheck(composite)

        val line2 = "$docNum$docCheck$nat$dob$dobCheck$sex$exp$expCheck" +
                    "$personal$personalCheck$finalCheck"
        return line1 to line2.padEnd(44, '<').take(44)
    }

    /** ICAO 9303 mod-37-3 check-digit. */
    private fun mrzCheck(field: String): String {
        val weights = intArrayOf(7, 3, 1)
        var sum = 0
        for ((i, c) in field.withIndex()) {
            val v = when (c) {
                in '0'..'9' -> c - '0'
                in 'A'..'Z' -> c - 'A' + 10
                '<' -> 0
                else -> 0
            }
            sum += v * weights[i % 3]
        }
        return (sum % 10).toString()
    }

    /** Converteer chip-bytes (kunnen JPEG OF JPEG2000 zijn) naar échte
     *  JPEG-bytes. De DG2 face-image van veel NL paspoorten is JP2;
     *  Android galerij + ontvangende apps verwachten JPEG-stream met
     *  matchende MIME, anders zien ze een grijze placeholder. */
    private fun toRealJpegBytes(input: ByteArray, quality: Int = 92): ByteArray? {
        val bmp = decodeFace(input) ?: return null
        val baos = java.io.ByteArrayOutputStream()
        return try {
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos)
            baos.toByteArray()
        } finally {
            bmp.recycle()
        }
    }

    /** Deelt de pasfoto via Android Intent.ACTION_SEND. Schrijft JPEG
     *  naar internal cache/shared en geeft toegang via FileProvider zodat
     *  ontvangende apps de file kunnen openen zonder permission. */
    private fun sharePhoto(bytes: ByteArray, personName: String) {
        try {
            // Convert chip-bytes naar echte JPEG (mogelijk JP2 → JPEG via OpenCV)
            val jpegBytes = toRealJpegBytes(bytes) ?: throw java.io.IOException(
                "Kon pasfoto niet converteren — chip-formaat onbekend"
            )
            val sharedDir = java.io.File(cacheDir, "shared")
            sharedDir.mkdirs()
            val safeName = personName
                .replace(Regex("[^A-Za-z0-9 -]"), "")
                .trim()
                .ifBlank { "pasfoto" }
            val file = java.io.File(sharedDir, "$safeName.jpg")
            file.writeBytes(jpegBytes)
            val uri = androidx.core.content.FileProvider.getUriForFile(
                this, "${packageName}.fileprovider", file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/jpeg"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(
                intent, getString(R.string.result_share_chooser_title)
            ))
        } catch (e: Exception) {
            android.widget.Toast.makeText(
                this, e.message ?: "Delen mislukt",
                android.widget.Toast.LENGTH_LONG
            ).show()
        }
    }

    /** Slaat de pasfoto op in de galerij via MediaStore. Werkt op alle
     *  Android-versies; op API 29+ via RELATIVE_PATH, op oudere via de
     *  deprecated insertImage (nog steeds functioneel). */
    private fun savePhotoToGallery(bytes: ByteArray, personName: String) {
        try {
            val safeName = personName
                .replace(Regex("[^A-Za-z0-9 -]"), "")
                .trim()
                .ifBlank { "pasfoto" }
            val filename = "${safeName}_${System.currentTimeMillis()}.jpg"

            // Converteer chip-bytes naar echte JPEG (JP2 → JPEG via OpenCV)
            // anders kan Android-galerij ze niet renderen → grijze tile.
            val jpegBytes = toRealJpegBytes(bytes) ?: throw java.io.IOException(
                "Kon pasfoto niet converteren — chip-formaat onbekend"
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val cv = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, filename)
                    put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                    put(
                        android.provider.MediaStore.Images.Media.RELATIVE_PATH,
                        "${android.os.Environment.DIRECTORY_PICTURES}/Pasfoto"
                    )
                }
                val uri = contentResolver.insert(
                    android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv
                ) ?: throw java.io.IOException("Kon geen MediaStore-entry maken")
                contentResolver.openOutputStream(uri)?.use { it.write(jpegBytes) }
                    ?: throw java.io.IOException("Kon output-stream niet openen")
            } else {
                val bmp = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
                    ?: throw java.io.IOException("JPEG-decode mislukt")
                @Suppress("DEPRECATION")
                android.provider.MediaStore.Images.Media.insertImage(
                    contentResolver, bmp, filename, "Pasfoto van ID-document"
                )
            }

            android.widget.Toast.makeText(
                this, R.string.result_photo_saved,
                android.widget.Toast.LENGTH_SHORT
            ).show()
            binding.root.performHapticFeedback(
                android.view.HapticFeedbackConstants.CONFIRM
            )
        } catch (e: Exception) {
            android.widget.Toast.makeText(
                this,
                "${getString(R.string.result_photo_save_failed)}: ${e.message}",
                android.widget.Toast.LENGTH_LONG
            ).show()
        }
    }

    private var lastResult: PassportData? = null

    /** Toon de chip-pasfoto in kleur (true) of zwart-wit (false). Default
     *  false omdat een echt NL paspoort de foto in zw/w print. */
    private var showFaceInColor = false

    /** Zet (of haal) een grayscale ColorMatrixColorFilter op een ImageView. */
    private fun applyGrayscaleFilter(view: android.widget.ImageView, gray: Boolean) {
        if (gray) {
            val matrix = android.graphics.ColorMatrix().apply { setSaturation(0f) }
            view.colorFilter = android.graphics.ColorMatrixColorFilter(matrix)
        } else {
            view.colorFilter = null
        }
    }

    private val bsnLauncher =
        registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()) { result ->
            val bsn = result.data?.getStringExtra(ScanBsnActivity.RESULT_KEY)
            if (!bsn.isNullOrEmpty()) {
                lastResult?.let { current ->
                    val updated = current.copy(bsn = bsn)
                    lastResult = updated
                    // Re-render: alleen het details-blok wordt opnieuw gevuld
                    renderResultRows(updated)
                }
            }
        }

    /** Gooi de huidige scan-resultaat weg en sluit terug naar Main — daar
     *  kan user opnieuw beginnen. iOS trash-knop conventie. */
    private fun onDeleteClicked() {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(R.string.result_delete_confirm_title)
            .setMessage(R.string.result_delete_confirm_msg)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.result_delete) { _, _ ->
                lastResult = null
                finish()
            }
            .show()
    }

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

        // iOS bottom-sheet style slide-up animatie (vanaf onderkant)
        binding.resultState.translationY = 240f
        binding.resultState.alpha = 0f
        binding.resultState.animate()
            .translationY(0f)
            .alpha(1f)
            .setDuration(320)
            .setInterpolator(android.view.animation.DecelerateInterpolator(1.6f))
            .start()

        // Bewaar in recente-scans cache (versleuteld lokaal, max 5)
        val fullName = listOfNotNull(d.givenNames, d.surname)
            .joinToString(" ").trim()
        if (fullName.isNotBlank() && !d.documentNumber.isNullOrBlank()) {
            RecentScans.add(this, fullName, d.documentNumber!!)
        }

        val cloud = SupabaseClient.get(this)
        binding.btnCouple.text = if (cloud.isLoggedIn)
            getString(R.string.nfc_couple_button)
        else
            getString(R.string.nfc_couple_login_first)

        renderPhoto(d.faceImageJpeg)

        // Toon pasfoto-actie-buttons alleen als er daadwerkelijk een
        // foto in de chip stond
        val face = d.faceImageJpeg
        if (face != null && face.isNotEmpty()) {
            binding.photoActions.visibility = View.VISIBLE
            binding.btnSharePhoto.setOnClickListener { sharePhoto(face, fullName) }
            binding.btnSavePhoto.setOnClickListener { savePhotoToGallery(face, fullName) }
        } else {
            binding.photoActions.visibility = View.GONE
        }

        // Markeer ook de laatste step als done in result-state
        setStepState(stepExtra, StepState.DONE)

        renderResultRows(d)
        bindPassportCard(d)
        capturePassportCardAfterLayout()

        // Toggle voor kleur/zw-w op de paspoort-card foto
        binding.btnFaceColor.text = getString(
            if (showFaceInColor) R.string.face_show_grayscale else R.string.face_show_color
        )
        binding.btnFaceColor.setOnClickListener {
            showFaceInColor = !showFaceInColor
            // Re-render alleen de card (sneller dan full showResult)
            bindPassportCard(d)
            // Re-capture zodat ALS user nu koppelt, de geüploade card de
            // huidige toggle-stand heeft
            capturePassportCardAfterLayout()
            binding.btnFaceColor.text = getString(
                if (showFaceInColor) R.string.face_show_grayscale else R.string.face_show_color
            )
        }

        // Als 't een NL-document is zonder BSN: automatisch achterkant
        // scannen. BSN staat sinds 2014 niet meer in de chip, alleen
        // geprint op de back. Gebruiker kan in dat scherm overslaan.
        if (d.bsn == null && d.nationality == "NLD") {
            bsnLauncher.launch(Intent(this, ScanBsnActivity::class.java))
        }
    }

    private fun renderResultRows(d: PassportData) {
        binding.details.removeAllViews()
        addRow("Voornaam", d.givenNames)
        addRow("Achternaam", d.surname)
        if (d.title != null) addRow("Titel", d.title)
        if (d.otherNames != null) addRow("Andere namen", d.otherNames)
        addRow("Nationaliteit", d.nationality)
        addRow("Documentnummer", d.documentNumber, mono = true)
        if (d.bsn != null) addRow("BSN", d.bsn, mono = true)
        addRow("Geboortedatum", formatYYMMDD(d.dateOfBirth), mono = true)
        if (d.placeOfBirth != null) addRow("Geboorteplaats", d.placeOfBirth)
        addRow("Verloopdatum", formatYYMMDD(d.dateOfExpiry), mono = true)
        addRow("Geslacht", when (d.gender) {
            "MALE" -> "M"
            "FEMALE" -> "V"
            else -> d.gender
        })
        if (d.profession != null) addRow("Beroep", d.profession)
        if (d.telephone != null) addRow("Telefoon", d.telephone, mono = true)
        if (d.address != null) addRow("Adres", d.address)
        if (d.postcode != null) addRow("Postcode", d.postcode, mono = true)
        if (d.city != null) addRow("Woonplaats", d.city)
        if (d.issuingAuthority != null) addRow("Uitgegeven door", d.issuingAuthority)
        if (d.dateOfIssue != null) addRow("Uitgiftedatum", formatYYYYMMDD(d.dateOfIssue), mono = true)

        // DG16 — noodgeval-contacten (1 rij per persoon)
        d.emergencyContacts.forEachIndexed { i, c ->
            addRow(if (d.emergencyContacts.size > 1) "Contact ${i + 1}" else "Noodcontact", c)
        }

        // DG3/DG4 — alleen vermelden als de chip ze claimt; lezen kan niet
        // zonder overheids-EAC-sleutel.
        if (d.fingerprintsLocked) addRow("Vingerafdrukken", "🔒 vergrendeld (EAC)")
        if (d.irisLocked) addRow("Iris-scan", "🔒 vergrendeld (EAC)")

        // DG13 — land-specifiek; alleen aanwezigheid melden
        if (d.dg13Bytes > 0) addRow("Extra nationale data", "${d.dg13Bytes} bytes")
    }

    private fun renderPhoto(bytes: ByteArray?) {
        val bmp = bytes?.let { decodeFace(it) }
        if (bmp != null) {
            binding.photo.scaleType = android.widget.ImageView.ScaleType.CENTER_CROP
            binding.photo.setImageBitmap(bmp)
            binding.photo.imageTintList = null
        } else {
            // Silhouet-placeholder zodat duidelijk is dat er geen foto is
            // (in plaats van een leeg wit vlak).
            binding.photo.scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE
            binding.photo.setImageResource(R.drawable.ic_person_placeholder)
            Log.w("NfcReadActivity", "Geen pasfoto te tonen (bytes=${bytes?.size ?: 0})")
        }
    }

    /** Probeer BitmapFactory eerst (JPEG/PNG); val terug op OpenCV's
     *  imdecode() voor JPEG2000 — NL ID-kaarten gebruiken vaak J2K. */
    private fun decodeFace(bytes: ByteArray): Bitmap? {
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let { return it }

        try {
            if (!org.opencv.android.OpenCVLoader.initLocal()) {
                Log.w("NfcReadActivity", "OpenCV niet geïnitialiseerd")
                return null
            }
            val mat = org.opencv.core.MatOfByte(*bytes)
            val decoded = org.opencv.imgcodecs.Imgcodecs.imdecode(
                mat, org.opencv.imgcodecs.Imgcodecs.IMREAD_COLOR
            )
            if (decoded.empty()) return null
            // OpenCV werkt in BGR — converteer naar RGBA voor Android
            val rgba = org.opencv.core.Mat()
            org.opencv.imgproc.Imgproc.cvtColor(
                decoded, rgba, org.opencv.imgproc.Imgproc.COLOR_BGR2RGBA
            )
            val bmp = Bitmap.createBitmap(rgba.width(), rgba.height(), Bitmap.Config.ARGB_8888)
            org.opencv.android.Utils.matToBitmap(rgba, bmp)
            return bmp
        } catch (e: Throwable) {
            Log.w("NfcReadActivity", "OpenCV-decode mislukt", e)
        }

        val magic = bytes.take(12).joinToString("") { "%02X".format(it) }
        Log.w("NfcReadActivity",
            "DG2-decode mislukt (size=${bytes.size}, magic=$magic)")
        return null
    }

    private fun addRow(label: String, value: String?, mono: Boolean = false) {
        val muted = androidx.core.content.ContextCompat.getColor(this, R.color.muted)
        val ink = androidx.core.content.ContextCompat.getColor(this, R.color.ink)
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 14, 0, 14)
        }
        val lblTv = TextView(this).apply {
            text = label
            setTextColor(muted)
            textSize = 14f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val valTv = TextView(this).apply {
            text = value ?: "—"
            setTextColor(ink)
            textSize = 15f
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

    private fun formatYYYYMMDD(raw: String?): String? {
        if (raw == null || raw.length != 8 || !raw.all { it.isDigit() }) return raw
        return "${raw.substring(6, 8)}-${raw.substring(4, 6)}-${raw.substring(0, 4)}"
    }
}
