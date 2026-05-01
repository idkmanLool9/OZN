// Init: Supabase auth, route registratie, login form, offline-modus

const APP_VERSION = 'v25'; // wordt getoond in footer + welkomscherm zodat je ziet welke versie draait
const APP_BUILD_DATE = '2026-04-30';

// ─── Instellingen (cloud-first, localStorage als offline-spiegel) ──────────
const Settings = {
  KEY: 'sok_settings',          // lokale spiegel
  TABLE: 'app_instellingen',
  ROW_ID: 1,                    // single-row model
  _cache: null,                 // huidige overrides (zonder defaults)
  defaults: {
    splash_enabled: true,
    splash_duration_ms: 2500,
    splash_animation: 'glass', // 'glass' | 'fade' | 'scale' | 'slide'
    splash_title: 'Welkom',
    splash_subtitle: 'Uitvaartbeheer · Syrisch-Orthodoxe Kerk van Antiochië',
    splash_offline_title: 'Welkom terug',
    // Branding
    app_name: 'Uitvaartbeheer',
    app_tagline: 'Syrisch-Orthodoxe Kerk van Antiochië',
    primary_color: '#6b1e2a',
    accent_color: '#c9a24a',
    logo_data_url: '',
    // UI
    compact_mode: false,
    rounded_cards: true,
    font_id: 'default',
    form_density: 'normaal', // 'compact' | 'normaal' | 'ruim' | 'extraruim'
    // Beheermodus: knoppen 'Vervang foto' / 'Verwijder' tonen op
    // catalogi (kisten, bloemen, eten & drinken)
    catalog_admin_mode: false,
    // Handtekeningen-velden in het intake-formulier
    signature_fields: [
      { id: 'opdrachtgever',   label: 'Handtekening opdrachtgever',   required: true },
      { id: 'uitvaartleider',  label: 'Handtekening uitvaartleider',  required: true },
    ],
    // EmailJS-koppeling voor auto-versturen
    emailjs_public_key: '',
    emailjs_service_id: '',
    emailjs_template_id: '',
    // Verzekeringsmaatschappijen (datalist in intake)
    verzekering_maatschappijen: [
      'DELA', 'Monuta', 'Yarden', 'Ardanta', 'Nuvema', 'Klooster eigen polis',
    ],
    // Pakket-uitvoeringen
    verzekering_pakketten: [
      'Standaard pakket', 'Uitgebreid pakket', 'Vrije keuze', 'Maatwerk',
    ],
  },
  // Synchrone read uit cache + lokale spiegel
  _localOverrides() {
    if (Settings._cache) return Settings._cache;
    try { return JSON.parse(localStorage.getItem(Settings.KEY) || '{}') || {}; } catch (_) { return {}; }
  },
  all() { return Object.assign({}, Settings.defaults, Settings._localOverrides()); },
  get(key) { return Settings.all()[key]; },

  // Synchroon: update cache + lokale spiegel; cloud-push fire-and-forget
  set(patch) {
    const cur = Settings._localOverrides();
    const next = Object.assign({}, cur, patch);
    // Defaults eruit halen om de tabel klein te houden
    const trimmed = {};
    for (const k in next) if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
    Settings._cache = trimmed;
    try { localStorage.setItem(Settings.KEY, JSON.stringify(trimmed)); } catch (_) {}
    Settings._pushCloud(trimmed); // niet awaiten
  },

  // Geluidloos pushen naar Supabase
  _pushCloud(data) {
    if (!navigator.onLine) return;
    if (!Auth.current()) return;
    sb.from(Settings.TABLE)
      .upsert({ id: Settings.ROW_ID, data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .then(r => { if (r.error) console.warn('Settings cloud-push faalde:', r.error.message); })
      .catch(err => console.warn('Settings cloud-push error:', err));
  },

  // Bij login / app-start: haal de gedeelde instellingen op
  async loadFromCloud() {
    if (!Auth.current()) return;
    try {
      const { data, error } = await sb.from(Settings.TABLE)
        .select('data').eq('id', Settings.ROW_ID).maybeSingle();
      if (error) throw error;
      const cloud = (data && data.data) ? data.data : null;
      if (cloud === null || Object.keys(cloud).length === 0) {
        // Cloud is nog leeg — push de lokale overrides (eerste keer migratie)
        const local = Settings._localOverrides();
        if (Object.keys(local).length > 0) {
          Settings._pushCloud(local);
          Settings._cache = local;
        } else {
          Settings._cache = {};
        }
      } else {
        Settings._cache = cloud;
        try { localStorage.setItem(Settings.KEY, JSON.stringify(cloud)); } catch (_) {}
      }
    } catch (e) {
      // Offline of API-fout: gebruik de lokale spiegel
      try { Settings._cache = JSON.parse(localStorage.getItem(Settings.KEY) || '{}'); } catch (_) { Settings._cache = {}; }
    }
  },

  reset() {
    Settings._cache = {};
    localStorage.removeItem(Settings.KEY);
    Settings._pushCloud({});
  },
};

// ─── Lettertypen (curated lijst, Google Fonts gecached door SW) ─────────────
const FONTS = [
  { id: 'default',      label: 'Standaard — Georgia + systeem (klassiek + leesbaar)',
    body: '', heading: '', google: null },
  { id: 'system',       label: 'Sober — alleen systeemfonts',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    google: null },
  { id: 'inter',        label: 'Modern — Inter (strak, helder)',
    body: 'Inter, system-ui, sans-serif',
    heading: 'Inter, system-ui, sans-serif',
    google: 'family=Inter:wght@400;500;600;700' },
  { id: 'merriweather', label: 'Lezen — Merriweather (rustig, traditioneel)',
    body: 'Merriweather, Georgia, serif',
    heading: 'Merriweather, Georgia, serif',
    google: 'family=Merriweather:wght@400;700' },
  { id: 'playfair',     label: 'Plechtig — Playfair Display + Lora',
    body: 'Lora, Georgia, serif',
    heading: '"Playfair Display", Georgia, serif',
    google: 'family=Lora:wght@400;500;600&family=Playfair+Display:wght@600;700' },
  { id: 'crimson',      label: 'Literair — Crimson Pro',
    body: '"Crimson Pro", Georgia, serif',
    heading: '"Crimson Pro", Georgia, serif',
    google: 'family=Crimson+Pro:wght@400;600;700' },
  { id: 'notoserif',    label: 'Universeel — Noto Serif',
    body: '"Noto Serif", Georgia, serif',
    heading: '"Noto Serif", Georgia, serif',
    google: 'family=Noto+Serif:wght@400;600;700' },
];

function applyFont(fontId) {
  const f = FONTS.find(x => x.id === fontId) || FONTS[0];
  // Verwijder eventueel oude Google Fonts-link
  const old = document.getElementById('dynamic-font-link');
  if (old) old.remove();
  // Nieuwe Google Fonts-link injecteren als nodig
  if (f.google) {
    const link = document.createElement('link');
    link.id = 'dynamic-font-link';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${f.google}&display=swap`;
    document.head.appendChild(link);
  }
  // CSS-variabelen zetten (lege string = fallback in CSS)
  const root = document.documentElement;
  if (f.body)    root.style.setProperty('--font-body', f.body);    else root.style.removeProperty('--font-body');
  if (f.heading) root.style.setProperty('--font-heading', f.heading); else root.style.removeProperty('--font-heading');
}

// ─── Branding (logo, kleuren, app-naam, tagline) ────────────────────────────
const Branding = {
  apply() {
    const s = Settings.all();
    const root = document.documentElement;

    // Kleuren via CSS-variabelen (primary-dark/-soft worden automatisch
    // afgeleid via color-mix() in style.css)
    if (s.primary_color) root.style.setProperty('--primary', s.primary_color);
    if (s.accent_color)  root.style.setProperty('--accent',  s.accent_color);

    // Theme-color voor mobiele statusbalk
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && s.primary_color) meta.setAttribute('content', s.primary_color);

    // Tekst overal
    document.querySelectorAll('.brand-text strong').forEach(el => el.textContent = s.app_name);
    document.querySelectorAll('.brand-text small').forEach(el => el.textContent = s.app_tagline);
    document.querySelectorAll('.login-header h1').forEach(el => el.textContent = s.app_name);
    document.querySelectorAll('.login-header p:first-of-type').forEach(el => el.textContent = s.app_tagline);

    // Document-titel
    document.title = `${s.app_name} · ${s.app_tagline}`;

    // Logo: vervang ✝ door <img> als er een eigen logo is
    document.querySelectorAll('.brand-mark').forEach(el => {
      if (s.logo_data_url) {
        el.innerHTML = `<img src="${s.logo_data_url}" alt="Logo">`;
        el.classList.add('has-custom-logo');
      } else {
        el.innerHTML = '✝';
        el.classList.remove('has-custom-logo');
      }
    });

    // Compact / afgeronde hoeken
    document.body.classList.toggle('ui-compact', !!s.compact_mode);
    document.body.classList.toggle('ui-square', !s.rounded_cards);

    // Form-dichtheid
    document.body.classList.remove('density-compact','density-normaal','density-ruim','density-extraruim');
    document.body.classList.add('density-' + (s.form_density || 'normaal'));

    // Lettertype
    applyFont(s.font_id);

    // Favicon + PWA-icoon meekleuren met het logo
    Branding.applyFaviconAndManifest(s);
  },

  applyFaviconAndManifest(s) {
    const iconLink     = document.querySelector('link[rel="icon"]');
    const appleLink    = document.querySelector('link[rel="apple-touch-icon"]');
    const manifestLink = document.querySelector('link[rel="manifest"]');

    if (s.logo_data_url) {
      if (iconLink)  iconLink.href  = s.logo_data_url;
      if (appleLink) appleLink.href = s.logo_data_url;

      // Dynamische manifest met eigen logo + naam + kleur
      if (manifestLink) {
        const manifest = {
          name: `${s.app_name} — ${s.app_tagline}`,
          short_name: s.app_name,
          start_url: './',
          scope: './',
          display: 'standalone',
          background_color: '#f6f4ef',
          theme_color: s.primary_color,
          lang: 'nl',
          icons: [
            { src: s.logo_data_url, sizes: 'any', purpose: 'any maskable' }
          ],
        };
        // Oude blob-URL opruimen
        const old = manifestLink.dataset.dynamicHref;
        if (old) { try { URL.revokeObjectURL(old); } catch (_) {} }
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
        const url = URL.createObjectURL(blob);
        manifestLink.href = url;
        manifestLink.dataset.dynamicHref = url;
      }
    } else {
      // Reset naar standaard
      if (iconLink)  iconLink.href  = 'icon.svg';
      if (appleLink) appleLink.href = 'icon.svg';
      if (manifestLink) {
        const old = manifestLink.dataset.dynamicHref;
        if (old) { try { URL.revokeObjectURL(old); } catch (_) {} delete manifestLink.dataset.dynamicHref; }
        manifestLink.href = 'manifest.webmanifest';
      }
    }
  },
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ─── BrandingFotos: logo-upload naar Supabase Storage (publieke bucket) ─────
const BrandingFotos = {
  async uploadLogo(file) {
    file = await compressImage(file, 800, 0.92);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `logo.${ext || 'png'}`;
    // Verwijder eerst oude logo-bestanden van andere extensies
    const exts = ['png','jpg','jpeg','svg','webp','gif'].filter(e => e !== ext);
    if (exts.length) await sb.storage.from('branding').remove(exts.map(e => `logo.${e}`)).catch(() => {});
    const { error } = await sb.storage.from('branding').upload(path, file, {
      upsert: true, cacheControl: '3600', contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = sb.storage.from('branding').getPublicUrl(path);
    return data.publicUrl + '?v=' + Date.now();
  },
  async removeLogo() {
    const exts = ['png','jpg','jpeg','svg','webp','gif'];
    await sb.storage.from('branding').remove(exts.map(e => `logo.${e}`)).catch(() => {});
  },
};

const Splash = {
  shownAt: Date.now(),
  dismissed: false,
  handlersBound: false,

  show(state /* 'online' | 'offline' */, opts = {}) {
    const s = Settings.all();
    const splash = document.getElementById('splash');
    if (!splash) return;

    // Animatie-klasse op de splash zetten
    splash.classList.remove('anim-glass', 'anim-fade', 'anim-scale', 'anim-slide');
    splash.classList.add('anim-' + (s.splash_animation || 'glass'));

    const onlineEl = document.getElementById('splash-online');
    const offlineEl = document.getElementById('splash-offline');
    const titleEl = document.getElementById('splash-title');
    const subEl = splash.querySelector('.splash-sub');
    const cont = document.getElementById('splash-continue');
    const hint = document.getElementById('splash-hint');

    if (subEl) subEl.textContent = s.splash_subtitle;

    onlineEl.hidden = state !== 'online';
    offlineEl.hidden = state !== 'offline';
    if (state === 'offline') {
      titleEl.textContent = s.splash_offline_title;
      cont.hidden = false;
      cont.textContent = 'Verder in leesmodus';
      hint.hidden = true;
    } else {
      titleEl.textContent = s.splash_title;
      cont.hidden = true;
      hint.hidden = false;
    }

    splash.hidden = false;
    splash.classList.remove('fading');
    Splash.shownAt = Date.now();
    Splash.dismissed = false;
    Splash.setupHandlers();
  },

  setupHandlers() {
    if (Splash.handlersBound) return;
    Splash.handlersBound = true;
    const splash = document.getElementById('splash');
    if (!splash) return;
    const dismiss = () => Splash.dismiss();
    splash.addEventListener('click', dismiss);
    document.getElementById('splash-continue').addEventListener('click', e => {
      e.stopPropagation(); dismiss();
    });
    document.addEventListener('keydown', e => {
      if (!Splash.dismissed && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) dismiss();
    });
  },

  async autoDismiss() {
    const minMs = Math.max(0, parseInt(Settings.get('splash_duration_ms'), 10) || 0);
    const elapsed = Date.now() - Splash.shownAt;
    if (elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
    Splash.dismiss();
  },

  dismiss() {
    if (Splash.dismissed) return;
    Splash.dismissed = true;
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('fading');
    setTimeout(() => { splash.hidden = true; }, 750);
  },

  // Voorbeeld vanuit instellingen-pagina
  preview(state) {
    Splash.show(state || (navigator.onLine ? 'online' : 'offline'));
    if (state === 'online' || (!state && navigator.onLine)) Splash.autoDismiss();
  },
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err =>
      console.warn('Service worker registratie mislukt:', err));
  });
}

// ─── E-mail-service (EmailJS) ───────────────────────────────────────────────
const EmailService = {
  isConfigured() {
    const s = Settings.all();
    return !!(s.emailjs_public_key && s.emailjs_service_id && s.emailjs_template_id);
  },
  async send(toEmail, subject, message) {
    if (!EmailService.isConfigured()) throw new Error('E-mail-koppeling niet ingesteld in Account.');
    if (!window.emailjs) throw new Error('E-mail-bibliotheek niet geladen — controleer internet.');
    const s = Settings.all();
    emailjs.init({ publicKey: s.emailjs_public_key });
    return emailjs.send(s.emailjs_service_id, s.emailjs_template_id, {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: s.app_name || 'Uitvaartleider',
      reply_to: '',
    });
  },
};

// ─── Update-check (handmatig vanuit Account) ────────────────────────────────
const Updater = {
  async check() {
    let remoteVersion = null;
    try {
      // Vraag app.js opnieuw op met cache-bypass om de versie te lezen
      const r = await fetch('./js/app.js?_check=' + Date.now(), { cache: 'no-store' });
      const text = await r.text();
      const m = text.match(/APP_VERSION\s*=\s*['"](v\d+)['"]/);
      if (m) remoteVersion = m[1];
    } catch (e) {
      throw new Error('Kon servergegevens niet ophalen (offline?)');
    }

    let swUpdated = false;
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            // Nieuwe SW staat te wachten — activeer 'm
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            swUpdated = true;
          } else if (reg.installing) {
            // Wordt nog geïnstalleerd — wacht totdat hij waiting wordt
            await new Promise(resolve => {
              const sw = reg.installing;
              sw.addEventListener('statechange', () => {
                if (sw.state === 'installed' && reg.waiting) {
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  swUpdated = true;
                  resolve();
                } else if (sw.state === 'activated') {
                  swUpdated = true;
                  resolve();
                }
              });
              setTimeout(resolve, 4000); // safety timeout
            });
          }
        }
      } catch (_) {}
    }

    return {
      currentVersion: APP_VERSION,
      remoteVersion,
      hasUpdate: remoteVersion && remoteVersion !== APP_VERSION,
      swUpdated,
    };
  },
  reloadHard() {
    // Pagina forceren te verversen (browser-cache laat al door network-first SW gaan)
    location.reload();
  },
};

function updateOfflineUI() {
  const offline = !navigator.onLine || !!Cloud.offline;
  const badge = document.getElementById('offline-badge');
  if (badge) badge.hidden = !offline;
  document.body.classList.toggle('is-offline', offline);
}
window.addEventListener('online', () => {
  updateOfflineUI();
  if (Cloud.offline && Auth.current()) {
    Cloud.loadAll().then(() => { updateOfflineUI(); Router.handle(); }).catch(() => {});
  }
});
window.addEventListener('offline', updateOfflineUI);

Router.add('/', (p, full) => renderDossierList(p, full));
Router.add('/dossiers', (p, full) => renderDossierList(p, full));
Router.add('/dossiers/nieuw', () => renderDossierForm({}));
Router.add('/dossiers/:id', p => renderDossierDetail(p));
Router.add('/dossiers/:id/bewerken', p => renderDossierForm(p));
Router.add('/dossiers/:id/factuur', p => renderFactuur(p));
Router.add('/kisten', () => renderKistenBeheer());
Router.add('/bloemen', () => renderBloemenBeheer());
Router.add('/eten-drinken', () => renderEtenDrinkenBeheer());
Router.add('/account', () => renderAccount());

(async function init() {
  // Branding meteen toepassen — vóór de splash zichtbaar wordt
  Branding.apply();

  // Versie-indicator overal injecteren
  const verLabel = `Versie ${APP_VERSION} · ${APP_BUILD_DATE}`;
  const fv = document.getElementById('footer-version');
  if (fv) fv.textContent = ' · ' + verLabel;
  const sv = document.getElementById('splash-version');
  if (sv) sv.textContent = verLabel;

  // Welkomscherm meteen tonen op basis van verbinding (tenzij uitgezet)
  const splashOn = Settings.get('splash_enabled');
  if (splashOn) {
    Splash.show(navigator.onLine ? 'online' : 'offline');
  } else {
    document.getElementById('splash').hidden = true;
    Splash.dismissed = true;
  }

  const sess = await Auth.init();
  if (sess) {
    try { await Cloud.loadAll(); }
    catch (e) { console.warn('Laden mislukt:', e.message || e); }
    // Instellingen uit de cloud halen en branding opnieuw toepassen
    try {
      await Settings.loadFromCloud();
      Branding.apply();
    } catch (e) { console.warn('Settings laden faalde:', e.message || e); }
  }
  updateOfflineUI();

  // Online: automatisch wegfaden na de ingestelde duur.
  // Offline: blijft staan tot de gebruiker op "Verder" klikt.
  if (splashOn && navigator.onLine && !Cloud.offline) {
    Splash.autoDismiss();
  }

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-username').value.trim();
    const pw = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.hidden = true;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Bezig met inloggen...';
    const err = await Auth.login(email, pw);
    btn.disabled = false; btn.textContent = 'Inloggen';
    if (err) {
      errEl.textContent = (err.toLowerCase().includes('invalid') || err.toLowerCase().includes('credentials'))
        ? 'Onjuist e-mailadres of wachtwoord.' : err;
      errEl.hidden = false;
      return;
    }
    document.getElementById('login-password').value = '';
    try { await Cloud.loadAll(); } catch (e2) { alert('Laden mislukt: ' + (e2.message || e2)); }
    try { await Settings.loadFromCloud(); Branding.apply(); } catch (_) {}
    updateOfflineUI();
    if (!location.hash || location.hash === '#/login') location.hash = '#/';
    Router.handle();
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await Auth.logout();
    Cloud.cache = { dossiers: [], taken: [], kosten: [], notities: [], documenten: [] };
    Cloud.loaded = false;
    location.hash = '';
    Router.handle();
  });

  Router.start();
})();
