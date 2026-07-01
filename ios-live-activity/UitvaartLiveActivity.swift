import ActivityKit
import WidgetKit
import SwiftUI

// De Live Activity zelf: lockscreen-banner + Dynamic Island.
// Toont "Uitvaart vandaag — {naam} · {tijd} · {kerk}" met een live
// aftel-timer tot het uitvaarttijdstip.
struct UitvaartLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: UitvaartActivityAttributes.self) { context in
            // ── Lockscreen / banner ──
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "cross.fill")
                    Text("Uitvaart vandaag").font(.caption).bold()
                    Spacer()
                    Text(context.attributes.eindDatum, style: .timer)
                        .font(.caption).monospacedDigit()
                }
                Text(context.attributes.naam).font(.headline)
                Text("\(context.attributes.tijd) · \(context.attributes.kerk)")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding()
            .activityBackgroundTint(Color(red: 37/255, green: 99/255, blue: 235/255).opacity(0.18))

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "cross.fill")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.eindDatum, style: .timer)
                        .monospacedDigit().frame(maxWidth: 56)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.naam).font(.headline)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("\(context.attributes.tijd) · \(context.attributes.kerk)")
                        .font(.caption).foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "cross.fill")
            } compactTrailing: {
                Text(context.attributes.eindDatum, style: .timer)
                    .monospacedDigit().frame(width: 44)
            } minimal: {
                Image(systemName: "cross.fill")
            }
        }
    }
}
