// Begraafplaats — visueel grid van alle graven, klikbaar zoals
// vliegtuig-stoelreservering. Filter op rij/status, klik een graf →
// modal om te reserveren, bezet te zetten of vrij te geven (eventueel
// gekoppeld aan een dossier).

const GravenStore = {
  cache: [],
  loaded: false,
  loading: null,

  async load(force = false) {
    if (GravenStore.loaded && !force) return GravenStore.cache;
    if (GravenStore.loading) return GravenStore.loading;
    GravenStore.loading = (async () => {
      const { data, error } = await sb.from('graven').select('*').order('positie', { ascending: true });
      if (error) throw error;
      GravenStore.cache = data || [];
      GravenStore.loaded = true;
      GravenStore.loading = null;
      return GravenStore.cache;
    })();
    return GravenStore.loading;
  },

  byId(id) { return GravenStore.cache.find(g => g.id === id); },
  byNummer(nr) { return GravenStore.cache.find(g => String(g.nummer) === String(nr)); },

  // Per rij gegroepeerd (zoals "L1", "L2", ..., "R1", ...) — gesorteerd op positie
  perRij() {
    const map = new Map();
    for (const g of GravenStore.cache) {
      if (!map.has(g.rij)) map.set(g.rij, []);
      map.get(g.rij).push(g);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.positie - b.positie);
    // Sorteer rijen: L1, L2, ..., R1, R2, ...
    return new Map([...map.entries()].sort(([a], [b]) => {
      const ax = a[0], bx = b[0];
      if (ax !== bx) return ax === 'L' ? -1 : 1;
      return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
    }));
  },

  totalsByStatus() {
    const t = { beschikbaar: 0, gereserveerd: 0, bezet: 0, totaal: GravenStore.cache.length };
    for (const g of GravenStore.cache) t[g.status]++;
    return t;
  },

  async updateStatus(id, patch) {
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current())
      ? ActiveProfile.current().name : null;
    const row = Object.assign({}, patch);
    if (profielNaam) row.bijgewerkt_door = profielNaam;
    if (patch.status === 'gereserveerd' && !row.gereserveerd_op) row.gereserveerd_op = new Date().toISOString();
    if (patch.status === 'bezet' && !row.bezet_op) row.bezet_op = new Date().toISOString();
    if (patch.status === 'beschikbaar') {
      row.dossier_id = null;
      row.gereserveerd_op = null;
      row.bezet_op = null;
    }
    const { data, error } = await sb.from('graven').update(row).eq('id', id).select().single();
    if (error) throw error;
    const i = GravenStore.cache.findIndex(g => g.id === id);
    if (i >= 0) GravenStore.cache[i] = data;
    return data;
  },
};

