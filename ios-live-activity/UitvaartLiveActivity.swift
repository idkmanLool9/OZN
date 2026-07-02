import ActivityKit
import WidgetKit
import SwiftUI

// Accentkleur — paars, zoals het ontwerp (#6A5AA6).
private let sokPurple = Color(red: 106/255, green: 90/255, blue: 166/255)

// De Live Activity: een gedetailleerde lockscreen-kaart met kop (logo +
// "Live"), de eerstvolgende uitvaart (naam, datum, locatie, familie) en een
// paars aftel-blok. Plus een bijpassende Dynamic Island.
@available(iOS 16.1, *)
struct UitvaartLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: UitvaartActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color(.systemBackground).opacity(0.55))
                .activitySystemActionForegroundColor(sokPurple)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.attributes.datumLabel.isEmpty ? "Vandaag" : context.attributes.datumLabel)
                            .font(.subheadline)
                    } icon: {
                        Image(systemName: "cross.fill").foregroundStyle(sokPurple)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("begint over").font(.caption2).foregroundStyle(.secondary)
                        Text(context.attributes.eindDatum, style: .timer)
                            .font(.title3.weight(.bold)).monospacedDigit()
                            .multilineTextAlignment(.trailing).frame(maxWidth: 92)
                            .foregroundStyle(sokPurple)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.naam).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !context.attributes.kerk.isEmpty {
                        Label(context.attributes.kerk, systemImage: "mappin.and.ellipse")
                            .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            } compactLeading: {
                Image(systemName: "cross.fill").foregroundStyle(sokPurple)
            } compactTrailing: {
                Text(context.attributes.eindDatum, style: .timer)
                    .monospacedDigit().frame(width: 52).foregroundStyle(sokPurple)
            } minimal: {
                Image(systemName: "cross.fill").foregroundStyle(sokPurple)
            }
            .keylineTint(sokPurple)
        }
    }
}

@available(iOS 16.1, *)
private struct LockScreenView: View {
    let context: ActivityViewContext<UitvaartActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Kop: logo + naam-app + Live-badge
            HStack(spacing: 10) {
                Image(systemName: "cross.fill")
                    .font(.title3).foregroundStyle(sokPurple)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Uitvaartbeheer").font(.subheadline.weight(.bold))
                    Text("SOK Antiochië").font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                HStack(spacing: 5) {
                    Circle().fill(sokPurple).frame(width: 7, height: 7)
                    Text("Live").font(.subheadline.weight(.semibold)).foregroundStyle(sokPurple)
                }
                .padding(.horizontal, 11).padding(.vertical, 5)
                .background(sokPurple.opacity(0.12)).clipShape(Capsule())
            }

            // Hoofdinhoud: gegevens links, aftel-blok rechts
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Eerstvolgende uitvaart")
                        .font(.caption.weight(.semibold)).foregroundStyle(sokPurple)
                    Text(context.attributes.naam)
                        .font(.title2.weight(.bold)).lineLimit(1).minimumScaleFactor(0.8)
                    VStack(alignment: .leading, spacing: 6) {
                        if !context.attributes.datumLabel.isEmpty {
                            Label(context.attributes.datumLabel, systemImage: "calendar")
                        }
                        if !context.attributes.kerk.isEmpty {
                            Label(context.attributes.kerk, systemImage: "mappin.and.ellipse").lineLimit(1)
                        }
                        if !context.attributes.familie.isEmpty {
                            Label(context.attributes.familie, systemImage: "person.2.fill").lineLimit(1)
                        }
                    }
                    .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)

                // Paars aftel-blok
                VStack(spacing: 2) {
                    Text("Begint over")
                        .font(.caption2).foregroundStyle(.white.opacity(0.9))
                    Text(context.attributes.eindDatum, style: .timer)
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .monospacedDigit().foregroundStyle(.white)
                        .lineLimit(1).minimumScaleFactor(0.5)
                    Text("uur")
                        .font(.caption2).foregroundStyle(.white.opacity(0.9))
                }
                .frame(width: 104)
                .padding(.vertical, 14)
                .background(sokPurple)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
        .padding(16)
    }
}
