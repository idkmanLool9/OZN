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
- **Cloudsync** — open op telefoon, laptop, kantoorpc → zelfde dossiers
- **Dashboard** — totalen, aankomende uitvaarten, open taken
- **Volledige intake** — alle velden uit het St. Ephrem-formulier:
  contactpersoon (incl. voor- en achternaam), overledene
  (Dossiernr., Grafnummer, BSN, Polisnummer, **Gezinsnummer**),
  kerkelijk, uitvaartdienst, logistiek, verzekering, bijzonderheden
- **Standaard-checklist** automatisch per dossier (17 taken)
- **Kosten** met preset-catalogus uit het intake-formulier:
  aannametarief €622, mortuarium €146, vervoer 0–40km €231,
  rouwauto €242, basismodel kist €615,40, aula 3 dagen €446,
  verzorging extern €111/€63, Kerk + Dolabani Zaal €500,
  openen graf €250, naamsteen €295, onderhoud €600
- **Kistmodel-keuze** uit volledige Unigra-tarievenlijst (45 modellen)
- **Documenten** uploaden (overlijdensakte, ID, polis, ...) — opgeslagen
  in Supabase Storage, downloadbaar via tijdelijke beveiligde links
- **Notities** chronologisch per dossier
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
  views-detail.js           ← detail + taken/kosten/documenten/notities
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
worden via TestFlight. De build draait in de cloud op een macOS-machine —
geen Mac op je eigen bureau nodig.

### Eenmalige setup vanaf Windows

1. **Apple Developer Program** — aanmaken op
   [developer.apple.com](https://developer.apple.com) (€99/jaar). 1-2 dagen
   wachten op verificatie.
2. **App-ID registreren** —
   [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
   → "+" → App IDs → bundle: `nl.sok.uitvaartbeheer`.
3. **App in App Store Connect** —
   [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps
   → "+" → "Uitvaartbeheer" met bovenstaande bundle-id. Onthoud het App ID.
4. **Codemagic koppelen** — [codemagic.io](https://codemagic.io) →
   *Add application* → kies deze GitHub-repo. De `codemagic.yaml` wordt
   automatisch herkend.
5. In **Codemagic → Teams → Integrations → Developer Portal** een API-key
   aanmaken met App Store Connect en koppelen aan de workflow.
6. In `codemagic.yaml` het echte `APP_STORE_APP_ID` invullen (uit ASC).
7. **TestFlight-app** op iPad/iPhone installeren uit de App Store.

### Bouwen + uitrollen

Bij elke push naar de actieve branch start Codemagic vanzelf een build,
signs de app, en stuurt 'm naar TestFlight onder de groep
"Internal Testers". Testers krijgen een pushmelding "Update beschikbaar".

### Lokaal Capacitor-commando's (optioneel, op een Mac)

```bash
npm install
npm run build         # genereert ./www
npx cap add ios       # eenmaal: maakt ios/-map (vereist macOS)
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
