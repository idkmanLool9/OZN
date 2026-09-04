# App Store — invulgids "Uitvaart Intake"

Alles klaar om te kopiëren/plakken in **App Store Connect**. Onderaan staan de
losse acties die alleen jij kunt doen (screenshots, demo-account, unlisted).

Live pagina's (al online op Cloudflare Pages):
- **Privacybeleid:** https://uitvaart.pages.dev/privacy
- **Support:** https://uitvaart.pages.dev/support
- **Marketing/website:** https://uitvaart.pages.dev/

---

## 1. Basisgegevens (App Information)

| Veld | Waarde |
|---|---|
| **App Name** | `Uitvaart Intake` |
| **Subtitle** | `Dossiers, kosten en facturen` |
| **Bundle ID** | `nl.sok.uitvaartbeheer` |
| **SKU** | `uitvaartbeheer-sok` |
| **Primary Language** | Dutch (Netherlands) |
| **Primary Category** | Business |
| **Secondary Category** | Productivity |
| **Content Rights** | Bevat geen third-party content ("Does NOT use third-party content") |
| **Age Rating** | 4+ |
| **Price** | Free (Tier 0) |
| **Availability** | Nederland (evt. later BE / DE / SE) |

**URLs (tab "App Information" → "General Information"):**
- Privacy Policy URL: `https://uitvaart.pages.dev/privacy`
- Support URL (tab "Version Information"): `https://uitvaart.pages.dev/support`
- Marketing URL (optioneel): `https://uitvaart.pages.dev/`

---

## 2. Teksten (Version Information)

> Engels is de primaire tekst (Apple-reviewers lezen Engels). Wil je óók een
> Nederlandse localisatie? Voeg die als extra taal toe en plak de NL-versie
> onderaan deze sectie.

### Promotional Text (max 170 tekens)
```
Manage all your parish's funeral case files in one place — intake, costs, cost estimates, day schedules and family communication in a calm, clear app.
```

### Description (max 4000 tekens)
```
Uitvaart Intake — administration for parishes and monasteries

A complete administration app for funeral coordinators within the Syriac Orthodox Church of Antioch and other parishes. Keep every case file complete, clear and always at hand — on your iPad.

WHAT IT DOES
· Full intake in one continuous form — deceased, contact person, church, funeral service, insurance and payment
· Automatic case number and retention tracking
· Cost items per category (transport, coffin, church, cemetery, catering, cleaning) with quantities and guide prices
· Insurance coverage per package — DELA templates with coverage applied automatically per category
· Postcode entry: type postcode + house number, street and town fill in automatically
· Scan documents with the real Apple document scanner (automatic cropping and perspective correction)
· Digital signatures on the intake file
· Professional cost-estimate PDF and case overview — save, print, share or email
· Lock screen widget (Live Activity) with a countdown to the next funeral
· Local reminders for upcoming funerals and home visits

FAMILY PORTAL
· Share a secure link with the contact person: they see the day schedule and a checklist of what to bring
· The family can optionally upload a photo of an identity document
· No login required and no sensitive administration visible

FOR WHOM
Uitvaart Intake is a closed tool for the funeral coordinators and secretariat of the parishes of the Syriac Orthodox Church of Antioch. Access is by invitation: accounts are created by the secretariat; there is no public sign-up.

PRIVACY
All data is stored encrypted on European servers, in accordance with the GDPR. No advertising, no tracking, no reselling of data.

Questions? monastery@morephrem.com
```

### Keywords (max 100 tekens, komma-gescheiden)
```
funeral,records,administration,parish,monastery,invoice,mourning cards,DELA,insurance,church,burial
```

### What's New in This Version (bij updates)
```
New name "Uitvaart Intake", the real Apple document scanner, a family portal with day schedule and ID upload, a lock screen widget, and professional cost-estimate PDFs.
```

---

<details>
<summary>Nederlandse versie (optioneel — voor een NL-localisatie)</summary>

**Promotional Text**
```
Beheer alle uitvaartdossiers van je parochie op één plek — intake, kosten, kostenramingen, dagplanning en familiecommunicatie in een rustige, overzichtelijke app.
```

