# OZN-app — concept & briefing

> Briefingsdocument om in een **nieuwe chat** mee te starten. Zeg daar simpelweg:
> *"Lees docs/ozn-app-concept.md"* en je hebt meteen alle context.
>
> Idee: een app voor **OZN (Overledenenzorg Nederland / Aula Vale)** voor hun
> **complete overledenenzorg-service**, gebouwd op de motor van de bestaande
> parochie-app "Uitvaart Intake".

---

## Over OZN (de klant)
- Professioneel **overledenenzorg-bedrijf** in **Oldenzaal** (dicht bij Glane/Losser).
- Opgericht **2007** door **Betto Nijland**. Website: **ozn.nl**.
- Diensten:
  - **Overledenenverzorging** (wassen, kleden, verzorgen) — de kern.
  - **Thanatopraxie**, reconstructie, restauratie (langer/waardig opbaren).
  - **Opbaring in Aula Vale** — eigen uitvaartcentrum met **24-uurs kamers**.
  - **Rouwauto's + uitvaartvervoer**.
  - **Kisten** (eigen assortiment).
  - **Opleiding overledenenverzorging** (cursussen).
- **B2B**: levert vooral diensten aan **andere uitvaartondernemingen** (en aan
  verpleeghuizen/families). De "opdrachtgever" is meestal een uitvaartonderneming.

## De visie / kernscenario
**Telefoon gaat → medewerker pakt iPad → opent app → start direct de aanname.**
Van het binnenkomende belletje tot de factuur, alles in één app op de iPad.

## Workflow / modules
1. **Aanname (tijdens het belletje)** — snel invulscherm: wie belt
   (uitvaartonderneming / verpleeghuis / familie), overledene (naam,
   geboorte/overlijden, **plaats van overlijden**), **ophaallocatie + kamer**,
   gevraagde diensten, **veiligheidsvlaggen** (besmettelijk, pacemaker — cruciaal
   voor verzorging/crematie), gewenste tijd. → maakt een **opdracht**.
2. **Vervoer & ophalen (eerste rit)** — rit inplannen: welke **rouwauto**, welke
   medewerker, van → naar, tijd, **km's**. Status: onderweg → opgehaald.
3. **Verzorging & thanatopraxie** — **verzorgingsprotocol/checklist** per opdracht
   (wassen, kleden, thanatopraxie, reconstructie). Wie, wanneer, welke handelingen.
   Privacygevoelige notities/foto's.
4. **Opbaring — Aula Vale** — **kamer-reserveringskalender**: welke 24-uurs kamer,
   van–tot, familiebezoeken, beschikbaarheid in één oogopslag.
5. **Kist & materialen** — uit eigen assortiment (kisten-catalogus, al aanwezig).
6. **Overdracht & facturatie** — alles wat gedaan is → **automatisch een factuur
   naar de opdrachtgever** (uitvaartonderneming): verzorging, transport-km,
   aula-nachten, kist.

**Later erbij:** B2B **relatie-/klantbeheer** (uitvaartondernemingen), **planning/
agenda** (ritten, verzorgingen, kamers), **voorraad**, en de **opleiding-module**
(cursussen/deelnemers).

## Herbruikbaar uit de bestaande "Uitvaart Intake"-app
Tech-stack (zie deze repo): **vanilla-JS PWA zonder bundler** (plain `<script>`),
**Supabase** backend (EU), **Capacitor 6** iOS-wrapper (via Codemagic), gehost op
**Cloudflare Pages**, iPad-first. `DB`-façade met in-memory cache + offline
localStorage-spiegel; hash-router; `Settings` (cloud + per-account secrets);
`PdfGen` (jsPDF); Apple VisionKit documentscanner; demo-modus.

Direct herbruikbaar voor OZN:
- **Dossier/opdracht-structuur** + cloud-sync + offline.
- **PDF/factuur-motor** (`js/views-factuur.js`, `PdfGen` in `js/core.js`).
- **Documentscanner** (Apple VisionKit) + PDF-levering.
- **Login/auth** + per-account gevoelige sleutels + **demo-modus** (`js/demo.js`).
- **Kisten-catalogus** (`js/data.js`, `js/views-kisten.js`).
- **Automatiseringen**: bekende naam → auto-invullen, dubbeldetectie, entiteit-
  koppelingen (`js/views-form.js`, `js/views-leden.js` → `LedenSync`).
- **Instellingen/branding**, toast-meldingen, modals.

## Nieuw t.o.v. de parochie-app (het echte bouwwerk)
- **B2B relatie-/klantbeheer** (de uitvaartondernemingen waarvoor OZN werkt).
- **Logistiek**: rouwauto's / ritten / km-registratie.
- **Aula Vale kamer-reserveringskalender** (beschikbaarheid + boekingen).
- **Verzorgings-/thanatopraxie-protocol** per opdracht (checklist).
- **Veiligheidsvlaggen** (besmettelijk, pacemaker).

## Datamodel (eerste schets)
- `opdrachten` (cases) — overledene, opdrachtgever, locaties, vlaggen, status.
- `relaties` — B2B-klanten (uitvaartondernemingen) + contactpersonen.
- `ritten` — transport (auto, chauffeur, van/naar, km, tijd).
- `verzorgingen` — handelingen/checklist per opdracht.
- `kamers` + `reserveringen` — Aula Vale.
- `kisten` — catalogus (hergebruik).
- `facturen`/`kosten` — per opdracht naar de opdrachtgever.

## Open vragen voor OZN (ophalen vóór bouwen)
- Wie zijn de gebruikers (aantal, rollen: aanname, verzorging, chauffeurs)?
- Vooral voor uitvaartondernemingen, of ook direct voor families?
- Hoeveel **aula-kamers** heeft Aula Vale (voor de reserveringskalender)?
- Facturatie per opdracht naar de uitvaartonderneming? Koppeling met een
  boekhoudpakket (bv. SnelStart)?
- Willen ze de **opleiding-module** erin?
- **Aparte app + eigen branding**, of een variant in dezelfde codebase?

## Aanbevolen start
1. **Pitch-/conceptpagina** maken om aan OZN te tonen (enthousiasme + wensen ophalen).
2. Daarna **prototype** dat de bestaande motor hergebruikt.
3. Open vragen hierboven met OZN doornemen vóór definitief bouwen.

## Referenties in deze repo
- `docs/automatisering-roadmap.md` — automatiserings-ideeën (veel herbruikbaar).
- `docs/aanbevelingen.md` — geprioriteerde aanbevelingen.
- `docs/appstore/INVULGIDS.md` — App Store / distributie-aanpak (unlisted).
- Branch: `claude/funeral-director-website-raXTm`.
