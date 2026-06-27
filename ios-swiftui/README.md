# Uitvaartbeheer — SwiftUI (iOS/iPadOS 26)

Native versie van de app, gebouwd naar het web-ontwerp: een vaste zijbalk
links (branding · navigatie · gebruiker), een bovenbalk, en rechts het
**Dossiers-scherm** met een kolomtabel. Primair bedoeld voor iPad/landscape
(en Mac via Catalyst).

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `UitvaartbeheerApp.swift` | App-startpunt (`@main`) → toont `RootView` |
| `RootView.swift` | Zijbalk + bovenbalk + sectie-router; ook `Avatar` en `GebruikerKaart` |
| `DossiersScherm.swift` | Het Dossiers-scherm: kop, zoek/filter-rij, tabelkaart, footer, `StatusBadge` |
| `Dossier.swift` | Datamodel `Dossier` + `DossierStatus` + datum-helpers + voorbeelddata |
| `Theme.swift` | Kleuren (merkblauw, statusbadges, randen) |

## In VS Code bekijken

Open de map `ios-swiftui/`. De `.swift`-bestanden zijn gewone tekst en direct
leesbaar. Voor highlighting + autocomplete: installeer de **Swift**-extensie
(Swift Server Work Group) in VS Code.

> Let op: VS Code kan SwiftUI **schrijven** maar niet **uitvoeren**. Compileren
> en de live preview vereisen **Xcode 26** (macOS) of een cloud-Mac
> (Codemagic). SwiftUI zelf bestaat alleen in de Apple-SDK.

## Bouwen / preview

- **Xcode 26:** maak een iOS App-target en voeg deze map als bron toe. De
  `#Preview`-blokken tonen het scherm voor iPad.
- **Zonder Mac:** bouwen via `../codemagic.yaml` (cloud-Mac) → TestFlight →
  op je eigen iPhone/iPad.

## Layout (naar het web-ontwerp)

- **Zijbalk:** kerk-icoon + "Uitvaartbeheer", navigatie (Dossiers,
  Begraafplaats, Kisten, Bloemen, Eten, Account), gebruikerskaart onderaan.
- **Bovenbalk:** horizontale navigatie + gebruiker rechtsboven.
- **Dossiers:** grote titel + "Nieuw dossier", zoekbalk + statusfilter +
  Filteren, en een tabel met kolommen Dossier · Overledene · Contactpersoon ·
  Gezinsnr. · Overlijden · Uitvaart · Status · Laatst gewijzigd.

Nog geen data-koppeling — de lijst gebruikt voorbeelddata. De Supabase-koppeling
komt later.
