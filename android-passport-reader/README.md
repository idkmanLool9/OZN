# Biometric Passport Reader (Android, Kotlin)

Native Android-app die het MRZ-strookje van een paspoort scant via de
camera (ML Kit) en daarna via NFC de chip uitleest (jMRTD / ICAO 9303
BAC + PACE). Alles draait **lokaal** op het toestel — er gaat geen data
naar een externe server.

## Stack
- **Kotlin** + AndroidX + Material 3
- **CameraX** voor de camera-preview
- **Google ML Kit Text Recognition** voor MRZ-OCR
- **jMRTD 0.7.42** + **SCUBA** voor de NFC-/ICAO-communicatie
- **BouncyCastle 1.78** (`bcprov-jdk15to18`) voor de PACE-crypto

## Bouwen

1. **Android Studio** installeren (Hedgehog 2023.1.1 of nieuwer)
2. Open de map `android-passport-reader/` als bestaand project
3. Wacht tot Gradle alle dependencies heeft binnengehaald (~5 min eerste keer)
4. Sluit een Android-telefoon met **NFC** aan via USB (USB-debugging aan)
5. Klik op **Run** ▶ — app installeert + start

## Hoe het werkt

1. **Startscherm** — knop "Start scan"
2. **MRZ-scanner** — camera-preview, automatisch herkennen van de
   onderste twee regels van het paspoort (TD3-formaat). Documentnummer,
   geboortedatum en verloopdatum worden geëxtraheerd.
3. **NFC-leescherm** — gebruiker houdt paspoort tegen de achterkant van
   de telefoon. App opent de chip via PACE (modern), met BAC als
   fallback voor oudere paspoorten.
4. **Resultaat** — DG1 (persoonsgegevens) + DG2 (gezichtsfoto) worden
   gelezen en getoond.

## Bestanden

```
app/
 ├── build.gradle.kts              dependencies (jMRTD, ML Kit, CameraX)
 ├── src/main/
 │   ├── AndroidManifest.xml       permissies (CAMERA, NFC) + activities
 │   ├── kotlin/com/example/passportreader/
 │   │   ├── MainActivity.kt       startscherm
 │   │   ├── ScanMrzActivity.kt    CameraX + ML Kit voor MRZ-detectie
 │   │   ├── NfcReadActivity.kt    NFC-dispatch + jMRTD-flow
 │   │   ├── mrz/
 │   │   │   ├── MrzInfo.kt        data-class voor de 3 sleutelvelden
 │   │   │   └── MrzExtractor.kt   ML Kit TD3-parser
 │   │   ├── nfc/
 │   │   │   └── PassportNfcReader.kt   jMRTD PACE/BAC + DG1/DG2-uitlezen
 │   │   └── model/
 │   │       └── PassportData.kt   resultaat-data-class
 │   └── res/                      layouts, themes, strings
```

## Gotchas

- **BouncyCastle**: gebruik `bcprov-jdk15to18`, niet `bcprov-jdk15on`
  (die laatste botst met Android's eigen stripped BC-versie). De
  `PassportNfcReader.init` vervangt de BC-provider expliciet.
- **PACE vs BAC**: alle NL-paspoorten ≥ ~2014 vereisen PACE; oudere
  vallen terug op BAC. Code probeert PACE eerst, BAC als fallback.
- **NFC-positie**: paspoort-chip zit in de achterkaft. Telefoon vlak
  ertegen houden, 5-10 seconden stil — chip-uitlezing is traag.
- **DG2-foto**: NL-paspoorten gebruiken JPEG sinds 2014. Voor JPEG2000
  (oudere paspoorten) moet je `com.gemalto.jp2:jp2-android` toevoegen.
- **Geen INTERNET-permission** — bewust niet toegevoegd; alles draait
  lokaal, en de Manifest bewijst dat.
- **NFC werkt niet in emulator** — testen vereist een fysieke telefoon.
- **Eigen paspoort gebruiken** — je hebt een echt paspoort nodig om te
  testen. Vraag eventueel familie/collega's om mee te scannen.

## Vervolgstappen

- ID-kaart (TD1-formaat, 3×30) ondersteunen: aparte `extract()`-variant
- Gezichtsverificatie: vergelijk DG2-foto met live camera-frame
- DG13/DG14: certificaat-validatie tegen de passive authentication trust
  store voor anti-tampering controle
- Coupelen met de uitvaart-app: na succesvolle scan via Supabase REST
  het dossier bijwerken
