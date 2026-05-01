// Kistenbeheer: per Unigra-model een echte foto uploaden

function renderKistenBeheer(msg) {
  const items = KISTEN_CATALOGUS.slice().sort((a, b) => a.bedrag - b.bedrag);
  const adminMode = !!Settings.get('catalog_admin_mode');

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

  $('#view').addEventListener('change', async e => {
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
  });

  $('#view').addEventListener('click', async e => {
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
    if (!confirm(`Foto van "${naam}" verwijderen?`)) return;
    try {
      await KistFotos.remove(naam);
      renderKistenBeheer({ success: 'Foto verwijderd.' });
    } catch (_) {}
  });
}
