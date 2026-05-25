package com.example.passportreader

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import android.util.Size
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
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

class ScanMrzActivity : AppCompatActivity() {

    private lateinit var binding: ActivityScanMrzBinding
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val extractor = MrzExtractor()
    @Volatile private var done = false

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

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.preview.surfaceProvider)
            }

            // MRZ-tekens zijn klein; standaard 640x480 is te laag. Vraag
            // 1920x1080 zodat ML Kit de chevrons en cijfers kan onderscheiden.
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

    private inner class MrzAnalyzer : ImageAnalysis.Analyzer {
        @ExperimentalGetImage
        override fun analyze(proxy: ImageProxy) {
            if (done) { proxy.close(); return }
            val media = proxy.image ?: run { proxy.close(); return }
            val image = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)

            lifecycleScope.launch {
                try {
                    val mrz = extractor.extract(image)
                    if (mrz != null && !done) {
                        done = true
                        runOnUiThread { binding.debugLine.text = "✓ ${mrz.documentNumber}" }
                        val result = Intent().apply {
                            putExtra(MrzInfo.EXTRA_KEY, mrz)
                        }
                        setResult(RESULT_OK, result)
                        finish()
                    } else if (!done) {
                        // Live feedback: alleen tonen als er ooit een echte
                        // MRZ-kandidaat gezien is. lastDebug wordt door
                        // MrzExtractor pas overschreven bij 30+ chars, dus
                        // het flikkert niet meer tussen MRZ en losse ruis.
                        val snap = extractor.lastDebug
                        if (snap.isNotEmpty()) {
                            runOnUiThread { binding.debugLine.text = snap }
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
        cameraExecutor.shutdown()
        extractor.close()
    }
}
