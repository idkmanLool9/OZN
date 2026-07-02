import ActivityKit
import WidgetKit
import SwiftUI

// Accentkleur (#2563eb) — als bestandsniveau-constante zodat we 'm overal
// in de ViewBuilder kunnen gebruiken.
private let sokBlue = Color(red: 37/255, green: 99/255, blue: 235/255)

// De Live Activity: een ruime, gedetailleerde lockscreen-banner + Dynamic
// Island. Toont "Uitvaart vandaag — {naam}" met een grote live aftel-timer
// tot het uitvaarttijdstip, plus tijd en locatie met iconen.
@available(iOS 16.1, *)
struct UitvaartLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: UitvaartActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(sokBlue.opacity(0.10))
                .activitySystemActionForegroundColor(sokBlue)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.attributes.tijd.isEmpty ? "Uitvaart" : context.attributes.tijd)
                            .font(.headline)
                    } icon: {
                        Image(systemName: "cross.fill").foregroundStyle(sokBlue)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("nog").font(.caption2).foregroundStyle(.secondary)
                        Text(context.attributes.eindDatum, style: .timer)
                            .font(.title3.weight(.bold)).monospacedDigit()
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 90)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.naam)
                        .font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        if !context.attributes.kerk.isEmpty {
                            Label(context.attributes.kerk, systemImage: "mappin.and.ellipse")
                                .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                        }
                        ProgressView(timerInterval: context.attributes.startDatum...context.attributes.eindDatum,
                                     countsDown: false) {
                            EmptyView()
                        } currentValueLabel: {
                            EmptyView()
                        }
                        .progressViewStyle(.linear)
                        .tint(sokBlue)
                    }
                }
            } compactLeading: {
                Image(systemName: "cross.fill").foregroundStyle(sokBlue)
            } compactTrailing: {
                Text(context.attributes.eindDatum, style: .timer)
                    .monospacedDigit().frame(width: 52).foregroundStyle(sokBlue)
            } minimal: {
                Image(systemName: "cross.fill").foregroundStyle(sokBlue)
            }
            .keylineTint(sokBlue)
        }
    }
}

// Ruime lockscreen-/bannerweergave.
@available(iOS 16.1, *)
private struct LockScreenView: View {
    let context: ActivityViewContext<UitvaartActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Kop: kruis + "Uitvaart vandaag" + status-badge
            HStack(spacing: 7) {
                Image(systemName: "cross.fill")
                    .font(.subheadline).foregroundStyle(sokBlue)
                Text("Uitvaart vandaag")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(sokBlue)
                Spacer()
                Text(context.state.status)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(sokBlue.opacity(0.15))
                    .foregroundStyle(sokBlue)
                    .clipShape(Capsule())
            }

            // Naam overledene — groot
            Text(context.attributes.naam)
                .font(.title2.weight(.bold))
                .lineLimit(1).minimumScaleFactor(0.8)

            // Grote live afteltimer
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("nog")
                    .font(.callout).foregroundStyle(.secondary)
                Text(context.attributes.eindDatum, style: .timer)
                    .font(.system(size: 38, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.primary)
                Spacer()
            }

            // Live voortgangsbalk richting het uitvaarttijdstip
            ProgressView(timerInterval: context.attributes.startDatum...context.attributes.eindDatum,
                         countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.linear)
            .tint(sokBlue)

            // Detailregels: tijd + locatie met iconen
            HStack(spacing: 18) {
                if !context.attributes.tijd.isEmpty {
                    Label(context.attributes.tijd, systemImage: "clock.fill")
                        .labelStyle(.titleAndIcon)
                }
                if !context.attributes.kerk.isEmpty {
                    Label(context.attributes.kerk, systemImage: "mappin.and.ellipse")
                        .labelStyle(.titleAndIcon)
                        .lineLimit(1)
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(18)
    }
}
