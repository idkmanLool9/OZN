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

        // STAP 1: Verzamel alle Lines, sorteer op Y. ML Kit splitst de MRZ
        // soms in fragments — typisch de laatste cijfer/chevrons-staart komt
        // in een eigen textBlock. We groeperen daarom per Y-rij en plakken
        // links→rechts terug aan elkaar.
        val allLines = result.textBlocks.flatMap { it.lines }
        val mergedRows = mergeLinesByYRow(allLines)

        // STAP 2: Classificeer kandidaten. Content-based eerst (P< = TD3,
        // I/A/C = TD1), daarna lossere length-fallback.
        val candidates = mutableListOf<String>()
        for (row in mergedRows) {
            val cleaned = normalizeMrz(row)
            if (cleaned.length < 20) continue
            if (!isMostlyMrz(cleaned)) continue

            when {
                // ─── Content-based classificatie (eerste-letter-magic) ─── //
                cleaned.startsWith("P<") || cleaned.startsWith("P0") ||
                cleaned.startsWith("PO") -> {
                    // TD3 paspoort line 1: forceer 44 chars
                    candidates += cleaned.padEndChevrons(44)
                }
                cleaned.length >= 28 && cleaned.length <= 32 &&
                Regex("^[IACP][A-Z0-9<]").containsMatchIn(cleaned) -> {
                    // TD1 line 1 begint met I/A/C/IP — exact 30 verwacht
                    candidates += cleaned.padEndChevrons(30)
                }

                // ─── Length-based: TD3 line 2 of TD1 line 2/3 ─── //
                cleaned.length in 28..32 -> {
                    // Voeg ZOWEL TD1- als TD3-padding toe; beide parsers
                    // proberen het. Hieronder voor "lone last digit"-bug:
                    // 28 chars zou TD3 line 2 kunnen zijn die in deze
                    // grootte aankomt omdat ML Kit de staart afkapte.
                    candidates += cleaned.padEndChevrons(30)
                    candidates += cleaned.padEndChevrons(44)
                }
                cleaned.length in 33..50 -> {
                    // Truncated of bijna-volledige TD3 line — pad naar 44
                    candidates += cleaned.padEndChevrons(44)
                }

                // ─── Geglueed: meerdere MRZ-lijnen op één regel ─── //
                cleaned.length in 84..92 -> {
                    candidates += cleaned.substring(0, 44).padEndChevrons(44)
                    candidates += cleaned.substring(44).padEndChevrons(44)
                }
                cleaned.length in 58..62 -> {
                    candidates += cleaned.substring(0, 30).padEndChevrons(30)
                    candidates += cleaned.substring(30).padEndChevrons(30)
                }
                cleaned.length in 88..92 && cleaned.startsWith("I") -> {
                    candidates += cleaned.substring(0, 30).padEndChevrons(30)
                    candidates += cleaned.substring(30, 60).padEndChevrons(30)
                    candidates += cleaned.substring(60).padEndChevrons(30)
                }
            }
        }

        // Debug-snapshot voor de UI: alleen overschrijven als deze frame
        // minstens één herkenbare lange MRZ-kandidaat (30+ chars) bevat.
        // Zo blijft de laatste goede herkenning rustig staan i.p.v. te
        // flikkeren tussen "44 chars MRZ" en "3 chars ruis".
        if (candidates.any { it.length >= 30 }) {
            lastDebug = candidates.joinToString(" / ") {
                it.take(20) + if (it.length > 20) "…" else ""
            }
        }

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
            val docNumber  = fuzzyFix(l2.substring(0, 9),   l2[9],  isNumeric = false) ?: continue
            val birthDate  = fuzzyFix(l2.substring(13, 19), l2[19], isNumeric = true)  ?: continue
            val expiryDate = fuzzyFix(l2.substring(21, 27), l2[27], isNumeric = true)  ?: continue

            if (!birthDate.matches("\\d{6}".toRegex())) continue
            if (!expiryDate.matches("\\d{6}".toRegex())) continue

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
            if (!(l1.startsWith("I") || l1.startsWith("A") || l1.startsWith("C"))) continue

            // TD1 line 1: [0..1] type, [2..4] issuer, [5..13] docnr, [14] doc-check
            // TD1 line 2: [0..5] dob, [6] dob-check, [7] sex, [8..13] expiry,
            //             [14] expiry-check, [15..17] nat
            val docNumber  = fuzzyFix(l1.substring(5, 14), l1[14], isNumeric = false) ?: continue
            val birthDate  = fuzzyFix(l2.substring(0, 6),  l2[6],  isNumeric = true)  ?: continue
            val expiryDate = fuzzyFix(l2.substring(8, 14), l2[14], isNumeric = true)  ?: continue

            if (!birthDate.matches("\\d{6}".toRegex())) continue
            if (!expiryDate.matches("\\d{6}".toRegex())) continue

            return MrzInfo(
                documentNumber = docNumber.replace("<", ""),
                birthDateYYMMDD = birthDate,
                expiryDateYYMMDD = expiryDate,
                documentType = "ID"
            )
        }
        return null
    }

    /** Vind een variant van `field` met geldige check-digit door één OCR-
     *  vergissing tegelijk uit te proberen (O↔0, I↔1, Z↔2 etc.). Voorkomt
     *  dat één misgelezen letter de hele scan blokkeert. Voor numerieke
     *  velden (dob/expiry) eerst de standaard digit-correctie. */
    private fun fuzzyFix(rawField: String, rawCheck: Char, isNumeric: Boolean): String? {
        val field = if (isNumeric) correctDigits(rawField) else rawField
        val check = if (rawCheck in '0'..'9' || rawCheck == '<') rawCheck else correctDigit(rawCheck)

        if (hasValidCheck(field, check)) return field
        if (check == '<') return field

        // Brute-force per positie één teken vervangen door een OCR-alternatief
        for (i in field.indices) {
            val orig = field[i]
            for (alt in ocrAlternatives(orig)) {
                if (alt == orig) continue
                if (isNumeric && alt !in '0'..'9') continue
                val variant = field.substring(0, i) + alt + field.substring(i + 1)
                if (hasValidCheck(variant, check)) return variant
            }
        }
        return null
    }

    private fun ocrAlternatives(c: Char): List<Char> = when (c) {
        '0' -> listOf('O', 'D', 'Q')
        'O' -> listOf('0', 'D', 'Q')
        'D' -> listOf('0', 'O', 'Q')
        'Q' -> listOf('0', 'O', 'D')
        '1' -> listOf('I', 'L')
        'I' -> listOf('1', 'L')
        'L' -> listOf('1', 'I')
        '2' -> listOf('Z')
        'Z' -> listOf('2')
        '5' -> listOf('S')
        'S' -> listOf('5')
        '6' -> listOf('G')
        'G' -> listOf('6')
        '8' -> listOf('B')
        'B' -> listOf('8')
        else -> emptyList()
    }

    fun close() = recognizer.close()

    /** ML Kit splitst MRZ-regels regelmatig op in losse fragments: de
     *  hoofd-data komt als één Line, en de trailing chevrons + laatste
     *  check-digit (de "lone digit") komen als aparte Line met dezelfde Y.
     *  Deze functie groepeert Lines op Y-rij (binnen 50% van line-height
     *  tolerantie) en plakt ze links→rechts terug aan elkaar — waardoor
     *  het hele MRZ-regel weer 44 chars wordt voor de parser.
     */
    private fun mergeLinesByYRow(lines: List<Text.Line>): List<String> {
        if (lines.isEmpty()) return emptyList()

        // Bereken gemiddelde line-height voor tolerance
        val heights = lines.mapNotNull { it.boundingBox?.height() }
        val avgHeight = if (heights.isNotEmpty()) heights.average() else 30.0
        val tolerance = (avgHeight * 0.5).toInt().coerceAtLeast(10)

        // Group on Y-center
        val rows = mutableListOf<MutableList<Text.Line>>()
        for (line in lines) {
            val box = line.boundingBox ?: continue
            val yCenter = (box.top + box.bottom) / 2
            val target = rows.firstOrNull { row ->
                val rowBox = row.first().boundingBox!!
                val rowY = (rowBox.top + rowBox.bottom) / 2
                kotlin.math.abs(yCenter - rowY) <= tolerance
            }
            if (target != null) target += line
            else rows += mutableListOf(line)
        }

        // Sorteer rijen top→bottom, en binnen elke rij left→right
        return rows
            .sortedBy { it.first().boundingBox?.top ?: 0 }
            .map { row ->
                row.sortedBy { it.boundingBox?.left ?: 0 }
                    .joinToString("") { it.text }
            }
    }

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
