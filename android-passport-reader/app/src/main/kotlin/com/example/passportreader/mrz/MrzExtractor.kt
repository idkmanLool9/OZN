package com.example.passportreader.mrz

import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.tasks.await

/**
 * Extraheert MRZ uit een camera-frame via ML Kit. Ondersteunt:
 *  - TD3 (paspoort, 2x44 chars)
 *  - TD1 (Nederlandse / EU ID-kaart, 3x30 chars)
 *
 * Alle ICAO 9303 mod-37-3 check digits worden gevalideerd voordat een
 * resultaat wordt teruggegeven — zo voorkomen we cryptische BAC/PACE-
 * fouten door één verkeerd ge-OCR'de letter.
 */
class MrzExtractor {

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun extract(image: InputImage): MrzInfo? {
        val result: Text = recognizer.process(image).await()

        // Alleen MRZ-achtige tekens (A-Z, 0-9, <) — spaties weg, hoofdletters.
        // Houd alle lijnen met lengte 28..46 (TD1=30, TD3=44 + OCR-ruistolerantie).
        val mrzLines = result.textBlocks
            .flatMap { it.lines }
            .map { it.text.replace("\\s".toRegex(), "").uppercase() }
            .filter { it.matches("^[A-Z0-9<]{28,46}$".toRegex()) }

        if (mrzLines.size < 2) return null

        return parseTd3(mrzLines) ?: parseTd1(mrzLines)
    }

    /** TD3 = paspoort. Twee regels van 44. */
    private fun parseTd3(lines: List<String>): MrzInfo? {
        // Zoek het eerste paar van 40..46-char regels waarvan de eerste met 'P' begint.
        for (i in 0 until lines.size - 1) {
            val l1raw = lines[i]
            val l2raw = lines[i + 1]
            if (l1raw.length !in 40..46 || l2raw.length !in 40..46) continue
            val l1 = l1raw.padEnd(44, '<').substring(0, 44)
            val l2 = l2raw.padEnd(44, '<').substring(0, 44)
            if (!l1.startsWith("P")) continue

            // TD3 line 2 layout (0-indexed):
            //   [0..8]   documentnummer (9)
            //   [9]      check-digit doc
            //   [10..12] nationaliteit
            //   [13..18] geboortedatum YYMMDD
            //   [19]     check-digit dob
            //   [20]     geslacht
            //   [21..26] verloopdatum YYMMDD
            //   [27]     check-digit expiry
            //   [28..41] persoonlijk nummer
            //   [42]     check-digit personal
            //   [43]     composite check
            val docNumber = l2.substring(0, 9)
            val docCheck = l2[9]
            val birthDate = l2.substring(13, 19)
            val birthCheck = l2[19]
            val expiryDate = l2.substring(21, 27)
            val expiryCheck = l2[27]

            if (!birthDate.matches("\\d{6}".toRegex())) continue
            if (!expiryDate.matches("\\d{6}".toRegex())) continue
            if (!hasValidCheck(docNumber, docCheck)) continue
            if (!hasValidCheck(birthDate, birthCheck)) continue
            if (!hasValidCheck(expiryDate, expiryCheck)) continue

            return MrzInfo(
                documentNumber = docNumber.replace("<", ""),
                birthDateYYMMDD = birthDate,
                expiryDateYYMMDD = expiryDate,
                documentType = "P"
            )
        }
        return null
    }

    /** TD1 = ID-kaart. Drie regels van 30. */
    private fun parseTd1(lines: List<String>): MrzInfo? {
        for (i in 0 until lines.size - 2) {
            val l1raw = lines[i]
            val l2raw = lines[i + 1]
            val l3raw = lines[i + 2]
            if (l1raw.length !in 28..32 || l2raw.length !in 28..32 || l3raw.length !in 28..32) continue
            val l1 = l1raw.padEnd(30, '<').substring(0, 30)
            val l2 = l2raw.padEnd(30, '<').substring(0, 30)
            // l3 = namen — niet nodig voor BAC/PACE
            if (!(l1.startsWith("I") || l1.startsWith("A") || l1.startsWith("C"))) continue

            // TD1 line 1: [0..1] type, [2..4] issuer, [5..13] docnr, [14] doc-check,
            //             [15..29] optional
            // TD1 line 2: [0..5] dob, [6] dob-check, [7] sex, [8..13] expiry,
            //             [14] expiry-check, [15..17] nat, [18..28] optional,
            //             [29] composite-check
            val docNumber = l1.substring(5, 14)
            val docCheck = l1[14]
            val birthDate = l2.substring(0, 6)
            val birthCheck = l2[6]
            val expiryDate = l2.substring(8, 14)
            val expiryCheck = l2[14]

            if (!birthDate.matches("\\d{6}".toRegex())) continue
            if (!expiryDate.matches("\\d{6}".toRegex())) continue
            if (!hasValidCheck(docNumber, docCheck)) continue
            if (!hasValidCheck(birthDate, birthCheck)) continue
            if (!hasValidCheck(expiryDate, expiryCheck)) continue

            return MrzInfo(
                documentNumber = docNumber.replace("<", ""),
                birthDateYYMMDD = birthDate,
                expiryDateYYMMDD = expiryDate,
                documentType = "ID"
            )
        }
        return null
    }

    fun close() = recognizer.close()

    companion object {
        /** ICAO 9303 mod-37-3: cijfers=zichzelf, A=10..Z=35, '<'=0; weegt 7,3,1,7,3,1,... mod 10. */
        fun mrzCheckDigit(field: String): Int {
            val weights = intArrayOf(7, 3, 1)
            var sum = 0
            for ((i, c) in field.withIndex()) {
                val v = when (c) {
                    in '0'..'9' -> c - '0'
                    in 'A'..'Z' -> c - 'A' + 10
                    '<' -> 0
                    else -> return -1
                }
                sum += v * weights[i % 3]
            }
            return sum % 10
        }

        /** Geldig als check-char '<' is (geen check) of overeenkomt met berekening. */
        fun hasValidCheck(field: String, check: Char): Boolean {
            if (check == '<') return true
            val expected = mrzCheckDigit(field)
            return expected in 0..9 && expected.toString()[0] == check
        }
    }
}
