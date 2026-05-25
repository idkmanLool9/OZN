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
    val faceImageJpeg: ByteArray?
) : Parcelable {
    companion object {
        const val EXTRA_KEY = "com.example.passportreader.PASSPORT_DATA"
    }
}
