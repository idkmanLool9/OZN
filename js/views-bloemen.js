// Bloemen-catalogus: gebruiker beheert eigen bloemstukken (naam, omschrijving, prijs, foto)

let _bloemEditing = null; // null = nieuw formulier dicht; 'new' = nieuw; <id> = bewerken

function bloemSVG() {
  return `
    <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="bg" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="#f7e7e0"/>
          <stop offset="1" stop-color="#e7d3c8"/>
        </radialGradient>
      </defs>
      <rect width="240" height="130" fill="url(#bg)"/>
      <g transform="translate(120 75)">
        <circle r="34" fill="#3a7d44" opacity=".25"/>
        <g fill="#c94f6d">
          <circle cx="-18" cy="-12" r="11"/>
          <circle cx="18"  cy="-12" r="11"/>
          <circle cx="-12" cy="14"  r="11"/>
          <circle cx="14"  cy="14"  r="11"/>
          <circle cx="0"   cy="-2"  r="13"/>
        </g>
        <g fill="#fff">
          <circle cx="-18" cy="-12" r="3"/>
          <circle cx="18"  cy="-12" r="3"/>
          <circle cx="-12" cy="14"  r="3"/>
          <circle cx="14"  cy="14"  r="3"/>
          <circle cx="0"   cy="-2"  r="3"/>
        </g>
        <g fill="#3a7d44">
          <ellipse cx="-26" cy="6"  rx="9" ry="4" transform="rotate(-25 -26 6)"/>
          <ellipse cx="26"  cy="6"  rx="9" ry="4" transform="rotate(25 26 6)"/>
          <ellipse cx="0"   cy="22" rx="9" ry="4"/>
        </g>
      </g>
    </svg>`;
}

function renderBloemenBeheer(msg) {
  const items = DB.list(KEYS.BLOEMEN).slice().sort((a, b) => a.naam.localeCompare(b.naam));

  const editing = _bloemEditing === 'new' ? { naam: '', omschrijving: '', bedrag: '' }
                : (_bloemEditing != null ? items.find(x => x.id === _bloemEditing) : null);

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Bloemenbeheer</h1>
          <p class="muted">Eigen catalogus van bloemstukken. Verschijnen automatisch in het intake-formulier en het dossieroverzicht.</p>
        </div>
        ${editing ? '' : '<button type="button" class="btn btn-primary" id="btn-nieuw-bloem">+ Nieuw bloemstuk</button>'}
      </div>
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}

      ${editing ? `
        <section class="card narrow">
          <h2>${_bloemEditing === 'new' ? 'Nieuw bloemstuk' : 'Bloemstuk bewerken'}</h2>
          <form id="bloem-form" class="form" autocomplete="off">
            <label><span>Naam</span><input type="text" name="naam" value="${esc(editing.naam || '')}" required></label>
            <label><span>Omschrijving</span><textarea name="omschrijving" rows="3">${esc(editing.omschrijving || '')}</textarea></label>
            <label><span>Prijs (€)</span><input type="text" name="bedrag" value="${editing.bedrag != null ? String(editing.bedrag).replace('.', ',') : ''}" inputmode="decimal" placeholder="0,00"></label>
            <label><span>Foto (jpg/png, max 5 MB)</span><input type="file" name="foto" accept="image/*"></label>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="btn-cancel-bloem">Annuleren</button>
              <button type="submit" class="btn btn-primary">${_bloemEditing === 'new' ? 'Aanmaken' : 'Opslaan'}</button>
            </div>
          </form>
        </section>` : ''}

      ${items.length === 0
        ? '<div class="card"><p class="muted">Nog geen bloemstukken. Klik rechtsboven op "+ Nieuw bloemstuk" om er een toe te voegen.</p></div>'
        : `<div class="kist-grid">
            ${items.map(b => {
              const url = BloemenFotos.urlVoor(b.naam);
              return `
                <div class="kist-card" data-id="${b.id}">
                  <div class="kist-card-img">
                    ${url
                      ? `<img src="${esc(url)}" alt="${esc(b.naam)}" loading="lazy">`
                      : `<div class="kist-card-svg">${bloemSVG()}</div>
                         <div class="kist-card-no-img">geen foto</div>`}
                  </div>
                  <div class="kist-card-meta">
                    <strong>${esc(b.naam)}</strong>
                    ${b.omschrijving ? `<span class="muted small">${esc(b.omschrijving)}</span>` : ''}
                    <span class="kist-price">${fmtEUR(b.bedrag)}</span>
                  </div>
                  <div class="kist-card-actions">
                    <button type="button" class="btn btn-sm" data-edit="${b.id}">Bewerken</button>
                    <button type="button" class="btn btn-sm btn-ghost" data-delete="${b.id}">Verwijderen</button>
                  </div>
                </div>`;
            }).join('')}
          </div>`}
    </div>`;

  const newBtn = $('#btn-nieuw-bloem');
  if (newBtn) newBtn.addEventListener('click', () => { _bloemEditing = 'new'; renderBloemenBeheer(); });

  const cancelBtn = $('#btn-cancel-bloem');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { _bloemEditing = null; renderBloemenBeheer(); });

  const form = $('#bloem-form');
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
        if (!file.type.startsWith('image/')) return renderBloemenBeheer({ error: 'Alleen afbeeldingen toegestaan.' });
        if (file.size > 5 * 1024 * 1024) return renderBloemenBeheer({ error: 'Foto te groot (max. 5 MB).' });
      }
      const submitBtn = f.querySelector('button[type=submit]');
      submitBtn.disabled = true; submitBtn.textContent = 'Bezig...';
      try {
        let storage_pad = (typeof editing.id === 'number') ? editing.storage_pad : null;
        if (file) storage_pad = await BloemenFotos.uploadFoto(naam, file);
        if (_bloemEditing === 'new') {
          await DB.insert(KEYS.BLOEMEN, { naam, omschrijving, bedrag, storage_pad });
        } else {
          await DB.update(KEYS.BLOEMEN, editing.id, { naam, omschrijving, bedrag, storage_pad });
        }
        _bloemEditing = null;
        renderBloemenBeheer({ success: 'Opgeslagen.' });
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = (_bloemEditing === 'new' ? 'Aanmaken' : 'Opslaan');
      }
    });
  }

  $('#view').addEventListener('click', async e => {
    const ed = e.target.closest('button[data-edit]');
    const del = e.target.closest('button[data-delete]');
    if (ed) {
      _bloemEditing = parseInt(ed.getAttribute('data-edit'), 10);
      renderBloemenBeheer();
      return;
    }
    if (del) {
      const id = parseInt(del.getAttribute('data-delete'), 10);
      const b = DB.byId(KEYS.BLOEMEN, id);
      if (!b) return;
      if (!confirm(`Bloemstuk "${b.naam}" verwijderen?`)) return;
      try {
        await BloemenFotos.removeFoto(b);
        await DB.remove(KEYS.BLOEMEN, id);
        renderBloemenBeheer({ success: 'Verwijderd.' });
      } catch (_) {}
    }
  });
}
