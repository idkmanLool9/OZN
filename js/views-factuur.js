// Factuur / eindafrekening — printbare layout per dossier

// HTML-blok van het factuur-document (zonder page-acties). Ook gebruikt
// door PdfGen om een PDF-bijlage te maken voor de mail-verstuurder.
// Spec voor de PDF-generator (jsPDF) — voorlopige kostenraming.
function kostenramingSpec(d, kosten) {
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const verzekerd = d.verzekering_status === 'met verzekering';
  const dekkingInfo = computeDekking(kosten, d, Settings.all());
  const gedektTotaal = dekkingInfo.dekking;
  const familieTotaal = Math.max(0, totaal - gedektTotaal);
  const aanbetaling = Number(d.aanbetaling_bedrag) || 0;
  const teBetalen = Math.max(0, familieTotaal - aanbetaling);

  const totals = [['Totaal kosten', fmtEUR(totaal), false]];
  if (gedektTotaal > 0) totals.push(['Verzekering dekt', '– ' + fmtEUR(gedektTotaal), false]);
  totals.push(['Door familie te betalen', fmtEUR(familieTotaal), aanbetaling <= 0]);
  if (aanbetaling > 0) {
    totals.push(['Reeds aanbetaald', '– ' + fmtEUR(aanbetaling), false]);
    totals.push(['Nog te betalen', fmtEUR(teBetalen), true]);
  }

  return {
    title: 'VOORLOPIGE KOSTENRAMING',
    meta: ['Dossier: ' + (d.dossier_nummer || ''), 'Datum: ' + new Date().toLocaleDateString('nl-NL')],
    intro: [
      { label: 'Voor', lines: [
        d.opdrachtgever_naam || d.contact_naam || '—',
        [d.contact_adres, d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(', '),
        d.opdrachtgever_telefoon ? 'Tel: ' + d.opdrachtgever_telefoon : '',
      ] },
      { label: 'Betreft', lines: [
        'Uitvaart van ' + (fullName(d) || '—'),
        d.overlijdensdatum ? 'Overleden ' + fmtDate(d.overlijdensdatum) : '',
        d.uitvaart_datum ? 'Uitvaart ' + fmtDate(d.uitvaart_datum) : '',
      ] },
    ],
    sections: verzekerd ? [{ heading: 'Via verzekering', rows: [
      ['Maatschappij', d.verzekering_maatschappij], ['Polisnummer', d.polisnummer], ['Pakket', d.verzekering_pakket],
    ] }] : [],
    table: {
      heading: 'Kostenposten',
      rows: kosten.length
        ? kosten.map(k => [k.omschrijving || '', k.categorie || '', fmtEUR(k.bedrag)])
        : [['Nog geen kostenposten geregistreerd.', '', '']],
    },
    totals,
    footer: 'Dit is een voorlopige kostenraming, geen definitieve factuur. Bedragen zijn richtprijzen en kunnen nog wijzigen.',
  };
}

// Oplopend factuurnummer per dossier. Eén keer toegekend (bij de eerste
// factuur), daarna stabiel. Formaat: JAAR + 4-cijferig volgnummer (bv.
// 20260001). Opgeslagen in de cloud-instellingen; geen DB-migratie nodig.
function factuurNummerVoor(d) {
  if (!d || d.id == null) return String((d && d.dossier_nummer) || '');
  const map = Object.assign({}, Settings.get('factuur_nummers') || {});
  if (map[d.id]) return map[d.id];
  const next = (Number(Settings.get('factuur_volgnr')) || 0) + 1;
  const jaar = new Date().getFullYear();
  const nr = `${jaar}${String(next).padStart(4, '0')}`;
  map[d.id] = nr;
  Settings.set({ factuur_volgnr: next, factuur_nummers: map });
  return nr;
}

// Professionele PDF-kostenraming (jsPDF) volgens het vaste sjabloon: bedrijfskop
// + regeltabel (Aantal/Prijs/Totaal) + btw-overzicht. Geen factuurnummer en geen
// betaalverzoek — het is een indicatieve begroting, geen factuur.
function buildFactuurPdf(d, kosten) {
  const doc = new (PdfGen._jsPDF())({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const s = Settings.all();
  const M = 18, W = 210, right = W - M, RX = 122;
  const DARK = () => doc.setTextColor(30, 30, 30);
  const GRAY = () => doc.setTextColor(115, 115, 115);
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2022}]/gu;
  const clean = t => String(t == null ? '' : t).replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').trim();
  const eur = n => (Number(n) || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const T = (t, x, yy, o) => doc.text(clean(t), x, yy, o);

  const today = new Date();
  const fmtNL = dt => dt.toLocaleDateString('nl-NL');
  // Bewust GEEN factuurnummer: een kostenraming is geen factuur en mag het
  // oplopende factuur-volgnummer niet verbruiken.
  const totaal = (kosten || []).reduce((sum, k) => sum + (Number(k.bedrag) || 0), 0);

  // ── Rechterkolom: bedrijf + IBAN/btw/kvk + factuurmeta ──
  let ry = M;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); DARK();
  T(s.factuur_bedrijfsnaam || '', RX, ry); ry += 4.6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); GRAY();
  String(s.factuur_adres || '').split('\n').forEach(l => { T(l, RX, ry); ry += 4; });
  T('t  ' + (s.factuur_telefoon || ''), RX, ry); ry += 4;
  T('e  ' + (s.factuur_email || ''), RX, ry); ry += 6;
  const lvR = (label, val) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8); DARK(); T(label, RX, ry);
    doc.setFont('helvetica', 'normal'); GRAY(); T(val, RX + 24, ry); ry += 4.4;
  };
  lvR('IBAN', s.factuur_iban); lvR('Btw-nr', s.factuur_btw); lvR('KvK', s.factuur_kvk);
  ry += 4;
  const lvM = (label, val, bold) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); GRAY(); T(label, RX, ry);
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); DARK(); T(val, RX + 24, ry); ry += 4.6;
  };
  lvM('Datum', fmtNL(today));
  lvM('Referentie', 'Uitvaart ' + (fullName(d) || ''), true);

  // ── Linkerkolom: logo + "Kostenraming" + ontvanger ──
  let ly = M;
  const logoUrl = s.factuur_logo_data_url || s.logo_data_url;
  if (logoUrl) {
    try {
      const fmt = /jpe?g/i.test(logoUrl) ? 'JPEG' : 'PNG';
      doc.addImage(logoUrl, fmt, M, ly, 20, 20); ly += 24;
    } catch (_) { ly += 1; }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); DARK();
  T('Kostenraming', M, ly + 5); ly += 15;
  const ontNaam = d.opdrachtgever_naam || [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ') || '';
  const ontA1 = [d.contact_adres, d.contact_huisnummer].filter(Boolean).join(' ');
  const ontA2 = [d.contact_postcode, d.contact_woonplaats].filter(Boolean).join('  ');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); DARK(); T(ontNaam, M, ly); ly += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  if (ontA1) { T(ontA1, M, ly); ly += 4.5; }
  if (ontA2) { T(ontA2, M, ly); ly += 4.5; }

  // Een kostenraming is een indicatieve begroting, geen betaalverzoek:
  // daarom geen betaalgegevens-box en geen "te betalen".
  let y = Math.max(ly, ry) + 8;

  // ── Regeltabel ──
  const xOms = M, xAantal = 120, xPrijs = 152, xTot = right;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); DARK();
  T('Omschrijving', xOms, y);
  T('Aantal', xAantal, y, { align: 'right' });
  T('Prijs', xPrijs, y, { align: 'right' });
  T('Totaal', xTot, y, { align: 'right' });
  y += 2; doc.setDrawColor(210); doc.line(M, y, right, y); y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  (kosten || []).forEach(k => {
    if (y > 255) { doc.addPage(); y = M; }
    const aantal = Number(k.aantal) || 1;
    const prijs = aantal ? (Number(k.bedrag) || 0) / aantal : (Number(k.bedrag) || 0);
    const omsLines = doc.splitTextToSize(clean(k.omschrijving || ''), xAantal - M - 8);
    DARK(); doc.text(omsLines, xOms, y);
    T(eur(aantal), xAantal, y, { align: 'right' });
    T(eur(prijs), xPrijs, y, { align: 'right' });
    T(eur(k.bedrag), xTot, y, { align: 'right' });
    y += Math.max(5, omsLines.length * 4.6);
  });
  const notitie = ['Dossiernummer ' + (d.dossier_nummer || ''), d.grafnummer ? 'Grafnummer ' + d.grafnummer : ''].filter(Boolean).join('   ');
  y += 1.5; GRAY(); doc.setFontSize(9); T(notitie, xOms, y); y += 6;

  // ── Totalen (rechts) + btw-overzicht (links) ──
  doc.setDrawColor(210); doc.line(M, y, right, y); y += 6;
  const tY = y;
  const totRow = (label, val, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 10.5 : 9.5); DARK();
    T(label, xPrijs, y, { align: 'right' });
    T('€ ' + eur(val), xTot, y, { align: 'right' });
    y += bold ? 7 : 5.5;
  };
  totRow('Totaal excl. btw', totaal);
  totRow('Btw (vrijgesteld)', 0);
  totRow('Geschat totaal', totaal, true);

  let by = tY;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); GRAY();
  T('Btw %', M, by); T('Grondslag', M + 22, by); T('Bedrag', M + 50, by); by += 1.5;
  doc.setDrawColor(220); doc.line(M, by, M + 68, by); by += 4;
  doc.setFont('helvetica', 'normal'); DARK();
  T('vrij', M, by); T(eur(totaal), M + 22, by); T('0,00', M + 50, by);

  // Disclaimer onderaan: dit is een raming, geen factuur.
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); GRAY();
  T('Dit is een indicatieve kostenraming, geen factuur. Bedragen zijn richtprijzen en kunnen nog wijzigen.', M, 286);

  return doc;
}

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
        Voor vragen over deze kostenraming kunt u contact opnemen met de uitvaartleider.
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
      await PdfGen.deliver(() => buildFactuurPdf(d, kosten), `kostenraming-${d.dossier_nummer}.pdf`, d.id);
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
