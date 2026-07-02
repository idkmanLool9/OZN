# App Store — invulgids "Uitvaart Intake"

Alles klaar om te kopiëren/plakken in **App Store Connect**. Onderaan staan de
losse acties die alleen jij kunt doen (screenshots, demo-account, unlisted).

Live pagina's (al online op Cloudflare Pages):
- **Privacybeleid:** https://uitvaart.pages.dev/privacy.html
- **Support:** https://uitvaart.pages.dev/support.html
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
- Privacy Policy URL: `https://uitvaart.pages.dev/privacy.html`
- Support URL (tab "Version Information"): `https://uitvaart.pages.dev/support.html`
- Marketing URL (optioneel): `https://uitvaart.pages.dev/`

---

## 2. Teksten (Version Information — NL)

### Promotional Text (max 170 tekens)
```
Beheer alle uitvaartdossiers van je parochie op één plek — intake, kosten, facturen, dagplanning en familiecommunicatie in een rustige, overzichtelijke app.
```

### Description (max 4000 tekens)
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
· Professionele PDF-factuur en dossieroverzicht — opslaan, printen, delen of mailen
· Lockscreen-widget (Live Activity) met aftelteller naar de eerstvolgende uitvaart
· Lokale herinneringen voor aankomende uitvaarten en huisbezoeken

FAMILIE-PORTAAL
· Deel een veilige link met de contactpersoon: zij zien de dagplanning en een checklist van wat ze moeten meenemen
· Optioneel kan de familie een foto van een identiteitsbewijs uploaden
· Geen inlog nodig en geen gevoelige administratie zichtbaar

PRIVACY
Alle gegevens worden versleuteld opgeslagen op Europese servers, conform de AVG. Geen advertenties, geen tracking, geen doorverkoop van gegevens.

Vragen? monastery@morephrem.com
```

### Keywords (max 100 tekens, komma-gescheiden)
```
uitvaart,dossier,administratie,parochie,klooster,factuur,dagplanning,DELA,verzekering,kerk,begrafenis
```

### What's New in This Version (bij updates)
```
Nieuwe naam "Uitvaart Intake", echte Apple-documentscanner, familie-portaal met dagplanning en ID-upload, lockscreen-widget, en professionele PDF-facturen.
```

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
This is an internal funeral-administration tool for parishes of the Syriac
Orthodox Church of Antioch in the Netherlands. Funeral directors use it to
manage case files, costs, invoices, day schedules and family communication.

A demo account is provided (see credentials). After login you'll see a list
of fictitious case files. Tap any case to explore the full workflow: intake
form, costs by category, document scanning, PDF invoice, and the family
portal share link.

All personal data is stored on EU-based Supabase infrastructure, encrypted in
transit and at rest. The app contains no advertising, analytics SDKs, or
third-party trackers. The camera is used only for on-device document scanning
(Apple VisionKit).
```

**Contact Information:** vul je eigen **naam, e-mail en telefoonnummer** in.

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
