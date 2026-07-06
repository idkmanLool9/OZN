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

## Fase 8-UNLISTED — Verborgen in de App Store (aanbevolen voor jullie) ⭐

**Unlisted** = de app staat écht in de App Store, maar is **niet vindbaar** in
zoeken/categorieën. Je deelt hem via een **directe link**. Voordeel t.o.v.
TestFlight: **geen 90-dagen-verloop**, blijft permanent staan, en installeert
als een gewone App Store-app.

> Een unlisted app moet nog steeds één keer door **App Review**. Daarna blijft
> hij verborgen staan.

### Stappen

1. **Build uploaden** — doe eerst Fase 4 + 5 (Codemagic → TestFlight-build).
2. **App-informatie invullen** — in App Store Connect → Uitvaartbeheer →
   **App Store**-tab, vul alles uit `metadata.md`:
   - Name, Subtitle, Description, Keywords, Support URL, Privacy Policy URL
   - Category: Business / Productivity · Age Rating: 4+
   - **App Icon**: upload `docs/appstore/assets/appicon-1024.png` (staat klaar)
   - **Screenshots**: min. 2 per apparaat (zie `screenshots.md`)
   - **Build**: kies je geüploade build
   - **App Privacy** + **App Review Information** (demo-account + notes) — zie de
     App-Store-fase hieronder
3. **Unlisted aanvragen** — ga naar
   [developer.apple.com/contact/request/unlisted-app-distribution](https://developer.apple.com/contact/request/unlisted-app-distribution)
   - Vul de **Apple ID** van de app in (het 10-cijferige nummer uit Fase 3)
   - Bevestig dat je unlisted distributie wilt → verstuur
   - Apple verwerkt dit meestal binnen enkele dagen
4. **Indienen voor review** — in de App Store-tab: **Add for Review → Submit**.
   Kies bij Version Release **"Manually release"**.
5. **Na goedkeuring** krijg je een **directe App Store-link** (te vinden onder de
   app in App Store Connect). Die deel je met de parochies — alleen mensen met
   de link kunnen de app vinden en installeren.

### Kort: waarom unlisted i.p.v. de andere opties

| | TestFlight publieke link | **Unlisted App Store** ⭐ | Publieke App Store |
|---|---|---|---|
| Vindbaar in zoeken | nee | **nee** | ja |
| Verloopt | ja, na 90 dagen | **nee** | nee |
| App Review nodig | lichte review | **ja** | ja |
| Installeert als echte app | via TestFlight-app | **ja, gewone app** | ja |

## Belangrijk om te weten

- **Eerste keer is het meest werk** — daarna gaat het sneller (alleen build + screenshots updaten)
- **Screenshots refreshen** is alleen nodig als je grote UI-wijzigingen hebt
- **Updates** ('voeg een feature toe' commit → nieuwe build → submit) gaat doorgaans binnen 24 uur door review
- **TestFlight is genoeg** voor jullie eigen gebruik — App Store-publicatie is alleen voor breed aanbod
