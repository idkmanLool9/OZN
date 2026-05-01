// Dossierlijst, account, 404

function renderDossierList(params, path) {
  const url = new URL(location.href);
  const q = (url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]).get('q') : '') || '';
  const status = (url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]).get('status') : '') || '';

  let dossiers = DB.list(KEYS.DOSSIERS);
  if (q) {
    const ql = q.toLowerCase();
    dossiers = dossiers.filter(d => {
      // Zoek over alle tekstuele velden van het dossier
      for (const k in d) {
        const v = d[k];
        if (v == null) continue;
        if (typeof v === 'string' && v.toLowerCase().includes(ql)) return true;
        if (typeof v === 'number' && String(v).includes(ql)) return true;
      }
      return false;
    });
  }
  if (status) dossiers = dossiers.filter(d => d.status === status);
  dossiers.sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <h1>Dossiers</h1>
        <a href="#/dossiers/nieuw" class="btn btn-primary">+ Nieuw dossier</a>
      </div>
      <form class="filter-bar" id="filter-form">
        <input type="search" name="q" value="${esc(q)}" placeholder="Zoek op naam, dossiernummer, gezinsnummer, contactpersoon..." />
        <select name="status">
          <option value="">Alle statussen</option>
          <option value="nieuw" ${status==='nieuw'?'selected':''}>Nieuw</option>
          <option value="in_behandeling" ${status==='in_behandeling'?'selected':''}>In behandeling</option>
          <option value="voltooid" ${status==='voltooid'?'selected':''}>Voltooid</option>
          <option value="geannuleerd" ${status==='geannuleerd'?'selected':''}>Geannuleerd</option>
        </select>
        <button type="submit" class="btn">Filteren</button>
        ${q || status ? '<a href="#/dossiers" class="btn btn-ghost">Wissen</a>' : ''}
      </form>
      ${dossiers.length === 0 ? '<div class="card"><p class="muted">Geen dossiers gevonden.</p></div>' :
      `<table class="table"><thead><tr>
        <th>Dossier</th><th>Overledene</th><th>Contactpersoon</th><th>Gezinsnr.</th><th>Overlijden</th><th>Uitvaart</th><th>Status</th>
      </tr></thead><tbody>
        ${dossiers.map(d => `<tr>
          <td><a href="#/dossiers/${d.id}">${esc(d.dossier_nummer)}</a></td>
          <td><strong>${esc(fullName(d) || '—')}</strong></td>
          <td>${esc(d.contact_naam || '—')}${d.contact_telefoon ? `<br><span class="muted small">${esc(d.contact_telefoon)}</span>` : ''}</td>
          <td>${esc(d.gezinsnummer || '—')}</td>
          <td>${esc(fmtDate(d.overlijdensdatum) || '—')}</td>
          <td>${esc(fmtDate(d.uitvaart_datum) || '—')}${d.uitvaart_tijd ? ' <span class="muted">' + esc(d.uitvaart_tijd) + '</span>' : ''}</td>
          <td><span class="status status-${esc(d.status||'nieuw')}">${esc((d.status||'nieuw').replace('_',' '))}</span></td>
        </tr>`).join('')}
      </tbody></table>`}
    </div>`;

  $('#filter-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const params = new URLSearchParams();
    if (f.q.value) params.set('q', f.q.value);
    if (f.status.value) params.set('status', f.status.value);
    location.hash = '#/dossiers' + (params.toString() ? '?' + params.toString() : '');
  });
}

function renderAccount(msg) {
  const u = Auth.current();
  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head"><h1>Mijn account</h1></div>
      <section class="card narrow">
        <h2>App-versie &amp; updates</h2>
        <dl class="dl">
          <div><dt>Huidige versie</dt><dd><strong id="cur-version">${esc(APP_VERSION)}</strong> — ${esc(APP_BUILD_DATE)}</dd></div>
          <div><dt>Service worker</dt><dd id="sw-status" class="muted small">${'serviceWorker' in navigator ? 'actief' : 'niet beschikbaar'}</dd></div>
        </dl>
        <div id="update-result"></div>
        <div class="form-actions" style="justify-content:flex-start;">
          <button type="button" class="btn btn-primary" id="btn-check-update">Check op updates</button>
        </div>
        <p class="muted small" style="margin-top:.5rem;">Forceert een controle op een nieuwere versie en herlaadt de service-worker. Daarna automatisch verversen.</p>
      </section>

      <section class="card narrow">
        <h2>Mijn gegevens</h2>
        <form id="profile-form" class="form" autocomplete="off">
          <label>
            <span>Naam (verschijnt in de topbalk)</span>
            <input type="text" name="full_name" value="${esc(u.fullName === u.email ? '' : (u.fullName || ''))}" placeholder="bv. Kevin Aydin" maxlength="60">
          </label>
          <label>
            <span>E-mailadres (login)</span>
            <input type="email" name="email" value="${esc(u.email)}" placeholder="">
            <span class="muted small">Wijzigen vereist verificatie via een e-mail naar zowel het oude als nieuwe adres.</span>
          </label>
          <label>
            <span>Rol</span>
            <input type="text" value="${esc(u.role || '—')}" disabled>
          </label>
          <div class="form-actions" style="justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Opslaan</button>
          </div>
        </form>
      </section>
      <section class="card narrow">
        <h2>Wachtwoord wijzigen</h2>
        ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
        ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
        <form id="pw-form" class="form" autocomplete="off">
          <label><span>Nieuw wachtwoord</span><input type="password" name="nieuw" required minlength="6"></label>
          <label><span>Herhaal nieuw wachtwoord</span><input type="password" name="herhaal" required minlength="6"></label>
          <button type="submit" class="btn btn-primary">Wachtwoord wijzigen</button>
        </form>
      </section>
      <section class="card narrow">
        <h2>Branding</h2>
        <p class="muted small">Logo, naam en kleuren van de app aanpassen.</p>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="brand-form" class="form" autocomplete="off">
            <label>
              <span>App-naam</span>
              <input type="text" name="app_name" value="${esc(s.app_name)}" maxlength="60">
            </label>
            <label>
              <span>Ondertitel / organisatie</span>
              <input type="text" name="app_tagline" value="${esc(s.app_tagline)}" maxlength="120">
            </label>

            <div class="grid-2" style="gap:.85rem;">
              <label>
                <span>Hoofdkleur</span>
                <input type="color" name="primary_color" value="${esc(s.primary_color)}">
              </label>
              <label>
                <span>Accentkleur</span>
                <input type="color" name="accent_color" value="${esc(s.accent_color)}">
              </label>
            </div>

            <label>
              <span>Logo (jpg/png/svg, max 1 MB)</span>
              <span class="muted small" style="margin-bottom:.35rem;display:block;">
                Wordt gebruikt in de app, als <strong>favicon</strong> in het browsertabblad én als <strong>homescreen-icoon</strong> wanneer de app op een telefoon/desktop wordt geïnstalleerd. Voor reeds geïnstalleerde PWA's: kort verwijderen en opnieuw aan beginscherm toevoegen om het nieuwe icoon te zien.
              </span>
              <div class="logo-row">
                <div class="logo-preview" id="logo-preview">
                  ${s.logo_data_url
                    ? `<img src="${esc(s.logo_data_url)}" alt="Logo">`
                    : '<span>✝</span>'}
                </div>
                <div class="logo-actions">
                  <label class="btn btn-sm">Bestand kiezen<input type="file" name="logo_file" accept="image/*" hidden id="logo-input"></label>
                  ${s.logo_data_url ? '<button type="button" class="btn btn-sm btn-ghost" id="btn-remove-logo">Verwijder logo</button>' : ''}
                </div>
              </div>
            </label>

            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-reset-brand">Standaardwaarden</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow">
        <h2>Weergave</h2>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="ui-form" class="form" autocomplete="off">
            <label>
              <span>Lettertype</span>
              <select name="font_id" id="font-select">
                ${FONTS.map(f => `<option value="${esc(f.id)}" ${s.font_id===f.id?'selected':''}>${esc(f.label)}</option>`).join('')}
              </select>
              <span class="muted small">Niet-systeemfonts worden geladen via Google Fonts en daarna lokaal gecached (werken ook offline na de eerste keer).</span>
            </label>

            <label>
              <span>Formulier-dichtheid</span>
              <select name="form_density">
                <option value="compact"    ${s.form_density==='compact'?'selected':''}>Compact (kleinere velden, dichter op elkaar)</option>
                <option value="normaal"    ${(s.form_density||'normaal')==='normaal'?'selected':''}>Normaal — aanbevolen</option>
                <option value="ruim"       ${s.form_density==='ruim'?'selected':''}>Ruim (grotere velden, meer ruimte tussen rijen)</option>
                <option value="extraruim"  ${s.form_density==='extraruim'?'selected':''}>Extra ruim (max grote velden, voor tablets en touchscreens)</option>
              </select>
              <span class="muted small">Past de grootte van invulvelden en spacing in formulieren aan.</span>
            </label>
            <div class="font-preview" id="font-preview">
              <h3 style="margin:0 0 .25rem;">In den naam van de Vader</h3>
              <p style="margin:0;">De familie nodigt u uit voor de uitvaart van een geliefde. <em>Mor Severios</em> · 14:00 uur · Hengelo. Aansluitend condoleance met koffie en simit.</p>
            </div>
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="compact_mode" ${s.compact_mode ? 'checked' : ''}>
              Compact-modus (kleinere tekst en meer informatie per scherm)
            </label>
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="rounded_cards" ${s.rounded_cards ? 'checked' : ''}>
              Afgeronde hoeken (uit = strakke vierkante stijl)
            </label>
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="catalog_admin_mode" ${s.catalog_admin_mode ? 'checked' : ''}>
              Beheermodus voor catalogi (toont knoppen om foto's te vervangen, bloemen/eten-producten toe te voegen of te verwijderen)
            </label>
            <div class="form-actions" style="justify-content:flex-end;">
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="email-instellingen">
        <h2>E-mail verzenden (automatisch)</h2>
        <p class="muted small">
          Standaard openen de e-mail-knoppen je mail-app met de tekst klaar.
          Wil je dat de app de e-mail <strong>direct verstuurt</strong> (geen mail-app nodig),
          koppel dan een gratis EmailJS-account.
        </p>

        <details style="margin: .5rem 0 1rem;">
          <summary style="cursor:pointer; font-weight:600;">Eenmalige setup (5 minuten) — klik voor instructies</summary>
          <ol class="muted small" style="padding-left:1.5rem; line-height:1.55; margin-top:.5rem;">
            <li>Maak een gratis account op <a href="https://emailjs.com" target="_blank" rel="noopener">emailjs.com</a> (200 mails/maand gratis)</li>
            <li>In <strong>Email Services</strong>: voeg je Gmail of Outlook toe en klik <em>Connect Account</em>. Onthoud de <strong>Service ID</strong> (begint met <code>service_</code>)</li>
            <li>In <strong>Email Templates</strong>: maak een nieuw template aan
              <ul>
                <li>To Email: <code>{{to_email}}</code></li>
                <li>From Name: <code>{{from_name}}</code></li>
                <li>Subject: <code>{{subject}}</code></li>
                <li>Content: <code>{{message}}</code></li>
              </ul>
              Sla op en onthoud de <strong>Template ID</strong> (begint met <code>template_</code>)
            </li>
            <li>In <strong>Account → General</strong>: kopieer je <strong>Public Key</strong></li>
            <li>Plak alle drie hieronder en klik <em>Test verzenden</em></li>
          </ol>
        </details>

        ${(() => {
          const s = Settings.all();
          return `
          <form id="email-form" class="form" autocomplete="off">
            <label><span>EmailJS Public Key</span><input type="text" name="emailjs_public_key" value="${esc(s.emailjs_public_key)}" placeholder="bv. xK_abc123..."></label>
            <label><span>EmailJS Service ID</span><input type="text" name="emailjs_service_id" value="${esc(s.emailjs_service_id)}" placeholder="bv. service_abc123"></label>
            <label><span>EmailJS Template ID</span><input type="text" name="emailjs_template_id" value="${esc(s.emailjs_template_id)}" placeholder="bv. template_abc123"></label>
            <label><span>Test-e-mailadres (voor verificatie)</span><input type="email" name="email_test_to" placeholder="bv. je eigen e-mail"></label>
            <div id="email-test-result"></div>
            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-email-test">Test verzenden</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="verzekeringen">
        <h2>Verzekeringsmaatschappijen &amp; pakketten</h2>
        <p class="muted small">Suggesties die in de intake-dropdown verschijnen wanneer een dossier 'met verzekering' is.</p>
        ${(() => {
          const ms = Settings.get('verzekering_maatschappijen') || [];
          const pk = Settings.get('verzekering_pakketten') || [];
          return `
          <form id="verz-form" class="form" autocomplete="off">
            <label><span>Maatschappijen (één per regel)</span>
              <textarea name="maatschappijen" rows="6" placeholder="DELA&#10;Monuta&#10;...">${esc(ms.join('\n'))}</textarea>
            </label>
            <label><span>Pakket-uitvoeringen (één per regel)</span>
              <textarea name="pakketten" rows="4" placeholder="Standaard pakket&#10;Vrije keuze&#10;...">${esc(pk.join('\n'))}</textarea>
            </label>
            <div class="form-actions" style="justify-content:flex-end;">
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="handtekeningen">
        <h2>Handtekening-velden</h2>
        <p class="muted small">Bepaal welke handtekeningen worden gevraagd bij het aanmaken/bewerken van een dossier. Verplichte velden moeten ingevuld zijn voor opslaan.</p>
        ${(() => {
          const fields = Settings.get('signature_fields') || [];
          return `
          <form id="sig-form" class="form" autocomplete="off">
            <div id="sig-rows">
              ${fields.map((f, i) => `
                <div class="sig-row" data-idx="${i}">
                  <input type="text" class="sig-label" value="${esc(f.label)}" placeholder="bv. Handtekening opdrachtgever">
                  <label class="checkbox-inline" style="font-size:.85rem;white-space:nowrap;">
                    <input type="checkbox" class="sig-required" ${f.required ? 'checked' : ''}> verplicht
                  </label>
                  <button type="button" class="btn-icon" data-action="del-sig" data-idx="${i}" title="verwijderen">×</button>
                </div>`).join('')}
            </div>
            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-add-sig">+ Veld toevoegen</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow">
        <h2>Welkomscherm-instellingen</h2>
        <p class="muted small">Het welkomscherm verschijnt wanneer je de app opent. Online verdwijnt het automatisch; offline blijft het staan totdat je op "Verder" klikt.</p>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="splash-form" class="form" autocomplete="off">
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="splash_enabled" ${s.splash_enabled ? 'checked' : ''}>
              Welkomscherm tonen bij appstart
            </label>

            <label>
              <span>Duur online (seconden) — <strong id="dur-label">${(s.splash_duration_ms/1000).toFixed(1)}s</strong></span>
              <input type="range" name="splash_duration_ms" min="500" max="6000" step="100" value="${s.splash_duration_ms}" id="dur-range">
              <span class="muted small">Tussen 0,5s en 6,0s. Klikken/Enter slaat het altijd direct over.</span>
            </label>

            <label>
              <span>Animatie</span>
              <select name="splash_animation">
                <option value="glass" ${s.splash_animation==='glass'?'selected':''}>Glas (zacht vervagen + verkleinen) — aanbevolen</option>
                <option value="fade"  ${s.splash_animation==='fade' ?'selected':''}>Vervagen (eenvoudig)</option>
                <option value="scale" ${s.splash_animation==='scale'?'selected':''}>Inzoomen</option>
                <option value="slide" ${s.splash_animation==='slide'?'selected':''}>Naar boven schuiven</option>
              </select>
            </label>

            <label>
              <span>Titel (online)</span>
              <input type="text" name="splash_title" value="${esc(s.splash_title)}" maxlength="60">
            </label>

            <label>
              <span>Titel (offline)</span>
              <input type="text" name="splash_offline_title" value="${esc(s.splash_offline_title)}" maxlength="60">
            </label>

            <label>
              <span>Ondertitel</span>
              <input type="text" name="splash_subtitle" value="${esc(s.splash_subtitle)}" maxlength="120">
            </label>

            <div class="form-actions" style="justify-content:space-between;">
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-ghost" id="btn-preview-online">Voorbeeld online</button>
                <button type="button" class="btn btn-ghost" id="btn-preview-offline">Voorbeeld offline</button>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-ghost" id="btn-reset-splash">Standaardwaarden</button>
                <button type="submit" class="btn btn-primary">Opslaan</button>
              </div>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow">
        <h2>Data &amp; synchronisatie</h2>
        ${(() => {
          const m = (() => { try { return JSON.parse(localStorage.getItem('sok_mirror') || '{}'); } catch (_) { return {}; } })();
          const lastSync = m.savedAt ? new Date(m.savedAt) : null;
          const offline = !!Cloud.offline || !navigator.onLine;
          const cnt = {
            dossiers: DB.list(KEYS.DOSSIERS).length,
            taken: DB.list(KEYS.TAKEN).length,
            kosten: DB.list(KEYS.KOSTEN).length,
            notities: DB.list(KEYS.NOTITIES).length,
            documenten: DB.list(KEYS.DOCUMENTEN).length,
            kisten_fotos: DB.list(KEYS.KIST_AFBEELDINGEN).length,
            bloemen: DB.list(KEYS.BLOEMEN).length,
            eten_drinken: DB.list(KEYS.ETEN_DRINKEN).length,
          };
          return `
          <div class="alert ${offline ? 'alert-error' : 'alert-success'}" style="margin-bottom:.75rem;">
            <strong>${offline ? '⚠ Offline — leesmodus' : '✓ Veilig in de cloud'}</strong>
            <p class="muted small" style="margin:.35rem 0 0;color:inherit;opacity:.9;">
              Alle dossiers, taken, kosten, notities, documenten, foto's én instellingen worden opgeslagen in Supabase (EU-regio).
              ${offline
                ? 'Op dit moment offline — wijzigingen kunnen pas worden opgeslagen zodra je weer internet hebt. Bestaande gegevens blijven veilig staan.'
                : 'Op elk apparaat zichtbaar zodra je inlogt. localStorage wordt enkel als offline-kopie gebruikt — niets gaat verloren bij cache wissen of nieuwe browser.'}
            </p>
          </div>
          <dl class="dl" style="grid-template-columns: 1fr 1fr;">
            <div><dt>Dossiers</dt><dd><strong>${cnt.dossiers}</strong></dd></div>
            <div><dt>Taken</dt><dd>${cnt.taken}</dd></div>
            <div><dt>Kostenposten</dt><dd>${cnt.kosten}</dd></div>
            <div><dt>Notities</dt><dd>${cnt.notities}</dd></div>
            <div><dt>Documenten</dt><dd>${cnt.documenten}</dd></div>
            <div><dt>Bloemstukken</dt><dd>${cnt.bloemen}</dd></div>
            <div><dt>Eten &amp; drinken</dt><dd>${cnt.eten_drinken}</dd></div>
            <div><dt>Kistfoto's</dt><dd>${cnt.kisten_fotos}</dd></div>
            <div style="grid-column:span 2;"><dt>Laatst gesynchroniseerd</dt><dd>${lastSync ? lastSync.toLocaleString('nl-NL') : '—'}</dd></div>
          </dl>
          <div class="form-actions" style="justify-content:flex-start; gap:.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="btn-sync-now" ${offline ? 'disabled' : ''}>Sync nu opnieuw</button>
            <button type="button" class="btn" id="btn-export">Exporteer alle data (JSON)</button>
          </div>
          <p class="muted small" style="margin-top:.75rem;">
            Een JSON-export geeft je een volledig lokaal back-upbestand met alle dossiergegevens — voor in een veilige map of op een externe schijf, los van Supabase.
          </p>

          <details style="margin-top:1rem;">
            <summary style="cursor:pointer; font-weight:600;">Wat zijn de limieten van het Supabase Free-plan?</summary>
            <div class="muted small" style="margin-top:.5rem; line-height:1.55;">
              <p style="margin:.25rem 0;"><strong>Database</strong>: 500 MB — voor jouw dossiergegevens (tekst) ruim voldoende voor jaren.</p>
              <p style="margin:.25rem 0;"><strong>Storage</strong>: 1 GB totaal — voor foto's en documenten.
                Foto's worden bij upload <strong>automatisch verkleind</strong> (max ±1600 px, JPEG 85%) zodat een telefoon-foto van 8 MB als ~400 KB wordt opgeslagen.</p>
              <p style="margin:.25rem 0;"><strong>Bandbreedte</strong>: 5 GB/maand — alle keren dat foto's en documenten worden bekeken.</p>
              <p style="margin:.25rem 0;"><strong>Inactiviteit</strong>: na 1 week zonder activiteit wordt het project tijdelijk gepauzeerd; één login activeert het weer. Pas na 90+ dagen onafgebroken inactiviteit kan Supabase het project verwijderen (met e-mailwaarschuwing vooraf).</p>
              <p style="margin:.5rem 0;"><strong>Bij overschrijden van een limiet</strong>: nieuwe uploads/wijzigingen worden geblokkeerd, maar <strong>bestaande gegevens blijven bewaard</strong>. Niets wordt automatisch gewist.</p>
              <p style="margin:.25rem 0;"><strong>Adviezen</strong>:</p>
              <ul style="margin:.25rem 0 .25rem 1.25rem; padding:0;">
                <li>Maandelijks een JSON-export downloaden via de knop hierboven</li>
                <li>Periodiek inloggen via Supabase-dashboard om de opslaggrafiek te checken</li>
                <li>Bij ruimtegebrek: oude documenten van afgeronde dossiers handmatig verwijderen, of upgraden naar Pro ($25/m: 8 GB DB / 100 GB storage)</li>
              </ul>
            </div>
          </details>`;
        })()}
      </section>
    </div>`;

  // Branding-instellingen
  const brandForm = $('#brand-form');
  if (brandForm) {
    let pendingLogo = null; // tijdelijke logo-data tot opslaan

    $('#logo-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return alert('Alleen afbeeldingen toegestaan.');
      if (file.size > 1024 * 1024) return alert('Logo te groot (max. 1 MB).');
      if (!navigator.onLine) return alert('Logo uploaden kan alleen met internet (gaat naar de cloud).');
      const lbl = e.target.closest('label');
      if (lbl) { lbl.style.opacity = .55; lbl.textContent = 'Bezig met uploaden...'; }
      try {
        pendingLogo = await BrandingFotos.uploadLogo(file);
        const prev = $('#logo-preview');
        if (prev) prev.innerHTML = `<img src="${pendingLogo}" alt="Logo">`;
      } catch (err) {
        alert('Upload mislukt: ' + (err.message || err));
      } finally {
        if (lbl) { lbl.style.opacity = 1; }
      }
    });

    const removeBtn = $('#btn-remove-logo');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        pendingLogo = '';
        const prev = $('#logo-preview');
        if (prev) prev.innerHTML = '<span>✝</span>';
        // Bestand uit storage verwijderen (best-effort)
        if (navigator.onLine) await BrandingFotos.removeLogo().catch(() => {});
      });
    }

    brandForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const patch = {
        app_name: f.app_name.value.trim() || Settings.defaults.app_name,
        app_tagline: f.app_tagline.value.trim() || Settings.defaults.app_tagline,
        primary_color: f.primary_color.value || Settings.defaults.primary_color,
        accent_color: f.accent_color.value || Settings.defaults.accent_color,
      };
      if (pendingLogo !== null) patch.logo_data_url = pendingLogo;
      try {
        Settings.set(patch);
      } catch (err) {
        return renderAccount({ error: 'Opslaan mislukt — logo is mogelijk te groot voor lokale opslag.' });
      }
      Branding.apply();
      renderAccount({ success: 'Branding opgeslagen.' });
    });

    $('#btn-reset-brand').addEventListener('click', () => {
      if (!confirm('Branding terugzetten naar standaard? (logo wordt verwijderd)')) return;
      Settings.set({
        app_name: Settings.defaults.app_name,
        app_tagline: Settings.defaults.app_tagline,
        primary_color: Settings.defaults.primary_color,
        accent_color: Settings.defaults.accent_color,
        logo_data_url: Settings.defaults.logo_data_url,
      });
      Branding.apply();
      renderAccount({ success: 'Standaard branding hersteld.' });
    });
  }

  // Weergave-instellingen
  const uiForm = $('#ui-form');
  if (uiForm) {
    // Lettertype live toepassen bij wijzigen — voorbeeld is meteen zichtbaar
    const fontSel = $('#font-select');
    if (fontSel) {
      fontSel.addEventListener('change', () => applyFont(fontSel.value));
    }
    const densSel = uiForm.querySelector('select[name="form_density"]');
    if (densSel) {
      densSel.addEventListener('change', () => {
        document.body.classList.remove('density-compact','density-normaal','density-ruim','density-extraruim');
        document.body.classList.add('density-' + densSel.value);
      });
    }
    uiForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        compact_mode: f.compact_mode.checked,
        rounded_cards: f.rounded_cards.checked,
        font_id: f.font_id.value,
        form_density: f.form_density.value,
        catalog_admin_mode: f.catalog_admin_mode.checked,
      });
      Branding.apply();
      renderAccount({ success: 'Weergave-instellingen opgeslagen.' });
    });
  }

  // EmailJS-instellingen
  const emailForm = $('#email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        emailjs_public_key: f.emailjs_public_key.value.trim(),
        emailjs_service_id: f.emailjs_service_id.value.trim(),
        emailjs_template_id: f.emailjs_template_id.value.trim(),
      });
      renderAccount({ success: 'E-mail-instellingen opgeslagen.' });
    });

    $('#btn-email-test').addEventListener('click', async () => {
      const f = emailForm;
      const to = f.email_test_to.value.trim();
      const result = $('#email-test-result');
      result.innerHTML = '';
      if (!to) { result.innerHTML = '<div class="alert alert-error">Vul eerst een test-e-mailadres in.</div>'; return; }
      // Tijdelijk toepassen wat in het formulier staat (zonder eerst opslaan)
      Settings.set({
        emailjs_public_key: f.emailjs_public_key.value.trim(),
        emailjs_service_id: f.emailjs_service_id.value.trim(),
        emailjs_template_id: f.emailjs_template_id.value.trim(),
      });
      const btn = $('#btn-email-test');
      btn.disabled = true; const orig = btn.textContent;
      btn.textContent = 'Bezig met verzenden...';
      try {
        await EmailService.send(to,
          'Test — ' + (Settings.get('app_name') || 'Uitvaartbeheer'),
          'Dit is een test-e-mail vanuit je Uitvaartbeheer-app. Als je dit ontvangt, werkt de EmailJS-koppeling correct.');
        result.innerHTML = `<div class="alert alert-success">Test verstuurd naar ${esc(to)}. Check de inbox (en spam-map).</div>`;
      } catch (e) {
        result.innerHTML = `<div class="alert alert-error">Verzenden mislukt: ${esc(e && e.text ? e.text : (e.message || String(e)))}</div>`;
      } finally {
        btn.disabled = false; btn.textContent = orig;
      }
    });
  }

  // Update-check
  const updBtn = $('#btn-check-update');
  if (updBtn) {
    updBtn.addEventListener('click', async () => {
      const result = $('#update-result');
      updBtn.disabled = true; const orig = updBtn.textContent;
      updBtn.textContent = 'Bezig met controleren...';
      result.innerHTML = '';
      try {
        const r = await Updater.check();
        if (r.hasUpdate) {
          result.innerHTML = `<div class="alert alert-info">Nieuwe versie beschikbaar: <strong>${esc(r.remoteVersion)}</strong> (jij draait ${esc(r.currentVersion)}). De pagina wordt over enkele seconden ververst.</div>`;
          setTimeout(() => Updater.reloadHard(), 1800);
        } else if (r.swUpdated) {
          result.innerHTML = `<div class="alert alert-success">Service-worker bijgewerkt naar de laatste versie. Pagina wordt ververst...</div>`;
          setTimeout(() => Updater.reloadHard(), 1200);
        } else {
          result.innerHTML = `<div class="alert alert-success">Je draait al de laatste versie (<strong>${esc(r.currentVersion)}</strong>).</div>`;
          updBtn.disabled = false; updBtn.textContent = orig;
        }
      } catch (e) {
        result.innerHTML = `<div class="alert alert-error">Update-check mislukt: ${esc(e.message || e)}</div>`;
        updBtn.disabled = false; updBtn.textContent = orig;
      }
    });
  }

  // Verzekeringsmaatschappijen + pakketten beheer
  const verzForm = $('#verz-form');
  if (verzForm) {
    verzForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const parseList = txt => txt.split('\n').map(s => s.trim()).filter(Boolean);
      Settings.set({
        verzekering_maatschappijen: parseList(f.maatschappijen.value),
        verzekering_pakketten: parseList(f.pakketten.value),
      });
      renderAccount({ success: 'Verzekeringslijsten opgeslagen.' });
    });
  }

  // Handtekening-velden beheer
  const sigForm = $('#sig-form');
  if (sigForm) {
    function slug(s) {
      return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'veld';
    }
    function readSigRows() {
      return $$('#sig-rows .sig-row').map((row, i) => {
        const label = (row.querySelector('.sig-label').value || '').trim() || ('Handtekening ' + (i + 1));
        const required = row.querySelector('.sig-required').checked;
        return { id: slug(label) + '_' + i, label, required };
      });
    }
    $('#btn-add-sig').addEventListener('click', () => {
      const rows = $('#sig-rows');
      const idx = rows.children.length;
      const div = document.createElement('div');
      div.className = 'sig-row';
      div.dataset.idx = idx;
      div.innerHTML = `
        <input type="text" class="sig-label" value="" placeholder="bv. Handtekening getuige">
        <label class="checkbox-inline" style="font-size:.85rem;white-space:nowrap;">
          <input type="checkbox" class="sig-required"> verplicht
        </label>
        <button type="button" class="btn-icon" data-action="del-sig">×</button>`;
      rows.appendChild(div);
      div.querySelector('.sig-label').focus();
    });
    sigForm.addEventListener('click', e => {
      const del = e.target.closest('button[data-action="del-sig"]');
      if (!del) return;
      const row = del.closest('.sig-row');
      if (row) row.remove();
    });
    sigForm.addEventListener('submit', e => {
      e.preventDefault();
      const fields = readSigRows();
      Settings.set({ signature_fields: fields });
      renderAccount({ success: 'Handtekening-velden opgeslagen.' });
    });
  }

  // Splash-instellingen
  const splashForm = $('#splash-form');
  if (splashForm) {
    const durRange = $('#dur-range');
    const durLabel = $('#dur-label');
    durRange.addEventListener('input', () => {
      durLabel.textContent = (parseInt(durRange.value, 10)/1000).toFixed(1) + 's';
    });

    splashForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        splash_enabled: f.splash_enabled.checked,
        splash_duration_ms: parseInt(f.splash_duration_ms.value, 10),
        splash_animation: f.splash_animation.value,
        splash_title: f.splash_title.value.trim() || Settings.defaults.splash_title,
        splash_offline_title: f.splash_offline_title.value.trim() || Settings.defaults.splash_offline_title,
        splash_subtitle: f.splash_subtitle.value.trim() || Settings.defaults.splash_subtitle,
      });
      renderAccount({ success: 'Welkomscherm-instellingen opgeslagen.' });
    });

    $('#btn-reset-splash').addEventListener('click', () => {
      if (!confirm('Welkomscherm-instellingen terugzetten naar standaard?')) return;
      // Reset alleen splash-instellingen
      Settings.set({
        splash_enabled: Settings.defaults.splash_enabled,
        splash_duration_ms: Settings.defaults.splash_duration_ms,
        splash_animation: Settings.defaults.splash_animation,
        splash_title: Settings.defaults.splash_title,
        splash_offline_title: Settings.defaults.splash_offline_title,
        splash_subtitle: Settings.defaults.splash_subtitle,
      });
      renderAccount({ success: 'Standaardwaarden hersteld.' });
    });

    $('#btn-preview-online').addEventListener('click', () => {
      // Sla huidige formuliergegevens tijdelijk op zodat de preview ze gebruikt
      const f = splashForm;
      Settings.set({
        splash_animation: f.splash_animation.value,
        splash_duration_ms: parseInt(f.splash_duration_ms.value, 10),
        splash_title: f.splash_title.value.trim() || Settings.defaults.splash_title,
        splash_offline_title: f.splash_offline_title.value.trim() || Settings.defaults.splash_offline_title,
        splash_subtitle: f.splash_subtitle.value.trim() || Settings.defaults.splash_subtitle,
      });
      Splash.preview('online');
    });

    $('#btn-preview-offline').addEventListener('click', () => {
      const f = splashForm;
      Settings.set({
        splash_animation: f.splash_animation.value,
        splash_duration_ms: parseInt(f.splash_duration_ms.value, 10),
        splash_title: f.splash_title.value.trim() || Settings.defaults.splash_title,
        splash_offline_title: f.splash_offline_title.value.trim() || Settings.defaults.splash_offline_title,
        splash_subtitle: f.splash_subtitle.value.trim() || Settings.defaults.splash_subtitle,
      });
      Splash.preview('offline');
    });
  }

  const profileForm = $('#profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const newName = f.full_name.value.trim();
      const newEmail = f.email.value.trim();
      const cur = Auth.current();
      const messages = [];
      let hadError = null;

      // Naam wijzigen indien anders
      const curName = (cur.fullName === cur.email) ? '' : (cur.fullName || '');
      if (newName !== curName) {
        const err = await Auth.updateDisplayName(newName);
        if (err) hadError = 'Naam wijzigen mislukt: ' + err;
        else messages.push('Naam bijgewerkt.');
      }

      // E-mail wijzigen indien anders
      if (!hadError && newEmail && newEmail !== cur.email) {
        const ok = await Modal.confirm({
          type: 'warning',
          title: 'E-mailadres wijzigen?',
          message: `Je krijgt een verificatielink in ${newEmail}. Pas nadat je daarop klikt is het nieuwe adres actief. Doorgaan?`,
          confirmText: 'Ja, verstuur',
          cancelText: 'Annuleren',
        });
        if (ok) {
          const err = await Auth.updateEmail(newEmail);
          if (err) hadError = 'E-mailwijziging mislukt: ' + err;
          else messages.push(`Verificatielink verzonden naar ${newEmail}.`);
        }
      }

      if (hadError) renderAccount({ error: hadError });
      else if (messages.length > 0) {
        // Topbar bijwerken
        const cur2 = Auth.current();
        if (cur2) document.getElementById('user-name').textContent = cur2.fullName || cur2.email;
        renderAccount({ success: messages.join(' ') });
      } else {
        renderAccount(); // niets veranderd
      }
    });
  }

  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.nieuw.value !== f.herhaal.value) return renderAccount({ error: 'Wachtwoorden komen niet overeen.' });
    if (f.nieuw.value.length < 6) return renderAccount({ error: 'Minstens 6 tekens.' });
    const err = await Auth.changePassword(f.nieuw.value);
    renderAccount(err ? { error: err } : { success: 'Wachtwoord gewijzigd.' });
  });

  const syncBtn = $('#btn-sync-now');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      const orig = syncBtn.textContent;
      syncBtn.textContent = 'Bezig met synchroniseren...';
      try {
        await Cloud.loadAll();
        await Settings.loadFromCloud();
        Branding.apply();
        renderAccount({ success: 'Synchronisatie voltooid — alle gegevens zijn vers opgehaald.' });
      } catch (e) {
        syncBtn.disabled = false;
        syncBtn.textContent = orig;
        renderAccount({ error: 'Synchronisatie mislukt: ' + (e.message || 'geen verbinding') });
      }
    });
  }

  $('#btn-export').addEventListener('click', () => {
    const data = {
      dossiers: DB.list(KEYS.DOSSIERS),
      taken: DB.list(KEYS.TAKEN),
      kosten: DB.list(KEYS.KOSTEN),
      notities: DB.list(KEYS.NOTITIES),
      documenten: DB.list(KEYS.DOCUMENTEN),
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `uitvaart-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });
}

function render404() {
  $('#view').innerHTML = `<div class="page"><div class="card narrow center"><h1>404</h1><p>Deze pagina bestaat niet.</p><a href="#/" class="btn btn-primary">Terug naar dashboard</a></div></div>`;
}
