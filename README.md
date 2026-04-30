# Uitvaartbeheer — Syrisch-Orthodoxe Kerk van Antiochië

Intern dossierbeheer voor de uitvaartleider/begrafenisondernemer van de Syrisch-Orthodoxe Kerk van Antiochië. Niet bedoeld voor publiek gebruik. Toegang via login.

## Functies

- **Login & sessie** — bcrypt + SQLite session store; alleen aangemaakte gebruikers kunnen in
- **Dashboard** — totalen, aankomende uitvaarten, open taken met deadline, recent bewerkt
- **Dossiers** — volledige intake per overledene:
  - Overledene (naam, doopnaam, geboorte/overlijden, adres, BSN, burgerlijke staat, lid SOK …)
  - Contactpersoon / aangever (naam, relatie, telefoon, e-mail, adres)
  - Kerkelijk (parochie, priester, huisbezoek, avondwake)
  - Uitvaartdienst (type, datum/tijd, kerk, begraafplaats, graf)
  - Logistiek (kist, rouwauto, volgauto's, dragers, bloemstukken, rouwkaarten, condoleance, catering, muziek/koor)
  - Verzekering & opdrachtgever
  - Bijzonderheden / wensen
- **Taken / checklist** — standaardtaken automatisch aangemaakt per dossier (overlijdensakte, parochie, kerk reserveren, kist, vervoer, …) — afvinkbaar, met deadline
- **Kosten** — kostenposten per categorie, totaal en betaald
- **Documenten** — uploads (overlijdensakte, identiteit, polis, grafrechten, …)
- **Notities** — chronologische notities per dossier
- **Print/export** — printbaar dossieroverzicht (A4)
- **Zoeken & filteren** — op naam, dossiernummer, status

## Installatie

```bash
npm install
npm run seed           # maakt eerste beheerder aan
npm start              # start server op http://localhost:3000
```

Standaard inlog (wijzig direct in productie!):

- gebruikersnaam: `beheerder`
- wachtwoord: `uitvaart2025`

Andere gebruiker bij seeden:

```bash
SEED_USER=joris SEED_PASS=geheim123 SEED_NAME="Joris Q." npm run seed
```

## Productie-aanbevelingen

- Zet `SESSION_SECRET` als environment variable
- Plaats de app achter HTTPS (Caddy/Nginx) en zet de session-cookie op `secure: true`
- Maak periodieke back-ups van `data/app.db` en de map `uploads/`

## Stack

Node.js + Express + EJS + SQLite (better-sqlite3) + bcryptjs + multer.
