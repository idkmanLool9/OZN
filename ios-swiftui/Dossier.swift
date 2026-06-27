import SwiftUI

// MARK: - Datamodel

/// Eén uitvaartdossier. De velden komen 1-op-1 overeen met de Supabase-tabel
/// `dossiers` uit de web-app (zie js/data.js → DOSSIER_VELDEN). Voor deze
/// eerste SwiftUI-pagina gebruiken we alleen de velden die de lijst toont.
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

    /// Voor- en achternaam samengevoegd ("Hanna Aydın").
    var volledigeNaam: String {
        [voornaam, achternaam]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}

// MARK: - Status

/// Status van een dossier — bepaalt de kleur en het symbool van de badge.
/// De `rawValue` matcht exact de waarden in de web-app/Supabase.
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

// MARK: - Voorbeelddata (voor previews)

extension Dossier {
    /// Tijdelijke voorbeelddossiers zodat de pagina in de Xcode-preview en in
    /// VS Code te begrijpen is. In de echte app komen deze uit Supabase.
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
                    contactNaam: "Yusuf Aydın",   gezinsnummer: "1182",
                    overlijdensdatum: datum("2027-01-09"), uitvaartdatum: datum("2027-01-14"), status: .nieuw),
            Dossier(id: 22, dossierNummer: "2027-0022", voornaam: "Maria",  achternaam: "Aksoy",
                    contactNaam: "Elias Aksoy",   gezinsnummer: "0934",
                    overlijdensdatum: datum("2027-01-07"), uitvaartdatum: datum("2027-01-12"), status: .inBehandeling),
            Dossier(id: 21, dossierNummer: "2027-0021", voornaam: "Aboud",  achternaam: "Demir",
                    contactNaam: "Sara Demir",    gezinsnummer: "1471",
                    overlijdensdatum: datum("2027-01-04"), uitvaartdatum: datum("2027-01-09"), status: .inBehandeling),
            Dossier(id: 20, dossierNummer: "2027-0020", voornaam: "Sara",   achternaam: "Yıldız",
                    contactNaam: "Johannes Yıldız", gezinsnummer: "0588",
                    overlijdensdatum: datum("2027-01-01"), uitvaartdatum: datum("2027-01-05"), status: .voltooid),
            Dossier(id: 19, dossierNummer: "2027-0019", voornaam: "Jakob",  achternaam: "Bakırcı",
                    contactNaam: "Maria Bakırcı", gezinsnummer: "1203",
                    overlijdensdatum: datum("2026-12-26"), uitvaartdatum: datum("2026-12-30"), status: .voltooid),
            Dossier(id: 18, dossierNummer: "2027-0018", voornaam: "Ester",  achternaam: "Karagöz",
                    contactNaam: "David Karagöz", gezinsnummer: "0742",
                    overlijdensdatum: datum("2026-12-23"), uitvaartdatum: datum("2026-12-27"), status: .geannuleerd),
            Dossier(id: 17, dossierNummer: "2027-0017", voornaam: "David",  achternaam: "Çetin",
                    contactNaam: "Hanna Çetin",   gezinsnummer: "1659",
                    overlijdensdatum: datum("2026-12-18"), uitvaartdatum: datum("2026-12-22"), status: .voltooid),
        ]
    }()
}
