// ============================================================================
//  Uitvaartbeheer — Dossiers-pagina (SwiftUI, iOS/iPadOS 26)
//  Eén-bestand-versie om te plakken in Swift Playgrounds op de iPad.
//
//  ► Zo gebruik je het:
//    1. Open de gratis app "Swift Playgrounds" op je iPad.
//    2. Maak een nieuwe "App".
//    3. Verwijder alle bestaande code en plak DIT hele bestand erin.
//    4. Druk op ▶ (Uitvoeren). Je ziet de Dossiers-pagina live.
//
//  Ontwerp: vaste zijbalk (branding · navigatie · gebruiker) + bovenbalk,
//  en rechts het Dossiers-scherm met een kolomtabel. Bedoeld voor iPad
//  in landscape. Nog geen data-koppeling — er staat voorbeelddata in.
// ============================================================================

import SwiftUI

// MARK: - App-instappunt (Swift Playgrounds heeft dit nodig)

@main
struct UitvaartbeheerApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

// MARK: - Kleuren

extension Color {
    /// Hoofd-accent (knoppen, links, selectie) — ~#2563EB.
    static let merkBlauw = Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255)
    /// Pagina-achtergrond (zacht warmgrijs).
    static let appAchtergrond = Color(red: 246 / 255, green: 246 / 255, blue: 244 / 255)
    /// Zijbalk / kaart-achtergrond.
    static let kaartWit = Color.white
    /// Subtiele randen en scheidingslijnen.
    static let zachteRand = Color(red: 232 / 255, green: 232 / 255, blue: 229 / 255)

    // Statusbadges — achtergrond + tekst per status
    static let statusGroenBg = Color(red: 223 / 255, green: 244 / 255, blue: 229 / 255)
    static let statusGroenTekst = Color(red: 22 / 255, green: 122 / 255, blue: 60 / 255)
    static let statusBlauwBg = Color(red: 226 / 255, green: 236 / 255, blue: 250 / 255)
    static let statusBlauwTekst = Color(red: 30 / 255, green: 90 / 255, blue: 180 / 255)
    static let statusOranjeBg = Color(red: 252 / 255, green: 237 / 255, blue: 214 / 255)
    static let statusOranjeTekst = Color(red: 176 / 255, green: 96 / 255, blue: 12 / 255)
    static let statusGrijsBg = Color(red: 237 / 255, green: 237 / 255, blue: 234 / 255)
    static let statusGrijsTekst = Color(red: 110 / 255, green: 110 / 255, blue: 104 / 255)
}

// MARK: - Datamodel

/// Eén uitvaartdossier. Velden komen overeen met de Supabase-tabel `dossiers`.
struct Dossier: Identifiable, Hashable {
    let id: Int
    var dossierNummer: String
    var voornaam: String
    var achternaam: String
    var contactNaam: String
    var gezinsnummer: String
    var overlijdensdatum: Date?
    var uitvaartdatum: Date?
    var status: DossierStatus
    var bijgewerktDoor: String
    var gewijzigdOp: Date

    var volledigeNaam: String {
        [voornaam, achternaam].filter { !$0.isEmpty }.joined(separator: " ")
    }
}

/// Status van een dossier — bepaalt kleur, achtergrond en symbool van de badge.
enum DossierStatus: String, CaseIterable, Identifiable {
    case nieuw
    case inBehandeling = "in_behandeling"
    case voltooid
    case geannuleerd

    var id: String { rawValue }

    var label: String {
        switch self {
        case .nieuw:         "Nieuw"
        case .inBehandeling: "In behandeling"
        case .voltooid:      "Voltooid"
        case .geannuleerd:   "Geannuleerd"
        }
    }

    var symbool: String {
        switch self {
        case .nieuw:         "sparkle"
        case .inBehandeling: "clock.fill"
        case .voltooid:      "checkmark.circle.fill"
        case .geannuleerd:   "xmark.circle.fill"
        }
    }

    var tekstKleur: Color {
        switch self {
        case .nieuw:         .statusBlauwTekst
        case .inBehandeling: .statusOranjeTekst
        case .voltooid:      .statusGroenTekst
        case .geannuleerd:   .statusGrijsTekst
        }
    }

    var bgKleur: Color {
        switch self {
        case .nieuw:         .statusBlauwBg
        case .inBehandeling: .statusOranjeBg
        case .voltooid:      .statusGroenBg
        case .geannuleerd:   .statusGrijsBg
        }
    }
}

// MARK: - Datum-helpers

