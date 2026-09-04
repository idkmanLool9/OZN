# Aanbevelingen — Uitvaart Intake + Klooster-app

Complete, geprioriteerde lijst. Tiers: **P0** = nu afmaken (blokkeert echt
gebruik/lancering) · **P1** = kort daarna (veel waarde) · **P2** = later.

---

## P0 — Nu afmaken

### Openstaande acties die alleen jij kunt doen
- [ ] **SQL-migraties draaien** in Supabase (SQL editor):
  `gezinnen`/`leden` (ledenadministratie), `familie_id_uploads`,
  `familie_dagplanning`. Zonder deze werken die modules alleen in demo.
- [ ] **Demo/review-account aanmaken** in Supabase Auth
  (`reviewer@morephrem.com` / `AppleReview2026!`) — anders kan Apple niet inloggen.
- [ ] **App Store**: screenshots op exact 2064×2752 of 2048×2732, contactgegevens,
  daarna indienen → na goedkeuring unlisted aanvragen. (zie `docs/appstore/INVULGIDS.md`)
- [ ] **Verse TestFlight-build** via Codemagic (builds zijn opgelopen tot 156).
- [ ] **snelstart-webhook edge function deployen** (staat gecommit, niet gedeployd).

### Gaten in het intakeformulier (bijna-bugs)
- [ ] **Verzekering + betaling** terug als invulvelden in de wizard. Deze velden
  (status, pakket, dekking, betaalwijze, aanbetaling, eindafrekening) worden al
  gebruikt door de dekking-motor én de factuur, maar zijn nu **niet invulbaar**
  (dode link `#verzekering-met-fields`). Grootste blokkade.
- [ ] **Huisbezoek + avondwake** invulvelden toevoegen — de iOS-herinneringen en
  e-mails gebruiken deze datums al, maar je kunt ze niet invullen.

### Datakwaliteit
- [x] BSN-elfproef (gedaan)
- [x] Dubbel-dossier-detectie (gedaan)
- [ ] **Datum-logica**: geboorte ≤ overlijden ≤ vandaag; uitvaart ≥ overlijden.

---

## P1 — Kort daarna (veel waarde)

### Automatisering (zie `docs/automatisering-roadmap.md` voor de volledige lijst)
- [ ] **Dossierstatus automatisch** (nieuw → in behandeling → voltooid).
- [ ] **Dossier ↔ graf koppelen** (grafnummer → graf op 'bezet', gekoppeld).
- [ ] **Gezinsnummer-suggestie** in de intake (achternaam → bekend gezin).
- [ ] **Push-cron eindelijk aanzetten** (dagelijkse herinneringen draaien nu
  mogelijk niet — staat wel in de docs, niet ingeschakeld).
- [ ] **Gedachtenisdagen** — 40-dagen + jaargedachtenis uit de overlijdensdatum.
- [ ] **Taken-tabel activeren** — standaard-takenlijst per dossier met deadlines
  die zichzelf afvinkt (tabel bestaat al, wordt nergens gebruikt).

### Overzicht & bruikbaarheid
- [ ] **Home-dashboard**: deze week — uitvaarten, huisbezoeken, gedachtenissen,
  openstaande betalingen, dossiers per status, grafbeschikbaarheid.
- [ ] **Opgeslagen filters** op de dossierlijst ("actie vereist", "onbetaald",
  "deze week").

### Documenten
- [ ] **Standaardbrief gemeente** (aangifte van overlijden) — alle velden bestaan al.
- [ ] **Brief/mail verzekeraar** (claim) — 1 klik.

### Financieel
- [ ] **SnelStart echt gebruiken** (nu alleen een testknop): contactpersoon als
  relatie + verkoopfactuur automatisch bij voltooien.
- [ ] **Factuur splitsen**: verzekering-deel vs familie-deel (dekking-motor
  levert dit al).

---

## P2 — Later (uitbreidingen)

### Nieuwe klooster-modules (digitalisering breder trekken)
- [ ] **Kerkelijke registers & aktes** — doop-, huwelijks-, overlijdensregister
  met printbare aktes (hangt aan de ledenadministratie).
- [ ] **Misintenties & gedachtenisdiensten** — aanvragen + inplannen (+ gift).
- [ ] **Giften & kerkbijdrage** met ANBI-jaaroverzicht voor leden.
- [ ] **Zaalreservering** (Dolabani-zaal / aula) — boekingskalender.
- [ ] **Grafrechten** — verval-datum op `graven` + verlengingsherinnering.
- [ ] **Kloosterwinkel** (kaarsen/iconen/boeken) — evt. los.

### Techniek & robuustheid
- [ ] **Data-export / back-up**: dossier exporteren (PDF/JSON) + een volledige
  export-knop, los van Supabase.
- [ ] **Basale smoke-tests**: de no-bundler opzet is gevoelig voor stille fouten
  (zoals de account-pagina die crashte op een ontbrekende `s`). Een klein
  test-script dat elke pagina rendert vangt dat vroeg af.
- [ ] **Foutmeldingen** consistenter (nu deels stille `catch(_)`).
- [ ] **Documentatie** bijwerken: push-cron committen/schedulen i.p.v. alleen docs.

### Privacy & beveiliging (grotendeels op orde)
- [x] Familie-portaal toont nooit gevoelige gegevens.
- [x] Gevoelige API-sleutels per account (auth-metadata).
- [ ] **Bewaartermijn** (privacybeleid noemt 10 jaar) — optioneel automatisch
  markeren/opschonen van zeer oude dossiers.
- [ ] Overweeg **2FA** op de beheerdersaccounts (optioneel, gevoelige data).

### UX / polish
- [ ] Toegankelijkheid (contrast, focus, toetsenbord) nalopen.
- [ ] Lege-staat-schermen en laadindicators consistent.
- [ ] Print-stylesheet controleren voor de PDF-vrije prints.

---

## Aanbevolen volgorde
1. **P0 afmaken** — migraties + demo-account + de twee intake-gaten + verse
   TestFlight-build → dan is de app echt bruikbaar en indienbaar.
2. **Dashboard + dossierstatus-automatisering** — dagelijks gebruiksgemak.
3. **Gedachtenisdagen + push-cron aanzetten** — uniek en cultureel belangrijk.
4. **Taken-tabel** activeren.
5. Daarna de bredere klooster-modules (registers, misintenties, giften).
