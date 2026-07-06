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
  // Eerst een eigen kostenraming-logo; anders het logo uit Instellingen
  // (branding); als terugval het ingebakken standaard-wapen.
  let ly = M;
  const logoUrl = s.factuur_logo_data_url || s.logo_data_url || KOSTENRAMING_LOGO;
  if (logoUrl) {
    try {
      const fmt = /jpe?g|jpeg/i.test(logoUrl) ? 'JPEG' : (/webp/i.test(logoUrl) ? 'WEBP' : 'PNG');
      // Verhouding behouden: schaal binnen een kader van 26x24 mm.
      let lw = 24, lh = 24;
      try {
        const p = doc.getImageProperties(logoUrl);
        if (p && p.width && p.height) {
          const sc = Math.min(26 / p.width, 24 / p.height);
          lw = p.width * sc; lh = p.height * sc;
        }
      } catch (_) {}
      doc.addImage(logoUrl, fmt, M, ly, lw, lh); ly += lh + 4;
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

  // Prijzen zijn afgeschermd voor medewerkers — geen toegang tot de kostenraming.
  if (typeof Auth !== 'undefined' && typeof Auth.magPrijzenZien === 'function' && !Auth.magPrijzenZien()) {
    $('#view').innerHTML = `
      <div class="page">
        <div class="page-head"><div><a href="#/dossiers/${d.id}" class="back-link">← Terug naar dossier</a>
          <h1>Geen toegang</h1></div></div>
        <div class="card"><p class="muted">De kostenraming met bedragen is alleen zichtbaar voor beheerders.</p></div>
      </div>`;
    return;
  }

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

// ─── Standaard-logo kostenraming ────────────────────────────────────────────
// Wapen van het Syrisch-Orthodoxe klooster. Als data-URL ingebakken zodat het
// logo offline en in de iOS-app zonder netwerk op de kostenraming-PDF verschijnt.
// Intrinsieke maat 217x232 px; de PDF schaalt met behoud van verhouding.
const KOSTENRAMING_LOGO = 'data:image/png;base64,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';
