# Uitvaartbeheer — Syrisch-Orthodoxe Kerk van Antiochië

Statische webapplicatie (HTML + CSS + JS) die op **GitHub Pages** draait,
met **Supabase** als gratis cloud-database, authenticatie en bestandsopslag.
Alle gegevens synchroniseren automatisch tussen apparaten.

Gebouwd voor de uitvaartleider/begrafenisondernemer van de Syrisch-Orthodoxe
Kerk van Antiochië (St. Ephrem de Syriër Klooster, Glane/Losser).

## Eerste keer opzetten

### 1. Supabase-database initialiseren

1. Open je Supabase-project (al gekoppeld in `js/config.js`)
2. Ga naar **SQL Editor** → **New query**
3. Plak de volledige inhoud van `supabase-schema.sql`
4. Klik **Run** — de tabellen, triggers, beveiliging en storage-bucket worden aangemaakt

### 2. Eerste gebruiker aanmaken

In het Supabase-dashboard:

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. Vul e-mailadres en wachtwoord in (vink **Auto Confirm User** aan)
3. **Create user**

Deze gebruiker kan nu inloggen op de site. Voeg op dezelfde manier extra
gebruikers toe (bijv. meerdere medewerkers van het klooster).

### 3. Op GitHub Pages publiceren

1. Push deze repo naar GitHub
2. Settings → **Pages** → Source: `Deploy from a branch`
3. Kies de branch en folder `/ (root)` → **Save**
4. Na ±1 minuut staat de site op `https://<gebruikersnaam>.github.io/<repo>/`

Het bestand `.nojekyll` zorgt dat Pages alles direct serveert.

## Functies

- **Login** met e-mail + wachtwoord (Supabase Auth, EU-regio)
- **Cloudsync** — open op telefoon, iPad, laptop, kantoorpc → zelfde dossiers
- **Profielkeuze** — Rume of Robert kiest wie er vandaag werkt; elke
  wijziging wordt automatisch op naam getrackt
- **Volledige intake** — alle velden uit het St. Ephrem-formulier:
  contactpersoon (incl. voor- en achternaam), overledene
  (Dossiernr., Grafnummer, BSN, Polisnummer, **Gezinsnummer**),
  kerkelijk, uitvaartdienst, logistiek, verzekering, bijzonderheden
- **Kosten** met preset-catalogus + categorie-groepering + DELA-dekking-
  berekening: zien wie wat dekt en hoeveel familie nog te betalen heeft
- **Kistmodel-keuze** uit volledige Unigra-tarievenlijst (45 modellen)
- **Bloemen & eten-drinken catalogus** met foto's + aantal per uitvaart
- **Notities** chronologisch per dossier — getrackt op auteur
- **Factuur** — bewerkbare layout, direct uitprinten of als PDF mailen
- **Mail-verstuurder** met multi-recipient + CC + adresboek + automatische
  PDF-bijlage (factuur of dossier), via EmailJS of mailto-fallback
- **Print** — clean A4-overzicht via browser-print
- **JSON-export** als extra back-up
- **Zoeken & filteren** op naam/dossiernr/gezinsnummer/status

## Architectuur

```
index.html                  ← entry point + login + app shell
style.css / print.css       ← styling
.nojekyll                   ← directe Pages-serving
supabase-schema.sql         ← eenmalige SQL voor de database
js/
  config.js                 ← Supabase URL + anon key
  supabase-client.js        ← Auth, DB-cache, Storage
  data.js                   ← parochies + kosten- en kistencatalogus
  core.js                   ← helpers + hash-router
  views-list.js             ← dashboard, dossierlijst, account
  views-form.js             ← intake/bewerk-formulier
  views-detail.js           ← detail + kosten + notities + mail-verstuurder
  app.js                    ← init en routes
```

## Beveiliging & privacy

- Data staat in Supabase (EU-regio aanbevolen ivm AVG)
- **Row Level Security** is aan: alleen ingelogde gebruikers kunnen lezen/
  schrijven; niemand zonder login krijgt iets te zien
- De `anon`-key in `js/config.js` is veilig om publiek te delen — die
  geeft enkel toegang via geauthenticeerde sessies (zie RLS)
