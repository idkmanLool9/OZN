// Dossier detail: overzicht + taken + kosten + notities + print

function isImageDoc(doc) {
  if (!doc) return false;
  const src = (doc.naam || '') + ' ' + (doc.storage_pad || '');
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)(\?|$)/i.test(src);
}

// Cache van signed-URLs binnen één render-tick zodat we ze niet dubbel ophalen
const _docUrlCache = new Map();

async function loadDocThumbnails(documenten) {
  const imgs = documenten.filter(isImageDoc);
  await Promise.all(imgs.map(async doc => {
    const el = document.querySelector(`img.doc-thumb[data-doc-id="${doc.id}"]`);
    if (!el) return;
    try {
      let url = _docUrlCache.get(doc.storage_pad);
      if (!url) {
        url = await Storage.signedUrl(doc.storage_pad, 600); // 10 min
        _docUrlCache.set(doc.storage_pad, url);
      }
      el.src = url;
      el.alt = doc.naam || 'document';
    } catch (_) {
      // val terug op icoon
      const wrap = el.closest('.doc-thumb-btn');
      if (wrap) wrap.outerHTML = '<div class="doc-icon" aria-hidden="true">📄</div>';
    }
  }));
}

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
  // Verzekeringsdekking via centrale helper: 'categorie'-modus voor DELA
  // wanneer een pakket-template met categorieen is gekozen, anders 'flat'.
  const dekkingInfo  = computeDekking(kosten, d, Settings.all());
  const verzDekking  = Number(d.verzekering_dekking) || 0;
  const dekking      = dekkingInfo.dekking;
  const familieTotaal  = Math.max(0, totaal - dekking);
  const moetNogBetalen = Math.max(0, totaal - betaald);
  const familieMoetNog = Math.max(0, familieTotaal - betaald);

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
          <p class="muted small dossier-timestamps">
            Aangemaakt: <strong title="${esc(d.created_at ? new Date(d.created_at).toLocaleString('nl-NL') : '')}">${esc(fmtRelative(d.created_at) || '—')}</strong>
            · Laatst opgeslagen: <strong title="${esc(d.updated_at ? new Date(d.updated_at).toLocaleString('nl-NL') : '')}">${esc(fmtRelative(d.updated_at) || '—')}</strong>
            ${d.nfc_tag_id ? ` · 🏷️ NFC-tag: <code>${esc(d.nfc_tag_id)}</code>` : ''}
          </p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-ghost" id="btn-print" title="Printen of opslaan als PDF">🖨️ Print</button>
          <a href="#/dossiers/${d.id}/factuur" class="btn btn-ghost" title="Factuur openen">📄 Factuur</a>
          <a href="#/dossiers/${d.id}/rouwkaart" class="btn btn-ghost" title="Rouwkaart maken">🪦 Rouwkaart</a>
          <button type="button" class="btn btn-ghost" id="btn-email-dossier" title="Stuur dossier per e-mail">📧 E-mail dossier</button>
          <button type="button" class="btn btn-ghost" id="btn-email-factuur" title="Stuur factuur per e-mail">📧 E-mail factuur</button>
          <button type="button" class="btn btn-ghost" id="btn-nfc" title="Koppel een NFC-tag/kaart aan dit dossier">🏷️ ${d.nfc_tag_id ? 'NFC-tag' : 'Koppel NFC'}</button>
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
          ${dlRow('Geslacht', d.geslacht)}
          ${dlRow('Geboren', [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' '))}
          ${dlRow('Overleden', [fmtDate(d.overlijdensdatum), d.overlijdenstijd && 'om ' + d.overlijdenstijd, d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' '))}
          ${dlRow('Adres', [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', '))}
          ${dlRow('BSN', d.bsn)}
          ${dlRow('Nationaliteit', d.nationaliteit)}
          ${dlRow('Lid SOK', d.syrisch_orthodox_lid)}
          ${dlRow('Gezinsnummer', d.gezinsnummer)}
          ${dlRow('Grafnummer', d.grafnummer)}
          ${dlRow('(Ex)partner', d.partner_naam)}
          ${dlRow('Kinderen', d.kinderen_status)}
          ${dlRow('Minderjarige kinderen', d.minderjarige_kinderen)}
          ${(d.minderjarige_kinderen === 'ja' && d.kinderen_namen) ? `<div><dt>Namen kinderen</dt><dd class="prewrap">${esc(d.kinderen_namen)}</dd></div>` : ''}
        </dl>
        <h3>Contactpersoon</h3>
        <dl class="dl">
          ${dlRow('BSN', d.contact_bsn)}
          ${dlRow('Naam', [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' '))}
          ${dlRow('Adres', [d.contact_adres, d.contact_huisnummer].filter(Boolean).join(' '))}
          ${dlRow('Postcode / woonplaats', [d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(' '))}
          ${dlRow('Geboortedatum', fmtDate(d.contact_geboortedatum))}
          ${dlRow('Telefoon', d.contact_telefoon)}
          ${dlRow('E-mail', d.contact_email)}
          ${dlRow('Relatie tot overledene', d.contact_relatie)}
        </dl>
        ${(d.contact_telefoon || d.contact_email) ? `
          <div class="quick-contact">
            ${d.contact_telefoon ? `<a class="btn btn-sm" href="tel:${esc(d.contact_telefoon.replace(/\s/g,''))}">📞 Bel</a>` : ''}
            ${d.contact_telefoon ? `<a class="btn btn-sm" href="https://wa.me/${esc(toWaNumber(d.contact_telefoon))}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
            ${d.contact_email ? `<a class="btn btn-sm" href="mailto:${esc(d.contact_email)}">✉️ E-mail</a>` : ''}
          </div>` : ''}
        <h3>Kerkelijk &amp; uitvaartdienst</h3>
        <dl class="dl">
          ${dlRow('Parochie', d.parochie)}
          ${dlRow('Priester', d.priester)}
          ${dlRow('Huisbezoek', [fmtDate(d.huisbezoek_datum), d.huisbezoek_tijd].filter(Boolean).join(' '))}
          ${dlRow('Type uitvaart', d.uitvaart_type)}
          ${dlRow('Datum & tijdstip', [fmtDate(d.uitvaart_datum), d.uitvaart_tijd && 'om ' + d.uitvaart_tijd].filter(Boolean).join(' '))}
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
        ${kosten.length === 0 ? '<p class="muted">Nog geen kostenposten.</p>' : (() => {
          // Groepeer per categorie in vaste volgorde
          const buckets = {};
          kosten.forEach(k => {
            const cat = k.categorie || 'overig';
            (buckets[cat] = buckets[cat] || []).push(k);
          });
          const orderIds = KOSTEN_CATEGORIEEN.map(c => c.id);
          const orderedCats = orderIds.filter(id => buckets[id])
            .concat(Object.keys(buckets).filter(id => !orderIds.includes(id)));

          const colspanFront = 1; // omschrijving
          const colspanBack  = (verzekerd ? 1 : 0) + 1 + 1; // wie + status + delete
          return `
          <div class="kosten-groups">
            ${orderedCats.map(cat => {
              const items = buckets[cat];
              const sub = items.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
              return `
              <div class="kosten-group">
                <div class="kosten-group-head">
                  <span class="kosten-group-title">${categorieIcon(cat)} ${esc(categorieLabel(cat))}</span>
                  <span class="kosten-group-sub muted small">${items.length} ${items.length === 1 ? 'post' : 'posten'} · ${fmtEUR(sub)}</span>
                </div>
                <table class="table kosten-table">
                  <colgroup>
                    <col class="kc-col-omschrijving">
                    <col class="kc-col-aantal">
                    <col class="kc-col-bedrag">
                    ${dekkingInfo.mode === 'categorie' ? '<col class="kc-col-dekking">' : ''}
                    <col class="kc-col-status">
                    <col class="kc-col-del">
                  </colgroup>
                  <tbody>
                    ${items.map(k => {
                      const aantal = Number(k.aantal) || 1;
                      const stuk   = aantal > 0 ? (Number(k.bedrag) || 0) / aantal : 0;
                      const dekt   = (dekkingInfo.perKost && dekkingInfo.perKost[k.id]) || 0;
                      const familieDeel = Math.max(0, (Number(k.bedrag) || 0) - dekt);
                      return `<tr>
                      <td class="kc-omschrijving">${esc(k.omschrijving)}${aantal !== 1 ? ` <span class="muted small">(${fmtEUR(stuk)} per stuk)</span>` : ''}</td>
                      <td class="kc-aantal"><input type="number" class="kc-aantal-input" data-id="${k.id}" data-stuk="${stuk}" value="${esc(aantal)}" min="0" step="1" inputmode="numeric"></td>
                      <td class="kc-bedrag num">${fmtEUR(k.bedrag)}</td>
                      ${dekkingInfo.mode === 'categorie' ? `<td class="kc-dekking num small">${dekt > 0 ? `<span class="dekking-deel">🛡 ${fmtEUR(dekt)}</span>${familieDeel > 0 ? `<br><span class="familie-deel muted">👥 ${fmtEUR(familieDeel)}</span>` : ''}` : `<span class="familie-deel muted">👥 ${fmtEUR(familieDeel)}</span>`}</td>` : ''}
                      <td class="kc-status center"><button type="button" class="kost-toggle ${k.betaald ? 'on-betaald' : 'off-betaald'}" data-action="toggle-kosten" data-id="${k.id}" title="Klik om te wisselen">${k.betaald ? '✓ Betaald' : '○ Open'}</button></td>
                      <td class="kc-del"><button type="button" class="btn-icon" data-action="del-kosten" data-id="${k.id}" title="Verwijderen">×</button></td>
                    </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>`;
            }).join('')}
          </div>
          <div class="kosten-totals">
            <div class="kosten-total-row">
              <span>Totaal kosten</span>
              <strong class="num">${fmtEUR(totaal)}</strong>
            </div>
            <div class="kosten-total-row muted small">
              <span>Waarvan al betaald</span>
              <span class="num">${fmtEUR(betaald)}</span>
            </div>
            <div class="kosten-total-row total-open">
              <span>Moet nog betaald worden</span>
              <strong class="num">${fmtEUR(moetNogBetalen)}</strong>
            </div>
            ${verzekerd ? `
              <div class="kosten-totals-divider"></div>
              ${dekking === 0 && verzDekking === 0 ? `
                <div class="alert alert-info" style="margin:.25rem 0 .5rem;font-size:.85rem;">
                  Vul de <a href="#/dossiers/${d.id}/bewerken#verzekering-met-fields"><strong>maatschappij + pakket + dekkingsbedrag</strong></a>
                  in bij Verzekering &amp; betaling — voor DELA wordt dan
                  automatisch per categorie berekend wat verzekerd is.
                </div>
              ` : `
                ${dekkingInfo.mode === 'categorie' ? `
                  <div class="kosten-total-row muted small" style="font-weight:600;">
                    <span>${esc((dekkingInfo.pakket && dekkingInfo.pakket.naam) || 'Verzekering')}</span>
                    <span></span>
                  </div>
                  ${Object.entries(dekkingInfo.perCategorie).filter(([,v]) => v > 0).map(([cat, v]) => `
                    <div class="kosten-total-row muted small" style="padding-left:1rem;">
                      <span>· ${esc(categorieLabel(cat))}</span>
                      <span class="num">${fmtEUR(v)}</span>
                    </div>`).join('')}
                  ${dekkingInfo.geldStart > 0 ? `
                    <div class="kosten-total-row muted small" style="padding-left:1rem;">
                      <span>· Geldverzekering benut</span>
                      <span class="num">${fmtEUR(dekkingInfo.geldStart - dekkingInfo.geldRest)}${dekkingInfo.geldRest > 0 ? ` <span class="muted">(rest ${fmtEUR(dekkingInfo.geldRest)} aan familie)</span>` : ''}</span>
                    </div>` : ''}
                ` : ''}
                <div class="kosten-total-row">
                  <span>Verzekering dekt totaal${dekkingInfo.mode === 'categorie' ? '' : (verzDekking > 0 ? ' (uit polis)' : '')}</span>
                  <strong class="num">${fmtEUR(dekking)}</strong>
                </div>
                <div class="kosten-total-row muted small">
                  <span>Door familie te betalen</span>
                  <span class="num">${fmtEUR(familieTotaal)}</span>
                </div>
                <div class="kosten-total-row total-familie">
                  <span>Familie moet nog betalen</span>
                  <strong class="num">${fmtEUR(familieMoetNog)}</strong>
                </div>
              `}
            ` : ''}
          </div>`;
        })()}
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
            ${KOSTEN_CATEGORIEEN.map(c =>
              `<option value="${c.id}">${esc(c.label)}</option>`).join('')}
          </select>
          <input type="text" name="bedrag" placeholder="0,00" inputmode="decimal">
          <label class="checkbox-inline"><input type="checkbox" name="betaald"> betaald</label>
          <button type="submit" class="btn">+ Toevoegen</button>
        </form>
      </section>

      <section id="documenten" class="card">
        <h2>Documenten</h2>
        ${documenten.length === 0 ? '<p class="muted">Nog geen documenten geüpload.</p>' :
          '<ul class="doc-list">' + documenten.map(doc => {
            const isImg = isImageDoc(doc);
            return `
            <li class="doc-item">
              ${isImg
                ? `<button type="button" class="doc-thumb-btn" data-action="zoom-doc" data-id="${doc.id}" title="Klik om te vergroten">
                     <img class="doc-thumb" data-doc-id="${doc.id}" alt="">
                   </button>`
                : `<div class="doc-icon" aria-hidden="true">📄</div>`}
              <div class="doc-info">
                <button type="button" class="link-btn" data-action="download-doc" data-id="${doc.id}">${esc(doc.naam)}</button>
                ${doc.type ? `<span class="badge">${esc(doc.type)}</span>` : ''}
                <span class="muted small">${doc.grootte ? Math.round(doc.grootte/1024) + ' KB · ' : ''}${esc(fmtDate(doc.geupload_op))}</span>
              </div>
              <button type="button" class="btn-icon" data-action="del-doc" data-id="${doc.id}" title="Verwijderen">×</button>
            </li>`;
          }).join('') + '</ul>'}
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
          <input type="file" name="bestand" id="add-doc-file" accept="image/*,application/pdf" capture="environment" required>
          <label class="btn btn-ghost" title="Document/ID-kaart scannen met automatische uitsnijding en correctie" style="cursor:pointer;">
            📸 Scan ID
            <input type="file" id="scan-doc-file" accept="image/*" capture="environment" hidden>
          </label>
          <button type="submit" class="btn">+ Uploaden</button>
        </form>
        <div id="scan-preview" class="scan-preview" hidden>
          <img id="scan-preview-img" alt="Scan-voorbeeld">
          <div class="scan-preview-meta">
            <strong>Scan klaar</strong>
            <span class="muted small" id="scan-preview-info"></span>
            <div class="scan-preview-actions">
              <button type="button" class="btn btn-sm btn-ghost" id="scan-preview-clear">✕ Wis scan</button>
            </div>
          </div>
        </div>
        <p class="muted small" style="margin-top:.35rem;">Tip: <strong>📸 Scan ID</strong> snijdt automatisch het document uit, zet het recht en corrigeert het perspectief — zoals een professionele scan-app.</p>
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
  loadDocThumbnails(documenten);
}

function toWaNumber(tel) {
  let num = String(tel || '').replace(/\D/g, '');
  if (num.startsWith('00')) num = num.slice(2);
  else if (num.startsWith('0')) num = '31' + num.slice(1);
  return num;
}

function emTable(rows) {
  const valid = rows.filter(r => r && r[1] != null && String(r[1]).trim() !== '');
  if (!valid.length) return '';
  return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:6px 0 14px;">
    ${valid.map(([k, v]) => `
      <tr>
        <td style="padding:6px 10px 6px 0;color:#6f6a62;vertical-align:top;width:38%;font-size:13px;">${esc(k)}</td>
        <td style="padding:6px 0;color:#2a2724;vertical-align:top;font-size:14px;">${esc(v)}</td>
      </tr>`).join('')}
  </table>`;
}
function emH3(t) {
  return `<h3 style="margin:18px 0 4px;font-family:inherit;font-size:15px;font-weight:600;color:#6b1e2a;border-bottom:1px solid #e5e2da;padding-bottom:4px;">${esc(t)}</h3>`;
}

function buildDossierEmail(d) {
  const adresO = [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', ');
  const adresC = [[d.contact_adres, d.contact_huisnummer].filter(Boolean).join(' '), d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(', ');
  const huis = [fmtDate(d.huisbezoek_datum), d.huisbezoek_tijd].filter(Boolean).join(' ');
  const uitv = [fmtDate(d.uitvaart_datum), d.uitvaart_tijd && 'om ' + d.uitvaart_tijd].filter(Boolean).join(' ');
  const grafstuk = [d.begraafplaats, d.grafnummer && 'graf ' + d.grafnummer, d.graf_type && '(' + d.graf_type + ')'].filter(Boolean).join(' — ');

  const parts = [];
  parts.push(`<p style="margin:0 0 12px;">Beste,</p>`);
  parts.push(`<p style="margin:0 0 14px;">Hierbij de gegevens van het uitvaartdossier <strong>${esc(d.dossier_nummer || '')}</strong>${d.status ? ' (status: ' + esc((d.status||'').replace('_',' ')) + ')' : ''}.</p>`);

  parts.push(emH3('Overledene'));
  parts.push(emTable([
    ['Naam', fullName(d)],
    ['Geslacht', d.geslacht],
    ['Geboren', [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' ')],
    ['Overleden', [fmtDate(d.overlijdensdatum), d.overlijdenstijd && 'om ' + d.overlijdenstijd, d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' ')],
    ['Adres', adresO],
    ['BSN', d.bsn],
    ['(Ex)partner', d.partner_naam],
    ['Kinderen', d.kinderen_status],
    ['Minderjarige kinderen', d.minderjarige_kinderen],
    ...(d.minderjarige_kinderen === 'ja' ? [['Namen kinderen', d.kinderen_namen]] : []),
    ['Nationaliteit', d.nationaliteit],
    ['Lid SOK', d.syrisch_orthodox_lid],
    ['Gezinsnummer', d.gezinsnummer],
  ]));

  parts.push(emH3('Contactpersoon'));
  parts.push(emTable([
    ['BSN', d.contact_bsn],
    ['Naam', [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ')],
    ['Adres', adresC],
    ['Geboortedatum', fmtDate(d.contact_geboortedatum)],
    ['Telefoon', d.contact_telefoon],
    ['E-mail', d.contact_email],
    ['Relatie tot overledene', d.contact_relatie],
  ]));

  parts.push(emH3('Kerkelijk & uitvaartdienst'));
  parts.push(emTable([
    ['Parochie', d.parochie],
    ['Priester', d.priester],
    ['Huisbezoek', huis],
    ['Type uitvaart', d.uitvaart_type],
    ['Datum & tijdstip', uitv],
    ['Kerk', d.kerk_locatie],
    ['Begraafplaats', grafstuk],
  ]));

  parts.push(emH3('Logistiek'));
  parts.push(emTable([
    ['Kist', d.kist_type],
    ['Rouwauto', d.rouwauto],
    ["Volgauto's", d.aantal_volgauto],
    ['Dragers', d.dragers],
    ['Bloemstukken', d.bloemstukken],
    ['Rouwkaarten', d.rouwkaarten_aantal],
    ['Condoleance', d.condoleance_locatie],
    ['Eten & drinken', d.catering],
  ]));

  if (d.verzekering_status === 'met verzekering') {
    parts.push(emH3('Verzekering'));
    parts.push(emTable([
      ['Maatschappij', d.verzekering_maatschappij],
      ['Polisnummer', d.polisnummer],
      ['Polishouder', d.verzekering_polishouder],
      ['Dekkingsbedrag', d.verzekering_dekking ? fmtEUR(d.verzekering_dekking) : ''],
      ['Pakket', d.verzekering_pakket],
      ['Aanmelding-status', d.verzekering_aanmelding_status],
      ['Contactpersoon', d.verzekering_contact_naam],
      ['Telefoon contact', d.verzekering_contact_telefoon],
    ]));
  } else if (d.verzekering_status === 'zonder verzekering') {
    parts.push(emH3('Betaling (zonder verzekering)'));
    parts.push(emTable([
      ['Betaalwijze', d.betaalwijze],
      ['Aanbetaling', d.aanbetaling_bedrag ? fmtEUR(d.aanbetaling_bedrag) + (d.aanbetaling_datum ? ' op ' + fmtDate(d.aanbetaling_datum) : '') : ''],
      ['Eindafrekening', d.eindafrekening_bedrag ? fmtEUR(d.eindafrekening_bedrag) + (d.eindafrekening_status ? ' (' + d.eindafrekening_status + ')' : '') : ''],
      ['Betalingstermijn', d.betalingstermijn],
      ['Verantwoordelijke', d.verantwoordelijke_persoon],
    ]));
  }

  parts.push(emH3('Opdrachtgever'));
  parts.push(emTable([
    ['Naam', d.opdrachtgever_naam],
    ['Telefoon', d.opdrachtgever_telefoon],
  ]));

  if (d.bijzonderheden) {
    parts.push(emH3('Bijzonderheden'));
    parts.push(`<p style="white-space:pre-wrap;margin:6px 0 14px;font-size:14px;line-height:1.55;">${esc(d.bijzonderheden)}</p>`);
  }

  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
  parts.push(`<p style="margin:18px 0 0;font-size:13px;color:#6f6a62;">Met vriendelijke groet,<br><strong>${esc(s.app_name || 'Uitvaartleider')}</strong>${s.app_tagline ? '<br>' + esc(s.app_tagline) : ''}</p>`);
  return parts.join('\n');
}

function buildFactuurEmail(d, kosten) {
  const verzekerd = d.verzekering_status === 'met verzekering';
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag)||0), 0);
  const gedektFlag = kosten.filter(k => k.gedekt).reduce((s, k) => s + (Number(k.bedrag)||0), 0);
  const verzDek = Number(d.verzekering_dekking) || 0;
  const gedekt = !verzekerd ? 0
                 : (verzDek > 0 ? Math.min(verzDek, totaal) : gedektFlag);
  const familie = Math.max(0, totaal - gedekt);
  const aanbet = Number(d.aanbetaling_bedrag) || 0;
  const teBetalen = familie - aanbet;
  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};

  const parts = [];
  parts.push(`<p style="margin:0 0 12px;">Beste,</p>`);
  parts.push(`<p style="margin:0 0 14px;">Hierbij de factuur voor uitvaartdossier <strong>${esc(d.dossier_nummer || '')}</strong>.</p>`);

  parts.push(emTable([
    ['Voor', d.opdrachtgever_naam || d.contact_naam],
    ['Betreft', `Uitvaart van ${fullName(d) || '—'}`],
    ['Overlijdensdatum', fmtDate(d.overlijdensdatum)],
    ['Uitvaartdatum', fmtDate(d.uitvaart_datum)],
  ]));

  if (verzekerd) {
    parts.push(`<p style="background:#e6eef9;color:#2b5d99;padding:10px 14px;border-radius:6px;margin:10px 0;font-size:13px;">
      Via verzekering: <strong>${esc(d.verzekering_maatschappij || '—')}</strong>${d.polisnummer ? ' — polisnummer ' + esc(d.polisnummer) : ''}${d.verzekering_pakket ? ' — ' + esc(d.verzekering_pakket) : ''}
    </p>`);
  }

  parts.push(emH3('Kosten'));
  if (kosten.length === 0) {
    parts.push(`<p style="color:#6f6a62;font-style:italic;">Nog geen kostenposten geregistreerd.</p>`);
  } else {
    parts.push(`<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:13px;">
      <thead>
        <tr style="background:#f6f4ef;">
          <th align="left" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Omschrijving</th>
          <th align="left" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Categorie</th>
          <th align="right" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Bedrag</th>
        </tr>
      </thead>
      <tbody>
        ${kosten.map(k => `
          <tr>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;">${esc(k.omschrijving)}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;color:#6f6a62;">${esc(k.categorie || '')}</td>
            <td align="right" style="padding:7px 10px;border-bottom:1px solid #f0eee8;font-variant-numeric:tabular-nums;">${esc(fmtEUR(k.bedrag))}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;">Totaal</td>
          <td align="right" style="padding:8px 10px;font-weight:600;font-variant-numeric:tabular-nums;">${esc(fmtEUR(totaal))}</td>
        </tr>
        ${verzekerd && gedekt > 0 ? `
          <tr>
            <td colspan="2" align="right" style="padding:6px 10px;color:#6f6a62;">Gedekt door verzekering</td>
            <td align="right" style="padding:6px 10px;color:#6f6a62;font-variant-numeric:tabular-nums;">- ${esc(fmtEUR(gedekt))}</td>
          </tr>
          <tr style="background:#f5e8ea;">
            <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;color:#6b1e2a;">Door familie te betalen</td>
            <td align="right" style="padding:8px 10px;font-weight:600;color:#6b1e2a;font-variant-numeric:tabular-nums;">${esc(fmtEUR(familie))}</td>
          </tr>` : ''}
        ${aanbet > 0 ? `
          <tr>
            <td colspan="2" align="right" style="padding:6px 10px;color:#6f6a62;">Aanbetaling${d.aanbetaling_datum ? ' (' + fmtDate(d.aanbetaling_datum) + ')' : ''}</td>
            <td align="right" style="padding:6px 10px;color:#6f6a62;font-variant-numeric:tabular-nums;">- ${esc(fmtEUR(aanbet))}</td>
          </tr>
          <tr style="background:#f5e8ea;">
            <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;color:#6b1e2a;">Nog te voldoen</td>
            <td align="right" style="padding:8px 10px;font-weight:600;color:#6b1e2a;font-variant-numeric:tabular-nums;">${esc(fmtEUR(teBetalen))}</td>
          </tr>` : ''}
      </tfoot>
    </table>`);
  }

  if (d.betalingstermijn || d.betaalwijze || d.eindafrekening_status || d.verantwoordelijke_persoon) {
    parts.push(emH3('Betalingsafspraken'));
    parts.push(emTable([
      ['Betaalwijze', d.betaalwijze],
      ['Termijn', d.betalingstermijn],
      ['Status', d.eindafrekening_status],
      ['Verantwoordelijke', d.verantwoordelijke_persoon],
    ]));
  }

  parts.push(`<p style="margin:18px 0 0;font-size:13px;color:#6f6a62;">Met vriendelijke groet,<br><strong>${esc(s.app_name || 'Uitvaartleider')}</strong>${s.app_tagline ? '<br>' + esc(s.app_tagline) : ''}</p>`);
  return parts.join('\n');
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

  // NFC-tag koppelen / wijzigen / verwijderen
  const nfcBtn = $('#btn-nfc');
  if (nfcBtn) {
    nfcBtn.addEventListener('click', async () => {
      const cur = dRow.nfc_tag_id;
      if (cur) {
        // Bestaande tag — keuze: wijzigen of verwijderen
        const action = await Modal.confirm({
          type: 'info',
          title: 'NFC-tag gekoppeld',
          html: `Aan dit dossier is de tag <code>${esc(cur)}</code> gekoppeld.<br>Wil je een andere tag koppelen?`,
          confirmText: 'Andere tag koppelen',
          cancelText: 'Verwijder koppeling',
        });
        if (action) {
          // wijzigen → opnieuw scannen
          const newId = await NFC.promptKoppel();
          if (!newId) return;
          await DB.update(KEYS.DOSSIERS, id, { nfc_tag_id: newId });
          await DB.touchDossier(id);
          renderDossierDetail({ id });
        } else {
          // koppeling verwijderen
          await DB.update(KEYS.DOSSIERS, id, { nfc_tag_id: null });
          await DB.touchDossier(id);
          renderDossierDetail({ id });
        }
      } else {
        // Nog geen tag — eerste keer koppelen
        const newId = await NFC.promptKoppel();
        if (!newId) return;
        // Conflict-check: is deze tag al gekoppeld aan een ander dossier?
        const clash = DB.list(KEYS.DOSSIERS).find(x =>
          x.id !== id && (x.nfc_tag_id || '').toLowerCase() === newId.toLowerCase());
        if (clash) {
          const ok = await Modal.confirm({
            type: 'warning',
            title: 'Tag is al gekoppeld',
            message: `Deze tag (${newId}) is al gekoppeld aan dossier ${clash.dossier_nummer} — ${fullName(clash) || 'naam onbekend'}. Doorgaan loskoppelt 'm daar.`,
            confirmText: 'Toch koppelen',
            cancelText: 'Annuleren',
          });
          if (!ok) return;
          await DB.update(KEYS.DOSSIERS, clash.id, { nfc_tag_id: null });
        }
        await DB.update(KEYS.DOSSIERS, id, { nfc_tag_id: newId });
        await DB.touchDossier(id);
        renderDossierDetail({ id });
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
      await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: omsch, categorie: f.categorie.value || null, bedrag: parseEUR(f.bedrag.value), aantal: 1, betaald: f.betaald.checked });
      await DB.touchDossier(id);
      renderDossierDetail({ id });
    } catch (_) {}
  });

  // Aantal aanpassen → bedrag herberekenen op basis van stukprijs en opslaan
  let _aantalSaveTimer = null;
  $$('input.kc-aantal-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const tid = parseInt(inp.dataset.id, 10);
      const stuk = Number(inp.dataset.stuk) || 0;
      let nieuw = Math.max(0, parseInt(inp.value, 10) || 0);
      inp.value = String(nieuw);
      const k = DB.byId(KEYS.KOSTEN, tid); if (!k) return;
      const newBedrag = +(stuk * nieuw).toFixed(2);
      try {
        await DB.update(KEYS.KOSTEN, tid, { aantal: nieuw, bedrag: newBedrag });
        await DB.touchDossier(id);
        renderDossierDetail({ id });
      } catch (_) {}
    });
  });

  // Scan-knop: foto maken → auto-crop → in het bestandskeuze-veld zetten
  const scanInput = $('#scan-doc-file');
  if (scanInput) {
    scanInput.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      if (!file.type.startsWith('image/')) {
        Modal.show({ type: 'error', title: 'Ongeldig bestand', message: 'Alleen afbeeldingen kunnen gescand worden.' });
        return;
      }
      // Toon niet-blokkerende laad-modal; sluiten we straks zelf via Modal.close()
      let userCancelled = false;
      let programmaticClose = false;
      Modal.show({
        type: 'info',
        title: 'Bezig met scannen...',
        message: 'De scan-bibliotheek wordt geladen en je foto wordt automatisch uitgesneden, rechtgezet en gecorrigeerd. Dit kan een paar seconden duren bij de eerste keer.',
        confirmText: 'Annuleren',
      }).then(() => { if (!programmaticClose) userCancelled = true; });
      try {
        const scanned = await DocumentScanner.scan(file);
        if (userCancelled) return;
        // Vervang het bestand in de upload-input
        const dt = new DataTransfer();
        dt.items.add(scanned);
        const fileInp = $('#add-doc-file');
        fileInp.files = dt.files;
        // Stel automatisch type in op identiteitsbewijs als nog niet ingevuld
        const typeSel = $('#add-doc select[name="type"]');
        if (typeSel && !typeSel.value) typeSel.value = 'identiteitsbewijs';
        // Toon preview
        const prev = $('#scan-preview');
        const img = $('#scan-preview-img');
        const info = $('#scan-preview-info');
        if (img._objectUrl) URL.revokeObjectURL(img._objectUrl);
        const url = URL.createObjectURL(scanned);
        img._objectUrl = url;
        img.src = url;
        info.textContent = `${(scanned.size/1024).toFixed(0)} KB · klaar om te uploaden`;
        prev.hidden = false;
        // Loading-modal nu wegklikken — werk is klaar
        programmaticClose = true;
        Modal.close();
      } catch (err) {
        programmaticClose = true;
        Modal.close();
        Modal.show({ type: 'error', title: 'Scannen mislukt', message: err.message || String(err) });
      } finally {
        scanInput.value = ''; // reset zodat hetzelfde bestand opnieuw te kiezen is
      }
    });
  }

  const scanClear = $('#scan-preview-clear');
  if (scanClear) {
    scanClear.addEventListener('click', () => {
      const fileInp = $('#add-doc-file');
      if (fileInp) fileInp.value = '';
      const prev = $('#scan-preview');
      const img = $('#scan-preview-img');
      if (img._objectUrl) { URL.revokeObjectURL(img._objectUrl); img._objectUrl = null; }
      img.removeAttribute('src');
      prev.hidden = true;
    });
  }

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

  $('#view').onclick = async e => {
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
        // Bestaat al een rij met dezelfde omschrijving + categorie?
        // Dan aantal ophogen en bedrag bijtellen (geen dubbele rij).
        const existing = DB.where(KEYS.KOSTEN, k =>
          k.dossier_id === id &&
          k.omschrijving === p.omschrijving &&
          (k.categorie || null) === (p.categorie || null)
        );
        if (existing.length > 0) {
          const e = existing[0];
          const newAantal = (Number(e.aantal) || 1) + 1;
          const newBedrag = +((Number(e.bedrag) || 0) + (Number(p.bedrag) || 0)).toFixed(2);
          await DB.update(KEYS.KOSTEN, e.id, { aantal: newAantal, bedrag: newBedrag });
        } else {
          await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: p.omschrijving, categorie: p.categorie, bedrag: p.bedrag, aantal: 1, betaald: false });
        }
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'download-doc') {
        const doc = DB.byId(KEYS.DOCUMENTEN, tid); if (!doc) return;
        const url = await Storage.signedUrl(doc.storage_pad, 60);
        window.open(url, '_blank');
      } else if (action === 'zoom-doc') {
        const doc = DB.byId(KEYS.DOCUMENTEN, tid); if (!doc) return;
        let url = _docUrlCache.get(doc.storage_pad);
        if (!url) {
          url = await Storage.signedUrl(doc.storage_pad, 600);
          _docUrlCache.set(doc.storage_pad, url);
        }
        Lightbox.show({
          src: url,
          title: doc.naam || '',
          subtitle: [doc.type, doc.grootte ? Math.round(doc.grootte/1024) + ' KB' : '', fmtDate(doc.geupload_op)].filter(Boolean).join(' · '),
        });
      } else if (action === 'del-doc') {
        if (!confirm('Document verwijderen?')) return;
        const doc = DB.byId(KEYS.DOCUMENTEN, tid); if (!doc) return;
        await Storage.remove(doc.storage_pad);
        await DB.remove(KEYS.DOCUMENTEN, tid);
        await DB.touchDossier(id); renderDossierDetail({ id });
      }
    } catch (_) {}
  };
}
