# Uitvaartbeheer — SwiftUI (iOS/iPadOS 26)

Eerste native versie van de **Dossiers-pagina** in SwiftUI. Dit is losstaande
UI-code; de echte data-koppeling (Supabase) komt later.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `Theme.swift` | Klooster-kleuren (bordeaux, teal) |
| `Dossier.swift` | Datamodel `Dossier` + `DossierStatus` + voorbeelddata |
| `DossierListView.swift` | De pagina zelf: filter-sidebar · lijst · detail |

## In VS Code bekijken

Open de map `ios-swiftui/` — de `.swift`-bestanden zijn gewone tekst en
direct leesbaar. Voor syntax-highlighting kun je de **Swift**-extensie van
Swift Server Work Group installeren (zoek "Swift" in de extensions).

## Bouwen / live preview

Compileren en de live preview vereisen **Xcode 26** (macOS). Zonder Mac kan
dat via Codemagic (zie `../codemagic.yaml`). De preview-blokken onderaan
`DossierListView.swift` tonen het scherm voor iPhone én iPad.

## Layout

- **iPad:** drie-koloms `NavigationSplitView` — statusfilter links,
  dossierlijst in het midden, detail rechts.
- **iPhone:** dezelfde structuur klapt automatisch in tot een navigatiestack.
- Grote titel "Dossiers", `.searchable`-zoekbalk, statusbadges als capsules.
