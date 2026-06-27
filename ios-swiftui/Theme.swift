import SwiftUI

// Kleuren van de app — afgeleid van de huidige web-versie. Het hoofdaccent
// is blauw (knoppen, links, geselecteerde navigatie); de statusbadges
// gebruiken zachte achtergronden met een verzadigde tekstkleur.
extension Color {
    /// Hoofd-accent (knoppen, links, selectie) — ~#2563EB.
    static let merkBlauw = Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255)

    /// Pagina-achtergrond (zacht warmgrijs).
    static let appAchtergrond = Color(red: 246 / 255, green: 246 / 255, blue: 244 / 255)
    /// Zijbalk / kaart-achtergrond.
    static let kaartWit = Color.white
    /// Subtiele randen en scheidingslijnen.
    static let zachteRand = Color(red: 232 / 255, green: 232 / 255, blue: 229 / 255)

    // Statusbadges — achtergrond + tekst per status
    static let statusGroenBg = Color(red: 223 / 255, green: 244 / 255, blue: 229 / 255)
    static let statusGroenTekst = Color(red: 22 / 255, green: 122 / 255, blue: 60 / 255)
    static let statusBlauwBg = Color(red: 226 / 255, green: 236 / 255, blue: 250 / 255)
    static let statusBlauwTekst = Color(red: 30 / 255, green: 90 / 255, blue: 180 / 255)
    static let statusOranjeBg = Color(red: 252 / 255, green: 237 / 255, blue: 214 / 255)
    static let statusOranjeTekst = Color(red: 176 / 255, green: 96 / 255, blue: 12 / 255)
    static let statusGrijsBg = Color(red: 237 / 255, green: 237 / 255, blue: 234 / 255)
    static let statusGrijsTekst = Color(red: 110 / 255, green: 110 / 255, blue: 104 / 255)
}
