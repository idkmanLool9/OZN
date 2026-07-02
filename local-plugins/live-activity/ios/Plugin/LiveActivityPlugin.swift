import Foundation
import Capacitor
import ActivityKit

// Capacitor-plugin dat ActivityKit-Live-Activities start/stopt vanuit de
// webview. De widget-UI zelf zit in een aparte Widget Extension
// (UitvaartLiveActivity). Alles achter @available(iOS 16.1) zodat oudere
// toestellen niet crashen.
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "areEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAll", returnType: CAPPluginReturnPromise)
    ]

    // Zijn Live Activities beschikbaar én door de gebruiker toegestaan?
    @objc func areEnabled(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            call.resolve(["enabled": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["enabled": false])
        }
    }

    // Start een Live Activity voor een uitvaart. Params: naam, tijd, kerk,
    // eindMs (uitvaarttijdstip in ms sinds 1970 — voor de live countdown).
    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else { call.reject("Live Activities vereisen iOS 16.1 of hoger."); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities staan uit voor deze app (Instellingen → Uitvaartbeheer).")
            return
        }
        let naam = call.getString("naam") ?? ""
        let tijd = call.getString("tijd") ?? ""
        let kerk = call.getString("kerk") ?? ""
        let nowMs = Date().timeIntervalSince1970 * 1000
        let eindMs = call.getDouble("eindMs") ?? nowMs
        let start = Date()
        // Voortgangsbalk vereist start < eind; anders een minimale marge.
        var eind = Date(timeIntervalSince1970: eindMs / 1000)
        if eind <= start { eind = start.addingTimeInterval(60) }
        let status = call.getString("status") ?? "Vandaag"

        let attributes = UitvaartActivityAttributes(naam: naam, tijd: tijd, kerk: kerk, eindDatum: eind, startDatum: start)
        let state = UitvaartActivityAttributes.ContentState(status: status)
        do {
            let activity: Activity<UitvaartActivityAttributes>
            if #available(iOS 16.2, *) {
                activity = try Activity.request(attributes: attributes,
                                                content: .init(state: state, staleDate: eind))
            } else {
                activity = try Activity.request(attributes: attributes, contentState: state)
            }
            call.resolve(["id": activity.id])
        } catch {
            call.reject("Kon de Live Activity niet starten: \(error.localizedDescription)")
        }
    }

    // Beëindig alle lopende uitvaart-activities (bv. na de dienst).
    @objc func endAll(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else { call.resolve(); return }
        Task {
            for activity in Activity<UitvaartActivityAttributes>.activities {
                if #available(iOS 16.2, *) {
                    await activity.end(nil, dismissalPolicy: .immediate)
                } else {
                    await activity.end(dismissalPolicy: .immediate)
                }
            }
            call.resolve()
        }
    }
}
