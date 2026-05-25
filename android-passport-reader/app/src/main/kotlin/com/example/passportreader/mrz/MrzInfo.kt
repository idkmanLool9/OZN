package com.example.passportreader.mrz

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

/**
 * De drie velden die jMRTD nodig heeft als BAC/PACE-sleutel, plus het
 * documenttype zodat de UI weet of het om een paspoort of ID-kaart gaat.
 * Alle datums in YYMMDD-formaat zoals letterlijk op de MRZ.
 */
@Parcelize
data class MrzInfo(
    val documentNumber: String,
    val birthDateYYMMDD: String,
    val expiryDateYYMMDD: String,
    /** "P" = paspoort (TD3), "ID" = ID-kaart (TD1) */
    val documentType: String = "P"
) : Parcelable {
    companion object {
        const val EXTRA_KEY = "com.example.passportreader.MRZ_INFO"
    }
}