async function renderBegraafplaats() {
  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Begraafplaats</h1>
          <p id="graven-totals" class="muted small">Laden…</p>
        </div>
        <div class="page-actions">
          <div class="graven-filter">
            <label class="graven-filter-inline">
              <span class="muted small">Zoek nr</span>
              <input type="search" id="graven-search" placeholder="bv. 1284" inputmode="numeric">
            </label>
            <label class="graven-filter-inline">
              <span class="muted small">Status</span>
              <select id="graven-status-filter">
                <option value="">Alle</option>
                <option value="beschikbaar">Beschikbaar</option>
                <option value="gereserveerd">Gereserveerd</option>
                <option value="bezet">Bezet</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <section class="card graven-legend-card">
        <div class="graven-legend">
          <span class="graven-legend-item"><span class="graven-cell graven-beschikbaar"></span> Beschikbaar</span>
          <span class="graven-legend-item"><span class="graven-cell graven-gereserveerd"></span> Gereserveerd</span>
          <span class="graven-legend-item"><span class="graven-cell graven-bezet"></span> Bezet</span>
        </div>
        <p class="muted small" style="margin:.5rem 0 0;">Klik op een graf om te reserveren, koppelen aan een dossier, of vrij te geven.</p>
      </section>

      <div id="graven-grid-wrap" class="graven-grid-wrap">
        <div class="graven-loading"><div class="splash-spinner"></div><p class="muted">Plattegrond laden…</p></div>
      </div>
    </div>`;

  try {
    await GravenStore.load();
  } catch (e) {
    $('#graven-grid-wrap').innerHTML = `<div class="alert alert-error">Plattegrond kon niet geladen worden: ${esc(e.message || String(e))}</div>`;
    return;
  }
  renderGravenGrid();
  bindGravenEvents();
}

function renderGravenGrid() {
  const totals = GravenStore.totalsByStatus();
  const totalsEl = $('#graven-totals');
  if (totalsEl) {
    totalsEl.innerHTML = `
      <strong>${totals.totaal}</strong> graven ·
      <strong style="color:var(--green);">${totals.beschikbaar}</strong> beschikbaar ·
      <strong style="color:var(--amber);">${totals.gereserveerd}</strong> gereserveerd ·
      <strong style="color:var(--red);">${totals.bezet}</strong> bezet`;
  }

  const search = ($('#graven-search')?.value || '').trim();
  const statusFilter = $('#graven-status-filter')?.value || '';

  const rijen = GravenStore.perRij();
  const sections = [];
  let visibleCount = 0;

  // Splits links / rechts
  const linker  = [...rijen].filter(([r]) => r.startsWith('L'));
  const rechter = [...rijen].filter(([r]) => r.startsWith('R'));

  const renderSide = (entries, label) => {
    if (!entries.length) return '';
    return `
      <div class="graven-side">
        <h3 class="graven-side-title">${esc(label)}</h3>
        ${entries.map(([rij, graven]) => {
          const filtered = graven.filter(g => {
            if (search && !String(g.nummer).includes(search)) return false;
            if (statusFilter && g.status !== statusFilter) return false;
            return true;
          });
          if (!filtered.length) return '';
          visibleCount += filtered.length;
          return `
            <div class="graven-row">
              <div class="graven-row-label">${esc(rij)}</div>
              <div class="graven-row-cells">
                ${filtered.map(g => `
                  <button type="button" class="graven-cell graven-${esc(g.status)}${g.dossier_id ? ' graven-has-dossier' : ''}"
                          data-action="open-graf" data-id="${g.id}"
                          title="Graf ${esc(g.nummer)} · ${esc(g.status)}${g.dossier_id ? ' · gekoppeld aan dossier' : ''}">
                    ${esc(g.nummer)}
                  </button>
                `).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  };

  const html = `
    <div class="graven-grid">
      ${renderSide(linker, 'Linkerzijde · 17 rijen')}
      ${renderSide(rechter, 'Rechterzijde · 21 rijen')}
    </div>
    ${visibleCount === 0 ? '<p class="muted center" style="padding:2rem;">Geen graven die aan de filter voldoen.</p>' : ''}`;
  $('#graven-grid-wrap').innerHTML = html;
}

function bindGravenEvents() {
  $('#graven-search').addEventListener('input', () => renderGravenGrid());
  $('#graven-status-filter').addEventListener('change', () => renderGravenGrid());

  $('#graven-grid-wrap').addEventListener('click', e => {
    const btn = e.target.closest('[data-action="open-graf"]');
    if (!btn) return;
    const id = parseInt(btn.getAttribute('data-id'), 10);
    openGrafModal(id);
  });
}

function openGrafModal(grafId) {
  const g = GravenStore.byId(grafId);
  if (!g) return;
  const dossier = g.dossier_id ? DB.byId(KEYS.DOSSIERS, g.dossier_id) : null;
  const dossierNaam = dossier ? (fullName(dossier) || dossier.dossier_nummer) : null;

  // Lijst van actieve dossiers voor de koppel-dropdown
  const dossiers = (DB.list(KEYS.DOSSIERS) || [])
    .filter(d => d.status !== 'voltooid' && d.status !== 'geannuleerd')
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  const html = `
    <div class="graf-modal-info">
      <div class="graf-modal-nr graven-${esc(g.status)}">${esc(g.nummer)}</div>
      <div>
        <strong>Graf ${esc(g.nummer)}</strong><br>
        <span class="muted small">Rij ${esc(g.rij)} · positie ${esc(g.positie)}</span>
      </div>
    </div>

    <div class="graf-modal-row">
      <label class="muted small">Status</label>
      <select id="graf-status">
        <option value="beschikbaar" ${g.status === 'beschikbaar' ? 'selected' : ''}>Beschikbaar</option>
        <option value="gereserveerd" ${g.status === 'gereserveerd' ? 'selected' : ''}>Gereserveerd</option>
        <option value="bezet" ${g.status === 'bezet' ? 'selected' : ''}>Bezet</option>
      </select>
    </div>

    <div class="graf-modal-row" id="graf-dossier-row">
      <label class="muted small">Gekoppeld dossier (optioneel)</label>
      <select id="graf-dossier">
        <option value="">— geen —</option>
        ${dossiers.map(d => `
          <option value="${d.id}" ${g.dossier_id === d.id ? 'selected' : ''}>${esc(fullName(d) || '—')} · ${esc(d.dossier_nummer)}</option>
        `).join('')}
      </select>
    </div>

    <div class="graf-modal-row">
      <label class="muted small">Opmerking</label>
      <textarea id="graf-opmerking" rows="2" placeholder="bv. tijdelijk gereserveerd voor familie Aktan">${esc(g.opmerking || '')}</textarea>
    </div>

    ${g.bijgewerkt_door ? `<p class="muted small" style="margin:.5rem 0 0;">Laatst bijgewerkt door <strong>${esc(g.bijgewerkt_door)}</strong> · ${esc(fmtRelative(g.updated_at) || '')}</p>` : ''}
  `;

  Modal.show({
    type: 'info',
    title: `Graf ${g.nummer}${dossierNaam ? ' — ' + dossierNaam : ''}`,
    html,
    confirmText: 'Opslaan',
    cancelText: 'Annuleren',
  }).then(async ok => {
    if (!ok) return;
    const newStatus = document.getElementById('graf-status')?.value || g.status;
    const newDossierId = parseInt(document.getElementById('graf-dossier')?.value, 10) || null;
    const newOpmerking = document.getElementById('graf-opmerking')?.value.trim() || null;

    try {
      await GravenStore.updateStatus(g.id, {
        status: newStatus,
        dossier_id: newStatus === 'beschikbaar' ? null : newDossierId,
        opmerking: newOpmerking,
      });
      renderGravenGrid();
    } catch (e) {
      Modal.show({ type: 'error', title: 'Opslaan mislukt', message: e.message || String(e) });
    }
  });
}
