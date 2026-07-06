# Automatisering — roadmap Uitvaart + Klooster-app

Analyse van de hele codebase: wat er al automatisch gaat, wat er nog kan, en de
gaten die daarbij opvielen. Legenda: ✅ bestaat al · ○ nieuw · waarde/inspanning
= laag/midden/hoog.

De app heeft twee "automatiserings-motoren":
- **Client-side** (bij opslaan/verlaten van een veld) — de meeste bestaande
  automatiseringen, in `js/views-form.js` en `js/views-leden.js`.
- **Server (Supabase Edge Function + dagelijkse cron)** — nu alleen `send-push`
  (`supabase/functions/send-push`). Dit is de herbruikbare basis voor élke
  tijd-gestuurde herinnering hieronder.

---

## Belangrijke gaten (bijna-bugs — eerst dichten)

1. **Verzekering + betaling niet invulbaar in de intake.** De velden
   (`verzekering_status/pakket/dekking`, `betaalwijze`, `aanbetaling_*`,
   `eindafrekening_*`) bestaan, worden gebruikt door de dekking-motor en de
   factuur, maar hebben **geen invoerveld in de wizard**; het dossier linkt zelfs
   naar een niet-bestaande sectie `#verzekering-met-fields`. Nu alleen via de DB
   te zetten. Blokkeert alle verzekering/betaling-automatisering.
2. **Huisbezoek & avondwake** (`huisbezoek_datum/tijd`, `avondwake_*`) hebben
   geen invoerveld, terwijl de iOS-herinneringen en de e-mails ze al gebruiken.
3. **`taken`-tabel** bestaat mét beveiliging maar wordt nergens gebruikt.
4. **Push-cron** (dagelijkse herinnering) staat in de docs maar is niet
   ingeschakeld/gecommit.
5. **SnelStart** is aangesloten maar wordt alleen getest, nooit echt gebruikt.
6. Geen **dashboard**, geen **BSN-controle/dubbeldetectie**, geen
   **40-dagen/jaargedachtenis**-registratie.

---

## Al aanwezig (niet opnieuw bouwen)

Postcode→adres · parochie→priester · kist→kostenpost · verzekeraar→polisveld ·
graftype→grafnummer/certificaat · kinderen→vervolgvelden · **leden↔dossiers**
(overledene wordt lid, lid→dossier) · auto-mail dossier naar klooster ·
ontbrekende-velden-waarschuwing · autosave-concept · scan/OCR-voorinvulling ·
dossiernummer (DB-trigger) · `updated_at`/`bijgewerkt_door` · factuurnummer ·
DELA-dekking per categorie · push vóór uitvaart · iOS-herinneringen + badge +
Live Activity · gezinsnummer-suggestie (alleen in gezin-formulier) ·
e-mail-adresboek · keepalive-cron. En nieuw: **bekende naam → auto-invullen**.

---

## 1. Slim invullen
- ○ **Gezinsnummer-suggestie in de intake** — achternaam matcht een gezin →
  stel dat gezinsnummer voor; anders het volgende `G-####`. (waarde hoog / laag)
- ○ **Omgekeerde ledenkoppeling** — gezinsnummer/naam → geboortedatum, doopnaam,
  adres uit een levend lid overnemen. (hoog / midden)
- ✅→○ Meer standaardwaarden (graftype, uitvaarttype, nationaliteit). (laag/laag)
- ○ Partner ↔ lid kruisinvulling. (midden / midden)

## 2. Koppelingen
- ○ **Dossier ↔ graf** — grafnummer in dossier → `graven`-rij op `bezet` +
  koppelen; en terugschrijven. (hoog / midden)
- ○ **Dubbel dossier detecteren** (BSN of naam+geboortedatum). (hoog / laag)
- ○ Artsverklaring automatisch meelinken in de dossier-mail. (midden / laag)

## 3. Status & workflow
- ○ **Dossierstatus automatisch** — nieuw→in behandeling (kist+priester+datum),
  →voltooid (dag na uitvaart + alles betaald). (hoog / midden)
