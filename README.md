# Uitvaartbeheer — Syrisch-Orthodoxe Kerk van Antiochië

Statische, **GitHub Pages-vriendelijke** webapplicatie voor intern dossierbeheer
voor de uitvaartleider/begrafenisondernemer van de Syrisch-Orthodoxe Kerk van
Antiochië (St. Ephrem de Syriër Klooster, Glane/Losser).

Geen server nodig — alle gegevens worden in de browser opgeslagen
(`localStorage`) en zijn alleen op dat apparaat zichtbaar.

## Functies

- **Login** met SHA-256 wachtwoord (client-side); standaardgebruiker wordt bij
  eerste bezoek aangemaakt — `beheerder` / `uitvaart2025` (direct wijzigen!)
- **Dashboard** — totalen, aankomende uitvaarten, open taken
- **Volledige intake-dossier** met alle velden uit de papieren intake:
  contactpersoon, overledene, gezinsnummer, grafnummer, BSN, polisnummer,
  kerkelijk (parochie/priester/huisbezoek/avondwake), uitvaartdienst,
  begraafplaats, logistiek, verzekering, bijzonderheden
- **Standaard-checklist** automatisch per dossier (17 taken)
- **Kosten** met **preset-catalogus** uit het intake-formulier:
  aannametarief €622, ziekenhuismortuarium €146, vervoer 0–40 km €231,
  rouwauto €242, basismodel kist €615,40, aula 3 dagen €446, verzorging extern
  €111/€63, Kerk + Dolabani Zaal €500, openen graf €250, naamsteen €295,
  onderhoud €600 — één klik = toegevoegd
- **Kistmodel-keuze** uit volledige Unigra-tarievenlijst (40+ modellen incl.
  prijzen, materiaal en bekleding)
- **Notities** chronologisch per dossier
- **Print** — clean A4-overzicht via browser-print
- **Export / import** — JSON-back-up vanuit het accountscherm
- **Zoeken & filteren** op naam, dossiernr., gezinsnummer, status

## Hosten op GitHub Pages

1. Push deze repo naar GitHub
2. Settings → Pages → Source: `Deploy from a branch` → branch `main` (of de huidige) → folder `/ (root)`
3. Wacht 1 minuut, je site staat op `https://<gebruikersnaam>.github.io/<repo>/`

Het bestand `.nojekyll` zorgt ervoor dat Pages niets via Jekyll verwerkt.

## Lokaal testen

Open `index.html` direct in de browser, of gebruik een eenvoudige server:

```bash
python3 -m http.server 8000
# of
npx serve .
```

Vervolgens naar http://localhost:8000

## Belangrijke aandachtspunten

- **Gegevens staan lokaal in de browser.** Andere apparaten of andere browsers
  zien je dossiers niet. Maak regelmatig een back-up (Account → Exporteer).
- **Geen end-to-end versleuteling.** De login is een gebruiksbarrière, geen
  echte beveiliging tegen iemand met fysieke toegang tot het apparaat.
- **Cache wissen = data weg.** Browser-data wissen verwijdert ook deze app.

Voor productiegebruik door meerdere personen op verschillende apparaten is
een server-versie (zie git-historie voor de Express/SQLite-variant) beter.

## Bestanden

- `index.html` — alle markup
- `style.css` / `print.css` — styling
- `js/data.js` — parochielijst, kosten- en kistencatalogus, standaardtaken
- `js/core.js` — DB (localStorage), auth (SHA-256), helpers, hash-router
- `js/views-list.js` — dashboard, dossierlijst, account
- `js/views-form.js` — intake/bewerk-formulier
- `js/views-detail.js` — dossier-detail met taken/kosten/notities
- `js/app.js` — initialisatie en routes
