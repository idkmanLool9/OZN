package com.example.passportreader.util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.io.ByteArrayOutputStream

/**
 * Bitmap-helpers voor chip-data. De DG2 face-image in een NL paspoort/
 * ID-kaart is vaak JPEG2000 (JP2), niet standaard JPEG. Android's
 * native BitmapFactory kan JP2 niet lezen → fallback via OpenCV
 * (Imgcodecs.imdecode). Andere apps (galerij, browser) verwachten
 * sowieso een echte JPEG-stream — vandaar de re-encode helper.
 */
object ImageHelpers {

    private const val TAG = "ImageHelpers"

    /** Probeert BitmapFactory eerst (JPEG/PNG); valt terug op OpenCV's
     *  Imgcodecs.imdecode voor JPEG2000. Returns null bij onbekend
     *  formaat of decode-fout. */
    fun decodeFace(bytes: ByteArray): Bitmap? {
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let { return it }

        try {
            if (!org.opencv.android.OpenCVLoader.initLocal()) {
                Log.w(TAG, "OpenCV niet geïnitialiseerd")
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
            val bmp = Bitmap.createBitmap(rgba.width(), rgba.height(),
                Bitmap.Config.ARGB_8888)
            org.opencv.android.Utils.matToBitmap(rgba, bmp)
            return bmp
        } catch (e: Throwable) {
            Log.w(TAG, "OpenCV-decode mislukt", e)
        }

        val magic = bytes.take(12).joinToString("") { "%02X".format(it) }
        Log.w(TAG, "Face-decode mislukt (size=${bytes.size}, magic=$magic)")
        return null
    }

    /** Converteert chip-bytes naar echte JPEG-bytes. Nodig voor:
     *   - Upload naar Supabase (browser kan geen JP2)
     *   - Opslaan in Android galerij (verwacht JPEG/PNG)
     *   - Delen via Intent.ACTION_SEND met image/jpeg MIME
     *  Op bytes die al echt JPEG zijn doet 'ie alleen een decode-encode-
     *  cyclus (onmerkbaar). Op JP2-bytes is dit de difference tussen
     *  werkende en kapotte afbeelding. */
    fun toRealJpegBytes(input: ByteArray, quality: Int = 92): ByteArray? {
        val bmp = decodeFace(input) ?: return null
        return try {
            val baos = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos)
            baos.toByteArray()
        } finally {
            bmp.recycle()
        }
    }
}
