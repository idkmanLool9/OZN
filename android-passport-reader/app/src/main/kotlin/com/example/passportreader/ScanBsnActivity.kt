package com.example.passportreader

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Size
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
import com.example.passportreader.databinding.ActivityScanBsnBinding
import com.example.passportreader.model.PassportData
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.Executors

/**
 * Scan-stap voor de achterkant van de NL ID-kaart. Op moderne NL documenten
 * staat het BSN niet meer in de chip; het is alleen geprint op de achterzijde.
 * Hier OCR'en we elke camera-frame en zoeken naar een 9-cijferige reeks die
 * de 11-proef haalt.
 */
class ScanBsnActivity : AppCompatActivity() {

    private lateinit var binding: ActivityScanBsnBinding
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
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
        binding = ActivityScanBsnBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnSkip.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
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
                provider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analyzer
                )
            } catch (e: Exception) {
                Toast.makeText(this, "Camera-fout: ${e.message}", Toast.LENGTH_LONG).show()
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private inner class BsnAnalyzer : ImageAnalysis.Analyzer {
        @ExperimentalGetImage
        override fun analyze(proxy: ImageProxy) {
            if (done) { proxy.close(); return }
            val media = proxy.image ?: run { proxy.close(); return }
            val image = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)

            lifecycleScope.launch {
                try {
                    val result = recognizer.process(image).await()
                    val text = result.textBlocks.joinToString(" ") { it.text }
                    val bsn = findBsn(text)
                    if (bsn != null && !done) {
                        done = true
                        runOnUiThread { binding.debugLine.text = "✓ $bsn" }
                        val out = Intent().putExtra(RESULT_KEY, bsn)
                        setResult(RESULT_OK, out)
                        finish()
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
        // Vind alle reeksen van 9 cijfers
        val pure = Regex("\\d{9}").findAll(cleaned).map { it.value }.toList()
        pure.firstOrNull { PassportData.isValidBsn(it) }?.let { return it }

        // Fuzzy: vind reeksen van 9 chars die uit cijfers of OCR-twins bestaan
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
        cameraExecutor.shutdown()
        recognizer.close()
    }

    companion object {
        const val RESULT_KEY = "com.example.passportreader.BSN_RESULT"
    }
}
