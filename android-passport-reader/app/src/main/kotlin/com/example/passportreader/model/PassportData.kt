package com.example.passportreader.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class PassportData(
    val surname: String?,
    val givenNames: String?,
    val nationality: String?,
    val documentNumber: String?,
    val dateOfBirth: String?,    // YYMMDD
    val dateOfExpiry: String?,   // YYMMDD
    val gender: String?,
    val bsn: String?,            // 9-cijferig, gevalideerd met 11-proef (NL)
    val faceImageJpeg: ByteArray?,

    // DG11 — aanvullende persoonsdata (niet alle landen vullen dit)
    val placeOfBirth: String? = null,
    val address: String? = null,
    val postcode: String? = null,
    val city: String? = null,
    val profession: String? = null,
    val title: String? = null,
    val telephone: String? = null,
    val otherNames: String? = null,

    // DG12 — document-uitgifte
    val dateOfIssue: String? = null,         // YYYYMMDD
    val issuingAuthority: String? = null,

    // DG7 — handtekening
    val signatureImageJpeg: ByteArray? = null,
) : Parcelable {
    companion object {
        const val EXTRA_KEY = "com.example.passportreader.PASSPORT_DATA"

        /** NL BSN-validatie via 11-proef. */
        fun isValidBsn(s: String): Boolean {
            if (s.length != 9 || !s.all { it.isDigit() }) return false
            val weights = intArrayOf(9, 8, 7, 6, 5, 4, 3, 2, -1)
            val sum = s.mapIndexed { i, c -> (c - '0') * weights[i] }.sum()
            return sum % 11 == 0
        }

        /** Vind een geldig BSN (9 cijfers + 11-proef) in een MRZ-veld. */
        fun extractBsn(field: String?): String? {
            if (field == null) return null
            val digits = field.filter { it.isDigit() }
            for (i in 0..(digits.length - 9)) {
                val candidate = digits.substring(i, i + 9)
                if (isValidBsn(candidate)) return candidate
            }
            return null
        }

        /** "1234 AB Amsterdam" → Pair("1234 AB", "Amsterdam"). */
        private val nlPostcodeRegex = Regex("""(\d{4}\s?[A-Z]{2})\s+(.+)""")

        /** Splits een adres in (street, postcode, city). DG11 levert het adres
         *  vaak als losse regels; hier brengen we er structuur in. */
        fun parseAddress(lines: List<String>): Triple<String?, String?, String?> {
            val flat = lines.flatMap { it.split("\n", ",") }
                .map { it.trim().trimEnd('<').replace(Regex("<+"), " ").trim() }
                .filter { it.isNotEmpty() }
            if (flat.isEmpty()) return Triple(null, null, null)

            // Zoek de regel met postcode-patroon → die levert postcode + stad
            for ((idx, line) in flat.withIndex()) {
                nlPostcodeRegex.find(line)?.let { m ->
                    val pc = m.groupValues[1].trim()
                    val city = m.groupValues[2].trim()
                    val streetLines = flat.toMutableList().also { it.removeAt(idx) }
                    val street = streetLines.joinToString(", ").takeIf { it.isNotBlank() }
                    return Triple(street, pc, city)
                }
            }
            // Geen postcode-patroon → alles als street, postcode/city null
            return Triple(flat.joinToString(", "), null, null)
        }
    }
}
