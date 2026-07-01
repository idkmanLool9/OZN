// Familie-portaal beheer — eigen pagina om per dossier de portaal-link,
// welkomtekst, checklist én dagplanning in te stellen. Kies boven een
// dossier; daaronder verschijnt het instel-paneel met een echte deel-link
// die je kunt kopiëren of automatisch naar de contactpersoon kunt mailen.

// ─── Dagplanning: automatisch voorstel uit de dossier-gegevens ────────────
// Bouwt een tijdlijn { tijd, moment, locatie } op basis van de ingevoerde
// avondwake / kerkdienst / begrafenis / condoleance. De uitvaartleider kan
// daarna vrij bijschaven (regels toevoegen, verwijderen, tijden aanpassen).
function autoDagplanning(d) {
  const rows = [];
  const add = (tijd, moment, locatie) => {
    if (!moment) return;
    rows.push({ tijd: tijd || '', moment, locatie: locatie || '' });
  };
  if (d.avondwake_tijd || d.avondwake_locatie) {
    add(d.avondwake_tijd, 'Avondwake', d.avondwake_locatie);
  }
  if (d.uitvaart_tijd || d.kerk_locatie) {
    add(d.uitvaart_tijd, d.uitvaart_type ? ('Uitvaartdienst — ' + d.uitvaart_type) : 'Uitvaartdienst', d.kerk_locatie);
  }
  if (d.begraafplaats) {
    add('', 'Begrafenis / teraardebestelling', d.begraafplaats);
  }
  if (d.condoleance_locatie) {
    add('', 'Condoleance / samenzijn', d.condoleance_locatie);
  }
  // Sorteer op tijd (regels zonder tijd achteraan in ingevoerde volgorde)
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ta = a.r.tijd || '99:99', tb = b.r.tijd || '99:99';
      return ta === tb ? a.i - b.i : ta.localeCompare(tb);
    })
    .map(x => x.r);
}

function renderPortaalDagRow(item, idx) {
  const it = item && typeof item === 'object' ? item : { tijd: '', moment: String(item || ''), locatie: '' };
  return `
    <div class="portaal-dag-row" data-idx="${idx}">
      <input type="time" class="portaal-dag-tijd" value="${esc(it.tijd || '')}" aria-label="Tijd">
      <input type="text" class="portaal-dag-moment" value="${esc(it.moment || '')}" placeholder="bv. Uitvaartdienst" aria-label="Moment">
      <input type="text" class="portaal-dag-locatie" value="${esc(it.locatie || '')}" placeholder="Locatie (optioneel)" aria-label="Locatie">
      <button type="button" class="btn-icon" data-action="del-dag-row" data-idx="${idx}" title="Verwijderen">×</button>
    </div>`;
}

function renderPortaalChecklistRow(item, idx) {
  const it = item && typeof item === 'object' ? item : { titel: String(item || ''), beschrijving: '' };
  return `
    <div class="portaal-item" data-idx="${idx}">
      <div class="portaal-item-fields">
        <input type="text" class="portaal-item-titel" value="${esc(it.titel || '')}" placeholder="bv. ID-bewijs overledene meenemen">
        <textarea class="portaal-item-desc" rows="2" placeholder="Korte uitleg (optioneel)">${esc(it.beschrijving || '')}</textarea>
      </div>
      <button type="button" class="btn-icon" data-action="del-check-row" data-idx="${idx}" title="Verwijderen">×</button>
    </div>`;
}

