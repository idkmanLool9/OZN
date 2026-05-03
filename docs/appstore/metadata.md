# App Store Connect — metadata

Klaar om te kopiëren-plakken in App Store Connect bij het indienen van de
app voor publieke release.

---

## Basisgegevens

| Veld | Waarde |
|---|---|
| **App Name** | Uitvaartbeheer |
| **Subtitle** | Dossiers, kosten en facturen |
| **Bundle ID** | `nl.sok.uitvaartbeheer` |
| **SKU** | `uitvaartbeheer-sok` |
| **Primary Language** | Dutch (Netherlands) |
| **Primary Category** | Business |
| **Secondary Category** | Productivity |
| **Age Rating** | 4+ (geen ongeschikte content) |
| **Pricing** | Free |
| **Availability** | Netherlands (eventueel uitbreiden naar BE / DE / SE) |

---

## Beschrijving (NL — voor de Nederlandse App Store)

### Promotional Text (170 tekens max)

> Beheer alle uitvaartdossiers van je parochie op één plek — intake, kosten, facturen, rouwkaart en familiecommunicatie in een rustige, overzichtelijke app.

### Description (4000 tekens max)

> **Uitvaartbeheer voor parochies en kloosters**
>
> Een complete administratie-app voor uitvaartleiders binnen de Syrisch-Orthodoxe Kerk van Antiochië en andere parochies. Houd elk dossier compleet, overzichtelijk en altijd bij de hand — op je iPad of telefoon.
>
> **WAT HET DOET**
>
> · Volledige intake in één doorlopend formulier — overledene, contactpersoon, kerkelijk, uitvaartdienst, verzekering en betaling
> · Automatisch dossiernummer en bewaartraject
> · Kostenpresets per categorie (vervoer, kist, kerk, begraafplaats, catering, schoonmaak)
> · Catering-posten met aantallen — vermenigvuldigt automatisch met de stukprijs
> · Verzekeringsdekking per pakket — DELA-templates met dekking per categorie automatisch verwerkt
> · Postcode-API: typ postcode + huisnummer, straat en woonplaats vullen vanzelf in
> · Wiel-datumkiezer (dag, maand, jaar) op elke datum-invoer
> · Documenten scannen met automatische uitsnede en perspectief-correctie
> · Digitale handtekeningen op het intake-dossier
> · Rouwkaart genereren en familie e-mailen
> · Factuur opstellen en delen, met DELA-dekking automatisch verrekend
> · Volledig in eigen huisstijl te zetten — logo, kleuren, app-naam, login-tekst
>
> **VOOR DE FAMILIE**
>
> · Aanpasbare bullet-points op het inlogscherm
> · Familie ontvangt overzichten en facturen in NL-opmaak
> · Privé en veilig: alle data versleuteld, EU-servers, geen advertenties of trackers
>
> **TECHNIEK**
>
> · Cloudsync via Supabase — open op meerdere apparaten met dezelfde gegevens
> · Werkt ook offline (laatst geladen dossiers blijven leesbaar)
> · Automatische updates via TestFlight / App Store
>
> **PRIVACY**
>
> Alle gegevens worden versleuteld opgeslagen op Europese servers in
> overeenstemming met de AVG. Geen advertenties, geen tracking, geen
> doorverkoop van gegevens. Privacybeleid: zie link onder.
>
> Vragen of opmerkingen? Mail naar secretariaat@stephremklooster.nl

### Keywords (100 tekens max, comma-separated)

```
uitvaart,dossier,administratie,parochie,klooster,factuur,rouwkaart,DELA,verzekering,kerk,begrafenis
```

### Support URL

```
https://idkmanlool9.github.io/uitvaart/
```

### Marketing URL (optioneel)

```
https://idkmanlool9.github.io/uitvaart/
```

### Privacy Policy URL

```
https://idkmanlool9.github.io/uitvaart/privacy.html
```

> Pas het domein aan zodra de site op een eigen domein gehost wordt
> (bijv. `https://uitvaart.stephremklooster.nl/privacy.html`).

---

## Description (EN — voor internationale uitbreiding)

### Promotional Text

> Manage all funeral case files for your parish in one place — intake, costs, invoices, memorial cards and family communication in a calm, well-organized app.

### Description

> **Funeral administration for parishes and monasteries**
>
> A complete administration app for funeral directors within the Syriac Orthodox Church of Antioch and other parishes. Keep every case file complete, organized and always at hand — on your iPad or phone.
>
> **FEATURES**
>
> · Full intake in one continuous form — deceased, contact person, ecclesiastical info, service, insurance and payment
> · Automatic case numbers and retention tracking
> · Cost presets per category (transport, casket, church, burial, catering, cleaning)
> · Catering items with quantities — automatically multiplied by unit price
> · Insurance coverage per package — DELA templates with per-category coverage applied automatically
> · Dutch postal code API: enter zip + house number, street and city fill in automatically
> · Wheel date picker (day/month/year) on every date input
> · Document scanning with automatic crop and perspective correction
> · Digital signatures on the intake form
> · Generate memorial cards and email to family
> · Create invoices with DELA coverage automatically calculated
> · Fully customizable branding — logo, colors, app name, login screen text
>
> **PRIVACY**
>
> All data is encrypted and stored on European servers in compliance with
> GDPR. No ads, no tracking, no data resale.

### Keywords (EN)

```
funeral,case,administration,parish,monastery,invoice,memorial,insurance,church,burial,DELA
```

---

## App Review Information (instructies voor de Apple-reviewer)

### Demo Account

> Maak vóór indienen een demo-gebruiker aan in Supabase Authentication
> met deze gegevens:

```
E-mail:     reviewer@stephremklooster.nl
Wachtwoord: AppleReview2026!
```

> En vul met een paar fictieve dossiers + kosten zodat de reviewer zonder
> wachten kan klikken.

### Notes for Reviewer (vrij formuleerbaar veld in ASC)

```
Hello App Review team,

This app is an internal funeral administration tool for parishes within
the Syriac Orthodox Church of Antioch (a Christian denomination based in
the Netherlands). It is used by funeral directors to manage case files,
costs, invoices and memorial cards.

A demo account has been provided. After login you'll see a list of
fictitious case files. Tap any case to explore the full workflow:
intake form, costs grouped by category, document upload, memorial card
generation, and invoice.

The app is intended for parish-level use across multiple Syriac Orthodox
parishes in the Netherlands and surrounding countries. While the
audience is specialized, the underlying software is functional funeral
administration software comparable to commercial alternatives.

All personal data is stored on EU-based Supabase infrastructure and
encrypted in transit and at rest. The app contains no advertising,
analytics or third-party trackers.

Best regards,
Levi Aktan (developer / contact)
```

### Sign-In Required

> ☑️ Yes — alle features zitten achter een login. Geef het demo-account.

### Contact Information

> Vul je eigen naam, e-mail en telefoonnummer in op het App Information-scherm.
