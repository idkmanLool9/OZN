// Factuur / eindafrekening — printbare layout per dossier

// HTML-blok van het factuur-document (zonder page-acties). Ook gebruikt
// door PdfGen om een PDF-bijlage te maken voor de mail-verstuurder.
function buildFactuurDocHTML(d, kosten) {
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const verzekerd = d.verzekering_status === 'met verzekering';
  const dekkingInfo   = computeDekking(kosten, d, Settings.all());
  const verzDekking   = Number(d.verzekering_dekking) || 0;
  const gedektTotaal  = dekkingInfo.dekking;
  const familieTotaal = Math.max(0, totaal - gedektTotaal);
  const aanbetaling   = Number(d.aanbetaling_bedrag) || 0;
  const teBetalen     = Math.max(0, familieTotaal - aanbetaling);
  const s = Settings.all();

  return `
    <div class="factuur-doc">
      <div class="factuur-header">
        <div>
          <h2 style="border:none;padding:0;margin:0;font-size:1.4rem;">${esc(s.app_name)}</h2>
          <p style="margin:.15rem 0;font-size:.9rem;color:var(--muted);">${esc(s.app_tagline)}</p>
        </div>
        <div class="factuur-meta">
          <p style="margin:0;"><strong>VOORLOPIGE KOSTENRAMING</strong></p>
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
            <th class="num">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          ${kosten.length === 0
            ? `<tr><td colspan="3" class="muted center">Nog geen kostenposten geregistreerd.</td></tr>`
            : kosten.map(k => `<tr>
                <td>${esc(k.omschrijving)}</td>
                <td class="muted small">${esc(k.categorie || '')}</td>
                <td class="num">${fmtEUR(k.bedrag)}</td>
              </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="num"><strong>Totaal</strong></td>
            <td class="num"><strong>${fmtEUR(totaal)}</strong></td>
          </tr>
          ${verzekerd && gedektTotaal > 0 ? `
            <tr>
              <td colspan="2" class="num muted">Gedekt door verzekering${verzDekking > 0 ? ' (uit polis)' : ''}</td>
              <td class="num muted">- ${fmtEUR(gedektTotaal)}</td>
            </tr>
            <tr class="factuur-totalrow">
              <td colspan="2" class="num"><strong>Door familie te betalen</strong></td>
              <td class="num"><strong>${fmtEUR(familieTotaal)}</strong></td>
            </tr>
          ` : ''}
          ${aanbetaling > 0 ? `
            <tr>
              <td colspan="2" class="num muted">Aanbetaling${d.aanbetaling_datum ? ' (' + fmtDate(d.aanbetaling_datum) + ')' : ''}</td>
              <td class="num muted">- ${fmtEUR(aanbetaling)}</td>
            </tr>
            <tr class="factuur-totalrow">
              <td colspan="2" class="num"><strong>Nog te voldoen</strong></td>
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
    </div>`;
}

function renderFactuur(params) {
  const id = parseInt(params.id, 10);
  const d = DB.byId(KEYS.DOSSIERS, id);
  if (!d) return render404();

  const kosten = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);

  $('#view').innerHTML = `
    <div class="page factuur-page">
      <div class="page-head no-print">
        <div>
          <a href="#/dossiers/${d.id}" class="back-link">← Terug naar dossier</a>
          <h1>Voorlopige kostenraming</h1>
          <p class="muted">Dossier <strong>${esc(d.dossier_nummer)}</strong></p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-primary" id="btn-factuur-pdf">📄 Opslaan / delen als PDF</button>
          <button type="button" class="btn btn-ghost no-print" id="btn-factuur-print">🖨️ Printen</button>
        </div>
      </div>
      ${buildFactuurDocHTML(d, kosten)}
    </div>`;

  const pdfBtn = $('#btn-factuur-pdf');
  pdfBtn.addEventListener('click', async () => {
    const orig = pdfBtn.textContent;
    pdfBtn.disabled = true; pdfBtn.textContent = 'PDF maken…';
    try {
      await PdfGen.deliver(buildFactuurDocHTML(d, kosten), `kostenraming-${d.dossier_nummer}.pdf`, d.id);
    } catch (e) {
      Modal.show({ type: 'error', title: 'PDF maken mislukt', message: e.message || String(e) });
    } finally {
      pdfBtn.disabled = false; pdfBtn.textContent = orig;
    }
  });
  const printBtn = $('#btn-factuur-print');
  // In de app werkt window.print() niet; daar dekt de PDF-knop (open in Safari)
  // het printen af. Verberg de losse Print-knop dus op iOS.
  if (typeof Native !== 'undefined' && Native.isApp && Native.isApp()) printBtn.hidden = true;
  printBtn.addEventListener('click', () => window.print());
}
