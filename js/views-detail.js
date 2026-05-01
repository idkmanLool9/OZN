// Dossier detail: overzicht + taken + kosten + notities + print

function renderDossierDetail(params) {
  const id = parseInt(params.id, 10);
  const d = DB.byId(KEYS.DOSSIERS, id);
  if (!d) return render404();

  const kosten = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
  const notities = DB.where(KEYS.NOTITIES, n => n.dossier_id === id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const documenten = DB.where(KEYS.DOCUMENTEN, doc => doc.dossier_id === id).sort((a, b) => (b.geupload_op || '').localeCompare(a.geupload_op || ''));
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const betaald = kosten.filter(k => k.betaald).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const verzekerd = d.verzekering_status === 'met verzekering';
  const gedektTotaal = kosten.filter(k => k.gedekt).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const familieTotaal = totaal - gedektTotaal;

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <a href="#/dossiers" class="back-link">← Dossiers</a>
          <h1>${esc(fullName(d) || 'Dossier')}</h1>
          <p class="muted">
            <strong>${esc(d.dossier_nummer)}</strong> ·
            <select id="status-select" class="status-inline status-${esc(d.status)}" data-id="${d.id}" aria-label="Status wijzigen">
              ${['nieuw','in_behandeling','voltooid','geannuleerd'].map(s =>
                `<option value="${s}" ${(d.status||'nieuw')===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
            </select>
            ${d.gezinsnummer ? ' · gezinsnr. ' + esc(d.gezinsnummer) : ''}
          </p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-ghost" id="btn-print" title="Printen of opslaan als PDF">🖨️ Print</button>
          <a href="#/dossiers/${d.id}/factuur" class="btn btn-ghost" title="Factuur openen">📄 Factuur</a>
          <button type="button" class="btn btn-ghost" id="btn-email-dossier" title="Stuur dossier per e-mail">📧 E-mail dossier</button>
          <button type="button" class="btn btn-ghost" id="btn-email-factuur" title="Stuur factuur per e-mail">📧 E-mail factuur</button>
          <button type="button" class="btn btn-ghost" id="btn-copy-nr" title="Kopieer dossiernummer">⧉ Kopieer nr</button>
          <a href="#/dossiers/${d.id}/bewerken" class="btn btn-primary">Bewerken</a>
          <button type="button" class="btn btn-danger" id="btn-delete">Verwijderen</button>
        </div>
      </div>

      <nav class="tabs">
        <a href="#/dossiers/${d.id}#overzicht">Overzicht</a>
        <a href="#/dossiers/${d.id}#kosten">Kosten</a>
        <a href="#/dossiers/${d.id}#documenten">Documenten (${documenten.length})</a>
        <a href="#/dossiers/${d.id}#notities">Notities (${notities.length})</a>
      </nav>

      <section id="overzicht" class="card">
        <div class="print-header">
          <div><h2 style="border:none;padding:0;background:none;">Uitvaartdossier</h2><p style="margin:0;">St. Ephrem de Syriër Klooster · Glanerbrugstr. 33, 7585 Glane/Losser</p></div>
          <div class="meta"><p><strong>${esc(d.dossier_nummer)}</strong></p><p>Status: ${esc((d.status||'').replace('_',' '))}</p><p>Afgedrukt: ${new Date().toLocaleString('nl-NL')}</p></div>
        </div>
        <h2>Overzicht</h2>
        <h3>Overledene</h3>
        <dl class="dl">
          ${dlRow('Naam', fullName(d))}
          ${dlRow('Doopnaam', d.doopnaam)}
          ${dlRow('Geslacht', d.geslacht)}
          ${dlRow('Geboren', [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' '))}
          ${dlRow('Overleden', [fmtDate(d.overlijdensdatum), d.overlijdenstijd && 'om ' + d.overlijdenstijd, d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' '))}
          ${dlRow('Adres', [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', '))}
          ${dlRow('BSN', d.bsn)}
          ${dlRow('Burgerlijke staat', d.burgerlijke_staat)}
          ${dlRow('Nationaliteit', d.nationaliteit)}
          ${dlRow('Beroep', d.beroep)}
          ${dlRow('Lid SOK', d.syrisch_orthodox_lid)}
          ${dlRow('Gezinsnummer', d.gezinsnummer)}
          ${dlRow('Grafnummer', d.grafnummer)}
        </dl>
        <h3>Contactpersoon</h3>
        <dl class="dl">
          ${dlRow('Naam', [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ') + (d.contact_relatie ? ' (' + d.contact_relatie + ')' : ''))}
          ${dlRow('Telefoon', d.contact_telefoon)}
          ${dlRow('E-mail', d.contact_email)}
          ${dlRow('Adres', [d.contact_adres, d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(', '))}
        </dl>
        ${(d.contact_telefoon || d.contact_email) ? `
          <div class="quick-contact">
            ${d.contact_telefoon ? `<a class="btn btn-sm" href="tel:${esc(d.contact_telefoon.replace(/\s/g,''))}">📞 Bel</a>` : ''}
            ${d.contact_telefoon ? `<a class="btn btn-sm" href="https://wa.me/${esc(toWaNumber(d.contact_telefoon))}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
            ${d.contact_email ? `<a class="btn btn-sm" href="mailto:${esc(d.contact_email)}">✉️ E-mail</a>` : ''}
          </div>` : ''}
        <h3>Kerkelijk</h3>
        <dl class="dl">
          ${dlRow('Parochie', d.parochie)}
          ${dlRow('Priester', d.priester)}
          ${dlRow('Huisbezoek', [fmtDate(d.huisbezoek_datum), d.huisbezoek_tijd].filter(Boolean).join(' '))}
          ${dlRow('Avondwake', [fmtDate(d.avondwake_datum), d.avondwake_tijd, d.avondwake_locatie && '— ' + d.avondwake_locatie].filter(Boolean).join(' '))}
        </dl>
        <h3>Uitvaartdienst</h3>
        <dl class="dl">
          ${dlRow('Type', d.uitvaart_type)}
          ${dlRow('Datum & tijd', [fmtDate(d.uitvaart_datum), d.uitvaart_tijd && 'om ' + d.uitvaart_tijd].filter(Boolean).join(' '))}
          ${dlRow('Kerk', d.kerk_locatie)}
          ${dlRow('Begraafplaats', [d.begraafplaats, d.grafnummer && 'graf ' + d.grafnummer, d.graf_type && '(' + d.graf_type + ')'].filter(Boolean).join(' — '))}
        </dl>
        <h3>Logistiek</h3>
        <dl class="dl">
          ${dlRow('Kist', d.kist_type ? kistRowValue(d.kist_type) : '')}
          ${dlRow('Rouwauto', d.rouwauto)}
          ${dlRow("Volgauto's", d.aantal_volgauto)}
          ${dlRow('Dragers', d.dragers)}
          ${dlRow('Bloemstukken', d.bloemstukken ? bloemRowValue(d.bloemstukken) : '')}
          ${dlRow('Rouwkaarten', d.rouwkaarten_aantal)}
          ${dlRow('Condoleance', d.condoleance_locatie)}
          ${dlRow('Eten & drinken', d.catering ? edRowValue(d.catering) : '')}
        </dl>
        <h3>Verzekering & betaling</h3>
        <dl class="dl">
          ${dlRow('Status', d.verzekering_status)}
          ${d.verzekering_status === 'met verzekering' ? `
            ${dlRow('Maatschappij', d.verzekering_maatschappij)}
            ${dlRow('Polisnummer', d.polisnummer)}
            ${dlRow('Polishouder', d.verzekering_polishouder)}
            ${dlRow('Dekkingsbedrag', d.verzekering_dekking ? fmtEUR(d.verzekering_dekking) : '')}
            ${dlRow('Pakket', d.verzekering_pakket)}
            ${dlRow('Aanmelding-status', d.verzekering_aanmelding_status)}
            ${dlRow('Contactpersoon', d.verzekering_contact_naam)}
            ${dlRow('Telefoon contact', d.verzekering_contact_telefoon)}
          ` : ''}
          ${d.verzekering_status === 'zonder verzekering' ? `
            ${dlRow('Betaalwijze', d.betaalwijze)}
            ${dlRow('Aanbetaling', d.aanbetaling_bedrag ? fmtEUR(d.aanbetaling_bedrag) + (d.aanbetaling_datum ? ' op ' + fmtDate(d.aanbetaling_datum) : '') : '')}
            ${dlRow('Eindafrekening', d.eindafrekening_bedrag ? fmtEUR(d.eindafrekening_bedrag) + (d.eindafrekening_status ? ' (' + d.eindafrekening_status + ')' : '') : '')}
            ${dlRow('Betalingstermijn', d.betalingstermijn)}
            ${dlRow('Verantwoordelijke', d.verantwoordelijke_persoon)}
          ` : ''}
          ${dlRow('Opdrachtgever', d.opdrachtgever_naam)}
          ${dlRow('Telefoon opdrachtgever', d.opdrachtgever_telefoon)}
        </dl>
        ${d.bijzonderheden ? `<h3>Bijzonderheden</h3><p class="prewrap">${esc(d.bijzonderheden)}</p>` : ''}

        ${(() => {
          const sigs = (d.handtekeningen && typeof d.handtekeningen === 'object') ? d.handtekeningen : {};
          const fields = Settings.get('signature_fields') || [];
          if (fields.length === 0) return '';
          const any = fields.some(f => sigs[f.id] && sigs[f.id].data);
          if (!any) return '';
          return `<h3>Handtekeningen</h3>
            <div class="signatures-grid signatures-readonly">
              ${fields.map(f => {
                const s = sigs[f.id];
                if (!s || !s.data) return '';
                const when = s.signed_at ? new Date(s.signed_at).toLocaleString('nl-NL') : '';
                return `<div class="signature-block">
                  <div class="signature-header"><strong>${esc(f.label)}</strong></div>
                  <img class="signature-img" src="${esc(s.data)}" alt="${esc(f.label)}">
                  <div class="signature-actions"><span class="muted small">Ondertekend ${esc(when)}</span></div>
                </div>`;
              }).join('')}
            </div>`;
        })()}
      </section>

      <section id="kosten" class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
          <h2 style="border:none;padding:0;margin:0;">Kosten</h2>
          ${kosten.length > 0 ? `<a href="#/dossiers/${d.id}/factuur" class="btn btn-sm">📄 Factuur openen</a>` : ''}
        </div>
        ${kosten.length === 0 ? '<p class="muted">Nog geen kostenposten.</p>' :
          `<table class="table"><thead><tr>
            <th>Omschrijving</th><th>Categorie</th><th class="num">Bedrag</th>
            ${verzekerd ? '<th>Gedekt</th>' : ''}
            <th>Betaald</th><th></th>
          </tr></thead><tbody>
            ${kosten.map(k => `<tr>
              <td>${esc(k.omschrijving)}</td>
              <td>${esc(k.categorie || '—')}</td>
              <td class="num">${fmtEUR(k.bedrag)}</td>
              ${verzekerd ? `<td><button type="button" class="check small" data-action="toggle-gedekt" data-id="${k.id}" title="gedekt door verzekering">${k.gedekt ? '✓' : '○'}</button></td>` : ''}
              <td><button type="button" class="check small" data-action="toggle-kosten" data-id="${k.id}">${k.betaald ? '✓' : '○'}</button></td>
              <td><button type="button" class="btn-icon" data-action="del-kosten" data-id="${k.id}">×</button></td>
            </tr>`).join('')}
            <tr class="total-row"><td colspan="2"><strong>Totaal</strong></td><td class="num"><strong>${fmtEUR(totaal)}</strong></td><td colspan="${verzekerd ? 3 : 2}" class="muted small">waarvan betaald: ${fmtEUR(betaald)}</td></tr>
            ${verzekerd ? `
              <tr><td colspan="2" class="muted small">Gedekt door verzekering</td><td class="num muted small">${fmtEUR(gedektTotaal)}</td><td colspan="3"></td></tr>
              <tr><td colspan="2"><strong>Door familie te betalen</strong></td><td class="num"><strong style="color:var(--primary);">${fmtEUR(familieTotaal)}</strong></td><td colspan="3"></td></tr>
            ` : ''}
          </tbody></table>`}
        <h3 style="margin-top:1rem;">Snel toevoegen uit catalogus</h3>
        <p class="muted small">Klik om een vast tarief direct toe te voegen.</p>
        <div class="preset-grid">
          ${KOSTEN_PRESETS.map((p, i) => `
            <button type="button" class="btn preset-btn" data-action="add-preset" data-preset="${i}">
              <span>${esc(p.omschrijving)}</span>
              <strong>${fmtEUR(p.bedrag)}</strong>
            </button>`).join('')}
        </div>
        <h3 style="margin-top:1rem;">Of voeg handmatig toe</h3>
        <form id="add-kosten" class="row-form">
          <input type="text" name="omschrijving" placeholder="Omschrijving..." required>
          <select name="categorie">
            <option value="">Categorie</option>
            ${['aannametarief','vervoer','kist','aula','verzorging','kerk','begraafplaats','bloemen','rouwkaarten','catering','overig'].map(c =>
              `<option value="${c}">${c}</option>`).join('')}
          </select>
          <input type="text" name="bedrag" placeholder="0,00" inputmode="decimal">
          <label class="checkbox-inline"><input type="checkbox" name="betaald"> betaald</label>
          <button type="submit" class="btn">+ Toevoegen</button>
        </form>
      </section>

      <section id="documenten" class="card">
        <h2>Documenten</h2>
        ${documenten.length === 0 ? '<p class="muted">Nog geen documenten geüpload.</p>' :
          '<ul class="doc-list">' + documenten.map(doc => `
            <li>
              <button type="button" class="link-btn" data-action="download-doc" data-id="${doc.id}">${esc(doc.naam)}</button>
              ${doc.type ? `<span class="badge">${esc(doc.type)}</span>` : ''}
              <span class="muted small">${doc.grootte ? Math.round(doc.grootte/1024) + ' KB · ' : ''}${esc(fmtDate(doc.geupload_op))}</span>
              <button type="button" class="btn-icon right" data-action="del-doc" data-id="${doc.id}">×</button>
            </li>`).join('') + '</ul>'}
        <form id="add-doc" class="row-form">
          <input type="text" name="naam" placeholder="Documentnaam (optioneel)">
          <select name="type">
            <option value="">Type</option>
            <option value="overlijdensakte">Overlijdensakte</option>
            <option value="identiteitsbewijs">Identiteitsbewijs</option>
            <option value="medische verklaring">Medische verklaring</option>
            <option value="verzekeringspolis">Verzekeringspolis</option>
            <option value="grafrechten">Grafrechten</option>
            <option value="verlof tot begraven">Verlof tot begraven</option>
            <option value="overig">Overig</option>
          </select>
          <input type="file" name="bestand" required>
          <button type="submit" class="btn">+ Uploaden</button>
        </form>
      </section>

      <section id="notities" class="card">
        <h2>Notities</h2>
        <form id="add-notitie" class="form">
          <textarea name="tekst" rows="3" placeholder="Nieuwe notitie..." required></textarea>
          <button type="submit" class="btn">+ Notitie toevoegen</button>
        </form>
        ${notities.length === 0 ? '<p class="muted">Nog geen notities.</p>' :
          '<ul class="notitie-list">' + notities.map(n => `
            <li>
              <div class="notitie-meta">
                <strong>${esc(n.auteur || 'Onbekend')}</strong>
                <span class="muted small">${esc(fmtDate(n.created_at))}</span>
                <button type="button" class="btn-icon right" data-action="del-notitie" data-id="${n.id}">×</button>
              </div>
              <div class="prewrap">${esc(n.tekst)}</div>
            </li>`).join('') + '</ul>'}
      </section>
    </div>`;

  bindDetailEvents(id);
}

function toWaNumber(tel) {
  let num = String(tel || '').replace(/\D/g, '');
  if (num.startsWith('00')) num = num.slice(2);
  else if (num.startsWith('0')) num = '31' + num.slice(1);
  return num;
}

function buildDossierEmail(d) {
  const L = [];
  L.push('Beste,', '');
  L.push('Hierbij de gegevens van het uitvaartdossier.', '');
  L.push(`Dossiernummer: ${d.dossier_nummer || ''}`);
  if (d.status) L.push(`Status: ${(d.status||'').replace('_', ' ')}`);
  L.push('');
  L.push('— OVERLEDENE —');
  L.push(`Naam: ${fullName(d) || '—'}`);
  if (d.doopnaam) L.push(`Doopnaam: ${d.doopnaam}`);
  if (d.geboortedatum) L.push(`Geboren: ${fmtDate(d.geboortedatum)}${d.geboorteplaats ? ' te ' + d.geboorteplaats : ''}`);
  if (d.overlijdensdatum) L.push(`Overleden: ${fmtDate(d.overlijdensdatum)}${d.overlijdenstijd ? ' om ' + d.overlijdenstijd : ''}${d.overlijdensplaats ? ' te ' + d.overlijdensplaats : ''}`);
  const adresO = [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', ');
  if (adresO) L.push(`Adres: ${adresO}`);
  if (d.bsn) L.push(`BSN: ${d.bsn}`);
  L.push('');
  L.push('— CONTACTPERSOON —');
  L.push(`Naam: ${[d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ') || '—'}${d.contact_relatie ? ' (' + d.contact_relatie + ')' : ''}`);
  if (d.contact_telefoon) L.push(`Telefoon: ${d.contact_telefoon}`);
  if (d.contact_email)    L.push(`E-mail: ${d.contact_email}`);
  L.push('');
  L.push('— KERKELIJK —');
  if (d.parochie) L.push(`Parochie: ${d.parochie}`);
  if (d.priester) L.push(`Priester: ${d.priester}`);
  L.push('');
  L.push('— UITVAART —');
  if (d.uitvaart_type)   L.push(`Type: ${d.uitvaart_type}`);
  if (d.uitvaart_datum)  L.push(`Datum: ${fmtDate(d.uitvaart_datum)}${d.uitvaart_tijd ? ' om ' + d.uitvaart_tijd : ''}`);
  if (d.kerk_locatie)    L.push(`Kerk: ${d.kerk_locatie}`);
  if (d.begraafplaats)   L.push(`Begraafplaats: ${d.begraafplaats}${d.grafnummer ? ' — graf ' + d.grafnummer : ''}`);
  L.push('');
  if (d.bijzonderheden) { L.push('— BIJZONDERHEDEN —'); L.push(d.bijzonderheden); L.push(''); }
  L.push('Met vriendelijke groet,');
  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
  L.push(s.app_name || 'Uitvaartleider');
  if (s.app_tagline) L.push(s.app_tagline);
  return L.join('\n');
}

function buildFactuurEmail(d, kosten) {
  const verzekerd = d.verzekering_status === 'met verzekering';
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag)||0), 0);
  const gedekt = kosten.filter(k => k.gedekt).reduce((s, k) => s + (Number(k.bedrag)||0), 0);
  const familie = totaal - gedekt;
  const aanbet = Number(d.aanbetaling_bedrag) || 0;
  const teBetalen = familie - aanbet;
  const L = [];
  L.push('Beste,', '');
  L.push(`Hierbij de factuur voor uitvaartdossier ${d.dossier_nummer || ''}.`, '');
  L.push(`Betreft: ${fullName(d) || '—'}`);
  if (d.uitvaart_datum) L.push(`Uitvaart: ${fmtDate(d.uitvaart_datum)}`);
  L.push('');
  L.push('— KOSTEN —');
  kosten.forEach(k => {
    L.push(`${k.omschrijving}${verzekerd && k.gedekt ? ' (gedekt door verzekering)' : ''}: ${fmtEUR(k.bedrag)}`);
  });
  L.push('');
  L.push(`Totaal: ${fmtEUR(totaal)}`);
  if (verzekerd) {
    L.push(`Gedekt door verzekering: ${fmtEUR(gedekt)}`);
    L.push(`Door familie te betalen: ${fmtEUR(familie)}`);
  }
  if (aanbet > 0) {
    L.push(`Aanbetaling${d.aanbetaling_datum ? ' ('+fmtDate(d.aanbetaling_datum)+')' : ''}: ${fmtEUR(aanbet)}`);
    L.push(`Nog te voldoen: ${fmtEUR(teBetalen)}`);
  }
  L.push('');
  if (d.betalingstermijn) L.push(`Betalingstermijn: ${d.betalingstermijn}`);
  if (d.eindafrekening_status) L.push(`Status: ${d.eindafrekening_status}`);
  L.push('');
  L.push('Met vriendelijke groet,');
  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
  L.push(s.app_name || 'Uitvaartleider');
  if (s.app_tagline) L.push(s.app_tagline);
  return L.join('\n');
}

function openMailto(to, subject, body) {
  const url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

function dlRow(label, value) {
  const v = value && String(value).trim() ? value : '—';
  // value mag al HTML zijn als 'ie van kistRowValue komt; anders escapen
  const isHtml = typeof v === 'string' && v.startsWith('<');
  return `<div><dt>${esc(label)}</dt><dd>${isHtml ? v : esc(v)}</dd></div>`;
}

function kistRowValue(kistNaam) {
  const k = KISTEN_CATALOGUS.find(x => x.naam === kistNaam);
  if (!k) return esc(kistNaam);
  const fotoUrl = KistFotos.urlVoor(k.naam);
  const thumb = fotoUrl
    ? `<img src="${esc(fotoUrl)}" alt="${esc(k.naam)}" loading="lazy">`
    : kistSVG(k.materiaal);
  return `<span class="kist-thumb-inline">${thumb}</span>` +
         `<strong>${esc(k.naam)}</strong> ` +
         `<span class="muted small">— ${esc(k.materiaal)} — ${fmtEUR(k.bedrag)}</span>`;
}

function bloemRowValue(bloemNaam) {
  const b = DB.list(KEYS.BLOEMEN).find(x => x.naam === bloemNaam);
  if (!b) return esc(bloemNaam);
  const fotoUrl = BloemenFotos.urlVoor(b.naam);
  const thumb = fotoUrl
    ? `<img src="${esc(fotoUrl)}" alt="${esc(b.naam)}" loading="lazy">`
    : (typeof bloemSVG === 'function' ? bloemSVG() : '');
  const meta = [b.omschrijving, b.bedrag ? fmtEUR(b.bedrag) : null].filter(Boolean).join(' — ');
  return `<span class="kist-thumb-inline">${thumb}</span>` +
         `<strong>${esc(b.naam)}</strong>` +
         (meta ? ` <span class="muted small">— ${esc(meta)}</span>` : '');
}

function edRowValue(naam) {
  const b = DB.list(KEYS.ETEN_DRINKEN).find(x => x.naam === naam);
  if (!b) return esc(naam);
  const fotoUrl = EtenDrinkenFotos.urlVoor(b.naam);
  const thumb = fotoUrl
    ? `<img src="${esc(fotoUrl)}" alt="${esc(b.naam)}" loading="lazy">`
    : (typeof edSVG === 'function' ? edSVG() : '');
  const meta = [b.omschrijving, b.bedrag ? fmtEUR(b.bedrag) : null].filter(Boolean).join(' — ');
  return `<span class="kist-thumb-inline">${thumb}</span>` +
         `<strong>${esc(b.naam)}</strong>` +
         (meta ? ` <span class="muted small">— ${esc(meta)}</span>` : '');
}

function bindDetailEvents(id) {
  const dRow = DB.byId(KEYS.DOSSIERS, id);
  $('#btn-print').addEventListener('click', () => window.print());

  async function sendOrFallback(btn, toEmail, subject, body) {
    if (!toEmail) {
      Modal.show({ type: 'warning', title: 'Geen e-mailadres',
        message: 'De contactpersoon heeft nog geen e-mailadres in dit dossier. Vul het in via "Bewerken".' });
      return;
    }
    if (!EmailService.isConfigured()) {
      // Niet ingesteld — fallback: open mailclient
      Modal.show({
        type: 'info',
        title: 'E-mail-koppeling niet ingesteld',
        message: 'Stel EmailJS in via Account → E-mail verzenden om automatisch te versturen. Voor nu open ik je mail-app met de tekst klaar.',
      }).then(() => openMailto(toEmail, subject, body));
      return;
    }
    if (!confirm(`E-mail versturen naar ${toEmail}?`)) return;
    btn.disabled = true; const orig = btn.textContent;
    btn.textContent = 'Bezig met verzenden...';
    try {
      await EmailService.send(toEmail, subject, body);
      Modal.show({ type: 'success', title: 'E-mail verzonden',
        message: `Verstuurd naar ${toEmail}.` });
    } catch (e) {
      Modal.show({ type: 'error', title: 'Verzenden mislukt',
        message: (e && e.text) ? e.text : (e.message || String(e)) });
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  const emailDosBtn = $('#btn-email-dossier');
  if (emailDosBtn) {
    emailDosBtn.addEventListener('click', () => {
      const d = DB.byId(KEYS.DOSSIERS, id); if (!d) return;
      const subj = `Uitvaartdossier ${d.dossier_nummer} — ${fullName(d) || ''}`.trim();
      const body = buildDossierEmail(d);
      sendOrFallback(emailDosBtn, d.contact_email, subj, body);
    });
  }
  const emailFactBtn = $('#btn-email-factuur');
  if (emailFactBtn) {
    emailFactBtn.addEventListener('click', () => {
      const d = DB.byId(KEYS.DOSSIERS, id); if (!d) return;
      const ks = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
      const subj = `Factuur uitvaart ${d.dossier_nummer} — ${fullName(d) || ''}`.trim();
      const body = buildFactuurEmail(d, ks);
      sendOrFallback(emailFactBtn, d.contact_email, subj, body);
    });
  }
  const copyBtn = $('#btn-copy-nr');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(dRow.dossier_nummer);
        Modal.show({ type: 'success', title: 'Gekopieerd', message: `Dossiernummer ${dRow.dossier_nummer} staat op het klembord.` });
      } catch (_) {
        Modal.show({ type: 'error', title: 'Kopiëren mislukt', message: 'Je browser staat klembord-toegang niet toe.' });
      }
    });
  }

  const statusSel = $('#status-select');
  if (statusSel) {
    statusSel.addEventListener('change', async e => {
      const nieuw = e.target.value;
      try {
        await DB.update(KEYS.DOSSIERS, id, { status: nieuw });
        renderDossierDetail({ id });
      } catch (_) {
        renderDossierDetail({ id });
      }
    });
  }

  $('#btn-delete').addEventListener('click', async () => {
    if (!confirm('Weet u zeker dat u dit dossier wilt verwijderen? Alle taken, kosten, documenten en notities worden ook verwijderd.')) return;
    try {
      const docs = DB.where(KEYS.DOCUMENTEN, doc => doc.dossier_id === id);
      for (const doc of docs) await Storage.remove(doc.storage_pad);
      await DB.remove(KEYS.DOSSIERS, id); // cascade verwijdert taken/kosten/notities/documenten in DB
      // cache opschonen voor de child-tabellen
      ['taken','kosten','notities','documenten'].forEach(t =>
        Cloud.cache[t] = Cloud.cache[t].filter(x => x.dossier_id !== id));
      Router.go('/dossiers');
    } catch (e) {}
  });

  $('#add-kosten').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const omsch = f.omschrijving.value.trim(); if (!omsch) return;
    try {
      await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: omsch, categorie: f.categorie.value || null, bedrag: parseEUR(f.bedrag.value), betaald: f.betaald.checked });
      await DB.touchDossier(id);
      renderDossierDetail({ id });
    } catch (_) {}
  });

  $('#add-doc').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const file = f.bestand.files[0]; if (!file) return;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; const old = btn.textContent; btn.textContent = 'Bezig met uploaden...';
    try {
      const path = await Storage.upload(id, file);
      await DB.insert(KEYS.DOCUMENTEN, {
        dossier_id: id,
        naam: (f.naam.value || file.name).trim(),
        type: f.type.value || null,
        storage_pad: path,
        grootte: file.size,
      });
      await DB.touchDossier(id);
      renderDossierDetail({ id });
    } catch (_) {
      btn.disabled = false; btn.textContent = old;
    }
  });

  $('#add-notitie').addEventListener('submit', async e => {
    e.preventDefault();
    const tekst = e.target.tekst.value.trim(); if (!tekst) return;
    const u = Auth.current();
    try {
      await DB.insert(KEYS.NOTITIES, { dossier_id: id, tekst, auteur: u ? (u.fullName || u.email) : 'Onbekend' });
      await DB.touchDossier(id);
      renderDossierDetail({ id });
    } catch (_) {}
  });

  $('#view').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const tid = parseInt(btn.getAttribute('data-id'), 10);
    try {
      if (action === 'toggle-kosten') {
        const k = DB.byId(KEYS.KOSTEN, tid); if (!k) return;
        await DB.update(KEYS.KOSTEN, tid, { betaald: !k.betaald });
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'toggle-gedekt') {
        const k = DB.byId(KEYS.KOSTEN, tid); if (!k) return;
        await DB.update(KEYS.KOSTEN, tid, { gedekt: !k.gedekt });
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'del-kosten') {
        if (!confirm('Kostenpost verwijderen?')) return;
        await DB.remove(KEYS.KOSTEN, tid); await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'del-notitie') {
        if (!confirm('Notitie verwijderen?')) return;
        await DB.remove(KEYS.NOTITIES, tid); await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'add-preset') {
        const p = KOSTEN_PRESETS[parseInt(btn.getAttribute('data-preset'), 10)];
        if (!p) return;
        await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: p.omschrijving, categorie: p.categorie, bedrag: p.bedrag, betaald: false });
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'download-doc') {
        const doc = DB.byId(KEYS.DOCUMENTEN, tid); if (!doc) return;
        const url = await Storage.signedUrl(doc.storage_pad, 60);
        window.open(url, '_blank');
      } else if (action === 'del-doc') {
        if (!confirm('Document verwijderen?')) return;
        const doc = DB.byId(KEYS.DOCUMENTEN, tid); if (!doc) return;
        await Storage.remove(doc.storage_pad);
        await DB.remove(KEYS.DOCUMENTEN, tid);
        await DB.touchDossier(id); renderDossierDetail({ id });
      }
    } catch (_) {}
  });
}
