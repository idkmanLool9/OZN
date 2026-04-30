// Dossier detail: overzicht + taken + kosten + notities + print

function renderDossierDetail(params) {
  const id = parseInt(params.id, 10);
  const d = DB.byId(KEYS.DOSSIERS, id);
  if (!d) return render404();

  const taken = DB.where(KEYS.TAKEN, t => t.dossier_id === id).sort((a, b) => (a.volgorde||0) - (b.volgorde||0) || a.id - b.id);
  const kosten = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
  const notities = DB.where(KEYS.NOTITIES, n => n.dossier_id === id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const documenten = DB.where(KEYS.DOCUMENTEN, doc => doc.dossier_id === id).sort((a, b) => (b.geupload_op || '').localeCompare(a.geupload_op || ''));
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const betaald = kosten.filter(k => k.betaald).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <a href="#/dossiers" class="back-link">← Dossiers</a>
          <h1>${esc(fullName(d) || 'Dossier')}</h1>
          <p class="muted"><strong>${esc(d.dossier_nummer)}</strong> · <span class="status status-${esc(d.status)}">${esc((d.status||'nieuw').replace('_',' '))}</span>${d.gezinsnummer ? ' · gezinsnr. ' + esc(d.gezinsnummer) : ''}</p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-ghost" id="btn-print">Print</button>
          <a href="#/dossiers/${d.id}/bewerken" class="btn btn-primary">Bewerken</a>
          <button type="button" class="btn btn-danger" id="btn-delete">Verwijderen</button>
        </div>
      </div>

      <nav class="tabs">
        <a href="#/dossiers/${d.id}#overzicht">Overzicht</a>
        <a href="#/dossiers/${d.id}#taken">Taken (${taken.filter(t=>!t.voltooid).length}/${taken.length})</a>
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
          ${dlRow('Kist', d.kist_type)}
          ${dlRow('Rouwauto', d.rouwauto)}
          ${dlRow("Volgauto's", d.aantal_volgauto)}
          ${dlRow('Dragers', d.dragers)}
          ${dlRow('Bloemstukken', d.bloemstukken)}
          ${dlRow('Rouwkaarten', d.rouwkaarten_aantal)}
          ${dlRow('Condoleance', d.condoleance_locatie)}
          ${dlRow('Catering', d.catering)}
          ${dlRow('Muziek / koor', d.muziek_zang)}
        </dl>
        <h3>Verzekering & opdrachtgever</h3>
        <dl class="dl">
          ${dlRow('Verzekering', d.verzekering_status)}
          ${dlRow('Maatschappij', d.verzekering_maatschappij)}
          ${dlRow('Polisnummer', d.polisnummer)}
          ${dlRow('Opdrachtgever', d.opdrachtgever_naam)}
          ${dlRow('Telefoon', d.opdrachtgever_telefoon)}
        </dl>
        ${d.bijzonderheden ? `<h3>Bijzonderheden</h3><p class="prewrap">${esc(d.bijzonderheden)}</p>` : ''}
      </section>

      <section id="taken" class="card">
        <h2>Taken / checklist</h2>
        ${taken.length === 0 ? '<p class="muted">Nog geen taken.</p>' :
          '<ul class="taken-list">' + taken.map(t => `
            <li class="${t.voltooid ? 'voltooid' : ''}" data-id="${t.id}">
              <button type="button" class="check" data-action="toggle-taak" data-id="${t.id}">${t.voltooid ? '✓' : '○'}</button>
              <span class="taak-tekst">${esc(t.omschrijving)}</span>
              ${t.deadline ? `<span class="badge badge-amber">${esc(fmtDate(t.deadline))}</span>` : ''}
              ${t.voltooid && t.voltooid_op ? `<span class="muted small">voltooid ${esc(fmtDate(t.voltooid_op))}</span>` : ''}
              <button type="button" class="btn-icon right" data-action="del-taak" data-id="${t.id}" title="verwijderen">×</button>
            </li>`).join('') + '</ul>'}
        <form id="add-taak" class="row-form">
          <input type="text" name="omschrijving" placeholder="Nieuwe taak..." required>
          <input type="date" name="deadline">
          <button type="submit" class="btn">+ Toevoegen</button>
        </form>
      </section>

      <section id="kosten" class="card">
        <h2>Kosten</h2>
        ${kosten.length === 0 ? '<p class="muted">Nog geen kostenposten.</p>' :
          `<table class="table"><thead><tr><th>Omschrijving</th><th>Categorie</th><th class="num">Bedrag</th><th>Betaald</th><th></th></tr></thead><tbody>
            ${kosten.map(k => `<tr>
              <td>${esc(k.omschrijving)}</td>
              <td>${esc(k.categorie || '—')}</td>
              <td class="num">${fmtEUR(k.bedrag)}</td>
              <td><button type="button" class="check small" data-action="toggle-kosten" data-id="${k.id}">${k.betaald ? '✓' : '○'}</button></td>
              <td><button type="button" class="btn-icon" data-action="del-kosten" data-id="${k.id}">×</button></td>
            </tr>`).join('')}
            <tr class="total-row"><td colspan="2"><strong>Totaal</strong></td><td class="num"><strong>${fmtEUR(totaal)}</strong></td><td colspan="2" class="muted small">waarvan betaald: ${fmtEUR(betaald)}</td></tr>
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

function dlRow(label, value) {
  const v = value && String(value).trim() ? esc(value) : '—';
  return `<div><dt>${esc(label)}</dt><dd>${v}</dd></div>`;
}

function bindDetailEvents(id) {
  $('#btn-print').addEventListener('click', () => window.print());

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

  $('#add-taak').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const omsch = f.omschrijving.value.trim(); if (!omsch) return;
    const max = DB.where(KEYS.TAKEN, t => t.dossier_id === id).reduce((m, t) => Math.max(m, t.volgorde || 0), 0);
    try {
      await DB.insert(KEYS.TAKEN, { dossier_id: id, omschrijving: omsch, deadline: f.deadline.value || null, voltooid: false, volgorde: max + 1 });
      await DB.touchDossier(id);
      renderDossierDetail({ id });
    } catch (_) {}
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
      if (action === 'toggle-taak') {
        const t = DB.byId(KEYS.TAKEN, tid); if (!t) return;
        await DB.update(KEYS.TAKEN, tid, { voltooid: !t.voltooid, voltooid_op: !t.voltooid ? new Date().toISOString() : null });
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'del-taak') {
        if (!confirm('Taak verwijderen?')) return;
        await DB.remove(KEYS.TAKEN, tid); await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'toggle-kosten') {
        const k = DB.byId(KEYS.KOSTEN, tid); if (!k) return;
        await DB.update(KEYS.KOSTEN, tid, { betaald: !k.betaald });
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
