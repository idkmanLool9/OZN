# Uitvaartbeheer — SwiftUI (iOS/iPadOS 26)

Native versie van de **Dossiers-pagina**, gebouwd naar het web-ontwerp: vaste
zijbalk links (branding · navigatie · gebruiker), een bovenbalk, en rechts een
kolomtabel met dossiers.

## Eén bestand — `swift.swift`

Alles staat in **`swift.swift`**: één zelfstandig bestand dat je rechtstreeks
in **Swift Playgrounds op de iPad** kunt plakken en draaien. Zo zie je het
scherm live, zónder Mac.

### Zo draai je het op je iPad

1. Open de gratis app **Swift Playgrounds**.
2. Maak een nieuwe **App**.
3. Verwijder alle bestaande code en plak de **hele** inhoud van `swift.swift`.
4. Druk op ▶ (Uitvoeren) — de Dossiers-pagina verschijnt live.

> Tip: draai de iPad in **landscape** voor de volledige sidebar + tabel.

## In VS Code bekijken

Open `ios-swiftui/swift.swift`. Met de **Swift**-extensie krijg je
highlighting + autocomplete. VS Code kan SwiftUI wel *schrijven* maar niet
*uitvoeren* — draaien doe je in Swift Playgrounds (iPad) of Xcode (Mac).

## Layout

- **Zijbalk:** kerk-icoon + "Uitvaartbeheer", navigatie (Dossiers,
  Begraafplaats, Kisten, Bloemen, Eten, Account), gebruikerskaart onderaan.
- **Bovenbalk:** horizontale navigatie + gebruiker rechtsboven.
- **Dossiers:** grote titel + "Nieuw dossier", zoekbalk + statusfilter +
  Filteren, en een tabel met kolommen Dossier · Overledene · Contactpersoon ·
  Gezinsnr. · Overlijden · Uitvaart · Status · Laatst gewijzigd.

Nog geen data-koppeling — de lijst gebruikt voorbeelddata. De Supabase-koppeling
komt later.
