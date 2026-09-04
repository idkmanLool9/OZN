// Kistencatalogus: kaart-galerij met filters, favorieten en dossier-koppeling.

// Detecteer alle actieve dossier-drafts zodat we direct een kist kunnen
// koppelen aan een dossier-in-bewerking.
//
// Autoritatief signaal is de sessionStorage-vlag 'sok_actief_sok_draft_<id>'
// die view-form zet zodra 'ie opent. De localStorage-draft is optioneel:
// bij een BESTAAND dossier dat je net hebt geopend maar nog niet gewijzigd,
// bestaat de localStorage-draft nog niet — dan vallen we terug op de
// dossier-rij uit Cloud.cache. Zonder deze fallback zag de kisten-pagina
// je 'actief dossier' niet totdat je iets had getypt (bug).
function _activeDossierDrafts() {
  const drafts = [];
  const gezien = new Set();
  try {
    // Loop over sessionStorage-vlaggen (autoritatief: 'ik zit nu in dossier X')
    for (let i = 0; i < sessionStorage.length; i++) {
      const skey = sessionStorage.key(i);
      if (!skey || !skey.startsWith('sok_actief_sok_draft_')) continue;
      if (sessionStorage.getItem(skey) !== '1') continue;
      const key = skey.slice('sok_actief_'.length); // → sok_draft_<id>
      if (gezien.has(key)) continue;
      gezien.add(key);
      const idPart = key.slice('sok_draft_'.length);
      const isNew = idPart === 'new';
      // Probeer draft-data uit localStorage; anders val terug op DB-cache
      let data = null;
      try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
      if (!data && !isNew && typeof Cloud !== 'undefined' && Cloud.cache) {
        const rij = (Cloud.cache.dossiers || []).find(x => String(x.id) === String(idPart));
        if (rij) data = rij;
      }
      if (!data) data = {}; // laatste redmiddel: lege data — kaart heet dan 'Nieuw dossier (concept)' / 'Dossier #<id>'
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

// ─── Filter-state (blijft bewaard tussen re-renders) ─────────────────────────
let _kistFilter = '';      // zoekterm
let _kistMateriaal = '';   // materiaalgroep
let _kistKleur = '';       // kleurgroep
let _kistPrijs = '';       // prijs-range key
let _kistPagina = 1;       // huidige pagina
let _kistWeergave = 'grid';// 'grid' | 'lijst'
const KISTEN_PER_PAGINA = 12;

const KIST_PRIJS_RANGES = [
  { key: '<700',      label: 'tot € 700',         test: b => b < 700 },
  { key: '700-1200',  label: '€ 700 – 1.200',     test: b => b >= 700 && b < 1200 },
  { key: '1200-2000', label: '€ 1.200 – 2.000',   test: b => b >= 1200 && b < 2000 },
  { key: '>2000',     label: 'vanaf € 2.000',     test: b => b >= 2000 },
];

// Materiaal-/kleurgroep afleiden uit de vrije materiaal-tekst
function _kistMateriaalGroep(materiaal) {
  const m = (materiaal || '').toLowerCase();
  if (m.includes('populieren')) return 'Populieren';
  if (m.includes('eiken'))      return 'Eiken';
  if (m.includes('grenen'))     return 'Grenen';
  if (m.includes('vuren'))      return 'Vuren';
  if (m.includes('mahonie'))    return 'Mahonie';
  if (m.includes('rotan'))      return 'Rotan';
  if (m.includes('bamboe'))     return 'Bamboe';
  if (m.includes('wilgen'))     return 'Wilgenteen';
  if (m.includes('manilla') || m.includes('abaca') || m.includes('hennep')) return 'Manillahennep';
  if (m.includes('houtdecor'))  return 'Houtdecor';
  if (m.includes('gelakt') || m.includes('ral')) return 'Gelakt';
  if (m.includes('massief hout')) return 'Massief hout';
  return 'Overig';
}
function _kistKleurGroep(materiaal) {
  const m = (materiaal || '').toLowerCase();
  if (m.includes('wit'))        return 'Wit';
  if (m.includes('zwart'))      return 'Zwart';
  if (m.includes('grijs'))      return 'Grijs';
  if (m.includes('mahonie'))    return 'Donkerbruin';
  if (m.includes('eiken'))      return 'Eikenbruin';
  return 'Naturel';
}

// Favorieten (persoonlijk, in localStorage)
function _kistFavs() {
  try { return JSON.parse(localStorage.getItem('sok_kist_favs') || '[]'); } catch (_) { return []; }
}
function _toggleKistFav(naam) {
  const f = _kistFavs();
  const i = f.indexOf(naam);
  if (i >= 0) f.splice(i, 1); else f.push(naam);
  try { localStorage.setItem('sok_kist_favs', JSON.stringify(f)); } catch (_) {}
}

// "Meest gekozen" = de kist die het vaakst in bestaande dossiers voorkomt
function _meestGekozenKist() {
  const tel = {};
  try {
    DB.list(KEYS.DOSSIERS).forEach(d => {
      if (d.kist_type) tel[d.kist_type] = (tel[d.kist_type] || 0) + 1;
    });
  } catch (_) {}
  let best = null, n = 0;
  for (const k in tel) if (tel[k] > n) { n = tel[k]; best = k; }
  return n > 0 ? best : null;
}

function _kistFiltersActief() {
  return !!(_kistFilter || _kistMateriaal || _kistKleur || _kistPrijs);
}

// Modal om een eigen kist toe te voegen of te bewerken. Doorgeef-parameter
// bestaandeNaam = 'Naam' → bewerk-modus (voorvullen uit kisten_eigen).
async function _promptNieuweKist(bestaandeNaam) {
  const eigen = Settings.get('kisten_eigen') || [];
  const bestaand = bestaandeNaam ? eigen.find(x => x && x.naam === bestaandeNaam) : null;
  const materialen = [...new Set(KISTEN_CATALOGUS.map(k => k.materiaal))].sort();
  const heeftAlFoto = bestaand ? !!KistFotos.urlVoor(bestaandeNaam) : false;
  const html = `
    <div class="pincode-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;">
      <div class="card" style="max-width:520px;width:100%;background:var(--surface);padding:1.5rem;border-radius:.75rem;max-height:92vh;overflow-y:auto;">
        <h2 style="margin-top:0;">${bestaand ? 'Kist bewerken' : 'Nieuwe kist toevoegen'}</h2>
        <form id="frm-nieuwe-kist">
          <label style="display:block;margin:.75rem 0;">
            <span>Naam <span style="color:#b00;">*</span></span>
            <input type="text" name="naam" required maxlength="80" value="${esc(bestaand?.naam || '')}" style="width:100%;padding:.5rem;">
          </label>
          <label style="display:block;margin:.75rem 0;">
            <span>Materiaal / omschrijving</span>
            <input type="text" name="materiaal" list="mat-suggesties" maxlength="120" value="${esc(bestaand?.materiaal || '')}" style="width:100%;padding:.5rem;" placeholder="bv. Massief eiken, rustiek">
            <datalist id="mat-suggesties">
              ${materialen.map(m => `<option value="${esc(m)}">`).join('')}
            </datalist>
          </label>
          <label style="display:block;margin:.75rem 0;">
            <span>Adviesprijs (€)</span>
            <input type="text" name="bedrag" inputmode="decimal" value="${bestaand?.bedrag ? String(bestaand.bedrag).replace('.', ',') : ''}" style="width:100%;padding:.5rem;" placeholder="bv. 1234,56">
          </label>
          <label style="display:block;margin:.75rem 0;">
            <span>Kleur (optioneel)</span>
            <input type="text" name="kleur" maxlength="60" value="${esc(bestaand?.kleur || '')}" style="width:100%;padding:.5rem;" placeholder="bv. Naturel, Blank hout">
          </label>

          <fieldset style="margin:1.25rem 0 .5rem;padding:.9rem 1rem;border:1px solid var(--border,#e5e0d5);border-radius:.5rem;">
            <legend style="padding:0 .35rem;font-weight:600;font-size:.95rem;">📷 Foto van de kist</legend>
            ${heeftAlFoto ? `<p class="muted small" style="margin:.25rem 0 .5rem;">Er staat al een foto voor deze kist. Kies "Vervangen" om 'm te overschrijven.</p>` : ''}
            <div style="display:flex;flex-direction:column;gap:.5rem;margin:.5rem 0;">
              <label style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;background:var(--surface);border:1px solid var(--border);border-radius:.35rem;cursor:pointer;">
                <input type="radio" name="foto_keuze" value="ja" ${!bestaand ? '' : (heeftAlFoto ? '' : 'checked')}>
                <span><strong>${heeftAlFoto ? 'Vervangen' : 'Ja, ik heb een foto'}</strong>${heeftAlFoto ? '' : ' — kies een bestand hieronder'}</span>
              </label>
              <label style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;background:var(--surface);border:1px solid var(--border);border-radius:.35rem;cursor:pointer;">
                <input type="radio" name="foto_keuze" value="nee" ${!bestaand && !heeftAlFoto ? 'checked' : ''}>
                <span><strong>Nee, geen foto</strong> — er komt een "Geen afbeelding"-pictogram op de kaart</span>
              </label>
            </div>
            <div id="foto-input-wrap" style="margin-top:.5rem;display:none;">
              <input type="file" name="foto" accept="image/*" style="width:100%;">
              <p class="muted small" style="margin:.4rem 0 0;">Max. 5 MB. JPG/PNG. Wordt automatisch gecomprimeerd tot ~1600 px.</p>
              <div id="foto-preview" style="margin-top:.5rem;display:none;">
                <img alt="Voorbeeld" style="max-width:100%;max-height:180px;border-radius:.4rem;border:1px solid var(--border);">
              </div>
            </div>
            <p id="foto-nee-hint" class="muted small" style="margin:.5rem 0 0;padding:.6rem;background:#1e1e1e;color:rgba(255,255,255,.75);border-radius:.35rem;display:none;">
              ℹ️ Kaart krijgt automatisch de "Geen afbeelding"-placeholder. Je kunt later altijd nog een foto uploaden via het 📷 icoontje op de kist-kaart.
            </p>
          </fieldset>

          <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem;">
            <button type="button" class="btn btn-ghost" id="btn-kist-annuleer">Annuleren</button>
            <button type="submit" class="btn btn-primary">${bestaand ? 'Opslaan' : 'Toevoegen'}</button>
          </div>
        </form>
      </div>
    </div>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const overlay = wrap.firstElementChild;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.id === 'btn-kist-annuleer') close();
  });

  // Foto-keuze radio's togglen de UI
  const fotoWrap = overlay.querySelector('#foto-input-wrap');
  const neeHint  = overlay.querySelector('#foto-nee-hint');
  const preview  = overlay.querySelector('#foto-preview');
  const previewImg = preview.querySelector('img');
  const syncFotoUI = () => {
    const val = (overlay.querySelector('input[name="foto_keuze"]:checked') || {}).value;
    if (val === 'ja') { fotoWrap.style.display = ''; neeHint.style.display = 'none'; }
    else if (val === 'nee') { fotoWrap.style.display = 'none'; neeHint.style.display = ''; }
    else { fotoWrap.style.display = 'none'; neeHint.style.display = 'none'; }
  };
  overlay.querySelectorAll('input[name="foto_keuze"]').forEach(r => r.addEventListener('change', syncFotoUI));
  syncFotoUI();

  // Live preview van geselecteerd bestand
  const fInp = overlay.querySelector('input[name="foto"]');
  if (fInp) fInp.addEventListener('change', () => {
    const f = fInp.files && fInp.files[0];
    if (!f) { preview.style.display = 'none'; return; }
    if (!f.type.startsWith('image/')) { Modal.show({ type: 'warning', title: 'Verkeerd bestand', message: 'Alleen afbeeldingen (JPG/PNG).' }); fInp.value = ''; return; }
    if (f.size > 5 * 1024 * 1024) { Modal.show({ type: 'warning', title: 'Foto te groot', message: 'Max. 5 MB.' }); fInp.value = ''; return; }
    const url = URL.createObjectURL(f);
    previewImg.src = url;
    preview.style.display = '';
  });

  return new Promise(resolve => {
    overlay.querySelector('#frm-nieuwe-kist').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const naam = (f.naam.value || '').trim();
      if (!naam) return;
      const materiaal = (f.materiaal.value || '').trim();
      const kleur = (f.kleur.value || '').trim();
      const bedragRaw = (f.bedrag.value || '').trim().replace(/\./g, '').replace(',', '.');
      const bedrag = parseFloat(bedragRaw) || 0;
      const alleEigen = (Settings.get('kisten_eigen') || []).slice();
      const dubbelInEigen = alleEigen.findIndex(x => x && x.naam === naam);
      const dubbelInBasis = KISTEN_CATALOGUS.some(k => k.naam === naam);
      if (!bestaand && (dubbelInBasis || dubbelInEigen >= 0)) {
        Modal.show({ type: 'warning', title: 'Naam bestaat al', message: 'Er is al een kist met deze naam. Kies een andere naam of bewerk de bestaande.' });
        return;
      }
      const entry = { naam, materiaal, bedrag, kleur };
      if (bestaand) {
        const oudIdx = alleEigen.findIndex(x => x && x.naam === bestaandeNaam);
        if (oudIdx >= 0) alleEigen[oudIdx] = entry;
        else alleEigen.push(entry);
      } else {
        alleEigen.push(entry);
      }
      Settings.set({ kisten_eigen: alleEigen });

      // Foto-upload afhandelen als 'ja' + bestand geselecteerd
      const fotoKeuze = (f.foto_keuze?.value || '').toLowerCase();
      const file = f.foto?.files?.[0] || null;
      const submitBtn = f.querySelector('button[type=submit]');
      if (fotoKeuze === 'ja' && file) {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Foto uploaden…'; }
        try {
          await KistFotos.upload(naam, file);
          close();
          renderKistenBeheer({ success: bestaand ? `Kist "${naam}" bijgewerkt (met nieuwe foto).` : `Kist "${naam}" toegevoegd met foto.` });
          resolve(true);
          return;
        } catch (err) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = bestaand ? 'Opslaan' : 'Toevoegen'; }
          // Kist zelf is al opgeslagen — foto niet. Geef gebruiker de keus.
          Modal.show({
            type: 'warning',
            title: 'Kist opgeslagen, foto mislukt',
            message: (err && err.message ? err.message + '\n\n' : '') +
                     'De kist zelf is toegevoegd, maar de foto kon niet worden geüpload. Je kunt hem later opnieuw proberen via het 📷-icoontje op de kaart.',
          });
          close();
          renderKistenBeheer();
          resolve(true);
          return;
        }
      }

      close();
      renderKistenBeheer({ success: bestaand ? `Kist "${naam}" bijgewerkt.` : `Kist "${naam}" toegevoegd — er wordt automatisch een "Geen afbeelding"-pictogram getoond tot je een foto uploadt.` });
      resolve(true);
    });
  });
}

