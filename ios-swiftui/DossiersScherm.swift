import SwiftUI

// MARK: - Dossiers-scherm

/// De inhoud van de sectie "Dossiers": titel + nieuw-knop, een zoek-/filterrij
/// en een tabel met alle dossiers, gevolgd door de footer.
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

    // Titel + subtitel + "Nieuw dossier"
    private var kop: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Dossiers")
                    .font(.system(size: 32, weight: .bold))
                Text("Beheer en overzicht van alle dossiers.")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                // TODO: nieuw dossier aanmaken
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

    // Zoekveld + statusmenu + filterknop
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
                // Filtering gebeurt live; knop is er voor herkenbaarheid t.o.v. web
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

    // Witte kaart met de tabel (kolommen uitgelijnd via Grid)
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

            Text(dossier.contactNaam)
                .font(.callout)
                .foregroundStyle(.primary)

            Text(dossier.gezinsnummer)
                .font(.callout)
                .foregroundStyle(.primary)

            Text(dossier.overlijdensdatum?.nl("dd-MM-yyyy") ?? "—")
                .font(.callout)

            Text(dossier.uitvaartdatum?.nl("dd-MM-yyyy HH:mm") ?? "—")
                .font(.callout)

            StatusBadge(status: dossier.status)

            VStack(alignment: .leading, spacing: 2) {
                Text(dossier.gewijzigdOp.relatiefNL)
                    .font(.callout)
                Text("- \(dossier.bijgewerktDoor)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
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
            Image(systemName: status.symbool)
                .font(.caption2)
            Text(status.label)
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(status.tekstKleur)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(status.bgKleur, in: Capsule())
    }
}

// MARK: - Preview

#Preview("Dossiers-scherm", traits: .landscapeLeft) {
    DossiersScherm()
        .background(Color.appAchtergrond)
}