**Description**
```
Uitvaart Intake — administratie voor parochies en kloosters

Een complete administratie-app voor uitvaartleiders binnen de Syrisch-Orthodoxe Kerk van Antiochië en andere parochies. Houd elk dossier compleet, overzichtelijk en altijd bij de hand — op je iPad.

WAT HET DOET
· Volledige intake in één doorlopend formulier — overledene, contactpersoon, kerkelijk, uitvaartdienst, verzekering en betaling
· Automatisch dossiernummer en bewaartraject
· Kostenposten per categorie (vervoer, kist, kerk, begraafplaats, catering, schoonmaak) met aantallen en richtprijzen
· Verzekeringsdekking per pakket — DELA-templates met dekking per categorie automatisch verwerkt
· Postcode-invoer: typ postcode + huisnummer, straat en woonplaats vullen zichzelf in
· Documenten scannen met de echte Apple-documentscanner (automatische uitsnede en perspectief-correctie)
· Digitale handtekeningen op het intake-dossier
· Professionele PDF-kostenraming en dossieroverzicht — opslaan, printen, delen of mailen
· Lockscreen-widget (Live Activity) met aftelteller naar de eerstvolgende uitvaart
· Lokale herinneringen voor aankomende uitvaarten en huisbezoeken

FAMILIE-PORTAAL
· Deel een veilige link met de contactpersoon: zij zien de dagplanning en een checklist van wat ze moeten meenemen
· Optioneel kan de familie een foto van een identiteitsbewijs uploaden
· Geen inlog nodig en geen gevoelige administratie zichtbaar

VOOR WIE
Uitvaart Intake is een besloten hulpmiddel voor de uitvaartcoördinatoren en het secretariaat van de parochies van de Syrisch-Orthodoxe Kerk van Antiochië. Toegang is op uitnodiging: accounts worden aangemaakt door het secretariaat, er is geen openbare aanmelding.

PRIVACY
Alle gegevens worden versleuteld opgeslagen op Europese servers, conform de AVG. Geen advertenties, geen tracking, geen doorverkoop van gegevens.

Vragen? monastery@morephrem.com
```

**Keywords**
```
uitvaart,dossier,administratie,parochie,klooster,factuur,rouwkaart,DELA,verzekering,kerk,begrafenis
```
</details>

---

## 3. App Privacy — de "nutrition label" (VERPLICHT)

App Store Connect → tab **App Privacy** → "Get Started".

**Vraag: Do you or your third-party partners collect data from this app?** → **Yes**

Voor ELK onderstaand gegevenstype kies je telkens:
- **Purpose:** *App Functionality* (en niks anders)
- **Linked to the user's identity:** *Yes* (het is een account-app)
- **Used for tracking:** *No*

Gegevenstypen om aan te vinken:

| Categorie | Wat / waarom |
|---|---|
| **Contact Info** → Name, Email Address, Phone Number, Physical Address | Login-account + gegevens van contactpersoon/nabestaanden |
| **User Content** → Photos or Videos | Gescande documenten en (optioneel) ID-foto's |
| **User Content** → Other User Content | Dossiergegevens en notities |
| **Sensitive Info** | Kerkelijke/parochie-gegevens (geloofsovertuiging) |
| **Identifiers** → User ID | Account-identifier |
| **Other Data Types** | BSN / overige dossierdata |

> Kort gezegd: je verzamelt uitsluitend gegevens die nodig zijn om de app te
> laten werken, gekoppeld aan het account, **nooit voor tracking of reclame**.
> Er zit **geen** advertentie-SDK of externe analytics-tracker in.

---

## 4. Age Rating-vragenlijst

Alles op **None / Nee** (geweld, seksuele content, gokken, schokkende content,
gebruikersgegenereerde openbare content, enz.). Uitkomst: **4+**.

---

## 5. App Review Information (instructies voor Apple)

**Sign-In Required:** ☑️ **Yes** (alles zit achter login → geef demo-account).

**Demo Account** — maak dit alleen aan in Supabase (Authentication → Add user).
Je hoeft GEEN dossiers te vullen: dit account toont automatisch 3 volledig
ingevulde, fictieve demo-dossiers en laat nooit de echte dossiers of gevoelige
sleutels zien. Alle bewerkingen van de reviewer blijven lokaal (raken de echte
gegevens niet).
```
E-mail:     reviewer@morephrem.com
Wachtwoord: AppleReview2026!
```
> Wil je later een extra review-account? Voeg het e-mailadres (kleine letters)
> toe aan `DEMO_ACCOUNTS` in `js/demo.js`.

