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
