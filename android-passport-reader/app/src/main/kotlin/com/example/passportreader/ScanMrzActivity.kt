package com.example.passportreader

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.util.Size
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.animation.AnimationUtils
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.ViewCompat
import androidx.lifecycle.lifecycleScope
import com.example.passportreader.databinding.ActivityScanMrzBinding
import com.example.passportreader.mrz.MrzExtractor
import com.example.passportreader.mrz.MrzInfo
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.Executors

class ScanMrzActivity : AppCompatActivity() {

    private lateinit var binding: ActivityScanMrzBinding
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val extractor = MrzExtractor()
    @Volatile private var done = false
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var torchOn = false
    private var focusReticle: View? = null

    private val permLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) startCamera()
            else {
                Toast.makeText(this, R.string.perm_camera_needed, Toast.LENGTH_LONG).show()
                finish()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityScanMrzBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // ─── Edge-to-edge: status/nav bars transparant over de camera ───
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        // Status-bar icons wit (camera-scherm is donker)
        WindowCompat.getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = false

        // Top-controls onder de status bar duwen via inset-padding
        ViewCompat.setOnApplyWindowInsetsListener(binding.btnClose) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(v.paddingLeft, bars.top, v.paddingRight, v.paddingBottom)
            insets
        }

        // ─── Animaties starten ──────────────────────────────────────────
        binding.scanLine.startAnimation(
            AnimationUtils.loadAnimation(this, R.anim.scan_line_loop)
        )
        binding.statusDot.startAnimation(
            AnimationUtils.loadAnimation(this, R.anim.dot_pulse)
        )

        // Close-knop
        binding.btnClose.setOnClickListener { finish() }

        // Torch-toggle
        binding.btnTorch.setOnClickListener { toggleTorch() }

        // Tap-to-focus op de live preview
        binding.preview.setOnTouchListener { _, event ->
            if (event.action == android.view.MotionEvent.ACTION_DOWN) {
                handleTapToFocus(event.x, event.y)
                binding.preview.performClick()
                true
            } else false
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            permLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()
            cameraProvider = provider

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.preview.surfaceProvider)
            }

            // MRZ-tekens zijn klein; 1920x1080 nodig voor ML Kit precisie
            val resolutionSelector = ResolutionSelector.Builder()
                .setResolutionStrategy(
                    ResolutionStrategy(
                        Size(1920, 1080),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                    )
                )
                .build()

            val analyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setResolutionSelector(resolutionSelector)
                .build()
                .also { it.setAnalyzer(cameraExecutor, MrzAnalyzer()) }

            try {
                provider.unbindAll()
                camera = provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    analyzer
                )
                // Verberg torch-knop op toestellen zonder flash-unit
                binding.btnTorch.visibility =
                    if (camera?.cameraInfo?.hasFlashUnit() == true)
                        View.VISIBLE else View.GONE
            } catch (e: Exception) {
                Toast.makeText(this, "Camera-fout: ${e.message}", Toast.LENGTH_LONG).show()
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun toggleTorch() {
        val cam = camera ?: return
        torchOn = !torchOn
        cam.cameraControl.enableTorch(torchOn)
        binding.btnTorch.setImageResource(
            if (torchOn) R.drawable.ic_torch_on else R.drawable.ic_torch
        )
        binding.btnTorch.performHapticFeedback(
            android.view.HapticFeedbackConstants.LONG_PRESS
        )
    }

    private fun handleTapToFocus(x: Float, y: Float) {
        val cam = camera ?: return
        val point = binding.preview.meteringPointFactory.createPoint(x, y)
        val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF)
            .setAutoCancelDuration(3, java.util.concurrent.TimeUnit.SECONDS)
            .build()
        cam.cameraControl.startFocusAndMetering(action)
        showFocusReticle(x, y)
    }

    /** Een kleine cirkel die kortstondig op de tap-positie verschijnt
     *  zodat de gebruiker visueel feedback krijgt dat focus is getriggerd. */
    private fun showFocusReticle(x: Float, y: Float) {
        focusReticle?.let { (it.parent as? android.view.ViewGroup)?.removeView(it) }
        val size = (72 * resources.displayMetrics.density).toInt()
        val r = View(this).apply {
            layoutParams = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams(size, size)
            background = androidx.core.content.ContextCompat.getDrawable(
                this@ScanMrzActivity, R.drawable.bg_focus_reticle
            )
            translationX = x - size / 2f
            translationY = y - size / 2f
            scaleX = 1.4f
            scaleY = 1.4f
            alpha = 0f
        }
        binding.root.addView(r)
        focusReticle = r
        r.animate()
            .alpha(1f).scaleX(1f).scaleY(1f)
            .setDuration(140)
            .withEndAction {
                r.animate()
                    .alpha(0f).setStartDelay(700).setDuration(220)
                    .withEndAction { (r.parent as? android.view.ViewGroup)?.removeView(r) }
                    .start()
            }
            .start()
    }

    /**
     * Match-handler: stopt camera DIRECT, toont visuele bevestiging
     * (groene flash + checkmark + haptic), opent dan NfcRead zonder
     * MainActivity round-trip.
     */
    private fun onMatchFound(mrz: MrzInfo) {
        // 1. Camera direct stoppen — geen frames meer renderen
        cameraProvider?.unbindAll()

        // 2. Status-dot wordt groen + animatie stopt
        binding.statusDot.clearAnimation()
        binding.statusDot.setBackgroundResource(R.drawable.bg_status_dot_found)
        binding.scanStatus.text = getString(R.string.scan_status_found)
        binding.scanLine.clearAnimation()
        binding.scanLine.visibility = View.GONE

        // 3. Titel/subtitel + status fadet weg, scan-frame schaalt licht
        binding.scanTitle.animate().alpha(0f).setDuration(180).start()
        binding.scanSubtitle.animate().alpha(0f).setDuration(180).start()
        binding.statusPill.animate()
            .alpha(0f).translationY(20f).setDuration(180).start()
        binding.debugLine.animate().alpha(0f).setDuration(180).start()
        binding.scanFrame.animate().scaleX(0.96f).scaleY(0.96f).setDuration(220).start()

        // 4. Groene flash + grote checkmark
        binding.successFlash.visibility = View.VISIBLE
        binding.successFlash.alpha = 0f
        binding.successFlash.animate().alpha(1f).setDuration(160).start()

        binding.successCheck.visibility = View.VISIBLE
        binding.successCheck.startAnimation(
            AnimationUtils.loadAnimation(this, R.anim.check_pop_in)
        )

        // 5. Haptic feedback — kort tikje (no extra permission)
        binding.root.performHapticFeedback(HapticFeedbackConstants.CONFIRM)

        // 6. Na 380ms door naar NfcRead — geen activity-transitie animatie
        lifecycleScope.launch {
            delay(380)
            val intent = Intent(this@ScanMrzActivity, NfcReadActivity::class.java).apply {
                putExtra(MrzInfo.EXTRA_KEY, mrz)
                addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)
            }
            startActivity(intent)
            finish()
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        }
    }

    private inner class MrzAnalyzer : ImageAnalysis.Analyzer {
        @ExperimentalGetImage
        override fun analyze(proxy: ImageProxy) {
            if (done) { proxy.close(); return }
            val media = proxy.image ?: run { proxy.close(); return }
            val image = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)

            lifecycleScope.launch {
                try {
                    // ML Kit op background-dispatcher → Main blijft snel voor UI
                    val mrz = withContext(Dispatchers.Default) {
                        extractor.extract(image)
                    }
                    if (mrz != null && !done) {
                        done = true
                        onMatchFound(mrz)
                    } else if (!done) {
                        val snap = extractor.lastDebug
                        if (snap.isNotEmpty()) {
                            binding.debugLine.text = snap
                        }
                    }
                } catch (_: Exception) {
                    // doorgaan, volgende frame
                } finally {
                    proxy.close()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraProvider?.unbindAll()
        cameraExecutor.shutdown()
        extractor.close()
    }
}
