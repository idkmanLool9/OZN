// Dossier detail: overzicht + taken + kosten + notities + print

function renderDossierDetail(params) {
  const id = parseInt(params.id, 10);
  const d = DB.byId(KEYS.DOSSIERS, id);
  if (!d) return render404();

  const kosten = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
  // Mag deze gebruiker prijzen zien en kosten bewerken? (server dwingt óók af)
  const magPrijzen  = (typeof Auth !== 'undefined' && typeof Auth.magPrijzenZien === 'function') ? Auth.magPrijzenZien() : true;
  const kanBewerken = true; // medewerkers mogen ook kosten toevoegen/verwijderen (prijzen blijven verborgen)
  const notities = DB.where(KEYS.NOTITIES, n => n.dossier_id === id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const betaald = kosten.filter(k => k.betaald).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const moetNogBetalen = Math.max(0, totaal - betaald);

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
            · Laatst opgeslagen: <strong title="${esc(d.updated_at ? new Date(d.updated_at).toLocaleString('nl-NL') : '')}">${esc(fmtRelative(d.updated_at) || '—')}</strong>${d.bijgewerkt_door ? ' door <strong>' + esc(d.bijgewerkt_door) + '</strong>' : ''}
          </p>
        </div>
        <div class="page-actions">
          ${magPrijzen ? `<a href="#/dossiers/${d.id}/factuur" class="btn btn-ghost" title="Kostenraming openen">📄 Kostenraming</a>` : ''}
          ${magPrijzen ? `<button type="button" class="btn btn-ghost" id="btn-email-factuur" title="Stuur factuur per e-mail">📧 E-mail factuur</button>` : ''}
          <a href="#/dossiers/${d.id}/bewerken" class="btn btn-primary">Bewerken</a>
          <details class="page-actions-more">
            <summary class="btn btn-ghost" title="Meer acties">⋯</summary>
            <div class="page-actions-menu">
              <button type="button" class="btn btn-ghost btn-block" id="btn-email-dossier">📧 E-mail dossier</button>
              <button type="button" class="btn btn-ghost btn-block" id="btn-print">📄 Opslaan / delen als PDF</button>
              <button type="button" class="btn btn-ghost btn-block" id="btn-copy-nr">⧉ Kopieer dossiernummer</button>
              ${(typeof Auth !== 'undefined' && Auth.isBeheerder()) ? `<button type="button" class="btn btn-ghost btn-block" id="btn-archief">${d.gearchiveerd ? '📤 Uit archief halen' : '📦 Archiveren'}</button>` : ''}
              ${(typeof Auth !== 'undefined' && Auth.isBeheerder()) ? `<button type="button" class="btn btn-danger btn-block" id="btn-delete">🗑 Verwijderen</button>` : ''}
            </div>
          </details>
        </div>
      </div>

      <nav class="tabs">
        <a href="#/dossiers/${d.id}#overzicht">Overzicht</a>
        <a href="#/dossiers/${d.id}#kosten">Kosten</a>
        <a href="#/dossiers/${d.id}#notities">Notities (${notities.length})</a>
      </nav>

      ${(() => {
        const missend = dossierMissendeBelangrijkeVelden(d);
        if (!missend.length) return '';
        const dagen = d.created_at ? Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000) : 0;
        return `<div class="alert alert-warn dossier-missend-banner">
          <strong>⚠ Nog niet ingevuld:</strong> ${missend.map(esc).join(', ')}.
          ${dagen >= 2 ? `<span class="muted small">Dossier is ${dagen} dagen oud — vul aan waar mogelijk.</span>` : ''}
        </div>`;
      })()}

      <section id="overzicht" class="card">
        <div class="print-header">
          <div><h2 style="border:none;padding:0;background:none;">Dossier</h2><p style="margin:0;">${esc([Settings.get('app_name') || 'OZN', Settings.get('app_tagline')].filter(Boolean).join(' · '))}</p></div>
          <div class="meta"><p><strong>${esc(d.dossier_nummer)}</strong></p><p>Status: ${esc((d.status||'').replace('_',' '))}</p><p>Afgedrukt: ${new Date().toLocaleString('nl-NL')}</p></div>
        </div>
        <h2>Overzicht</h2>

        <h3>Overledene</h3>
        <dl class="dl">
          ${dlRow('Dossiernummer', d.dossier_nummer)}
          ${dlRow('Opdrachtgever', d.opdrachtgever_naam)}
          ${(Array.isArray(d.extra_personeel) && d.extra_personeel.length) ? dlRow('Extra personeel', d.extra_personeel.join(', ')) : ''}
          ${dlRow('Naam', fullName(d))}
          ${dlRow('Geslacht', d.geslacht)}
          ${dlRow('Geboren', [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' '))}
          ${dlRow('Overleden', [fmtDate(d.overlijdensdatum), d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' '))}
          ${dlRow('Adres', [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', '))}
          ${d.artsverklaring_pad ? `<div><dt>Artsverklaring</dt><dd><button type="button" class="link-btn" id="btn-view-artsverklaring">📄 Bekijk scan</button></dd></div>` : ''}
          ${d.overdraagformulier_pad ? `<div><dt>Overdraagformulier</dt><dd><button type="button" class="link-btn" id="btn-view-overdraag">📄 Bekijk scan</button></dd></div>` : ''}
        </dl>
        ${(() => {
          const items = [
            ['Oorbel(en)',  d.bezit_oorbellen, d.bezit_oorbellen_aantal, d.bezit_oorbellen_foto],
            ['Ring(en)',    d.bezit_ringen,    d.bezit_ringen_aantal,    d.bezit_ringen_foto],
            ['Armband(en)', d.bezit_armbanden, d.bezit_armbanden_aantal, d.bezit_armbanden_foto],
          ].filter(([, heeft]) => heeft === 'ja');
          const extras = Array.isArray(d.extra_bezittingen) ? d.extra_bezittingen.filter(x => x && x.label) : [];
          if (!items.length && !extras.length) return '';
          const rijMet = (label, aantal, foto) => {
            const txt = aantal ? `${aantal} stuk(s)` : 'ja';
            // dlRow escapt strings behalve als ze met '<' beginnen; dus prefix
            // met een <span> zodat de knop-HTML intact blijft.
            const inhoud = foto
              ? `<span>${esc(txt)}</span> <button type="button" class="link-btn" data-bezit-foto="${esc(foto)}">📷 Bekijk foto</button>`
              : txt;
            return dlRow(label, inhoud);
          };
          return `<h3>Bezittingen</h3><dl class="dl">${
            items.map(([label, , aantal, foto]) => rijMet(label, aantal, foto)).join('')
          }${
            extras.map(x => rijMet(x.label, x.aantal, x.foto_pad)).join('')
          }</dl>`;
        })()}
        <h3>Opbaren &amp; locatie</h3>
        <dl class="dl">
          ${dlRow('Ophalen / thuis opbaren', d.opbaring_type === 'thuis' ? 'Thuis opbaren' : (d.opbaring_type === 'ophalen' ? 'Ophalen' : (d.opbaring_type === 'beide' ? 'Ophalen + Thuis opbaren' : '')))}
          ${((d.opbaring_type === 'ophalen' || d.opbaring_type === 'beide') && Array.isArray(d.brengen_naar) && d.brengen_naar.length)
            ? `<div><dt>Brengen naar</dt><dd>${d.brengen_naar.map(_routeStr).filter(Boolean).join(' → ')}</dd></div>` : ''}
          ${((d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') && Array.isArray(d.thuis_overbrengingen) && d.thuis_overbrengingen.length)
            ? `<div><dt>Overbrengingen (thuis)</dt><dd>${d.thuis_overbrengingen.map(_routeStr).filter(Boolean).join(' → ')}</dd></div>` : ''}
          ${(d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') ? dlRow('Start thuis-opbaring', [fmtDate(d.thuis_opbaren_datum), d.thuis_opbaren_tijd && 'om ' + d.thuis_opbaren_tijd].filter(Boolean).join(' ')) : ''}
          ${(d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') ? dlRow('Einde thuis-opbaring', [fmtDate(d.thuis_opbaren_einddatum), d.thuis_opbaren_eindtijd && 'om ' + d.thuis_opbaren_eindtijd].filter(Boolean).join(' ')) : ''}
          ${((d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') && Array.isArray(d.rouwgoederen_lijst) && d.rouwgoederen_lijst.length)
            ? dlRow('Benodigde rouwgoederen', d.rouwgoederen_lijst.map(esc).join(', ')) : ''}
          ${((d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') && d.benodigde_rouwgoederen)
            ? `<div><dt>Extra (vrije tekst)</dt><dd class="prewrap">${esc(d.benodigde_rouwgoederen)}</dd></div>` : ''}
          ${dlRow('Opbaarlocatie', d.opbaarlocatie_type)}
          ${(d.opbaring_type === 'ophalen' || d.opbaring_type === 'beide') ? dlRow('Ophaaldatum', [fmtDate(d.ophalen_datum), d.ophalen_tijd && 'om ' + d.ophalen_tijd].filter(Boolean).join(' ')) : ''}
          ${d.opbaring_bed ? dlRow('Bed-opbaring', 'Ja') : ''}
          ${d.opbaring_kist ? dlRow('Kist-opbaring', 'Ja') : ''}
        </dl>
        ${(() => {
          // Verzorging: alleen tonen als er iets is ingevuld
          const items = [
            [d.verzorgd_gekleed_datum || d.verzorgd_gekleed_waar || d.verzorgd_gekleed_familie,
              'Verzorgd / gekleed',
              [fmtDate(d.verzorgd_gekleed_datum), d.verzorgd_gekleed_waar && 'te ' + d.verzorgd_gekleed_waar, d.verzorgd_gekleed_familie && '(' + d.verzorgd_gekleed_familie + ' familie)'].filter(Boolean).join(' ')],
            [d.gekist_datum || d.gekist_waar,
              'Gekist',
              [fmtDate(d.gekist_datum), d.gekist_waar && 'te ' + d.gekist_waar].filter(Boolean).join(' ')],
            [d.mond_gehecht, 'Mond gehecht', 'Ja'],
            [d.oogkapjes, 'Oogkapjes', 'Ja'],
            [d.buikpunctie, 'Buikpunctie', 'Ja'],
            [d.peacemaker_verwijderd, 'Peacemaker verwijderd',
              [d.peacemaker_verwijderd_datum && 'op ' + fmtDate(d.peacemaker_verwijderd_datum)].filter(Boolean).join(' ') || 'Ja'],
            [d.thanatopraxie, 'Thanatopraxie',
              [d.thanatopraxie_datum && 'op ' + fmtDate(d.thanatopraxie_datum), d.thanatopraxie_waar && 'te ' + d.thanatopraxie_waar].filter(Boolean).join(' ') || 'Ja'],
          ].filter(([has]) => has);
          if (!items.length) return '';
          return `<h3>Verzorging</h3><dl class="dl">${items.map(([, label, val]) => dlRow(label, val)).join('')}</dl>`;
        })()}
        ${(() => {
          const rows = [];
          if (d.kist_type) rows.push(dlRow('Kist', kistRowValue(d.kist_type, magPrijzen)));
          if (d.rouwauto) rows.push(dlRow('Rouwauto', d.rouwauto === 'ja' ? 'Ja' : (d.rouwauto === 'nee' ? 'Nee' : d.rouwauto)));
          if (!rows.length) return '';
          return `<h3>Kist &amp; vervoer</h3><dl class="dl">${rows.join('')}</dl>`;
        })()}
        ${(() => {
          // Betaling: alleen tonen wat daadwerkelijk is ingevuld (geen lege
          // streepjes-sectie meer).
          const rows = [
            ['Betaalwijze', d.betaalwijze],
            ...(magPrijzen ? [
              ['Aanbetaling', d.aanbetaling_bedrag ? fmtEUR(d.aanbetaling_bedrag) + (d.aanbetaling_datum ? ' op ' + fmtDate(d.aanbetaling_datum) : '') : ''],
              ['Eindafrekening', d.eindafrekening_bedrag ? fmtEUR(d.eindafrekening_bedrag) + (d.eindafrekening_status ? ' (' + d.eindafrekening_status + ')' : '') : ''],
            ] : []),
            ['Betalingstermijn', d.betalingstermijn],
          ].filter(([, v]) => v && String(v).trim());
          if (!rows.length) return '';
          return `<h3>Betaling</h3><dl class="dl">${rows.map(([l, v]) => dlRow(l, v)).join('')}</dl>`;
        })()}
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

      <section id="kosten" class="card kosten-card ${localStorage.getItem('sok_kosten_collapsed') !== '0' ? 'collapsed' : ''}">
        <button type="button" class="kosten-header" id="btn-kosten-toggle" aria-expanded="${localStorage.getItem('sok_kosten_collapsed') !== '0' ? 'false' : 'true'}" aria-controls="kosten-body" title="Klik om in- of uit te klappen">
          <span class="kosten-chevron" aria-hidden="true">▾</span>
          <h2 style="border:none;padding:0;margin:0;display:inline;">Kosten</h2>
          ${kosten.length > 0 ? `<span class="muted small kosten-summary">· ${kosten.length} ${kosten.length === 1 ? 'post' : 'posten'}${magPrijzen ? ` · ${fmtEUR(totaal)}${moetNogBetalen > 0 ? ` · <strong style="color:#b34;">open ${fmtEUR(moetNogBetalen)}</strong>` : ' · <strong style="color:#2a7a3a;">volledig betaald</strong>'}` : (kosten.every(k => k.betaald) ? ' · <strong style="color:#2a7a3a;">afgevinkt</strong>' : '')}</span>` : ''}
          ${(kosten.length > 0 && magPrijzen) ? `<a href="#/dossiers/${d.id}/factuur" class="btn btn-sm kosten-factuur-link" onclick="event.stopPropagation()">📄 Kostenraming openen</a>` : ''}
        </button>
        <div id="kosten-body" class="kosten-body">
        ${kosten.length === 0 ? '<p class="muted">Nog geen kostenposten.</p>' : (() => {
          // Groepeer per categorie in vaste volgorde, en sorteer ITEMS
          // binnen elke groep volgens KOSTEN_PRESETS-volgorde (zodat de
          // lijst dezelfde rangschikking volgt als 'Snel toevoegen').
          const presetIdx = new Map();
          KOSTEN_PRESETS.forEach((p, i) => { if (!p.nav) presetIdx.set(p.omschrijving, i); });
          const KIST_TAG = 'Kist: ', BLOEM_TAG = '🌸 ', ETEN_TAG = '🍽 ';
          const navIdx = {
            [KIST_TAG]:  KOSTEN_PRESETS.findIndex(p => p.nav === 'kist'),
            [BLOEM_TAG]: KOSTEN_PRESETS.findIndex(p => p.nav === 'bloemen'),
            [ETEN_TAG]:  KOSTEN_PRESETS.findIndex(p => p.nav === 'eten'),
          };
          const presetRank = (oms) => {
            if (presetIdx.has(oms)) return presetIdx.get(oms) * 10;
            for (const tag in navIdx) if (oms.startsWith(tag)) return navIdx[tag] * 10 + 5;
            return KOSTEN_PRESETS.length * 10 + 100;
          };
          const buckets = {};
          kosten.forEach(k => {
            const cat = k.categorie || 'overig';
            (buckets[cat] = buckets[cat] || []).push(k);
          });
          Object.keys(buckets).forEach(cat => {
            buckets[cat].sort((a, b) => {
              const ra = presetRank(a.omschrijving || '');
              const rb = presetRank(b.omschrijving || '');
              return ra !== rb ? ra - rb : (a.id - b.id);
            });
          });
          const orderIds = KOSTEN_CATEGORIEEN.map(c => c.id);
          const orderedCats = orderIds.filter(id => buckets[id])
            .concat(Object.keys(buckets).filter(id => !orderIds.includes(id)));

          return `
          <div class="kosten-groups">
            ${orderedCats.map(cat => {
              const items = buckets[cat];
              const sub = items.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
              return `
              <div class="kosten-group">
                <div class="kosten-group-head">
                  <span class="kosten-group-title">${categorieIcon(cat)} ${esc(categorieLabel(cat))}</span>
                  <span class="kosten-group-sub muted small">${items.length} ${items.length === 1 ? 'post' : 'posten'}${magPrijzen ? ` · ${fmtEUR(sub)}` : ''}</span>
                </div>
                <table class="table kosten-table">
                  <colgroup>
                    <col class="kc-col-omschrijving">
                    <col class="kc-col-aantal">
                    ${magPrijzen ? '<col class="kc-col-bedrag">' : ''}
                    ${kanBewerken ? '<col class="kc-col-del">' : ''}
                  </colgroup>
                  <tbody>
                    ${items.map(k => {
                      const aantal = Number(k.aantal) || 1;
                      const stuk   = aantal > 0 ? (Number(k.bedrag) || 0) / aantal : 0;
                      return `<tr>
                      <td class="kc-omschrijving">${esc(k.omschrijving)}${(magPrijzen && aantal !== 1) ? ` <span class="muted small">(${fmtEUR(stuk)} per stuk)</span>` : ''}${k.betaald ? ' <span class="badge badge-green" title="Afgevinkt / betaald">✓</span>' : ''}</td>
                      <td class="kc-aantal">${kanBewerken
                        ? `<input type="number" class="kc-aantal-input" data-id="${k.id}" data-stuk="${stuk}" value="${esc(aantal)}" min="0" step="1" inputmode="numeric">`
                        : `<span class="muted">${esc(aantal)}×</span>`}</td>
                      ${magPrijzen ? `<td class="kc-bedrag num">${fmtEUR(k.bedrag)}</td>` : ''}
                      ${kanBewerken ? `<td class="kc-del"><button type="button" class="btn-icon" data-action="del-kosten" data-id="${k.id}" title="Verwijderen">×</button></td>` : ''}
                    </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>`;
            }).join('')}
          </div>
          <div class="kosten-totals">
            ${magPrijzen ? `
            <div class="kosten-total-row">
              <span>Totaal factuur</span>
              <strong class="num">${fmtEUR(totaal)}</strong>
            </div>` : ''}
            ${kosten.length > 0 ? (() => {
              const allesAf = kosten.every(k => k.betaald);
              const label = magPrijzen
                ? (moetNogBetalen === 0 ? '✓ Volledig betaald' : '○ Nog open')
                : (allesAf ? '✓ Afgevinkt' : '○ Nog te doen');
              const on = magPrijzen ? (moetNogBetalen === 0) : allesAf;
              return `
              <div class="kosten-total-row">
                <span>Status</span>
                <button type="button" class="kost-toggle kost-toggle-big ${on ? 'on-betaald' : 'off-betaald'}" data-action="toggle-factuur-betaald" title="Klik om te wisselen">
                  ${label}
                </button>
              </div>`;
            })() : ''}
          </div>`;
        })()}
        ${!kanBewerken ? '' : `
        <h3 style="margin-top:1rem;">Snel toevoegen uit catalogus</h3>
        <p class="muted small">Klik om een vast tarief direct toe te voegen.${(() => {
          const adminMode = !!Settings.get('catalog_admin_mode');
          return adminMode ? ' <em>Beheermodus aan — gebruik ✏️ om de prijs aan te passen, 🗑 om te verbergen.</em>' : '';
        })()}</p>
        <div class="preset-grid">
          ${(() => {
            const adminMode = !!Settings.get('catalog_admin_mode');
            return effectieveKostenPresets({ includeHidden: adminMode }).map((p, i) => {
              const cls = 'btn preset-btn'
                + (p.nav ? ' preset-nav preset-nav-' + p.nav : '')
                + (p._hidden ? ' is-hidden-preset' : '');
              const trailing = magPrijzen
                ? ((p.bedrag != null && p.bedrag !== '')
                    ? `<strong>${p.vraagPrijs ? '± ' : ''}${fmtEUR(p.bedrag)}${p._customBedrag && !p.vraagPrijs ? ' ✏️' : ''}</strong>`
                    : (p.nav ? '<strong class="muted">→</strong>' : ''))
                : (p.nav ? '<strong class="muted">→</strong>' : '');
              const adminCtrls = (adminMode && !p.nav)
                ? `<span class="preset-admin">
                    <button type="button" class="preset-edit" data-action="edit-preset" data-preset="${i}" title="Prijs aanpassen">✏️</button>
                    ${p._hidden
                      ? `<button type="button" class="preset-show" data-action="show-preset" data-preset="${i}" title="Herstel kostenpost">↺</button>`
                      : `<button type="button" class="preset-hide" data-action="hide-preset" data-preset="${i}" title="Verwijder uit lijst">🗑</button>`}
                  </span>`
                : '';
              return `<span class="preset-wrap">
                <button type="button" class="${cls}" data-action="add-preset" data-preset="${i}" ${p._hidden ? 'disabled' : ''}>
                  <span>${esc(p.omschrijving)}${p.food ? ' <span class="badge badge-amber" title="Aantal wordt gevraagd bij toevoegen">×N</span>' : ''}${p.vraagPrijs ? ' <span class="badge badge-amber" title="Richtprijs — werkelijk bedrag wordt gevraagd">±</span>' : ''}</span>
                  ${trailing}
                </button>
                ${adminCtrls}
              </span>`;
            }).join('');
          })()}
        </div>
        <h3 style="margin-top:1rem;">Of voeg handmatig toe</h3>
        <form id="add-kosten" class="row-form">
          <input type="text" name="omschrijving" placeholder="Omschrijving..." required>
          <select name="categorie">
            <option value="">Categorie</option>
            ${KOSTEN_CATEGORIEEN.map(c =>
              `<option value="${c.id}">${esc(c.label)}</option>`).join('')}
          </select>
          <input type="number" name="aantal" placeholder="Aantal" min="1" step="1" inputmode="numeric" value="1" style="max-width:80px;">
          ${magPrijzen ? '<input type="text" name="bedrag" placeholder="Prijs per stuk" inputmode="decimal" style="max-width:130px;">' : ''}
          <label class="checkbox-inline"><input type="checkbox" name="betaald"> betaald</label>
          <button type="submit" class="btn">+ Toevoegen</button>
        </form>`}
        </div><!-- /.kosten-body -->
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
  return `<h3 style="margin:18px 0 4px;font-family:inherit;font-size:15px;font-weight:600;color:#2563eb;border-bottom:1px solid #e5e2da;padding-bottom:4px;">${esc(t)}</h3>`;
}

// E-mail-footer: donker balkje met links + socials + adres,
// onderaan elke uitgaande mail. Configureerbaar via Account.
function buildEmailFooter() {
  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
  if (s.email_footer_enabled === false) return '';

  const linkStyle = 'color:#a8b3c6;text-decoration:none;';
  const links = [];
  if (s.email_footer_terms_url)
    links.push(`<a href="${esc(s.email_footer_terms_url)}" style="${linkStyle}">Algemene Voorwaarden</a>`);
  if (s.email_footer_privacy_url)
    links.push(`<a href="${esc(s.email_footer_privacy_url)}" style="${linkStyle}">Privacy Voorwaarden</a>`);
  const linksRow = links.length
    ? `<div style="margin-bottom:14px;font-size:13px;">${links.join(' &nbsp;|&nbsp; ')}</div>` : '';

  const socials = [];
  if (s.email_footer_facebook_url) {
    socials.push(`<a href="${esc(s.email_footer_facebook_url)}" style="${linkStyle}display:inline-block;width:28px;height:28px;line-height:26px;border:1px solid #a8b3c6;border-radius:50%;margin:0 4px;font-weight:700;font-family:Arial,sans-serif;">f</a>`);
  }
  if (s.email_footer_instagram_url) {
    socials.push(`<a href="${esc(s.email_footer_instagram_url)}" style="${linkStyle}display:inline-block;width:28px;height:28px;line-height:26px;border:1px solid #a8b3c6;border-radius:50%;margin:0 4px;font-family:Arial,sans-serif;">IG</a>`);
  }
  const socialsRow = socials.length
    ? `<div style="margin-bottom:14px;">${socials.join('')}</div>` : '';

  const addrRow = s.email_footer_address
    ? `<div style="font-size:12px;color:#cfd6e3;margin-bottom:4px;">${esc(s.email_footer_address)}</div>` : '';

  // Contact-regel met ·-separator: alleen ingevulde velden tonen
  const contactParts = [];
  if (s.email_footer_phone)   contactParts.push(`<a href="tel:${esc(s.email_footer_phone.replace(/\s+/g,''))}" style="${linkStyle}">${esc(s.email_footer_phone)}</a>`);
  if (s.email_footer_email)   contactParts.push(`<a href="mailto:${esc(s.email_footer_email)}" style="${linkStyle}">${esc(s.email_footer_email)}</a>`);
  if (s.email_footer_website) {
    const url = /^https?:\/\//.test(s.email_footer_website) ? s.email_footer_website : 'https://' + s.email_footer_website;
    const label = s.email_footer_website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    contactParts.push(`<a href="${esc(url)}" style="${linkStyle}">${esc(label)}</a>`);
  }
  const contactRow = contactParts.length
    ? `<div style="font-size:12px;color:#a8b3c6;">${contactParts.join(' &nbsp;·&nbsp; ')}</div>` : '';

  if (!linksRow && !socialsRow && !addrRow && !contactRow) return '';

  return `
    <div style="margin-top:28px;background:#101a35;padding:28px 20px;border-radius:6px;text-align:center;font-family:system-ui,Arial,sans-serif;color:#a8b3c6;">
      ${linksRow}
      ${socialsRow}
      ${addrRow}
      ${contactRow}
    </div>`;
}

// Sorteer kosten volgens KOSTEN_PRESETS-volgorde (zelfde rangschikking
// als de 'Snel toevoegen'-lijst en het kostenoverzicht in het formulier).
function _kostenInPresetVolgorde(kosten) {
  const presetIdx = new Map();
  KOSTEN_PRESETS.forEach((p, i) => { if (!p.nav) presetIdx.set(p.omschrijving, i); });
  const tagAfter = {
    'Kist: ':  KOSTEN_PRESETS.findIndex(p => p.nav === 'kist'),
    '🌸 ':     KOSTEN_PRESETS.findIndex(p => p.nav === 'bloemen'),
    '🍽 ':     KOSTEN_PRESETS.findIndex(p => p.nav === 'eten'),
  };
  const rank = (k) => {
    const oms = k.omschrijving || '';
    if (presetIdx.has(oms)) return [presetIdx.get(oms) * 10, 0];
    for (const tag in tagAfter) if (oms.startsWith(tag)) return [tagAfter[tag] * 10 + 5, 0];
    return [KOSTEN_PRESETS.length * 10 + 100, Number(k.id) || 0];
  };
  return kosten.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    return ra[0] !== rb[0] ? ra[0] - rb[0] : ra[1] - rb[1];
  });
}

// Spec voor de PDF-generator (jsPDF) — volledig dossieroverzicht.
function dossierSpec(d, kosten) {
  const adresO = [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', ');
  const magPrijs = (typeof Auth === 'undefined') || Auth.magPrijzenZien();
  const kostenLijst = Array.isArray(kosten) ? _kostenInPresetVolgorde(kosten) : [];
  const totaal = kostenLijst.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);

  const bezit = [
    ['Oorbel(en)',  d.bezit_oorbellen, d.bezit_oorbellen_aantal],
    ['Ring(en)',    d.bezit_ringen,    d.bezit_ringen_aantal],
    ['Armband(en)', d.bezit_armbanden, d.bezit_armbanden_aantal],
  ].filter(([, heeft]) => heeft === 'ja');

  const sections = [
    { heading: 'Overledene', rows: [
      ['Naam', fullName(d)], ['Geslacht', d.geslacht],
      ['Geboren', [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' ')],
      ['Overleden', [fmtDate(d.overlijdensdatum), d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' ')],
      ['Adres', adresO],
    ] },
    { heading: 'Opbaren & locatie', rows: [
      ['Ophalen / thuis opbaren', d.opbaring_type === 'thuis' ? 'Thuis opbaren' : (d.opbaring_type === 'ophalen' ? 'Ophalen' : (d.opbaring_type === 'beide' ? 'Ophalen + Thuis opbaren' : ''))],
      ...((d.opbaring_type === 'ophalen' || d.opbaring_type === 'beide') ? [
        ['Ophaaldatum', [fmtDate(d.ophalen_datum), d.ophalen_tijd && 'om ' + d.ophalen_tijd].filter(Boolean).join(' ')],
        ['Brengen naar', Array.isArray(d.brengen_naar) ? d.brengen_naar.map(_routePlain).filter(Boolean).join(' → ') : ''],
      ] : []),
      ...((d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') ? [
        ['Datum & begintijd thuis', [fmtDate(d.thuis_opbaren_datum), d.thuis_opbaren_tijd && 'om ' + d.thuis_opbaren_tijd].filter(Boolean).join(' ')],
        ['Overbrengingen thuis', Array.isArray(d.thuis_overbrengingen) ? d.thuis_overbrengingen.map(_routePlain).filter(Boolean).join(' → ') : ''],
        ['Benodigde rouwgoederen', d.benodigde_rouwgoederen],
      ] : []),
      ['Opbaarlocatie', d.opbaarlocatie_type],
    ] },
    { heading: 'Kist & vervoer', rows: [
      ['Kist', d.kist_type],
      ['Rouwauto', d.rouwauto === 'ja' ? 'Ja' : (d.rouwauto === 'nee' ? 'Nee' : d.rouwauto)],
    ] },
  ];
  if (bezit.length) {
    sections.push({ heading: 'Bezittingen', rows: bezit.map(([label, , aantal]) => [label, aantal ? aantal + ' stuk(s)' : 'ja']) });
  }
  sections.push({ heading: 'Opdrachtgever', rows: [
    ['Naam', d.opdrachtgever_naam],
    ['Extra personeel', Array.isArray(d.extra_personeel) ? d.extra_personeel.join(', ') : ''],
  ] });

  return {
    title: 'DOSSIER',
    meta: ['Dossier: ' + (d.dossier_nummer || ''), 'Datum: ' + new Date().toLocaleDateString('nl-NL')],
    sections,
    // Medewerkers: kostenoverzicht zonder bedragen (alleen omschrijving + categorie + aantal)
    table: kostenLijst.length
      ? (magPrijs
          ? { heading: 'Kostenoverzicht', rows: kostenLijst.map(k => [k.omschrijving || '', k.categorie || '', fmtEUR(k.bedrag)]) }
          : { heading: 'Kostenposten', rows: kostenLijst.map(k => [k.omschrijving || '', k.categorie || '', String(k.aantal || 1) + ' stuk(s)']) })
      : null,
    totals: (kostenLijst.length && magPrijs) ? [['Totaal', fmtEUR(totaal), true]] : [],
  };
}

function buildDossierEmail(d, kosten) {
  const adresO = [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', ');
  const magPrijs = (typeof Auth === 'undefined') || Auth.magPrijzenZien();

  const parts = [];
  parts.push(`<p style="margin:0 0 12px;">Beste,</p>`);
  parts.push(`<p style="margin:0 0 14px;">Hierbij de gegevens van het uitvaartdossier <strong>${esc(d.dossier_nummer || '')}</strong>${d.status ? ' (status: ' + esc((d.status||'').replace('_',' ')) + ')' : ''}.</p>`);

  // Alleen secties met inhoud tonen (geen lege kopjes).
  const pushSection = (titel, rows) => {
    const gevuld = rows.filter(([, v]) => v && String(v).trim());
    if (!gevuld.length) return;
    parts.push(emH3(titel));
    parts.push(emTable(gevuld));
  };

  pushSection('Overledene', [
    ['Naam', fullName(d)],
    ['Geslacht', d.geslacht],
    ['Geboren', [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' ')],
    ['Overleden', [fmtDate(d.overlijdensdatum), d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' ')],
    ['Adres', adresO],
  ]);

  pushSection('Opbaren & locatie', [
    ['Ophalen / thuis opbaren', d.opbaring_type === 'thuis' ? 'Thuis opbaren' : (d.opbaring_type === 'ophalen' ? 'Ophalen' : (d.opbaring_type === 'beide' ? 'Ophalen + Thuis opbaren' : ''))],
    ...((d.opbaring_type === 'ophalen' || d.opbaring_type === 'beide') ? [
      ['Ophaaldatum', [fmtDate(d.ophalen_datum), d.ophalen_tijd && 'om ' + d.ophalen_tijd].filter(Boolean).join(' ')],
      ['Brengen naar', Array.isArray(d.brengen_naar) ? d.brengen_naar.map(_routePlain).filter(Boolean).join(' → ') : ''],
    ] : []),
    ...((d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') ? [
      ['Datum & begintijd thuis', [fmtDate(d.thuis_opbaren_datum), d.thuis_opbaren_tijd && 'om ' + d.thuis_opbaren_tijd].filter(Boolean).join(' ')],
      ['Overbrengingen thuis', Array.isArray(d.thuis_overbrengingen) ? d.thuis_overbrengingen.map(_routePlain).filter(Boolean).join(' → ') : ''],
      ['Benodigde rouwgoederen', d.benodigde_rouwgoederen],
    ] : []),
    ['Opbaarlocatie', d.opbaarlocatie_type],
  ]);

  pushSection('Kist & vervoer', [
    ['Kist', d.kist_type],
    ['Rouwauto', d.rouwauto === 'ja' ? 'Ja' : (d.rouwauto === 'nee' ? 'Nee' : d.rouwauto)],
  ]);

  pushSection('Bezittingen', [
    ['Oorbel(en)',  d.bezit_oorbellen  === 'ja' ? (d.bezit_oorbellen_aantal ? d.bezit_oorbellen_aantal + ' stuk(s)' : 'ja') : ''],
    ['Ring(en)',    d.bezit_ringen     === 'ja' ? (d.bezit_ringen_aantal    ? d.bezit_ringen_aantal    + ' stuk(s)' : 'ja') : ''],
    ['Armband(en)', d.bezit_armbanden  === 'ja' ? (d.bezit_armbanden_aantal ? d.bezit_armbanden_aantal + ' stuk(s)' : 'ja') : ''],
  ]);

  pushSection('Opdrachtgever', [
    ['Naam', d.opdrachtgever_naam],
    ['Extra personeel', Array.isArray(d.extra_personeel) ? d.extra_personeel.join(', ') : ''],
  ]);

  // ─── Kostenoverzicht ──────────────────────────────────────────────────
  const kostenLijst = Array.isArray(kosten) ? _kostenInPresetVolgorde(kosten) : [];
  const totaalKost = kostenLijst.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const betaaldKost = kostenLijst.filter(k => k.betaald).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const openKost = Math.max(0, totaalKost - betaaldKost);
  parts.push(emH3(magPrijs ? 'Kostenoverzicht' : 'Kostenposten'));
  if (kostenLijst.length === 0) {
    parts.push(`<p style="color:#6f6a62;font-style:italic;margin:6px 0 14px;">Geen kostenposten geregistreerd.</p>`);
  } else {
    parts.push(`<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:13px;">
      <thead>
        <tr style="background:#f6f4ef;">
          <th align="left"  style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Omschrijving</th>
          <th align="left"  style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Categorie</th>
          <th align="right" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Aantal</th>
          ${magPrijs ? '<th align="right" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Bedrag</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${kostenLijst.map(k => {
          const aantal = Number(k.aantal) || 1;
          const stuk = aantal > 0 ? (Number(k.bedrag) || 0) / aantal : 0;
          return `<tr>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;">${esc(k.omschrijving)}${(magPrijs && aantal !== 1) ? ` <span style="color:#8a847b;font-size:11px;">(${esc(fmtEUR(stuk))} per stuk)</span>` : ''}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;color:#6f6a62;">${esc(categorieLabel(k.categorie))}</td>
            <td align="right" style="padding:7px 10px;border-bottom:1px solid #f0eee8;font-variant-numeric:tabular-nums;">${aantal}</td>
            ${magPrijs ? `<td align="right" style="padding:7px 10px;border-bottom:1px solid #f0eee8;font-variant-numeric:tabular-nums;">${esc(fmtEUR(k.bedrag))}${k.betaald ? ' <span style="color:#2a7a3a;font-size:11px;">✓</span>' : ''}</td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        ${magPrijs ? `<tr>
          <td colspan="3" align="right" style="padding:8px 10px;font-weight:600;border-top:2px solid #d8d4ca;">Totaal</td>
          <td align="right" style="padding:8px 10px;font-weight:600;font-variant-numeric:tabular-nums;border-top:2px solid #d8d4ca;">${esc(fmtEUR(totaalKost))}</td>
        </tr>` : ''}
        ${(magPrijs && betaaldKost > 0) ? `<tr>
          <td colspan="3" align="right" style="padding:6px 10px;color:#2a7a3a;">Reeds betaald</td>
          <td align="right" style="padding:6px 10px;color:#2a7a3a;font-variant-numeric:tabular-nums;">- ${esc(fmtEUR(betaaldKost))}</td>
        </tr>` : ''}
        ${(magPrijs && openKost > 0) ? `<tr>
          <td colspan="3" align="right" style="padding:8px 10px;font-weight:700;color:#b34;">Open saldo</td>
          <td align="right" style="padding:8px 10px;font-weight:700;color:#b34;font-variant-numeric:tabular-nums;">${esc(fmtEUR(openKost))}</td>
        </tr>` : ''}
      </tfoot>
    </table>`);
  }

  if (d.bijzonderheden) {
    parts.push(emH3('Bijzonderheden'));
    parts.push(`<p style="white-space:pre-wrap;margin:6px 0 14px;font-size:14px;line-height:1.55;">${esc(d.bijzonderheden)}</p>`);
  }

  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
  parts.push(`<p style="margin:18px 0 0;font-size:13px;color:#6f6a62;">Met vriendelijke groet,<br><strong>${esc(s.app_name || 'Uitvaartleider')}</strong>${s.app_tagline ? '<br>' + esc(s.app_tagline) : ''}</p>`);
  parts.push(buildEmailFooter());
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
            <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;">Door familie te betalen</td>
            <td align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;font-variant-numeric:tabular-nums;">${esc(fmtEUR(familie))}</td>
          </tr>` : ''}
        ${aanbet > 0 ? `
          <tr>
            <td colspan="2" align="right" style="padding:6px 10px;color:#6f6a62;">Aanbetaling${d.aanbetaling_datum ? ' (' + fmtDate(d.aanbetaling_datum) + ')' : ''}</td>
            <td align="right" style="padding:6px 10px;color:#6f6a62;font-variant-numeric:tabular-nums;">- ${esc(fmtEUR(aanbet))}</td>
          </tr>
          <tr style="background:#f5e8ea;">
            <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;">Nog te voldoen</td>
            <td align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;font-variant-numeric:tabular-nums;">${esc(fmtEUR(teBetalen))}</td>
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
  parts.push(buildEmailFooter());
  return parts.join('\n');
}

// Open de mail-app met to+subject; bij een lange body (mailto URL loopt vast
// rond ~2000 tekens op iOS) knippen we de inhoud af en zetten we de volledige
// tekst op het klembord — de gebruiker plakt 'm dan in de mail.
async function openMailto(to, subject, body) {
  const MAX_URL = 1800;
  let effectiveBody = body || '';
  let clipped = false;
  // Ruwe HTML → platte tekst voor de mail-app (mail apps kunnen geen HTML
  // via mailto:).
  const plat = _mailToPlainText(effectiveBody);
  let url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plat)}`;
  if (url.length > MAX_URL) {
    clipped = true;
    const kort = plat.slice(0, 400) + '\n\n(De volledige tekst is gekopieerd — plak deze in de mail met Cmd+V of houd ingedrukt → Plakken.)';
    url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(kort)}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(plat);
      }
    } catch (_) {}
  }
  try { window.location.href = url; } catch (_) {}
  return { clipped };
}

function _mailToPlainText(html) {
  if (!html) return '';
  // Behoud paragraaf-structuur, zet links om naar 'tekst (url)', strip tags.
  let s = String(html);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<\/tr>/gi, '\n');
  s = s.replace(/<\/li>/gi, '\n');
  s = s.replace(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)');
  s = s.replace(/<[^>]+>/g, '');
  // HTML-entities terug decoderen
  const div = document.createElement('div');
  div.innerHTML = s;
  s = div.textContent || div.innerText || s;
  // Overtollige whitespace opruimen
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

// Plain-text (voor PDF/e-mail; geen HTML): 'Locatie (11-06-2026)' of alleen locatie.
function _routePlain(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  const loc = item.locatie || '';
  const dat = item.datum || '';
  if (!loc && !dat) return '';
  if (!dat) return loc;
  const fmt = (typeof fmtDate === 'function') ? fmtDate(dat) : dat;
  return loc + ' (' + fmt + ')';
}
function _routeStr(item) {
  if (item == null) return '';
  if (typeof item === 'string') return esc(item);
  const loc = item.locatie || '';
  const dat = item.datum || '';
  if (!loc && !dat) return '';
  if (!dat) return esc(loc);
  const fmt = (typeof fmtDate === 'function') ? fmtDate(dat) : dat;
  return esc(loc) + ' <span class="muted small">(' + esc(fmt) + ')</span>';
}
function dlRow(label, value) {
  const v = value && String(value).trim() ? value : '—';
  // value mag al HTML zijn als 'ie van kistRowValue komt; anders escapen
  const isHtml = typeof v === 'string' && v.startsWith('<');
  return `<div><dt>${esc(label)}</dt><dd>${isHtml ? v : esc(v)}</dd></div>`;
}

function kistRowValue(kistNaam, metPrijs = true) {
  const k = KISTEN_CATALOGUS.find(x => x.naam === kistNaam);
  if (!k) return esc(kistNaam);
  const fotoUrl = KistFotos.urlVoor(k.naam);
  const thumb = fotoUrl
    ? `<img src="${esc(fotoUrl)}" alt="${esc(k.naam)}" loading="lazy">`
    : kistSVG(k.materiaal);
  return `<span class="kist-thumb-inline">${thumb}</span>` +
         `<strong>${esc(k.naam)}</strong> ` +
         `<span class="muted small">— ${esc(k.materiaal)}${metPrijs ? ' — ' + fmtEUR(k.bedrag) : ''}</span>`;
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

function bindDetailEvents(id) {
  const dRow = DB.byId(KEYS.DOSSIERS, id);

  // ── Status-select: bind ALS EERSTE zodat een fout verderop 'm niet
  // meesleurt, en gebruik VERSE data uit de cache i.p.v. de closure.
  const statusSelEarly = $('#status-select');
  if (statusSelEarly) {
    statusSelEarly.addEventListener('change', async e => {
      const nieuw = e.target.value;
      const dNow  = DB.byId(KEYS.DOSSIERS, id) || dRow || {};
      const oud   = dNow.status || 'nieuw';
      const kistOm = (dNow.kist_type || '').trim();
      statusSelEarly.disabled = true;
      try {
        const updated = await DB.update(KEYS.DOSSIERS, id, { status: nieuw });
        // Cache forceren met de verse row — voorkomt dat een type-mismatch
        // (id number vs string) een stale render veroorzaakt.
        if (updated && Array.isArray(Cloud.cache.dossiers)) {
          const i = Cloud.cache.dossiers.findIndex(x => Number(x.id) === Number(id));
          if (i >= 0) Cloud.cache.dossiers[i] = Object.assign({}, Cloud.cache.dossiers[i], updated);
        }
        if (kistOm
            && typeof KistVoorraad !== 'undefined'
            && typeof Auth !== 'undefined' && Auth.isBeheerder()) {
          try {
            if (oud !== 'geannuleerd' && nieuw === 'geannuleerd') await KistVoorraad.terug1(kistOm);
            else if (oud === 'geannuleerd' && nieuw !== 'geannuleerd') await KistVoorraad.reserveer1(kistOm);
          } catch (_) {}
        }
        try { Toast.show('Status: ' + nieuw.replace('_', ' '), 'success'); } catch (_) {}
        renderDossierDetail({ id });
      } catch (err) {
        try { Toast.show('Status opslaan mislukt' + (err && err.message ? ': ' + err.message : ''), 'error'); } catch (_) {}
        statusSelEarly.disabled = false;
        statusSelEarly.value = oud;
      }
    });
  }

  const btnPrint = $('#btn-print');
  if (btnPrint) btnPrint.addEventListener('click', async () => {
    const btn = $('#btn-print');
    const orig = btn.textContent; btn.disabled = true; btn.textContent = 'PDF maken…';
    try {
      const ks = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
      await PdfGen.deliver(dossierSpec(dRow, ks), `dossier-${dRow.dossier_nummer}.pdf`, id);
    } catch (e) {
      Modal.show({ type: 'error', title: 'PDF maken mislukt', message: e.message || String(e) });
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });

  // Artsverklaring bekijken (signed URL)
  const avBtn = $('#btn-view-artsverklaring');
  if (avBtn && dRow && dRow.artsverklaring_pad) {
    avBtn.addEventListener('click', () => {
      openUrlAsync(ArtsVerklaring.signedUrl(dRow.artsverklaring_pad, 300));
    });
  }

  // Overdraagformulier bekijken (signed URL, zelfde opslag)
  const odBtn = $('#btn-view-overdraag');
  if (odBtn && dRow && dRow.overdraagformulier_pad) {
    odBtn.addEventListener('click', () => {
      openUrlAsync(ArtsVerklaring.signedUrl(dRow.overdraagformulier_pad, 300));
    });
  }

  // Bezittings-foto bekijken (via signed URL — 5 min geldig)
  document.querySelectorAll('[data-bezit-foto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pad = btn.getAttribute('data-bezit-foto');
      if (!pad) return;
      openUrlAsync((typeof BezittingenFotos !== 'undefined' ? BezittingenFotos : ArtsVerklaring).signedUrl(pad, 300));
    });
  });

  // Archiveren / uit archief halen (alleen beheerder)
  const archBtn = $('#btn-archief');
  if (archBtn && dRow) {
    archBtn.addEventListener('click', async () => {
      const nu = !dRow.gearchiveerd;
      archBtn.disabled = true;
      const origText = archBtn.textContent;
      try {
        // Bij archiveren: foto's/scans agressief comprimeren om storage te
        // sparen. Originele bestanden worden overschreven; het pad blijft
        // hetzelfde. Bij uit-archief-halen niks doen (foto's zijn al klein).
        let bespaardMsg = '';
        if (nu && typeof ArchiefCompressie !== 'undefined' && navigator.onLine) {
          archBtn.textContent = '⏳ Foto’s comprimeren…';
          try {
            const res = await ArchiefCompressie.comprimeerDossier(dRow);
            if (res.aantal > 0) {
              const kb = Math.round(res.bespaard / 1024);
              bespaardMsg = ` · ${res.aantal} foto’s gecomprimeerd (± ${kb >= 1024 ? (kb/1024).toFixed(1) + ' MB' : kb + ' KB'} bespaard)`;
            }
          } catch (_) {}
        }
        archBtn.textContent = origText;
        await DB.update(KEYS.DOSSIERS, id, {
          gearchiveerd: nu,
          gearchiveerd_op: nu ? new Date().toISOString() : null
        });
        if (typeof Toast !== 'undefined') Toast.show(
          (nu ? 'Naar archief verplaatst' : 'Uit archief gehaald') + bespaardMsg,
          'success'
        );
        renderDossierDetail({ id });
      } catch (err) {
        archBtn.disabled = false;
        archBtn.textContent = origText;
        Modal.show({ type: 'error', title: 'Mislukt', message: err.message || String(err) });
      }
    });
  }

  // Overflow-menu (⋯) — sluit na klikken op een actie, of bij klik buiten
  const moreMenu = $('.page-actions-more');
  if (moreMenu) {
    moreMenu.querySelectorAll('.page-actions-menu button').forEach(btn => {
      btn.addEventListener('click', () => moreMenu.removeAttribute('open'));
    });
    document.addEventListener('click', e => {
      if (moreMenu.hasAttribute('open') && !moreMenu.contains(e.target)) {
        moreMenu.removeAttribute('open');
      }
    });
  }

  // Kosten-sectie in-/uitklappen, voorkeur onthouden in localStorage
  const kostenToggle = $('#btn-kosten-toggle');
  if (kostenToggle) {
    kostenToggle.addEventListener('click', () => {
      const section = $('#kosten');
      const collapsed = section.classList.toggle('collapsed');
      kostenToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      localStorage.setItem('sok_kosten_collapsed', collapsed ? '1' : '0');
    });
  }

  const emailDosBtn = $('#btn-email-dossier');
  if (emailDosBtn) {
    emailDosBtn.addEventListener('click', () => {
      const d = DB.byId(KEYS.DOSSIERS, id); if (!d) return;
      const kostenLijst = DB.where(KEYS.KOSTEN, k => k.dossier_id === d.id);
      MailComposer.open({
        dossier: d,
        type: 'dossier',
        subject: `Uitvaartdossier ${d.dossier_nummer} — ${fullName(d) || ''}`.trim(),
        body: buildDossierEmail(d, kostenLijst),
      });
    });
  }
  const emailFactBtn = $('#btn-email-factuur');
  if (emailFactBtn) {
    emailFactBtn.addEventListener('click', () => {
      const d = DB.byId(KEYS.DOSSIERS, id); if (!d) return;
      const ks = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
      MailComposer.open({
        dossier: d,
        type: 'factuur',
        subject: `Factuur uitvaart ${d.dossier_nummer} — ${fullName(d) || ''}`.trim(),
        body: buildFactuurEmail(d, ks),
        kosten: ks,
      });
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


  // Status-select is al bovenaan bindDetailEvents gebonden.

  const btnDelete = $('#btn-delete');
  if (btnDelete) btnDelete.addEventListener('click', async () => {
    const ok = await Modal.confirm({
      title: 'Dossier verwijderen?',
      message: 'Het dossier en alle bijbehorende kosten en notities worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    if (!ok) return;
    // Lees de VERSE dossier-data uit de cache — de closure `d` kan verouderd
    // zijn na een status-wissel of ander event.
    const dNow = DB.byId(KEYS.DOSSIERS, id) || dRow || {};
    const kistOm = (dNow.kist_type || '').trim();
    const alTeruggegeven = dNow.status === 'geannuleerd';
    try {
      await DB.remove(KEYS.DOSSIERS, id); // cascade verwijdert kosten/notities in DB
      ['kosten','notities'].forEach(t =>
        Cloud.cache[t] = Cloud.cache[t].filter(x => x.dossier_id !== id));
      if (kistOm && !alTeruggegeven
          && typeof KistVoorraad !== 'undefined'
          && typeof Auth !== 'undefined' && Auth.isBeheerder()) {
        try { await KistVoorraad.terug1(kistOm); } catch (_) {}
      }
      try { Toast.show('Dossier verwijderd', 'success'); } catch (_) {}
      Router.go('/dossiers');
    } catch (e) {
      try { Toast.show('Verwijderen mislukt' + (e && e.message ? ': ' + e.message : ''), 'error'); } catch (_) {}
    }
  });

  const _addKostenForm = $('#add-kosten');
  if (_addKostenForm) _addKostenForm.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const omsch = f.omschrijving.value.trim(); if (!omsch) return;
    const aantal = parseInt(f.aantal.value, 10);
    if (!isFinite(aantal) || aantal < 1) { Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' }); return; }
    const stuk = (f.bedrag ? parseEUR(f.bedrag.value) : 0);
    const bedrag = magPrijzen ? +(stuk * aantal).toFixed(2) : null;
    try {
      await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: omsch, categorie: f.categorie.value || null, bedrag, aantal, betaald: f.betaald.checked });
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

  $('#add-notitie').addEventListener('submit', async e => {
    e.preventDefault();
    const tekst = e.target.tekst.value.trim(); if (!tekst) return;
    const profiel = ActiveProfile.current();
    const u = Auth.current();
    const auteur = profiel ? profiel.name : (u ? (u.fullName || u.email) : 'Onbekend');
    try {
      await DB.insert(KEYS.NOTITIES, { dossier_id: id, tekst, auteur });
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
      if (action === 'toggle-factuur-betaald') {
        const kostenList = DB.where(KEYS.KOSTEN, k => k.dossier_id === id);
        const allesBetaald = kostenList.length > 0 && kostenList.every(k => k.betaald);
        const nieuw = !allesBetaald;
        const _demoAan = (typeof Demo !== 'undefined' && Demo.isActive());
        if (typeof Auth !== 'undefined' && !Auth.isBeheerder() && !_demoAan) {
          // Medewerker heeft geen schrijfrecht op de kosten-tabel: aftikken via RPC.
          const { error } = await sb.rpc('kosten_zet_betaald_dossier', { p_dossier_id: id, p_betaald: nieuw });
          if (error) throw error;
          kostenList.forEach(k => { const c = DB.byId(KEYS.KOSTEN, k.id); if (c) c.betaald = nieuw; });
          renderDossierDetail({ id });
        } else {
          await Promise.all(kostenList.map(k =>
            DB.update(KEYS.KOSTEN, k.id, { betaald: nieuw })
          ));
          await DB.touchDossier(id); renderDossierDetail({ id });
        }
      } else if (action === 'toggle-gedekt') {
        const k = DB.byId(KEYS.KOSTEN, tid); if (!k) return;
        await DB.update(KEYS.KOSTEN, tid, { gedekt: !k.gedekt });
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'del-kosten') {
        const ok = await Modal.confirm({ title: 'Kostenpost verwijderen?', message: 'Deze actie kan niet ongedaan worden gemaakt.', confirmText: 'Verwijderen' });
        if (!ok) return;
        await DB.remove(KEYS.KOSTEN, tid); await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'del-notitie') {
        const ok = await Modal.confirm({ title: 'Notitie verwijderen?', message: 'Deze actie kan niet ongedaan worden gemaakt.', confirmText: 'Verwijderen' });
        if (!ok) return;
        await DB.remove(KEYS.NOTITIES, tid); await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'edit-preset' || action === 'hide-preset' || action === 'show-preset') {
        const adminMode = !!Settings.get('catalog_admin_mode');
        const list = effectieveKostenPresets({ includeHidden: adminMode });
        const p = list[parseInt(btn.getAttribute('data-preset'), 10)];
        if (!p || p.nav) return;
        const cur = Object.assign({}, Settings.get('kosten_overrides') || {});
        const entry = Object.assign({}, cur[p.omschrijving] || {});
        if (action === 'edit-preset') {
          const huidig = p.bedrag != null ? (Number(p.bedrag) || 0).toFixed(2).replace('.', ',') : '';
          const input = window.prompt(
            `Nieuwe prijs voor "${p.omschrijving}" (€).\nLaat leeg en druk OK om de standaardprijs te herstellen.`,
            huidig
          );
          if (input == null) return;
          if (input.trim() === '') delete entry.bedrag;
          else {
            const bedrag = parseEUR(input);
            if (!isFinite(bedrag) || bedrag < 0) {
              Modal.show({ type: 'warning', title: 'Ongeldige prijs', message: 'Vul een geldig bedrag in (bv. 1234,56).' });
              return;
            }
            entry.bedrag = bedrag;
          }
        } else if (action === 'hide-preset') {
          const ok = await Modal.confirm({
            type: 'warning',
            title: 'Kostenpost verwijderen?',
            message: `"${p.omschrijving}" wordt definitief uit de snel-toevoeg-lijst verwijderd. Bestaande kostenposten in dit dossier blijven staan.`,
            confirmText: 'Verwijderen',
            cancelText: 'Annuleren',
          });
          if (!ok) return;
          entry.hidden = true;
        } else if (action === 'show-preset') {
          delete entry.hidden;
        }
        if (Object.keys(entry).length === 0) delete cur[p.omschrijving];
        else                                  cur[p.omschrijving] = entry;
        Settings.set({ kosten_overrides: cur });
        renderDossierDetail({ id });
        return;
      } else if (action === 'add-preset') {
        const adminMode = !!Settings.get('catalog_admin_mode');
        const list = effectieveKostenPresets({ includeHidden: adminMode });
        const p = list[parseInt(btn.getAttribute('data-preset'), 10)];
        if (!p) return;
        // Navigatie-tegels: open de juiste catalogus-pagina of focus
        // het handmatige invoer-formulier.
        if (p.nav === 'kist')    { Router.go('/kisten');  return; }
        if (p.nav === 'bloemen') { Router.go('/bloemen'); return; }
        if (p.nav === 'eten')    { Router.go('/eten');    return; }
        if (p.nav === 'extra') {
          const oms = document.querySelector('#add-kosten input[name="omschrijving"]');
          if (oms) {
            oms.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { try { oms.focus(); } catch (_) {} }, 250);
          }
          return;
        }
        // 'vraagPrijs' = richtprijs, vraag het werkelijke bedrag.
        // 'food' = aantal × prijs per stuk (totaal automatisch berekend).
        let aantalPreset = 1;
        let bedragPreset = magPrijzen ? p.bedrag : null;
        if (magPrijzen && p.vraagPrijs) {
          const input = window.prompt(
            `Wat heeft "${p.omschrijving}" gekost? (richtprijs — vul het werkelijke bedrag in €)`,
            ''
          );
          if (input == null) return;
          bedragPreset = parseEUR(input);
          if (!isFinite(bedragPreset) || bedragPreset < 0) {
            Modal.show({ type: 'warning', title: 'Ongeldig bedrag', message: 'Vul een geldig bedrag in (bv. 45,00).' });
            return;
          }
        } else if (p.food) {
          const stuk = Number(p.bedrag) || 0;
          const input = window.prompt(
            magPrijzen
              ? `Hoeveel ${p.omschrijving}? (prijs per stuk: ${fmtEUR(stuk)})`
              : `Hoeveel ${p.omschrijving}?`,
            '1'
          );
          if (input == null) return;
          aantalPreset = parseInt(String(input).trim(), 10);
          if (!isFinite(aantalPreset) || aantalPreset < 1) {
            Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' });
            return;
          }
          bedragPreset = magPrijzen ? +((stuk * aantalPreset).toFixed(2)) : null;
        }
        // Bestaat al een rij met dezelfde omschrijving + categorie?
        // Dan aantal ophogen en bedrag bijtellen (geen dubbele rij).
        const existing = DB.where(KEYS.KOSTEN, k =>
          k.dossier_id === id &&
          k.omschrijving === p.omschrijving &&
          (k.categorie || null) === (p.categorie || null)
        );
        if (existing.length > 0) {
          const e = existing[0];
          const newAantal = (Number(e.aantal) || 1) + aantalPreset;
          const patch = { aantal: newAantal };
          if (magPrijzen && bedragPreset != null) {
            patch.bedrag = +((Number(e.bedrag) || 0) + bedragPreset).toFixed(2);
          }
          await DB.update(KEYS.KOSTEN, e.id, patch);
        } else {
          await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: p.omschrijving, categorie: p.categorie, bedrag: bedragPreset, aantal: aantalPreset, betaald: false });
        }
        await DB.touchDossier(id); renderDossierDetail({ id });
      }
    } catch (_) {}
  };
}

const MailComposer = {
  EMAIL_RX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Verzamel suggesties voor To/CC: contact + verzekeraar + persoonlijke
  // (Rume/Robert) + opgeslagen adresboek van dit dossier.
  collectSuggestions(d) {
    const set = new Map(); // email → label
    const add = (email, label) => {
      if (!email || !MailComposer.EMAIL_RX.test(email)) return;
      if (!set.has(email)) set.set(email, label || email);
    };
    add(d.contact_email, 'Contactpersoon');
    add(d.verzekering_contact_email || '', 'Verzekeraar');
    // adresboek per dossier
    const boek = Array.isArray(d.email_adresboek) ? d.email_adresboek : [];
    boek.forEach(item => {
      if (typeof item === 'string') add(item, 'Eerder gebruikt');
      else if (item && item.email) add(item.email, item.label || 'Eerder gebruikt');
    });
    return Array.from(set, ([email, label]) => ({ email, label }));
  },

  async open({ dossier, type, subject, body, kosten = null }) {
    const d = dossier;
    const suggesties = MailComposer.collectSuggestions(d);

    const overlay = document.createElement('div');
    overlay.className = 'mail-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mail-title');
    overlay.innerHTML = `
      <div class="mail-backdrop"></div>
      <div class="mail-card" role="dialog" aria-modal="true" aria-labelledby="mail-title">
        <header class="mail-head">
          <h2 id="mail-title">${type === 'factuur' ? '📄 E-mail factuur' : '📋 E-mail dossier'}</h2>
          <button type="button" class="mail-close" aria-label="Sluiten">×</button>
        </header>
        <div class="mail-body">
          <p class="mail-sub muted small">Dossier <strong>${esc(d.dossier_nummer)}</strong> · ${esc(fullName(d) || '—')}</p>

          <label class="mail-field">
            <span>Aan</span>
            <div class="mail-tags" data-field="to">
              <input type="email" class="mail-tag-input" placeholder="Typ een adres en druk Enter">
            </div>
          </label>

          <label class="mail-field">
            <span>CC <span class="muted small">(elke ontvanger krijgt een aparte mail — geen echte CC-header)</span></span>
            <div class="mail-tags" data-field="cc">
              <input type="email" class="mail-tag-input" placeholder="Typ een adres en druk Enter">
            </div>
          </label>

          ${suggesties.length ? `
            <div class="mail-suggesties">
              <span class="muted small">Suggesties:</span>
              ${suggesties.map(s => `
                <span class="mail-sugg-wrap">
                  <button type="button" class="mail-sugg" data-email="${esc(s.email)}" data-target="to" title="Toevoegen aan 'Aan'">
                    + ${esc(s.email)} <span class="muted small">${esc(s.label)}</span>
                  </button>
                  <button type="button" class="mail-sugg mail-sugg-cc" data-email="${esc(s.email)}" data-target="cc" title="Toevoegen aan 'CC'">CC</button>
                </span>
              `).join('')}
            </div>` : ''}

          <label class="mail-field">
            <span>Onderwerp</span>
            <input type="text" class="mail-subject" value="${esc(subject)}">
          </label>

          <label class="mail-attach">
            <input type="checkbox" class="mail-pdf" ${type === 'factuur' ? 'checked' : ''}>
            <span>📎 ${type === 'factuur' ? 'Factuur als PDF meesturen' : 'Dossier als PDF meesturen'} <span class="muted small">(download-link, 7 dagen geldig)</span></span>
          </label>

          <details class="mail-preview">
            <summary>📝 Voorbeeld van mail-inhoud</summary>
            <pre class="mail-preview-text">${esc(body)}</pre>
          </details>

          <div class="mail-status" hidden></div>
        </div>
        <footer class="mail-foot">
          <button type="button" class="btn btn-ghost mail-cancel">Annuleren</button>
          <button type="button" class="btn btn-primary mail-send">Verzenden ✉</button>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('shown'));

    // ─── Tag-input helpers ───
    const addTag = (fieldName, email) => {
      const e = String(email || '').trim().toLowerCase();
      if (!MailComposer.EMAIL_RX.test(e)) return false;
      const wrap = overlay.querySelector(`.mail-tags[data-field="${fieldName}"]`);
      if (!wrap) return false;
      // dubbele check
      const exists = Array.from(wrap.querySelectorAll('.mail-tag')).some(t => t.dataset.email === e);
      if (exists) return false;
      const input = wrap.querySelector('.mail-tag-input');
      const tag = document.createElement('span');
      tag.className = 'mail-tag';
      tag.dataset.email = e;
      tag.innerHTML = `${esc(e)}<button type="button" class="mail-tag-x" aria-label="Verwijderen">×</button>`;
      wrap.insertBefore(tag, input);
      tag.querySelector('.mail-tag-x').addEventListener('click', () => tag.remove());
      return true;
    };
    const readTags = fieldName =>
      Array.from(overlay.querySelectorAll(`.mail-tags[data-field="${fieldName}"] .mail-tag`))
        .map(t => t.dataset.email);

    // Vooraf-invullen: contact_email als 'Aan'
    if (d.contact_email && MailComposer.EMAIL_RX.test(d.contact_email)) {
      addTag('to', d.contact_email);
    }

    // Splitser: hetzelfde bij plak / Enter / blur. Splits op komma, puntkomma,
    // whitespace, of newline — zo werkt zowel "a@x.nl, b@y.nl" als één paste,
    // als één-voor-één getypt.
    const SPLIT_RX = /[,;\s]+/;
    const addManyFromText = (field, text) => {
      let added = 0;
      String(text || '').split(SPLIT_RX).forEach(piece => {
        if (piece && addTag(field, piece)) added++;
      });
      return added;
    };

    overlay.querySelectorAll('.mail-tag-input').forEach(inp => {
      const field = inp.parentElement.dataset.field;
      const tryAdd = () => {
        const added = addManyFromText(field, inp.value);
        if (added > 0) inp.value = '';
      };
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); tryAdd(); }
        if (e.key === 'Backspace' && !inp.value) {
          const lastTag = inp.parentElement.querySelector('.mail-tag:last-of-type');
          if (lastTag) lastTag.remove();
        }
      });
      inp.addEventListener('blur', tryAdd);
      // Plak van "a@x.nl, b@y.nl" → splits in losse tags
      inp.addEventListener('paste', e => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (text && SPLIT_RX.test(text)) {
          e.preventDefault();
          addManyFromText(field, text);
          inp.value = '';
        }
      });
    });

    // Suggesties: data-target zegt waar de tag heen gaat ('to' of 'cc').
    // iPad-vriendelijk: aparte CC-knop in plaats van Shift+klik.
    overlay.querySelectorAll('.mail-sugg').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.target === 'cc' ? 'cc' : 'to';
        addTag(field, btn.dataset.email);
      });
    });

    // ─── Sluiten ───
    const close = () => {
      overlay.classList.remove('shown');
      setTimeout(() => overlay.remove(), 200);
    };
    overlay.querySelector('.mail-close').addEventListener('click', close);
    overlay.querySelector('.mail-cancel').addEventListener('click', close);
    overlay.querySelector('.mail-backdrop').addEventListener('click', close);

    // ─── Verzenden ───
    overlay.querySelector('.mail-send').addEventListener('click', async () => {
      // Forceer eventuele open tag-input naar tag
      overlay.querySelectorAll('.mail-tag-input').forEach(i => i.dispatchEvent(new Event('blur')));

      const to = readTags('to');
      const cc = readTags('cc');
      const subj = overlay.querySelector('.mail-subject').value.trim();
      const wantsPdf = overlay.querySelector('.mail-pdf').checked;
      const status = overlay.querySelector('.mail-status');
      const sendBtn = overlay.querySelector('.mail-send');

      if (!to.length) {
        status.hidden = false;
        status.className = 'mail-status mail-status-error';
        status.textContent = 'Vul ten minste één ontvanger in.';
        return;
      }

      sendBtn.disabled = true;
      const origLabel = sendBtn.textContent;

      try {
        // 1) PDF genereren + uploaden (indien gevraagd)
        let bodyMetBijlage = body;
        if (wantsPdf) {
          sendBtn.textContent = 'PDF maken...';
          status.hidden = false;
          status.className = 'mail-status mail-status-info';
          status.textContent = 'PDF wordt gemaakt (~10s bij eerste keer)...';
          let pdfBlob;
          const ks = kosten || DB.where(KEYS.KOSTEN, k => k.dossier_id === d.id).sort((a,b)=>a.id-b.id);
          if (type === 'factuur') {
            pdfBlob = await PdfGen.blobFromSpec(() => buildFactuurPdf(d, ks));
          } else {
            pdfBlob = await PdfGen.blobFromSpec(dossierSpec(d, ks));
          }
          sendBtn.textContent = 'Uploaden...';
          const up = await PdfGen.uploadAsAttachment(d.id, pdfBlob, type);
          bodyMetBijlage += `\n\n— Bijlage —\n📎 ${type === 'factuur' ? 'Kostenraming' : 'Dossier-overzicht'} (PDF): ${up.url}\n(link is 7 dagen geldig)`;
        }
        if (cc.length) {
          bodyMetBijlage += `\n\nDeze e-mail is ook gestuurd naar: ${cc.join(', ')}.`;
        }

        // 2) Versturen
        sendBtn.textContent = 'Verzenden...';
        status.className = 'mail-status mail-status-info';
        status.textContent = `Versturen naar ${to.length + cc.length} ontvanger(s)...`;

        const alle = [...to, ...cc];
        if (EmailService.isConfigured()) {
          // Per ontvanger een aparte mail (EmailJS Free heeft geen native cc)
          let ok = 0, fout = [];
          for (const adres of alle) {
            try { await EmailService.send(adres, subj, bodyMetBijlage); ok++; }
            catch (e) { fout.push(`${adres}: ${(e && e.text) || e.message || String(e)}`); }
          }
          if (fout.length) {
            status.className = 'mail-status mail-status-error';
            status.textContent = `${ok} verstuurd, ${fout.length} mislukt: ${fout.join(' · ')}`;
            sendBtn.disabled = false; sendBtn.textContent = origLabel;
            return;
          }
          status.className = 'mail-status mail-status-success';
          status.textContent = `✓ ${ok} mail(s) verstuurd.`;
        } else {
          // Geen EmailJS — open de mail-app van het apparaat met to+subject.
          // Bij een lange body wordt de tekst naar het klembord gekopieerd
          // en moet de gebruiker 'm plakken (zie openMailto).
          const r = await openMailto([...to, ...cc].join(','), subj, bodyMetBijlage);
          status.className = 'mail-status mail-status-info';
          status.textContent = r && r.clipped
            ? '✓ Mail-app geopend. De volledige inhoud staat op het klembord — plak deze in het mail-bericht (Cmd+V of houd ingedrukt → Plakken).'
            : '✓ Mail-app geopend met tekst klaar. Klik op Verzenden in je mail-app.';
        }

        // 3) Adresboek bijwerken in Supabase (alleen nieuwe adressen)
        await MailComposer.saveToAddrBook(d, alle);

        // 4) Korte vertraging, dan sluiten
        setTimeout(close, 1500);
      } catch (e) {
        status.hidden = false;
        status.className = 'mail-status mail-status-error';
        status.textContent = e.message || String(e);
        sendBtn.disabled = false;
        sendBtn.textContent = origLabel;
      }
    });

    // Esc sluit
    // Focus-trap: Tab cyclet binnen het modal
    const trapFocus = e => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(overlay.querySelectorAll('button:not([hidden]), input, textarea, select, summary, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.hidden && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const keyHandler = e => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', keyHandler); }
      else trapFocus(e);
    };
    document.addEventListener('keydown', keyHandler);
    // Initiële focus naar de eerste tag-input (To-veld)
    setTimeout(() => {
      const firstInput = overlay.querySelector('.mail-tag-input');
      if (firstInput) firstInput.focus();
    }, 60);
  },

  // Voeg gebruikte adressen toe aan dossier.email_adresboek (zonder dubbels)
  async saveToAddrBook(d, emails) {
    const huidig = Array.isArray(d.email_adresboek) ? d.email_adresboek : [];
    const set = new Set(huidig.map(e => typeof e === 'string' ? e : (e && e.email)).filter(Boolean));
    const nieuw = emails.filter(e => MailComposer.EMAIL_RX.test(e) && !set.has(e));
    if (!nieuw.length) return;
    const updated = [...huidig, ...nieuw];
    try {
      await DB.update(KEYS.DOSSIERS, d.id, { email_adresboek: updated });
    } catch (_) { /* niet fataal */ }
  },
};

// Minimale HTML voor dossier-PDF (mag verder uitgebreid worden)
function buildDossierDocHTML(d) {
  const s = Settings.all();
  return `
    <div class="factuur-doc">
      <div class="factuur-header">
        <div>
          <h2 style="border:none;padding:0;margin:0;font-size:1.4rem;">${esc(s.app_name)}</h2>
          <p style="margin:.15rem 0;font-size:.9rem;color:#666;">${esc(s.app_tagline)}</p>
        </div>
        <div class="factuur-meta">
          <p style="margin:0;"><strong>DOSSIER</strong></p>
          <p style="margin:.1rem 0;">Dossier: ${esc(d.dossier_nummer)}</p>
          <p style="margin:.1rem 0;">Datum: ${new Date().toLocaleDateString('nl-NL')}</p>
        </div>
      </div>

      <h3 style="margin-top:1rem;">Overledene</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:35%;color:#666;">Naam</td><td><strong>${esc(fullName(d) || '—')}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#666;">Geboortedatum</td><td>${esc(fmtDate(d.geboortedatum) || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Geboorteplaats</td><td>${esc(d.geboorteplaats || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Overlijdensdatum</td><td>${esc(fmtDate(d.overlijdensdatum) || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Overlijdensplaats</td><td>${esc(d.overlijdensplaats || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Adres</td><td>${esc([d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', ') || '—')}</td></tr>
      </table>

      <h3 style="margin-top:1rem;">Opbaren &amp; locatie</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:35%;color:#666;">Ophalen / thuis opbaren</td><td>${esc(d.opbaring_type === 'thuis' ? 'Thuis opbaren' : (d.opbaring_type === 'ophalen' ? 'Ophalen' : (d.opbaring_type === 'beide' ? 'Ophalen + Thuis opbaren' : '—')))}</td></tr>
        ${(d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') ? `<tr><td style="padding:4px 0;color:#666;">Datum &amp; begintijd</td><td>${esc([fmtDate(d.thuis_opbaren_datum), d.thuis_opbaren_tijd && 'om ' + d.thuis_opbaren_tijd].filter(Boolean).join(' ') || '—')}</td></tr>` : ''}
        <tr><td style="padding:4px 0;color:#666;">Opbaarlocatie</td><td>${esc(d.opbaarlocatie_type || '—')}</td></tr>
      </table>

      <h3 style="margin-top:1rem;">Kist &amp; vervoer</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:35%;color:#666;">Kist</td><td>${esc(d.kist_type || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Rouwauto</td><td>${esc(d.rouwauto === 'ja' ? 'Ja' : (d.rouwauto === 'nee' ? 'Nee' : (d.rouwauto || '—')))}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Opdrachtgever</td><td>${esc(d.opdrachtgever_naam || '—')}</td></tr>
      </table>
    </div>`;
}
