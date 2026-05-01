// Eten & drinken-catalogus: simit, koffie, thee, baklava, ... — gebruikers beheren zelf

let _edEditing = null;

function edSVG() {
  return `
    <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="edbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff5e0"/>
          <stop offset="1" stop-color="#ecd9a8"/>
        </linearGradient>
      </defs>
      <rect width="240" height="130" fill="url(#edbg)"/>
      <!-- Koffiekop -->
      <g transform="translate(70 78)">
        <ellipse cx="0" cy="0" rx="32" ry="8" fill="#7a4a20" opacity=".45"/>
        <path d="M -32 0 L -28 24 Q -28 32 -20 32 L 20 32 Q 28 32 28 24 L 32 0 Z"
              fill="#f4f1ec" stroke="#8a6a48" stroke-width="1.5"/>
        <ellipse cx="0" cy="0" rx="28" ry="6" fill="#5a3a1a"/>
        <path d="M 30 6 Q 44 6 44 16 Q 44 26 30 26"
              fill="none" stroke="#8a6a48" stroke-width="2.5"/>
        <!-- stoom -->
        <g stroke="#bca580" stroke-width="1.6" fill="none" opacity=".7" stroke-linecap="round">
          <path d="M -8 -10 Q -4 -16 -8 -22 Q -12 -28 -8 -34"/>
          <path d="M  4 -10 Q  8 -16  4 -22 Q  0 -28  4 -34"/>
        </g>
      </g>
      <!-- Simit (ringbroodje met sesam) -->
      <g transform="translate(170 65)">
        <circle r="34" fill="#c98a3a" stroke="#7a4a18" stroke-width="2"/>
        <circle r="14" fill="#ecd9a8" stroke="#7a4a18" stroke-width="1.5"/>
        <g fill="#fffbe5" stroke="#a07a40" stroke-width=".4">
          <circle cx="-22" cy="-12" r="1.4"/>
          <circle cx="-12" cy="-24" r="1.4"/>
          <circle cx="6" cy="-26" r="1.4"/>
          <circle cx="22" cy="-14" r="1.4"/>
          <circle cx="26" cy="6" r="1.4"/>
          <circle cx="20" cy="22" r="1.4"/>
          <circle cx="2" cy="28" r="1.4"/>
          <circle cx="-16" cy="22" r="1.4"/>
          <circle cx="-26" cy="6" r="1.4"/>
        </g>
      </g>
    </svg>`;
}

