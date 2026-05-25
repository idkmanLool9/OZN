# Biometric Passport Reader (Android, Kotlin)

Native Android-app die het MRZ-strookje van een paspoort of Nederlandse
ID-kaart scant via de camera (ML Kit, TD3 + TD1) en daarna via NFC de
chip uitleest (jMRTD / ICAO 9303 BAC + PACE).

**Privacy.** Het scannen en uitlezen van de chip gebeurt 100% lokaal op
het toestel. Er is wél een optionele Supabase-koppeling: na een
succesvolle scan kun je **zelf** op "Koppel aan dossier" tikken, waarna
de app inlogt op het Uitvaartbeheer-Supabase-project en het gekozen
dossier bijwerkt (voornaam, achternaam, geboortedatum, geslacht,
nationaliteit + DG2-pasfoto naar de `overledenen`-bucket). Niet
ingelogd = scan blijft lokaal en de `INTERNET`-permission wordt niet
gebruikt.

## Stack
- **Kotlin** + AndroidX + Material 3
- **CameraX** voor de camera-preview
- **Google ML Kit Text Recognition** voor MRZ-OCR
- **jMRTD 0.7.42** + **SCUBA** voor de NFC-/ICAO-communicatie
- **BouncyCastle 1.78** (`bcprov-jdk15to18`) voor de PACE-crypto

## Bouwen

### In Android Studio
1. **Android Studio** installeren (Hedgehog 2023.1.1 of nieuwer)
2. Open de map `android-passport-reader/` als bestaand project
3. Wacht tot Gradle alle dependencies heeft binnengehaald (~5 min eerste keer)
4. Sluit een Android-telefoon met **NFC** aan via USB (USB-debugging aan)
5. Klik op **Run** ▶ — app installeert + start

### Vanaf de command-line
Met JDK 17+ in `$PATH` en de Android SDK (env-var `ANDROID_HOME`):
```bash
cd android-passport-reader
./gradlew assembleDebug
# debug-APK staat in app/build/outputs/apk/debug/app-debug.apk
```

Andere Supabase-instance gebruiken (i.p.v. de defaults uit `app/build.gradle.kts`):
```bash
./gradlew assembleDebug \
  -PsupabaseUrl="https://jouw-project.supabase.co" \
  -PsupabaseAnonKey="ey..."
```

## Hoe het werkt

1. **Startscherm** — knop "Start scan" + login-status (optioneel inloggen
   bij Uitvaartbeheer-Supabase voor dossier-koppeling).
2. **MRZ-scanner** — camera-preview, automatisch herkennen van een TD3
   (paspoort, 2x44) óf TD1 (ID-kaart, 3x30). Alle drie mod-37-3
   check-digits (doc, dob, expiry) worden gevalideerd vóór doorgaan,
   zodat OCR-fouten niet leiden tot cryptische BAC/PACE-fouten.
3. **NFC-leescherm** — gebruiker houdt document tegen de achterkant van
   de telefoon. App opent de chip via PACE (modern), met BAC als
   fallback voor oudere paspoorten. Per stap wordt de voortgang
   getoond (PACE → DG1 → DG2). Bij fout: retry-knop zonder terug
   naar de scan-stap.
4. **Resultaat** — DG1 (persoonsgegevens) + DG2 (gezichtsfoto) worden
   gelezen en getoond. Knop "Koppel aan dossier" (alleen als ingelogd):
   pikt een dossier uit de Supabase-lijst, PATCHt de velden en upload
   de pasfoto naar de `overledenen`-storage-bucket.

## Bestanden

```
app/
 ├── build.gradle.kts                  dependencies + BuildConfig-vars
 ├── src/main/
 │   ├── AndroidManifest.xml           permissies (CAMERA, NFC, INTERNET)
 │   ├── kotlin/com/example/passportreader/
 │   │   ├── MainActivity.kt           startscherm + login-status
 │   │   ├── ScanMrzActivity.kt        CameraX + ML Kit voor MRZ-detectie
 │   │   ├── NfcReadActivity.kt        NFC-dispatch + jMRTD-flow + koppel-knop
 │   │   ├── LoginActivity.kt          Supabase e-mail+wachtwoord-login
 │   │   ├── DossierPickerActivity.kt  zoekbare lijst + bevestig + PATCH
 │   │   ├── mrz/
 │   │   │   ├── MrzInfo.kt            data-class incl. documenttype
 │   │   │   └── MrzExtractor.kt       ML Kit TD3 + TD1 parser, check-digits
 │   │   ├── nfc/
 │   │   │   └── PassportNfcReader.kt  jMRTD PACE/BAC + DG1/DG2 + Stage-callback
 │   │   ├── cloud/
 │   │   │   └── SupabaseClient.kt     lichte REST-client: auth/db/storage
 │   │   └── model/
 │   │       └── PassportData.kt       resultaat-data-class
 │   └── res/                          layouts, themes, strings, launcher-icon
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
- **INTERNET-permission** — staat in de Manifest, maar wordt alleen
  aangesproken nadat de gebruiker handmatig op "Koppel aan dossier" of
  "Inloggen" tikt. MRZ- en NFC-flows raken het netwerk nooit. Wil je
  écht geen netwerk-permission? Verwijder dan de `INTERNET`-regel uit
  het Manifest — de scan-flow blijft volledig werken, alleen de
  Supabase-koppeling vervalt.
- **NFC werkt niet in emulator** — testen vereist een fysieke telefoon.
- **Eigen paspoort gebruiken** — je hebt een echt paspoort nodig om te
  testen. Vraag eventueel familie/collega's om mee te scannen.

## Vervolgstappen

- Gezichtsverificatie: vergelijk DG2-foto met live camera-frame
- DG13/DG14: certificaat-validatie tegen de passive authentication trust
  store voor anti-tampering controle
- Foto-compressie (DG2 is soms 1-2 MB; verkleinen vóór upload)
- ID-kaart-extended-docnummer (NL ID = 9 chars, maar sommige EU-landen
  hebben langere nummers die doorlopen in optional data field)