- ○ **Checklist automatisch afvinken** (ID-upload, dragers, foto). (midden / midden)
- ○ "Betaald" op dossierniveau automatisch afleiden. (midden / laag)

## 4. Herinneringen (server, draait vanzelf)
- ○ **40-dagen-gedachtenis** (overlijdensdatum +40). (hoog / midden)
- ○ **Jaargedachtenis** (jaarlijkse verjaardag overlijdensdatum). (hoog / midden)
- ○ **Huisbezoek / avondwake** herinnering. (hoog / laag — na gat #2)
- ○ **Grafrechten verlopen** (vereist verval-kolom op `graven`). (hoog / midden)
- ○ **Openstaande betaling** na betalingstermijn. (hoog / midden)
- ○ **Takendeadlines** (na §10). (hoog / laag)
- ○ Doop-/verjaardag-herinneringen leden. (laag-midden / midden)

## 5. Documenten & communicatie
- ○ **Standaardbrief gemeente** (aangifte van overlijden). (hoog / midden)
- ○ **Brief/mail verzekeraar** (claim). (hoog / laag-midden)
- ○ **Rouwkaart / condoleancetekst** genereren. (midden / midden)
- ○ Dagplanning-tijden automatisch rond `uitvaart_tijd`. (midden / midden)
- ○ Kostenraming-PDF automatisch als bijlage. (midden / laag)

## 6. Controle & datakwaliteit
- ○ **BSN-elfproef**. (hoog / laag)
- ○ **Dubbel-persoon-detectie**. (hoog / laag)
- ○ **Datum-logica** (geboorte ≤ overlijden ≤ vandaag; uitvaart ≥ overlijden). (midden / laag)
- ○ Verplichte velden vóór "voltooid". (midden / laag)
- ○ Postcode netjes formatteren `1234AB → 1234 AB`. (laag / laag)

## 7. Catalogus / prijzen
- ○ Bloemen/eten automatisch verwijderen bij deselectie (zoals kist al doet). (midden / midden)
- ○ Prijs-drift waarschuwing t.o.v. actuele catalogus. (laag-midden / midden)
- ○ Begraafplaats-presets automatisch bij graftype. (midden / laag)

## 8. Financieel / SnelStart
- ○ Contactpersoon als **relatie** naar SnelStart bij nieuw dossier. (hoog / midden)
- ○ **Verkoopfactuur/boeking** naar SnelStart bij voltooien. (hoog / hoog)
- ○ Betaalstatus terug via de bestaande webhook. (midden / hoog)
- ○ Factuur splitsen: verzekering-deel vs familie-deel. (hoog / midden)

## 9. Overzicht / dashboard
- ○ **Home-dashboard** — deze week: uitvaarten, huisbezoeken, gedachtenissen,
  openstaand, status-verdeling, grafbeschikbaarheid. (hoog / midden)
- ○ Opgeslagen filters ("actie vereist", "onbetaald"). (midden / laag)
- ○ Financieel rapport per periode/parochie. (midden / midden)
- ○ Gedachtenis-kalender per parochie/priester. (midden / midden)

## 10. Takenlijst (`taken`-tabel activeren)
- ○ **Standaard-takenlijst bij nieuw dossier** met deadlines (aangifte 24–48u,
  verzekeraar, huisbezoek, kist, graf, priester, avondwake, dienst, 40-dagen,
  factuur). (hoog / midden)
- ○ Taken-tab in dossier-detail (afvinken). (hoog / midden)
- ○ Taken **automatisch afvinken** als het bijbehorende veld gevuld is. (hoog / midden)
- ○ Takendeadline-push (server). (hoog / laag)
- ○ Open-taken-teller op het dashboard. (laag)

---

## Aanbevolen volgorde (meeste waarde, minste werk)
1. Gaten dichten: verzekering/betaling + huisbezoek/avondwake terug in de intake.
2. BSN-elfproef + dubbel-dossier-detectie.
3. Dossier ↔ graf koppelen + gezinsnummer-suggestie.
4. Gedachtenisdagen + huisbezoek-herinneringen (push-cron aanzetten).
5. Takenlijst activeren (`taken`).
