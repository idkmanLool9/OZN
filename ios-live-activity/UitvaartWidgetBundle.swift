import WidgetKit
import SwiftUI

// Instappunt van de Widget Extension. Registreert de Live Activity.
// De extensie heeft deployment target iOS 16.1+, dus geen @available-guards
// nodig hier.
@main
struct UitvaartWidgetBundle: WidgetBundle {
    var body: some Widget {
        UitvaartLiveActivity()
    }
}
