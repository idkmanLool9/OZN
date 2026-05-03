# App Store-indiening — complete checklist

Stap-voor-stap van Developer-account-goedkeuring tot publicatie.

## Fase 1 — Apple Developer-account (1× per jaar, €99)

- [ ] [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll) → enroll als Individual
- [ ] 2-factor-authenticatie aanzetten op je Apple ID
- [ ] Betalen (€99) — wacht op bevestigingsmail (1-3 dagen)

## Fase 2 — App-identifier registreren (5 min)

- [ ] [Identifiers](https://developer.apple.com/account/resources/identifiers/list) → "+"
- [ ] Type: **App IDs** → **App**
- [ ] Description: `Uitvaartbeheer SOK`
- [ ] Bundle ID: **Explicit** → `nl.sok.uitvaartbeheer`
- [ ] Capabilities: vink **Push Notifications** aan (handig voor later)
- [ ] **Continue → Register**

## Fase 3 — App aanmaken in App Store Connect (5 min)

- [ ] [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → "+"
- [ ] Platform: **iOS**
- [ ] Name: **Uitvaartbeheer**
- [ ] Primary Language: **Dutch (Netherlands)**
- [ ] Bundle ID: kies `nl.sok.uitvaartbeheer` uit dropdown
- [ ] SKU: `uitvaartbeheer-sok`
- [ ] Full Access
- [ ] **Create**
- [ ] **Onthoud het App-ID-nummer** (10 cijfers, bovenin de URL na aanmaken)

## Fase 4 — Codemagic koppelen (10 min)

- [ ] [codemagic.io](https://codemagic.io) → Teams → Integrations
- [ ] Onder **Developer Portal**: **App Store Connect API key**
  - In ASC eerst: Users and Access → Integrations → App Store Connect API → "+" → Admin
  - Download de **`.p8`-sleutel** (eenmalig!), noteer **Issuer ID** en **Key ID**
- [ ] Upload `.p8` in Codemagic, plak Issuer ID + Key ID, naam: `codemagic`
- [ ] In `codemagic.yaml` (regel `APP_STORE_APP_ID: 0000000000`): vervang door echte App-ID uit Fase 3
- [ ] Push naar GitHub

## Fase 5 — Eerste TestFlight-build (~25 min)

- [ ] Codemagic → app → workflow `ios-testflight` → **Start new build**
- [ ] Wacht op ✅ groen vinkje
- [ ] In App Store Connect → My Apps → Uitvaartbeheer → **TestFlight** tab
  - De build verschijnt onder "iOS Builds" met status "Processing"
- [ ] Wacht 10-15 min tot de build status "Ready to Submit" heeft

## Fase 6 — Tester(s) toevoegen (TestFlight intern)

- [ ] In **TestFlight** tab → **Internal Testing** → **Internal Group** of nieuwe groep
- [ ] **+** → voer e-mailadressen in (jouw eigen + priester + secretariaat)
- [ ] Selecteer de build → **Add**
- [ ] Apple stuurt uitnodigings-mails naar de testers
- [ ] Op iPad: **TestFlight**-app uit App Store
- [ ] Open uitnodigingsmail → "View in TestFlight" → **Install**
- [ ] App-icoon staat op het home-scherm 🎉

## Fase 7 — Publieke link genereren (optioneel)

- [ ] In **TestFlight** → **Public Link** sectie
- [ ] Vink "Enable Public Link" aan
- [ ] Stel limiet in (max 10.000 testers)
- [ ] Kopieer de link → deel met SOK-parochies, in WhatsApp etc.

## Fase 8 — Submit naar App Store (publicatie)

Alleen doen als je écht in de App Store wilt staan voor iedereen wereldwijd.

### App-informatie invullen

In App Store Connect → My Apps → Uitvaartbeheer → **App Store** tab:

- [ ] **Name**, **Subtitle**, **Description**, **Keywords**, **Promotional Text** ← uit `metadata.md`
- [ ] **Support URL** + **Privacy Policy URL** ← uit `metadata.md`
- [ ] **Primary Category**: Business
- [ ] **Secondary Category**: Productivity
- [ ] **Age Rating**: 4+
- [ ] **App Icon** uploaden: 1024×1024 PNG (zie `screenshots.md`)
- [ ] **Screenshots**: minimaal 2 per apparaat-categorie (zie `screenshots.md`)

### Build selecteren

- [ ] **Build** → kies de TestFlight-build die je wil indienen

### Pricing & Availability

- [ ] **Free**
- [ ] **Availability**: kies landen (begin met Netherlands)

### App Privacy

- [ ] **Edit** → klik door alle vragen
- [ ] **Data Collected**: Email Address (voor login), Name (optioneel), User Content (dossier-data namens nabestaanden)
- [ ] Allemaal "Linked to user identity": Yes
- [ ] "Used for tracking": **No** voor alles
- [ ] **Save**

### App Review Information

- [ ] **Sign-in required**: Yes
- [ ] **Demo account**: vul de credentials uit `metadata.md`
- [ ] **Notes**: kopieer de tekst uit `metadata.md → App Review Information → Notes for Reviewer`
- [ ] **Contact Information**: jouw naam + telefoon + e-mail

### Version Release

- [ ] **Manually release this version** (zo bepaal je zelf wanneer 'ie zichtbaar wordt)

### Indienen

- [ ] **Add for Review** → **Submit for Review**
- [ ] Wachttijd: typisch **24-72 uur**, soms langer in vakanties
- [ ] Bij goedkeuring: status wordt **Pending Developer Release** → klik **Release this Version**
- [ ] Bij afwijzing: lees feedback, pas aan, opnieuw indienen

## Belangrijk om te weten

- **Eerste keer is het meest werk** — daarna gaat het sneller (alleen build + screenshots updaten)
- **Screenshots refreshen** is alleen nodig als je grote UI-wijzigingen hebt
- **Updates** ('voeg een feature toe' commit → nieuwe build → submit) gaat doorgaans binnen 24 uur door review
- **TestFlight is genoeg** voor jullie eigen gebruik — App Store-publicatie is alleen voor breed aanbod
