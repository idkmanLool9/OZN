// ============================================================================
//  Uitvaartbeheer — Dossiers-pagina (SwiftUI, iOS/iPadOS 26)
//  Eén-bestand-versie om te plakken in Swift Playgrounds op de iPad.
//
//  ► Zo gebruik je het:
//    1. Open de gratis app "Swift Playgrounds" op je iPad.
//    2. Maak een nieuwe "App"  (of "Lege playground").
//    3. Verwijder alle bestaande code en plak DIT hele bestand erin.
//    4. Druk op ▶ (Uitvoeren). Je ziet de Dossiers-pagina live.
// ============================================================================

import SwiftUI

// MARK: - App-instappunt (Swift Playgrounds heeft dit nodig)

@main
struct UitvaartbeheerApp: App {
    var body: some Scene {
        WindowGroup {
            DossierListView()
        }
    }
}

// MARK: - Kleuren

extension Color {
    /// Klooster-bordeaux — hoofdaccent (#6b1e2a).
    static let kloosterBordeaux = Color(red: 0x6b / 255, green: 0x1e / 255, blue: 0x2a / 255)
    /// Tweede profielkleur (#2a5d6b).
    static let kloosterTeal = Color(red: 0x2a / 255, green: 0x5d / 255, blue: 0x6b / 255)
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

    var volledigeNaam: String {
        [voornaam, achternaam].filter { !$0.isEmpty }.joined(separator: " ")
    }
}

/// Status van een dossier — bepaalt kleur en symbool van de badge.
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

    var kleur: Color {
        switch self {
        case .nieuw:         .blue
        case .inBehandeling: .orange
        case .voltooid:      .green
        case .geannuleerd:   .secondary
        }
    }

    var symbool: String {
        switch self {
        case .nieuw:         "sparkles"
        case .inBehandeling: "clock.fill"
        case .voltooid:      "checkmark.circle.fill"
        case .geannuleerd:   "xmark.circle.fill"
        }
    }
}

// MARK: - Voorbeelddata

extension Dossier {
    static let voorbeelden: [Dossier] = {
        func datum(_ s: String) -> Date? {
            let f = DateFormatter()
            f.calendar = Calendar(identifier: .gregorian)
            f.locale = Locale(identifier: "nl_NL")
            f.dateFormat = "yyyy-MM-dd"
            return f.date(from: s)
        }
        return [
            Dossier(id: 23, dossierNummer: "2027-0023", voornaam: "Hanna",  achternaam: "Aydın",
                    contactNaam: "Yusuf Aydın",     gezinsnummer: "1182",
                    overlijdensdatum: datum("2027-01-09"), uitvaartdatum: datum("2027-01-14"), status: .nieuw),
            Dossier(id: 22, dossierNummer: "2027-0022", voornaam: "Maria",  achternaam: "Aksoy",
                    contactNaam: "Elias Aksoy",     gezinsnummer: "0934",
                    overlijdensdatum: datum("2027-01-07"), uitvaartdatum: datum("2027-01-12"), status: .inBehandeling),
            Dossier(id: 21, dossierNummer: "2027-0021", voornaam: "Aboud",  achternaam: "Demir",
                    contactNaam: "Sara Demir",      gezinsnummer: "1471",
                    overlijdensdatum: datum("2027-01-04"), uitvaartdatum: datum("2027-01-09"), status: .inBehandeling),
            Dossier(id: 20, dossierNummer: "2027-0020", voornaam: "Sara",   achternaam: "Yıldız",
                    contactNaam: "Johannes Yıldız", gezinsnummer: "0588",
                    overlijdensdatum: datum("2027-01-01"), uitvaartdatum: datum("2027-01-05"), status: .voltooid),
            Dossier(id: 19, dossierNummer: "2027-0019", voornaam: "Jakob",  achternaam: "Bakırcı",
                    contactNaam: "Maria Bakırcı",   gezinsnummer: "1203",
                    overlijdensdatum: datum("2026-12-26"), uitvaartdatum: datum("2026-12-30"), status: .voltooid),
            Dossier(id: 18, dossierNummer: "2027-0018", voornaam: "Ester",  achternaam: "Karagöz",
                    contactNaam: "David Karagöz",   gezinsnummer: "0742",
                    overlijdensdatum: datum("2026-12-23"), uitvaartdatum: datum("2026-12-27"), status: .geannuleerd),
            Dossier(id: 17, dossierNummer: "2027-0017", voornaam: "David",  achternaam: "Çetin",
                    contactNaam: "Hanna Çetin",     gezinsnummer: "1659",
                    overlijdensdatum: datum("2026-12-18"), uitvaartdatum: datum("2026-12-22"), status: .voltooid),
        ]
    }()
}

