// Dossier intake/edit formulier

function dossierDraftKey(isNew, id) {
  return `sok_draft_${isNew ? 'new' : id}`;
}
function snapshotDossierForm(formEl) {
  const data = {};
  DOSSIER_VELDEN.forEach(f => {
    const inp = formEl.elements[f];
    if (!inp) return;
    if (inp.type === 'checkbox') data[f] = inp.checked ? 'ja' : 'nee';
    else data[f] = inp.value;
  });
  return data;
}
function applyDossierDraft(formEl, data) {
  let changed = 0;
  for (const f in data) {
    const inp = formEl.elements[f];
    if (!inp || data[f] == null) continue;
    if (inp.type === 'checkbox') {
      const want = data[f] === 'ja' || data[f] === true || data[f] === 'true';
      if (inp.checked !== want) { inp.checked = want; changed++; }
    } else if (inp.value !== data[f]) {
      inp.value = data[f];
      changed++;
    }
  }
  // Datum-displays bijwerken na restore (hidden value is gezet, visible niet)
  if (typeof WheelDate !== 'undefined') WheelDate.syncDisplays(formEl);
  return changed;
}

function renderDossierForm(params) {
  const isNew = !params.id;
  const dossier = isNew ? { dossier_nummer: '(wordt automatisch toegekend)', status: 'nieuw' } : DB.byId(KEYS.DOSSIERS, parseInt(params.id, 10));
  if (!isNew && !dossier) return render404();

  // Scan-intake prefill: bij nieuw dossier de uit OCR herkende velden
  // overnemen (eenmalig, daarna verwijderen uit localStorage)
  let _scannedFields = null;
  if (isNew) {
    try {
      const raw = localStorage.getItem('sok_scan_prefill');
      if (raw) {
        _scannedFields = JSON.parse(raw);
        Object.assign(dossier, _scannedFields);
        localStorage.removeItem('sok_scan_prefill');
      }
    } catch (_) {}
  }

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

        <input type="hidden" name="status" value="${esc(dossier.status || 'nieuw')}">

        <nav class="wizard-nav" id="wizard-nav" aria-label="Voortgang">
          <button type="button" class="wizard-step" data-go="1"><span class="num">1</span><span class="lbl">NAW gegevens</span></button>
          <button type="button" class="wizard-step" data-go="2"><span class="num">2</span><span class="lbl">Uitvaart</span></button>
          <button type="button" class="wizard-step" data-go="3"><span class="num">3</span><span class="lbl">Kosten</span></button>
          <button type="button" class="wizard-step" data-go="4"><span class="num">4</span><span class="lbl">Verzekering</span></button>
          <button type="button" class="wizard-step" data-go="5"><span class="num">5</span><span class="lbl">Bijzonderheden</span></button>
          <button type="button" class="wizard-step" data-go="6"><span class="num">6</span><span class="lbl">Handtekeningen</span></button>
        </nav>

        <fieldset class="card" data-step="1">
          <legend>Gegevens overledene</legend>
          <div class="grid-3">
            <label><span>Voornaam</span><input type="text" name="voornaam" value="${v('voornaam')}"></label>
            <label><span>Achternaam</span><input type="text" name="achternaam" value="${v('achternaam')}"></label>
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
            <label><span>Nationaliteit</span><input type="text" name="nationaliteit" value="${v('nationaliteit')}"></label>
            <label><span>Lid Syrisch-Orthodoxe Kerk</span>
              <select name="syrisch_orthodox_lid">
                <option value="">—</option>
                <option value="ja" ${sel('syrisch_orthodox_lid','ja')}>Ja</option>
                <option value="nee" ${sel('syrisch_orthodox_lid','nee')}>Nee</option>
                <option value="onbekend" ${sel('syrisch_orthodox_lid','onbekend')}>Onbekend</option>
              </select>
            </label>
            <label class="span-3"><span>Naam (ex)partner</span>
              <input type="text" name="partner_naam" value="${v('partner_naam')}" placeholder="naam echtgeno(o)t(e), partner of ex-partner (optioneel)">
            </label>
            <label><span>Laat overledene kinderen na?</span>
              <select name="kinderen_status" id="kinderen-status-select">
                <option value="">—</option>
                <option value="ja" ${sel('kinderen_status','ja')}>Ja</option>
                <option value="nee" ${sel('kinderen_status','nee')}>Nee</option>
              </select>
            </label>
            <label><span>Minderjarige kinderen?</span>
              <select name="minderjarige_kinderen" id="minderjarige-kinderen-select">
                <option value="">—</option>
                <option value="ja" ${sel('minderjarige_kinderen','ja')}>Ja</option>
                <option value="nee" ${sel('minderjarige_kinderen','nee')}>Nee</option>
              </select>
            </label>
            <label class="span-3" id="kinderen-namen-row" hidden><span>Namen minderjarige kinderen (één per regel)</span>
              <textarea name="kinderen_namen" rows="3" placeholder="bv.&#10;Sami (12)&#10;Maria (8)">${v('kinderen_namen')}</textarea>
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="1">
          <legend>Contactpersoon</legend>
          <div class="grid-3">
            <label><span>BSN</span><input type="text" name="contact_bsn" value="${v('contact_bsn')}"></label>
            <label><span>Achternaam</span><input type="text" name="contact_naam" value="${v('contact_naam')}"></label>
            <label><span>Voornaam</span><input type="text" name="contact_voornaam" value="${v('contact_voornaam')}"></label>
            <label class="span-2"><span>Adres (straatnaam)</span><input type="text" name="contact_adres" value="${v('contact_adres')}"></label>
            <label><span>Huisnummer</span><input type="text" name="contact_huisnummer" value="${v('contact_huisnummer')}" placeholder="bv. 12 of 12a"></label>
            <label><span>Postcode</span><input type="text" name="contact_postcode" value="${v('contact_postcode')}"></label>
            <label class="span-2"><span>Woonplaats</span><input type="text" name="contact_woonplaats" value="${v('contact_woonplaats')}"></label>
            <label><span>Geboortedatum</span><input type="date" name="contact_geboortedatum" value="${v('contact_geboortedatum')}"></label>
            <label><span>Telefoon</span><input type="tel" name="contact_telefoon" value="${v('contact_telefoon')}"></label>
            <label class="span-2"><span>E-mail</span><input type="email" name="contact_email" value="${v('contact_email')}"></label>
            <label><span>Relatie tot overledene</span><input type="text" name="contact_relatie" value="${v('contact_relatie')}" placeholder="echtgenoot, zoon, dochter..."></label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="2">
          <legend>Uitvaart</legend>
          <div class="grid-3">
            <label><span>Parochie</span>
              ${(() => {
                const lijst = Settings.get('parochies') || [];
                const huidig = v('parochie');
                const inLijst = lijst.some(p => (p.naam || p) === huidig);
                return `
                <select name="parochie" id="parochie-input">
                  <option value="">— kies een parochie —</option>
                  ${lijst.map(p => {
                    const naam = p.naam || p;
                    return `<option value="${esc(naam)}" ${huidig === naam ? 'selected' : ''}>${esc(naam)}</option>`;
                  }).join('')}
                  ${huidig && !inLijst ? `<option value="${esc(huidig)}" selected>${esc(huidig)} (niet in lijst)</option>` : ''}
                </select>
                ${lijst.length === 0
                  ? '<span class="muted small">Nog geen parochies ingesteld — voeg toe in <a href="#/account#parochies">Account → Parochies &amp; priesters</a>.</span>'
                  : '<span class="muted small">Beheren in <a href="#/account#parochies">Account</a>.</span>'}
                `;
              })()}
            </label>
            <label><span>Priester / Abuna</span><input type="text" name="priester" id="priester-input" value="${v('priester')}"></label>
            <label><span>Type uitvaart</span>
              <select name="uitvaart_type">
                <option value="">—</option>
                <option value="begrafenis" ${sel('uitvaart_type','begrafenis')}>Begrafenis</option>
                <option value="repatriëring" ${sel('uitvaart_type','repatriëring')}>Repatriëring</option>
              </select>
            </label>
            <label><span>Datum uitvaart</span><input type="date" name="uitvaart_datum" value="${v('uitvaart_datum')}"></label>
            <label><span>Tijdstip uitvaart</span><input type="time" name="uitvaart_tijd" value="${v('uitvaart_tijd')}"></label>
            <label class="span-3"><span>Kerk / dienstlocatie</span>
              <input type="text" name="kerk_locatie" value="${esc(v('kerk_locatie') || (isNew ? (Settings.get('default_kerk_locatie') || 'Maria kathedraal') : ''))}" placeholder="bv. Maria kathedraal">
            </label>
            <label class="span-2"><span>Begraafplaats</span>
              <input type="text" name="begraafplaats" value="${esc(v('begraafplaats') || (isNew ? (Settings.get('default_begraafplaats') || 'St. Ephrem') : ''))}">
            </label>
            <label><span>Grafnummer</span><input type="text" name="grafnummer" value="${v('grafnummer')}"></label>
            <label class="span-3"><span>Type graf</span>
              <select name="graf_type">
                <option value="">—</option>
                ${['oude begraafplaats','algemeen graf','familiegraf'].map(x =>
                  `<option value="${esc(x)}" ${sel('graf_type', x)}>${esc(x)}</option>`).join('')}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="3">
          <legend>Kosten</legend>
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
            <label class="span-3"><span>Eten &amp; drinken (catalogus) <a href="#/eten-drinken" class="muted small" style="margin-left:.5rem;">beheren →</a></span>
              <div class="kist-picker">
                <select name="catering" id="ed-select">
                  <option value="">— niet gekozen —</option>
                  ${DB.list(KEYS.ETEN_DRINKEN).slice().sort((a,b) => a.naam.localeCompare(b.naam)).map(b => {
                    const label = `${b.naam}${b.bedrag ? ' — ' + fmtEUR(b.bedrag) : ''}`;
                    return `<option value="${esc(b.naam)}" ${dossier.catering === b.naam ? 'selected' : ''}>${esc(label)}</option>`;
                  }).join('')}
                  <option value="anders" ${sel('catering','anders')}>Anders / handmatig</option>
                </select>
                <div class="kist-preview" id="ed-preview" aria-live="polite"></div>
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="4">
          <legend>Verzekering</legend>
          <div class="grid-2">
            <label class="span-2"><span>Is er een verzekering?</span>
              <select name="verzekering_status" id="verzekering-status-select">
                <option value="">— nog niet bekend —</option>
                <option value="met verzekering" ${sel('verzekering_status','met verzekering')}>Ja, met verzekering</option>
                <option value="zonder verzekering" ${sel('verzekering_status','zonder verzekering')}>Nee, geen verzekering</option>
              </select>
            </label>
          </div>
          <div class="grid-2" id="verzekering-polis-row" hidden>
            <label><span>Polisnummer</span><input type="text" name="polisnummer" value="${v('polisnummer')}"></label>
            <label><span>Gezinsnummer</span><input type="text" name="gezinsnummer" value="${v('gezinsnummer')}" placeholder="(klooster-administratie)"></label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="5">
          <legend>Bijzonderheden</legend>
          <label class="full"><span>Notities / wensen familie</span>
            <textarea name="bijzonderheden" rows="5">${v('bijzonderheden')}</textarea>
          </label>
        </fieldset>

        <fieldset class="card" data-step="6">
          <legend>Handtekeningen <a href="#/account#handtekeningen" class="muted small" style="margin-left:.5rem;text-transform:none;letter-spacing:0;">velden beheren →</a></legend>
          <div class="signatures-grid">
            ${(Settings.get('signature_fields') || []).map(f => `
              <div class="signature-block" data-sigid="${esc(f.id)}">
                <div class="signature-header">
                  <strong>${esc(f.label)}</strong>
                  ${f.required ? '<span class="badge badge-amber">verplicht</span>' : '<span class="muted small">optioneel</span>'}
                </div>
                <canvas class="signature-pad" data-sigid="${esc(f.id)}" width="600" height="180"></canvas>
                <div class="signature-actions">
                  <span class="signature-status muted small" data-status="${esc(f.id)}">nog niet ondertekend</span>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="clear-sig" data-sigid="${esc(f.id)}">Wissen</button>
                </div>
              </div>`).join('') || '<p class="muted">Geen handtekening-velden ingesteld. <a href="#/account">Beheer in Account</a>.</p>'}
          </div>
        </fieldset>

        <div class="form-actions wizard-actions">
          <a href="${isNew ? '#/dossiers' : '#/dossiers/' + dossier.id}" class="btn btn-ghost" id="btn-cancel-form">Annuleren</a>
          <div class="wizard-actions-right">
            <button type="button" class="btn btn-ghost" id="btn-wizard-prev" hidden>← Vorige</button>
            <button type="button" class="btn btn-primary" id="btn-wizard-next">Verder →</button>
            <button type="submit" class="btn btn-primary" id="btn-wizard-submit" hidden>${isNew ? 'Dossier aanmaken' : 'Wijzigingen opslaan'}</button>
          </div>
        </div>
      </form>
    </div>`;

  // ─── Wizard: stappen tonen één voor één ──────────────────────────────
  const TOTAL_STEPS = 6;
  const stepKey = `sok_wizard_step_${isNew ? 'nieuw' : dossier.id}`;
  let currentStep = (() => {
    try {
      const saved = parseInt(localStorage.getItem(stepKey), 10);
      return (saved >= 1 && saved <= TOTAL_STEPS) ? saved : 1;
    } catch (_) { return 1; }
  })();

  // Aanbevolen velden per stap — bepalen kleur (rood/oranje/groen)
  const STEP_FIELDS = {
    1: ['voornaam','achternaam','geboortedatum','overlijdensdatum',
        'adres_overledene','postcode_overledene','woonplaats_overledene',
        'contact_naam','contact_voornaam','contact_telefoon','contact_relatie'],
    2: ['parochie','priester','uitvaart_type','uitvaart_datum',
        'uitvaart_tijd','kerk_locatie','begraafplaats'],
    3: ['kist_type'],
    // 4 = speciale logica (verzekering-toggle)
    5: [],  // bijzonderheden is volledig optioneel
    6: [],  // handtekeningen apart
  };

  const fillStateForStep = (step) => {
    const form = document.getElementById('dossier-form');
    if (!form) return 'empty';
    const fd = new FormData(form);
    const isFilled = name => {
      const v = fd.get(name);
      return v != null && String(v).trim() !== '';
    };

    // Stap 4 — speciale logica voor verzekering
    if (step === 4) {
      const status = (fd.get('verzekering_status') || '').trim();
      if (!status) return 'empty';
      if (status === 'zonder verzekering') return 'complete';
      const polis = isFilled('polisnummer');
      const gezin = isFilled('gezinsnummer');
      if (polis && gezin) return 'complete';
      if (polis || gezin) return 'partial';
      return 'partial'; // alleen 'ja' aangegeven, nog niets ingevuld
    }

    // Stap 6 — handtekeningen, check via Settings + bestaande dossier-data
    if (step === 6) {
      const verplicht = (Settings.get('signature_fields') || []).filter(f => f.required);
      if (verplicht.length === 0) return 'complete';
      const sigs = dossier.handtekeningen || {};
      const gevuld = verplicht.filter(f => sigs[f.id]).length;
      if (gevuld === 0) return 'empty';
      if (gevuld < verplicht.length) return 'partial';
      return 'complete';
    }

    const fields = STEP_FIELDS[step] || [];
    if (fields.length === 0) return 'complete';
    const filled = fields.filter(isFilled).length;
    if (filled === 0) return 'empty';
    if (filled === fields.length) return 'complete';
    return 'partial';
  };

  const updateStepColors = () => {
    document.querySelectorAll('.wizard-step').forEach(el => {
      const step = parseInt(el.dataset.go, 10);
      const state = fillStateForStep(step);
      el.classList.remove('fill-empty','fill-partial','fill-complete');
      el.classList.add('fill-' + state);
    });
  };

  const showStep = (n) => {
    currentStep = Math.max(1, Math.min(TOTAL_STEPS, n));
    document.querySelectorAll('#dossier-form fieldset[data-step]').forEach(fs => {
      const step = parseInt(fs.dataset.step, 10);
      fs.hidden = (step !== currentStep);
    });
    document.querySelectorAll('.wizard-step').forEach(el => {
      const step = parseInt(el.dataset.go, 10);
      el.classList.toggle('active', step === currentStep);
    });
    document.getElementById('btn-wizard-prev').hidden = (currentStep === 1);
    document.getElementById('btn-wizard-next').hidden = (currentStep === TOTAL_STEPS);
    document.getElementById('btn-wizard-submit').hidden = (currentStep !== TOTAL_STEPS);
    const form = document.getElementById('dossier-form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { localStorage.setItem(stepKey, String(currentStep)); } catch (_) {}
    updateStepColors();
  };

  document.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => showStep(parseInt(el.dataset.go, 10)));
  });
  document.getElementById('btn-wizard-prev').addEventListener('click', () => showStep(currentStep - 1));
  document.getElementById('btn-wizard-next').addEventListener('click', () => showStep(currentStep + 1));

  // Verzekering-toggle: polis/gezin-rij tonen alleen bij 'met verzekering'
  const verzSel = document.getElementById('verzekering-status-select');
  const polisRow = document.getElementById('verzekering-polis-row');
  const updateVerzekeringRow = () => {
    if (!verzSel || !polisRow) return;
    polisRow.hidden = verzSel.value !== 'met verzekering';
  };
  if (verzSel) {
    verzSel.addEventListener('change', () => {
      updateVerzekeringRow();
      updateStepColors();
    });
    updateVerzekeringRow();
  }

  // Live kleuren bijwerken bij élke input-wijziging (debounced)
  let colorTimer = null;
  document.getElementById('dossier-form').addEventListener('input', () => {
    clearTimeout(colorTimer);
    colorTimer = setTimeout(updateStepColors, 200);
  });
  document.getElementById('dossier-form').addEventListener('change', updateStepColors);

  showStep(currentStep);

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

  // ─── Handtekeningen activeren ──────────────────────────────────────────
  const sigPads = {};
  const existingSigs = (dossier.handtekeningen && typeof dossier.handtekeningen === 'object') ? dossier.handtekeningen : {};
  $$('.signature-pad').forEach(canvas => {
    const id = canvas.getAttribute('data-sigid');
    const pad = new SignaturePad(canvas);
    sigPads[id] = pad;
    if (existingSigs[id] && existingSigs[id].data) {
      pad.fromDataURL(existingSigs[id].data);
      const status = $(`[data-status="${id}"]`);
      if (status) {
        const when = existingSigs[id].signed_at ? ' op ' + new Date(existingSigs[id].signed_at).toLocaleString('nl-NL') : '';
        status.textContent = 'Ondertekend' + when;
        status.classList.add('signed');
      }
    }
  });
  $('#dossier-form').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="clear-sig"]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute('data-sigid');
    const pad = sigPads[id]; if (!pad) return;
    pad.clear();
    const status = $(`[data-status="${id}"]`);
    if (status) { status.textContent = 'nog niet ondertekend'; status.classList.remove('signed'); }
  });

  // Eten & drinken-preview live bijwerken
  const edSelect = $('#ed-select');
  const edPreview = $('#ed-preview');
  function updateEdPreview() {
    const v = edSelect.value;
    if (!v) { edPreview.innerHTML = '<div class="kist-preview-empty">Niet gekozen</div>'; return; }
    if (v === 'anders') { edPreview.innerHTML = '<div class="kist-preview-empty">Handmatig / anders</div>'; return; }
    const b = DB.list(KEYS.ETEN_DRINKEN).find(x => x.naam === v);
    if (!b) { edPreview.innerHTML = ''; return; }
    const fotoUrl = EtenDrinkenFotos.urlVoor(b.naam);
    const beeld = fotoUrl
      ? `<img src="${esc(fotoUrl)}" alt="${esc(b.naam)}" loading="lazy">`
      : (typeof edSVG === 'function' ? edSVG() : '');
    edPreview.innerHTML = `
      <div class="kist-img">${beeld}</div>
      <div class="kist-meta">
        <strong>${esc(b.naam)}</strong>
        ${b.omschrijving ? `<span class="muted small">${esc(b.omschrijving)}</span>` : ''}
        ${b.bedrag ? `<span class="kist-price">${fmtEUR(b.bedrag)}</span>` : ''}
        ${fotoUrl ? '' : '<span class="muted small"><a href="#/eten-drinken">Foto uploaden</a></span>'}
      </div>`;
  }
  edSelect.addEventListener('change', updateEdPreview);
  updateEdPreview();

  // ─── Namen kinderen tonen + popup bij minderjarig=ja ─────────────────
  const minderjarigSel = $('#minderjarige-kinderen-select');
  const kindRow = $('#kinderen-namen-row');
  let minderjarigPopupShown = (dossier.minderjarige_kinderen === 'ja'); // niet opnieuw tonen voor bestaand dossier
  function updateMinderjarigVisibility() {
    const isJa = minderjarigSel?.value === 'ja';
    if (kindRow) kindRow.hidden = !isJa;
  }
  if (minderjarigSel) {
    minderjarigSel.addEventListener('change', () => {
      updateMinderjarigVisibility();
      if (minderjarigSel.value === 'ja' && !minderjarigPopupShown) {
        minderjarigPopupShown = true;
        Modal.show({
          type: 'info',
          title: 'Minderjarige kinderen',
          message: 'Vergeet niet de namen (en leeftijden) van de minderjarige kinderen op de achterzijde van het aangifte-formulier in te vullen.',
        });
      }
    });
    updateMinderjarigVisibility();
  }

  // ─── Parochie kiezen → priester (abuna) automatisch invullen ────────
  const parochieInp = $('#parochie-input');
  const priesterInp = $('#priester-input');
  if (parochieInp) {
    parochieInp.addEventListener('change', () => {
      if (!priesterInp) return;
      const naam = parochieInp.value;
      if (!naam) return;
      const lijst = Settings.get('parochies') || [];
      const match = lijst.find(p => (p.naam || p) === naam);
      // Bij een bewuste keuze altijd de standaard-priester overnemen.
      // Was er nog een handmatig ingevulde priester? Vragen of die behouden moet blijven.
      const had = priesterInp.value.trim();
      const nieuw = (match && match.priester) ? match.priester : '';
      if (nieuw && nieuw !== had) priesterInp.value = nieuw;
    });
  }

  // ─── Adres-autocomplete via PDOK Locatieserver ───────────────────────
  // Typ "Straatnaam 12" → kies uit dropdown → alle velden auto-ingevuld.
  Postcode.bindAddressAutocomplete({
    straatEl:     $('input[name="adres_overledene"]'),
    postcodeEl:   $('input[name="postcode_overledene"]'),
    woonplaatsEl: $('input[name="woonplaats_overledene"]'),
  });
  Postcode.bindAddressAutocomplete({
    straatEl:     $('input[name="contact_adres"]'),
    huisnummerEl: $('input[name="contact_huisnummer"]'),
    postcodeEl:   $('input[name="contact_postcode"]'),
    woonplaatsEl: $('input[name="contact_woonplaats"]'),
  });

  // ─── #3 Auto-fill contactpersoon-gegevens uit eerder dossier ──────────
  const contactNaamInp = $('input[name="contact_naam"]');
  if (contactNaamInp) {
    contactNaamInp.addEventListener('change', async () => {
      const val = contactNaamInp.value.trim();
      if (!val) return;
      const matches = DB.list(KEYS.DOSSIERS).filter(x =>
        x.contact_naam && x.contact_naam.toLowerCase() === val.toLowerCase() &&
        (isNew || x.id !== dossier.id)
      );
      if (matches.length === 0) return;
      const m = matches.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
      const ok = await Modal.confirm({
        type: 'info',
        title: 'Bekende contactpersoon',
        message: `${val} kwam eerder voor in dossier ${m.dossier_nummer}. Eerder ingevulde contactgegevens overnemen (telefoon, e-mail, adres)?`,
        confirmText: 'Ja, overnemen',
        cancelText: 'Nee, leeg laten',
      });
      if (!ok) return;
      const fields = ['contact_voornaam','contact_relatie','contact_telefoon','contact_email',
                      'contact_adres','contact_postcode','contact_woonplaats','gezinsnummer'];
      const form = $('#dossier-form');
      fields.forEach(f => {
        const inp = form.elements[f];
        if (inp && !inp.value && m[f]) inp.value = m[f];
      });
    });
  }

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
        $('#btn-discard-draft').addEventListener('click', async e => {
          e.preventDefault();
          const ok = await Modal.confirm({
            title: 'Wijzigingen weggooien?',
            message: 'Alle niet-opgeslagen wijzigingen in dit formulier gaan verloren.',
            confirmText: 'Weggooien',
            cancelText: 'Annuleren',
          });
          if (!ok) return;
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
    cancelLink.addEventListener('click', () => {
      localStorage.removeItem(draftKey);
      try { localStorage.removeItem(stepKey); } catch (_) {}
    });
  }

  $('#dossier-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {};
    DOSSIER_VELDEN.forEach(f => {
      const inp = e.target.elements[f];
      if (!inp) return;
      if (inp.type === 'checkbox') data[f] = inp.checked ? 'ja' : 'nee';
      else data[f] = (inp.value || '').trim();
    });
    if (!data.status) data.status = 'nieuw';

    // Handtekeningen verzamelen — behoud bestaande als de pad niet opnieuw is getekend
    const handtekeningen = Object.assign({}, existingSigs);
    let missingRequired = [];
    (Settings.get('signature_fields') || []).forEach(f => {
      const pad = sigPads[f.id];
      if (!pad) return;
      if (!pad.isEmpty()) {
        handtekeningen[f.id] = { data: pad.toDataURL(), signed_at: new Date().toISOString() };
      }
      if (f.required && !(handtekeningen[f.id] && handtekeningen[f.id].data)) {
        missingRequired.push(f.label);
      }
    });
    if (missingRequired.length > 0) {
      Modal.show({
        type: 'warning',
        title: 'Handtekening vereist',
        message: 'Vul nog de volgende handtekening(en) in: ' + missingRequired.join(', '),
      });
      return;
    }
    data.handtekeningen = handtekeningen;

    // Aanbevolen-velden check
    const ontbrekend = AANBEVOLEN_VELDEN.filter(f => !data[f.name] || !String(data[f.name]).trim());
    if (ontbrekend.length > 0) {
      const lijst = '<ul>' + ontbrekend.map(f => `<li>${esc(f.label)}</li>`).join('') + '</ul>';
      const html = `<p>De volgende gegevens zijn nog niet ingevuld:</p>${lijst}<p>Wat wil je doen?</p>`;
      const wantsToSave = await Modal.confirm({
        type: 'warning',
        title: 'Ontbrekende gegevens',
        html,
        confirmText: 'Toch opslaan',
        cancelText: 'Ga terug en invullen',
      });
      if (!wantsToSave) {
        // Ga naar het eerste lege veld
        const first = ontbrekend[0];
        const inp = e.target.elements[first.name];
        if (inp) {
          inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => { try { inp.focus(); } catch (_) {} }, 350);
        }
        return;
      }
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; const oldText = btn.textContent;
    btn.textContent = 'Bezig met opslaan...';

    try {
      if (isNew) {
        const created = await DB.insert(KEYS.DOSSIERS, data);
        // Standaard-kostenposten meteen aan dit nieuwe dossier hangen,
        // zodat het kosten-overzicht direct compleet is. Gebruiker kan
        // ze in het dossier aanpassen of verwijderen.
        try {
          await Promise.all((KOSTEN_PRESETS || []).map(p => DB.insert(KEYS.KOSTEN, {
            dossier_id: created.id,
            omschrijving: p.omschrijving,
            categorie: p.categorie,
            bedrag: p.bedrag,
            aantal: 1,
            betaald: false,
          })));
        } catch (kErr) {
          console.warn('Standaard-kostenposten toevoegen mislukt:', kErr);
        }
        localStorage.removeItem(draftKey);
        try { localStorage.removeItem(stepKey); } catch (_) {}
        Router.go('/dossiers/' + created.id);
      } else {
        await DB.update(KEYS.DOSSIERS, dossier.id, data);
        localStorage.removeItem(draftKey);
        try { localStorage.removeItem(stepKey); } catch (_) {}
        Router.go('/dossiers/' + dossier.id);
      }
    } catch (err) {
      btn.disabled = false; btn.textContent = oldText;
    }
  });
}
