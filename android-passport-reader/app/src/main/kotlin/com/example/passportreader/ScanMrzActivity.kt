package com.example.passportreader

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Size
import android.view.HapticFeedbackConstants
import android.view.animation.AnimationUtils
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
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

        // Start scan-lijn animatie
        val lineAnim = AnimationUtils.loadAnimation(this, R.anim.scan_line_loop)
        binding.scanLine.startAnimation(lineAnim)

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
                provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    analyzer
                )
            } catch (e: Exception) {
                Toast.makeText(this, "Camera-fout: ${e.message}", Toast.LENGTH_LONG).show()
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    /**
     * Match-handler: stopt camera DIRECT, toont visuele bevestiging,
     * dan binnen 350ms door naar NfcReadActivity. Skipt de round-trip
     * naar MainActivity zodat er geen tussenfase zichtbaar is.
     */
    private fun onMatchFound(mrz: MrzInfo) {
        // 1. Camera direct stoppen — geen frames meer renderen, ML Kit niets meer voeren
        cameraProvider?.unbindAll()

        // 2. Bottom-sheet wegfaden, success-overlay & checkmark in laten poppen
        binding.bottomSheet.animate()
            .alpha(0f)
            .translationY(40f)
            .setDuration(180)
            .start()

        binding.successFlash.visibility = android.view.View.VISIBLE
        binding.successFlash.alpha = 0f
        binding.successFlash.animate().alpha(1f).setDuration(120).start()

        binding.successCheck.visibility = android.view.View.VISIBLE
        binding.successCheck.startAnimation(
            AnimationUtils.loadAnimation(this, R.anim.check_pop_in)
        )

        // 3. Haptic feedback — kort tikje (vereist geen permission)
        binding.root.performHapticFeedback(HapticFeedbackConstants.CONFIRM)

        // 4. Status-text update voor screen readers
        binding.scanStatus.text = getString(R.string.scan_matched)
        binding.debugLine.text = "✓ ${mrz.documentNumber}"

        // 5. Na 320ms (animatie zichtbaar) door naar NfcRead. Geen
        //    activity-transitie animatie — anders ploft het check-overlay weg
        //    voordat NfcRead zichtbaar is.
        lifecycleScope.launch {
            delay(320)
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
                    // ML Kit op IO-dispatcher → Main-thread blijft snel voor UI
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
