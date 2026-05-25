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
    val faceImageJpeg: ByteArray?
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
            // Probeer elke 9-digit substring; één daarvan kan de BSN zijn
            // (de rest van het veld bevat vaak `<`-padding).
            for (i in 0..(digits.length - 9)) {
                val candidate = digits.substring(i, i + 9)
                if (isValidBsn(candidate)) return candidate
            }
            return null
        }
    }
}