extension Date {
    func nl(_ patroon: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nl_NL")
        f.dateFormat = patroon
        return f.string(from: self)
    }

    var relatiefNL: String {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "nl_NL")
        f.unitsStyle = .full
        return f.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - Voorbeelddata

extension Dossier {
    static let voorbeelden: [Dossier] = {
        func d(_ s: String) -> Date? {
            let f = DateFormatter()
            f.locale = Locale(identifier: "nl_NL")
            f.dateFormat = "dd-MM-yyyy HH:mm"
            return f.date(from: s)
        }
        func dagenGeleden(_ n: Int) -> Date {
            Calendar.current.date(byAdding: .day, value: -n, to: Date()) ?? Date()
        }
        return [
            Dossier(id: 2,  dossierNummer: "SOK-2026-0002", voornaam: "Robert", achternaam: "Aktan",
                    contactNaam: "Aktan", gezinsnummer: "001",
                    overlijdensdatum: d("01-05-2026 00:00"), uitvaartdatum: d("20-06-2026 12:09"),
                    status: .voltooid, bijgewerktDoor: "Robert", gewijzigdOp: dagenGeleden(5)),
            Dossier(id: 23, dossierNummer: "SOK-2027-0023", voornaam: "Hanna", achternaam: "Aydın",
                    contactNaam: "Yusuf Aydın", gezinsnummer: "1182",
                    overlijdensdatum: d("09-01-2027 00:00"), uitvaartdatum: d("14-01-2027 11:00"),
                    status: .nieuw, bijgewerktDoor: "Rume", gewijzigdOp: dagenGeleden(1)),
            Dossier(id: 22, dossierNummer: "SOK-2027-0022", voornaam: "Maria", achternaam: "Aksoy",
                    contactNaam: "Elias Aksoy", gezinsnummer: "0934",
                    overlijdensdatum: d("07-01-2027 00:00"), uitvaartdatum: d("12-01-2027 10:30"),
                    status: .inBehandeling, bijgewerktDoor: "Robert", gewijzigdOp: dagenGeleden(2)),
            Dossier(id: 18, dossierNummer: "SOK-2027-0018", voornaam: "Ester", achternaam: "Karagöz",
                    contactNaam: "David Karagöz", gezinsnummer: "0742",
                    overlijdensdatum: d("23-12-2026 00:00"), uitvaartdatum: d("27-12-2026 13:00"),
                    status: .geannuleerd, bijgewerktDoor: "Rume", gewijzigdOp: dagenGeleden(9)),
        ]
    }()
}

// MARK: - Navigatiesecties

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
        case .bloemen:       "camera.macro"
        case .eten:          "fork.knife"
        case .account:       "person.crop.circle"
        }
    }
}

// MARK: - Root

struct RootView: View {
    @State private var sectie: AppSectie = .dossiers

