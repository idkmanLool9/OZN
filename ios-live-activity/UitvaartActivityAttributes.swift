import ActivityKit
import Foundation

// Data-model voor de Live Activity "Uitvaart vandaag".
// De vaste velden (naam/tijd/kerk/eindDatum) staan in de attributes;
// wat live verandert (bv. de statustekst) staat in ContentState.
struct UitvaartActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Korte statustekst, bv. "Over 2 uur" of "Bezig".
        var status: String
    }

    // Vast voor de duur van de activity:
    var naam: String        // naam overledene
    var tijd: String        // bv. "12:09"
    var kerk: String        // dienstlocatie
    var eindDatum: Date     // uitvaarttijdstip — voor de live countdown
}