function renderPortaalBeheer(fullHash) {
  const dossiers = (DB.list(KEYS.DOSSIERS) || [])
    .slice()
    .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));

  // Gekozen dossier uit de query (?dossier=123)
  let selId = null;
  const q = (String(fullHash || '').split('?')[1] || '');
  const m = q.match(/(?:^|&)dossier=([^&]+)/);
  if (m) selId = parseInt(decodeURIComponent(m[1]), 10);
  const d = selId != null ? DB.byId(KEYS.DOSSIERS, selId) : null;

  const optionLabel = (x) => {
    const naam = fullName(x) || 'Naamloos dossier';
    const nr = x.dossier_nummer ? ' — ' + x.dossier_nummer : '';
    const dt = x.uitvaart_datum ? ' · uitvaart ' + WheelDate.formatLong(x.uitvaart_datum) : '';
    return esc(naam + nr + dt);
  };

  $('#view').innerHTML = `
    <div class="page portaal-beheer">
      <div class="page-head">
        <div>
          <h1>Familie-portaal</h1>
          <p class="muted">Stel per dossier in wat de contactpersoon online ziet — de dagplanning en wat ze moeten meenemen. Je krijgt een echte deel-link die je kopieert of automatisch mailt.</p>
        </div>
      </div>

      <section class="card portaal-picker">
        <label for="portaal-dossier-select"><strong>Kies een dossier</strong></label>
        ${dossiers.length === 0
          ? '<p class="muted">Er zijn nog geen dossiers. Maak eerst een dossier aan.</p>'
          : `<select id="portaal-dossier-select" class="portaal-dossier-select">
              <option value="">— Kies een dossier —</option>
              ${dossiers.map(x => `<option value="${x.id}" ${d && x.id === d.id ? 'selected' : ''}>${optionLabel(x)}</option>`).join('')}
            </select>`}
      </section>

      <div id="portaal-config">
        ${d ? '' : `
          <div class="portaal-empty">
            <div class="portaal-empty-icon">✝</div>
            <p>Kies hierboven een dossier om het familie-portaal in te stellen.</p>
          </div>`}
      </div>
    </div>`;

  const sel = $('#portaal-dossier-select');
  if (sel) {
    sel.addEventListener('change', () => {
      const v = sel.value;
      Router.go(v ? `/portaal?dossier=${encodeURIComponent(v)}` : '/portaal');
    });
  }

  if (d) renderPortaalConfig(d);
}