// Kort prijs-modal voor niet-eigen (Unigra) kisten. Alleen de prijs kan
// gewijzigd worden — naam/materiaal zijn onderdeel van de standaard-catalogus
// en overrides worden opgeslagen in Settings.kisten_overrides.
async function _promptPrijs(naam) {
  const kist = KISTEN_CATALOGUS.find(x => x.naam === naam);
  if (!kist) return false;
  const ov = (Settings.get('kisten_overrides') || {})[naam] || {};
  const huidige = ov.bedrag != null ? ov.bedrag : kist.bedrag;
  const html = `
    <div class="pincode-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;">
      <div class="card" style="max-width:400px;width:100%;background:var(--surface);padding:1.5rem;border-radius:.75rem;">
        <h2 style="margin-top:0;">Prijs aanpassen</h2>
        <p class="muted" style="margin:.25rem 0 1rem;">${esc(naam)}</p>
        <form id="frm-prijs">
          <label style="display:block;margin:.5rem 0;">
            <span>Adviesprijs (€)</span>
            <input type="text" name="bedrag" inputmode="decimal" value="${String(huidige).replace('.', ',')}" style="width:100%;padding:.5rem;font-size:1.1rem;" autofocus>
          </label>
          <p class="muted small" style="margin:.5rem 0;">Standaardprijs: € ${String(kist.bedrag).replace('.', ',')}</p>
          <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem;">
            <button type="button" class="btn btn-ghost" id="btn-prijs-annuleer">Annuleren</button>
            <button type="submit" class="btn btn-primary">Opslaan</button>
          </div>
        </form>
      </div>
    </div>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const overlay = wrap.firstElementChild;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.id === 'btn-prijs-annuleer') close();
  });
  return new Promise(resolve => {
    overlay.querySelector('#frm-prijs').addEventListener('submit', e => {
      e.preventDefault();
      const raw = (e.target.bedrag.value || '').trim().replace(/\./g, '').replace(',', '.');
      const bedrag = parseFloat(raw);
      if (!isFinite(bedrag) || bedrag < 0) {
        Modal.show({ type: 'warning', title: 'Ongeldige prijs', message: 'Vul een geldig bedrag in (bv. 1234,56).' });
        return;
      }
      _patchKistOverride(naam, { bedrag });
      close();
      renderKistenBeheer({ success: `Prijs van "${naam}" opgeslagen: ${fmtEUR(bedrag)}.` });
      resolve(true);
    });
  });
}

function renderKistenBeheer(msg) {
  const adminMode = !!Settings.get('catalog_admin_mode');
  const drafts = _activeDossierDrafts();
  // Gebruiker kan de banner voor deze sessie verbergen ('Rustig kijken'-modus).
  // Vlag zit in sessionStorage → weg na app-herstart, of via "Toon banner"-link.
  const bannerVerborgen = (() => {
    try { return sessionStorage.getItem('sok_hide_kistdraft_banner') === '1'; }
    catch (_) { return false; }
  })();
  const hasDraft = drafts.length > 0 && !bannerVerborgen;
  const favs = _kistFavs();
  const meestGekozen = _meestGekozenKist();

  const bron = effectieveKistenCatalogus({ includeHidden: adminMode });

  // Filters toepassen
  const q = (_kistFilter || '').trim().toLowerCase();
  const prijsRange = KIST_PRIJS_RANGES.find(r => r.key === _kistPrijs);
  const gefilterd = bron.filter(k => {
    if (q && !((k.naam || '').toLowerCase().includes(q) || (k.materiaal || '').toLowerCase().includes(q))) return false;
    if (_kistMateriaal && _kistMateriaalGroep(k.materiaal) !== _kistMateriaal) return false;
    if (_kistKleur && _kistKleurGroep(k.materiaal) !== _kistKleur) return false;
    if (prijsRange && !prijsRange.test(Number(k.bedrag))) return false;
    return true;
  }).sort((a, b) => a.bedrag - b.bedrag);

  // Beschikbare materiaal-/kleurgroepen voor de dropdowns
  const materiaalGroepen = [...new Set(bron.map(k => _kistMateriaalGroep(k.materiaal)))].sort();
  // Als een filter is actief maar de bijbehorende optie bestaat niet meer
  // (bv. omdat de laatste kist met dat materiaal is verwijderd), reset het
  // filter — anders krijgt de gebruiker een lege lijst zonder duidelijk
  // waarom.
  if (_kistMateriaal && !materiaalGroepen.includes(_kistMateriaal)) _kistMateriaal = '';
  const kleurGroepen = [...new Set(bron.map(k => _kistKleurGroep(k.materiaal)))].sort();
  if (_kistKleur && !kleurGroepen.includes(_kistKleur)) _kistKleur = '';

  // Paginering
  const totPaginas = Math.max(1, Math.ceil(gefilterd.length / KISTEN_PER_PAGINA));
  if (_kistPagina > totPaginas) _kistPagina = totPaginas;
  if (_kistPagina < 1) _kistPagina = 1;
  const start = (_kistPagina - 1) * KISTEN_PER_PAGINA;
  const pagina = gefilterd.slice(start, start + KISTEN_PER_PAGINA);

  const isBeheerder = (typeof Auth !== 'undefined') && Auth.isBeheerder();
  const magPrijzen = (typeof Auth === 'undefined') || Auth.magPrijzenZien();
  const kaart = (k) => {
    const url = KistFotos.urlVoor(k.naam);
    const hidden = !!k._hidden;
    const isFav = favs.includes(k.naam);
    const isTop = meestGekozen && k.naam === meestGekozen;
    const vr = isBeheerder && (typeof KistVoorraad !== 'undefined')
      ? KistVoorraad.byNaam(k.naam) : null;
    const vAantal = vr ? (vr.aantal || 0) : null;
    const vMin    = vr ? (vr.min_aantal || 0) : 0;
    const vLaag   = vr && vAantal < vMin;
    const vLeeg   = vr && vAantal === 0;
    // Chip toont alleen de huidige voorraad (compact). Kleur signaleert
    // 'leeg' of 'onder minimum'; de exacte grens zie je in beheermodus.
    const vChip   = isBeheerder ? (
      vr
        ? `<span class="kist-voorraad-chip ${vLeeg ? 'is-leeg' : (vLaag ? 'is-laag' : '')}" title="Voorraad${vMin ? ' · minimum ' + vMin : ''}">📦 ${vAantal}${vLaag ? ' ⚠' : ''}</span>`
        : `<span class="kist-voorraad-chip is-onbekend" title="Nog geen voorraad ingesteld">📦 —</span>`
    ) : '';
    // Leesbare status voor beheerder (alleen tonen als er een voorraadregel is)
    const vStatus = (isBeheerder && vr) ? (
      vLeeg ? `<span class="kist-voorraad-status is-leeg">⚠ Niet op voorraad</span>`
      : vLaag ? `<span class="kist-voorraad-status is-laag">⚠ Bijna op — nog ${vAantal} (min ${vMin})</span>`
      : `<span class="kist-voorraad-status is-ok">✓ Op voorraad — ${vAantal} stuks</span>`
    ) : '';
    return `
      <div class="kist-card ${hidden ? 'is-hidden-catalog' : ''}" data-naam="${esc(k.naam)}">
        <div class="kist-card-imgwrap">
          <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-naam="${esc(k.naam)}" aria-label="Bekijk ${esc(k.naam)}">
            ${url
              ? `<img src="${esc(url)}" alt="${esc(k.naam)}" loading="lazy">`
              : `<div class="kist-card-placeholder" role="img" aria-label="Geen afbeelding voor ${esc(k.naam)}">
                   <svg viewBox="0 0 100 100" width="72" height="72" aria-hidden="true">
                     <rect x="12" y="18" width="76" height="64" rx="8" ry="8" fill="none" stroke="currentColor" stroke-width="4"/>
                     <circle cx="35" cy="42" r="6" fill="currentColor"/>
                     <path d="M 22 74 L 44 52 L 58 66 L 74 50 L 82 58 L 82 74 Z" fill="currentColor"/>
                     <line x1="20" y1="14" x2="82" y2="86" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                   </svg>
                   <div class="kist-placeholder-title">Geen afbeelding</div>
                   <div class="kist-placeholder-sub">Er is geen afbeelding toegevoegd.</div>
                 </div>`}
          </button>
          ${isTop ? '<span class="kist-badge-top">★ Meest gekozen</span>' : ''}
          ${hidden ? '<span class="kist-hidden-badge">verwijderd</span>' : ''}
        </div>
        <div class="kist-card-body">
          <strong class="kist-card-naam">${esc(k.naam)}</strong>
          <span class="muted small">${esc(k.materiaal)}</span>
          ${vStatus}
          <div class="kist-card-foot ${magPrijzen ? '' : 'kist-card-foot-nopr'}">
            ${(magPrijzen || vChip) ? `<div class="kist-card-foot-meta">
              ${magPrijzen ? `<span class="kist-price">${fmtEUR(k.bedrag)}</span>` : ''}
              ${vChip}
            </div>` : ''}
            ${hidden ? '' : `<button type="button" class="btn btn-sm btn-primary kist-kies-btn ${magPrijzen ? '' : 'kist-kies-btn-full'}" data-pick-kist="${esc(k.naam)}">Kies deze kist</button>`}
          </div>
          ${adminMode ? `
            <div class="kist-admin-bar" style="display:flex;gap:.4rem;align-items:center;justify-content:space-between;margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border,#e5e0d5);">
              <div style="display:flex;gap:.35rem;">
                <label class="btn btn-sm btn-ghost kist-admin-icon" title="${url ? 'Vervang foto' : 'Foto uploaden'}" aria-label="Foto">
                  📷
                  <input type="file" accept="image/*" data-upload="${esc(k.naam)}" hidden>
                </label>
                <button type="button" class="btn btn-sm btn-ghost kist-admin-icon" data-admin-edit="${esc(k.naam)}" title="${k._eigen ? 'Bewerk naam / materiaal / prijs' : 'Bewerk prijs'}" aria-label="Bewerken">✏️</button>
                ${k._eigen
                  ? `<button type="button" class="btn btn-sm btn-ghost kist-admin-icon btn-danger-ghost" data-eigen-del="${esc(k.naam)}" title="Verwijder kist" aria-label="Verwijderen">🗑</button>`
                  : (hidden
                      ? `<button type="button" class="btn btn-sm btn-ghost kist-admin-icon" data-show-kist="${esc(k.naam)}" title="Kist terugzetten" aria-label="Herstel">↺</button>`
                      : `<button type="button" class="btn btn-sm btn-ghost kist-admin-icon btn-danger-ghost" data-hide-kist="${esc(k.naam)}" title="Verberg kist uit lijst" aria-label="Verwijderen">🗑</button>`)}
              </div>
              <div style="display:flex;gap:.35rem;align-items:center;">
                ${k._eigen ? '<span class="badge badge-amber" title="Eigen toegevoegde kist">Eigen</span>' : ''}
                ${k._customBedrag ? `<button type="button" class="btn btn-sm btn-ghost kist-admin-icon" data-reset-price="${esc(k.naam)}" title="Terug naar standaardprijs" aria-label="Reset prijs">↺ €</button>` : ''}
                ${url ? `<button type="button" class="btn btn-sm btn-ghost kist-admin-icon" data-remove-foto="${esc(k.naam)}" title="Foto weghalen" aria-label="Foto verwijderen">🖼✕</button>` : ''}
              </div>
            </div>` : ''}
        </div>
      </div>`;
  };

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Kisten</h1>
          <p class="muted">Kies de kist die het beste past. Klik op een kist voor meer informatie.${adminMode ? ' <strong>Beheermodus aan.</strong>' : ''}</p>
        </div>
        ${adminMode ? '<span class="badge badge-amber">Beheermodus aan</span>' : ''}
      </div>

      ${isBeheerder ? (() => {
        if (typeof KistVoorraad === 'undefined') return '';
        const laag = KistVoorraad.laag();
        const heeftLaag = laag.length > 0;
        return `
        <div class="alert ${heeftLaag ? 'alert-warn' : 'alert-info'} kist-voorraad-banner" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;">
          <div>
            <strong>${heeftLaag ? '⚠ Voorraad laag' : '📦 Voorraadbeheer'}</strong>
            <span class="muted small">${heeftLaag
              ? `${laag.length} kist${laag.length === 1 ? '' : 'en'} onder minimum — tijd om bij te bestellen.`
              : 'Beheer voorraad, minimum en levertijd van alle kisten op één plek.'}</span>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            <a href="#/kisten/voorraad" class="btn btn-sm">📦 Voorraadbeheer</a>
            ${heeftLaag ? '<a href="#/kisten/bestellijst" class="btn btn-sm btn-primary">Open bijvul-lijst</a>' : ''}
          </div>
        </div>`;
      })() : ''}

      <div class="catalog-zoekbalk">
        <div class="catalog-search">
          <input type="search" id="kist-filter-q" value="${esc(_kistFilter)}" placeholder="Zoek op naam, materiaal of kenmerk…" autocomplete="off">
        </div>
        <button type="button" class="btn catalog-filters-toggle" id="kist-filters-toggle">⛛ Filters</button>
        ${adminMode ? '<button type="button" class="btn btn-primary" id="btn-kist-nieuw" style="white-space:nowrap;">+ Kist toevoegen</button>' : ''}
      </div>

      <div class="catalog-chips">
        <select class="catalog-chip" id="kist-f-materiaal">
          <option value="">Materiaal</option>
          ${materiaalGroepen.map(g => `<option value="${esc(g)}" ${_kistMateriaal === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        </select>
        <select class="catalog-chip" id="kist-f-kleur">
          <option value="">Kleur</option>
          ${kleurGroepen.map(g => `<option value="${esc(g)}" ${_kistKleur === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        </select>
        ${magPrijzen ? `<select class="catalog-chip" id="kist-f-prijs">
          <option value="">Prijs</option>
          ${KIST_PRIJS_RANGES.map(r => `<option value="${esc(r.key)}" ${_kistPrijs === r.key ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
        </select>` : ''}
        ${_kistFiltersActief() ? '<button type="button" class="catalog-wis" id="kist-filter-clear">↺ Wis filters</button>' : ''}
        <span class="catalog-count">${gefilterd.length} resultaten</span>
        <div class="catalog-view">
          <button type="button" class="catalog-view-btn ${_kistWeergave === 'grid' ? 'is-on' : ''}" data-view="grid" aria-label="Rasterweergave">▦</button>
          <button type="button" class="catalog-view-btn ${_kistWeergave === 'lijst' ? 'is-on' : ''}" data-view="lijst" aria-label="Lijstweergave">☰</button>
        </div>
      </div>

      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${hasDraft ? `
        <div class="alert alert-info kist-draft-banner">
          <strong>💡 Actief dossier:</strong>
          ${drafts.length === 1
            ? `<span>${esc(drafts[0].naam)}${drafts[0].kist ? ' — huidige kist: <em>' + esc(drafts[0].kist) + '</em>' : ''}</span>`
            : `<select id="kist-draft-picker">${drafts.map((d, i) => `<option value="${i}">${esc(d.naam)}${d.kist ? ' — ' + esc(d.kist) : ''}</option>`).join('')}</select>`}
          <span class="muted small">— klik op "Kies deze kist" om hem in het dossier te zetten</span>
          <button type="button" class="kist-draft-banner-close" id="kist-draft-verberg" title="Verberg banner — concept blijft bewaard, komt terug bij herstart of via link onderaan">
            👀 Alleen rondkijken
          </button>
        </div>` : ''}
      ${(drafts.length > 0 && bannerVerborgen) ? `
        <p class="muted small center" style="margin:.75rem 0 1.25rem;">
          Banner verborgen — <a href="#" id="kist-draft-tonen">toon actief dossier weer</a>
        </p>` : ''}

      ${gefilterd.length === 0
        ? '<div class="card"><p class="muted center">Geen kisten gevonden met deze filters.</p></div>'
        : `<div class="kist-grid ${_kistWeergave === 'lijst' ? 'is-list' : ''}">
            ${pagina.map(kaart).join('')}
          </div>`}

      ${totPaginas > 1 ? `
        <div class="catalog-paginering">
          <button type="button" class="cat-page-nav" data-page="${_kistPagina - 1}" ${_kistPagina === 1 ? 'disabled' : ''}>‹</button>
          ${Array.from({ length: totPaginas }, (_, i) => i + 1).map(p =>
            `<button type="button" class="cat-page ${p === _kistPagina ? 'is-on' : ''}" data-page="${p}">${p}</button>`).join('')}
          <button type="button" class="cat-page-nav" data-page="${_kistPagina + 1}" ${_kistPagina === totPaginas ? 'disabled' : ''}>›</button>
        </div>` : ''}

      ${adminMode ? '' : `
        <p class="muted small center" style="margin-top:1.5rem;">
          Foto's, prijzen of catalogus beheren? Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a>.
        </p>`}
    </div>`;

  // ─── Zoekveld: live met debounce + focusbehoud ─────────────────────────
  let _kistFilterT = null;
  const filterQ = $('#kist-filter-q');
  if (filterQ) {
    filterQ.addEventListener('input', () => {
      _kistFilter = filterQ.value;
      _kistPagina = 1;
      clearTimeout(_kistFilterT);
      _kistFilterT = setTimeout(() => {
        const focusInput = document.activeElement === filterQ;
        const pos = focusInput ? filterQ.selectionStart : null;
        renderKistenBeheer();
        if (focusInput) {
          const newInp = $('#kist-filter-q');
          if (newInp) { newInp.focus(); if (pos != null) newInp.setSelectionRange(pos, pos); }
        }
      }, 150);
    });
  }

  // ─── Dropdown-filters + upload (change-events) ─────────────────────────
  $('#view').onchange = async e => {
    const mat = e.target.closest('#kist-f-materiaal');
    if (mat) { _kistMateriaal = mat.value; _kistPagina = 1; renderKistenBeheer(); return; }
    const kleur = e.target.closest('#kist-f-kleur');
    if (kleur) { _kistKleur = kleur.value; _kistPagina = 1; renderKistenBeheer(); return; }
    const prijs = e.target.closest('#kist-f-prijs');
    if (prijs) { _kistPrijs = prijs.value; _kistPagina = 1; renderKistenBeheer(); return; }

    const inp = e.target.closest('input[data-upload]');
    if (!inp) return;
    const naam = inp.getAttribute('data-upload');
    const file = inp.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { renderKistenBeheer({ error: 'Alleen afbeeldingsbestanden toegestaan.' }); return; }
    if (file.size > 5 * 1024 * 1024) { renderKistenBeheer({ error: 'Foto te groot (max. 5 MB).' }); return; }
    const card = $(`.kist-card[data-naam="${CSS.escape(naam)}"]`);
    if (card) card.classList.add('is-uploading');
    try {
      await KistFotos.upload(naam, file);
      renderKistenBeheer({ success: `Foto opgeslagen voor "${naam}".` });
    } catch (e) {
      if (card) card.classList.remove('is-uploading');
      renderKistenBeheer({ error: `Foto uploaden mislukt${e && e.message ? ': ' + e.message : ''}. Controleer verbinding en probeer opnieuw.` });
    }
  };

  // Helper: muteer Settings.kisten_overrides[naam]
  function _patchKistOverride(naam, patch) {
    const cur = Object.assign({}, Settings.get('kisten_overrides') || {});
    const entry = Object.assign({}, cur[naam] || {}, patch);
    if (entry.bedrag == null) delete entry.bedrag;
    if (!entry.hidden)        delete entry.hidden;
    if (Object.keys(entry).length === 0) delete cur[naam];
    else                                  cur[naam] = entry;
    Settings.set({ kisten_overrides: cur });
  }

  $('#view').onclick = async e => {
    // ── Actief-dossier-banner: verbergen / terugtonen ──
    const verbergBtn = e.target.closest('#kist-draft-verberg');
    if (verbergBtn) {
      try { sessionStorage.setItem('sok_hide_kistdraft_banner', '1'); } catch (_) {}
      renderKistenBeheer(); return;
    }
    const toonLink = e.target.closest('#kist-draft-tonen');
    if (toonLink) {
      e.preventDefault();
      try { sessionStorage.removeItem('sok_hide_kistdraft_banner'); } catch (_) {}
      renderKistenBeheer(); return;
    }

    // ── Filters: eco-toggle, wis, weergave, paginering, favoriet ──
    const wisBtn = e.target.closest('#kist-filter-clear');
    if (wisBtn) {
      _kistFilter = ''; _kistMateriaal = ''; _kistKleur = ''; _kistPrijs = ''; _kistPagina = 1;
      renderKistenBeheer(); return;
    }
    const filtersToggle = e.target.closest('#kist-filters-toggle');
    if (filtersToggle) {
      const chips = $('.catalog-chips');
      if (chips) chips.classList.toggle('is-collapsed');
      return;
    }
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) { _kistWeergave = viewBtn.getAttribute('data-view'); renderKistenBeheer(); return; }
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
      _kistPagina = parseInt(pageBtn.getAttribute('data-page'), 10) || 1;
      renderKistenBeheer();
      const top = $('#view .catalog-zoekbalk');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // ── Beheermodus: nieuwe eigen kist toevoegen ──
    const nieuwBtn = e.target.closest('#btn-kist-nieuw');
    if (nieuwBtn) {
      await _promptNieuweKist();
      return;
    }
    // ── Beheermodus: universele bewerk-knop op elke kaart ──
    // Eigen kist → volledig modal (naam/materiaal/prijs/kleur)
    // Unigra kist → kort prijs-modal
    const adminEdit = e.target.closest('button[data-admin-edit]');
    if (adminEdit) {
      const naam = adminEdit.getAttribute('data-admin-edit');
      const isEigen = (Settings.get('kisten_eigen') || []).some(x => x && x.naam === naam);
      if (isEigen) await _promptNieuweKist(naam);
      else await _promptPrijs(naam);
      return;
    }
    // ── Beheermodus: eigen kist bewerken / verwijderen (oude route, blijft werken) ──
    const editEigen = e.target.closest('button[data-eigen-edit]');
    if (editEigen) {
      await _promptNieuweKist(editEigen.getAttribute('data-eigen-edit'));
      return;
    }
    const delEigen = e.target.closest('button[data-eigen-del]');
    if (delEigen) {
      const naam = delEigen.getAttribute('data-eigen-del');
      const ok = await Modal.confirm({
        type: 'warning',
        title: 'Eigen kist verwijderen?',
        message: `"${naam}" wordt uit je eigen catalogus verwijderd. Bestaande dossiers die deze kist gebruiken blijven werken, maar de kist is niet meer kiesbaar.`,
        confirmText: 'Verwijderen',
        cancelText: 'Annuleren',
      });
      if (!ok) return;
      const lijst = (Settings.get('kisten_eigen') || []).filter(x => x && x.naam !== naam);
      Settings.set({ kisten_eigen: lijst });
      renderKistenBeheer({ success: `Eigen kist "${naam}" verwijderd.` });
      return;
    }
    // ── Beheermodus: prijs / verwijder / herstel / reset ──
    const savePriceBtn = e.target.closest('button[data-save-price]');
    if (savePriceBtn) {
      const naam = savePriceBtn.getAttribute('data-save-price');
      const inp = $(`input[data-edit-price="${CSS.escape(naam)}"]`);
      if (!inp) return;
      const raw = (inp.value || '').trim();
      let bedrag = parseEUR(raw);
      if (!isFinite(bedrag) || bedrag < 0) {
        Modal.show({ type: 'warning', title: 'Ongeldige prijs', message: 'Vul een geldig bedrag in (bv. 1234,56).' });
        return;
      }
      if (!/[.,]/.test(raw) && bedrag > 9999) {
        const guess = bedrag / 100;
        const ok = await Modal.confirm({
          type: 'warning',
          title: 'Bedoel je €' + guess.toFixed(2).replace('.', ',') + '?',
          message: `Je vulde "${raw}" in zonder komma. Dat lijkt erg veel voor een kist. Klik "Ja" om door te gaan met €${guess.toFixed(2).replace('.', ',')}, of "Nee, ${bedrag.toFixed(2).replace('.', ',')}" om de letterlijke waarde te gebruiken.`,
          confirmText: 'Ja, €' + guess.toFixed(2).replace('.', ','),
          cancelText: 'Nee, ' + bedrag.toFixed(2).replace('.', ','),
        });
        if (ok) bedrag = +guess.toFixed(2);
      }
      _patchKistOverride(naam, { bedrag });
      renderKistenBeheer({ success: `Prijs van "${naam}" opgeslagen: ${fmtEUR(bedrag)}.` });
      return;
    }
    const resetPriceBtn = e.target.closest('button[data-reset-price]');
    if (resetPriceBtn) {
      const naam = resetPriceBtn.getAttribute('data-reset-price');
      _patchKistOverride(naam, { bedrag: null });
      renderKistenBeheer({ success: `Standaardprijs voor "${naam}" hersteld.` });
      return;
    }
    const hideBtn = e.target.closest('button[data-hide-kist]');
    if (hideBtn) {
      const naam = hideBtn.getAttribute('data-hide-kist');
      const ok = await Modal.confirm({
        type: 'warning',
        title: 'Kist verwijderen?',
        message: `"${naam}" wordt definitief uit de catalogus verwijderd. Bestaande dossiers die deze kist gekozen hebben blijven werken. Je kunt verwijderde kisten later eventueel herstellen via de "↺ Herstel"-knop in beheermodus.`,
        confirmText: 'Verwijderen',
        cancelText: 'Annuleren',
      });
      if (!ok) return;
      _patchKistOverride(naam, { hidden: true });
      renderKistenBeheer({ success: `"${naam}" verwijderd uit de catalogus.` });
      return;
    }
    const showBtn = e.target.closest('button[data-show-kist]');
    if (showBtn) {
      const naam = showBtn.getAttribute('data-show-kist');
      _patchKistOverride(naam, { hidden: false });
      renderKistenBeheer({ success: `"${naam}" hersteld in de catalogus.` });
      return;
    }

    // ── Kies kist voor actief dossier ──
    const pickBtn = e.target.closest('button[data-pick-kist]');
    if (pickBtn) {
      const kistNaam = pickBtn.getAttribute('data-pick-kist');
      // Check op werkelijke drafts (NIET hasDraft — die is false zodra de
      // banner is verborgen, waardoor de user "Open eerst een dossier" te
      // zien kreeg terwijl er wél een actief dossier is).
      if (!drafts.length) {
        Modal.show({
          type: 'info',
          title: 'Open eerst een dossier',
          message: `Om "${kistNaam}" te koppelen, open of maak eerst een dossier. Bij de kostenstap kun je dan via deze pagina de kist kiezen.`,
        });
        return;
      }
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

    // ── Klik op afbeelding → lightbox ──
    const zoom = e.target.closest('button[data-action="zoom"]');
    if (zoom) {
      const naam = zoom.getAttribute('data-naam');
      const k = vindKist(naam); if (!k) return;
      const magPrijs = (typeof Auth === 'undefined') || Auth.magPrijzenZien();
      Lightbox.show({
        src: KistFotos.urlVoor(k.naam) || null,
        svgFallback: kistSVG(k.materiaal),
        title: k.naam,
        subtitle: k.materiaal,
        price: magPrijs ? fmtEUR(k.bedrag) : null,
      });
      return;
    }

    // ── Foto verwijderen ──
    const btn = e.target.closest('button[data-remove-foto]');
    if (!btn) return;
    const naam = btn.getAttribute('data-remove-foto');
    const ok = await Modal.confirm({ title: 'Foto verwijderen?', message: `De foto van "${naam}" wordt definitief verwijderd.`, confirmText: 'Verwijderen' });
    if (!ok) return;
    try {
      await KistFotos.remove(naam);
      renderKistenBeheer({ success: 'Foto verwijderd.' });
    } catch (e) {
      renderKistenBeheer({ error: `Foto verwijderen mislukt${e && e.message ? ': ' + e.message : ''}.` });
    }
  };
}

// ─── Bestellijst (beheerder) ────────────────────────────────────────────────
// Overzicht van alle kisten waar voorraad < minimum. Toont per kist wat er
// besteld moet worden om weer op peil te komen (bestel_aantal of anders 2×min).
// Geeft een tekst-blok dat je kunt kopiëren of mailen naar Unigra.
function renderKistenBestellijst(msg) {
  const isBeheerder = (typeof Auth !== 'undefined') && Auth.isBeheerder();
  if (!isBeheerder) {
    $('#view').innerHTML = `
      <div class="page">
        <div class="page-head"><div><a href="#/kisten" class="back-link">← Terug naar kisten</a><h1>Geen toegang</h1></div></div>
        <div class="card"><p class="muted">De bestellijst is alleen zichtbaar voor beheerders.</p></div>
      </div>`;
    return;
  }
  const alle = KistVoorraad.all().slice()
    .sort((a, b) => ((a.aantal||0) - (a.min_aantal||0)) - ((b.aantal||0) - (b.min_aantal||0)));
  const laag = alle.filter(r => (r.aantal || 0) < (r.min_aantal || 0));
  // Per rij: te bestellen aantal is (in volgorde):
  //   1) expliciet ingesteld bestel_aantal,
  //   2) gewenst_peil − huidige voorraad (aanbevolen),
  //   3) fallback: 2×min − voorraad.
  // Altijd minimaal 1 stuk.
  const berekend = laag.map(r => {
    let target;
    if (r.bestel_aantal && r.bestel_aantal > 0) target = r.bestel_aantal;
    else if (r.gewenst_peil && r.gewenst_peil > 0) target = r.gewenst_peil - (r.aantal || 0);
    else target = (r.min_aantal || 1) * 2 - (r.aantal || 0);
    return { ...r, teBestellen: Math.max(1, target) };
  });
  const totaal = berekend.reduce((s, r) => s + r.teBestellen, 0);
  const nu = new Date().toLocaleDateString('nl-NL');
  const tekst = berekend.length
    ? [
        `Bestelaanvraag voor Unigra — ${nu}`,
        `Van: OZN — Overledenenzorg Nederland`,
        ``,
        ...berekend.map(r => `- ${r.teBestellen}× ${r.naam}   (huidige voorraad: ${r.aantal||0}, min: ${r.min_aantal||0})`),
        ``,
        `Totaal: ${totaal} kist${totaal === 1 ? '' : 'en'}`,
      ].join('\n')
    : '';

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><a href="#/kisten" class="back-link">← Terug naar kisten</a><h1>Bijvullen</h1>
          <p class="muted">Kisten waarvan de voorraad onder het minimum staat.</p></div>
      </div>

      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}

      ${berekend.length === 0 ? `
        <div class="card"><p class="muted">🎉 Alle voorraden zijn op peil — niets bij te vullen.</p></div>
      ` : `
      <section class="card">
        <ul class="bijvullen-lijst" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.6rem;">
          ${berekend.map(r => `
          <li class="${(r.aantal||0) === 0 ? 'row-leeg' : ''}" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding:.85rem 1rem; border:1px solid var(--border,#e5e0d6); border-radius:12px; background:${(r.aantal||0) === 0 ? '#fff5f0' : 'var(--card-bg,#fff)'};">
            <div style="min-width:200px; flex:1;">
              <div style="font-weight:600; font-size:1.02rem;">${esc(r.naam)}</div>
              <div class="muted small" style="margin-top:.15rem;">
                Voorraad <strong style="color:${(r.aantal||0) === 0 ? '#c0392b' : 'var(--text)'};">${r.aantal || 0}</strong> · min <strong>${r.min_aantal || 0}</strong>${r.laatst_besteld ? ' · laatst bijgevuld ' + esc(fmtDate(r.laatst_besteld)) : ''}
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:.5rem;">
              <label class="muted small" style="margin:0;">Aantal</label>
              <input type="number" inputmode="numeric" min="1" step="1" value="" data-bestel-aantal="${esc(r.naam)}" class="no-spin" style="width:70px; text-align:right; padding:.4rem .5rem;">
              <button type="button" class="btn btn-sm btn-primary" data-mark-besteld="${esc(r.naam)}" title="Voorraad ophogen met dit aantal + datum vandaag als laatst bijgevuld">+ Bijvullen</button>
            </div>
          </li>`).join('')}
        </ul>
        <div class="form-actions" style="justify-content:flex-end; margin-top:.75rem;">
          <span class="muted small">${berekend.length} kist${berekend.length===1?'':'en'} · totaal ${totaal} stuks bij te vullen</span>
        </div>
      </section>
      `}
    </div>`;

  // Markeer één regel als besteld (laatst_besteld + besteld_aantal invullen)
  $('#view').onclick = async e => {
    const backLink = e.target.closest('.back-link');
    if (backLink) { e.preventDefault(); Router.go('/kisten'); return; }
    const mBtn = e.target.closest('button[data-mark-besteld]');
    if (mBtn) {
      // Guard tegen dubbelklik-race: als de knop al bezig is stoppen we hier.
      // Zonder deze guard dispatchen twee klikken twee upserts en verdubbelt
      // de voorraad-optelling.
      if (mBtn.dataset.busy === '1') return;
      const naam = mBtn.getAttribute('data-mark-besteld');
      const aInp = $(`input[data-bestel-aantal="${CSS.escape(naam)}"]`);
      const aantal = aInp ? parseInt(aInp.value, 10) : null;
      if (!aantal || aantal < 1) return;
      mBtn.dataset.busy = '1';
      mBtn.disabled = true;
      try {
        await KistVoorraad.bijvul(naam, aantal);
        renderKistenBestellijst({ success: `${naam}: ${aantal} bijgevuld — voorraad bijgewerkt.` });
      } catch (err) {
        mBtn.dataset.busy = '';
        mBtn.disabled = false;
        renderKistenBestellijst({ error: 'Opslaan mislukt: ' + (err.message || err) });
      }
    }
  };
}

// ─── Voorraadbeheer (aparte pagina, één tabel, auto-save per veld) ─────────
function renderKistenVoorraad(msg) {
  const isBeheerder = (typeof Auth !== 'undefined') && Auth.isBeheerder();
  if (!isBeheerder) {
    $('#view').innerHTML = `
      <div class="page">
        <div class="page-head"><div><a href="#/kisten" class="back-link">← Terug naar kisten</a><h1>Geen toegang</h1></div></div>
        <div class="card"><p class="muted">Voorraadbeheer is alleen zichtbaar voor beheerders.</p></div>
      </div>`;
    return;
  }

  // Filter-state per bezoek (niet persistent — bewust)
  if (typeof renderKistenVoorraad._filter === 'undefined') renderKistenVoorraad._filter = 'alle';
  if (typeof renderKistenVoorraad._q === 'undefined') renderKistenVoorraad._q = '';
  const filter = renderKistenVoorraad._filter;
  const q = (renderKistenVoorraad._q || '').trim().toLowerCase();

  const catalogus = (typeof KISTEN_CATALOGUS !== 'undefined') ? KISTEN_CATALOGUS : [];
  // Verrijk elke kist met zijn voorraadregel (kan null zijn)
  const rijen = catalogus.map(k => ({ k, vr: KistVoorraad.byNaam(k.naam) }));
  const gefilterd = rijen.filter(({ k, vr }) => {
    if (q && !k.naam.toLowerCase().includes(q) && !(k.materiaal || '').toLowerCase().includes(q)) return false;
    const a = vr ? (vr.aantal || 0) : null;
    const m = vr ? (vr.min_aantal || 0) : 0;
    if (filter === 'leeg')  return vr && a === 0;
    if (filter === 'laag')  return vr && a < m;
    if (filter === 'ok')    return vr && a >= m && a > 0;
    if (filter === 'geen')  return !vr;
    return true;
  });

  const aantalLaag = rijen.filter(r => r.vr && (r.vr.aantal||0) < (r.vr.min_aantal||0)).length;
  const aantalLeeg = rijen.filter(r => r.vr && (r.vr.aantal||0) === 0).length;
  const aantalGeen = rijen.filter(r => !r.vr).length;

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <a href="#/kisten" class="back-link">← Terug naar kisten</a>
          <h1>Voorraadbeheer</h1>
          <p class="muted">Wijzigingen worden <strong>automatisch opgeslagen</strong> zodra je uit een veld klikt. Geen opslaan-knop nodig.</p>
        </div>
        <a href="#/kisten/bestellijst" class="btn">📦 Bijvullen</a>
      </div>

      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}

      <div class="card">
        <div class="voorraad-filterbar">
          <input type="search" id="vr-q" value="${esc(renderKistenVoorraad._q || '')}" placeholder="Zoek op naam of materiaal…">
          <div class="voorraad-chips">
            ${[
              ['alle',  `Alle (${rijen.length})`],
              ['laag',  `⚠ Laag (${aantalLaag})`],
              ['leeg',  `⚠ Leeg (${aantalLeeg})`],
              ['ok',    'Op peil'],
              ['geen',  `Nog niet ingesteld (${aantalGeen})`],
            ].map(([k, l]) => `<button type="button" class="voorraad-chip ${filter === k ? 'is-on' : ''}" data-vr-filter="${k}">${l}</button>`).join('')}
          </div>
        </div>

        <div class="voorraad-table-wrap">
          <table class="table voorraad-table">
            <thead>
              <tr>
                <th>Kist</th>
                <th class="num" title="Wat je nu op de plank hebt">Voorraad</th>
                <th class="num" title="Onder deze grens komt de kist op de bestellijst">Min.</th>
                <th class="num" title="Op dit peil wil je na bestellen zitten (leeg = automatisch 2×min)">Gewenst</th>
                <th class="num" title="Doorlooptijd bij Unigra (dagen)">Levertijd</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="vr-body">
              ${gefilterd.map(({ k, vr }) => {
                const a  = vr ? (vr.aantal || 0) : null;
                const m  = vr ? (vr.min_aantal || 0) : 0;
                const g  = vr ? (vr.gewenst_peil || '') : '';
                const l  = vr ? (vr.levertijd_dagen || '') : '';
                const leeg = vr && a === 0;
                const laag = vr && a < m;
                const statusHtml = vr
                  ? (leeg ? '<span class="kist-voorraad-status is-leeg">⚠ Leeg</span>'
                    : laag ? '<span class="kist-voorraad-status is-laag">⚠ Laag</span>'
                    : '<span class="kist-voorraad-status is-ok">✓ Op peil</span>')
                  : '<span class="muted small">niet ingesteld</span>';
                return `<tr data-naam="${esc(k.naam)}">
                  <td><strong>${esc(k.naam)}</strong><br><span class="muted small">${esc(k.materiaal)}</span></td>
                  <td class="num"><input type="number" min="0" step="1" inputmode="numeric" data-vr-field="aantal"        value="${esc(a != null ? a : '')}" placeholder="—"></td>
                  <td class="num"><input type="number" min="0" step="1" inputmode="numeric" data-vr-field="min_aantal"    value="${esc(m || '')}"           placeholder="—"></td>
                  <td class="num"><input type="number" min="0" step="1" inputmode="numeric" data-vr-field="gewenst_peil"  value="${esc(g)}"                 placeholder="—"></td>
                  <td class="num"><input type="number" min="0" step="1" inputmode="numeric" data-vr-field="levertijd_dagen" value="${esc(l)}"               placeholder="—"></td>
                  <td class="vr-status-cell">${statusHtml}</td>
                </tr>`;
              }).join('')}
              ${gefilterd.length === 0 ? '<tr><td colspan="6" class="muted center">Geen kisten passen bij dit filter.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  // ─── Zoekbalk (debounce) ────────────────────────────────────────────────
  const qInp = $('#vr-q');
  if (qInp) {
    let t = null;
    qInp.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        renderKistenVoorraad._q = qInp.value;
        renderKistenVoorraad();
      }, 250);
    });
  }

  // ─── Filter-chips ───────────────────────────────────────────────────────
  document.querySelectorAll('[data-vr-filter]').forEach(b => {
    b.addEventListener('click', () => {
      renderKistenVoorraad._filter = b.getAttribute('data-vr-filter');
      renderKistenVoorraad();
    });
  });

  // ─── Auto-save per veld (on 'change' = na blur / enter) ────────────────
  // Geen rerender: alleen de status-cel en de kleine "💾"-hint updaten,
  // zodat de gebruiker rustig door kan naar het volgende veld.
  document.querySelectorAll('#vr-body input[data-vr-field]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const tr = inp.closest('tr'); if (!tr) return;
      const naam = tr.getAttribute('data-naam');
      const veld = inp.getAttribute('data-vr-field');
      const raw = inp.value.trim();
      let val = raw === '' ? null : parseInt(raw, 10);
      if (val != null && (!isFinite(val) || val < 0)) {
        inp.classList.add('vr-input-error');
        setTimeout(() => inp.classList.remove('vr-input-error'), 1500);
        return;
      }
      const patch = { [veld]: val };
      // 'aantal' en 'min_aantal' zijn NOT NULL in DB → default naar 0 als leeg
      if (veld === 'aantal'      && val == null) patch.aantal      = 0;
      if (veld === 'min_aantal'  && val == null) patch.min_aantal  = 0;
      try {
        const nieuw = await KistVoorraad.upsert(naam, patch);
        // Alleen de status-tekst van deze ene rij bijwerken (geen ruimte-shift).
        const cel = tr.querySelector('.vr-status-cell');
        const a = nieuw.aantal || 0, m = nieuw.min_aantal || 0;
        const leeg = a === 0, laag = a < m;
        let statusEl = cel.querySelector('.kist-voorraad-status');
        if (!statusEl) {
          statusEl = document.createElement('span');
          cel.innerHTML = ''; cel.appendChild(statusEl);
        }
        statusEl.className = 'kist-voorraad-status ' + (leeg ? 'is-leeg' : (laag ? 'is-laag' : 'is-ok'));
        statusEl.textContent = leeg ? '⚠ Leeg' : (laag ? '⚠ Laag' : '✓ Op peil');
      } catch (err) {
        Modal.show({ type:'error', title:'Opslaan mislukt', message: err.message || String(err) });
      }
    });
  });

  // Terug-link
  const back = document.querySelector('.back-link');
  if (back) back.addEventListener('click', (e) => { e.preventDefault(); Router.go('/kisten'); });
}