    var body: some View {
        HStack(spacing: 0) {
            Zijbalk(sectie: $sectie)
                .frame(width: 264)

            VStack(spacing: 0) {
                Bovenbalk(sectie: $sectie)
                Divider().overlay(Color.zachteRand)

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
            VStack(spacing: 10) {
                Image(systemName: "building.columns.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(.brown)
                    .frame(width: 64, height: 64)
                    .background(Color.appAchtergrond, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.zachteRand))
                Text("Uitvaartbeheer").font(.title3.bold())
                Text("Syrisch-Orthodoxe Kerk\nvan Antiochië")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 28)
            .padding(.bottom, 24)

            VStack(spacing: 4) {
                ForEach(AppSectie.allCases) { item in
                    Button {
                        sectie = item
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: item.symbool).frame(width: 22)
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

            GebruikerKaart().padding(16)
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

            HStack(spacing: 12) {
                Avatar(initialen: "RA", online: true, formaat: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Robert").font(.subheadline.weight(.semibold))
                    Text("Robert Aktan").font(.caption).foregroundStyle(.secondary)
                }
                Button {
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

// MARK: - Gebruikerskaart

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

// MARK: - Dossiers-scherm

struct DossiersScherm: View {
    @State private var dossiers: [Dossier] = Dossier.voorbeelden
    @State private var zoekterm: String = ""
    @State private var statusFilter: DossierStatus?

    private var gefilterd: [Dossier] {
        dossiers.filter { d in
            let okStatus = statusFilter == nil || d.status == statusFilter
            let okZoek = zoekterm.isEmpty
                || d.volledigeNaam.localizedCaseInsensitiveContains(zoekterm)
                || d.dossierNummer.localizedCaseInsensitiveContains(zoekterm)
                || d.contactNaam.localizedCaseInsensitiveContains(zoekterm)
                || d.gezinsnummer.localizedCaseInsensitiveContains(zoekterm)
            return okStatus && okZoek
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                kop
                zoekRij
                tabelKaart
                footer
            }
            .padding(28)
        }
    }

    private var kop: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Dossiers").font(.system(size: 32, weight: .bold))
                Text("Beheer en overzicht van alle dossiers.")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
            } label: {
                Label("Nieuw dossier", systemImage: "plus")
                    .font(.body.weight(.semibold))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(.merkBlauw)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var zoekRij: some View {
        HStack(spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Zoek op naam, dossiernummer, gezinsnummer, contactpersoon…",
                          text: $zoekterm)
                    .textFieldStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .background(Color.kaartWit, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.zachteRand))

            Menu {
                Button("Alle statussen") { statusFilter = nil }
                Divider()
                ForEach(DossierStatus.allCases) { s in
                    Button(s.label) { statusFilter = s }
                }
            } label: {
                HStack(spacing: 10) {
                    Text(statusFilter?.label ?? "Alle statussen")
                    Image(systemName: "chevron.down").font(.caption.weight(.semibold))
                }
                .foregroundStyle(.primary)
                .padding(.horizontal, 16)
                .padding(.vertical, 15)
                .background(Color.kaartWit, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.zachteRand))
            }

            Button {
            } label: {
                Label("Filteren", systemImage: "line.3.horizontal.decrease")
                    .padding(.horizontal, 16)
                    .padding(.vertical, 15)
                    .background(Color.kaartWit, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.zachteRand))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.primary)
        }
    }

    private var tabelKaart: some View {
        Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 0) {
            GridRow {
                kolomKop("Dossier")
                kolomKop("Overledene")
                kolomKop("Contactpersoon")
                kolomKop("Gezinsnr.")
                kolomKop("Overlijden")
                kolomKop("Uitvaart")
                kolomKop("Status")
                kolomKop("Laatst gewijzigd")
                Text("").frame(width: 14)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)

            Divider().overlay(Color.zachteRand).gridCellColumns(9)

            if gefilterd.isEmpty {
                Text("Geen dossiers gevonden.")
                    .foregroundStyle(.secondary)
                    .padding(20)
                    .gridCellColumns(9)
            } else {
                ForEach(Array(gefilterd.enumerated()), id: \.element.id) { index, dossier in
                    DossierTabelRij(dossier: dossier)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 16)
                    if index < gefilterd.count - 1 {
                        Divider().overlay(Color.zachteRand).gridCellColumns(9)
                    }
                }
            }
        }
        .background(Color.kaartWit, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.zachteRand))
    }

    private func kolomKop(_ titel: String) -> some View {
        Text(titel.uppercased())
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
            .tracking(0.5)
    }

    private var footer: some View {
        Text("Intern systeem · Syrisch-Orthodoxe Kerk van Antiochië · Uitvaartbeheer · "
             + "gegevens veilig opgeslagen in de cloud · Versie 5.19.5 · 2026-06-23")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.top, 24)
    }
}

// MARK: - Eén tabelrij

struct DossierTabelRij: View {
    let dossier: Dossier

    var body: some View {
        GridRow {
            Text(dossier.dossierNummer)
                .font(.callout.weight(.medium))
                .foregroundStyle(Color.merkBlauw)
            Text(dossier.volledigeNaam)
                .font(.callout.weight(.semibold))
            Text(dossier.contactNaam).font(.callout)
            Text(dossier.gezinsnummer).font(.callout)
            Text(dossier.overlijdensdatum?.nl("dd-MM-yyyy") ?? "—").font(.callout)
            Text(dossier.uitvaartdatum?.nl("dd-MM-yyyy HH:mm") ?? "—").font(.callout)
            StatusBadge(status: dossier.status)
            VStack(alignment: .leading, spacing: 2) {
                Text(dossier.gewijzigdOp.relatiefNL).font(.callout)
                Text("- \(dossier.bijgewerktDoor)").font(.caption).foregroundStyle(.secondary)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
                .frame(width: 14)
        }
    }
}

// MARK: - Statusbadge

struct StatusBadge: View {
    let status: DossierStatus

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: status.symbool).font(.caption2)
            Text(status.label).font(.caption.weight(.semibold))
        }
        .foregroundStyle(status.tekstKleur)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(status.bgKleur, in: Capsule())
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