function renderPortaalConfig(d) {
  const wrap = $('#portaal-config');
  const checklist = Array.isArray(d.familie_checklist) ? d.familie_checklist : [];
  const dagplan = Array.isArray(d.familie_dagplanning) ? d.familie_dagplanning : [];
  const contact = d.contact_email || '';
  const contactNaam = [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ');

  wrap.innerHTML = `
    <section class="card portaal-linkcard">
      <div class="portaal-linkcard-head">
        <h2>Deel-link</h2>
        <span class="portaal-pill" id="portaal-status-pill">…</span>
      </div>
      <p class="muted small">Een tijdelijke link (60 dagen geldig) naar een schone pagina zónder gevoelige gegevens — geen kosten, geen BSN, geen notities.</p>

      <div id="portaal-link-row" class="portaal-link-row" hidden>
        <input type="text" id="portaal-link" readonly>
        <button type="button" class="btn btn-sm" id="btn-portaal-copy">📋 Kopiëren</button>
        <button type="button" class="btn btn-sm btn-ghost" id="btn-portaal-open" title="Open in nieuw tabblad">↗ Open</button>
      </div>

      <div class="portaal-contact-line ${contact ? '' : 'muted'}">
        ${contact
          ? `Contactpersoon: <strong>${esc(contactNaam || '—')}</strong> &lt;${esc(contact)}&gt;`
          : 'Geen e-mailadres van de contactpersoon bekend — vul dit in bij het dossier om te kunnen mailen.'}
      </div>

      <div class="form-actions portaal-linkcard-actions">
        <button type="button" class="btn btn-primary" id="btn-portaal-create">🔗 Nieuwe link maken</button>
        <button type="button" class="btn" id="btn-portaal-mail" ${contact ? '' : 'disabled'} title="Stuur de link per e-mail naar de contactpersoon">✉️ Mail naar contactpersoon</button>
        <button type="button" class="btn btn-ghost" id="btn-portaal-revoke" hidden>🗑 Link intrekken</button>
      </div>
    </section>

    <section class="card">
      <h2>Welkomtekst</h2>
      <p class="muted small">De eerste tekst die de familie bovenaan de pagina ziet.</p>
      <textarea id="portaal-welkomtekst" rows="4" placeholder="Beste familie, hierbij de praktische informatie rondom de uitvaart…">${esc(d.familie_welkomtekst || '')}</textarea>
    </section>

    <section class="card">
      <div class="portaal-section-head">
        <div>
          <h2>Dagplanning</h2>
          <p class="muted small">Tijdschema van de uitvaartdag. Automatisch voorgesteld uit het dossier — pas gerust aan.</p>
        </div>
        <button type="button" class="btn btn-sm btn-ghost" id="btn-portaal-dag-auto" title="Vul automatisch in vanuit de dossier-gegevens">🪄 Automatisch invullen</button>
      </div>
      <div class="portaal-dag-head">
        <span>Tijd</span><span>Moment</span><span>Locatie</span><span></span>
      </div>
      <div id="portaal-dag-rows">
        ${dagplan.map((it, i) => renderPortaalDagRow(it, i)).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-portaal-dag-add" style="margin-top:.5rem;">+ Regel toevoegen</button>
    </section>

    <section class="card">
      <h2>Checklist <span class="muted small">(wat de familie voorbereidt / meeneemt)</span></h2>
      <div id="portaal-checklist-rows">
        ${checklist.map((it, i) => renderPortaalChecklistRow(it, i)).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-portaal-check-add" style="margin-top:.5rem;">+ Item toevoegen</button>
    </section>

    <section class="card portaal-idcards">
      <h2>Identiteitsbewijzen <span class="muted small">(door familie geüpload)</span></h2>
      <p class="muted small">Optioneel — verschijnt zodra de contactpersoon foto's uploadt via de deel-link (voor/achter, overledene + contactpersoon).</p>
      <div id="portaal-id-grid" class="portaal-id-grid"><p class="muted small">Laden…</p></div>
    </section>

    <div class="portaal-savebar">
      <button type="button" class="btn btn-ghost" id="btn-portaal-preview">👁 Voorbeeld bekijken</button>
      <button type="button" class="btn btn-primary" id="btn-portaal-save">Opslaan</button>
    </div>`;

  bindPortaalConfig(d);
}

async function bindPortaalConfig(d) {
  const id = d.id;

  // ── Link-status laden ──────────────────────────────────────────────
  let currentToken = null;
  const refreshStatus = async () => {
    const pill = $('#portaal-status-pill');
    const linkRow = $('#portaal-link-row');
    const linkInp = $('#portaal-link');
    const createBtn = $('#btn-portaal-create');
    const revokeBtn = $('#btn-portaal-revoke');
    const mailBtn = $('#btn-portaal-mail');
    try {
      const t = await FamiliePortaal.getForDossier(id);
      currentToken = t;
      if (t && new Date(t.expires_at) > new Date()) {
        const url = FamiliePortaal.buildUrl(t.token);
        linkInp.value = url;
        linkRow.hidden = false;
        revokeBtn.hidden = false;
        createBtn.textContent = '🔄 Nieuwe link maken';
        const daysLeft = Math.ceil((new Date(t.expires_at) - Date.now()) / 86400000);
        pill.textContent = `Actief · nog ${daysLeft} dagen`;
        pill.className = 'portaal-pill portaal-pill-on';
      } else {
        linkRow.hidden = true;
        revokeBtn.hidden = true;
        createBtn.textContent = '🔗 Nieuwe link maken';
        pill.textContent = 'Geen link';
        pill.className = 'portaal-pill portaal-pill-off';
        if (mailBtn && !d.contact_email) mailBtn.disabled = true;
      }
    } catch (_) {
      pill.textContent = 'Laden mislukt';
      pill.className = 'portaal-pill portaal-pill-off';
    }
  };
  await refreshStatus();

  // ── Door familie geüploade ID-kaarten laden + tonen ────────────────
  loadPortaalIdCards(id);

  // ── E-mail met de link opstellen + versturen ───────────────────────
  const mailLink = async (url) => {
    if (!d.contact_email) {
      Modal.show({ type: 'warning', title: 'Geen e-mailadres', message: 'Dit dossier heeft geen e-mailadres van de contactpersoon. Vul dit in bij het dossier.' });
      return false;
    }
    if (!EmailService.isConfigured()) {
      Modal.show({ type: 'warning', title: 'E-mail niet ingesteld', message: 'Stel eerst de e-mail-koppeling in bij Account voordat je automatisch kunt mailen.' });
      return false;
    }
    const s = Settings.all();
    const naam = fullName(d) || 'de overledene';
    const contactNaam = [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ');
    const aanhef = contactNaam ? `Beste ${contactNaam},` : 'Beste familie,';
    const bericht =
      `${aanhef}\n\n` +
      `Via onderstaande link vindt u alle praktische informatie rondom de uitvaart van ${naam}: ` +
      `de dagplanning en wat u kunt meenemen of voorbereiden. U hoeft niet in te loggen.\n\n` +
      `${url}\n\n` +
      `Met vriendelijke groet,\n${s.app_name || 'De uitvaartleider'}`;
    await EmailService.send(d.contact_email, `Praktische informatie — uitvaart ${naam}`, bericht);
    return true;
  };

  // ── Nieuwe link maken (+ automatisch mailen indien mogelijk) ────────
  $('#btn-portaal-create').addEventListener('click', async () => {
    const btn = $('#btn-portaal-create');
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Bezig…';
    try {
      const t = await FamiliePortaal.createOrReplace(id);
      await refreshStatus();
      const url = FamiliePortaal.buildUrl(t.token);
      let mailed = false;
      if (d.contact_email && EmailService.isConfigured()) {
        try { mailed = await mailLink(url); } catch (_) { mailed = false; }
      }
      Modal.show({
        type: 'success',
        title: 'Link aangemaakt',
        message: mailed
          ? `De link is aangemaakt én gemaild naar ${d.contact_email}. Je kunt hem ook nog kopiëren.`
          : 'De link is klaar. Kopieer hem of mail hem naar de contactpersoon.',
      });
    } catch (e) {
      Modal.show({ type: 'error', title: 'Aanmaken mislukt', message: e.message || String(e) });
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });

  // ── Handmatig (opnieuw) mailen ─────────────────────────────────────
  $('#btn-portaal-mail').addEventListener('click', async () => {
    const btn = $('#btn-portaal-mail');
    // Zorg dat er een geldige link is
    let url = ($('#portaal-link') && $('#portaal-link').value) || '';
    if (!url) {
      const ok = await Modal.confirm({
        title: 'Nog geen link',
        message: 'Er is nog geen actieve link. Wil je er nu één maken en meteen mailen?',
        confirmText: 'Maken en mailen',
      });
      if (!ok) return;
      try {
        const t = await FamiliePortaal.createOrReplace(id);
        await refreshStatus();
        url = FamiliePortaal.buildUrl(t.token);
      } catch (e) {
        Modal.show({ type: 'error', title: 'Aanmaken mislukt', message: e.message || String(e) });
        return;
      }
    }
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Versturen…';
    try {
      const ok = await mailLink(url);
      if (ok) Modal.show({ type: 'success', title: 'Verstuurd', message: `De link is gemaild naar ${d.contact_email}.` });
    } catch (e) {
      Modal.show({ type: 'error', title: 'Mailen mislukt', message: e.message || String(e) });
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });

  // ── Intrekken ──────────────────────────────────────────────────────
  $('#btn-portaal-revoke').addEventListener('click', async () => {
    const ok = await Modal.confirm({
      title: 'Link intrekken?',
      message: 'De familie kan de portaal-pagina daarna niet meer openen.',
      confirmText: 'Intrekken',
    });
    if (!ok) return;
    try {
      await FamiliePortaal.revoke(id);
      await refreshStatus();
    } catch (e) {
      Modal.show({ type: 'error', title: 'Intrekken mislukt', message: e.message || String(e) });
    }
  });

  // ── Kopiëren / openen ──────────────────────────────────────────────
  $('#btn-portaal-copy').addEventListener('click', async () => {
    const link = $('#portaal-link').value;
    try {
      await navigator.clipboard.writeText(link);
      const btn = $('#btn-portaal-copy');
      const orig = btn.textContent; btn.textContent = '✓ Gekopieerd';
      setTimeout(() => btn.textContent = orig, 1500);
    } catch (_) {}
  });
  $('#btn-portaal-open').addEventListener('click', () => {
    const link = $('#portaal-link').value;
    if (link) window.open(link, '_blank');
  });

  // ── Dagplanning: automatisch invullen / toevoegen / verwijderen ────
  $('#btn-portaal-dag-auto').addEventListener('click', async () => {
    const rows = $('#portaal-dag-rows');
    const heeftInhoud = rows.querySelector('.portaal-dag-row');
    if (heeftInhoud) {
      const ok = await Modal.confirm({
        title: 'Automatisch invullen?',
        message: 'De huidige dagplanning wordt vervangen door een voorstel uit de dossier-gegevens.',
        confirmText: 'Vervangen',
      });
      if (!ok) return;
    }
    const auto = autoDagplanning(d);
    if (!auto.length) {
      Modal.show({ type: 'info', title: 'Niets te vullen', message: 'Er staan nog geen uitvaart-, avondwake- of begraafgegevens in het dossier.' });
      return;
    }
    rows.innerHTML = auto.map((it, i) => renderPortaalDagRow(it, i)).join('');
  });
  $('#btn-portaal-dag-add').addEventListener('click', () => {
    const rows = $('#portaal-dag-rows');
    const idx = rows.querySelectorAll('.portaal-dag-row').length;
    rows.insertAdjacentHTML('beforeend', renderPortaalDagRow({ tijd: '', moment: '', locatie: '' }, idx));
  });

  // ── Checklist: toevoegen ───────────────────────────────────────────
  $('#btn-portaal-check-add').addEventListener('click', () => {
    const rows = $('#portaal-checklist-rows');
    const idx = rows.querySelectorAll('.portaal-item').length;
    rows.insertAdjacentHTML('beforeend', renderPortaalChecklistRow({ titel: '', beschrijving: '' }, idx));
  });

  // ── Rij-verwijderknoppen (delegatie) ───────────────────────────────
  $('#portaal-config').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.getAttribute('data-action');
    if (act === 'del-dag-row' || act === 'del-check-row') {
      const row = btn.closest('.portaal-dag-row, .portaal-item');
      if (row) row.remove();
    }
  });

  // ── Voorbeeld bekijken ─────────────────────────────────────────────
  $('#btn-portaal-preview').addEventListener('click', () => {
    const link = ($('#portaal-link') && $('#portaal-link').value) || '';
    if (link) { window.open(link, '_blank'); return; }
    Modal.show({ type: 'info', title: 'Nog geen link', message: 'Maak eerst een deel-link aan om het voorbeeld te kunnen bekijken.' });
  });

  // ── Opslaan (welkomtekst + dagplanning + checklist) ────────────────
  $('#btn-portaal-save').addEventListener('click', async () => {
    const welkom = $('#portaal-welkomtekst').value.trim();
    const dagplanning = Array.from(document.querySelectorAll('#portaal-dag-rows .portaal-dag-row')).map(row => ({
      tijd: row.querySelector('.portaal-dag-tijd').value.trim(),
      moment: row.querySelector('.portaal-dag-moment').value.trim(),
      locatie: row.querySelector('.portaal-dag-locatie').value.trim(),
    })).filter(r => r.moment || r.tijd || r.locatie);
    const checklist = Array.from(document.querySelectorAll('#portaal-checklist-rows .portaal-item')).map(row => ({
      titel: row.querySelector('.portaal-item-titel').value.trim(),
      beschrijving: row.querySelector('.portaal-item-desc').value.trim(),
    })).filter(it => it.titel);

    const btn = $('#btn-portaal-save');
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Bezig…';
    try {
      await DB.update(KEYS.DOSSIERS, id, {
        familie_welkomtekst: welkom || null,
        familie_dagplanning: dagplanning,
        familie_checklist: checklist,
      });
      // Lokale kopie bijwerken zodat opnieuw renderen de nieuwe data toont
      d.familie_welkomtekst = welkom || null;
      d.familie_dagplanning = dagplanning;
      d.familie_checklist = checklist;
      Modal.show({ type: 'success', title: 'Opgeslagen', message: 'De familie ziet de wijzigingen meteen op hun pagina.' });
    } catch (e) {
      Modal.show({ type: 'error', title: 'Opslaan mislukt', message: e.message || String(e) });
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });
}

// ─── Door familie geüploade ID-kaarten (beheer-kant) ──────────────────────
const PORTAAL_ID_SLOTS = [
  { key: 'overledene_voor',   label: 'Overledene · voorkant' },
  { key: 'overledene_achter', label: 'Overledene · achterkant' },
  { key: 'contact_voor',      label: 'Contactpersoon · voorkant' },
  { key: 'contact_achter',    label: 'Contactpersoon · achterkant' },
];

async function loadPortaalIdCards(dossierId) {
  const grid = document.getElementById('portaal-id-grid');
  if (!grid) return;
  let rows = [];
  try {
    const { data, error } = await sb.from('familie_id_uploads')
      .select('slot,data_url,uploaded_at').eq('dossier_id', dossierId);
    if (error) throw error;
    rows = data || [];
  } catch (_) {
    grid.innerHTML = '<p class="muted small">Kon de uploads niet laden.</p>';
    return;
  }
  const bySlot = {};
  rows.forEach(r => { bySlot[r.slot] = r; });

  grid.innerHTML = PORTAAL_ID_SLOTS.map(s => {
    const r = bySlot[s.key];
    if (r && r.data_url) {
      const when = r.uploaded_at ? new Date(r.uploaded_at).toLocaleString('nl-NL') : '';
      return `
        <figure class="portaal-id-card" data-slot="${s.key}">
          <img src="${r.data_url}" alt="${esc(s.label)}" data-action="id-zoom">
          <figcaption>
            <strong>${esc(s.label)}</strong>
            <span class="muted small">${esc(when)}</span>
            <span class="portaal-id-acties">
              <a class="btn btn-sm btn-ghost" href="${r.data_url}" download="id-${s.key}.jpg">⬇︎</a>
              <button type="button" class="btn btn-sm btn-ghost" data-action="id-del" data-slot="${s.key}" title="Verwijderen">🗑</button>
            </span>
          </figcaption>
        </figure>`;
    }
    return `
      <figure class="portaal-id-card empty">
        <div class="portaal-id-placeholder">nog niet geüpload</div>
        <figcaption><strong>${esc(s.label)}</strong></figcaption>
      </figure>`;
  }).join('');

  grid.onclick = async (e) => {
    const zoom = e.target.closest('[data-action="id-zoom"]');
    if (zoom) { openImageLightbox(zoom.getAttribute('src')); return; }
    const del = e.target.closest('[data-action="id-del"]');
    if (del) {
      const ok = await Modal.confirm({ title: 'Foto verwijderen?', message: 'De familie kan later opnieuw uploaden.', confirmText: 'Verwijderen' });
      if (!ok) return;
      try {
        await sb.from('familie_id_uploads').delete()
          .eq('dossier_id', dossierId).eq('slot', del.getAttribute('data-slot'));
        loadPortaalIdCards(dossierId);
      } catch (_) {
        Modal.show({ type: 'error', title: 'Verwijderen mislukt', message: 'Probeer het opnieuw.' });
      }
    }
  };
}

function openImageLightbox(src) {
  const ov = document.createElement('div');
  ov.className = 'img-lightbox';
  ov.innerHTML = `<div class="img-lightbox-backdrop"></div><img src="${src}" alt="">`;
  ov.addEventListener('click', () => ov.remove());
  document.body.appendChild(ov);
}