// MARK: - Dossiers-pagina

struct DossierListView: View {
    @State private var dossiers: [Dossier] = Dossier.voorbeelden
    @State private var zoekterm: String = ""
    @State private var filter: DossierStatus?   // nil = alle statussen
    @State private var selectie: Dossier.ID?

    private var gefilterd: [Dossier] {
        dossiers.filter { d in
            let okStatus = filter == nil || d.status == filter
            let okZoek = zoekterm.isEmpty
                || d.volledigeNaam.localizedCaseInsensitiveContains(zoekterm)
                || d.dossierNummer.localizedCaseInsensitiveContains(zoekterm)
                || d.contactNaam.localizedCaseInsensitiveContains(zoekterm)
                || d.gezinsnummer.localizedCaseInsensitiveContains(zoekterm)
            return okStatus && okZoek
        }
    }

    var body: some View {
        NavigationSplitView {
            // Sidebar (iPad): statusfilters
            List(selection: $filter) {
                Label("Alle dossiers", systemImage: "tray.full")
                    .tag(DossierStatus?.none)

                Section("Status") {
                    ForEach(DossierStatus.allCases) { status in
                        Label(status.label, systemImage: status.symbool)
                            .tag(DossierStatus?.some(status))
                    }
                }
            }
            .navigationTitle("Filter")
        } content: {
            // Middenkolom: lijst van dossiers
            List(gefilterd, selection: $selectie) { dossier in
                DossierRow(dossier: dossier)
            }
            .navigationTitle("Dossiers")
            .searchable(text: $zoekterm, prompt: "Zoek op naam, nummer, contact…")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        // TODO: nieuw dossier aanmaken
                    } label: {
                        Label("Nieuw dossier", systemImage: "plus")
                    }
                }
            }
            .overlay {
                if gefilterd.isEmpty {
                    ContentUnavailableView.search(text: zoekterm)
                }
            }
        } detail: {
            // Detail van geselecteerd dossier
            if let id = selectie, let dossier = dossiers.first(where: { $0.id == id }) {
                DossierDetailView(dossier: dossier)
            } else {
                ContentUnavailableView(
                    "Kies een dossier",
                    systemImage: "doc.text",
                    description: Text("Selecteer links een dossier om de details te zien.")
                )
            }
        }
        .tint(.kloosterBordeaux)
    }
}

// MARK: - Rij in de lijst

struct DossierRow: View {
    let dossier: Dossier

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(dossier.volledigeNaam.isEmpty ? "—" : dossier.volledigeNaam)
                    .font(.headline)
                Text(ondertitel)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            StatusBadge(status: dossier.status)
        }
        .padding(.vertical, 4)
    }

    private var ondertitel: String {
        var delen = [dossier.dossierNummer]
        if let u = dossier.uitvaartdatum {
            delen.append("Uitvaart " + u.formatted(.dateTime.day().month(.abbreviated)))
        }
        return delen.joined(separator: " · ")
    }
}

// MARK: - Statusbadge

struct StatusBadge: View {
    let status: DossierStatus

    var body: some View {
        Label(status.label, systemImage: status.symbool)
            .labelStyle(.titleAndIcon)
            .font(.caption.weight(.semibold))
            .foregroundStyle(status.kleur)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(status.kleur.opacity(0.15), in: Capsule())
    }
}

// MARK: - Detail

struct DossierDetailView: View {
    let dossier: Dossier

    var body: some View {
        Form {
            Section {
                LabeledContent("Naam", value: dossier.volledigeNaam)
                LabeledContent("Dossiernummer", value: dossier.dossierNummer)
                LabeledContent("Gezinsnummer", value: dossier.gezinsnummer)
            }
            Section("Belangrijke data") {
                if let o = dossier.overlijdensdatum {
                    LabeledContent("Overlijden", value: o.formatted(date: .long, time: .omitted))
                }
                if let u = dossier.uitvaartdatum {
                    LabeledContent("Uitvaart", value: u.formatted(date: .long, time: .omitted))
                }
            }
            Section("Contactpersoon") {
                LabeledContent("Naam", value: dossier.contactNaam)
            }
            Section("Status") {
                StatusBadge(status: dossier.status)
            }
        }
        .navigationTitle(dossier.volledigeNaam)
        .navigationBarTitleDisplayMode(.inline)
    }
}