function renderEtenDrinkenBeheer(msg) {
  const items = DB.list(KEYS.ETEN_DRINKEN).slice().sort((a, b) => a.naam.localeCompare(b.naam));
  const adminMode = !!Settings.get('catalog_admin_mode');

  const editing = _edEditing === 'new' ? { naam: '', omschrijving: '', bedrag: '' }
                : (_edEditing != null ? items.find(x => x.id === _edEditing) : null);

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Eten &amp; drinken</h1>
          <p class="muted">Producten die bij het condoleance worden geserveerd: simit, koffie, thee, baklava, börek, ...</p>
        </div>
        ${editing ? '' : (adminMode ? '<button type="button" class="btn btn-primary" id="btn-nieuw-ed">+ Nieuw product</button>' : '')}
      </div>
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}

      ${editing ? `
        <section class="card narrow">
          <h2>${_edEditing === 'new' ? 'Nieuw product' : 'Product bewerken'}</h2>
          <form id="ed-form" class="form" autocomplete="off">
            <label><span>Naam</span><input type="text" name="naam" value="${esc(editing.naam || '')}" required placeholder="bv. Simit, Koffie, Thee, Baklava"></label>
            <label><span>Omschrijving</span><textarea name="omschrijving" rows="3">${esc(editing.omschrijving || '')}</textarea></label>
            <label><span>Prijs (€)</span><input type="text" name="bedrag" value="${editing.bedrag != null ? String(editing.bedrag).replace('.', ',') : ''}" inputmode="decimal" placeholder="0,00"></label>
            <label><span>Foto (jpg/png, max 5 MB)</span><input type="file" name="foto" accept="image/*"></label>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="btn-cancel-ed">Annuleren</button>
              <button type="submit" class="btn btn-primary">${_edEditing === 'new' ? 'Aanmaken' : 'Opslaan'}</button>
            </div>
          </form>
        </section>` : ''}

      ${items.length === 0
        ? `<div class="card"><p class="muted">Nog geen producten. ${adminMode ? 'Klik rechtsboven op "+ Nieuw product" om er een toe te voegen.' : 'Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a> om producten toe te voegen.'}</p></div>`
        : `<div class="kist-grid">
            ${items.map(b => {
              const url = EtenDrinkenFotos.urlVoor(b.naam);
              return `
                <div class="kist-card" data-id="${b.id}">
                  <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-id="${b.id}" aria-label="Vergroot ${esc(b.naam)}">
                    ${url
                      ? `<img src="${esc(url)}" alt="${esc(b.naam)}" loading="lazy">`
                      : `<div class="kist-card-svg">${edSVG()}</div>
                         <div class="kist-card-no-img">geen foto</div>`}
                  </button>
                  <div class="kist-card-meta">
                    <strong>${esc(b.naam)}</strong>
                    ${b.omschrijving ? `<span class="muted small">${esc(b.omschrijving)}</span>` : ''}
                    <span class="kist-price">${fmtEUR(b.bedrag)}</span>
                  </div>
                  ${adminMode ? `
                    <div class="kist-card-actions">
                      <button type="button" class="btn btn-sm" data-edit="${b.id}">Bewerken</button>
                      <button type="button" class="btn btn-sm btn-ghost" data-delete="${b.id}">Verwijderen</button>
                    </div>` : ''}
                </div>`;
            }).join('')}
          </div>
          ${adminMode ? '' : `<p class="muted small center" style="margin-top:1.5rem;">Toevoegen of bewerken? Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a>.</p>`}`}
    </div>`;

  const newBtn = $('#btn-nieuw-ed');
  if (newBtn) newBtn.addEventListener('click', () => { _edEditing = 'new'; renderEtenDrinkenBeheer(); });

  const cancelBtn = $('#btn-cancel-ed');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { _edEditing = null; renderEtenDrinkenBeheer(); });

  const form = $('#ed-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const naam = f.naam.value.trim();
      if (!naam) return;
      const bedrag = parseEUR(f.bedrag.value);
      const omschrijving = f.omschrijving.value.trim() || null;
      const file = f.foto.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) return renderEtenDrinkenBeheer({ error: 'Alleen afbeeldingen toegestaan.' });
        if (file.size > 5 * 1024 * 1024) return renderEtenDrinkenBeheer({ error: 'Foto te groot (max. 5 MB).' });
      }
      const submitBtn = f.querySelector('button[type=submit]');
      submitBtn.disabled = true; submitBtn.textContent = 'Bezig...';
      try {
        let storage_pad = (typeof editing.id === 'number') ? editing.storage_pad : null;
        if (file) storage_pad = await EtenDrinkenFotos.uploadFoto(naam, file);
        if (_edEditing === 'new') {
          await DB.insert(KEYS.ETEN_DRINKEN, { naam, omschrijving, bedrag, storage_pad });
        } else {
          await DB.update(KEYS.ETEN_DRINKEN, editing.id, { naam, omschrijving, bedrag, storage_pad });
        }
        _edEditing = null;
        renderEtenDrinkenBeheer({ success: 'Opgeslagen.' });
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = (_edEditing === 'new' ? 'Aanmaken' : 'Opslaan');
      }
    });
  }

  $('#view').onclick = async e => {
    const zoom = e.target.closest('button[data-action="zoom"]');
    if (zoom) {
      const id = parseInt(zoom.getAttribute('data-id'), 10);
      const b = DB.byId(KEYS.ETEN_DRINKEN, id); if (!b) return;
      Lightbox.show({
        src: EtenDrinkenFotos.urlVoor(b.naam) || null,
        svgFallback: edSVG(),
        title: b.naam,
        subtitle: b.omschrijving || '',
        price: b.bedrag ? fmtEUR(b.bedrag) : '',
      });
      return;
    }
    const ed = e.target.closest('button[data-edit]');
    const del = e.target.closest('button[data-delete]');
    if (ed) {
      _edEditing = parseInt(ed.getAttribute('data-edit'), 10);
      renderEtenDrinkenBeheer();
      return;
    }
    if (del) {
      const id = parseInt(del.getAttribute('data-delete'), 10);
      const b = DB.byId(KEYS.ETEN_DRINKEN, id);
      if (!b) return;
      if (!confirm(`Product "${b.naam}" verwijderen?`)) return;
      try {
        await EtenDrinkenFotos.removeFoto(b);
        await DB.remove(KEYS.ETEN_DRINKEN, id);
        renderEtenDrinkenBeheer({ success: 'Verwijderd.' });
      } catch (_) {}
    }
  };
}
