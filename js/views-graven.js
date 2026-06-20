// Begraafplaats — visuele replica van de papieren plattegrond,
// inclusief title, sectie-badges, juiste cirkel-posities,
// halve-cirkel ingang onderaan, kruis-hatch rechtsonder.

const GravenStore = {
  cache: [],
  loaded: false,
  loading: null,

  async load(force = false) {
    if (GravenStore.loaded && !force) return GravenStore.cache;
    if (GravenStore.loading) return GravenStore.loading;
    GravenStore.loading = (async () => {
      // Supabase default limit = 1000, wij hebben er 2150+ → paginate
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

  perRij() {
    const map = new Map();
    for (const g of GravenStore.cache) {
      if (!map.has(g.rij)) map.set(g.rij, []);
      map.get(g.rij).push(g);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.positie - b.positie);
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

// ─── Layout constanten (matcht de plattegrond) ───
const M = {
  PAD: 30,
  TITLE_H: 60,            // title + section badges bovenaan
  CELL_W: 17,             // breed genoeg voor 4-cijferig nummer op klein font
  CELL_H: 22,
  CELL_GAP: 0.8,
  ROW_H: 26,              // row pitch (cell + spacing)
  LABEL_W: 36,
  MID_W: 200,             // ruimte tussen linker- en rechterzijde
  // Rij-Y-index (0-based binnen elke zijde)
  LEFT_ROW_IDX: {
    L1: 0, L2: 1, L3: 2, L4: 3, L5: 4, L6: 5, L7: 6, L8: 7,
    L9: 8, L10: 9,
    // wandelpad-gap op rij 10
    L11: 11, L12: 12, L13: 13, L14: 14, L15: 15, L16: 16, L17: 17,
  },
  RIGHT_ROW_IDX: {
    R1: 0, R2: 1, R3: 2, R4: 3, R5: 4, R6: 5,
    R7: 6, R8: 7, R9: 8, R10: 9,
    // wandelpad-gap op rij 10
    R11: 11, R12: 12, R13: 13, R14: 14, R15: 15, R16: 16,
    R17: 17, R18: 18, R19: 19, R20: 20, R21: 21,
  },
  // Linker rijen die naar rechts geschoven zijn (door cirkel aan linker rand)
  LEFT_SHIFT: { L8: 70, L9: 80 },
  // Rechter rijen die niet helemaal naar rechts gaan (door cirkel aan rechter rand)
  RIGHT_TRIM_END: { R7: 60, R8: 80, R9: 60 },
  // R20 heeft een gat in het midden voor de half-cirkel
  R20_SPLIT_AFTER: 22,  // eerste 22 cellen, dan gat, dan rest
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
              <input type="range" id="graven-zoom" min="60" max="200" step="10" value="100">
            </label>
          </div>
        </div>
      </div>

      <section class="card graven-legend-card">
        <div class="graven-legend">
          <span class="graven-legend-item"><span class="graven-cell-mini graven-beschikbaar"></span> Beschikbaar (klikbaar om te boeken)</span>
          <span class="graven-legend-item"><span class="graven-cell-mini graven-gereserveerd"></span> Gereserveerd</span>
          <span class="graven-legend-item"><span class="graven-cell-mini graven-bezet"></span> Bezet</span>
          <span class="graven-legend-item"><span class="graven-cell-mini graven-has-dossier-mini"></span> Gekoppeld aan dossier</span>
        </div>
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

function renderGravenMap() {
  const totals = GravenStore.totalsByStatus();
  $('#graven-totals').innerHTML = `
    <strong>${totals.totaal}</strong> graven ·
    <strong style="color:#2a7a3a;">${totals.beschikbaar}</strong> beschikbaar ·
    <strong style="color:#b3870e;">${totals.gereserveerd}</strong> gereserveerd ·
    <strong style="color:#b34;">${totals.bezet}</strong> bezet`;

  const rijen = GravenStore.perRij();
  const linker = [...rijen].filter(([r]) => r.startsWith('L'));
  const rechter = [...rijen].filter(([r]) => r.startsWith('R'));

  // ─── Bereken benodigde breedte ───
  const cellPitch = M.CELL_W + M.CELL_GAP;
  const linkerMaxCells = linker.reduce((m, [, gs]) => Math.max(m, gs.length), 0);
  const linkerMaxShift = Math.max(0, ...Object.values(M.LEFT_SHIFT));
  const linkerBlockW = linkerMaxShift + linkerMaxCells * cellPitch;
  const rechterMaxCells = rechter.reduce((m, [, gs]) => Math.max(m, gs.length), 0);
  const rechterBlockW = rechterMaxCells * cellPitch;

  const totalW = M.PAD + M.LABEL_W + linkerBlockW + M.MID_W + rechterBlockW + M.LABEL_W + M.PAD;
  const maxRowIdx = Math.max(
    ...Object.values(M.LEFT_ROW_IDX),
    ...Object.values(M.RIGHT_ROW_IDX),
  );
  const cellsTopY = M.PAD + M.TITLE_H + 20;
  const totalH = cellsTopY + (maxRowIdx + 1) * M.ROW_H + M.PAD + 80;

  const leftCellsStartX = M.PAD + M.LABEL_W;
  const leftCellsEndX = leftCellsStartX + linkerBlockW;
  const rightCellsStartX = leftCellsEndX + M.MID_W;
  const rightCellsEndX = rightCellsStartX + rechterBlockW;
  const midX = leftCellsEndX + M.MID_W / 2;

  const yFor = idx => cellsTopY + idx * M.ROW_H;

  // ─── TITEL + SECTION BADGES ───
  const titleSvg = `
    <text x="${M.PAD + 4}" y="${M.PAD + 22}" class="graven-title-text">
      GRAVE BOOKING SYSTEM – CEMETERY MAP (ACCURATE LAYOUT)
    </text>
    <g>
      <rect x="${leftCellsStartX + linkerBlockW/2 - 100}" y="${M.PAD + 36}"
            width="200" height="22" rx="11" fill="#e6f4ea" stroke="#7fb898" stroke-width="1.2"/>
      <text x="${leftCellsStartX + linkerBlockW/2}" y="${M.PAD + 51}"
            text-anchor="middle" font-size="11" font-weight="700" fill="#1e6b34">
        LEFT SIDE – 17 ROWS
      </text>
      <rect x="${rightCellsStartX + rechterBlockW/2 - 100}" y="${M.PAD + 36}"
            width="200" height="22" rx="11" fill="#e9f2fb" stroke="#82a4cf" stroke-width="1.2"/>
      <text x="${rightCellsStartX + rechterBlockW/2}" y="${M.PAD + 51}"
            text-anchor="middle" font-size="11" font-weight="700" fill="#1a4a7a">
        RIGHT SIDE – 21 ROWS
      </text>
    </g>`;

  // ─── CELLEN PER RIJ ───
  const buildCell = (g, x, y) => {
    const cls = `graven-svg-cell graven-${esc(g.status)}${g.dossier_id ? ' graven-has-dossier' : ''}`;
    const fs = String(g.nummer).length >= 4 ? 6.5 : 8;
    return `<g class="graven-cell-group" data-id="${g.id}">
      <rect x="${x}" y="${y}" width="${M.CELL_W}" height="${M.CELL_H}" class="${cls}" rx="1" data-id="${g.id}">
        <title>Graf ${esc(g.nummer)} · ${esc(g.status)}${g.dossier_id ? ' · gekoppeld' : ''}</title>
      </rect>
      <text x="${x + M.CELL_W/2}" y="${y + M.CELL_H/2 + 2.5}" class="graven-svg-nr"
            text-anchor="middle" font-size="${fs}" data-id="${g.id}">${esc(g.nummer)}</text>
    </g>`;
  };

  // Linker zijde
  const linkerSvg = linker.map(([rij, gs]) => {
    const rowIdx = M.LEFT_ROW_IDX[rij];
    if (rowIdx === undefined) return '';
    const y = yFor(rowIdx);
    const shift = M.LEFT_SHIFT[rij] || 0;
    const cells = gs.map((g, j) =>
      buildCell(g, leftCellsStartX + shift + j * cellPitch, y)
    ).join('');
    // Label aan de linkerkant (links van de eerste cel positie)
    const labelX = M.PAD + M.LABEL_W - 6;
    return `<g class="graven-svg-row" data-rij="${esc(rij)}">
      <text x="${labelX}" y="${y + M.CELL_H/2 + 4}" class="graven-svg-rowlabel"
            text-anchor="end" fill="#1e6b34">${esc(rij)}</text>
      ${cells}
    </g>`;
  }).join('');

  // Rechter zijde
  const rechterSvg = rechter.map(([rij, gs]) => {
    const rowIdx = M.RIGHT_ROW_IDX[rij];
    if (rowIdx === undefined) return '';
    const y = yFor(rowIdx);
    const trim = M.RIGHT_TRIM_END[rij] || 0;

    // R20: gat in het midden voor de halfcirkel
    let cellsHtml = '';
    if (rij === 'R20') {
      const splitAt = Math.min(M.R20_SPLIT_AFTER, gs.length);
      // Eerste deel
      for (let j = 0; j < splitAt; j++) {
        cellsHtml += buildCell(gs[j], rightCellsStartX + j * cellPitch, y);
      }
      // Gat van 6 cellen, daarna rest
      const restStart = splitAt + 6;
      for (let j = splitAt; j < gs.length; j++) {
        const visualPos = restStart + (j - splitAt);
        cellsHtml += buildCell(gs[j], rightCellsStartX + visualPos * cellPitch, y);
      }
    } else {
      cellsHtml = gs.map((g, j) =>
        buildCell(g, rightCellsStartX + j * cellPitch, y)
      ).join('');
    }

    const labelX = rightCellsEndX + M.LABEL_W - 6;
    return `<g class="graven-svg-row" data-rij="${esc(rij)}">
      ${cellsHtml}
      <text x="${labelX - trim}" y="${y + M.CELL_H/2 + 4}" class="graven-svg-rowlabel"
            text-anchor="start" fill="#1a4a7a">${esc(rij)}</text>
    </g>`;
  }).join('');

  // ─── STRUCTUREN (cirkels, paden, half-cirkel, kruis-hatch) ───
  const yTop = yFor(0) + M.CELL_H/2;
  const yCathedral = yFor(8) + M.CELL_H/2;
  const yIngang = yFor(20) + M.CELL_H + 8;

  const decor = `
    <g class="graven-decor">
      <!-- Kleine kapel/structuur bovenaan (tussen L1 en R1) -->
      <circle cx="${midX}" cy="${yTop}" r="34" fill="#fff" stroke="#666" stroke-width="2"/>
      <!-- Dak-symbool in de kleine cirkel -->
      <path d="M ${midX-13} ${yTop+5}
               L ${midX-13} ${yTop-2}
               L ${midX} ${yTop-12}
               L ${midX+13} ${yTop-2}
               L ${midX+13} ${yTop+5}
               L ${midX+5} ${yTop+5}
               L ${midX+5} ${yTop-1}
               L ${midX-5} ${yTop-1}
               L ${midX-5} ${yTop+5} Z"
            fill="none" stroke="#666" stroke-width="1.4"/>

      <!-- Kleine linker-rand cirkel (tussen L8 en L9) -->
      <circle cx="${leftCellsStartX + 20}" cy="${yFor(7) + M.ROW_H}" r="46"
              fill="#fff" stroke="#666" stroke-width="1.8"/>
      <circle cx="${leftCellsStartX + 20}" cy="${yFor(7) + M.ROW_H}" r="6"
              fill="#666"/>

      <!-- BIG CENTRALE KATHEDRAAL — cluster met concentrische ringen + 4 paden -->
      <g class="graven-cathedral">
        <!-- 4 cardinale paden (cross-pattern) -->
        <line x1="${midX - 100}" y1="${yCathedral}" x2="${midX + 100}" y2="${yCathedral}"
              stroke="#999" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="${midX}" y1="${yCathedral - 100}" x2="${midX}" y2="${yCathedral + 100}"
              stroke="#999" stroke-width="2.5" stroke-linecap="round"/>

        <!-- Buitenste grote cirkel -->
        <circle cx="${midX}" cy="${yCathedral}" r="95"
                fill="#fff" stroke="#555" stroke-width="2.5"/>

        <!-- Concentrische ringen -->
        <circle cx="${midX}" cy="${yCathedral}" r="68"
                fill="none" stroke="#888" stroke-width="1.3"/>
        <circle cx="${midX}" cy="${yCathedral}" r="42"
                fill="none" stroke="#888" stroke-width="1.3"/>
        <circle cx="${midX}" cy="${yCathedral}" r="22"
                fill="#fff" stroke="#555" stroke-width="1.6"/>

        <!-- Centrale kruis -->
        <line x1="${midX}" y1="${yCathedral - 14}" x2="${midX}" y2="${yCathedral + 14}"
              stroke="#222" stroke-width="3" stroke-linecap="round"/>
        <line x1="${midX - 10}" y1="${yCathedral - 7}" x2="${midX + 10}" y2="${yCathedral - 7}"
              stroke="#222" stroke-width="3" stroke-linecap="round"/>
      </g>

      <!-- Kleine rechter-rand cirkel (tussen R7 en R9) -->
      <circle cx="${rightCellsEndX - 22}" cy="${yFor(7) + M.ROW_H}" r="46"
              fill="#fff" stroke="#666" stroke-width="1.8"/>
      <circle cx="${rightCellsEndX - 22}" cy="${yFor(7) + M.ROW_H}" r="6"
              fill="#666"/>

      <!-- INGANG: gelaagde half-cirkel onderaan (in R20 gat) -->
      <g>
        ${[58, 48, 38, 28, 18].map((r, i) => `
          <path d="M ${midX - r} ${yIngang} Q ${midX} ${yIngang + r + 5} ${midX + r} ${yIngang}"
                fill="${i === 0 ? '#fff' : 'none'}" stroke="#666" stroke-width="${1.6 - i*0.15}"/>
        `).join('')}
      </g>

      <!-- KRUIS-HATCH structuur rechtsonder (na R21) -->
      <g>
        <rect x="${rightCellsStartX + rechterMaxCells * cellPitch - 70}"
              y="${yFor(20) + 6}"
              width="70" height="${M.ROW_H + 16}"
              fill="#fff" stroke="#666" stroke-width="1.5"/>
        <line x1="${rightCellsStartX + rechterMaxCells * cellPitch - 70}"
              y1="${yFor(20) + 6}"
              x2="${rightCellsStartX + rechterMaxCells * cellPitch}"
              y2="${yFor(20) + 6 + M.ROW_H + 16}"
              stroke="#999" stroke-width="1.2"/>
        <line x1="${rightCellsStartX + rechterMaxCells * cellPitch}"
              y1="${yFor(20) + 6}"
              x2="${rightCellsStartX + rechterMaxCells * cellPitch - 70}"
              y2="${yFor(20) + 6 + M.ROW_H + 16}"
              stroke="#999" stroke-width="1.2"/>
      </g>

      <!-- Horizontaal wandelpad (tussen rij 10 en 11) -->
      <line x1="${leftCellsStartX}" y1="${yFor(10) + M.ROW_H/2 - 2}"
            x2="${rightCellsEndX}" y2="${yFor(10) + M.ROW_H/2 - 2}"
            stroke="#bbb" stroke-width="1" stroke-dasharray="3,3"/>

      <!-- Stippel-paden onder bepaalde rijen (decoratief, als op originele kaart) -->
      ${[2, 5, 9, 13, 16, 19].map(idx => `
        <line x1="${leftCellsStartX + 4}" y1="${yFor(idx) + M.CELL_H + 1}"
              x2="${leftCellsEndX - 4}" y2="${yFor(idx) + M.CELL_H + 1}"
              stroke="#d0c8b8" stroke-width="0.6" stroke-dasharray="1.5,2"/>
        <line x1="${rightCellsStartX + 4}" y1="${yFor(idx) + M.CELL_H + 1}"
              x2="${rightCellsEndX - 4}" y2="${yFor(idx) + M.CELL_H + 1}"
              stroke="#d0c8b8" stroke-width="0.6" stroke-dasharray="1.5,2"/>
      `).join('')}
    </g>`;

  // ─── FILTER STIJL ───
  const search = ($('#graven-search')?.value || '').trim();
  const statusFilter = $('#graven-status-filter')?.value || '';
  let filterStyle = '';
  if (search || statusFilter) {
    const matchSel = [];
    if (search) {
      GravenStore.cache
        .filter(g => String(g.nummer).includes(search))
        .forEach(g => matchSel.push(`.graven-cell-group[data-id="${g.id}"] .graven-svg-cell`));
    }
    filterStyle = `<style>
      .graven-svg-cell { opacity: .2; }
      .graven-svg-nr { opacity: .25; }
      ${search ? matchSel.join(',') + ' { opacity: 1 !important; stroke: var(--primary); stroke-width: 1.8; }' : ''}
      ${search ? matchSel.join(',').replace(/\.graven-svg-cell/g, '.graven-svg-nr') + ' { opacity: 1 !important; font-weight: 700; }' : ''}
      ${statusFilter ? `.graven-${statusFilter} { opacity: 1 !important; } .graven-cell-group:has(.graven-${statusFilter}) .graven-svg-nr { opacity: 1 !important; }` : ''}
    </style>`;
  }

  const zoom = parseInt($('#graven-zoom')?.value || '100', 10);
  $('#graven-map-wrap').innerHTML = `
    ${filterStyle}
    <div class="graven-map-scroller" style="--zoom:${zoom/100};">
      <svg class="graven-svg" viewBox="0 0 ${totalW} ${totalH}"
           width="${totalW}" height="${totalH}" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff" rx="6"/>
        ${titleSvg}
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

    <div class="graf-modal-row">
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
      renderGravenMap();
    } catch (e) {
      Modal.show({ type: 'error', title: 'Opslaan mislukt', message: e.message || String(e) });
    }
  });
}
