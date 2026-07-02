import ActivityKit
import Foundation

// Gedeeld data-model voor de Live Activity "Uitvaart vandaag".
// LET OP: dit bestand moet IDENTIEK zijn aan de kopie in de widget-extensie
// (ios-live-activity/UitvaartActivityAttributes.swift). ActivityKit koppelt
// de app-kant en de widget-kant op basis van dit type.
@available(iOS 16.1, *)
struct UitvaartActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Korte statustekst, bv. "Vandaag" of "Bezig".
        var status: String
    }

    // Vast voor de duur van de activity:
    var naam: String        // naam overledene
    var tijd: String        // bv. "12:09"
    var kerk: String        // dienstlocatie
    var eindDatum: Date     // uitvaarttijdstip — voor de live countdown
    var startDatum: Date    // moment waarop de activity startte — voor de voortgangsbalk
    var familie: String     // bv. "Familie Habib"
    var datumLabel: String  // bv. "Vandaag · 14:30"
}