**Notes for Reviewer** (plak in het notitie-veld):
```
INTENDED AUDIENCE / DISTRIBUTION
This is an internal business tool for a specific, closed group of users: the
funeral coordinators and secretariat of the parishes of the Syriac Orthodox
Church of Antioch in the Netherlands (St. Ephrem the Syrian Monastery, Glane,
and its affiliated parishes). It is NOT intended for the general public. Access
is by invitation only: accounts are created by the monastery's secretariat for
its own staff; there is no public sign-up. We intend to publish this app using
Unlisted App Distribution so it is only reachable via a direct link by our own
coordinators, and will submit the Unlisted App Distribution request after
approval. If you consider this app more appropriate for private distribution
(Apple Business Manager / Custom Apps), we are happy to move it there — please
let us know rather than rejecting, as our goal is simply to let our own staff
install it reliably on their iPads.

WHAT THE APP DOES
Funeral coordinators use it to manage case files, costs, cost estimates, day
schedules and family communication for funerals within our church community.

HOW TO TEST
A demo account is provided (see credentials). After login you'll see a list of
fictitious case files. Tap any case to explore the full workflow: intake form,
costs by category, document scanning, cost-estimate PDF, and the family portal
share link. All data shown under this account is fictitious sample data and any
changes stay local to the session.

PRIVACY / SECURITY
All personal data is stored on EU-based Supabase infrastructure, encrypted in
transit and at rest. The app contains no advertising, analytics SDKs, or
third-party trackers. The camera is used only for on-device document scanning
(Apple VisionKit).
```

**Contact Information:** vul je eigen **naam, e-mail en telefoonnummer** in.

> **Waarom deze notitie belangrijk is.** Apple keurt "interne" apps voor één
> organisatie soms af onder richtlijn 4.2 (te weinig nut voor het algemene
> publiek) of 4.3. Door in de review-notitie duidelijk te maken dat dit een
> besloten hulpmiddel is voor je eigen parochies (alleen op uitnodiging, geen
> openbare aanmelding) én dat je **Unlisted App Distribution** gaat aanvragen,
> haal je die twijfel grotendeels weg. Wordt hij tóch afgewezen als "te
> intern", dan is het alternatief **Apple Business Manager → Custom Apps**
> (volledig privé verspreiden, zonder openbare App Store) — de notitie vraagt
> Apple expliciet om dat voor te stellen i.p.v. af te wijzen.

---

## 6. Export Compliance
Al geregeld in de build (`ITSAppUsesNonExemptEncryption = false`). Bij de vraag
"Does your app use encryption?" → **standaard HTTPS/exempt** → geen extra
documentatie nodig.

---

## 7. Screenshots (VERPLICHT — die maak jij op de iPad)

App Store eist iPad-schermafbeeldingen op **exact** één van deze maten
(anders afgekeurd): **2064 × 2752** (13" iPad Pro M4) of **2048 × 2732**
(12,9" iPad Pro). Minimaal 1, maximaal 10.

Aanbevolen schermen (portret):
1. **Dossierlijst** (overzicht met statusbadges)
2. **Dossier openen** (overzicht met kosten)
3. **Kostenposten** met categorieën
4. **PDF-factuur** (net gegenereerd)
5. **Familie-portaal** (dagplanning + checklist)
6. Optioneel: **Kisten-/Bloemencatalogus**

> Heb je alleen een kleinere iPad (bv. 10,9")? Maak de screenshots gewoon en
> stuur ze mij — ik schaal/pad ze naar de exacte 2048 × 2732 zodat ze door de
> keuring komen.

---

## 8. Unlisted maken (ná goedkeuring)

1. Dien de app **normaal in voor review** (met bovenstaande gegevens + build).
2. Wacht op **"Ready for Sale" / goedgekeurd**.
3. Vraag daarna **unlisted distributie** aan via het Apple-formulier:
   https://developer.apple.com/contact/request/unlisted-app-distribution/
4. Na goedkeuring is de app **verborgen** (niet vindbaar in de App Store) en
   alleen via de **directe link** te installeren — zonder 90-dagen-verloop.

---

## 9. Laatste checklist vóór "Submit for Review"
- [ ] Build geüpload en geselecteerd (laatste TestFlight-build)
- [ ] Naam, subtitle, beschrijving, keywords ingevuld
- [ ] Privacy- en Support-URL ingevuld
- [ ] App Privacy-vragenlijst ingevuld (§3)
- [ ] Age rating = 4+ (§4)
- [ ] Screenshots geüpload (§7)
- [ ] Demo-account aangemaakt + Review Notes ingevuld (§5)
- [ ] Contactgegevens ingevuld
- [ ] Submit → daarna unlisted aanvragen (§8)
