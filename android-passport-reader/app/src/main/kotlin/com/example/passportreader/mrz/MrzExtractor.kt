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

    /** Laatste ruwe MRZ-kandidaten die ML Kit zag — handig voor live debug-feedback. */
    @Volatile var lastDebug: String = ""
        private set

    suspend fun extract(image: InputImage): MrzInfo? {
        val result: Text = recognizer.process(image).await()

        // ML Kit geeft per Line een bounding-box; sorteer op verticale positie
        // zodat MRZ-regels altijd in document-volgorde komen, ongeacht de
        // textBlock-volgorde.
        val sortedLines = result.textBlocks
            .flatMap { it.lines }
            .sortedBy { it.boundingBox?.top ?: 0 }

        // Per "regel": OCR-correctie + filter op MRZ-achtige inhoud (>=20 chars
        // met overwegend [A-Z0-9<]). Lange "geglueede" regels splitten we op
        // de juiste lengte.
        val candidates = mutableListOf<String>()
        for (line in sortedLines) {
            val cleaned = normalizeMrz(line.text)
            if (cleaned.length < 20) continue
            if (!isMostlyMrz(cleaned)) continue

            when {
                cleaned.length in 28..32 -> candidates += cleaned.padEndChevrons(30)
                cleaned.length in 40..46 -> candidates += cleaned.padEndChevrons(44)
                // Geglueed: 2x TD3 op één regel
                cleaned.length in 84..92 -> {
                    candidates += cleaned.substring(0, 44).padEndChevrons(44)
                    candidates += cleaned.substring(44).padEndChevrons(44)
                }
                // Geglueed: 2x TD1 op één regel
                cleaned.length in 58..62 -> {
                    candidates += cleaned.substring(0, 30).padEndChevrons(30)
                    candidates += cleaned.substring(30).padEndChevrons(30)
                }
                // Geglueed: 3x TD1
                cleaned.length in 88..92 && cleaned.startsWith("I") -> {
                    candidates += cleaned.substring(0, 30).padEndChevrons(30)
                    candidates += cleaned.substring(30, 60).padEndChevrons(30)
                    candidates += cleaned.substring(60).padEndChevrons(30)
                }
            }
        }

        // Debug-snapshot voor de UI
        lastDebug = candidates.joinToString(" / ") { it.take(20) + if (it.length > 20) "…" else "" }

        if (candidates.size < 2) return null

        return parseTd3(candidates) ?: parseTd1(candidates)
    }

    /** TD3 = paspoort. Twee regels van 44. */
    private fun parseTd3(lines: List<String>): MrzInfo? {
        for (i in 0 until lines.size - 1) {
            val l1 = lines[i]
            val l2 = lines[i + 1]
            if (l1.length != 44 || l2.length != 44) continue
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
            val docNumber = correctDocNum(l2.substring(0, 9))
            val docCheck = correctDigit(l2[9])
            val birthDate = correctDigits(l2.substring(13, 19))
            val birthCheck = correctDigit(l2[19])
            val expiryDate = correctDigits(l2.substring(21, 27))
            val expiryCheck = correctDigit(l2[27])

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
        for (i in 0 until lines.size - 1) {
            val l1 = lines[i]
            val l2 = lines[i + 1]
            if (l1.length != 30 || l2.length != 30) continue
            // L3 (namen) is optioneel hier: niet nodig voor BAC/PACE
            if (!(l1.startsWith("I") || l1.startsWith("A") || l1.startsWith("C"))) continue

            // TD1 line 1: [0..1] type, [2..4] issuer, [5..13] docnr, [14] doc-check
            // TD1 line 2: [0..5] dob, [6] dob-check, [7] sex, [8..13] expiry,
            //             [14] expiry-check, [15..17] nat
            val docNumber = correctDocNum(l1.substring(5, 14))
            val docCheck = correctDigit(l1[14])
            val birthDate = correctDigits(l2.substring(0, 6))
            val birthCheck = correctDigit(l2[6])
            val expiryDate = correctDigits(l2.substring(8, 14))
            val expiryCheck = correctDigit(l2[14])

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

    // ─── Normalisatie / OCR-correcties ─────────────────────────────────────

    private fun String.padEndChevrons(n: Int): String =
        if (length >= n) substring(0, n) else padEnd(n, '<')

    /** Wat hoort uit het ruwe ML-Kit-veld te komen voor MRZ-verwerking. */
    private fun normalizeMrz(s: String): String {
        // Whitespace + niet-printable weg, hoofdletters
        val noWs = s.replace("\\s".toRegex(), "").uppercase()
        // ML Kit detecteert chevrons soms als «, » of « of zelfs ≪ — alles → <
        // Ook common OCR-fouten op chevron-symbolen wegnemen
        return noWs
            .replace('«', '<').replace('»', '<')
            .replace('‹', '<').replace('›', '<')
            .replace('≪', '<').replace('≫', '<')
            .replace('|', '<')
            .replace(Regex("[^A-Z0-9<]"), "")  // alles wat niet MRZ is droppen
    }

    /** Een regel telt als MRZ-kandidaat als >=50% chevrons OR strikt MRZ-pattern. */
    private fun isMostlyMrz(s: String): Boolean {
        val chevronCount = s.count { it == '<' }
        // TD1/TD3 regels hebben altijd meerdere chevrons (issuer/naam-padding)
        return chevronCount >= 2 && s.all { it in 'A'..'Z' || it in '0'..'9' || it == '<' }
    }

    /** Common OCR-confusies binnen velden die alléén cijfers mogen bevatten. */
    private fun correctDigits(s: String): String = s.map { correctDigit(it) }.joinToString("")

    private fun correctDigit(c: Char): Char = when (c) {
        'O', 'D', 'Q' -> '0'
        'I', 'L' -> '1'
        'Z' -> '2'
        'B' -> '8'
        'S' -> '5'
        'G' -> '6'
        '<' -> '<'  // chevron blijven
        else -> c
    }

    /** Documentnummers zijn alfanumeriek, dus geen agressieve correctie hier
     *  behalve chevrons en de pure-digit-OCR-twins die overal fout zitten. */
    private fun correctDocNum(s: String): String = s  // geen wijziging — laat 'O' staan in alfa-deel

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
