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
          <button type="button" class="wizard-step" data-go="4"><span class="num">4</span><span class="lbl">Bijzonderheden</span></button>
          <button type="button" class="wizard-step" data-go="5"><span class="num">5</span><span class="lbl">Handtekeningen</span></button>
        </nav>

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
            <label><span>Tijdstip overlijden</span><input type="time" name="overlijdenstijd" value="${v('overlijdenstijd')}"></label>
            <label><span>Plaats van overlijden</span><input type="text" name="overlijdensplaats" value="${v('overlijdensplaats')}" placeholder="ziekenhuis, thuis..."></label>
            <label class="span-2"><span>Adres overledene</span><input type="text" name="adres_overledene" value="${v('adres_overledene')}"></label>
            <label><span>Postcode</span><input type="text" name="postcode_overledene" value="${v('postcode_overledene')}"></label>
            <label><span>Woonplaats</span><input type="text" name="woonplaats_overledene" value="${v('woonplaats_overledene')}"></label>
            <label><span>BSN</span><input type="text" name="bsn" value="${v('bsn')}"></label>
            <label><span>Nationaliteit</span><input type="text" name="nationaliteit" value="${v('nationaliteit')}"></label>
            <label class="span-3"><span>Artsverklaring (overlijdensverklaring)</span>
              <input type="hidden" name="artsverklaring_pad" value="${esc(v('artsverklaring_pad'))}">
              <div class="artsverklaring-row" id="artsverklaring-row">
                <label class="btn btn-sm" style="cursor:pointer;">
                  📷 Scan / kies bestand
                  <input type="file" id="artsverklaring-input" accept="image/*,application/pdf" capture="environment" hidden>
                </label>
                <span class="artsverklaring-status muted small" id="artsverklaring-status">${v('artsverklaring_pad') ? '✓ geüpload' : 'nog geen bestand'}</span>
                ${v('artsverklaring_pad') ? '<button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-view">Bekijk</button><button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-remove">Verwijder</button>' : ''}
              </div>
            </label>
            <label><span>Lid Syrisch-Orthodoxe Kerk</span>
              <select name="syrisch_orthodox_lid">
                <option value="">—</option>
                <option value="ja" ${sel('syrisch_orthodox_lid','ja')}>Ja</option>
                <option value="nee" ${sel('syrisch_orthodox_lid','nee')}>Nee</option>
                <option value="onbekend" ${sel('syrisch_orthodox_lid','onbekend')}>Onbekend</option>
              </select>
            </label>
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
            <label><span>Verzekering</span>
              ${(() => {
                const opties = ['DELA','Suryoyo UA','Anders'];
                const huidig = v('verzekering_maatschappij');
                const inLijst = opties.some(o => o === huidig);
                return `
                <select name="verzekering_maatschappij" id="verzekering-mij-select">
                  <option value="">— geen / n.v.t. —</option>
                  ${opties.map(o => `<option value="${esc(o)}" ${huidig === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
                  ${huidig && !inLijst ? `<option value="${esc(huidig)}" selected>${esc(huidig)}</option>` : ''}
                </select>`;
              })()}
            </label>
            <label id="polisnummer-row" ${v('verzekering_maatschappij') ? '' : 'hidden'}><span>Polisnummer</span><input type="text" name="polisnummer" value="${v('polisnummer')}"></label>
            <label><span>Gezinsnummer</span><input type="text" name="gezinsnummer" value="${v('gezinsnummer')}" placeholder="(klooster-administratie)"></label>
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
            <label id="minderjarige-row" ${v('kinderen_status') === 'ja' ? '' : 'hidden'}><span>Minderjarige kinderen?</span>
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
            <label><span>Relatie tot overledene</span>
              ${(() => {
                const opties = ['Partner','Zoon','Dochter','Kleinkind','Anders'];
                const huidig = v('contact_relatie');
                const inLijst = opties.some(o => o === huidig);
                return `
                <select name="contact_relatie">
                  <option value="">—</option>
                  ${opties.map(o => `<option value="${esc(o)}" ${huidig === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
                  ${huidig && !inLijst ? `<option value="${esc(huidig)}" selected>${esc(huidig)}</option>` : ''}
                </select>`;
              })()}
            </label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="2">
          <legend>Uitvaart</legend>
          <div class="grid-3">
            <label><span>Type uitvaart</span>
              <select name="uitvaart_type">
                <option value="">—</option>
                <option value="begrafenis" ${sel('uitvaart_type','begrafenis')}>Begrafenis</option>
                <option value="repatriëring" ${sel('uitvaart_type','repatriëring')}>Repatriëring</option>
              </select>
            </label>
            <label><span>Datum uitvaart</span><input type="date" name="uitvaart_datum" value="${v('uitvaart_datum')}"></label>
            <label><span>Tijdstip uitvaart</span><input type="time" name="uitvaart_tijd" value="${v('uitvaart_tijd')}"></label>
            <label><span>Wie leidt de uitvaart?</span>
              ${(() => {
                // Alle ingevulde priesters uit Account → Parochies
                const priesters = [...new Set((Settings.get('parochies') || [])
                  .map(p => (p.priester || '').trim()).filter(Boolean))].sort();
                const huidig = v('uitvaart_voorganger');
                const inLijst = priesters.some(p => p === huidig);
                return `
                <select name="uitvaart_voorganger">
                  <option value="">— kies een priester —</option>
                  ${priesters.map(p => `<option value="${esc(p)}" ${huidig === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
                  ${huidig && !inLijst ? `<option value="${esc(huidig)}" selected>${esc(huidig)}</option>` : ''}
                </select>
                ${priesters.length === 0 ? '<span class="muted small">Nog geen priesters ingesteld — voeg toe in <a href="#/account#parochies">Account</a>.</span>' : ''}`;
              })()}
            </label>
            <label class="span-3"><span>Kerk / dienstlocatie</span>
              <input type="text" name="kerk_locatie" value="${esc(v('kerk_locatie') || (isNew ? (Settings.get('default_kerk_locatie') || 'Maria kathedraal') : ''))}" placeholder="bv. Maria kathedraal">
            </label>
            <label class="span-2"><span>Begraafplaats</span>
              <input type="text" name="begraafplaats" value="${esc(v('begraafplaats') || (isNew ? (Settings.get('default_begraafplaats') || 'St. Ephrem') : ''))}">
            </label>
            <label><span>Type graf</span>
              <select name="graf_type" id="graf-type-select">
                <option value="">—</option>
                ${['oude begraafplaats','algemeen graf','familiegraf','priester graf'].map(x =>
                  `<option value="${esc(x)}" ${sel('graf_type', x)}>${esc(x)}</option>`).join('')}
              </select>
            </label>
            <label id="grafnummer-row" ${v('graf_type') ? '' : 'hidden'}><span>Grafnummer</span><input type="text" name="grafnummer" value="${v('grafnummer')}"></label>
            <label id="certificaat-row" ${v('graf_type') === 'familiegraf' ? '' : 'hidden'}><span>Certificaatnummer <span class="muted small">(familiegraf)</span></span><input type="text" name="certificaat_nummer" value="${v('certificaat_nummer')}"></label>
          </div>
        </fieldset>

        <fieldset class="card" data-step="3">
          <legend>Kosten</legend>
          <!-- Kist & bloemen worden gekozen via de catalogus-pagina's
               (snel-toevoegen tegel hieronder). Hidden inputs houden de
               keuze in het dossier-record. -->
          <input type="hidden" name="kist_type"    value="${esc(v('kist_type'))}">
          <input type="hidden" name="bloemstukken" value="${esc(v('bloemstukken'))}">

          <h3 style="margin:0 0 .5rem;">Kostenoverzicht</h3>
          <div id="wizard-kosten-mount"></div>
        </fieldset>

        <fieldset class="card" data-step="4">
          <legend>Bijzonderheden</legend>
          <label class="full"><span>Notities / wensen familie</span>
            <textarea name="bijzonderheden" rows="5">${v('bijzonderheden')}</textarea>
          </label>
        </fieldset>

        <fieldset class="card" data-step="5">
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
  const TOTAL_STEPS = 5;
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
    1: ['achternaam','voornaam','geboortedatum','overlijdensdatum',
        'adres_overledene','postcode_overledene','woonplaats_overledene',
        'parochie','priester',
        'contact_naam','contact_voornaam','contact_telefoon','contact_relatie'],
    2: ['uitvaart_type','uitvaart_datum',
        'uitvaart_tijd','kerk_locatie','begraafplaats'],
    3: [], // kosten + kist/bloemen via catalogus-pagina, geen verplichte velden
    4: [],  // bijzonderheden is volledig optioneel
    // 5 = handtekeningen, speciale logica
  };

  const fillStateForStep = (step) => {
    const form = document.getElementById('dossier-form');
    if (!form) return 'empty';
    const fd = new FormData(form);
    const isFilled = name => {
      const v = fd.get(name);
      return v != null && String(v).trim() !== '';
    };

    // Stap 5 — handtekeningen, check via Settings + bestaande dossier-data
    if (step === 5) {
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
  };

  document.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => showStep(parseInt(el.dataset.go, 10)));
  });
  document.getElementById('btn-wizard-prev').addEventListener('click', () => showStep(currentStep - 1));
  document.getElementById('btn-wizard-next').addEventListener('click', () => showStep(currentStep + 1));

  // Verzekering-maatschappij gekozen → polisnummer-veld tonen
  const verzMijSel = document.getElementById('verzekering-mij-select');
  const polisRow = document.getElementById('polisnummer-row');
  const updatePolisRow = () => {
    if (!verzMijSel || !polisRow) return;
    polisRow.hidden = !verzMijSel.value;
  };
  if (verzMijSel) {
    verzMijSel.addEventListener('change', () => {
      updatePolisRow();
      updateStepColors();
    });
    updatePolisRow();
  }

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
  // Onthoud of de 'Snel toevoegen'-lijst openstaat zodat hij niet
  // dichtklapt na elke klik op een preset (re-render)
  let presetsOpen = false;
  const saveBuffer = () => {
    if (!isNew) return;
    try { localStorage.setItem(kostenBufKey, JSON.stringify(kostenBuffer)); } catch (_) {}
  };

  function renderWizardKosten() {
    const mount = document.getElementById('wizard-kosten-mount');
    if (!mount) return;
    const adminMode = !!Settings.get('catalog_admin_mode');

    // Bron: buffer (nieuw) of live DB (bestaand)
    const kosten = isNew
      ? kostenBuffer.map((k, i) => Object.assign({ id: '_buf_' + i }, k))
      : DB.where(KEYS.KOSTEN, k => k.dossier_id === dossier.id).sort((a,b) => a.id - b.id);
    const totaal = kosten.reduce((s,k) => s + (Number(k.bedrag)||0), 0);
    const betaald = kosten.filter(k => k.betaald).reduce((s,k) => s + (Number(k.bedrag)||0), 0);
    const open = Math.max(0, totaal - betaald);

    const allesBetaald = kosten.length > 0 && kosten.every(k => k.betaald);
    mount.innerHTML = `
      ${kosten.length === 0 ? '<p class="muted small">Nog geen kostenposten. Voeg toe via een snelknop of handmatig hieronder.</p>' : `
      <table class="table wizard-kosten-table">
        <thead><tr><th>Omschrijving</th><th>Categorie</th><th class="num">Bedrag</th><th></th></tr></thead>
        <tbody>
          ${kosten.map(k => `<tr>
            <td>${esc(k.omschrijving)}</td>
            <td class="muted small">${esc(categorieLabel(k.categorie))}</td>
            <td class="num">${fmtEUR(k.bedrag)}</td>
            <td><button type="button" class="btn-icon" data-wk-del="${k.id}" title="Verwijderen">×</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="wizard-kosten-totals">
        <span>Totaal factuur: <strong>${fmtEUR(totaal)}</strong></span>
        <button type="button" class="kost-toggle kost-toggle-big ${allesBetaald ? 'on-betaald' : 'off-betaald'}" id="wk-status-toggle">
          ${allesBetaald ? '✓ Volledig betaald' : '○ Nog open'}
        </button>
      </div>`}
      ${isNew && kosten.length === 0 ? '<button type="button" class="btn btn-sm btn-ghost" id="wk-fill-standaard" style="margin-top:.5rem;">+ Alle standaardposten toevoegen</button>' : ''}

      <details class="wizard-kosten-presets" id="wk-presets-details" ${presetsOpen ? 'open' : ''} style="margin-top:.85rem;">
        <summary>+ Snel toevoegen uit standaardlijst</summary>
        ${adminMode ? '<p class="muted small" style="margin:.5rem 0 0;">Beheermodus aan — klik op het potlood om een prijs aan te passen of op de prullenbak om een post uit de lijst te verbergen.</p>' : ''}
        <div class="wizard-preset-grid">
          ${effectieveKostenPresets({ includeHidden: adminMode }).map((p, i) => {
            const cls = 'btn btn-sm btn-ghost wizard-preset-btn'
              + (p.nav ? ' wizard-preset-nav wizard-preset-nav-' + p.nav : '')
              + (p._hidden ? ' is-hidden-preset' : '');
            const prijs = (p.bedrag != null && p.bedrag !== '')
              ? `<span class="muted small">${fmtEUR(p.bedrag)}${p._customBedrag ? ' ✏️' : ''}</span>`
              : (p.nav ? '<span class="muted small">→</span>' : '');
            const adminCtrls = (adminMode && !p.nav)
              ? `<span class="wizard-preset-admin">
                  <button type="button" class="wizard-preset-edit" data-wk-edit="${i}" title="Prijs aanpassen">✏️</button>
                  ${p._hidden
                    ? `<button type="button" class="wizard-preset-show" data-wk-show="${i}" title="Toon weer">👁</button>`
                    : `<button type="button" class="wizard-preset-hide" data-wk-hide="${i}" title="Verberg uit lijst">🗑</button>`}
                </span>`
              : '';
            return `<span class="wizard-preset-wrap">
              <button type="button" class="${cls}" data-wk-preset="${i}" ${p._hidden ? 'disabled' : ''}>
                ${esc(p.omschrijving)} ${prijs}
              </button>
              ${adminCtrls}
            </span>`;
          }).join('')}
        </div>
      </details>

      <div class="wizard-kosten-add">
        <input type="text" id="wk-omschrijving" placeholder="Omschrijving">
        <select id="wk-categorie">
          <option value="">Categorie</option>
          ${KOSTEN_CATEGORIEEN.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}
        </select>
        <input type="text" id="wk-bedrag" placeholder="0,00" inputmode="decimal" style="max-width:110px;">
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
      if (isNew) {
        kostenBuffer.push({ omschrijving: p.omschrijving, categorie: p.categorie, bedrag: p.bedrag, aantal: 1, betaald: false });
        saveBuffer(); renderWizardKosten();
      } else {
        try { await DB.insert(KEYS.KOSTEN, { dossier_id: dossier.id, omschrijving: p.omschrijving, categorie: p.categorie, bedrag: p.bedrag, aantal: 1, betaald: false }); await DB.touchDossier(dossier.id); renderWizardKosten(); } catch (_) {}
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
        const huidig = p.bedrag != null ? String(p.bedrag).replace('.', ',') : '';
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
          title: 'Verbergen uit lijst?',
          message: `"${p.omschrijving}" verdwijnt uit de snel-toevoeg-lijst. Bestaande kostenposten blijven staan; je kunt 'm later weer tonen via beheermodus.`,
          confirmText: 'Verbergen',
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
    // Onthoud open/dicht-stand van de presets-details
    const presetsDetails = mount.querySelector('#wk-presets-details');
    if (presetsDetails) {
      presetsDetails.addEventListener('toggle', () => {
        presetsOpen = presetsDetails.open;
      });
    }
    // ── Acties: alle standaardposten in één keer (alleen nieuw) ──
    const fillBtn = mount.querySelector('#wk-fill-standaard');
    if (fillBtn) fillBtn.addEventListener('click', () => {
      // Navigatie-tegels (kist/bloemen/extra) overslaan — die hebben geen prijs
      KOSTEN_PRESETS.filter(p => !p.nav).forEach(p =>
        kostenBuffer.push({ omschrijving: p.omschrijving, categorie: p.categorie, bedrag: p.bedrag, aantal: 1, betaald: false }));
      saveBuffer(); renderWizardKosten();
    });
    // ── Acties: handmatig toevoegen ──
    const addBtn = mount.querySelector('#wk-add-btn');
    if (addBtn) addBtn.addEventListener('click', async () => {
      const oms = mount.querySelector('#wk-omschrijving').value.trim();
      if (!oms) { Modal.show({ type: 'warning', title: 'Omschrijving nodig', message: 'Vul een omschrijving in.' }); return; }
      const cat = mount.querySelector('#wk-categorie').value || null;
      const bedrag = parseEUR(mount.querySelector('#wk-bedrag').value);
      if (isNew) {
        kostenBuffer.push({ omschrijving: oms, categorie: cat, bedrag, aantal: 1, betaald: false });
        saveBuffer(); renderWizardKosten();
      } else {
        try { await DB.insert(KEYS.KOSTEN, { dossier_id: dossier.id, omschrijving: oms, categorie: cat, bedrag, aantal: 1, betaald: false }); await DB.touchDossier(dossier.id); renderWizardKosten(); } catch (_) {}
      }
    });
  }
  renderWizardKosten();

  // ─── Kist/Bloem auto-syncen naar kosten ─────────────────────────────
  // Bij wijziging van de dropdown verwijderen we de oude auto-post en
  // voegen de nieuwe toe. Werkt op buffer (nieuw) én DB (bestaand).
  const KIST_PREFIX = 'Kist: ';
  const BLOEM_PREFIX = 'Bloemstuk: ';

  async function syncAutoKost(prefix, categorie, naam, bedrag) {
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
  function syncAutoKostBloem(naam) {
    if (!naam || naam === 'anders') { syncAutoKost(BLOEM_PREFIX, 'bloemen', null, null); return; }
    const b = DB.list(KEYS.BLOEMEN).find(x => x.naam === naam);
    syncAutoKost(BLOEM_PREFIX, 'bloemen', naam, b ? Number(b.bedrag) : null);
  }

  // Eerste-keer init: als er al een kist/bloem in het dossier (hidden
  // inputs) staat, en er nog geen auto-post bestaat, hem alvast toevoegen.
  // De waarden komen uit Kisten/Bloemen-pagina via _setKistInDraft /
  // _setBloemInDraft → applyDossierDraft.
  function _kistHiddenVal()  { return ($('input[name="kist_type"]')?.value || '').trim(); }
  function _bloemHiddenVal() { return ($('input[name="bloemstukken"]')?.value || '').trim(); }
  (function initAutoKosten() {
    const huidigeKist = _kistHiddenVal();
    if (huidigeKist) {
      const lijst = isNew ? kostenBuffer
                          : DB.where(KEYS.KOSTEN, k => k.dossier_id === dossier.id);
      const alAanwezig = lijst.some(k => (k.omschrijving || '').startsWith(KIST_PREFIX));
      if (!alAanwezig) syncAutoKostKist(huidigeKist);
    }
    const huidigeBloem = _bloemHiddenVal();
    if (huidigeBloem) {
      const lijst = isNew ? kostenBuffer
                          : DB.where(KEYS.KOSTEN, k => k.dossier_id === dossier.id);
      const alAanwezig = lijst.some(k => (k.omschrijving || '').startsWith(BLOEM_PREFIX));
      if (!alAanwezig) syncAutoKostBloem(huidigeBloem);
    }
  })();
  // Wanneer een 'sok_draft_…' van buitenaf wordt aangepast (bijv. via de
  // Kisten- of Bloemen-pagina die het hidden veld in de draft schrijft),
  // herladen we de auto-koppeling.
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
      if (draft.bloemstukken) {
        const bInp = $('input[name="bloemstukken"]');
        if (bInp && bInp.value !== draft.bloemstukken) {
          bInp.value = draft.bloemstukken;
          syncAutoKostBloem(draft.bloemstukken);
        }
      }
    } catch (_) {}
  });

  // Artsverklaring scan/upload
  const avInput = document.getElementById('artsverklaring-input');
  const avHidden = document.querySelector('input[name="artsverklaring_pad"]');
  const avRow = document.getElementById('artsverklaring-row');
  const avStatus = document.getElementById('artsverklaring-status');
  if (avInput) {
    avInput.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      if (!navigator.onLine) {
        Modal.show({ type: 'offline', title: 'Geen internet', message: 'Uploaden kan alleen met internetverbinding.' });
        return;
      }
      avStatus.textContent = 'Bezig met uploaden...';
      try {
        const path = await ArtsVerklaring.upload(file);
        // oude verwijderen indien aanwezig
        const old = avHidden.value;
        if (old && old !== path) ArtsVerklaring.remove(old);
        avHidden.value = path;
        avHidden.dispatchEvent(new Event('input', { bubbles: true }));
        avStatus.textContent = '✓ geüpload';
        // Knoppen Bekijk/Verwijder injecteren als ze er nog niet zijn
        if (!document.getElementById('artsverklaring-view')) {
          avRow.insertAdjacentHTML('beforeend',
            '<button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-view">Bekijk</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" id="artsverklaring-remove">Verwijder</button>');
          bindArtsverklaringButtons();
        }
      } catch (_) {
        avStatus.textContent = 'upload mislukt';
      } finally {
        avInput.value = '';
      }
    });
  }
  function bindArtsverklaringButtons() {
    const viewBtn = document.getElementById('artsverklaring-view');
    const remBtn = document.getElementById('artsverklaring-remove');
    if (viewBtn) viewBtn.addEventListener('click', async () => {
      try {
        const url = await ArtsVerklaring.signedUrl(avHidden.value, 300);
        if (url) window.open(url, '_blank');
      } catch (_) {}
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

  // Live kleuren bijwerken bij élke input-wijziging (debounced)
  let colorTimer = null;
  document.getElementById('dossier-form').addEventListener('input', () => {
    clearTimeout(colorTimer);
    colorTimer = setTimeout(updateStepColors, 200);
  });
  document.getElementById('dossier-form').addEventListener('change', updateStepColors);

  showStep(currentStep);

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

  // ─── Kinderen-status → minderjarige-vraag tonen/verbergen ────────────
  const kinderenSel = $('#kinderen-status-select');
  const minderjarigRow = $('#minderjarige-row');
  const minderjarigSel = $('#minderjarige-kinderen-select');
  const kindRow = $('#kinderen-namen-row');
  let minderjarigPopupShown = (dossier.minderjarige_kinderen === 'ja');
  function updateKinderenVisibility() {
    const kinderenJa = kinderenSel?.value === 'ja';
    if (minderjarigRow) minderjarigRow.hidden = !kinderenJa;
    // Bij "Nee, geen kinderen" → reset minderjarig-veld en namen
    if (!kinderenJa && minderjarigSel) {
      if (minderjarigSel.value) minderjarigSel.value = '';
    }
    const minderjarigJa = kinderenJa && minderjarigSel?.value === 'ja';
    if (kindRow) kindRow.hidden = !minderjarigJa;
  }
  if (kinderenSel) {
    kinderenSel.addEventListener('change', updateKinderenVisibility);
  }
  if (minderjarigSel) {
    minderjarigSel.addEventListener('change', () => {
      updateKinderenVisibility();
      if (minderjarigSel.value === 'ja' && !minderjarigPopupShown) {
        minderjarigPopupShown = true;
        Modal.show({
          type: 'info',
          title: 'Minderjarige kinderen',
          message: 'Vergeet niet de namen (en leeftijden) van de minderjarige kinderen op de achterzijde van het aangifte-formulier in te vullen.',
        });
      }
    });
  }
  updateKinderenVisibility();

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
          try {
            localStorage.removeItem(stepKey);
            localStorage.removeItem(maxKey);
            if (isNew) localStorage.removeItem(kostenBufKey);
          } catch (_) {}
          renderDossierForm(params);
        });
        // Bij herstel uit een draft (bv. na navigatie vanuit /kisten of
        // /bloemen) de auto-kosten verversen. syncAutoKost verwijdert
        // oude auto-posten en voegt de nieuwe toe — idempotent.
        const kHidden = $('input[name="kist_type"]')?.value;
        if (kHidden) syncAutoKostKist(kHidden);
        const bHidden = $('input[name="bloemstukken"]')?.value;
        if (bHidden) syncAutoKostBloem(bHidden);
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
      let savedDossier;
      if (isNew) {
        const created = await DB.insert(KEYS.DOSSIERS, data);
        savedDossier = created;
        // De in de wizard opgebouwde kostenposten (buffer) nu echt opslaan.
        try {
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

      // ─── Auto-mail dossier naar klooster bij eerste aanmaak (best-effort) ──
      const klooster = (Settings.get('auto_send_dossier_email') || '').trim();
      if (isNew && klooster && EmailService.isConfigured() && navigator.onLine && savedDossier) {
        try {
          const subj = `Uitvaartdossier ${savedDossier.dossier_nummer || ''} — ${fullName(savedDossier) || ''}`.trim();
          const body = buildDossierEmail(savedDossier);
          await EmailService.send(klooster, subj, body);
        } catch (mailErr) {
          // Niet blokkerend — gewoon loggen en doorgaan
          console.warn('Auto-mail naar klooster mislukt:', mailErr);
        }
      }

      Router.go('/dossiers/' + (isNew ? savedDossier.id : dossier.id));
    } catch (err) {
      btn.disabled = false; btn.textContent = oldText;
    }
  });
}
