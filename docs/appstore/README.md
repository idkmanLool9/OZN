# App Store-indiening — overzicht

Alles wat je nodig hebt om de app via TestFlight uit te rollen of in de
App Store te publiceren, op één plek.

## Inhoud

| Bestand | Wat zit erin |
|---|---|
| [`checklist.md`](./checklist.md) | Stap-voor-stap van Apple Developer-account tot App Store-publicatie |
| [`metadata.md`](./metadata.md) | App-naam, beschrijvingen (NL + EN), keywords, demo-account, reviewer-notities |
| [`screenshots.md`](./screenshots.md) | Welke screenshots je nodig hebt + hoe je ze maakt op iPad |
| [`/privacy.html`](../../privacy.html) | Hostable privacybeleid (NL + EN), wordt mee-gedeployed met de app |

## Volgorde

1. **Apple Developer-account afsluiten** (€99/jaar) → wacht op verificatie
2. Doorloop [`checklist.md`](./checklist.md) van boven naar beneden
3. Kopieer-plak teksten uit [`metadata.md`](./metadata.md) in App Store Connect
4. Maak screenshots volgens [`screenshots.md`](./screenshots.md)
5. Submit → wacht 1-3 dagen → live

## Privacy-URL

Apple eist een publieke privacy-URL bij elke app. Wij hebben er één:

```
https://idkmanlool9.github.io/uitvaart/privacy.html
```

Pas dit domein aan zodra de app op een eigen domein gehost wordt
(bijv. `https://uitvaart.stephremklooster.nl/privacy.html`) — dan
update je het ook in `metadata.md` en in App Store Connect.

## Kostenoverzicht

| Item | Eenmalig | Jaarlijks |
|---|---|---|
| Apple Developer Program | — | **€99** |
| Codemagic (free tier 500 min/mnd) | — | gratis |
| GitHub Pages hosting | — | gratis |
| Supabase (free tier) | — | gratis |
| Domeinnaam (optioneel, eigen URL) | — | ~€10 |
| **Totaal minimum** | **—** | **€99** |

## Vragen?

Als reviewer-feedback komt of iets faalt in de pipeline: paste de fout en
ik help meteen. Houd `metadata.md` open tijdens het invullen in ASC zodat
je niet hoeft te zoeken.
