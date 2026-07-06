// Planning & overzicht — 'wanneer moet wat' én 'wanneer is wat vrij'.
// Eén flexibele agenda: taken, opbaring, ritten, verzorging en blokkades
// op resources (Aula-kamers, rouwauto's, medewerkers).

const PLANNING_TYPES = [
  { id: 'taak',       label: 'Taak',        icon: '✓' },
  { id: 'opbaring',   label: 'Opbaring',    icon: '🕯' },
  { id: 'rit',        label: 'Rit / vervoer', icon: '🚐' },
  { id: 'verzorging', label: 'Verzorging',  icon: '🧴' },
  { id: 'blokkade',   label: 'Bezet / vrij blokkeren', icon: '⛔' },
];
function planningTypeMeta(id) {
  return PLANNING_TYPES.find(t => t.id === id) || { label: id || 'Taak', icon: '•' };
}

// 'YYYY-MM-DDTHH:mm' (lokaal) → ISO-string; leeg → null
function planningToISO(datum, tijd) {
  if (!datum) return null;
  const t = (tijd && /^\d{2}:\d{2}/.test(tijd)) ? tijd : '00:00';
  const d = new Date(`${datum}T${t}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function planningDagKey(iso) {
  if (!iso) return 'geen-datum';
  return new Date(iso).toISOString().slice(0, 10);
}
function planningDagLabel(key) {
  if (key === 'geen-datum') return 'Zonder datum';
  const d = new Date(key + 'T12:00:00');
  const vandaag = new Date(); vandaag.setHours(12, 0, 0, 0);
  const morgen = new Date(vandaag); morgen.setDate(morgen.getDate() + 1);
  const dk = d.toISOString().slice(0, 10);
  let prefix = '';
  if (dk === vandaag.toISOString().slice(0, 10)) prefix = 'Vandaag · ';
  else if (dk === morgen.toISOString().slice(0, 10)) prefix = 'Morgen · ';
  return prefix + d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function planningTijd(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function planningWaarschuwingen() {
  const dossiers = DB.list(KEYS.DOSSIERS) || [];
  const actief = dossiers.filter(d => !['voltooid', 'geannuleerd'].includes(d.status || 'nieuw'));
  const out = [];
  actief.forEach(d => {
    const missend = [];
    if (!d.kist_type) missend.push('kist nog niet gekozen');
    if (d.rouwauto !== 'ja') missend.push('rouwauto nog niet geregeld');
    if (d.opbaring_type === 'thuis' && !d.thuis_opbaren_datum) missend.push('geen datum thuis opbaren');
    if (!d.opbaring_type) missend.push('ophalen/thuis nog niet gekozen');
    if (missend.length) out.push({ dossier: d, missend });
  });
  return out;
}

function renderPlanning() {
  const items = (DB.list(KEYS.PLANNING) || []).slice()
    .sort((a, b) => (a.start_ts || '9999').localeCompare(b.start_ts || '9999'));
  const dossiers = (DB.list(KEYS.DOSSIERS) || []);
  const actieveDossiers = dossiers.filter(d => !['voltooid', 'geannuleerd'].includes(d.status || 'nieuw'));
  const resources = [...new Set(items.map(i => (i.resource || '').trim()).filter(Boolean))].sort();
  const waarschuwingen = planningWaarschuwingen();

  // Groepeer op dag (verleden verbergen we niet, maar tonen 'gedaan' subtieler)
  const groepen = {};
  items.forEach(i => {
    const k = planningDagKey(i.start_ts);
    (groepen[k] = groepen[k] || []).push(i);
  });
  const dagKeys = Object.keys(groepen).sort((a, b) => {
    if (a === 'geen-datum') return 1;
    if (b === 'geen-datum') return -1;
    return a.localeCompare(b);
  });

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>Planning &amp; overzicht</h1>
          <p class="muted">Wanneer moet wat — en wanneer is wat vrij.</p></div>
      </div>

      ${waarschuwingen.length ? `
      <section class="card" style="border-left:4px solid #e0a400;">
        <h2 style="margin-top:0;">⚠ Aandachtspunten (${waarschuwingen.length})</h2>
        <ul style="margin:.25rem 0 0; padding-left:1.1rem;">
          ${waarschuwingen.map(w => `
            <li style="margin:.3rem 0;">
              <a href="#/dossiers/${w.dossier.id}">${esc(fullName(w.dossier) || w.dossier.dossier_nummer || ('#' + w.dossier.id))}</a>
              — <span class="muted">${w.missend.map(esc).join(' · ')}</span>
            </li>`).join('')}
        </ul>
      </section>` : ''}

      <section class="card">
        <h2 style="margin-top:0;">Nieuw planning-item</h2>
        <form id="planning-form" class="form" autocomplete="off">
          <div class="grid-3">
            <label class="span-2"><span>Wat</span>
              <input type="text" name="titel" placeholder="bv. Ophalen overledene / Aula kamer 1 gereserveerd" required>
            </label>
            <label><span>Type</span>
              <select name="type">
                ${PLANNING_TYPES.map(t => `<option value="${t.id}">${t.icon} ${esc(t.label)}</option>`).join('')}
              </select>
            </label>
            <label><span>Datum</span><input type="date" name="datum"></label>
            <label><span>Starttijd</span><input type="time" name="starttijd"></label>
            <label><span>Eindtijd <span class="muted small">(optioneel)</span></span><input type="time" name="eindtijd"></label>
            <label><span>Resource <span class="muted small">(kamer / auto / medewerker)</span></span>
              <input type="text" name="resource" list="planning-resources" placeholder="bv. Aula kamer 1">
              <datalist id="planning-resources">${resources.map(r => `<option value="${esc(r)}"></option>`).join('')}</datalist>
            </label>
            <label><span>Dossier <span class="muted small">(optioneel)</span></span>
              <select name="dossier_id">
                <option value="">— geen —</option>
                ${actieveDossiers.map(d => `<option value="${d.id}">${esc(fullName(d) || d.dossier_nummer || ('#' + d.id))}</option>`).join('')}
              </select>
            </label>
            <label class="span-3"><span>Notitie</span><input type="text" name="notitie" placeholder="optioneel"></label>
          </div>
          <div class="form-actions" style="justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Toevoegen aan planning</button>
          </div>
        </form>
      </section>

      ${dagKeys.length ? dagKeys.map(k => `
        <section class="card">
          <h3 style="margin:0 0 .6rem; text-transform:capitalize;">${esc(planningDagLabel(k))}</h3>
          <div style="display:flex; flex-direction:column; gap:.4rem;">
            ${groepen[k].sort((a, b) => (a.start_ts || '').localeCompare(b.start_ts || '')).map(i => {
              const m = planningTypeMeta(i.type);
              const d = i.dossier_id != null ? DB.byId(KEYS.DOSSIERS, i.dossier_id) : null;
              const tijd = [planningTijd(i.start_ts), planningTijd(i.eind_ts)].filter(Boolean).join('–');
              return `
              <div class="parochie-row" data-plid="${i.id}" style="align-items:center; ${i.gedaan ? 'opacity:.55;' : ''}">
                <input type="checkbox" class="pl-done" data-plid="${i.id}" ${i.gedaan ? 'checked' : ''} title="afgehandeld" style="width:1.1rem;height:1.1rem;">
                <span style="min-width:4.2rem; font-variant-numeric:tabular-nums;" class="muted small">${esc(tijd || '—')}</span>
                <span style="flex:1;">
                  <strong style="${i.gedaan ? 'text-decoration:line-through;' : ''}">${m.icon} ${esc(i.titel)}</strong>
                  ${i.resource ? ` <span class="badge">${esc(i.resource)}</span>` : ''}
                  ${d ? ` <a href="#/dossiers/${d.id}" class="muted small">→ ${esc(fullName(d) || d.dossier_nummer)}</a>` : ''}
                  ${i.notitie ? `<br><span class="muted small">${esc(i.notitie)}</span>` : ''}
                </span>
                <button type="button" class="btn-icon pl-del" data-plid="${i.id}" title="verwijderen">×</button>
              </div>`;
            }).join('')}
          </div>
        </section>`).join('') : '<section class="card"><p class="muted">Nog geen planning-items. Voeg er hierboven een toe.</p></section>'}
    </div>`;

  // ── Events ─────────────────────────────────────────────────────────────
  const form = $('#planning-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const titel = (f.titel.value || '').trim();
      if (!titel) return;
      const payload = {
        titel,
        type: f.type.value || 'taak',
        resource: (f.resource.value || '').trim() || null,
        start_ts: planningToISO(f.datum.value, f.starttijd.value),
        eind_ts: planningToISO(f.datum.value, f.eindtijd.value),
        dossier_id: f.dossier_id.value ? parseInt(f.dossier_id.value, 10) : null,
        notitie: (f.notitie.value || '').trim() || null,
        gedaan: false,
      };
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await DB.insert(KEYS.PLANNING, payload);
        renderPlanning();
        if (typeof Toast !== 'undefined') Toast.show('Toegevoegd aan planning', 'success');
      } catch (err) {
        btn.disabled = false;
        Modal.show({ type: 'error', title: 'Toevoegen mislukt', message: err.message || String(err) });
      }
    });
  }

  $$('.pl-done').forEach(cb => cb.addEventListener('change', async () => {
    const id = parseInt(cb.dataset.plid, 10);
    try { await DB.update(KEYS.PLANNING, id, { gedaan: cb.checked }); renderPlanning(); }
    catch (err) { Modal.show({ type: 'error', title: 'Opslaan mislukt', message: err.message || String(err) }); }
  }));

  $$('.pl-del').forEach(btn => btn.addEventListener('click', async () => {
    const id = parseInt(btn.dataset.plid, 10);
    const ok = await Modal.confirm({ title: 'Planning-item verwijderen?', message: 'Weet je het zeker?', confirmText: 'Verwijderen' });
    if (!ok) return;
    try { await DB.remove(KEYS.PLANNING, id); renderPlanning(); }
    catch (err) { Modal.show({ type: 'error', title: 'Verwijderen mislukt', message: err.message || String(err) }); }
  }));
}
