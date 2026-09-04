// Planning & overzicht — 'wanneer moet wat' én 'wanneer is wat vrij'.
// Eén flexibele agenda: taken, opbaring, ritten, verzorging en blokkades
// op resources (Aula-kamers, rouwauto's, medewerkers).
// Twee weergaven: Agenda (lijst per dag) en Week (kalender-kolommen).

const PLANNING_TYPES = [
  { id: 'taak',       label: 'Taak',          icon: '✓' },
  { id: 'opbaring',   label: 'Opbaring',      icon: '🕯' },
  { id: 'rit',        label: 'Rit / vervoer', icon: '🚐' },
  { id: 'verzorging', label: 'Verzorging',    icon: '🧴' },
  { id: 'blokkade',   label: 'Bezet / vrij blokkeren', icon: '⛔' },
];
function planningTypeMeta(id) {
  return PLANNING_TYPES.find(t => t.id === id) || { label: id || 'Taak', icon: '•' };
}

// Weergave-status (blijft bewaard tussen re-renders binnen de sessie)
let _planningMode = 'agenda';   // 'agenda' | 'week'
let _planningWeek = 0;          // offset in weken t.o.v. deze week
let _planningResource = '';     // filter op resource ('' = alle)

// 'YYYY-MM-DDTHH:mm' (lokaal) → ISO-string; leeg → null.
// allowEmptyTime: bij eindtijd mag lege tijd → null (i.p.v. stille 00:00
// fallback die 'einde 00:00' zou tonen voor elke ongevulde eindtijd).
function planningToISO(datum, tijd, allowEmptyTime = false) {
  if (!datum) return null;
  const heeftTijd = tijd && /^\d{2}:\d{2}/.test(tijd);
  if (!heeftTijd && allowEmptyTime) return null;
  const t = heeftTijd ? tijd : '00:00';
  const d = new Date(`${datum}T${t}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function planningDagKey(iso) {
  if (!iso) return 'geen-datum';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function planningVandaagKey() { return planningDagKey(new Date().toISOString()); }
function planningDagLabel(key) {
  if (key === 'geen-datum') return 'Zonder datum';
  const d = new Date(key + 'T12:00:00');
  const vandaag = planningVandaagKey();
  const morgenD = new Date(); morgenD.setDate(morgenD.getDate() + 1);
  let prefix = '';
  if (key === vandaag) prefix = 'Vandaag · ';
  else if (key === planningDagKey(morgenD.toISOString())) prefix = 'Morgen · ';
  return prefix + d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function planningTijd(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}
// Maandag van de week (met week-offset), als Date op 00:00 lokaal
function planningWeekMaandag(offset) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;             // 0 = maandag
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}

function planningWaarschuwingen() {
  const dossiers = DB.list(KEYS.DOSSIERS) || [];
  const actief = dossiers.filter(d => !['voltooid', 'geannuleerd'].includes(d.status || 'nieuw'));
  const out = [];
  actief.forEach(d => {
    const missend = [];
    if (!d.opbaring_type) missend.push('ophalen/thuis nog niet gekozen');
    if ((d.opbaring_type === 'thuis' || d.opbaring_type === 'beide') && !d.thuis_opbaren_datum) missend.push('geen datum thuis opbaren');
    if ((d.opbaring_type === 'ophalen' || d.opbaring_type === 'beide') && !d.ophalen_datum) missend.push('geen ophaaldatum');
    if ((d.opbaring_type === 'ophalen' || d.opbaring_type === 'beide')
        && (!Array.isArray(d.brengen_naar) || !d.brengen_naar.some(x => x && (typeof x === 'string' ? x : x.locatie))))
      missend.push('geen overbrenging-locatie(s)');
    if (!d.kist_type) missend.push('kist nog niet gekozen');
    // Alleen bij écht leeg triggeren; expliciete 'nee' is een gemaakte keuze.
    if (!d.rouwauto) missend.push('rouwauto nog niet geregeld');
    if (missend.length) out.push({ dossier: d, missend });
  });
  return out;
}

function planningItemRow(i) {
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
}

// Compacte tegel voor de week-kolommen
function planningItemChip(i) {
  const m = planningTypeMeta(i.type);
  const t = planningTijd(i.start_ts);
  return `
    <div class="parochie-row" data-plid="${i.id}" style="flex-direction:column; align-items:stretch; gap:.15rem; padding:.35rem .5rem; ${i.gedaan ? 'opacity:.5;' : ''}">
      <div style="display:flex; justify-content:space-between; gap:.4rem;">
        <span class="muted small" style="font-variant-numeric:tabular-nums;">${esc(t || '—')}</span>
        <button type="button" class="btn-icon pl-del" data-plid="${i.id}" title="verwijderen" style="line-height:1;">×</button>
      </div>
      <strong class="small" style="${i.gedaan ? 'text-decoration:line-through;' : ''}">${m.icon} ${esc(i.titel)}</strong>
      ${i.resource ? `<span class="badge" style="align-self:flex-start;">${esc(i.resource)}</span>` : ''}
    </div>`;
}

function renderPlanning() {
  let items = (DB.list(KEYS.PLANNING) || []).slice();
  if (_planningResource) items = items.filter(i => (i.resource || '') === _planningResource);
  const alle = (DB.list(KEYS.PLANNING) || []);
  const dossiers = (DB.list(KEYS.DOSSIERS) || []);
  const actieveDossiers = dossiers.filter(d => !['voltooid', 'geannuleerd'].includes(d.status || 'nieuw'));
  const resources = [...new Set(alle.map(i => (i.resource || '').trim()).filter(Boolean))].sort();
  const waarschuwingen = planningWaarschuwingen();

  // ── Agenda-groepen (op dag) ────────────────────────────────────────────
  const groepen = {};
  items.forEach(i => { const k = planningDagKey(i.start_ts); (groepen[k] = groepen[k] || []).push(i); });
  const dagKeys = Object.keys(groepen).sort((a, b) =>
    a === 'geen-datum' ? 1 : b === 'geen-datum' ? -1 : a.localeCompare(b));

  // ── Week-kolommen ──────────────────────────────────────────────────────
  const maandag = planningWeekMaandag(_planningWeek);
  const weekDagen = Array.from({ length: 7 }, (_, n) => {
    const d = new Date(maandag); d.setDate(maandag.getDate() + n);
    const key = planningDagKey(d.toISOString());
    return { d, key, items: items.filter(i => planningDagKey(i.start_ts) === key)
      .sort((a, b) => (a.start_ts || '').localeCompare(b.start_ts || '')) };
  });
  const weekLabel = `${maandag.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ` +
    `${weekDagen[6].d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const vandaagKey = planningVandaagKey();

  const resourceFilter = resources.length ? `
    <label style="margin:0;"><span class="muted small">Resource</span>
      <select id="pl-resource-filter">
        <option value="">Alle</option>
        ${resources.map(r => `<option value="${esc(r)}" ${_planningResource === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
      </select>
    </label>` : '';

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head" style="align-items:flex-start;">
        <div><h1>Planning &amp; overzicht</h1>
          <p class="muted">Wanneer moet wat — en wanneer is wat vrij.</p></div>
        <div style="display:flex; gap:.5rem; align-items:flex-end; flex-wrap:wrap;">
          ${resourceFilter}
          <div class="btn-group" role="tablist">
            <button type="button" class="btn btn-sm ${_planningMode === 'agenda' ? 'btn-primary' : 'btn-ghost'}" id="pl-mode-agenda">Agenda</button>
            <button type="button" class="btn btn-sm ${_planningMode === 'week' ? 'btn-primary' : 'btn-ghost'}" id="pl-mode-week">Week</button>
          </div>
        </div>
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

      <details class="card" ${alle.length ? '' : 'open'}>
        <summary style="cursor:pointer; font-weight:600;">+ Nieuw planning-item</summary>
        <form id="planning-form" class="form" autocomplete="off" style="margin-top:.75rem;">
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
      </details>

      ${_planningMode === 'week' ? `
        <section class="card">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:.6rem;">
            <button type="button" class="btn btn-sm btn-ghost" id="pl-week-prev">◀ Vorige</button>
            <strong>${esc(weekLabel)}${_planningWeek === 0 ? ' · deze week' : ''}</strong>
            <button type="button" class="btn btn-sm btn-ghost" id="pl-week-next">Volgende ▶</button>
          </div>
          <div class="planning-week" style="display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:.5rem; overflow-x:auto;">
            ${weekDagen.map(wd => `
              <div style="min-width:0;">
                <div class="${wd.key === vandaagKey ? '' : 'muted'}" style="text-align:center; font-weight:600; padding:.25rem 0; border-bottom:2px solid ${wd.key === vandaagKey ? 'var(--primary,#2563eb)' : 'var(--border,#e5e0d6)'};">
                  ${wd.d.toLocaleDateString('nl-NL', { weekday: 'short' })}<br>
                  <span class="small">${wd.d.getDate()}/${wd.d.getMonth() + 1}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:.35rem; margin-top:.4rem;">
                  ${wd.items.map(planningItemChip).join('') || '<span class="muted small" style="text-align:center; padding:.5rem 0;">—</span>'}
                </div>
              </div>`).join('')}
          </div>
          <p class="muted small" style="margin:.6rem 0 0;">Items zonder datum staan in de Agenda-weergave.</p>
        </section>
      ` : (dagKeys.length ? dagKeys.map(k => `
        <section class="card">
          <h3 style="margin:0 0 .6rem; text-transform:capitalize;">${esc(planningDagLabel(k))}</h3>
          <div style="display:flex; flex-direction:column; gap:.4rem;">
            ${groepen[k].sort((a, b) => (a.start_ts || '').localeCompare(b.start_ts || '')).map(planningItemRow).join('')}
          </div>
        </section>`).join('') : '<section class="card"><p class="muted">Nog geen planning-items. Voeg er hierboven een toe.</p></section>')}
    </div>`;

  // ── Events ─────────────────────────────────────────────────────────────
  const setMode = m => { _planningMode = m; renderPlanning(); };
  const agBtn = $('#pl-mode-agenda'); if (agBtn) agBtn.addEventListener('click', () => setMode('agenda'));
  const wkBtn = $('#pl-mode-week');   if (wkBtn) wkBtn.addEventListener('click', () => setMode('week'));
  const prev = $('#pl-week-prev'); if (prev) prev.addEventListener('click', () => { _planningWeek--; renderPlanning(); });
  const next = $('#pl-week-next'); if (next) next.addEventListener('click', () => { _planningWeek++; renderPlanning(); });
  const rf = $('#pl-resource-filter'); if (rf) rf.addEventListener('change', () => { _planningResource = rf.value; renderPlanning(); });

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
        // Eindtijd optioneel; als leeg → null (voorheen stille 00:00).
        // Als eindtijd < starttijd (midnight-crossing bv. 23:00-01:00),
        // dan hoort de eindtijd op de volgende dag.
        eind_ts: (() => {
          const eind = planningToISO(f.datum.value, f.eindtijd.value, true);
          const start = planningToISO(f.datum.value, f.starttijd.value);
          if (eind && start && new Date(eind) <= new Date(start)) {
            // Voeg 1 dag toe aan eind (midnight-crossing)
            const d = new Date(eind); d.setDate(d.getDate() + 1);
            return d.toISOString();
          }
          return eind;
        })(),
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
