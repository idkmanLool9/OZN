import SwiftUI

// MARK: - Dossiers-pagina
//
// iOS/iPadOS 26. Op de iPad een drie-koloms NavigationSplitView
// (filter-sidebar · dossierlijst · detail); op de iPhone klapt dezelfde
// structuur automatisch in tot een gewone navigatie-stack.

struct DossierListView: View {
    @State private var dossiers: [Dossier] = Dossier.voorbeelden
    @State private var zoekterm: String = ""
    @State private var filter: DossierStatus?   // nil = alle statussen
    @State private var selectie: Dossier.ID?

    /// Lijst na toepassing van het statusfilter + de zoekterm.
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
            // ── Sidebar (iPad): statusfilters ──────────────────────────
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
            // ── Middenkolom: lijst van dossiers ────────────────────────
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
            // ── Detail van het geselecteerde dossier ───────────────────
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

    /// "2027-0023 · Uitvaart 14 jan"
    private var ondertitel: String {
        var delen = [dossier.dossierNummer]
        if let u = dossier.uitvaartdatum {
            delen.append("Uitvaart " + u.formatted(.dateTime.day().month(.abbreviated)))
        }
        return delen.joined(separator: " · ")
    }
}

// MARK: - Statusbadge (Capsule)

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

// MARK: - Detail (eenvoudig — wordt later uitgebreid)

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

// MARK: - Previews

#Preview("iPhone") {
    DossierListView()
}

#Preview("iPad", traits: .landscapeLeft) {
    DossierListView()
}
