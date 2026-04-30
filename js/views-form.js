// Dossier intake/edit formulier

function dossierDraftKey(isNew, id) {
  return `sok_draft_${isNew ? 'new' : id}`;
}
function snapshotDossierForm(formEl) {
  const data = {};
  DOSSIER_VELDEN.forEach(f => {
    const inp = formEl.elements[f];
    if (inp) data[f] = inp.value;
  });
  return data;
}
function applyDossierDraft(formEl, data) {
  let changed = 0;
  for (const f in data) {
    const inp = formEl.elements[f];
    if (inp && data[f] != null && inp.value !== data[f]) {
      inp.value = data[f];
      changed++;
    }
  }
  return changed;
}

function renderDossierForm(params) {
  const isNew = !params.id;
  const dossier = isNew ? { dossier_nummer: '(wordt automatisch toegekend)', status: 'nieuw' } : DB.byId(KEYS.DOSSIERS, parseInt(params.id, 10));
  if (!isNew && !dossier) return render404();

  const v = (k) => esc(dossier[k] || '');
  const sel = (k, val) => dossier[k] === val ? 'selected' : '';

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <a href="#/dossiers" class="back-link">← Dossiers</a>
          <h1>${isNew ? 'Nieuw dossier — Intake' : 'Dossier bewerken'}</h1>
          <p class="muted">Dossiernummer: <strong>${esc(dossier.dossier_nummer)}</strong></p>
        </div>
        <div class="autosave-status" id="autosave-status" aria-live="polite"></div>
      </div>

      <div id="draft-banner" class="alert alert-info" hidden></div>

      <form id="dossier-form" class="form-grid" autocomplete="off">

        <fieldset class="card">
          <legend>Status</legend>
          <div class="grid-3">
            <label><span>Status</span>
              <select name="status">
                <option value="nieuw" ${sel('status','nieuw')||(!dossier.status?'selected':'')}>Nieuw</option>
                <option value="in_behandeling" ${sel('status','in_behandeling')}>In behandeling</option>
                <option value="voltooid" ${sel('status','voltooid')}>Voltooid</option>
                <option value="geannuleerd" ${sel('status','geannuleerd')}>Geannuleerd</option>
              </select>
            </label>
            <label><span>Gezinsnummer</span><input type="text" name="gezinsnummer" value="${v('gezinsnummer')}" placeholder="(klooster-administratie)"></label>
            <label><span>Grafnummer</span><input type="text" name="grafnummer" value="${v('grafnummer')}"></label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Gegevens overledene</legend>
          <div class="grid-3">
            <label><span>Voornaam</span><input type="text" name="voornaam" value="${v('voornaam')}"></label>
            <label><span>Achternaam</span><input type="text" name="achternaam" value="${v('achternaam')}"></label>
            <label><span>Doopnaam (Syrisch)</span><input type="text" name="doopnaam" value="${v('doopnaam')}"></label>
            <label><span>Geslacht</span>
              <select name="geslacht">
                <option value="">—</option>
                <option value="man" ${sel('geslacht','man')}>Man</option>
                <option value="vrouw" ${sel('geslacht','vrouw')}>Vrouw</option>
              </select>
            </label>
            <label><span>Geboortedatum</span><input type="date" name="geboortedatum" value="${v('geboortedatum')}"></label>
            <label><span>Geboorteplaats</span><input type="text" name="geboorteplaats" value="${v('geboorteplaats')}"></label>
            <label><span>Overlijdensdatum</span><input type="date" name="overlijdensdatum" value="${v('overlijdensdatum')}"></label>
            <label><span>Tijdstip overlijden</span><input type="time" name="overlijdenstijd" value="${v('overlijdenstijd')}"></label>
            <label><span>Plaats van overlijden</span><input type="text" name="overlijdensplaats" value="${v('overlijdensplaats')}" placeholder="ziekenhuis, thuis..."></label>
            <label class="span-2"><span>Adres overledene</span><input type="text" name="adres_overledene" value="${v('adres_overledene')}"></label>
            <label><span>Postcode</span><input type="text" name="postcode_overledene" value="${v('postcode_overledene')}"></label>
            <label><span>Woonplaats</span><input type="text" name="woonplaats_overledene" value="${v('woonplaats_overledene')}"></label>
            <label><span>BSN</span><input type="text" name="bsn" value="${v('bsn')}"></label>
            <label><span>Burgerlijke staat</span>
              <select name="burgerlijke_staat">
                ${['','ongehuwd','gehuwd','geregistreerd partner','gescheiden','weduwe/weduwnaar'].map(x =>
                  `<option value="${esc(x)}" ${sel('burgerlijke_staat', x)}>${esc(x||'—')}</option>`).join('')}
              </select>
            </label>
            <label><span>Nationaliteit</span><input type="text" name="nationaliteit" value="${v('nationaliteit')}"></label>
            <label><span>Beroep</span><input type="text" name="beroep" value="${v('beroep')}"></label>
            <label><span>Lid Syrisch-Orthodoxe Kerk</span>
              <select name="syrisch_orthodox_lid">
                <option value="">—</option>
                <option value="ja" ${sel('syrisch_orthodox_lid','ja')}>Ja</option>
                <option value="nee" ${sel('syrisch_orthodox_lid','nee')}>Nee</option>
                <option value="onbekend" ${sel('syrisch_orthodox_lid','onbekend')}>Onbekend</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Contactpersoon / aangever</legend>
          <div class="grid-3">
            <label><span>Achternaam</span><input type="text" name="contact_naam" value="${v('contact_naam')}"></label>
            <label><span>Voornaam</span><input type="text" name="contact_voornaam" value="${v('contact_voornaam')}"></label>
            <label><span>Relatie tot overledene</span><input type="text" name="contact_relatie" value="${v('contact_relatie')}" placeholder="echtgenoot, zoon, dochter..."></label>
            <label><span>Telefoon</span><input type="tel" name="contact_telefoon" value="${v('contact_telefoon')}"></label>
            <label class="span-2"><span>E-mail</span><input type="email" name="contact_email" value="${v('contact_email')}"></label>
            <label class="span-2"><span>Adres</span><input type="text" name="contact_adres" value="${v('contact_adres')}"></label>
            <label><span>Postcode</span><input type="text" name="contact_postcode" value="${v('contact_postcode')}"></label>
            <label class="span-3"><span>Woonplaats</span><input type="text" name="contact_woonplaats" value="${v('contact_woonplaats')}"></label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Kerkelijk</legend>
          <div class="grid-3">
            <label><span>Parochie</span>
              <input type="text" name="parochie" value="${v('parochie')}" list="parochie-list" placeholder="bijv. St. Ephrem de Syriër Klooster">
              <datalist id="parochie-list">
                ${PAROCHIES.map(p => `<option value="${esc(p)}">`).join('')}
              </datalist>
            </label>
            <label><span>Priester / Aboono</span><input type="text" name="priester" value="${v('priester')}"></label>
            <label><span>Huisbezoek datum</span><input type="date" name="huisbezoek_datum" value="${v('huisbezoek_datum')}"></label>
            <label><span>Huisbezoek tijd</span><input type="time" name="huisbezoek_tijd" value="${v('huisbezoek_tijd')}"></label>
            <label><span>Avondwake datum</span><input type="date" name="avondwake_datum" value="${v('avondwake_datum')}"></label>
            <label><span>Avondwake tijd</span><input type="time" name="avondwake_tijd" value="${v('avondwake_tijd')}"></label>
            <label class="span-3"><span>Locatie avondwake</span><input type="text" name="avondwake_locatie" value="${v('avondwake_locatie')}"></label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Uitvaartdienst & ter aardebestelling</legend>
          <div class="grid-3">
            <label><span>Type uitvaart</span>
              <select name="uitvaart_type">
                <option value="">—</option>
                <option value="begrafenis" ${sel('uitvaart_type','begrafenis')}>Begrafenis</option>
                <option value="crematie" ${sel('uitvaart_type','crematie')}>Crematie</option>
                <option value="repatriëring" ${sel('uitvaart_type','repatriëring')}>Repatriëring</option>
              </select>
            </label>
            <label><span>Datum uitvaart</span><input type="date" name="uitvaart_datum" value="${v('uitvaart_datum')}"></label>
            <label><span>Tijd uitvaart</span><input type="time" name="uitvaart_tijd" value="${v('uitvaart_tijd')}"></label>
            <label class="span-3"><span>Kerk / dienstlocatie</span><input type="text" name="kerk_locatie" value="${v('kerk_locatie')}" placeholder="bijv. Kerk en Dolabani Zaal"></label>
            <label class="span-2"><span>Begraafplaats</span><input type="text" name="begraafplaats" value="${v('begraafplaats')}"></label>
            <label><span>Type graf</span>
              <select name="graf_type">
                <option value="">—</option>
                ${['eigen graf','algemeen graf','familiegraf','urnenruimte'].map(x =>
                  `<option value="${esc(x)}" ${sel('graf_type', x)}>${esc(x)}</option>`).join('')}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Logistiek</legend>
          <div class="grid-3">
            <label class="span-3"><span>Kistmodel (Unigra catalogus)</span>
              <div class="kist-picker">
                <select name="kist_type" id="kist-select">
                  <option value="">— niet gekozen —</option>
                  ${KISTEN_CATALOGUS.map(k => {
                    const label = `${k.naam} — ${k.materiaal} — ${fmtEUR(k.bedrag)}`;
                    return `<option value="${esc(k.naam)}" ${dossier.kist_type === k.naam ? 'selected' : ''}>${esc(label)}</option>`;
                  }).join('')}
                  <option value="anders" ${sel('kist_type','anders')}>Anders / handmatig</option>
                </select>
                <div class="kist-preview" id="kist-preview" aria-live="polite"></div>
              </div>
            </label>
            <label><span>Rouwauto</span><input type="text" name="rouwauto" value="${v('rouwauto')}"></label>
            <label><span>Aantal volgauto's</span><input type="number" name="aantal_volgauto" value="${v('aantal_volgauto')}" min="0"></label>
            <label><span>Dragers</span><input type="text" name="dragers" value="${v('dragers')}" placeholder="aantal en namen"></label>
            <label class="span-3"><span>Bloemstuk (eigen catalogus) <a href="#/bloemen" class="muted small" style="margin-left:.5rem;">beheren →</a></span>
              <div class="kist-picker">
                <select name="bloemstukken" id="bloem-select">
                  <option value="">— niet gekozen —</option>
                  ${DB.list(KEYS.BLOEMEN).slice().sort((a,b) => a.naam.localeCompare(b.naam)).map(b => {
                    const label = `${b.naam}${b.bedrag ? ' — ' + fmtEUR(b.bedrag) : ''}`;
                    return `<option value="${esc(b.naam)}" ${dossier.bloemstukken === b.naam ? 'selected' : ''}>${esc(label)}</option>`;
                  }).join('')}
                  <option value="anders" ${sel('bloemstukken','anders')}>Anders / handmatig</option>
                </select>
                <div class="kist-preview" id="bloem-preview" aria-live="polite"></div>
              </div>
            </label>
            <label><span>Aantal rouwkaarten</span><input type="number" name="rouwkaarten_aantal" value="${v('rouwkaarten_aantal')}" min="0"></label>
            <label class="span-2"><span>Locatie condoleance</span><input type="text" name="condoleance_locatie" value="${v('condoleance_locatie')}"></label>
            <label><span>Catering</span><input type="text" name="catering" value="${v('catering')}"></label>
            <label class="span-3"><span>Muziek / koor / zang</span><input type="text" name="muziek_zang" value="${v('muziek_zang')}"></label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Verzekering & opdrachtgever</legend>
          <div class="grid-3">
            <label><span>Verzekering</span>
              <select name="verzekering_status">
                <option value="">—</option>
                <option value="met verzekering" ${sel('verzekering_status','met verzekering')}>Met verzekering</option>
                <option value="zonder verzekering" ${sel('verzekering_status','zonder verzekering')}>Zonder verzekering</option>
              </select>
            </label>
            <label><span>Verzekeringsmaatschappij</span><input type="text" name="verzekering_maatschappij" value="${v('verzekering_maatschappij')}"></label>
            <label><span>Polisnummer</span><input type="text" name="polisnummer" value="${v('polisnummer')}"></label>
            <label><span>Opdrachtgever</span><input type="text" name="opdrachtgever_naam" value="${v('opdrachtgever_naam')}"></label>
            <label><span>Telefoon opdrachtgever</span><input type="tel" name="opdrachtgever_telefoon" value="${v('opdrachtgever_telefoon')}"></label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Bijzonderheden</legend>
          <label class="full"><span>Notities / wensen familie</span>
            <textarea name="bijzonderheden" rows="5">${v('bijzonderheden')}</textarea>
          </label>
        </fieldset>

        <div class="form-actions">
          <a href="${isNew ? '#/dossiers' : '#/dossiers/' + dossier.id}" class="btn btn-ghost" id="btn-cancel-form">Annuleren</a>
          <button type="submit" class="btn btn-primary">${isNew ? 'Dossier aanmaken' : 'Wijzigingen opslaan'}</button>
        </div>
      </form>
    </div>`;

  // Kist-preview live bijwerken
  const kistSelect = $('#kist-select');
  const kistPreview = $('#kist-preview');
  function updateKistPreview() {
    const v = kistSelect.value;
    if (!v) {
      kistPreview.innerHTML = '<div class="kist-preview-empty">Geen kist gekozen</div>';
      return;
    }
    if (v === 'anders') {
      kistPreview.innerHTML = '<div class="kist-preview-empty">Handmatig / anders gekozen</div>';
      return;
    }
    const k = KISTEN_CATALOGUS.find(x => x.naam === v);
    if (!k) { kistPreview.innerHTML = ''; return; }
    const fotoUrl = KistFotos.urlVoor(k.naam);
    const beeld = fotoUrl
      ? `<img src="${esc(fotoUrl)}" alt="${esc(k.naam)}" loading="lazy">`
      : kistSVG(k.materiaal);
    kistPreview.innerHTML = `
      <div class="kist-img">${beeld}</div>
      <div class="kist-meta">
        <strong>${esc(k.naam)}</strong>
        <span class="muted small">${esc(k.materiaal)}</span>
        <span class="kist-price">${fmtEUR(k.bedrag)}</span>
        ${fotoUrl ? '' : '<span class="muted small"><a href="#/kisten">Foto uploaden</a></span>'}
      </div>`;
  }
  kistSelect.addEventListener('change', updateKistPreview);
  updateKistPreview();

  // Bloem-preview live bijwerken
  const bloemSelect = $('#bloem-select');
  const bloemPreview = $('#bloem-preview');
  function updateBloemPreview() {
    const v = bloemSelect.value;
    if (!v) { bloemPreview.innerHTML = '<div class="kist-preview-empty">Geen bloemstuk gekozen</div>'; return; }
    if (v === 'anders') { bloemPreview.innerHTML = '<div class="kist-preview-empty">Handmatig / anders</div>'; return; }
    const b = DB.list(KEYS.BLOEMEN).find(x => x.naam === v);
    if (!b) { bloemPreview.innerHTML = ''; return; }
    const fotoUrl = BloemenFotos.urlVoor(b.naam);
    const beeld = fotoUrl
      ? `<img src="${esc(fotoUrl)}" alt="${esc(b.naam)}" loading="lazy">`
      : (typeof bloemSVG === 'function' ? bloemSVG() : '');
    bloemPreview.innerHTML = `
      <div class="kist-img">${beeld}</div>
      <div class="kist-meta">
        <strong>${esc(b.naam)}</strong>
        ${b.omschrijving ? `<span class="muted small">${esc(b.omschrijving)}</span>` : ''}
        ${b.bedrag ? `<span class="kist-price">${fmtEUR(b.bedrag)}</span>` : ''}
        ${fotoUrl ? '' : '<span class="muted small"><a href="#/bloemen">Foto uploaden</a></span>'}
      </div>`;
  }
  bloemSelect.addEventListener('change', updateBloemPreview);
  updateBloemPreview();

  // ─── Autosave: bewaar concept tijdens typen, herstel na navigatie ───
  const draftKey = dossierDraftKey(isNew, dossier.id);
  const formEl = $('#dossier-form');
  const banner = $('#draft-banner');
  const status = $('#autosave-status');

  try {
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      const draft = JSON.parse(raw);
      const restored = applyDossierDraft(formEl, draft);
      if (restored > 0) {
        banner.hidden = false;
        banner.innerHTML = `Niet-opgeslagen wijzigingen hersteld. <a href="#" id="btn-discard-draft">Concept verwerpen</a>`;
        $('#btn-discard-draft').addEventListener('click', e => {
          e.preventDefault();
          if (!confirm('Niet-opgeslagen wijzigingen weggooien?')) return;
          localStorage.removeItem(draftKey);
          renderDossierForm(params);
        });
        // Previews bijwerken na herstel
        updateKistPreview();
        updateBloemPreview();
      }
    }
  } catch (_) {}

  let saveTimer = null;
  function scheduleSave() {
    if (status) { status.textContent = 'Bezig met bewaren...'; status.className = 'autosave-status saving'; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(snapshotDossierForm(formEl)));
        if (status) {
          const t = new Date();
          status.textContent = 'Concept opgeslagen ' + t.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
          status.className = 'autosave-status saved';
        }
      } catch (_) {
        if (status) { status.textContent = 'Lokaal opslaan mislukt'; status.className = 'autosave-status error'; }
      }
    }, 400);
  }
  formEl.addEventListener('input', scheduleSave);
  formEl.addEventListener('change', scheduleSave);

  // Concept verwerpen bij annuleren
  const cancelLink = $('#btn-cancel-form');
  if (cancelLink) {
    cancelLink.addEventListener('click', () => { localStorage.removeItem(draftKey); });
  }

  $('#dossier-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {};
    DOSSIER_VELDEN.forEach(f => {
      const inp = e.target.elements[f];
      if (inp) data[f] = (inp.value || '').trim();
    });
    if (!data.status) data.status = 'nieuw';

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; const oldText = btn.textContent;
    btn.textContent = 'Bezig met opslaan...';

    try {
      if (isNew) {
        const created = await DB.insert(KEYS.DOSSIERS, data);
        for (let i = 0; i < STANDAARD_TAKEN.length; i++) {
          await DB.insert(KEYS.TAKEN, {
            dossier_id: created.id,
            omschrijving: STANDAARD_TAKEN[i],
            voltooid: false,
            volgorde: i,
          });
        }
        localStorage.removeItem(draftKey);
        Router.go('/dossiers/' + created.id);
      } else {
        await DB.update(KEYS.DOSSIERS, dossier.id, data);
        localStorage.removeItem(draftKey);
        Router.go('/dossiers/' + dossier.id);
      }
    } catch (err) {
      btn.disabled = false; btn.textContent = oldText;
    }
  });
}
