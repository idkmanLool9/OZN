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
      // Supabase REST geeft default max 1000 rijen — wij hebben er 2150+
      // Paginate dus expliciet in batches van 1000.
      let all = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await sb.from('graven')
          .select('*')
          .order('rij', { ascending: true })
          .order('positie', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      GravenStore.cache = all;
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

// SVG-plattegrond constanten — matchen visueel de papieren kaart
const MAP = {
  PAD: 30,
  CELL_W: 22,       // breed genoeg voor 4-cijferige grafnummers
  CELL_H: 26,
  CELL_GAP: 1.5,
  ROW_GAP: 8,
  LABEL_W: 42,
  SIDE_GAP: 320,    // ruimte tussen linker- en rechterzijde (voor cirkels)
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
            <label class="graven-filter-inline">
              <span class="muted small">Zoom</span>
              <input type="range" id="graven-zoom" min="50" max="200" step="10" value="80">
            </label>
          </div>
        </div>
      </div>

      <section class="card graven-legend-card">
        <div class="graven-legend">
          <span class="graven-legend-item"><span class="graven-cell-mini graven-beschikbaar"></span> Beschikbaar</span>
          <span class="graven-legend-item"><span class="graven-cell-mini graven-gereserveerd"></span> Gereserveerd</span>
          <span class="graven-legend-item"><span class="graven-cell-mini graven-bezet"></span> Bezet</span>
          <span class="graven-legend-item"><span class="graven-cell-mini graven-has-dossier-mini"></span> Gekoppeld aan dossier</span>
        </div>
        <p class="muted small" style="margin:.5rem 0 0;">Klik op een graf om te reserveren, koppelen aan een dossier, of vrij te geven. Versleep horizontaal om door de plattegrond te scrollen.</p>
      </section>

      <div id="graven-map-wrap" class="graven-map-wrap">
        <div class="graven-loading"><div class="splash-spinner"></div><p class="muted">Plattegrond laden…</p></div>
      </div>
    </div>`;

  try {
    await GravenStore.load();
  } catch (e) {
    $('#graven-map-wrap').innerHTML = `<div class="alert alert-error">Plattegrond kon niet geladen worden: ${esc(e.message || String(e))}</div>`;
    return;
  }
  renderGravenMap();
  bindGravenEvents();
}

// Bouw één grote SVG die linker- en rechterzijde tegenover elkaar zet,
// met de cirkels (paviljoens) in het midden — net als de papieren kaart.
function renderGravenMap() {
  const totals = GravenStore.totalsByStatus();
  const totalsEl = $('#graven-totals');
  if (totalsEl) {
    totalsEl.innerHTML = `
      <strong>${totals.totaal}</strong> graven ·
      <strong style="color:var(--green);">${totals.beschikbaar}</strong> beschikbaar ·
      <strong style="color:var(--amber);">${totals.gereserveerd}</strong> gereserveerd ·
      <strong style="color:var(--red);">${totals.bezet}</strong> bezet`;
  }

  const rijen = GravenStore.perRij();
  const linker  = [...rijen].filter(([r]) => r.startsWith('L'));
  const rechter = [...rijen].filter(([r]) => r.startsWith('R'));

  // Bepaal benodigde breedte op basis van langste rij
  const maxCells = (entries) => entries.reduce((m, [, gs]) => Math.max(m, gs.length), 0);
  const linkerCells = maxCells(linker);
  const rechterCells = maxCells(rechter);
  const linkerW = linkerCells * (MAP.CELL_W + MAP.CELL_GAP);
  const rechterW = rechterCells * (MAP.CELL_W + MAP.CELL_GAP);
  const totalW = MAP.PAD + MAP.LABEL_W + linkerW + MAP.SIDE_GAP + rechterW + MAP.LABEL_W + MAP.PAD;
  const maxRows = Math.max(linker.length, rechter.length);
  const totalH = MAP.PAD * 2 + maxRows * (MAP.CELL_H + MAP.ROW_GAP) + 40;

  // Coördinaten voor cells
  const linkerX = MAP.PAD + MAP.LABEL_W; // rechts uitlijnen tegen het midden? Nee — links uitlijnen
  const linkerLabelX = MAP.PAD + MAP.LABEL_W - 6;
  // Rechterzijde — links uitlijnen na het midden-gat
  const rechterX = MAP.PAD + MAP.LABEL_W + linkerW + MAP.SIDE_GAP;
  const rechterLabelX = totalW - MAP.PAD - MAP.LABEL_W + 6;

  const rijStartY = MAP.PAD + 12;
  const yForRow = idx => rijStartY + idx * (MAP.CELL_H + MAP.ROW_GAP);

  // Centrale paden / cirkels (paviljoens) — gepositioneerd zoals
  // op de papieren plattegrond: een klein chapelletje bovenaan,
  // een 3-circle cluster halverwege voor de hoofdkapel, en een
  // half-cirkel ingang onderaan.
  const midX = MAP.PAD + MAP.LABEL_W + linkerW + MAP.SIDE_GAP / 2;
  const chapelY = rijStartY + MAP.CELL_H / 2;
  const cathYCenter = yForRow(Math.floor(linker.length / 2)) + MAP.CELL_H / 2;
  const ingangY = yForRow(Math.max(linker.length, rechter.length) - 2) + MAP.CELL_H / 2;

  const decor = `
    <!-- Kleine kapel bovenaan (tussen L1 en R1) -->
    <g class="graven-decor">
      <circle cx="${midX}" cy="${chapelY}" r="38" fill="#fff" stroke="#b8b0a0" stroke-width="2"/>
      <text x="${midX}" y="${chapelY + 6}" text-anchor="middle" font-size="22" fill="#9b9384" font-family="serif">⌂</text>
    </g>

    <!-- Hoofdkapel-cluster in het midden: 3 duidelijk gescheiden cirkels + paden -->
    <g class="graven-decor">
      <!-- Verbindingspaden tussen de 3 cirkels -->
      <line x1="${midX - 105}" y1="${cathYCenter}" x2="${midX - 65}" y2="${cathYCenter}"
            stroke="#d6cebe" stroke-width="6" stroke-linecap="round"/>
      <line x1="${midX + 65}" y1="${cathYCenter}" x2="${midX + 105}" y2="${cathYCenter}"
            stroke="#d6cebe" stroke-width="6" stroke-linecap="round"/>

      <!-- Linker paviljoen -->
      <circle cx="${midX - 130}" cy="${cathYCenter}" r="40" fill="#fff" stroke="#b8b0a0" stroke-width="2"/>

      <!-- Centrale hoofdkapel met concentrische ringen + cross -->
      <circle cx="${midX}" cy="${cathYCenter}" r="78" fill="#fff" stroke="#9c9382" stroke-width="2.5"/>
      <circle cx="${midX}" cy="${cathYCenter}" r="52" fill="none" stroke="#b8b0a0" stroke-width="1.2"/>
      <circle cx="${midX}" cy="${cathYCenter}" r="24" fill="none" stroke="#b8b0a0" stroke-width="1.2"/>
      <text x="${midX}" y="${cathYCenter + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="#6b1e2a" font-family="serif">✝</text>

      <!-- Rechter paviljoen -->
      <circle cx="${midX + 130}" cy="${cathYCenter}" r="40" fill="#fff" stroke="#b8b0a0" stroke-width="2"/>
    </g>

    <!-- Ingang/poort als half-cirkel onderaan -->
    <g class="graven-decor">
      <path d="M ${midX - 70} ${ingangY}
               A 70 50 0 0 0 ${midX + 70} ${ingangY} L ${midX + 70} ${ingangY + 50}
               L ${midX - 70} ${ingangY + 50} Z"
            fill="#fff" stroke="#b8b0a0" stroke-width="2"/>
      <text x="${midX}" y="${ingangY + 18}" text-anchor="middle" font-size="11" fill="#9b9384" font-family="serif">INGANG</text>
    </g>

    <!-- Centrale wandelpad (stippellijn van boven naar onder) -->
    <line x1="${midX}" y1="${chapelY + 40}" x2="${midX}" y2="${cathYCenter - 82}"
          stroke="#d6cebe" stroke-width="3" stroke-dasharray="4,4"/>
    <line x1="${midX}" y1="${cathYCenter + 82}" x2="${midX}" y2="${ingangY - 5}"
          stroke="#d6cebe" stroke-width="3" stroke-dasharray="4,4"/>
  `;

  // Bouw cells per rij — inclusief het grafnummer in de cell
  const buildSide = (entries, startX, labelX, anchor) => entries.map(([rij, gs], idx) => {
    const y = yForRow(idx);
    const labelY = y + MAP.CELL_H / 2 + 4;
    const cells = gs.map((g, j) => {
      const x = startX + j * (MAP.CELL_W + MAP.CELL_GAP);
      const cls = `graven-svg-cell graven-${esc(g.status)}${g.dossier_id ? ' graven-has-dossier' : ''}`;
      // Font-size hangt af van aantal cijfers — 4-cijferig past krapper
      const fs = String(g.nummer).length >= 4 ? 7 : 8;
      return `<g class="graven-cell-group" data-id="${g.id}">
        <rect x="${x}" y="${y}" width="${MAP.CELL_W}" height="${MAP.CELL_H}"
              class="${cls}" rx="2" data-id="${g.id}">
          <title>Graf ${esc(g.nummer)} · rij ${esc(rij)} · ${esc(g.status)}${g.dossier_id ? ' · gekoppeld aan dossier' : ''}</title>
        </rect>
        <text x="${x + MAP.CELL_W / 2}" y="${y + MAP.CELL_H / 2 + 3}"
              class="graven-svg-nr" text-anchor="middle"
              font-size="${fs}" data-id="${g.id}">${esc(g.nummer)}</text>
      </g>`;
    }).join('');
    return `
      <g class="graven-svg-row" data-rij="${esc(rij)}">
        <text x="${labelX}" y="${labelY}" class="graven-svg-rowlabel" text-anchor="${anchor}">${esc(rij)}</text>
        ${cells}
      </g>`;
  }).join('');

  const linkerSvg = buildSide(linker, linkerX, linkerLabelX, 'end');
  const rechterSvg = buildSide(rechter, rechterX, rechterLabelX, 'start');

  // Sectie-titels boven elke zijde
  const linkerCenter = MAP.PAD + MAP.LABEL_W + linkerW / 2;
  const rechterCenter = rechterX + rechterW / 2;
  const titles = `
    <rect x="${linkerCenter - 100}" y="${MAP.PAD - 8}" width="200" height="22" rx="11" fill="#e6f4ea" stroke="#a3d3b1"/>
    <text x="${linkerCenter}" y="${MAP.PAD + 7}" text-anchor="middle" font-size="11" font-weight="700" fill="#1e6b34">LINKERZIJDE · 17 RIJEN</text>
    <rect x="${rechterCenter - 100}" y="${MAP.PAD - 8}" width="200" height="22" rx="11" fill="#e9f2fb" stroke="#a3b8d3"/>
    <text x="${rechterCenter}" y="${MAP.PAD + 7}" text-anchor="middle" font-size="11" font-weight="700" fill="#1a4a7a">RECHTERZIJDE · 21 RIJEN</text>
  `;

  // Filter-effect via CSS-vars
  const search = ($('#graven-search')?.value || '').trim();
  const statusFilter = $('#graven-status-filter')?.value || '';
  const filterStyle = (search || statusFilter)
    ? `<style>
        .graven-svg-cell { opacity: .18; }
        ${search ? GravenStore.cache
          .filter(g => String(g.nummer).includes(search))
          .map(g => `.graven-svg-cell[data-id="${g.id}"]`).join(',') + ' { opacity: 1 !important; stroke: var(--primary); stroke-width: 1.5; }' : ''}
        ${statusFilter ? `.graven-${statusFilter} { opacity: 1 !important; }` : ''}
      </style>` : '';

  const zoom = parseInt($('#graven-zoom')?.value || '100', 10);
  $('#graven-map-wrap').innerHTML = `
    ${filterStyle}
    <div class="graven-map-scroller" style="--zoom:${zoom/100};">
      <svg class="graven-svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#fbf8f2" rx="8"/>
        ${titles}
        ${decor}
        ${linkerSvg}
        ${rechterSvg}
      </svg>
    </div>`;
}

function bindGravenEvents() {
  $('#graven-search').addEventListener('input', () => renderGravenMap());
  $('#graven-status-filter').addEventListener('change', () => renderGravenMap());
  $('#graven-zoom').addEventListener('input', () => {
    const sc = $('.graven-map-scroller');
    if (sc) sc.style.setProperty('--zoom', (parseInt($('#graven-zoom').value, 10) / 100));
  });

  $('#graven-map-wrap').addEventListener('click', e => {
    // Klik kan op rect of op de text in de cell vallen — pak data-id van beide
    const target = e.target.closest('[data-id]');
    if (!target) return;
    const id = parseInt(target.getAttribute('data-id'), 10);
    if (id) openGrafModal(id);
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
