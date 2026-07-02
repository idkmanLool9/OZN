import ActivityKit
import WidgetKit
import SwiftUI

// Accentkleuren — paars (#6A5AA6) voor de lichte lockscreen-kaart, en een
// lichtere variant voor de zwarte Dynamic Island.
private let sokPurple = Color(red: 106/255, green: 90/255, blue: 166/255)
private let sokPurpleLight = Color(red: 173/255, green: 158/255, blue: 226/255)

// Live Activity: compacte, goed leesbare lockscreen-kaart + Dynamic Island.
@available(iOS 16.1, *)
struct UitvaartLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: UitvaartActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color(.systemBackground).opacity(0.94))
                .activitySystemActionForegroundColor(sokPurple)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.attributes.datumLabel.isEmpty ? "Vandaag" : context.attributes.datumLabel)
                            .font(.subheadline)
                    } icon: {
                        Image(systemName: "cross.fill").foregroundStyle(sokPurpleLight)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("begint over").font(.caption2).foregroundStyle(.secondary)
                        Text(context.attributes.eindDatum, style: .timer)
                            .font(.title3.weight(.bold)).monospacedDigit()
                            .multilineTextAlignment(.trailing).frame(maxWidth: 92)
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
                Image(systemName: "cross.fill").foregroundStyle(sokPurpleLight)
            } compactTrailing: {
                Text(context.attributes.eindDatum, style: .timer)
                    .monospacedDigit().frame(width: 52)
            } minimal: {
                Image(systemName: "cross.fill").foregroundStyle(sokPurpleLight)
            }
            .keylineTint(sokPurple)
        }
    }
}

@available(iOS 16.1, *)
private struct LockScreenView: View {
    let context: ActivityViewContext<UitvaartActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            // Kop (compact, één regel) + Live-badge
            HStack(spacing: 7) {
                Image(systemName: "cross.fill").font(.subheadline).foregroundStyle(sokPurple)
                Text("Uitvaart Intake").font(.subheadline.weight(.bold)).foregroundStyle(.primary)
                Text("· SOK Antiochië").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                Spacer(minLength: 4)
                HStack(spacing: 5) {
                    Circle().fill(sokPurple).frame(width: 7, height: 7)
                    Text("Live").font(.caption.weight(.bold)).foregroundStyle(sokPurple)
                }
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(sokPurple.opacity(0.16)).clipShape(Capsule())
            }

            // Inhoud: gegevens links, aftel-blok rechts
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(context.attributes.naam)
                        .font(.title3.weight(.bold)).foregroundStyle(.primary)
                        .lineLimit(1).minimumScaleFactor(0.8)
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
                .font(.footnote)
                .foregroundStyle(.secondary)

                Spacer(minLength: 0)

                // Paars aftel-blok
                VStack(spacing: 1) {
                    Text("Begint over").font(.caption2).foregroundStyle(.white.opacity(0.9))
                    Text(context.attributes.eindDatum, style: .timer)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .monospacedDigit().foregroundStyle(.white)
                        .lineLimit(1).minimumScaleFactor(0.5)
                    Text("uur").font(.caption2).foregroundStyle(.white.opacity(0.9))
                }
                .frame(width: 100)
                .padding(.vertical, 11)
                .background(sokPurple)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        .padding(14)
    }
}
