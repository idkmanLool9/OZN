# Live Activity — "Uitvaart vandaag" (lockscreen-widget)

Een live aftel-widget op het vergrendelscherm/Dynamic Island op de dag van
een uitvaart, à la de FlightRadar-vlucht-widget:

> ✝ **Uitvaart vandaag** — Robert Aktan · 12:09 · Maria kathedraal ⏱ 01:32:10

De **widget-UI** is al geschreven (`UitvaartActivityAttributes.swift` +
`UitvaartLiveActivity.swift`). Wat nog moet gebeuren is de **integratie in
het Xcode-project** — dat kan ik hier niet doen/testen, omdat het een echte
native extensie is. Hieronder de exacte stappen.

## Waarom dit apart staat

- Een Live Activity vereist een **Widget Extension**-target in Xcode (aparte
  target náást de app), plus **ActivityKit**.
- Onze Codemagic-build genereert de `ios/`-map **elke keer opnieuw**
  (`npx cap add ios`), waardoor een handmatig toegevoegde extensie verdwijnt.
  Daarom moet de `ios/`-map **gecommit** worden (of een build-script dat de
  extensie injecteert) voordat dit blijvend werkt.

## Integratiestappen (op een Mac met Xcode, of via een gecommitte ios/-map)

1. **`ios/`-map vastleggen** in git (zodat Capacitor 'm niet meer overschrijft):
   pas `codemagic.yaml` aan zodat `npx cap add ios` alleen draait als `ios/`
   nog niet bestaat (staat al zo), en commit de gegenereerde `ios/`-map.
2. In Xcode: **File → New → Target → Widget Extension**, naam bv.
   `UitvaartWidget`, "Include Live Activity" aanvinken.
3. Voeg `UitvaartActivityAttributes.swift` toe aan **zowel de app-target als
   de widget-target** (checkbox Target Membership), en
   `UitvaartLiveActivity.swift` aan de **widget-target**.
4. Zet in de **widget bundle** de `@main` op de widget en registreer
   `UitvaartLiveActivity()`.
5. `NSSupportsLiveActivities = YES` staat al in de app-Info.plist (gezet door
   Codemagic). Zet 'm ook in de widget-Info.plist.
6. **App Group** aanmaken (App IDs → jouw app + de widget) zodat ze data delen,
   en een **provisioning-profiel** voor de widget-target.

## De activity starten/stoppen vanuit de app

De app (webview) moet ActivityKit aanroepen. Dat kan via een klein **eigen
Capacitor-plugin** dat `Activity.request(...)` / `.end(...)` wrapt, of via een
bestaande community-plugin. Voorbeeld-Swift (in dat plugin):

```swift
import ActivityKit

func start(naam: String, tijd: String, kerk: String, eindDatum: Date) {
    let attributes = UitvaartActivityAttributes(naam: naam, tijd: tijd, kerk: kerk, eindDatum: eindDatum)
    let state = UitvaartActivityAttributes.ContentState(status: "Vandaag")
    _ = try? Activity.request(attributes: attributes,
                              content: .init(state: state, staleDate: eindDatum))
}
```

Vanuit JS zou dat er dan zo uitzien (in `js/native.js`):

```js
// Alleen in de app; start een live activity voor de uitvaart van vandaag.
const LA = Capacitor.registerPlugin('LiveActivity');
await LA.start({ naam, tijd, kerk, eindDatum: uitvaartDatum.toISOString() });
```

## Realistische inschatting

- De **widget-UI** (het zichtbare deel) is klaar.
- De **integratie + het start/stop-plugin** vereisen Xcode en een paar
  build-rondes om te testen (kan niet blind). Dit is dé stap die het beste op
  een Mac of met geduldig itereren via Codemagic gebeurt.
