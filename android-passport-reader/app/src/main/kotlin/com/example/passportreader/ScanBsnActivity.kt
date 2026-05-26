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
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.example.passportreader.databinding.ActivityScanBsnBinding
import com.example.passportreader.model.PassportData
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.concurrent.Executors

/**
 * Scan-stap voor de achterkant van de NL ID-kaart. Op moderne NL documenten
 * staat het BSN niet meer in de chip; het is alleen geprint op de achterzijde.
 * OCR elke camera-frame en zoek naar een 9-cijferige reeks die de 11-proef
 * haalt. Edge-to-edge UI in dezelfde stijl als ScanMrzActivity.
 */
class ScanBsnActivity : AppCompatActivity() {

    private lateinit var binding: ActivityScanBsnBinding
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    @Volatile private var done = false
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var torchOn = false

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
        binding = ActivityScanBsnBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Edge-to-edge configuratie (zelfde patroon als ScanMrzActivity)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = false
        ViewCompat.setOnApplyWindowInsetsListener(binding.btnClose) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(v.paddingLeft, bars.top, v.paddingRight, v.paddingBottom)
            insets
        }

        binding.scanLine.startAnimation(
            AnimationUtils.loadAnimation(this, R.anim.scan_line_loop)
        )
        binding.statusDot.startAnimation(
            AnimationUtils.loadAnimation(this, R.anim.dot_pulse)
        )

        binding.btnClose.setOnClickListener { finish() }
        binding.btnSkip.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }
        binding.btnTorch.setOnClickListener { toggleTorch() }

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
            val resolutionSelector = ResolutionSelector.Builder()
                .setResolutionStrategy(
                    ResolutionStrategy(
                        Size(1920, 1080),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                    )
                ).build()
            val analyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setResolutionSelector(resolutionSelector)
                .build()
                .also { it.setAnalyzer(cameraExecutor, BsnAnalyzer()) }

            try {
                provider.unbindAll()
                camera = provider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analyzer
                )
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
    }

    private fun onBsnFound(bsn: String) {
        cameraProvider?.unbindAll()

        binding.statusDot.clearAnimation()
        binding.statusDot.setBackgroundResource(R.drawable.bg_status_dot_found)
        binding.scanStatus.text = getString(R.string.scan_bsn_status_found)
        binding.scanLine.clearAnimation()
        binding.scanLine.visibility = View.GONE

        binding.scanTitle.animate().alpha(0f).setDuration(180).start()
        binding.scanSubtitle.animate().alpha(0f).setDuration(180).start()
        binding.statusPill.animate()
            .alpha(0f).translationY(20f).setDuration(180).start()
        binding.btnSkip.animate().alpha(0f).setDuration(180).start()
        binding.debugLine.animate().alpha(0f).setDuration(180).start()
        binding.scanFrame.animate().scaleX(0.96f).scaleY(0.96f).setDuration(220).start()

        binding.successFlash.visibility = View.VISIBLE
        binding.successFlash.alpha = 0f
        binding.successFlash.animate().alpha(1f).setDuration(160).start()

        binding.successCheck.visibility = View.VISIBLE
        binding.successCheck.startAnimation(
            AnimationUtils.loadAnimation(this, R.anim.check_pop_in)
        )

        binding.root.performHapticFeedback(HapticFeedbackConstants.CONFIRM)

        lifecycleScope.launch {
            delay(380)
            val out = Intent().putExtra(RESULT_KEY, bsn)
            setResult(RESULT_OK, out)
            finish()
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        }
    }

    private inner class BsnAnalyzer : ImageAnalysis.Analyzer {
        @ExperimentalGetImage
        override fun analyze(proxy: ImageProxy) {
            if (done) { proxy.close(); return }
            val media = proxy.image ?: run { proxy.close(); return }
            val image = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)

            lifecycleScope.launch {
                try {
                    val bsn = withContext(Dispatchers.Default) {
                        val result = recognizer.process(image).await()
                        val text = result.textBlocks.joinToString(" ") { it.text }
                        findBsn(text)
                    }
                    if (bsn != null && !done) {
                        done = true
                        binding.debugLine.text = "✓ $bsn"
                        onBsnFound(bsn)
                    }
                } catch (_: Exception) {
                    // doorgaan, volgende frame
                } finally {
                    proxy.close()
                }
            }
        }
    }

    /** Zoek een geldige 9-cijferige BSN in vrije OCR-tekst. Probeer ook
     *  enkele OCR-correcties (O→0, I→1, etc.) op kandidaten die net niet
     *  uit cijfers bestaan. */
    private fun findBsn(text: String): String? {
        val cleaned = text.uppercase()
        val pure = Regex("\\d{9}").findAll(cleaned).map { it.value }.toList()
        pure.firstOrNull { PassportData.isValidBsn(it) }?.let { return it }

        val fuzzy = Regex("[0-9OIlLZSBGDQ]{9}").findAll(cleaned).map { it.value }.toList()
        for (candidate in fuzzy) {
            val fixed = candidate.map {
                when (it) {
                    'O', 'D', 'Q' -> '0'
                    'I', 'L', 'l' -> '1'
                    'Z' -> '2'
                    'S' -> '5'
                    'B' -> '8'
                    'G' -> '6'
                    else -> it
                }
            }.joinToString("")
            if (PassportData.isValidBsn(fixed)) return fixed
        }
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraProvider?.unbindAll()
        cameraExecutor.shutdown()
        recognizer.close()
    }

    companion object {
        const val RESULT_KEY = "com.example.passportreader.BSN_RESULT"
    }
}
