// Dossier intake/edit formulier

// ─── Auto-invullen: bekende naam uit een eerder dossier → gegevens overnemen ─
const Autofill = {
  _lc(s) { return String(s == null ? '' : s).trim().toLowerCase(); },

  dossierByNaam(voornaam, achternaam, veldVoornaam, veldAchternaam, excludeId) {
    const vn = Autofill._lc(voornaam), an = Autofill._lc(achternaam);
    if (!an) return null;
    return DB.list(KEYS.DOSSIERS)
      .filter(d => Autofill._lc(d[veldAchternaam]) === an &&
        (vn ? Autofill._lc(d[veldVoornaam]) === vn : true) && d.id !== excludeId)
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0] || null;
  },

  // pairs: [[veldnaam, waarde], ...] — vult uitsluitend lege velden, na bevestiging.
  async vul(form, titel, bericht, pairs) {
    const teVullen = pairs.filter(([f, v]) =>
      v != null && v !== '' && form.elements[f] && !form.elements[f].value);
    if (!teVullen.length) return;
    const ok = await Modal.confirm({
      type: 'info', title: titel, message: bericht,
      confirmText: 'Ja, overnemen', cancelText: 'Nee, leeg laten',
    });
    if (!ok) return;
    let n = 0;
    teVullen.forEach(([f, v]) => {
      const el = form.elements[f];
      if (el && !el.value) {
        el.value = v; n++;
        // Alleen 'input' (voor autosave) — geen 'change', anders vuren de
        // autofill-listeners opnieuw.
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    if (n && typeof Toast !== 'undefined') Toast.show(`${n} veld${n === 1 ? '' : 'en'} automatisch ingevuld`, 'success');
  },
};

// BSN-elfproef (Nederlandse 9-cijferige BSN-controle).
function isValidBSN(bsn) {
  const s = String(bsn == null ? '' : bsn).replace(/\D/g, '');
  if (s.length !== 9 || /^0+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(s[i], 10) * (i === 8 ? -1 : 9 - i);
  return sum % 11 === 0;
}

// Zoek een bestaand dossier van dezelfde persoon (zelfde BSN, of zelfde
// voornaam + achternaam + geboortedatum). exclId sluit het huidige dossier uit.
function vindDubbelDossier(data, exclId) {
  const bsn = String(data.bsn || '').replace(/\D/g, '');
  const vn = String(data.voornaam || '').trim().toLowerCase();
  const an = String(data.achternaam || '').trim().toLowerCase();
  const gb = String(data.geboortedatum || '').trim();
  return DB.list(KEYS.DOSSIERS).find(d => {
    if (d.id === exclId) return false;
    if (bsn && String(d.bsn || '').replace(/\D/g, '') === bsn) return true;
    if (vn && an && gb &&
        String(d.voornaam || '').trim().toLowerCase() === vn &&
        String(d.achternaam || '').trim().toLowerCase() === an &&
        String(d.geboortedatum || '').trim() === gb) return true;
    return false;
  }) || null;
}

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
  // Extra personeel (checkboxes zonder name, buiten DOSSIER_VELDEN) meenemen
  // zodat de keuze een autosave-restore overleeft bij een nieuw dossier.
  data.__extra_personeel = [...formEl.querySelectorAll('.extra-personeel-cb')]
    .filter(cb => cb.checked).map(cb => cb.value);
  data.__brengen_naar = [...formEl.querySelectorAll('.brengen-naar-input')]
    .map(inp => (inp.value || '').trim()).filter(Boolean);
  data.__rouwgoederen = [...formEl.querySelectorAll('.rouwgoed-cb')]
    .filter(cb => cb.checked).map(cb => cb.value);
  data.__extra_bezittingen = [...formEl.querySelectorAll('.extra-bezit-row')]
    .map(row => ({
      label: (row.querySelector('.extra-bezit-label')?.value || '').trim(),
      aantal: parseInt(row.querySelector('.extra-bezit-aantal')?.value, 10) || 0,
    }))
    .filter(x => x.label);
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
  // Extra personeel terugzetten
  if (Array.isArray(data.__extra_personeel)) {
    const want = new Set(data.__extra_personeel);
    formEl.querySelectorAll('.extra-personeel-cb').forEach(cb => {
      const v = want.has(cb.value);
      if (cb.checked !== v) { cb.checked = v; changed++; }
    });
  }
  // Rouwgoederen-checkboxes terugzetten
  if (Array.isArray(data.__rouwgoederen)) {
    const want = new Set(data.__rouwgoederen);
    formEl.querySelectorAll('.rouwgoed-cb').forEach(cb => {
      const v = want.has(cb.value);
      if (cb.checked !== v) { cb.checked = v; changed++; }
    });
  }
  // Brengen-naar rijen terugzetten
  if (Array.isArray(data.__brengen_naar) && data.__brengen_naar.length) {
    const lijst = formEl.querySelector('#brengen-naar-lijst');
    if (lijst) {
      lijst.innerHTML = data.__brengen_naar.map(loc => `
        <div class="brengen-naar-row" style="display:flex; gap:.5rem; align-items:center;">
          <input type="text" class="brengen-naar-input" list="opbaarlocaties-datalist" value="${esc(loc)}" placeholder="bv. Aula Vale, ziekenhuis, uitvaartcentrum…" style="flex:1;">
          <button type="button" class="btn btn-sm btn-ghost brengen-naar-del" title="Verwijder">×</button>
        </div>`).join('');
      changed++;
    }
  }
  // Extra bezittingen rijen terugzetten
  if (Array.isArray(data.__extra_bezittingen) && data.__extra_bezittingen.length) {
    const lijst = formEl.querySelector('#extra-bezit-lijst');
    if (lijst) {
      lijst.innerHTML = data.__extra_bezittingen.map(b => `
        <div class="extra-bezit-row" style="display:flex; flex-direction:row; align-items:center; gap:.6rem; padding:.5rem .85rem; border:1px solid var(--border,#e5e0d6); border-radius:10px; background:var(--card-bg,#fff);">
          <input type="text" class="extra-bezit-label" value="${esc(b.label || '')}" placeholder="bv. Ketting, horloge…" style="flex:1;">
          <span class="muted small">aantal</span>
          <input type="number" class="extra-bezit-aantal" min="0" inputmode="numeric" value="${esc(b.aantal || '')}" style="width:4.5rem;">
          <button type="button" class="btn btn-sm btn-ghost extra-bezit-del" title="Verwijder">×</button>
        </div>`).join('');
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
          <button type="button" class="wizard-step" data-go="2"><span class="num">2</span><span class="lbl">Opbaren &amp; locatie</span></button>
          <button type="button" class="wizard-step" data-go="3"><span class="num">3</span><span class="lbl">Kosten</span></button>
          <button type="button" class="wizard-step" data-go="4"><span class="num">4</span><span class="lbl">Bijzonderheden</span></button>
        </nav>

        <fieldset class="card" data-step="1">
          <legend>Opdrachtgever <span class="muted small">(uitvaartleider / klant)</span></legend>
          <div class="grid-3">
            <label><span>Dossiernummer <span class="muted small">(handmatig, voor administratie)</span></span>
              <input type="text" name="dossier_nummer" value="${isNew ? '' : esc(dossier.dossier_nummer || '')}" placeholder="leeg = automatisch">
            </label>
            <label class="span-2"><span>Opdrachtgever</span>
              ${(() => {
                const lijst = Settings.get('opdrachtgevers') || [];
                const huidig = v('opdrachtgever_naam');
                const inLijst = lijst.some(o => (o.naam || o) === huidig);
                return `
                <select name="opdrachtgever_naam" id="opdrachtgever-input">
                  <option value="">— kies een opdrachtgever —</option>
                  ${lijst.map(o => {
                    const naam = o.naam || o;
                    return `<option value="${esc(naam)}" ${huidig === naam ? 'selected' : ''}>${esc(naam)}</option>`;
                  }).join('')}
                  ${huidig && !inLijst ? `<option value="${esc(huidig)}" selected>${esc(huidig)} (niet in lijst)</option>` : ''}
                </select>`;
              })()}
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="1">
          <legend>Personeel</legend>
          <label><span>Extra personeel <span class="muted small">(aanvinken uit accounts)</span></span>
            ${(() => {
              // Jezelf niet tonen: filter het eigen profiel (op auth-id) weg.
              const meId = (typeof Auth !== 'undefined' && Auth.current()) ? Auth.current().id : null;
              const personeel = (DB.list(KEYS.PERSONEEL) || []);
              const bron = personeel.length ? personeel : (DB.list(KEYS.PROFIELEN) || []);
              const accounts = [...new Set(bron
                .filter(p => !meId || p.id !== meId)
                .map(p => (p.naam || '').trim()).filter(Boolean))].sort();
              const gekozen = Array.isArray(dossier.extra_personeel) ? dossier.extra_personeel : [];
              if (!accounts.length) return '<span class="muted small">Nog geen accounts — voeg toe in <a href="#/account#rollen">Account</a>.</span>';
              return `<div style="display:flex; flex-wrap:wrap; gap:.5rem;">
                ${accounts.map(naam => `
                  <label style="display:flex; flex-direction:row; align-items:center; gap:.4rem; margin:0; padding:.35rem .75rem; border:1px solid var(--border,#e5e0d6); border-radius:20px; cursor:pointer; font-weight:500;">
                    <input type="checkbox" class="extra-personeel-cb" value="${esc(naam)}" ${gekozen.includes(naam) ? 'checked' : ''} style="width:1rem; height:1rem; accent-color:var(--primary,#2563eb);"> <span>${esc(naam)}</span>
                  </label>`).join('')}
              </div>`;
            })()}
          </label>
        </fieldset>

        <fieldset class="card" data-step="1">
          <legend>Gegevens overledene</legend>
          <div class="grid-3">
            <label><span>Achternaam</span><input type="text" name="achternaam" value="${v('achternaam')}"></label>
            <label><span>Voornaam</span><input type="text" name="voornaam" value="${v('voornaam')}"></label>
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
            <label><span>Plaats van overlijden</span><input type="text" name="overlijdensplaats" value="${v('overlijdensplaats')}" placeholder="ziekenhuis, thuis..."></label>
            <label class="span-2"><span>Adres overledene</span><input type="text" name="adres_overledene" value="${v('adres_overledene')}"></label>
            <label><span>Postcode</span><input type="text" name="postcode_overledene" value="${v('postcode_overledene')}"></label>
            <label><span>Woonplaats</span><input type="text" name="woonplaats_overledene" value="${v('woonplaats_overledene')}"></label>
            <label class="span-3"><span>Artsverklaring (overlijdensverklaring)</span>
              <input type="hidden" name="artsverklaring_pad" value="${esc(v('artsverklaring_pad'))}">
              <div class="artsverklaring-row" id="artsverklaring-row">
                <button type="button" class="btn btn-sm" id="artsverklaring-scan" hidden>📄 Scan document</button>
                <label class="btn btn-sm" id="artsverklaring-filelabel" style="cursor:pointer;">
                  📷 Scan / kies bestand
                  <input type="file" id="artsverklaring-input" accept="image/*,application/pdf" capture="environment" hidden>
                </label>
                <span class="artsverklaring-status muted small" id="artsverklaring-status">${v('artsverklaring_pad') ? '✓ geüpload' : 'nog geen bestand'}</span>
                ${v('artsverklaring_pad') ? '<button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-view">Bekijk</button><button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-remove">Verwijder</button>' : ''}
              </div>
            </label>
            <label class="span-3"><span>Overdraagformulier</span>
              <input type="hidden" name="overdraagformulier_pad" value="${esc(v('overdraagformulier_pad'))}">
              <div class="artsverklaring-row" id="overdraag-row">
                <label class="btn btn-sm" id="overdraag-filelabel" style="cursor:pointer;">
                  📷 Scan / kies bestand
                  <input type="file" id="overdraag-input" accept="image/*,application/pdf" capture="environment" hidden>
                </label>
                <span class="artsverklaring-status muted small" id="overdraag-status">${v('overdraagformulier_pad') ? '✓ geüpload' : 'nog geen bestand'}</span>
                ${v('overdraagformulier_pad') ? '<button type="button" class="btn btn-sm btn-ghost" id="overdraag-view">Bekijk</button><button type="button" class="btn btn-sm btn-ghost" id="overdraag-remove">Verwijder</button>' : ''}
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="1">
          <legend>Bezittingen</legend>
          <p class="muted small">Streep aan welke sieraden de overledene bij zich heeft en vul het aantal in. Voeg extra bezittingen toe via de knop onderaan.</p>
          <div style="display:flex; flex-direction:column; gap:.5rem;">
            ${[
              ['bezit_oorbellen', 'Oorbel(en)'],
              ['bezit_ringen',    'Ring(en)'],
              ['bezit_armbanden', 'Armband(en)'],
            ].map(([naam, label]) => {
              const aan = dossier[naam] === 'ja';
              return `
              <div style="display:flex; flex-direction:row; align-items:center; justify-content:space-between; gap:1rem; padding:.5rem .85rem; border:1px solid var(--border,#e5e0d6); border-radius:10px; background:var(--card-bg,#fff);">
                <label style="display:flex; flex-direction:row; align-items:center; gap:.6rem; margin:0; cursor:pointer; font-weight:500; flex:1;">
                  <input type="checkbox" name="${naam}" data-aantal-row="${naam}-aantal-row" ${aan ? 'checked' : ''} style="width:1.15rem; height:1.15rem; flex:0 0 auto; accent-color:var(--primary,#2563eb);"> <span>${label}</span>
                </label>
                <span id="${naam}-aantal-row" style="display:flex; flex-direction:row; align-items:center; gap:.5rem; flex:0 0 auto;" ${aan ? '' : 'hidden'}>
                  <span class="muted small">aantal</span>
                  <input type="number" name="${naam}_aantal" min="0" inputmode="numeric" style="width:4.5rem;" value="${v(naam + '_aantal')}">
                </span>
              </div>`;
            }).join('')}
          </div>
          <div id="extra-bezit-lijst" style="display:flex; flex-direction:column; gap:.5rem; margin-top:.5rem;">
            ${(() => {
              const extras = Array.isArray(dossier.extra_bezittingen) ? dossier.extra_bezittingen : [];
              return extras.map((b, i) => `
                <div class="extra-bezit-row" style="display:flex; flex-direction:row; align-items:center; gap:.6rem; padding:.5rem .85rem; border:1px solid var(--border,#e5e0d6); border-radius:10px; background:var(--card-bg,#fff);">
                  <input type="text" class="extra-bezit-label" value="${esc(b.label || '')}" placeholder="bv. Ketting, horloge…" style="flex:1;">
                  <span class="muted small">aantal</span>
                  <input type="number" class="extra-bezit-aantal" min="0" inputmode="numeric" value="${esc(b.aantal || '')}" style="width:4.5rem;">
                  <button type="button" class="btn btn-sm btn-ghost extra-bezit-del" title="Verwijder">×</button>
                </div>`).join('');
            })()}
          </div>
          <button type="button" class="btn btn-sm" id="extra-bezit-add" style="margin-top:.5rem;">+ Extra bezitting toevoegen</button>
        </fieldset>

        <fieldset class="card" data-step="2">
          <legend>Opbaren &amp; locatie</legend>
          <div class="grid-3">
            <label><span>Ophalen of thuis opbaren?</span>
              <select name="opbaring_type" id="opbaring-type-select">
                <option value="">—</option>
                <option value="ophalen" ${sel('opbaring_type','ophalen')}>Ophalen</option>
                <option value="thuis" ${sel('opbaring_type','thuis')}>Thuis opbaren</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="2" id="opbaring-detail-fieldset" ${dossier.opbaring_type ? '' : 'hidden'}>
          <legend id="opbaring-detail-legend">${dossier.opbaring_type === 'thuis' ? 'Thuis opbaren' : (dossier.opbaring_type === 'ophalen' ? 'Ophalen' : '')}</legend>

          <!-- ── OPHALEN: meerdere locaties + eindbestemming ─────────────── -->
          <div class="opbaring-ophalen" ${dossier.opbaring_type === 'ophalen' ? '' : 'hidden'}>
            <label style="display:block;"><span>Brengen naar <span class="muted small">(één of meerdere locaties, bv. eerst ziekenhuis, daarna aula)</span></span>
              <div id="brengen-naar-lijst" style="display:flex; flex-direction:column; gap:.4rem;">
                ${(() => {
                  const arr = Array.isArray(dossier.brengen_naar) && dossier.brengen_naar.length
                    ? dossier.brengen_naar : [''];
                  return arr.map((loc, i) => `
                    <div class="brengen-naar-row" style="display:flex; gap:.5rem; align-items:center;">
                      <input type="text" class="brengen-naar-input" list="opbaarlocaties-datalist" value="${esc(loc || '')}" placeholder="bv. Aula Vale, ziekenhuis, uitvaartcentrum…" style="flex:1;">
                      <button type="button" class="btn btn-sm btn-ghost brengen-naar-del" title="Verwijder">×</button>
                    </div>`).join('');
                })()}
              </div>
              <button type="button" class="btn btn-sm" id="brengen-naar-add" style="margin-top:.4rem;">+ Locatie toevoegen</button>
            </label>
          </div>

          <!-- ── THUIS OPBAREN: datum/tijd + eindtijd + rouwgoederen ─────── -->
          <div class="opbaring-thuis" ${dossier.opbaring_type === 'thuis' ? '' : 'hidden'}>
            <div class="grid-3">
              <label><span>Startdatum</span>
                <input type="date" name="thuis_opbaren_datum" value="${v('thuis_opbaren_datum')}">
              </label>
              <label><span>Begintijd</span>
                <input type="time" name="thuis_opbaren_tijd" value="${v('thuis_opbaren_tijd')}">
              </label>
              <label><span>Einddatum</span>
                <input type="date" name="thuis_opbaren_einddatum" value="${v('thuis_opbaren_einddatum')}">
              </label>
              <label><span>Eindtijd</span>
                <input type="time" name="thuis_opbaren_eindtijd" value="${v('thuis_opbaren_eindtijd')}">
              </label>
              <label class="span-3"><span>Benodigde rouwgoederen</span>
                <div style="display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.25rem;">
                  ${(() => {
                    const opties = Settings.get('rouwgoederen_opties') || [];
                    const gekozen = Array.isArray(dossier.rouwgoederen_lijst) ? dossier.rouwgoederen_lijst : [];
                    return opties.map(g => `
                      <label style="display:flex; flex-direction:row; align-items:center; gap:.4rem; margin:0; padding:.35rem .75rem; border:1px solid var(--border,#e5e0d6); border-radius:20px; cursor:pointer; font-weight:500;">
                        <input type="checkbox" class="rouwgoed-cb" value="${esc(g)}" ${gekozen.includes(g) ? 'checked' : ''} style="width:1rem; height:1rem; accent-color:var(--primary,#2563eb);"> <span>${esc(g)}</span>
                      </label>`).join('');
                  })()}
                </div>
              </label>
            </div>
          </div>

          <!-- ── OPBAARLOCATIE (adres met suggesties uit eerdere dossiers) ─ -->
          <label style="display:block; margin-top:.75rem;"><span>Opbaarlocatie <span class="muted small">(naam, straat + huisnummer)</span></span>
            <input type="text" name="opbaarlocatie_type" list="opbaarlocaties-datalist" value="${esc(v('opbaarlocatie_type'))}" placeholder="bv. Aula Vale — Oldenzaal, of Blokfluitlaan 12">
          </label>
          <datalist id="opbaarlocaties-datalist">
            ${(() => {
              // Suggesties uit eerder gebruikte opbaarlocaties + brengen-naar entries
              const gebruikt = new Set();
              DB.list(KEYS.DOSSIERS).forEach(d => {
                if (d.opbaarlocatie_type) gebruikt.add(d.opbaarlocatie_type);
                if (Array.isArray(d.brengen_naar)) d.brengen_naar.forEach(x => x && gebruikt.add(x));
              });
              // Standaard-opties altijd meenemen
              ['Aula Vale', 'Uitvaartcentrum'].forEach(x => gebruikt.add(x));
              return [...gebruikt].sort().map(x => `<option value="${esc(x)}"></option>`).join('');
            })()}
          </datalist>
        </fieldset>

        <fieldset class="card" data-step="2">
          <legend>Kist &amp; vervoer</legend>
          <div class="grid-3">
            <label class="span-2"><span>Kist</span>
              <input type="hidden" name="kist_type" value="${esc(v('kist_type'))}">
              <div id="kist-keuze-wrap" style="display:flex; flex-direction:column; gap:.5rem;">
                <div id="kist-huidig" style="display:${v('kist_type') ? 'flex' : 'none'}; align-items:center; gap:.75rem; padding:.5rem .75rem; border:1px solid var(--border,#e5e0d6); border-radius:8px; background:#f8f6f2;">
                  <span id="kist-huidig-naam"><strong>${esc(v('kist_type'))}</strong></span>
                  <button type="button" class="btn btn-sm btn-ghost" id="kist-wissen" title="Verwijder">×</button>
                </div>
                <div id="kist-kies-knoppen" style="display:${v('kist_type') ? 'none' : 'flex'}; gap:.5rem; flex-wrap:wrap;">
                  <a href="#/kisten" class="btn btn-sm" id="kist-naar-catalogus" title="Kies uit ons assortiment">📦 Kies uit catalogus</a>
                  <button type="button" class="btn btn-sm btn-ghost" id="kist-3e-partij">✎ Kist van 3e partij (zelf invullen)</button>
                </div>
                <div id="kist-3e-invoer" style="display:none; gap:.5rem;">
                  <input type="text" id="kist-3e-input" placeholder="Naam kist (3e partij, zonder foto)" style="flex:1;">
                  <button type="button" class="btn btn-sm" id="kist-3e-ok">Opslaan</button>
                  <button type="button" class="btn btn-sm btn-ghost" id="kist-3e-annuleer">Annuleer</button>
                </div>
              </div>
              <span id="kist-voorraad-hint" class="muted small" style="display:block;margin-top:.25rem;min-height:1.1em;"></span>
            </label>
            <label><span>Rouwauto</span>
              ${(() => {
                const opties = Settings.get('rouwauto_lijst') || [];
                const huidig = v('rouwauto');
                return `<select name="rouwauto">
                  <option value="">— geen rouwauto —</option>
                  ${opties.map(o => `<option value="${esc(o)}" ${huidig === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
                  ${huidig && !opties.includes(huidig) && !['ja','nee'].includes(huidig) ? `<option value="${esc(huidig)}" selected>${esc(huidig)} (niet in lijst)</option>` : ''}
                </select>${opties.length === 0 ? '<span class="muted small" style="display:block;margin-top:.25rem;">Voeg rouwauto&rsquo;s toe in <a href="#/account">Account</a>.</span>' : ''}`;
              })()}
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="3">
          <legend>Kosten</legend>
          <h3 style="margin:0 0 .5rem;">Kostenoverzicht</h3>
          <div id="wizard-kosten-mount"></div>
        </fieldset>

        <fieldset class="card" data-step="4">
          <legend>Bijzonderheden</legend>
          <label class="full"><span>Notities / wensen familie</span>
            <textarea name="bijzonderheden" rows="5">${v('bijzonderheden')}</textarea>
          </label>
        </fieldset>

        <div class="form-actions wizard-actions">
          <a href="${isNew ? '#/dossiers' : '#/dossiers/' + dossier.id}" class="btn btn-ghost" id="btn-back-form" title="Terug — je concept blijft bewaard">← Terug naar dossiers</a>
          <div class="wizard-actions-right">
            <button type="button" class="btn btn-ghost" id="btn-wizard-prev" hidden>← Vorige</button>
            <button type="button" class="btn btn-primary" id="btn-wizard-next">Verder →</button>
            <button type="submit" class="btn btn-primary" id="btn-wizard-submit" hidden>${isNew ? 'Dossier aanmaken' : 'Wijzigingen opslaan'}</button>
          </div>
        </div>
      </form>
    </div>`;

  // ─── Wizard: stappen tonen één voor één ──────────────────────────────
  const TOTAL_STEPS = 4;
  const stepKey = `sok_wizard_step_${isNew ? 'nieuw' : dossier.id}`;
  const maxKey  = `sok_wizard_max_${isNew ? 'nieuw' : dossier.id}`;
  // Als er géén concept (draft) bewaard is, wissen we eerder onthouden
  // stap-voortgang — een vers formulier hoort weer met grijze cirkels te
  // beginnen. Bij wél een draft (resumed sessie) blijven de cirkels staan.
  const _draftKeyEarly = dossierDraftKey(isNew, dossier.id);
  if (!localStorage.getItem(_draftKeyEarly)) {
    try {
      localStorage.removeItem(stepKey);
      localStorage.removeItem(maxKey);
    } catch (_) {}
  }
  let currentStep = (() => {
    try {
      const saved = parseInt(localStorage.getItem(stepKey), 10);
      return (saved >= 1 && saved <= TOTAL_STEPS) ? saved : 1;
    } catch (_) { return 1; }
  })();
  // Tot welke stap is de gebruiker geweest? Stappen >= maxStepReached
  // hebben nog geen kleur — alleen stappen die de gebruiker echt voorbij
  // is gelopen tonen rood/oranje/groen.
  let maxStepReached = (() => {
    try {
      const saved = parseInt(localStorage.getItem(maxKey), 10);
      return (saved >= 1 && saved <= TOTAL_STEPS) ? saved : currentStep;
    } catch (_) { return currentStep; }
  })();

  // Aanbevolen velden per stap — bepalen kleur (rood/oranje/groen)
  const STEP_FIELDS = {
    1: ['opdrachtgever_naam','achternaam','voornaam','geboortedatum','overlijdensdatum',
        'adres_overledene','postcode_overledene','woonplaats_overledene'],
    2: ['opbaring_type'],
    3: [], // kosten + kist via catalogus-pagina, geen verplichte velden
    4: [],  // bijzonderheden is volledig optioneel
  };

  const fillStateForStep = (step) => {
    const form = document.getElementById('dossier-form');
    if (!form) return 'empty';
    const fd = new FormData(form);
    const isFilled = name => {
      const v = fd.get(name);
      return v != null && String(v).trim() !== '';
    };

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
      el.classList.remove('fill-empty','fill-partial','fill-complete');
      // Alleen stappen die de gebruiker écht voorbij is laten kleuren.
      // De huidige stap en alle stappen daarna blijven grijs (default).
      if (step < maxStepReached) {
        el.classList.add('fill-' + fillStateForStep(step));
      }
    });
  };

  const showStep = (n) => {
    currentStep = Math.max(1, Math.min(TOTAL_STEPS, n));
    // Markeer als "voorbij" zodra een hogere stap geopend wordt
    if (currentStep > maxStepReached) maxStepReached = currentStep;
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
    try {
      localStorage.setItem(stepKey, String(currentStep));
      localStorage.setItem(maxKey,  String(maxStepReached));
    } catch (_) {}
    updateStepColors();
    // Opbaren-detailsectie (blauw kopje met gekozen optie) synchroniseren
    if (currentStep === 2 && typeof updateOpbaring === 'function') updateOpbaring();
  };

  document.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => showStep(parseInt(el.dataset.go, 10)));
  });
  document.getElementById('btn-wizard-prev').addEventListener('click', () => showStep(currentStep - 1));
  document.getElementById('btn-wizard-next').addEventListener('click', () => showStep(currentStep + 1));

  // Ophalen / thuis opbaren → dynamisch blauw kopje met de gekozen optie,
  // met de bijbehorende vervolgvragen (waar voorheen 'Uitvaart' stond).
  function updateOpbaring() {
    const sel = document.getElementById('opbaring-type-select');
    const fs = document.getElementById('opbaring-detail-fieldset');
    const lg = document.getElementById('opbaring-detail-legend');
    if (!sel || !fs) return;
    const val = sel.value;
    if (!val) { fs.hidden = true; return; }
    fs.hidden = false;
    if (lg) lg.textContent = val === 'thuis' ? 'Thuis opbaren' : 'Ophalen';
    fs.querySelectorAll('.opbaring-ophalen').forEach(e => { e.hidden = (val !== 'ophalen'); });
    fs.querySelectorAll('.opbaring-thuis').forEach(e => { e.hidden = (val !== 'thuis'); });
  }
  const opbaringSel = document.getElementById('opbaring-type-select');
  if (opbaringSel) {
    opbaringSel.addEventListener('change', () => { updateOpbaring(); updateStepColors(); });
  }
  updateOpbaring();

  // ── Brengen naar (bij ophalen): + / − knoppen ─────────────────────────────
  (function initBrengenNaar() {
    const lijstEl = document.getElementById('brengen-naar-lijst');
    const addBtn = document.getElementById('brengen-naar-add');
    if (!lijstEl || !addBtn) return;
    const maakRij = (val = '') => {
      const div = document.createElement('div');
      div.className = 'brengen-naar-row';
      div.style.cssText = 'display:flex; gap:.5rem; align-items:center;';
      div.innerHTML = `
        <input type="text" class="brengen-naar-input" list="opbaarlocaties-datalist" value="${esc(val)}" placeholder="bv. Aula Vale, ziekenhuis, uitvaartcentrum…" style="flex:1;">
        <button type="button" class="btn btn-sm btn-ghost brengen-naar-del" title="Verwijder">×</button>`;
      return div;
    };
    addBtn.addEventListener('click', () => {
      lijstEl.appendChild(maakRij());
      lijstEl.lastElementChild.querySelector('input').focus();
    });
    lijstEl.addEventListener('click', (e) => {
      const del = e.target.closest('.brengen-naar-del');
      if (!del) return;
      const rijen = lijstEl.querySelectorAll('.brengen-naar-row');
      if (rijen.length > 1) del.closest('.brengen-naar-row').remove();
      else del.closest('.brengen-naar-row').querySelector('input').value = '';
    });
  })();

  // ── Kist-keuze: catalogus-knop / 3e partij inline invoer ──────────────────
  (function initKistKeuze() {
    const hidden = document.querySelector('input[type="hidden"][name="kist_type"]');
    const huidig = document.getElementById('kist-huidig');
    const huidigNaam = document.getElementById('kist-huidig-naam');
    const kies = document.getElementById('kist-kies-knoppen');
    const wissen = document.getElementById('kist-wissen');
    const invoer = document.getElementById('kist-3e-invoer');
    const invoerInput = document.getElementById('kist-3e-input');
    const partijBtn = document.getElementById('kist-3e-partij');
    const okBtn = document.getElementById('kist-3e-ok');
    const anBtn = document.getElementById('kist-3e-annuleer');
    const naarCat = document.getElementById('kist-naar-catalogus');
    if (!hidden || !huidig || !kies) return;

    const zetKist = (naam) => {
      hidden.value = naam || '';
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      if (naam) {
        huidigNaam.innerHTML = `<strong>${esc(naam)}</strong>`;
        huidig.style.display = 'flex';
        kies.style.display = 'none';
      } else {
        huidig.style.display = 'none';
        kies.style.display = 'flex';
      }
      if (invoer) invoer.style.display = 'none';
      if (typeof syncAutoKostKist === 'function') syncAutoKostKist(naam || '');
    };
    if (wissen) wissen.addEventListener('click', () => zetKist(''));
    if (partijBtn) partijBtn.addEventListener('click', () => {
      invoer.style.display = 'flex';
      kies.style.display = 'none';
      if (invoerInput) invoerInput.focus();
    });
    if (okBtn) okBtn.addEventListener('click', () => {
      const v = (invoerInput.value || '').trim();
      if (!v) return;
      zetKist(v);
      invoerInput.value = '';
    });
    if (invoerInput) invoerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
    });
    if (anBtn) anBtn.addEventListener('click', () => {
      invoer.style.display = 'none';
      kies.style.display = 'flex';
      invoerInput.value = '';
    });
    // Als beheerder terugkomt van /kisten met een gekozen kist, wordt de kist
    // via localStorage-draft ingesteld (syncAutoKostKist ziet dat al). Bij
    // draft-restore werkt de UI dan al bij op basis van hidden-value.
    // Voor de zekerheid: luister op storage-events zoals de rest.
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith('sok_draft_')) return;
      try {
        const cur = JSON.parse(localStorage.getItem(e.key) || '{}');
        if (cur.kist_type && cur.kist_type !== hidden.value) zetKist(cur.kist_type);
      } catch (_) {}
    });
  })();

  // ── Extra bezittingen: + / − ───────────────────────────────────────────────
  (function initExtraBezit() {
    const lijst = document.getElementById('extra-bezit-lijst');
    const addBtn = document.getElementById('extra-bezit-add');
    if (!lijst || !addBtn) return;
    const maakRij = (label = '', aantal = '') => {
      const div = document.createElement('div');
      div.className = 'extra-bezit-row';
      div.style.cssText = 'display:flex; flex-direction:row; align-items:center; gap:.6rem; padding:.5rem .85rem; border:1px solid var(--border,#e5e0d6); border-radius:10px; background:var(--card-bg,#fff);';
      div.innerHTML = `
        <input type="text" class="extra-bezit-label" value="${esc(label)}" placeholder="bv. Ketting, horloge…" style="flex:1;">
        <span class="muted small">aantal</span>
        <input type="number" class="extra-bezit-aantal" min="0" inputmode="numeric" value="${esc(aantal)}" style="width:4.5rem;">
        <button type="button" class="btn btn-sm btn-ghost extra-bezit-del" title="Verwijder">×</button>`;
      return div;
    };
    addBtn.addEventListener('click', () => {
      lijst.appendChild(maakRij());
      lijst.lastElementChild.querySelector('.extra-bezit-label').focus();
    });
    lijst.addEventListener('click', (e) => {
      const del = e.target.closest('.extra-bezit-del');
      if (del) del.closest('.extra-bezit-row').remove();
    });
  })();

  // Bezittingen: aantal-veld tonen zodra het sieraad is aangevinkt
  document.querySelectorAll('input[type="checkbox"][data-aantal-row]').forEach(cb => {
    const row = document.getElementById(cb.getAttribute('data-aantal-row'));
    if (!row) return;
    const upd = () => { row.hidden = !cb.checked; };
    cb.addEventListener('change', () => { upd(); updateStepColors(); });
    upd();
  });

  // Graf-type → grafnummer pas tonen na keuze; certificaatnummer bij familiegraf
  const grafTypeSel = document.getElementById('graf-type-select');
  const grafNrRow = document.getElementById('grafnummer-row');
  const certRow = document.getElementById('certificaat-row');
  const updateGrafnummerRow = () => {
    if (!grafTypeSel) return;
    if (grafNrRow) grafNrRow.hidden = !grafTypeSel.value;
    if (certRow)   certRow.hidden   = grafTypeSel.value !== 'familiegraf';
  };
  if (grafTypeSel) {
    grafTypeSel.addEventListener('change', updateGrafnummerRow);
    updateGrafnummerRow();
  }

  // ─── Kostenoverzicht in de wizard (stap 3) ─────────────────────────
  // Voor bestaande dossiers: live beheer van de kosten-tabel. Voor nieuwe
  // dossiers: hint dat het kan zodra het dossier is aangemaakt.
  // Voor nieuwe dossiers bufferen we de kosten lokaal (geen dossier_id nog).
  // Persistent in localStorage zodat ze een refresh overleven; bij opslaan
  // worden ze in de echte kosten-tabel geschreven.
  const kostenBufKey = `sok_kosten_buffer_${isNew ? 'nieuw' : dossier.id}`;
  let kostenBuffer = (() => {
    if (!isNew) return null;
    try { return JSON.parse(localStorage.getItem(kostenBufKey) || '[]'); } catch (_) { return []; }
  })();
  const saveBuffer = () => {
    if (!isNew) return;
    try { localStorage.setItem(kostenBufKey, JSON.stringify(kostenBuffer)); } catch (_) {}
  };

  function renderWizardKosten() {
    const mount = document.getElementById('wizard-kosten-mount');
    if (!mount) return;
    const adminMode = !!Settings.get('catalog_admin_mode');

    // Bron: buffer (nieuw) of live DB (bestaand). Sorteren op de vaste
    // KOSTEN_PRESETS-volgorde (zelfde als 'Snel toevoegen'-lijst).
    // Posten zonder match (kist, bloemen, eten, extra) sorteren op basis
    // van prefix-categorie; alles wat daar niet bij past achter aan
    // op insert-volgorde (id).
    const presetIndex = new Map();
    KOSTEN_PRESETS.forEach((p, i) => { if (!p.nav) presetIndex.set(p.omschrijving, i); });
    const KIST_TAG = 'Kist: ', BLOEM_TAG = '🌸 ', ETEN_TAG = '🍽 ';
    const NAV_AFTER = {
      [KIST_TAG]:  KOSTEN_PRESETS.findIndex(p => p.nav === 'kist'),
      [BLOEM_TAG]: KOSTEN_PRESETS.findIndex(p => p.nav === 'bloemen'),
      [ETEN_TAG]:  KOSTEN_PRESETS.findIndex(p => p.nav === 'eten'),
    };
    function sortRank(k) {
      const oms = k.omschrijving || '';
      if (presetIndex.has(oms)) return [presetIndex.get(oms) * 10, 0];
      for (const tag in NAV_AFTER) {
        if (oms.startsWith(tag)) return [NAV_AFTER[tag] * 10 + 5, 0];
      }
      // Onbekende handmatige posten helemaal aan het eind, in insert-volgorde
      const id = typeof k.id === 'string' ? parseInt(k.id.replace('_buf_', ''), 10) : Number(k.id) || 0;
      return [KOSTEN_PRESETS.length * 10 + 100, id];
    }
    const kostenRaw = isNew
      ? kostenBuffer.map((k, i) => Object.assign({ id: '_buf_' + i }, k))
      : DB.where(KEYS.KOSTEN, k => k.dossier_id === dossier.id);
    const kosten = kostenRaw
      .map(k => Object.assign({}, k, { _rank: sortRank(k) }))
      .sort((a, b) => {
        if (a._rank[0] !== b._rank[0]) return a._rank[0] - b._rank[0];
        return a._rank[1] - b._rank[1];
      });
    // Medewerkers mogen geen prijzen zien en geen kosten beheren (server-side
    // afgedwongen). Toon een alleen-lezen lijst zonder bedragen en zonder
    // schrijf-acties; aftikken kan in het dossier zelf.
    const kanKosten = (typeof Auth === 'undefined') || Auth.isBeheerder();
    if (!kanKosten) {
      mount.innerHTML = `
        ${kosten.length === 0
          ? '<p class="muted small">Nog geen kostenposten.</p>'
          : `<table class="table wizard-kosten-table">
              <thead><tr><th>Omschrijving</th><th>Categorie</th><th class="num">Aantal</th><th></th></tr></thead>
              <tbody>${kosten.map(k => {
                const aantal = Number(k.aantal) || 1;
                return `<tr>
                  <td>${esc(k.omschrijving)}</td>
                  <td class="muted small">${esc(categorieLabel(k.categorie))}</td>
                  <td class="num">${aantal}</td>
                  <td>${k.betaald ? '<span class="badge badge-green" title="Afgevinkt">✓</span>' : ''}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>`}
        <p class="muted small" style="margin-top:.5rem;">Bedragen en het beheren van kostenposten zijn voorbehouden aan de beheerder. Aftikken kan in het dossier zelf.</p>`;
      return;
    }

    const totaal = kosten.reduce((s,k) => s + (Number(k.bedrag)||0), 0);
    const betaald = kosten.filter(k => k.betaald).reduce((s,k) => s + (Number(k.bedrag)||0), 0);
    const open = Math.max(0, totaal - betaald);

    const allesBetaald = kosten.length > 0 && kosten.every(k => k.betaald);
    mount.innerHTML = `
      ${kosten.length === 0 ? '<p class="muted small">Nog geen kostenposten. Voeg toe via een snelknop of handmatig hieronder.</p>' : `
      <table class="table wizard-kosten-table">
        <thead><tr><th>Omschrijving</th><th>Categorie</th><th class="num">Aantal</th><th class="num">Bedrag</th><th></th></tr></thead>
        <tbody>
          ${kosten.map(k => {
            const aantal = Number(k.aantal) || 1;
            const stuk = aantal > 0 ? (Number(k.bedrag) || 0) / aantal : 0;
            return `<tr>
              <td>${esc(k.omschrijving)}${aantal !== 1 ? ` <span class="muted small">(${fmtEUR(stuk)} per stuk)</span>` : ''}</td>
              <td class="muted small">${esc(categorieLabel(k.categorie))}</td>
              <td class="num">${aantal}</td>
              <td class="num">${fmtEUR(k.bedrag)}</td>
              <td><button type="button" class="btn-icon" data-wk-del="${k.id}" title="Verwijderen">×</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="wizard-kosten-totals">
        <span>Totaal factuur: <strong>${fmtEUR(totaal)}</strong></span>
        <button type="button" class="kost-toggle kost-toggle-big ${allesBetaald ? 'on-betaald' : 'off-betaald'}" id="wk-status-toggle">
          ${allesBetaald ? '✓ Volledig betaald' : '○ Nog open'}
        </button>
      </div>`}
      ${isNew && kosten.length === 0 ? '<button type="button" class="btn btn-sm btn-ghost" id="wk-fill-standaard" style="margin-top:.5rem;">+ Alle standaardposten toevoegen</button>' : ''}

      <section class="wizard-kosten-presets" id="wk-presets-details" style="margin-top:.85rem;">
        <h4 class="wizard-kosten-presets-title">Snel toevoegen uit standaardlijst</h4>
        ${adminMode ? '<p class="muted small" style="margin:.25rem 0 0;">Beheermodus aan — klik op het potlood om een prijs aan te passen of op de prullenbak om een post uit de lijst te verbergen.</p>' : ''}
        <div class="wizard-preset-grid">
          ${effectieveKostenPresets({ includeHidden: adminMode }).map((p, i) => {
            const cls = 'btn btn-sm btn-ghost wizard-preset-btn'
              + (p.nav ? ' wizard-preset-nav wizard-preset-nav-' + p.nav : '')
              + (p._hidden ? ' is-hidden-preset' : '');
            const prijsTekst = p.vraagPrijs
              ? `± ${fmtEUR(p.bedrag || 0)}`
              : `${fmtEUR(p.bedrag)}${p._customBedrag ? ' ✏️' : ''}`;
            const prijs = (p.bedrag != null && p.bedrag !== '')
              ? `<span class="muted small">${prijsTekst}</span>`
              : (p.nav ? '<span class="muted small">→</span>' : '');
            const adminCtrls = (adminMode && !p.nav)
              ? `<span class="wizard-preset-admin">
                  <button type="button" class="wizard-preset-edit" data-wk-edit="${i}" title="Prijs aanpassen">✏️</button>
                  ${p._hidden
                    ? `<button type="button" class="wizard-preset-show" data-wk-show="${i}" title="Herstel kostenpost">↺</button>`
                    : `<button type="button" class="wizard-preset-hide" data-wk-hide="${i}" title="Verwijder uit lijst">🗑</button>`}
                </span>`
              : '';
            return `<span class="wizard-preset-wrap">
              <button type="button" class="${cls}" data-wk-preset="${i}" ${p._hidden ? 'disabled' : ''}>
                <span class="wizard-preset-omschrijving">${esc(p.omschrijving)}${p.food ? ' <span class="badge badge-amber" title="Aantal wordt gevraagd bij toevoegen">×N</span>' : ''}${p.vraagPrijs ? ' <span class="badge badge-amber" title="Richtprijs — werkelijk bedrag wordt gevraagd">±</span>' : ''}</span>
                ${prijs}
              </button>
              ${adminCtrls}
            </span>`;
          }).join('')}
        </div>
      </section>

      <div class="wizard-kosten-add">
        <input type="text" id="wk-omschrijving" placeholder="Omschrijving">
        <select id="wk-categorie">
          <option value="">Categorie</option>
          ${KOSTEN_CATEGORIEEN.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}
        </select>
        <input type="number" id="wk-aantal" placeholder="Aantal" min="1" step="1" inputmode="numeric" value="1" style="max-width:80px;">
        <input type="text" id="wk-bedrag" placeholder="Prijs per stuk" inputmode="decimal" style="max-width:130px;">
        <button type="button" class="btn btn-sm" id="wk-add-btn">+ Toevoegen</button>
      </div>`;

    // ── Actie: dossier-level betaald-status (toggle alle posten ineens) ──
    const statusBtn = mount.querySelector('#wk-status-toggle');
    if (statusBtn) statusBtn.addEventListener('click', async () => {
      const nieuw = !allesBetaald;
      if (isNew) {
        kostenBuffer.forEach(k => { k.betaald = nieuw; });
        saveBuffer(); renderWizardKosten();
      } else {
        try {
          await Promise.all(kosten.map(k => DB.update(KEYS.KOSTEN, k.id, { betaald: nieuw })));
          await DB.touchDossier(dossier.id); renderWizardKosten();
        } catch (_) {}
      }
    });
    // ── Acties: verwijderen ──
    mount.querySelectorAll('[data-wk-del]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.wkDel;
        if (isNew) {
          const i = parseInt(id.replace('_buf_', ''), 10);
          kostenBuffer.splice(i, 1); saveBuffer(); renderWizardKosten();
        } else {
          const ok = await Modal.confirm({ title: 'Kostenpost verwijderen?', message: 'Deze actie kan niet ongedaan worden gemaakt.', confirmText: 'Verwijderen' });
          if (!ok) return;
          try { await DB.remove(KEYS.KOSTEN, parseInt(id, 10)); await DB.touchDossier(dossier.id); renderWizardKosten(); } catch (_) {}
        }
      });
    });
    // ── Acties: preset toevoegen ──
    const addPreset = async (p) => {
      let aantal = 1;
      let bedrag = p.bedrag;
      // 'vraagPrijs'-items (zoals Koffie/thee/water) hebben een richtprijs
      // die per dossier verschilt — vraag het werkelijke bedrag.
      if (p.vraagPrijs) {
        const input = window.prompt(
          `Wat heeft "${p.omschrijving}" gekost? (richtprijs — vul het werkelijke bedrag in €)`,
          ''
        );
        if (input == null) return;
        bedrag = parseEUR(input);
        if (!isFinite(bedrag) || bedrag < 0) {
          Modal.show({ type: 'warning', title: 'Ongeldig bedrag', message: 'Vul een geldig bedrag in (bv. 45,00).' });
          return;
        }
      } else if (p.food) {
        // Voor 'eten'-items vragen we eerst hoeveel — totaal = aantal × prijs.
        const stuk = Number(p.bedrag) || 0;
        const input = window.prompt(
          `Hoeveel ${p.omschrijving}? (prijs per stuk: ${fmtEUR(stuk)})`,
          '1'
        );
        if (input == null) return;
        aantal = parseInt(String(input).trim(), 10);
        if (!isFinite(aantal) || aantal < 1) {
          Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' });
          return;
        }
        bedrag = +((stuk * aantal).toFixed(2));
      }
      if (isNew) {
        kostenBuffer.push({ omschrijving: p.omschrijving, categorie: p.categorie, bedrag, aantal, betaald: false });
        saveBuffer(); renderWizardKosten();
      } else {
        try { await DB.insert(KEYS.KOSTEN, { dossier_id: dossier.id, omschrijving: p.omschrijving, categorie: p.categorie, bedrag, aantal, betaald: false }); await DB.touchDossier(dossier.id); renderWizardKosten(); } catch (_) {}
      }
    };
    const presetList = effectieveKostenPresets({ includeHidden: adminMode });
    mount.querySelectorAll('[data-wk-preset]').forEach(b => {
      b.addEventListener('click', () => {
        const p = presetList[parseInt(b.dataset.wkPreset, 10)];
        if (!p) return;
        // Navigatie-tegels (Kist / Bloemen / Extra) hebben geen vaste prijs;
        // ze leiden de gebruiker naar een andere pagina of focussen het
        // 'eigen invoer'-veld.
        if (p.nav === 'kist')    { Router.go('/kisten');  return; }
        if (p.nav === 'bloemen') { Router.go('/bloemen'); return; }
        if (p.nav === 'eten')    { Router.go('/eten');    return; }
        if (p.nav === 'extra') {
          const oms = mount.querySelector('#wk-omschrijving');
          const add = mount.querySelector('.wizard-kosten-add');
          if (add) add.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (oms) setTimeout(() => { try { oms.focus(); } catch (_) {} }, 250);
          return;
        }
        addPreset(p);
      });
    });
    // ── Beheermodus: prijs aanpassen, verbergen, weer tonen ──
    function _patchKostOverride(omschrijving, patch) {
      const cur = Object.assign({}, Settings.get('kosten_overrides') || {});
      const entry = Object.assign({}, cur[omschrijving] || {}, patch);
      if (entry.bedrag == null) delete entry.bedrag;
      if (!entry.hidden)        delete entry.hidden;
      if (Object.keys(entry).length === 0) delete cur[omschrijving];
      else                                  cur[omschrijving] = entry;
      Settings.set({ kosten_overrides: cur });
    }
    mount.querySelectorAll('[data-wk-edit]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const p = presetList[parseInt(b.dataset.wkEdit, 10)];
        if (!p) return;
        const huidig = p.bedrag != null ? (Number(p.bedrag) || 0).toFixed(2).replace('.', ',') : '';
        const input = window.prompt(
          `Nieuwe prijs voor "${p.omschrijving}" (€).\nLaat leeg en druk OK om de standaardprijs te herstellen.`,
          huidig
        );
        if (input == null) return; // Annuleren
        if (input.trim() === '') {
          _patchKostOverride(p.omschrijving, { bedrag: null });
        } else {
          const bedrag = parseEUR(input);
          if (!isFinite(bedrag) || bedrag < 0) {
            Modal.show({ type: 'warning', title: 'Ongeldige prijs', message: 'Vul een geldig bedrag in (bv. 1234,56).' });
            return;
          }
          _patchKostOverride(p.omschrijving, { bedrag });
        }
        renderWizardKosten();
      });
    });
    mount.querySelectorAll('[data-wk-hide]').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const p = presetList[parseInt(b.dataset.wkHide, 10)];
        if (!p) return;
        const ok = await Modal.confirm({
          type: 'warning',
          title: 'Kostenpost verwijderen?',
          message: `"${p.omschrijving}" wordt definitief uit de snel-toevoeg-lijst verwijderd. Bestaande kostenposten in dossiers blijven staan. Je kunt 'm later eventueel herstellen via de "↺"-knop in beheermodus.`,
          confirmText: 'Verwijderen',
          cancelText: 'Annuleren',
        });
        if (!ok) return;
        _patchKostOverride(p.omschrijving, { hidden: true });
        renderWizardKosten();
      });
    });
    mount.querySelectorAll('[data-wk-show]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const p = presetList[parseInt(b.dataset.wkShow, 10)];
        if (!p) return;
        _patchKostOverride(p.omschrijving, { hidden: false });
        renderWizardKosten();
      });
    });
    // ── Acties: alle standaardposten in één keer (alleen nieuw) ──
    const fillBtn = mount.querySelector('#wk-fill-standaard');
    if (fillBtn) fillBtn.addEventListener('click', () => {
      // Navigatie-tegels (kist/bloemen/extra) overslaan — die hebben geen prijs
      KOSTEN_PRESETS.filter(p => !p.nav).forEach(p =>
        kostenBuffer.push({ omschrijving: p.omschrijving, categorie: p.categorie, bedrag: p.bedrag, aantal: 1, betaald: false }));
      saveBuffer(); renderWizardKosten();
    });
    // ── Acties: handmatig toevoegen (met aantal × prijs per stuk) ──
    const addBtn = mount.querySelector('#wk-add-btn');
    if (addBtn) addBtn.addEventListener('click', async () => {
      const oms = mount.querySelector('#wk-omschrijving').value.trim();
      if (!oms) { Modal.show({ type: 'warning', title: 'Omschrijving nodig', message: 'Vul een omschrijving in.' }); return; }
      const cat = mount.querySelector('#wk-categorie').value || null;
      const aantal = parseInt(mount.querySelector('#wk-aantal').value, 10);
      if (!isFinite(aantal) || aantal < 1) { Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' }); return; }
      const stuk = parseEUR(mount.querySelector('#wk-bedrag').value);
      const bedrag = +(stuk * aantal).toFixed(2);
      if (isNew) {
        kostenBuffer.push({ omschrijving: oms, categorie: cat, bedrag, aantal, betaald: false });
        saveBuffer(); renderWizardKosten();
      } else {
        try { await DB.insert(KEYS.KOSTEN, { dossier_id: dossier.id, omschrijving: oms, categorie: cat, bedrag, aantal, betaald: false }); await DB.touchDossier(dossier.id); renderWizardKosten(); } catch (_) {}
      }
    });
  }
  renderWizardKosten();

  // ─── Kist auto-syncen naar kosten ───────────────────────────────────
  // Kist = single-select per dossier; bij wijziging vervangen we de
  // oude auto-post door de nieuwe. Bloemen werken additief en gaan
  // rechtstreeks via /bloemen in de kostenposten.
  const KIST_PREFIX = 'Kist: ';

  async function syncAutoKost(prefix, categorie, naam, bedrag) {
    // Medewerkers beheren geen kosten (server-side geblokkeerd) — auto-kosten
    // overslaan zodat er geen mislukte schrijfacties/foutmeldingen ontstaan.
    if (typeof Auth !== 'undefined' && !Auth.isBeheerder()) { renderWizardKosten(); return; }
    if (isNew) {
      // Verwijder eerdere auto-post uit buffer
      kostenBuffer = kostenBuffer.filter(k => !(k.omschrijving || '').startsWith(prefix));
      if (naam && naam !== 'anders' && bedrag != null) {
        kostenBuffer.push({
          omschrijving: prefix + naam,
          categorie,
          bedrag,
          aantal: 1,
          betaald: false,
        });
      }
      saveBuffer();
      renderWizardKosten();
    } else {
      // Bestaand dossier: oude auto-posten verwijderen uit DB
      const oude = DB.where(KEYS.KOSTEN, k =>
        k.dossier_id === dossier.id && (k.omschrijving || '').startsWith(prefix));
      for (const k of oude) {
        try { await DB.remove(KEYS.KOSTEN, k.id); } catch (_) {}
      }
      if (naam && naam !== 'anders' && bedrag != null) {
        try {
          await DB.insert(KEYS.KOSTEN, {
            dossier_id: dossier.id,
            omschrijving: prefix + naam,
            categorie,
            bedrag,
            aantal: 1,
            betaald: false,
          });
        } catch (_) {}
      }
      try { await DB.touchDossier(dossier.id); } catch (_) {}
      renderWizardKosten();
    }
  }

  function syncAutoKostKist(naam) {
    if (!naam || naam === 'anders') { syncAutoKost(KIST_PREFIX, 'kist', null, null); return; }
    const k = vindKist(naam);
    syncAutoKost(KIST_PREFIX, 'kist', naam, k ? Number(k.bedrag) : null);
  }
  // Eerste-keer init voor de KIST (single-select sync via hidden input).
  // Bloemen werken additief en gaan rechtstreeks via /bloemen in de
  // kostenposten — geen sync nodig.
  function _kistHiddenVal()  { return ($('input[name="kist_type"]')?.value || '').trim(); }
  (function initAutoKosten() {
    const huidigeKist = _kistHiddenVal();
    if (huidigeKist) {
      const lijst = isNew ? kostenBuffer
                          : DB.where(KEYS.KOSTEN, k => k.dossier_id === dossier.id);
      const alAanwezig = lijst.some(k => (k.omschrijving || '').startsWith(KIST_PREFIX));
      if (!alAanwezig) syncAutoKostKist(huidigeKist);
    }
  })();

  // Voorraad-hint bij de kist-input (alleen beheerder — medewerker heeft
  // sowieso geen voorraadgegevens in cache dankzij RLS).
  (function initKistVoorraadHint() {
    const kistInp2 = $('input[name="kist_type"]');
    const hint = $('#kist-voorraad-hint');
    if (!kistInp2 || !hint) return;
    if (typeof Auth !== 'undefined' && !Auth.isBeheerder()) return;
    if (typeof KistVoorraad === 'undefined') return;
    const update = () => {
      const naam = (kistInp2.value || '').trim();
      if (!naam) { hint.textContent = ''; hint.removeAttribute('data-tone'); return; }
      const r = KistVoorraad.byNaam(naam);
      if (!r) { hint.textContent = 'Geen voorraadgegevens voor deze kist.'; hint.setAttribute('data-tone', 'onbekend'); return; }
      const aant = r.aantal || 0, min = r.min_aantal || 0;
      if (aant === 0) { hint.textContent = `⚠ Voorraad: 0 — deze kist is niet op voorraad.`; hint.setAttribute('data-tone', 'leeg'); }
      else if (aant < min) { hint.textContent = `⚠ Voorraad: ${aant} (onder minimum ${min}) — bijbestellen aanbevolen.`; hint.setAttribute('data-tone', 'laag'); }
      else { hint.textContent = `✓ Voorraad: ${aant} beschikbaar.`; hint.setAttribute('data-tone', 'ok'); }
    };
    kistInp2.addEventListener('input', update);
    kistInp2.addEventListener('change', update);
    update();
  })();
  // Storage-event: alleen kist-veld syncen (bloem is additief).
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('sok_draft_')) return;
    const draftKey = dossierDraftKey(isNew, dossier.id);
    if (e.key !== draftKey) return;
    try {
      const draft = JSON.parse(e.newValue || '{}');
      if (draft.kist_type) {
        const kistInp = $('input[name="kist_type"]');
        if (kistInp && kistInp.value !== draft.kist_type) {
          kistInp.value = draft.kist_type;
          syncAutoKostKist(draft.kist_type);
        }
      }
    } catch (_) {}
  });

  // Artsverklaring scan/upload
  const avInput = document.getElementById('artsverklaring-input');
  const avHidden = document.querySelector('input[name="artsverklaring_pad"]');
  const avRow = document.getElementById('artsverklaring-row');
  const avStatus = document.getElementById('artsverklaring-status');
  const avScan = document.getElementById('artsverklaring-scan');

  // Gedeelde upload — gebruikt door zowel de file-input als de camera-scan.
  async function doArtsUpload(file) {
    if (!file) return;
    if (!navigator.onLine) {
      Modal.show({ type: 'offline', title: 'Geen internet', message: 'Uploaden kan alleen met internetverbinding.' });
      return;
    }
    avStatus.textContent = 'Bezig met uploaden...';
    try {
      const path = await ArtsVerklaring.upload(file);
      const old = avHidden.value;
      if (old && old !== path) ArtsVerklaring.remove(old);
      avHidden.value = path;
      avHidden.dispatchEvent(new Event('input', { bubbles: true }));
      avStatus.textContent = '✓ geüpload';
      if (!document.getElementById('artsverklaring-view')) {
        avRow.insertAdjacentHTML('beforeend',
          '<button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-view">Bekijk</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-remove">Verwijder</button>');
        bindArtsverklaringButtons();
      }
    } catch (_) {
      avStatus.textContent = 'upload mislukt';
    }
  }

  if (avInput) {
    avInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      await doArtsUpload(file);
      avInput.value = '';
    });
  }

  // Native camera-scan (alleen in de iOS-app): open de native camera met
  // bijsnijden en upload de foto via dezelfde weg als de file-input.
  if (avScan && typeof Native !== 'undefined' && Native.isApp && Native.isApp()) {
    avScan.hidden = false;
    // In de app alleen de echte Apple-scanner — "Scan / kies bestand" weg.
    const fileLabel = document.getElementById('artsverklaring-filelabel');
    if (fileLabel) fileLabel.hidden = true;
    avScan.addEventListener('click', async () => {
      avStatus.textContent = 'Scanner openen...';
      const file = await Native.scanDocument();
      if (!file) { avStatus.textContent = avHidden.value ? '✓ geüpload' : 'nog geen bestand'; return; }
      await doArtsUpload(file);
    });
  }
  function bindArtsverklaringButtons() {
    const viewBtn = document.getElementById('artsverklaring-view');
    const remBtn = document.getElementById('artsverklaring-remove');
    if (viewBtn) viewBtn.addEventListener('click', () => {
      openUrlAsync(ArtsVerklaring.signedUrl(avHidden.value, 300));
    });
    if (remBtn) remBtn.addEventListener('click', async () => {
      const ok = await Modal.confirm({ title: 'Artsverklaring verwijderen?', message: 'Het bestand wordt verwijderd.', confirmText: 'Verwijderen' });
      if (!ok) return;
      const old = avHidden.value;
      avHidden.value = '';
      avHidden.dispatchEvent(new Event('input', { bubbles: true }));
      if (old) ArtsVerklaring.remove(old);
      avStatus.textContent = 'nog geen bestand';
      viewBtn?.remove(); remBtn.remove();
    });
  }
  bindArtsverklaringButtons();

  // ─── Overdraagformulier scan/upload (zelfde opslag als artsverklaring) ──
  const odInput = document.getElementById('overdraag-input');
  const odHidden = document.querySelector('input[name="overdraagformulier_pad"]');
  const odRow = document.getElementById('overdraag-row');
  const odStatus = document.getElementById('overdraag-status');
  async function doOverdraagUpload(file) {
    if (!file) return;
    if (!navigator.onLine) {
      Modal.show({ type: 'offline', title: 'Geen internet', message: 'Uploaden kan alleen met internetverbinding.' });
      return;
    }
    odStatus.textContent = 'Bezig met uploaden...';
    try {
      const path = await ArtsVerklaring.upload(file);
      const old = odHidden.value;
      if (old && old !== path) ArtsVerklaring.remove(old);
      odHidden.value = path;
      odHidden.dispatchEvent(new Event('input', { bubbles: true }));
      odStatus.textContent = '✓ geüpload';
      if (!document.getElementById('overdraag-view')) {
        odRow.insertAdjacentHTML('beforeend',
          '<button type="button" class="btn btn-sm btn-ghost" id="overdraag-view">Bekijk</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="overdraag-remove">Verwijder</button>');
        bindOverdraagButtons();
      }
    } catch (_) {
      odStatus.textContent = 'upload mislukt';
    }
  }
  function bindOverdraagButtons() {
    const viewBtn = document.getElementById('overdraag-view');
    const remBtn = document.getElementById('overdraag-remove');
    if (viewBtn) viewBtn.addEventListener('click', () => {
      openUrlAsync(ArtsVerklaring.signedUrl(odHidden.value, 300));
    });
    if (remBtn) remBtn.addEventListener('click', async () => {
      const ok = await Modal.confirm({ title: 'Overdraagformulier verwijderen?', message: 'Het bestand wordt verwijderd.', confirmText: 'Verwijderen' });
      if (!ok) return;
      const old = odHidden.value;
      odHidden.value = '';
      odHidden.dispatchEvent(new Event('input', { bubbles: true }));
      if (old) ArtsVerklaring.remove(old);
      odStatus.textContent = 'nog geen bestand';
      viewBtn?.remove(); remBtn.remove();
    });
  }
  if (odInput) {
    odInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      await doOverdraagUpload(file);
      odInput.value = '';
    });
  }
  bindOverdraagButtons();

  // Live kleuren bijwerken bij élke input-wijziging (debounced)
  let colorTimer = null;
  document.getElementById('dossier-form').addEventListener('input', () => {
    clearTimeout(colorTimer);
    colorTimer = setTimeout(updateStepColors, 200);
  });
  document.getElementById('dossier-form').addEventListener('change', updateStepColors);

  showStep(currentStep);

  // ─── Handtekeningen activeren (lazy — pas zodra stap 5 zichtbaar) ─────
  // De canvas heeft pas geldige getBoundingClientRect-afmetingen wanneer
  // het bijbehorende fieldset zichtbaar is. Daarom initialiseren we de
  // SignaturePads pas in showStep wanneer currentStep === 5.
  const sigPads = {};
  const existingSigs = (dossier.handtekeningen && typeof dossier.handtekeningen === 'object') ? dossier.handtekeningen : {};
  function initSigPadsIfNeeded() {
    $$('.signature-pad').forEach(canvas => {
      const id = canvas.getAttribute('data-sigid');
      if (sigPads[id]) return; // al geïnitialiseerd
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // nog niet zichtbaar
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
  }
  // Als de wizard meteen op stap 5 opent (resumed sessie) ook initialiseren
  if (currentStep === 5) requestAnimationFrame(initSigPadsIfNeeded);
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

  // ─── Adres-autocomplete via PDOK Locatieserver ───────────────────────
  // Typ "Straatnaam 12" → kies uit dropdown → alle velden auto-ingevuld.
  Postcode.bindAddressAutocomplete({
    straatEl:     $('input[name="adres_overledene"]'),
    postcodeEl:   $('input[name="postcode_overledene"]'),
    woonplaatsEl: $('input[name="woonplaats_overledene"]'),
  });

  // ─── Auto-invullen bij bekende naam / gezinsnummer ─────────────────────
  const autofillForm = $('#dossier-form');
  const exclId = isNew ? null : dossier.id;

  // (a) Overledene: bekende naam → gegevens overnemen uit een eerder dossier.
  const checkOverledene = async () => {
    const voornaam = (autofillForm.elements['voornaam']?.value || '').trim();
    const achternaam = (autofillForm.elements['achternaam']?.value || '').trim();
    if (!voornaam || !achternaam) return;               // pas matchen als beide er zijn
    const naam = `${voornaam} ${achternaam}`;
    const d = Autofill.dossierByNaam(voornaam, achternaam, 'voornaam', 'achternaam', exclId);
    if (d) {
      await Autofill.vul(autofillForm, 'Bekende naam',
        `${naam} kwam eerder voor in dossier ${d.dossier_nummer}. Bekende gegevens overnemen?`,
        [['geslacht', d.geslacht],
         ['geboortedatum', d.geboortedatum], ['geboorteplaats', d.geboorteplaats],
         ['adres_overledene', d.adres_overledene], ['postcode_overledene', d.postcode_overledene],
         ['woonplaats_overledene', d.woonplaats_overledene]]);
    }
  };
  ['voornaam', 'achternaam'].forEach(n => {
    const inp = autofillForm.elements[n];
    if (inp) inp.addEventListener('change', checkOverledene);
  });


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
          try {
            localStorage.removeItem(stepKey);
            localStorage.removeItem(maxKey);
            if (isNew) localStorage.removeItem(kostenBufKey);
          } catch (_) {}
          renderDossierForm(params);
        });
        // Bij herstel uit een draft (bv. na navigatie vanuit /kisten)
        // de kist-auto-kost verversen. syncAutoKostKist verwijdert oude
        // auto-posten en voegt de nieuwe toe — idempotent.
        const kHidden = $('input[name="kist_type"]')?.value;
        if (kHidden) syncAutoKostKist(kHidden);
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

  // De 'Terug naar dossiers'-knop laat het concept ONGEMOEID — bij
  // ongelukken (verkeerd klikken) blijft alle voortgang bewaard.
  // Conceptkan alleen expliciet worden verwijderd via de 'Concept
  // verwerpen'-link in de gele banner bovenaan.

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

    // Extra personeel: aangevinkte accountnamen → JSONB-array
    data.extra_personeel = [...document.querySelectorAll('#dossier-form .extra-personeel-cb')]
      .filter(cb => cb.checked).map(cb => cb.value);

    // Brengen naar (bij ophalen): meerdere locaties → JSONB-array
    data.brengen_naar = [...document.querySelectorAll('#dossier-form .brengen-naar-input')]
      .map(inp => (inp.value || '').trim()).filter(Boolean);

    // Rouwgoederen (bij thuis opbaren): aangevinkte items → JSONB-array
    data.rouwgoederen_lijst = [...document.querySelectorAll('#dossier-form .rouwgoed-cb')]
      .filter(cb => cb.checked).map(cb => cb.value);

    // Extra bezittingen (naast de standaard 3) → JSONB-array van {label, aantal}
    data.extra_bezittingen = [...document.querySelectorAll('#dossier-form .extra-bezit-row')]
      .map(row => ({
        label: (row.querySelector('.extra-bezit-label')?.value || '').trim(),
        aantal: parseInt(row.querySelector('.extra-bezit-aantal')?.value, 10) || 0,
      }))
      .filter(x => x.label);

    // Handtekeningen niet meer in het formulier — bestaande behouden.
    data.handtekeningen = existingSigs;

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

    // Dubbel-dossier / persoon-detectie (niet-blokkerend, wel waarschuwen).
    const dubbel = vindDubbelDossier(data, isNew ? null : dossier.id);
    if (dubbel) {
      const bsnMatch = String(data.bsn || '').replace(/\D/g, '') &&
        String(dubbel.bsn || '').replace(/\D/g, '') === String(data.bsn || '').replace(/\D/g, '');
      const reden = bsnMatch ? 'hetzelfde BSN' : 'dezelfde naam en geboortedatum';
      const tochOpslaan = await Modal.confirm({
        type: 'warning',
        title: 'Mogelijk dubbel dossier',
        message: `Er bestaat al een dossier (${dubbel.dossier_nummer || '#' + dubbel.id}) met ${reden}${fullName(dubbel) ? ' — ' + fullName(dubbel) : ''}. Toch een nieuw dossier opslaan?`,
        confirmText: 'Toch opslaan',
        cancelText: 'Annuleren',
      });
      if (!tochOpslaan) return;
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; const oldText = btn.textContent;
    btn.textContent = 'Bezig met opslaan...';

    try {
      let savedDossier;
      if (isNew) {
        const created = await DB.insert(KEYS.DOSSIERS, data);
        savedDossier = created;
        // Voorraad-reservering: als er een kist_type is gekozen én er een
        // voorraadregel bestaat, 1 afboeken. Alleen beheerder (RLS blokkeert
        // medewerker sowieso — dan gewoon overslaan).
        if (data.kist_type && typeof KistVoorraad !== 'undefined'
            && typeof Auth !== 'undefined' && Auth.isBeheerder()) {
          try { await KistVoorraad.reserveer1(data.kist_type); } catch (_) {}
        }
        // De in de wizard opgebouwde kostenposten (buffer) nu echt opslaan.
        // Alleen beheerders beheren kosten (server-side geblokkeerd voor medewerkers).
        try {
          if (typeof Auth === 'undefined' || Auth.isBeheerder())
          await Promise.all((kostenBuffer || []).map(p => DB.insert(KEYS.KOSTEN, {
            dossier_id: created.id,
            omschrijving: p.omschrijving,
            categorie: p.categorie,
            bedrag: p.bedrag,
            aantal: p.aantal || 1,
            betaald: !!p.betaald,
          })));
        } catch (kErr) {
          console.warn('Kostenposten toevoegen mislukt:', kErr);
        }
        localStorage.removeItem(draftKey);
        try { localStorage.removeItem(stepKey); localStorage.removeItem(maxKey); localStorage.removeItem(kostenBufKey); } catch (_) {}
      } else {
        savedDossier = await DB.update(KEYS.DOSSIERS, dossier.id, data);
        localStorage.removeItem(draftKey);
        try { localStorage.removeItem(stepKey); localStorage.removeItem(maxKey); } catch (_) {}
      }

      // ─── Auto-mail dossier bij eerste aanmaak (best-effort) ──
      // Inclusief kostenoverzicht — net opgeslagen kostenposten staan al
      // in de cloud-cache via de DB.insert hierboven.
      const klooster = (Settings.get('auto_send_dossier_email') || '').trim();
      if (isNew && klooster && EmailService.isConfigured() && navigator.onLine && savedDossier) {
        try {
          const kostenLijst = DB.where(KEYS.KOSTEN, k => k.dossier_id === savedDossier.id);
          const subj = `Uitvaartdossier ${savedDossier.dossier_nummer || ''} — ${fullName(savedDossier) || ''}`.trim();
          const body = buildDossierEmail(savedDossier, kostenLijst);
          await EmailService.send(klooster, subj, body);
        } catch (mailErr) {
          // Niet blokkerend — gewoon loggen en doorgaan
          console.warn('Auto-mail naar klooster mislukt:', mailErr);
        }
      }

      // Native herinneringen/badge + Live Activity meteen bijwerken (bv.
      // een uitvaart-datum van vandaag start direct de lockscreen-widget).
      try { if (typeof Native !== 'undefined' && Native.isApp()) Native.sync(); } catch (_) {}

      Router.go('/dossiers/' + (isNew ? savedDossier.id : dossier.id));
    } catch (err) {
      btn.disabled = false; btn.textContent = oldText;
    }
  });
}
