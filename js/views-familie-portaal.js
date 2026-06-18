// Familie-portaal: publieke, leesbare pagina die familie via een token-link
// kan openen. Geen login nodig. Toont alleen de praktische info — geen
// gevoelige administratie (kosten, BSN, notities).

const FamiliePortaalView = {
  async render(token) {
    // Volledig overschrijven van de pagina-inhoud — geen app-shell,
    // geen topbar, geen login-screen. Familie ziet een schoon scherm.
    document.body.classList.add('familie-portaal-body');
    const root = document.getElementById('view') || document.body;

    // Verberg de admin-app shell (topbar/footer) als die rondhangt
    document.querySelectorAll('#login-screen, #profile-screen, .topbar, .footer, .splash').forEach(el => el && (el.hidden = true));
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
              <strong>${esc(s.app_name || 'Uitvaartbeheer')}</strong>
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
    const checklist = Array.isArray(d.familie_checklist) ? d.familie_checklist : [];

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
              <strong>${esc(s.app_name || 'Uitvaartbeheer')}</strong>
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
        </main>

        ${FamiliePortaalView._footerHtml()}
      </div>`;
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
