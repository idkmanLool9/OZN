// Kistenbeheer: per Unigra-model een echte foto uploaden

function renderKistenBeheer(msg) {
  const items = KISTEN_CATALOGUS.slice().sort((a, b) => a.bedrag - b.bedrag);

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Kistenbeheer</h1>
          <p class="muted">Upload per model één foto. Deze verschijnt automatisch overal waar de kist getoond wordt (intake-formulier en dossieroverzicht).</p>
        </div>
      </div>
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      <div class="kist-grid">
        ${items.map(k => {
          const url = KistFotos.urlVoor(k.naam);
          const slug = KistFotos.slug(k.naam);
          return `
            <div class="kist-card" data-naam="${esc(k.naam)}">
              <div class="kist-card-img">
                ${url
                  ? `<img src="${esc(url)}" alt="${esc(k.naam)}" loading="lazy">`
                  : `<div class="kist-card-svg">${kistSVG(k.materiaal)}</div>
                     <div class="kist-card-no-img">geen foto</div>`}
              </div>
              <div class="kist-card-meta">
                <strong>${esc(k.naam)}</strong>
                <span class="muted small">${esc(k.materiaal)}</span>
                <span class="kist-price">${fmtEUR(k.bedrag)}</span>
              </div>
              <div class="kist-card-actions">
                <label class="btn btn-sm">${url ? 'Vervang foto' : 'Foto uploaden'}
                  <input type="file" accept="image/*" data-upload="${esc(k.naam)}" hidden>
                </label>
                ${url ? `<button type="button" class="btn btn-sm btn-ghost" data-remove="${esc(k.naam)}">Verwijder</button>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
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
