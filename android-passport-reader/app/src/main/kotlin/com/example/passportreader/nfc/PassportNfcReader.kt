package com.example.passportreader.nfc

import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.util.Log
import com.example.passportreader.model.PassportData
import com.example.passportreader.mrz.MrzInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.sf.scuba.smartcards.CardService
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jmrtd.BACKey
import org.jmrtd.PACEKeySpec
import org.jmrtd.PassportService
import org.jmrtd.lds.CardAccessFile
import org.jmrtd.lds.LDSFileUtil
import org.jmrtd.lds.PACEInfo
import org.jmrtd.lds.icao.DG1File
import org.jmrtd.lds.icao.DG2File
import java.security.Security

/**
 * jMRTD-wrapper: open de chip via PACE (modern, sinds ±2014 verplicht in NL)
 * met BAC als fallback, lees DG1 (persoonsgegevens) en DG2 (gezichtsfoto).
 *
 * Aanroepen op een achtergrond-coroutine (Dispatchers.IO).
 */
class PassportNfcReader {

    companion object { private const val TAG = "PassportNfcReader" }

    enum class Stage { CONNECTING, PACE, BAC, DG1, DG2 }

    init {
        // BouncyCastle expliciet vooraan zetten — vermijdt botsing met
        // Android's eigen (stripped) BC-versie
        Security.removeProvider("BC")
        Security.insertProviderAt(BouncyCastleProvider(), 1)
    }

    suspend fun read(
        tag: Tag,
        mrz: MrzInfo,
        onStage: ((Stage) -> Unit)? = null,
    ): PassportData = withContext(Dispatchers.IO) {
        onStage?.invoke(Stage.CONNECTING)

        val isoDep = IsoDep.get(tag) ?: error("Tag is geen IsoDep — geen ePaspoort")
        isoDep.timeout = 10_000

        val cardService = CardService.getInstance(isoDep)
        cardService.open()

        val service = PassportService(
            cardService,
            PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
            PassportService.DEFAULT_MAX_BLOCKSIZE,
            false,
            false
        )
        service.open()

        // 1) Probeer PACE
        val bacKey = BACKey(
            mrz.documentNumber,
            mrz.birthDateYYMMDD,
            mrz.expiryDateYYMMDD
        )
        val paceKey = PACEKeySpec.createMRZKey(bacKey)

        onStage?.invoke(Stage.PACE)
        var paceSucceeded = false
        try {
            val cardAccess = CardAccessFile(service.getInputStream(PassportService.EF_CARD_ACCESS))
            // Eerste PACEInfo uit EF.CardAccess pakken: chip publiceert daarin
            // welk PACE-algoritme (OID + curve/group-parameters) hij gebruikt.
            val paceInfo = cardAccess.securityInfos
                .filterIsInstance<PACEInfo>()
                .firstOrNull()
                ?: throw IllegalStateException("Geen PACEInfo in EF.CardAccess")
            service.doPACE(
                paceKey,
                paceInfo.objectIdentifier,
                PACEInfo.toParameterSpec(paceInfo.parameterId),
                paceInfo.parameterId
            )
            paceSucceeded = true
        } catch (e: Exception) {
            // PACE niet beschikbaar of mislukt — fall through naar BAC
        }

        service.sendSelectApplet(paceSucceeded)

        // 2) Fallback BAC
        if (!paceSucceeded) {
            onStage?.invoke(Stage.BAC)
            service.doBAC(bacKey)
        }

        // 3) DG1 — persoonsgegevens (MRZ uit de chip, betrouwbaarder dan OCR)
        onStage?.invoke(Stage.DG1)
        val dg1Stream = service.getInputStream(PassportService.EF_DG1)
        val dg1 = LDSFileUtil.getLDSFile(PassportService.EF_DG1, dg1Stream) as DG1File
        val info = dg1.mrzInfo

        // 4) DG2 — gezichtsfoto (JPEG of JPEG2000)
        onStage?.invoke(Stage.DG2)
        val faceBytes: ByteArray? = try {
            val dg2Stream = service.getInputStream(PassportService.EF_DG2)
            val dg2 = LDSFileUtil.getLDSFile(PassportService.EF_DG2, dg2Stream) as DG2File
            // Loop door alle faceInfos+faceImageInfos; pak de eerste die
            // succesvol bytes oplevert. (Sommige paspoorten hebben een lege
            // entry vóór de echte foto.)
            val bytes = dg2.faceInfos
                .flatMap { it.faceImageInfos }
                .firstNotNullOfOrNull { info ->
                    try {
                        val b = info.imageInputStream.readBytes()
                        Log.d(TAG, "DG2 face image: ${b.size} bytes, type=${info.imageDataType}")
                        b.takeIf { it.isNotEmpty() }
                    } catch (e: Exception) {
                        Log.w(TAG, "DG2 face image lezen mislukt", e)
                        null
                    }
                }
            if (bytes == null) Log.w(TAG, "DG2 bevatte geen leesbare pasfoto")
            bytes
        } catch (e: Exception) {
            Log.w(TAG, "DG2 lezen mislukt", e)
            null
        }

        PassportData(
            surname        = info.primaryIdentifier?.replace("<", " ")?.trim()?.takeIf { it.isNotEmpty() },
            givenNames     = info.secondaryIdentifier?.replace("<", " ")?.trim()?.takeIf { it.isNotEmpty() },
            nationality    = info.nationality,
            documentNumber = info.documentNumber,
            dateOfBirth    = info.dateOfBirth,
            dateOfExpiry   = info.dateOfExpiry,
            gender         = info.gender?.toString(),
            faceImageJpeg  = faceBytes
        )
    }
}
