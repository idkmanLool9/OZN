// Familie-portaal: publieke, leesbare pagina die familie via een token-link
// kan openen. Geen login nodig. Toont alleen de praktische info — geen
// gevoelige administratie (kosten, BSN, notities).

const FamiliePortaalView = {
  _token: null,

  async render(token) {
    // Volledig overschrijven van de pagina-inhoud — geen app-shell,
    // geen zijbalk, geen topbar, geen login-screen. Familie ziet een schoon
    // scherm (verbergen gebeurt via .familie-portaal-body in de CSS).
    FamiliePortaalView._token = token;
    document.body.classList.add('familie-portaal-body');
    const root = document.getElementById('view') || document.body;

    // Verberg de admin-app shell (zijbalk/topbar/footer). Naast het CSS-regel
    // óók inline display:none !important, zodat het werkt zelfs met een oude
    // gecachte stylesheet.
    document.querySelectorAll('#login-screen, #profile-screen, .sidebar, .topbar, .footer, .splash').forEach(el => {
      if (!el) return;
      el.hidden = true;
      try { el.style.setProperty('display', 'none', 'important'); } catch (_) {}
    });
    const app = document.getElementById('app');
    if (app) app.hidden = false;

    root.innerHTML = `
      <div class="fp-page">
        <div class="fp-loading">
          <div class="splash-spinner"></div>
          <p class="muted">Even laden…</p>
        </div>
      </div>`;

    let data = null;
    try {
      const { data: rpcData, error } = await sb.rpc('get_familie_portaal', { p_token: token });
      if (error) throw error;
      data = rpcData;
    } catch (e) {
      FamiliePortaalView._renderError('De verbinding met de server lukte niet. Probeer het opnieuw of vraag de uitvaartleider om een nieuwe link.');
      return;
    }

    if (!data) {
      FamiliePortaalView._renderError('Deze link is verlopen of bestaat niet meer. Vraag de uitvaartleider om een nieuwe link.');
      return;
    }

    FamiliePortaalView._renderContent(data);
  },

  _renderError(msg) {
    const root = document.getElementById('view');
    const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
    root.innerHTML = `
      <div class="fp-page">
        <header class="fp-header">
          <div class="fp-brand">
            <div class="fp-cross">✝</div>
            <div>
              <strong>${esc(s.app_name || 'Uitvaart Intake')}</strong>
              <span>${esc(s.app_tagline || '')}</span>
            </div>
          </div>
        </header>
        <main class="fp-main">
          <div class="fp-error-card">
            <div class="fp-error-icon">⚠</div>
            <h1>Link niet meer geldig</h1>
            <p>${esc(msg)}</p>
          </div>
        </main>
        ${FamiliePortaalView._footerHtml()}
      </div>`;
  },

  _renderContent(d) {
    const root = document.getElementById('view');
    const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
    const naam = [d.voornaam, d.achternaam].filter(Boolean).join(' ') || 'Overledene';
    // Val terug op het standaard-sjabloon als er voor dit dossier nog niets
    // eigen is opgeslagen (defaults zitten in de meegeleverde app-instellingen).
    const _def = (key) => { try { return (typeof Settings !== 'undefined' && Settings.get(key)) || []; } catch (_) { return []; } };
    const savedCheck = Array.isArray(d.familie_checklist) ? d.familie_checklist : [];
    const savedDag = Array.isArray(d.familie_dagplanning) ? d.familie_dagplanning : [];
    const checklist = savedCheck.length ? savedCheck : _def('portaal_default_checklist');
    const dagplanning = savedDag.length ? savedDag : _def('portaal_default_dagplanning');

    const datumTijd = (dt, t) => {
      if (!dt) return null;
      const lang = (typeof WheelDate !== 'undefined') ? WheelDate.formatLong(dt) : dt;
      return lang + (t ? ' om ' + t : '');
    };

    root.innerHTML = `
      <div class="fp-page">
        <header class="fp-header">
          <div class="fp-brand">
            <div class="fp-cross">✝</div>
            <div>
              <strong>${esc(s.app_name || 'Uitvaart Intake')}</strong>
              <span>${esc(s.app_tagline || '')}</span>
            </div>
          </div>
        </header>

        <main class="fp-main">
          ${d.familie_welkomtekst ? `
            <section class="fp-card fp-welkom">
              <p class="prewrap">${esc(d.familie_welkomtekst)}</p>
            </section>` : ''}

          <section class="fp-card">
            <h1 class="fp-titel">${esc(naam)}</h1>
            <p class="fp-sub">
              ${d.geboortedatum ? '<span>geboren ' + esc(WheelDate.formatLong(d.geboortedatum)) + '</span>' : ''}
              ${d.geboortedatum && d.overlijdensdatum ? '<span class="fp-dot">·</span>' : ''}
              ${d.overlijdensdatum ? '<span>overleden ' + esc(WheelDate.formatLong(d.overlijdensdatum)) + '</span>' : ''}
            </p>
          </section>

          ${FamiliePortaalView._dagplanningBlock(dagplanning)}

          ${FamiliePortaalView._infoBlock('De uitvaart', [
            ['Datum & tijd', datumTijd(d.uitvaart_datum, d.uitvaart_tijd)],
            ['Type', d.uitvaart_type],
            ['Kerk / dienstlocatie', d.kerk_locatie],
            ['Parochie', d.parochie],
            ['Priester', d.priester],
            ['Begraafplaats', d.begraafplaats],
          ])}

          ${FamiliePortaalView._infoBlock('Huisbezoek en avondwake', [
            ['Huisbezoek', datumTijd(d.huisbezoek_datum, d.huisbezoek_tijd)],
            ['Avondwake', datumTijd(d.avondwake_datum, d.avondwake_tijd)],
            ['Locatie avondwake', d.avondwake_locatie],
            ['Condoleance', d.condoleance_locatie],
          ])}

          ${checklist.length ? `
            <section class="fp-card">
              <h2>Voorbereiding</h2>
              <p class="muted small">Dingen die voor de uitvaart geregeld of meegenomen moeten worden.</p>
              <ul class="fp-checklist">
                ${checklist.map(it => `
                  <li>
                    <span class="fp-check-mark" aria-hidden="true">○</span>
                    <div>
                      <strong>${esc(it.titel || '')}</strong>
                      ${it.beschrijving ? '<p>' + esc(it.beschrijving) + '</p>' : ''}
                    </div>
                  </li>
                `).join('')}
              </ul>
            </section>` : ''}

          ${FamiliePortaalView._idUploadBlock(d)}
        </main>

        ${FamiliePortaalView._footerHtml()}
      </div>`;

    FamiliePortaalView._bindUploads();
  },

  // Optionele ID-kaart-upload: overledene + contactpersoon, voor + achter.
  _idUploadBlock(d) {
    const status = (d && d.familie_id_status) || {};
    const slot = (key, label) => {
      const done = !!status[key];
      return `
        <label class="fp-id-slot ${done ? 'done' : ''}" data-slot="${key}">
          <span class="fp-id-cam" aria-hidden="true">${done ? '✓' : '📷'}</span>
          <span class="fp-id-text">
            <strong>${esc(label)}</strong>
            <span class="fp-id-status">${done ? 'geüpload — tik om te vervangen' : 'tik om te uploaden'}</span>
          </span>
          <input type="file" accept="image/*" capture="environment" hidden>
        </label>`;
    };
    return `
      <section class="fp-card fp-id">
        <h2>Identiteitsbewijs <span class="muted small">(optioneel)</span></h2>
        <p class="muted small">U kunt hier alvast een foto van de identiteitskaart uploaden — voor- en achterkant, van de overledene en van uzelf. Dit hoeft niet, maar scheelt tijd.</p>
        <div class="fp-id-groep">
          <h3>Overledene</h3>
          <div class="fp-id-slots">
            ${slot('overledene_voor', 'Voorkant')}
            ${slot('overledene_achter', 'Achterkant')}
          </div>
        </div>
        <div class="fp-id-groep">
          <h3>Contactpersoon (uzelf)</h3>
          <div class="fp-id-slots">
            ${slot('contact_voor', 'Voorkant')}
            ${slot('contact_achter', 'Achterkant')}
          </div>
        </div>
      </section>`;
  },

  _bindUploads() {
    document.querySelectorAll('.fp-id-slot').forEach(label => {
      const input = label.querySelector('input[type="file"]');
      const slot = label.getAttribute('data-slot');
      const statusEl = label.querySelector('.fp-id-status');
      const camEl = label.querySelector('.fp-id-cam');
      if (!input) return;
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (!file) return;
        if (!navigator.onLine) { statusEl.textContent = 'geen internet — probeer opnieuw'; return; }
        label.classList.add('busy');
        statusEl.textContent = 'bezig met uploaden…';
        try {
          const small = (typeof compressImage === 'function') ? await compressImage(file, 1600, 0.72) : file;
          const dataUrl = await FamiliePortaalView._fileToDataUrl(small);
          const { data, error } = await sb.rpc('familie_portaal_upload_id', {
            p_token: FamiliePortaalView._token, p_slot: slot, p_data_url: dataUrl,
          });
          if (error) throw error;
          if (data && data.ok) {
            label.classList.add('done');
            camEl.textContent = '✓';
            statusEl.textContent = 'geüpload — tik om te vervangen';
          } else {
            statusEl.textContent = (data && data.error === 'ongeldige_link')
              ? 'link verlopen — vraag een nieuwe' : 'uploaden mislukt, probeer opnieuw';
          }
        } catch (_) {
          statusEl.textContent = 'uploaden mislukt, probeer opnieuw';
        } finally {
          label.classList.remove('busy');
        }
      });
    });
  },

  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  },

  _dagplanningBlock(rows) {
    const filled = (rows || []).filter(r => r && (r.moment || r.tijd || r.locatie));
    if (!filled.length) return '';
    return `
      <section class="fp-card">
        <h2>Dagplanning</h2>
        <p class="muted small">Het tijdschema van de dag.</p>
        <ol class="fp-timeline">
          ${filled.map(r => `
            <li>
              <span class="fp-time">${esc(r.tijd || '')}</span>
              <span class="fp-dotline" aria-hidden="true"></span>
              <div class="fp-moment">
                <strong>${esc(r.moment || '')}</strong>
                ${r.locatie ? '<span>' + esc(r.locatie) + '</span>' : ''}
              </div>
            </li>
          `).join('')}
        </ol>
      </section>`;
  },

  _infoBlock(titel, rijen) {
    const filled = rijen.filter(([, v]) => v && String(v).trim());
    if (!filled.length) return '';
    return `
      <section class="fp-card">
        <h2>${esc(titel)}</h2>
        <dl class="fp-dl">
          ${filled.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        </dl>
      </section>`;
  },

  _footerHtml() {
    const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
    const linkStyle = 'color:#a8b3c6;text-decoration:none;';
    const contactParts = [];
    if (s.email_footer_phone)   contactParts.push(`<a href="tel:${esc(s.email_footer_phone.replace(/\s+/g, ''))}" style="${linkStyle}">${esc(s.email_footer_phone)}</a>`);
    if (s.email_footer_email)   contactParts.push(`<a href="mailto:${esc(s.email_footer_email)}" style="${linkStyle}">${esc(s.email_footer_email)}</a>`);
    if (s.email_footer_website) {
      const url = /^https?:\/\//.test(s.email_footer_website) ? s.email_footer_website : 'https://' + s.email_footer_website;
      const label = s.email_footer_website.replace(/^https?:\/\//, '').replace(/\/$/, '');
      contactParts.push(`<a href="${esc(url)}" style="${linkStyle}">${esc(label)}</a>`);
    }
    return `
      <footer class="fp-footer">
        ${s.email_footer_address ? '<div class="fp-foot-addr">' + esc(s.email_footer_address) + '</div>' : ''}
        ${contactParts.length ? '<div class="fp-foot-contact">' + contactParts.join(' &nbsp;·&nbsp; ') + '</div>' : ''}
      </footer>`;
  },
};
