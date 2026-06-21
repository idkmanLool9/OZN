// Kistenbeheer: per Unigra-model een echte foto uploaden

// Detecteer alle actieve dossier-drafts in localStorage zodat we direct
// een kist kunnen koppelen aan een dossier-in-bewerking.
function _activeDossierDrafts() {
  const drafts = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sok_draft_')) continue;
      let data = null;
      try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
      if (!data) continue;
      const idPart = key.slice('sok_draft_'.length);
      const isNew = idPart === 'new';
      const naam = [data.voornaam, data.achternaam].filter(Boolean).join(' ').trim()
        || (isNew ? 'Nieuw dossier (concept)' : ('Dossier #' + idPart));
      drafts.push({
        key, isNew, id: isNew ? null : idPart, naam,
        kist: data.kist_type || '',
      });
    }
  } catch (_) {}
  return drafts;
}

function _setKistInDraft(key, kistNaam) {
  try {
    const cur = JSON.parse(localStorage.getItem(key) || '{}');
    cur.kist_type = kistNaam;
    localStorage.setItem(key, JSON.stringify(cur));
    return true;
  } catch (_) { return false; }
}

function renderKistenBeheer(msg) {
  const items = KISTEN_CATALOGUS.slice().sort((a, b) => a.bedrag - b.bedrag);
  const adminMode = !!Settings.get('catalog_admin_mode');
  const drafts = _activeDossierDrafts();
  const hasDraft = drafts.length > 0;

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Kisten</h1>
          <p class="muted">Klik op een kist voor een grotere afbeelding.${adminMode ? ' Beheermodus aan — je kunt foto\'s vervangen of verwijderen.' : ''}</p>
        </div>
        ${adminMode ? '<span class="badge badge-amber">Beheermodus aan</span>' : ''}
      </div>
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${hasDraft ? `
        <div class="alert alert-info kist-draft-banner">
          <strong>💡 Actief dossier:</strong>
          ${drafts.length === 1
            ? `<span>${esc(drafts[0].naam)}${drafts[0].kist ? ' — huidige kist: <em>' + esc(drafts[0].kist) + '</em>' : ''}</span>`
            : `<select id="kist-draft-picker">${drafts.map((d, i) => `<option value="${i}">${esc(d.naam)}${d.kist ? ' — ' + esc(d.kist) : ''}</option>`).join('')}</select>`}
          <span class="muted small">— klik op de "Kies"-knop bij een kist om hem in het dossier te zetten</span>
        </div>` : ''}
      <div class="kist-grid">
        ${items.map(k => {
          const url = KistFotos.urlVoor(k.naam);
          return `
            <div class="kist-card" data-naam="${esc(k.naam)}">
              <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-naam="${esc(k.naam)}" aria-label="Vergroot ${esc(k.naam)}">
                ${url
                  ? `<img src="${esc(url)}" alt="${esc(k.naam)}" loading="lazy">`
                  : `<div class="kist-card-svg">${kistSVG(k.materiaal)}</div>
                     <div class="kist-card-no-img">geen foto</div>`}
              </button>
              <div class="kist-card-meta">
                <strong>${esc(k.naam)}</strong>
                <span class="muted small">${esc(k.materiaal)}</span>
                <span class="kist-price">${fmtEUR(k.bedrag)}</span>
              </div>
              ${hasDraft ? `
                <div class="kist-card-actions">
                  <button type="button" class="btn btn-sm btn-primary" data-pick-kist="${esc(k.naam)}">✓ Kies voor dossier</button>
                </div>` : ''}
              ${adminMode ? `
                <div class="kist-card-actions">
                  <label class="btn btn-sm">${url ? 'Vervang foto' : 'Foto uploaden'}
                    <input type="file" accept="image/*" data-upload="${esc(k.naam)}" hidden>
                  </label>
                  ${url ? `<button type="button" class="btn btn-sm btn-ghost" data-remove="${esc(k.naam)}">Verwijder</button>` : ''}
                </div>` : ''}
            </div>`;
        }).join('')}
      </div>
      ${adminMode ? '' : `
        <p class="muted small center" style="margin-top:1.5rem;">
          Foto's vervangen of verwijderen? Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a>.
        </p>`}
    </div>`;

  $('#view').onchange = async e => {
    const inp = e.target.closest('input[data-upload]');
    if (!inp) return;
    const naam = inp.getAttribute('data-upload');
    const file = inp.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      renderKistenBeheer({ error: 'Alleen afbeeldingsbestanden toegestaan.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      renderKistenBeheer({ error: 'Foto te groot (max. 5 MB).' });
      return;
    }
    const card = $(`.kist-card[data-naam="${CSS.escape(naam)}"]`);
    if (card) card.classList.add('is-uploading');
    try {
      await KistFotos.upload(naam, file);
      renderKistenBeheer({ success: `Foto opgeslagen voor "${naam}".` });
    } catch (_) {
      if (card) card.classList.remove('is-uploading');
    }
  };

  $('#view').onclick = async e => {
    // Kies kist voor actief dossier
    const pickBtn = e.target.closest('button[data-pick-kist]');
    if (pickBtn) {
      const kistNaam = pickBtn.getAttribute('data-pick-kist');
      const picker = $('#kist-draft-picker');
      const idx = picker ? parseInt(picker.value, 10) : 0;
      const target = drafts[idx];
      if (!target) return;
      const ok = _setKistInDraft(target.key, kistNaam);
      if (!ok) {
        Modal.show({ type: 'error', title: 'Niet gelukt', message: 'Kon de kist niet in het dossier zetten.' });
        return;
      }
      const confirmGo = await Modal.confirm({
        type: 'success',
        title: `"${kistNaam}" gekoppeld`,
        message: `Toegevoegd aan dossier ${target.naam}. Wil je nu terug naar dat dossier?`,
        confirmText: 'Ja, ga terug',
        cancelText: 'Blijf hier',
      });
      if (confirmGo) {
        Router.go(target.isNew ? '/dossiers/nieuw' : '/dossiers/' + target.id + '/bewerken');
      } else {
        renderKistenBeheer({ success: `Kist "${kistNaam}" gekoppeld aan ${target.naam}.` });
      }
      return;
    }
    // Klik op afbeelding → lightbox
    const zoom = e.target.closest('button[data-action="zoom"]');
    if (zoom) {
      const naam = zoom.getAttribute('data-naam');
      const k = KISTEN_CATALOGUS.find(x => x.naam === naam); if (!k) return;
      Lightbox.show({
        src: KistFotos.urlVoor(k.naam) || null,
        svgFallback: kistSVG(k.materiaal),
        title: k.naam,
        subtitle: k.materiaal,
        price: fmtEUR(k.bedrag),
      });
      return;
    }
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    const naam = btn.getAttribute('data-remove');
    const ok = await Modal.confirm({ title: 'Foto verwijderen?', message: `De foto van "${naam}" wordt definitief verwijderd.`, confirmText: 'Verwijderen' });
    if (!ok) return;
    try {
      await KistFotos.remove(naam);
      renderKistenBeheer({ success: 'Foto verwijderd.' });
    } catch (_) {}
  };
}
