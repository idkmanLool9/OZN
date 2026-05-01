// Factuur / eindafrekening — printbare layout per dossier

function renderFactuur(params) {
  const id = parseInt(params.id, 10);
  const d = DB.byId(KEYS.DOSSIERS, id);
  if (!d) return render404();

  const kosten = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const betaald = kosten.filter(k => k.betaald).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const verzekerd = d.verzekering_status === 'met verzekering';
  const gedektTotaal = kosten.filter(k => k.gedekt).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const familieTotaal = totaal - gedektTotaal;
  const aanbetaling = Number(d.aanbetaling_bedrag) || 0;
  const teBetalen = familieTotaal - aanbetaling;

  const s = Settings.all();
  const orgNaam = s.app_name + ' — ' + s.app_tagline;

  $('#view').innerHTML = `
    <div class="page factuur-page">
      <div class="page-head no-print">
        <div>
          <a href="#/dossiers/${d.id}" class="back-link">← Terug naar dossier</a>
          <h1>Factuur / eindafrekening</h1>
          <p class="muted">Dossier <strong>${esc(d.dossier_nummer)}</strong></p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-primary" id="btn-factuur-print">📄 Printen / opslaan als PDF</button>
        </div>
      </div>

      <div class="factuur-doc">
        <div class="factuur-header">
          <div>
            <h2 style="border:none;padding:0;margin:0;font-size:1.4rem;">${esc(s.app_name)}</h2>
            <p style="margin:.15rem 0;font-size:.9rem;color:var(--muted);">${esc(s.app_tagline)}</p>
          </div>
          <div class="factuur-meta">
            <p style="margin:0;"><strong>FACTUUR</strong></p>
            <p style="margin:.1rem 0;">Dossier: ${esc(d.dossier_nummer)}</p>
            <p style="margin:.1rem 0;">Datum: ${new Date().toLocaleDateString('nl-NL')}</p>
          </div>
        </div>

        <div class="factuur-parties">
          <div class="factuur-party">
            <strong>Voor:</strong>
            <div>${esc(d.opdrachtgever_naam || d.contact_naam || '—')}</div>
            <div class="muted small">${esc([d.contact_adres, d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(', ') || '')}</div>
            ${d.opdrachtgever_telefoon ? `<div class="muted small">Tel: ${esc(d.opdrachtgever_telefoon)}</div>` : ''}
          </div>
          <div class="factuur-party">
            <strong>Betreft:</strong>
            <div>Uitvaart van ${esc(fullName(d) || '—')}</div>
            <div class="muted small">${d.overlijdensdatum ? 'Overleden ' + esc(fmtDate(d.overlijdensdatum)) : ''}</div>
            <div class="muted small">${d.uitvaart_datum ? 'Uitvaart ' + esc(fmtDate(d.uitvaart_datum)) : ''}</div>
          </div>
        </div>

        ${verzekerd ? `
          <div class="factuur-verzekering">
            <strong>Via verzekering:</strong> ${esc(d.verzekering_maatschappij || '—')}${d.polisnummer ? ' — polisnummer ' + esc(d.polisnummer) : ''}${d.verzekering_pakket ? ' — ' + esc(d.verzekering_pakket) : ''}
          </div>` : ''}

        <table class="factuur-table">
          <thead>
            <tr>
              <th>Omschrijving</th>
              <th>Categorie</th>
              ${verzekerd ? '<th class="center">Gedekt</th>' : ''}
              <th class="num">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            ${kosten.length === 0
              ? `<tr><td colspan="${verzekerd ? 4 : 3}" class="muted center">Nog geen kostenposten geregistreerd.</td></tr>`
              : kosten.map(k => `<tr>
                  <td>${esc(k.omschrijving)}</td>
                  <td class="muted small">${esc(k.categorie || '')}</td>
                  ${verzekerd ? `<td class="center">${k.gedekt ? '✓' : ''}</td>` : ''}
                  <td class="num">${fmtEUR(k.bedrag)}</td>
                </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="${verzekerd ? 3 : 2}" class="num"><strong>Totaal</strong></td>
              <td class="num"><strong>${fmtEUR(totaal)}</strong></td>
            </tr>
            ${verzekerd ? `
              <tr>
                <td colspan="3" class="num muted">Gedekt door verzekering</td>
                <td class="num muted">- ${fmtEUR(gedektTotaal)}</td>
              </tr>
              <tr class="factuur-totalrow">
                <td colspan="3" class="num"><strong>Door familie te betalen</strong></td>
                <td class="num"><strong>${fmtEUR(familieTotaal)}</strong></td>
              </tr>
            ` : ''}
            ${aanbetaling > 0 ? `
              <tr>
                <td colspan="${verzekerd ? 3 : 2}" class="num muted">Aanbetaling${d.aanbetaling_datum ? ' (' + fmtDate(d.aanbetaling_datum) + ')' : ''}</td>
                <td class="num muted">- ${fmtEUR(aanbetaling)}</td>
              </tr>
              <tr class="factuur-totalrow">
                <td colspan="${verzekerd ? 3 : 2}" class="num"><strong>Nog te voldoen</strong></td>
                <td class="num"><strong>${fmtEUR(teBetalen)}</strong></td>
              </tr>
            ` : ''}
          </tfoot>
        </table>

        ${(d.betalingstermijn || d.betaalwijze || d.eindafrekening_status) ? `
          <div class="factuur-betaling">
            <strong>Betalingsafspraken</strong>
            ${d.betaalwijze ? `<div>Betaalwijze: ${esc(d.betaalwijze)}</div>` : ''}
            ${d.betalingstermijn ? `<div>Termijn: ${esc(d.betalingstermijn)}</div>` : ''}
            ${d.eindafrekening_status ? `<div>Status: ${esc(d.eindafrekening_status)}</div>` : ''}
            ${d.verantwoordelijke_persoon ? `<div>Verantwoordelijke: ${esc(d.verantwoordelijke_persoon)}</div>` : ''}
          </div>` : ''}

        <p class="factuur-footer muted small">
          Voor vragen over deze factuur kunt u contact opnemen met de uitvaartleider.
        </p>
      </div>
    </div>`;

  $('#btn-factuur-print').addEventListener('click', () => window.print());
}