- De `service_role`-key mag **nooit** in de client staan
- Documenten in Storage zijn private (niet via publieke URL bereikbaar);
  downloads gaan via tijdelijke "signed URLs" van 60 seconden

## Mobiele app (iOS via Capacitor + Codemagic)

De app is met **Capacitor** ingepakt zodat 'ie als echte iOS-app gedraaid kan
worden. Twee routes — kies wat past:

### Route A — Gratis: AltStore-sideload (vervalt elke 7 dagen)

Voor eigen gebruik zonder Apple Developer-account. Werkt vanaf Windows.

**Eenmalige setup:**

1. **Codemagic-account aanmaken** op [codemagic.io](https://codemagic.io) →
   *Add application* → kies deze GitHub-repo. De `codemagic.yaml` wordt
   automatisch herkend.
2. In Codemagic: kies workflow **`ios-unsigned`** → **Start new build**.
   Eerste build duurt ±25 min, daarna sneller dankzij cache.
3. Na de build: download het artefact `Uitvaartbeheer-unsigned.ipa` naar
   je Windows-PC.
4. **AltServer** installeren op Windows van [altstore.io](https://altstore.io).
5. Daar ook **iTunes voor Windows** + **iCloud voor Windows** installeren
   (vereist door AltServer voor de iPad-koppeling).
6. **AltServer openen** (rechtsonder in taakbalk) → log in met je gratis
   Apple ID.
7. iPad/iPhone met **USB-kabel** aan de PC.
8. Rechtsklik AltServer-icoon → **Install AltStore → [iPad-naam]**.
9. Op de iPad: **Instellingen → Algemeen → VPN en apparaatbeheer** → tik je
   Apple ID aan → **Vertrouw**.
10. Open AltStore op de iPad → log in met dezelfde Apple ID.
11. Tik **+** linksboven → kies het gedownloade `Uitvaartbeheer-unsigned.ipa`.
12. App-icoon staat nu op het home-scherm.

**Onderhoud:**
- iPad en Windows-PC moeten **op zelfde WiFi-netwerk** blijven.
- AltServer moet draaien (laat 'm bij opstarten van Windows automatisch
  starten via Instellingen).
- Eens per 6 dagen ververst AltStore de app automatisch op de achtergrond.
  Mocht 'ie ooit verlopen: kabel erin → AltServer → "Refresh App".

**Updates:**
- Push code naar GitHub → Codemagic bouwt nieuwe `.ipa` → download → in
  AltStore-app op iPad → tap **My Apps → Update**.

### Route B — €99/jaar: TestFlight (echte app, geen verloop)

Zodra je het Apple Developer Program afsluit:

1. **Apple Developer Program** — aanmaken op
   [developer.apple.com](https://developer.apple.com/programs/enroll) (€99/jaar).
   1-2 dagen wachten op verificatie.
2. **App-ID registreren** in
   [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
   → "+" → App IDs → bundle: `nl.sok.uitvaartbeheer`.
3. **App in App Store Connect** —
   [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps
   → "+" → "Uitvaartbeheer" met bovenstaande bundle-id. Onthoud het App ID.
4. **Codemagic koppelen** — zelfde account als Route A → Teams →
   Integrations → Developer Portal → App Store Connect API key uploaden.
5. In `codemagic.yaml` het echte `APP_STORE_APP_ID` invullen onder de
   `ios-testflight` workflow.
6. **TestFlight-app** op iPad installeren uit de App Store.
7. In Codemagic: workflow **`ios-testflight`** starten → bouwt + pusht
   automatisch naar TestFlight.

Updates: bij elke push naar de actieve branch start Codemagic vanzelf,
testers krijgen pushmelding "Update beschikbaar".

### Lokaal Capacitor-commando's (alleen op een Mac)

```bash
npm install
npm run build         # genereert ./www
npx cap add ios       # eenmaal: maakt ios/-map
npx cap sync ios      # na elke wijziging
npx cap open ios      # opent Xcode
```

## Lokaal testen

```bash
python3 -m http.server 8000
# of
npx serve .
```

Open http://localhost:8000.

## Wachtwoord vergeten?

Gebruik in Supabase-dashboard **Authentication** → **Users** → kies de
gebruiker → **Send password recovery** of zet handmatig een nieuw
wachtwoord via **Edit user**.
