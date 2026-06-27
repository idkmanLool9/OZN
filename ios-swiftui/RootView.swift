import SwiftUI

// MARK: - Navigatiesecties

/// De hoofdsecties van de app — verschijnen in de zijbalk én de bovenbalk.
enum AppSectie: String, CaseIterable, Identifiable {
    case dossiers, begraafplaats, kisten, bloemen, eten, account

    var id: String { rawValue }

    var titel: String {
        switch self {
        case .dossiers:      "Dossiers"
        case .begraafplaats: "Begraafplaats"
        case .kisten:        "Kisten"
        case .bloemen:       "Bloemen"
        case .eten:          "Eten"
        case .account:       "Account"
        }
    }

    var symbool: String {
        switch self {
        case .dossiers:      "folder"
        case .begraafplaats: "mappin.and.ellipse"
        case .kisten:        "shippingbox"
        case .bloemen:       "camera.macro"     // bloem-achtig SF Symbool
        case .eten:          "fork.knife"
        case .account:       "person.crop.circle"
        }
    }
}

// MARK: - Root

/// Het hoofdscherm: een vaste zijbalk links + een werkgebied rechts met een
/// bovenbalk en de inhoud van de gekozen sectie. Opgezet voor iPad/landscape
/// (en Mac via Catalyst), net als het web-ontwerp.
struct RootView: View {
    @State private var sectie: AppSectie = .dossiers

    var body: some View {
        HStack(spacing: 0) {
            Zijbalk(sectie: $sectie)
                .frame(width: 264)

            VStack(spacing: 0) {
                Bovenbalk(sectie: $sectie)
                Divider().overlay(Color.zachteRand)

                // Inhoud van de gekozen sectie
                switch sectie {
                case .dossiers:
                    DossiersScherm()
                default:
                    PlaceholderScherm(sectie: sectie)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.appAchtergrond)
        }
        .tint(.merkBlauw)
        .background(Color.appAchtergrond)
    }
}

// MARK: - Zijbalk

struct Zijbalk: View {
    @Binding var sectie: AppSectie

    var body: some View {
        VStack(spacing: 0) {
            // Merk-header
            VStack(spacing: 10) {
                Image(systemName: "building.columns.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(.brown)
                    .frame(width: 64, height: 64)
                    .background(Color.appAchtergrond, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.zachteRand))
                Text("Uitvaartbeheer")
                    .font(.title3.bold())
                Text("Syrisch-Orthodoxe Kerk\nvan Antiochië")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 28)
            .padding(.bottom, 24)

            // Navigatie
            VStack(spacing: 4) {
                ForEach(AppSectie.allCases) { item in
                    Button {
                        sectie = item
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: item.symbool)
                                .frame(width: 22)
                            Text(item.titel)
                            Spacer()
                        }
                        .font(.body.weight(sectie == item ? .semibold : .regular))
                        .foregroundStyle(sectie == item ? Color.merkBlauw : Color.primary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        .background(
                            sectie == item ? Color.merkBlauw.opacity(0.10) : .clear,
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)

            Spacer()

            // Gebruikerskaart onderaan
            GebruikerKaart()
                .padding(16)
        }
        .frame(maxHeight: .infinity)
        .background(Color.kaartWit)
        .overlay(alignment: .trailing) {
            Rectangle().fill(Color.zachteRand).frame(width: 1)
        }
    }
}

// MARK: - Bovenbalk

struct Bovenbalk: View {
    @Binding var sectie: AppSectie

    var body: some View {
        HStack(spacing: 6) {
            ForEach(AppSectie.allCases) { item in
                Button {
                    sectie = item
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: item.symbool)
                        Text(item.titel)
                    }
                    .font(.subheadline.weight(sectie == item ? .semibold : .regular))
                    .foregroundStyle(sectie == item ? Color.merkBlauw : Color.secondary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(
                        sectie == item ? Color.merkBlauw.opacity(0.10) : .clear,
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
            }

            Spacer()

            // Gebruiker rechtsboven
            HStack(spacing: 12) {
                Avatar(initialen: "RA", online: true, formaat: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Robert").font(.subheadline.weight(.semibold))
                    Text("Robert Aktan").font(.caption).foregroundStyle(.secondary)
                }
                Button {
                    // TODO: uitloggen
                } label: {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .padding(10)
                        .background(Color.kaartWit, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.zachteRand))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color.kaartWit)
    }
}

// MARK: - Gebruikerskaart (zijbalk onderaan)

struct GebruikerKaart: View {
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Avatar(initialen: "RA", online: true, formaat: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Robert Aktan").font(.subheadline.weight(.semibold))
                    Text("robert@antiochie.nl").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            Button {
                // TODO: uitloggen
            } label: {
                Label("Uitloggen", systemImage: "rectangle.portrait.and.arrow.right")
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.appAchtergrond, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.primary)
        }
        .padding(14)
        .background(Color.kaartWit, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.zachteRand))
    }
}

// MARK: - Avatar

struct Avatar: View {
    let initialen: String
    var online: Bool = false
    var formaat: CGFloat = 40

    var body: some View {
        Text(initialen)
            .font(.system(size: formaat * 0.4, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: formaat, height: formaat)
            .background(Color.merkBlauw, in: Circle())
            .overlay(alignment: .bottomTrailing) {
                if online {
                    Circle()
                        .fill(.green)
                        .frame(width: formaat * 0.28, height: formaat * 0.28)
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                }
            }
    }
}

// MARK: - Placeholder voor nog niet gebouwde secties

struct PlaceholderScherm: View {
    let sectie: AppSectie

    var body: some View {
        ContentUnavailableView(
            sectie.titel,
            systemImage: sectie.symbool,
            description: Text("Dit scherm wordt later gebouwd.")
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Preview

#Preview("iPad", traits: .landscapeLeft) {
    RootView()
}
