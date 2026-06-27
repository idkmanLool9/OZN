import SwiftUI

// MARK: - Datamodel

/// Eén uitvaartdossier. De velden komen 1-op-1 overeen met de Supabase-tabel
/// `dossiers` uit de web-app (zie js/data.js → DOSSIER_VELDEN). Voor de
/// dossierlijst gebruiken we de kolommen die ook in het web-overzicht staan.
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

    /// Voor- en achternaam samengevoegd ("Robert Aktan").
    var volledigeNaam: String {
        [voornaam, achternaam]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}

// MARK: - Status

/// Status van een dossier — bepaalt kleur, achtergrond en symbool van de badge.
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
    /// Formatteer met een vast patroon in Nederlandse locale, bv. "dd-MM-yyyy".
    func nl(_ patroon: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nl_NL")
        f.dateFormat = patroon
        return f.string(from: self)
    }

    /// Relatieve tijd in het Nederlands, bv. "5 dagen geleden".
    var relatiefNL: String {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "nl_NL")
        f.unitsStyle = .full
        return f.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - Voorbeelddata (voor previews)

extension Dossier {
    /// Tijdelijke voorbeelddossiers zodat de pagina te begrijpen is. In de
    /// echte app komen deze uit Supabase. Het eerste dossier komt overeen met
    /// het voorbeeld uit het ontwerp (Robert Aktan, SOK-2026-0002).
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
