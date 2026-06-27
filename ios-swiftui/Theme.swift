import SwiftUI

// Kleuren van de app — afgeleid van de web-versie (js/app.js → profielen).
// Bordeaux is de hoofd-/accentkleur van het klooster.
extension Color {
    /// Klooster-bordeaux — hoofdaccent (#6b1e2a).
    static let kloosterBordeaux = Color(red: 0x6b / 255, green: 0x1e / 255, blue: 0x2a / 255)
    /// Tweede profielkleur (#2a5d6b).
    static let kloosterTeal = Color(red: 0x2a / 255, green: 0x5d / 255, blue: 0x6b / 255)
}
