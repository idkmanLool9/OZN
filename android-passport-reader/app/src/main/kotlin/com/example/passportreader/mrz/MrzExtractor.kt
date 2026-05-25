package com.example.passportreader.mrz

import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.tasks.await

/**
 * Extraheert TD3-MRZ (paspoort, 2x44 chars) uit een camera-frame via
 * ML Kit. Voor TD1 (ID-kaart, 3x30) zou je een aparte methode bouwen.
 */
class MrzExtractor {

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun extract(image: InputImage): MrzInfo? {
        val result: Text = recognizer.process(image).await()

        // Pak alle regels die op een MRZ-regel lijken: alleen [A-Z0-9<],
        // lengte 40-46 (TD3 = 44 met wat OCR-ruis-tolerantie).
        val mrzLines = result.textBlocks
            .flatMap { it.lines }
            .map { it.text.replace("\\s".toRegex(), "").uppercase() }
            .filter { it.matches("^[A-Z0-9<]{40,46}$".toRegex()) }

        if (mrzLines.size < 2) return null

        // Eerste twee opeenvolgende MRZ-regels — pad naar exact 44 chars
        val l1 = mrzLines[0].padEnd(44, '<').substring(0, 44)
        val l2 = mrzLines[1].padEnd(44, '<').substring(0, 44)
        if (!l1.startsWith("P")) return null  // Paspoort begint met 'P'

        // TD3 line 2 layout (0-indexed):
        //   [0..8]   documentnummer (9 chars)
        //   [9]      check-digit doc
        //   [10..12] nationaliteit (3 chars)
        //   [13..18] geboortedatum YYMMDD
        //   [19]     check-digit dob
        //   [20]     geslacht
        //   [21..26] verloopdatum YYMMDD
        val docNumber = l2.substring(0, 9).replace("<", "")
        val birthDate = l2.substring(13, 19)
        val expiryDate = l2.substring(21, 27)

        if (!birthDate.matches("\\d{6}".toRegex())) return null
        if (!expiryDate.matches("\\d{6}".toRegex())) return null
        if (docNumber.isBlank()) return null

        return MrzInfo(docNumber, birthDate, expiryDate)
    }

    fun close() = recognizer.close()
}
