import SwiftUI

// App-startpunt. Wijst naar RootView (zijbalk + dossiers-scherm).
// In Xcode hoort dit bestand bij een iOS App-target met deze map als bron.
@main
struct UitvaartbeheerApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
