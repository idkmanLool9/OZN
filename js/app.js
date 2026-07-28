// Init: Supabase auth, route registratie, login form, offline-modus

// Versie-schema (semver MAJOR.MINOR.PATCH, gekoppeld aan buildnummer)
//  · APP_BUILD   — monotoon groeiend nummer, +1 bij ELKE release.
//                  Wordt gebruikt voor service-worker cache-invalidatie.
//  · APP_VERSION — semver-weergave:
//                    PATCH (laatste cijfer) — kleine UI-tweaks, bugfixes,
//                          knop toevoegen/weghalen
//                    MINOR (middelste)      — nieuwe features
//                    MAJOR (eerste)         — grote architectuur-wijziging
//                  Voorbeeld:
//                    5.5.0 → 5.5.1: knop uit topnav weggehaald
//                    5.5.1 → 5.6.0: nieuwe agenda-functie toegevoegd
//                    5.6.x → 6.0.0: totaal nieuwe layout
const APP_BUILD      = 302;
const APP_VERSION    = '6.0.1';
const APP_BUILD_DATE = '2026-07-28';

// ─── Instellingen (cloud-first, localStorage als offline-spiegel) ──────────
const Settings = {
  KEY: 'sok_settings',          // lokale spiegel (gedeelde instellingen)
  TABLE: 'app_instellingen',
  ROW_ID: 1,                    // single-row model (gedeeld door hele parochie)
  _cache: null,                 // huidige gedeelde overrides (zonder defaults)
  // Gevoelige, PER-ACCOUNT instellingen: API-sleutels e.d. Deze horen NIET in de
  // gedeelde instellingenrij (dan zou elk ander account ze zien). Ze worden
  // opgeslagen in de auth-metadata van de ingelogde gebruiker (alleen voor die
  // gebruiker leesbaar) + een per-account lokale spiegel.
  SENSITIVE: [
    'emailjs_public_key', 'emailjs_service_id', 'emailjs_template_id',
    'snelstart_actief', 'snelstart_subscription_key', 'snelstart_client_key',
  ],
  SECRET_KEY_PREFIX: 'sok_secrets_',  // + user-id = per-account lokale spiegel
  _secretCache: null,                 // per-account gevoelige overrides
  // Demo-/review-account bewaart zijn keuzes (lettertype, logo, ontwerp) hier,
  // uitsluitend lokaal op het toestel — nooit naar de cloud. Zo overleven de
  // instellingen een herstart, zonder de echte gedeelde instellingen te raken.
  DEMO_KEY: 'sok_settings_demo',
  defaults: {
    splash_enabled: true,
    splash_duration_ms: 1600,
    splash_animation: 'glass', // 'glass' | 'fade' | 'scale' | 'slide'
    splash_title: 'Welkom',
    splash_subtitle: 'OZN · Overledenenzorg Nederland',
    splash_offline_title: 'Welkom terug',
    // Branding
    app_name: 'OZN',
    app_tagline: 'Overledenenzorg Nederland',
    primary_color: '#2563eb',
    accent_color: '#c9a24a',
    logo_data_url: '',
    // UI
    compact_mode: false,
    rounded_cards: true,
    font_id: 'default',
    form_density: 'normaal', // 'compact' | 'normaal' | 'ruim' | 'extraruim'
    // Ontwerp-versie: 'v1' = klassieke bovenbalk-layout (standaard),
    // 'v2' = nieuwe zijbalk-layout.
    design_version: 'v1',
    // Beheermodus: knoppen 'Vervang foto' / 'Verwijder' tonen op
    // catalogi (kisten, bloemen, eten & drinken)
    catalog_admin_mode: false,
    // Beheermodus voor de dossier-intake: laat beheerder titels, legendes
    // en knop-teksten inline aanpassen. Overrides worden opgeslagen in
    // Settings.dossier_labels als { key: 'nieuwe tekst', … }.
    dossier_admin_mode: false,
    dossier_labels: {},
    // Archief: afgehandelde dossiers automatisch archiveren (rouwauto geweest
    // + alle datums voorbij). En: mogen medewerkers het archief zien?
    // (medewerker_ziet_archief wordt server-side afgedwongen via RLS.)
    auto_archief_actief: false,
    medewerker_ziet_archief: false,
    // Mogen gewone medewerkers prijzen/bedragen zien? Standaard niet.
    // (Server dwingt dit af via de kosten_zicht-view + mag_prijzen_zien().)
    medewerker_ziet_prijzen: false,
    // Per-naam overrides voor de Unigra-kistencatalogus (alleen wijzigbaar
    // in beheermodus): { 'Naam kist': { bedrag?: number, hidden?: bool } }
    kisten_overrides: {},
    // Idem voor de standaard-kostenpresets (Snel toevoegen uit lijst).
    // Sleutels = omschrijving (uitgezonderd nav-tegels Kist/Bloemen/Extra).
    kosten_overrides: {},
    // Extra kostenposten die de beheerder zelf heeft aangemaakt in Account →
    // Kostenposten beheren. Vorm: [{ omschrijving, categorie, bedrag }, …]
    kosten_extra: [],
    // Handtekeningen-velden in het intake-formulier
    signature_fields: [
      { id: 'opdrachtgever',   label: 'Handtekening opdrachtgever',   required: true },
      { id: 'uitvaartleider',  label: 'Handtekening uitvaartleider',  required: true },
    ],
    // EmailJS-koppeling voor auto-versturen
    emailjs_public_key: '',
    emailjs_service_id: '',
    emailjs_template_id: '',
    // Push-notificaties (zie PushNotificaties + docs/push-setup.md)
    push_vapid_public_key: 'BFrHC8o3zxJ4e1qirE93vUm5wPZpEdqWIV9OwczE-Omgf3QkoM_hKFI1ZFK2Lon4f7bvwVNKQVUfOZxkFQ6nUmg',
    push_remind_days_ahead: 1,   // x dagen voor uitvaart een push sturen
    // Profielkiezer ("Wie werkt vandaag?") wordt bij ELKE app-start getoond
    // (zolang er profielen zijn geconfigureerd). Zo houdt de app bij wie
    // wat heeft gedaan zonder dat iedereen een eigen account nodig heeft.
    profielkiezer_actief: true,
    // Profielen — Wie werkt vandaag? Beheer in Account → Profielen.
    // Leeg default: OZN vult zelf het team in.
    profielen: [],
    // Automatisch dossier mailen naar klooster bij opslaan (leeg = uit)
    auto_send_dossier_email: '',
    // E-mail-footer (handtekening onderaan elke verzonden mail)
    email_footer_enabled: true,
    email_footer_terms_url:     '',
    email_footer_privacy_url:   '',
    email_footer_facebook_url:  '',
    email_footer_instagram_url: '',
    email_footer_address: '',
    email_footer_phone:   '',
    email_footer_email:   '',
    email_footer_website: '',
    // Login-scherm teksten (split-screen)
    login_brand_title: 'Welkom terug',
    login_brand_subtitle: 'Beheer dossiers, kosten, documenten en facturen — alles op één plek.',
    login_brand_features: [
      'Dossiers met kosten en notities — altijd up-to-date',
      'Facturen direct opmaken en als PDF mailen',
      'Kistassortiment en rouwauto per dossier',
      'Versleutelde sessie · automatische uitlog',
    ],
    login_brand_foot: '© OZN Vastgoed B.V.',
    login_form_title: 'Inloggen',
    login_form_subtitle: 'Voer je e-mailadres en wachtwoord in om door te gaan.',
    login_secretariaat_text: 'Geen account? Vraag het secretariaat.',
    // OZN-specifieke keuzelijstjes (beheerder-onderhouden).
    // rouwgoederen_opties: standaard-vinkjes bij thuis-opbaren.
    // rouwauto_lijst: opties in de rouwauto-dropdown.
    rouwgoederen_opties: [
      'Airco', 'Opbaarplank', 'Koelplaat', 'Schermen',
      'Kaarsen/Kruis', 'Schragen', 'Baarwagen', 'Rok',
      'Body bag', 'Opbaar mand',
    ],
    rouwauto_lijst: [],
    // Factuur-bedrijfsgegevens (kop + betaalgegevens op de PDF-factuur)
    factuur_bedrijfsnaam: 'OZN Vastgoed B.V.',
    factuur_adres: '',
    factuur_telefoon: '',
    factuur_email: '',
    factuur_iban: '',
    factuur_btw: '',
    factuur_kvk: '',
    factuur_betalingstermijn_dagen: 30,
    // Oplopend factuurnummer: laatste volgnummer + toegekende nummers per
    // dossier (zodat een dossier altijd hetzelfde factuurnummer houdt).
    factuur_volgnr: 0,
    factuur_nummers: {},
    // SnelStart-koppeling (boekhouding) — sleutels invullen in Account.
    snelstart_actief: false,
    snelstart_subscription_key: '',
    snelstart_client_key: '',
  },
  // Synchrone read uit cache + lokale spiegel (gedeelde instellingen).
  // Voor het demo-account: uit de aparte, alleen-lokale demo-spiegel.
  _localOverrides() {
    if (Settings._cache) return Settings._cache;
    const key = (typeof Demo !== 'undefined' && Demo.isActive()) ? Settings.DEMO_KEY : Settings.KEY;
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { return {}; }
  },
  // Per-account gevoelige overrides (uit cache of per-account lokale spiegel)
  _secretOverrides() {
    if (Settings._secretCache) return Settings._secretCache;
    const u = (typeof Auth !== 'undefined' && Auth.current()) || null;
    if (u && u.id) {
      try {
        const raw = localStorage.getItem(Settings.SECRET_KEY_PREFIX + u.id);
        if (raw) return JSON.parse(raw) || {};
      } catch (_) {}
    }
    return {};
  },
  // Gevoelige sleutels uit een object filteren (voor de gedeelde rij)
  _stripSensitive(obj) {
    const out = {};
    for (const k in obj) if (Settings.SENSITIVE.indexOf(k) === -1) out[k] = obj[k];
    return out;
  },
  // Defaults + gedeelde overrides + per-account gevoelige overrides
  all() {
    return Object.assign({}, Settings.defaults, Settings._localOverrides(), Settings._secretOverrides());
  },
  get(key) { return Settings.all()[key]; },

  // Synchroon: update cache + spiegels; cloud-push fire-and-forget.
  // Gevoelige sleutels gaan naar de per-account store, de rest naar de
  // gedeelde instellingenrij.
  set(patch) {
    // Demo-/review-account: alle keuzes (lettertype, logo, ontwerp, enz.) alleen
    // lokaal op het toestel bewaren zodat ze een herstart overleven — nooit naar
    // de cloud en niet in de gedeelde/gevoelige stores.
    if (typeof Demo !== 'undefined' && Demo.isActive()) {
      const next = Object.assign({}, Settings._localOverrides(), patch);
      const trimmed = {};
      for (const k in next) if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
      Settings._cache = trimmed;
      Settings._secretCache = {};
      try { localStorage.setItem(Settings.DEMO_KEY, JSON.stringify(trimmed)); } catch (_) {}
      return;
    }

    const secretPatch = {}, sharedPatch = {};
    for (const k in patch) {
      if (Settings.SENSITIVE.indexOf(k) !== -1) secretPatch[k] = patch[k];
      else sharedPatch[k] = patch[k];
    }

    // ── Gedeelde (niet-gevoelige) instellingen ──
    if (Object.keys(sharedPatch).length) {
      const next = Object.assign({}, Settings._localOverrides(), sharedPatch);
      const trimmed = {};
      for (const k in next) {
        if (Settings.SENSITIVE.indexOf(k) !== -1) continue;           // nooit gevoelig in de gedeelde rij
        if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
      }
      Settings._cache = trimmed;
      try { localStorage.setItem(Settings.KEY, JSON.stringify(trimmed)); } catch (_) {}
      Settings._pushCloud(trimmed);
    }

    // ── Gevoelige (per-account) instellingen ──
    if (Object.keys(secretPatch).length) {
      const next = Object.assign({}, Settings._secretOverrides(), secretPatch);
      const trimmed = {};
      for (const k in next) if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
      Settings._secretCache = trimmed;
      Settings._persistSecrets(trimmed);
      Settings._pushSecrets(trimmed);
    }
  },

  // Per-account lokale spiegel van de gevoelige sleutels
  _persistSecrets(data) {
    const u = (typeof Auth !== 'undefined' && Auth.current()) || null;
    if (!u || !u.id) return;
    try { localStorage.setItem(Settings.SECRET_KEY_PREFIX + u.id, JSON.stringify(data)); } catch (_) {}
  },
  // Gevoelige sleutels opslaan in de auth-metadata van deze gebruiker
  _pushSecrets(data) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return;
    if (!navigator.onLine) return;
    if (!Auth.current()) return;
    sb.auth.updateUser({ data: { sok_secrets: data } })
      .then(r => { if (r.error) console.warn('Gevoelige instellingen opslaan faalde:', r.error.message); })
      .catch(err => console.warn('Gevoelige instellingen opslaan-fout:', err));
  },
  // Bij login: gevoelige sleutels uit de auth-metadata halen (bron van waarheid),
  // met de per-account lokale spiegel als terugval.
  _loadSecretsFromSession() {
    let secrets = null;
    try {
      const meta = (typeof Auth !== 'undefined' && Auth.metadata()) || {};
      if (meta.sok_secrets && typeof meta.sok_secrets === 'object') secrets = meta.sok_secrets;
    } catch (_) {}
    if (secrets) { Settings._secretCache = secrets; Settings._persistSecrets(secrets); }
    else { Settings._secretCache = Settings._secretOverrides(); }
  },

  // Geluidloos pushen naar Supabase (gedeelde instellingenrij)
  _pushCloud(data) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return; // demo schrijft nooit gedeelde instellingen
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

    // Demo-/review-account: nooit de echte gedeelde instellingen of gevoelige
    // sleutels laden. Wél de eigen, alleen-lokale demo-keuzes terughalen zodat
    // lettertype/logo/ontwerp een herstart overleven. Niets naar de cloud.
    if (typeof Demo !== 'undefined' && Demo.isActive()) {
      try { Settings._cache = JSON.parse(localStorage.getItem(Settings.DEMO_KEY) || '{}') || {}; }
      catch (_) { Settings._cache = {}; }
      Settings._secretCache = {};
      return;
    }

    // 1) Per-account gevoelige sleutels uit de auth-metadata van deze gebruiker
    Settings._loadSecretsFromSession();

    // 2) Gedeelde instellingen uit de cloud (nooit met gevoelige sleutels erin)
    try {
      const { data, error } = await sb.from(Settings.TABLE)
        .select('data').eq('id', Settings.ROW_ID).maybeSingle();
      if (error) throw error;
      const cloud = (data && data.data) ? data.data : null;
      if (cloud === null || Object.keys(cloud).length === 0) {
        // Cloud is nog leeg — push de lokale (niet-gevoelige) overrides
        const local = Settings._stripSensitive(Settings._localOverrides());
        if (Object.keys(local).length > 0) {
          Settings._pushCloud(local);
          Settings._cache = local;
        } else {
          Settings._cache = {};
        }
      } else {
        // Eenmalige migratie: vroeger stonden gevoelige sleutels in de gedeelde
        // rij. Neem ze (eenmalig) over in het eigen account en verwijder ze uit
        // de gedeelde rij, zodat andere accounts ze niet meer kunnen zien.
        const leaked = {};
        for (const k of Settings.SENSITIVE) if (cloud[k] !== undefined) leaked[k] = cloud[k];
        const cleaned = Settings._stripSensitive(cloud);
        Settings._cache = cleaned;
        try { localStorage.setItem(Settings.KEY, JSON.stringify(cleaned)); } catch (_) {}
        if (Object.keys(leaked).length) {
          if (Object.keys(Settings._secretOverrides()).length === 0) {
            const trimmed = {};
            for (const k in leaked) if (leaked[k] !== Settings.defaults[k]) trimmed[k] = leaked[k];
            Settings._secretCache = trimmed;
            Settings._persistSecrets(trimmed);
            Settings._pushSecrets(trimmed);
            console.info('[uitvaart] Gevoelige API-sleutels overgezet naar je eigen account.');
          }
          Settings._pushCloud(cleaned); // gevoelige sleutels uit de gedeelde rij verwijderen
        }
      }
    } catch (e) {
      // Offline of API-fout: gebruik de lokale spiegel (zonder gevoelige sleutels)
      try { Settings._cache = Settings._stripSensitive(JSON.parse(localStorage.getItem(Settings.KEY) || '{}')); }
      catch (_) { Settings._cache = {}; }
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

    // Theme-color voor mobiele statusbalk + Windows PWA-titelbalk.
    // We houden 'm bewust op de crème surface-kleur ('#f6f4ef') zodat de
    // titelbalk op Windows netjes past bij de topbar; de app-primary blijft
    // gebruiken voor accenten binnen de app zelf.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#f6f4ef');

    // Tekst overal
    document.querySelectorAll('.brand-text strong').forEach(el => el.textContent = s.app_name);
    document.querySelectorAll('.brand-text small').forEach(el => el.textContent = s.app_tagline);

    // Login-scherm
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('login-app-name', s.app_name);
    setText('login-app-tagline', s.app_tagline);
    setText('login-brand-title', s.login_brand_title);
    setText('login-brand-subtitle', s.login_brand_subtitle);
    setText('login-form-title', s.login_form_title);
    setText('login-form-subtitle', s.login_form_subtitle);
    setText('login-secretariaat', s.login_secretariaat_text);
    setText('login-brand-foot', s.login_brand_foot);
    const featUl = document.getElementById('login-brand-features');
    if (featUl) {
      const items = Array.isArray(s.login_brand_features) ? s.login_brand_features : [];
      featUl.innerHTML = items.filter(Boolean).map(t => {
        const safe = String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        return `<li>${safe}</li>`;
      }).join('');
    }

    // Footer (dynamisch op basis van de branding)
    setText('footer-brand', `Intern systeem · ${s.app_name}${s.app_tagline ? ' · ' + s.app_tagline : ''} · gegevens veilig opgeslagen in de cloud`);

    // Document-titel — zo kort mogelijk zodat de fallback-titelbalk (waar
    // Window Controls Overlay uit staat) alleen 'OZN' toont naast de
    // venster-knoppen. Wel via een korte lookup: sommige gebruikers hebben
    // app_name = 'Opdrachtformulier'; toch overrulen naar 'OZN'.
    document.title = 'OZN';

    // Logo: vervang het merkteken door <img> als er een eigen logo is;
    // anders een neutraal 'OZN'-monogram (geen kruis).
    document.querySelectorAll('.brand-mark').forEach(el => {
      if (s.logo_data_url) {
        el.innerHTML = `<img src="${s.logo_data_url}" alt="Logo">`;
        el.classList.add('has-custom-logo');
      } else {
        el.textContent = 'OZN';
        el.classList.remove('has-custom-logo');
      }
    });

    // Compact / afgeronde hoeken
    document.body.classList.toggle('ui-compact', !!s.compact_mode);
    document.body.classList.toggle('ui-square', !s.rounded_cards);

    // Ontwerp-versie: v1 = klassieke bovenbalk (standaard), v2 = nieuwe zijbalk
    document.body.classList.toggle('design-v1', (s.design_version || 'v1') === 'v1');

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

      // Dynamische manifest met eigen logo + kleur. Naam bewust kort ('OZN')
      // zodat de venster-titelbalk niet vol staat met 'Opdrachtformulier —
      // Overledenen Zorg Nederland B.V.'.
      if (manifestLink) {
        const manifest = {
          name: 'OZN',
          short_name: 'OZN',
          description: (s.app_name || 'OZN') + ' — ' + (s.app_tagline || ''),
          start_url: './',
          scope: './',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          background_color: '#f6f4ef',
          theme_color: '#f6f4ef',
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

    // Minimalistisch splash: geen aparte titel/subtitel meer — de OZN-mark
    // en wordmark spreken voor zich. Als de oude elementen nog bestaan
    // (bv. voor een custom-splash-variant), respecteren we de settings.
    if (subEl) subEl.textContent = s.splash_subtitle;

    onlineEl.hidden = state !== 'online';
    offlineEl.hidden = state !== 'offline';
    if (state === 'offline') {
      if (titleEl) titleEl.textContent = s.splash_offline_title;
      cont.hidden = false;
      cont.textContent = 'Verder in leesmodus';
      hint.hidden = true;
    } else {
      if (titleEl) titleEl.textContent = s.splash_title;
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
    // updateViaCache:'none' zorgt dat de browser de service-worker.js
    // file zelf NOOIT uit zijn HTTP-cache haalt — anders denkt-ie soms
    // dagenlang dat er geen nieuwe versie is, ook al staat hij er.
    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
      .catch(err => console.warn('Service worker registratie mislukt:', err));
  });
}

// ─── Push-notificaties (Web Push API) ───────────────────────────────────────
// Werkt op alle moderne browsers + iOS Safari 16.4+ (vereist dat de app
// 'op beginscherm' staat geïnstalleerd voor iOS).
//
// Setup-vereisten (in Supabase):
//   1. VAPID-sleutels genereren (eenmalig)
//   2. Public key in Settings → push_vapid_public_key zetten
//   3. Edge Function 'send-push' draaien die elke ochtend de
//      aankomende uitvaarten checkt en push verstuurt
// Zie docs/push-setup.md voor de complete handleiding.
const PushNotificaties = {
  STORAGE_KEY: 'sok_push_subscription_id',

  get vapidPublicKey() {
    const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
    return s.push_vapid_public_key || '';
  },

  // base64-URL → Uint8Array (vereist door PushManager.subscribe)
  _urlBase64ToUint8Array(b64) {
    const padding = '='.repeat((4 - b64.length % 4) % 4);
    const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  },

  async supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window &&
           'Notification' in window;
  },

  async currentSubscription() {
    if (!await PushNotificaties.supported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  },

  async permission() {
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  async subscribe() {
    if (!await PushNotificaties.supported()) {
      throw new Error('Deze browser ondersteunt geen push-notificaties.');
    }
    const key = PushNotificaties.vapidPublicKey;
    if (!key) {
      throw new Error('Push is nog niet ingesteld. Voer de VAPID public key in via Account → Push-notificaties.');
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error('Toestemming voor notificaties geweigerd. Pas dit aan in de browser-instellingen.');
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: PushNotificaties._urlBase64ToUint8Array(key),
    });
    // Sla op in Supabase zodat Edge Function ons kan bereiken
    const u = Auth.current();
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current())
      ? ActiveProfile.current().name : null;
    const payload = {
      user_id: u ? u.id : null,
      profiel: profielNaam,
      endpoint: sub.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
      auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
      user_agent: navigator.userAgent.slice(0, 200),
    };
    const { data, error } = await sb.from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' })
      .select().single();
    if (error) throw error;
    localStorage.setItem(PushNotificaties.STORAGE_KEY, String(data.id));
    return data;
  },

  async unsubscribe() {
    const sub = await PushNotificaties.currentSubscription();
    if (sub) await sub.unsubscribe();
    const id = localStorage.getItem(PushNotificaties.STORAGE_KEY);
    if (id) {
      await sb.from('push_subscriptions').delete().eq('id', parseInt(id, 10)).catch(() => {});
      localStorage.removeItem(PushNotificaties.STORAGE_KEY);
    }
  },

  // Lokaal een test-notificatie tonen (zonder push-server)
  async testLocal() {
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return false;
    }
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('OZN · test', {
      body: 'Push-notificaties werken op dit apparaat. Je krijgt voortaan herinneringen voor aankomende uitvaarten.',
      icon: './icon.svg',
      badge: './icon.svg',
      tag: 'sok-test',
    });
    return true;
  },
};

// ─── E-mail-service (Resend via send-email Edge Function) ───────────────────
// Server-side verzenden vanuit info@ozn.nl (of wat er in RESEND_FROM staat).
// De sleutel + FROM-adres zitten uitsluitend in de Edge Function-secrets,
// niet in de client — dus geen sleutel-lek en geen per-user config.
const EmailService = {
  // Server-side altijd 'geconfigureerd' zolang je online bent — de
  // beschikbaarheid van de sleutels is een server-verantwoordelijkheid.
  // We geven wél 'false' terug wanneer we niet ingelogd zijn, zodat de
  // caller op de mailto-fallback kan vallen.
  isConfigured() {
    try {
      // sb wordt in supabase-client.js met const gedeclareerd — dat is
      // globaal binnen de non-module script-scope maar niet als window.sb
      // te bereiken. Vandaar de directe verwijzing.
      return !!(typeof sb !== 'undefined' && sb && sb.auth && sb.auth.getSession);
    } catch (_) { return false; }
  },

  // to    = string of array van adressen
  // html  = volledige HTML-body (zoals buildDossierEmail teruggeeft)
  // Optioneel: opts.replyTo, opts.plainFallback (voor toekomstig gebruik).
  async send(to, subject, html, opts = {}) {
    const s = (typeof sb !== 'undefined') ? sb : null;
    if (!s) throw new Error('Supabase-client niet geladen.');
    const payload = {
      to:      Array.isArray(to) ? to : [to],
      subject: subject || '',
      html:    html    || '',
    };
    if (opts.replyTo) payload.replyTo = opts.replyTo;
    // BCC — ontvangers zien elkaars adres niet. Server geeft door aan Brevo.
    if (Array.isArray(opts.bcc) && opts.bcc.length) {
      payload.bcc = opts.bcc;
    }
    // Bijlagen: array van { name, contentBase64 }. De server accepteert
    // ze en geeft ze 1-op-1 door aan Brevo als paperclip-attachment.
    if (Array.isArray(opts.attachments) && opts.attachments.length) {
      payload.attachments = opts.attachments;
    }

    // supabase.functions.invoke geeft bij een non-2xx alleen een generieke
    // 'Edge Function returned a non-2xx status code'. Om de échte fout uit
    // de body te krijgen doen we handmatig fetch met dezelfde JWT.
    const { data: sess } = await s.auth.getSession();
    const jwt = sess?.session?.access_token;
    if (!jwt) throw new Error('Niet ingelogd (geen sessie).');

    const url = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/send-email';
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + jwt,
          'apikey': (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''),
        },
        body: JSON.stringify(payload),
      });
    } catch (netErr) {
      throw new Error('Netwerkfout: ' + (netErr.message || String(netErr)));
    }

    let bodyJson = null;
    try { bodyJson = await resp.json(); } catch (_) {}

    if (!resp.ok || (bodyJson && bodyJson.error)) {
      const parts = [];
      if (bodyJson?.error)  parts.push(bodyJson.error);
      if (bodyJson?.detail) parts.push(typeof bodyJson.detail === 'string' ? bodyJson.detail : JSON.stringify(bodyJson.detail));
      if (bodyJson?.code)   parts.push('(' + bodyJson.code + ')');
      if (!parts.length)    parts.push('HTTP ' + resp.status);
      throw new Error(parts.join(' — '));
    }
    return bodyJson;
  },
};

// ─── Update-check (handmatig vanuit Account) ────────────────────────────────
const Updater = {
  async check() {
    let remoteVersion = null;
    let remoteBuild = null;
    try {
      // Alleen de eerste 800 bytes van app.js ophalen — bevat APP_BUILD +
      // APP_VERSION, en scheelt honderden KB downloaden per check.
      // Bij servers die Range niet honoreren valt fetch terug op de volle
      // body; we werken alsnog met .text() en kappen zelf af.
      let text = '';
      try {
        const r = await fetch('./js/app.js?_check=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Range': 'bytes=0-800' },
        });
        text = await r.text();
      } catch (_) {
        // Fallback zonder Range
        const r2 = await fetch('./js/app.js?_check=' + Date.now(), { cache: 'no-store' });
        text = (await r2.text()).slice(0, 1500);
      }
      const mb = text.match(/APP_BUILD\s*=\s*(\d+)/);
      const mv = text.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);
      if (mb) {
        remoteBuild = parseInt(mb[1], 10);
        remoteVersion = `${mv ? mv[1] : '?'} (build ${mb[1]})`;
      }
    } catch (e) {
      throw new Error('Kon servergegevens niet ophalen (offline?)');
    }

    const hasUpdate = !!(remoteBuild && remoteBuild > APP_BUILD);

    // SW-update in de achtergrond triggeren — de UI hoeft niet te wachten.
    // reloadHard() dat hierna volgt haalt de nieuwe files sowieso met een
    // cache-buster op, dus we hoeven niet meer op controllerchange te
    // wachten voordat we returnen.
    if (hasUpdate && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        reg.update().catch(() => {});
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }).catch(() => {});
    }

    const currentLabel = `${APP_VERSION} (build ${APP_BUILD})`;
    return {
      currentVersion: currentLabel,
      remoteVersion,
      hasUpdate,
      // Geen aparte SW-only-flow meer: de SW-update loopt fire-and-forget
      // in de achtergrond en de reloadHard() bij hasUpdate=true haalt de
      // verse files sowieso op met een cache-buster.
      swUpdated: false,
    };
  },

  // Nucleaire reset: unregister service-worker + wis alle caches + reload.
  // Voor het geval dat de SW vast blijft zitten op een oude versie en
  // de gewone Update-knop het niet meer trekt. Verliest alleen de
  // offline-cache — dossiers staan veilig in de cloud.
  async hardReset() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { console.warn('hardReset issue:', e); }
    // Bypass HTTP-cache met query-param + force reload
    const u = new URL(location.href);
    u.searchParams.set('_reset', Date.now());
    location.replace(u.toString());
  },

  // Reload de pagina met cache-buster. Updater.check() wacht inmiddels al
  // op controllerchange dus tegen de tijd dat dit wordt aangeroepen is
  // de nieuwe SW al in control en zal de reload verse files ophalen.
  async reloadHard() {
    const u = new URL(location.href);
    u.searchParams.set('_v', Date.now());
    location.replace(u.toString());
  },
};

// ─── APK-updater (alleen native Android via Capacitor) ─────────────────────
// Vraagt de GitHub-release 'app-latest' op en vergelijkt de asset-publicatie
// met APP_BUILD_DATE. Als de asset nieuwer is, tonen we een banner boven aan
// het scherm met een 'Installeer'-knop die de APK downloadt. Voor de web-versie
// doet dit niks — daar is Updater al voor.
const ApkUpdater = {
  RELEASE_API: 'https://api.github.com/repos/idkmanLool9/OZN/releases/tags/app-latest',
  CHECK_INTERVAL_MS: 6 * 60 * 60 * 1000, // 6 uur
  LAST_CHECK_KEY: 'ozn_apk_last_check',
  DISMISSED_KEY:  'ozn_apk_dismissed_ts',

  isApp() {
    try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
    catch (_) { return false; }
  },

  async check({ force = false } = {}) {
    if (!ApkUpdater.isApp()) return null;
    if (!navigator.onLine)  return null;
    if (!force) {
      const last = parseInt(localStorage.getItem(ApkUpdater.LAST_CHECK_KEY) || '0', 10);
      if (Date.now() - last < ApkUpdater.CHECK_INTERVAL_MS) return null;
    }
    try {
      // Haal APP_BUILD uit de release-source (js/app.js op de default-branch)
      // en vergelijk met het lokale APP_BUILD-nummer. Een nieuwe release
      // heeft altijd een hoger build-nummer; dat is dus een betrouwbare
      // vergelijking. Het oude script vergeleek asset.updated_at — dat gaf
      // false positives omdat élke rebuild een nieuwe timestamp geeft.
      const rSrc = await fetch(
        'https://raw.githubusercontent.com/idkmanLool9/OZN/claude/app-scan-analysis-huhgss/js/app.js?_ts=' + Date.now(),
        { cache: 'no-store' }
      );
      if (!rSrc.ok) return null;
      const text = (await rSrc.text()).slice(0, 1500);
      const mb = text.match(/APP_BUILD\s*=\s*(\d+)/);
      const mv = text.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);
      const remoteBuild = mb ? parseInt(mb[1], 10) : null;
      const remoteVersion = mv ? mv[1] : null;
      localStorage.setItem(ApkUpdater.LAST_CHECK_KEY, String(Date.now()));

      // Voor de download-URL wél nog even de release-API pakken
      let downloadUrl = 'https://github.com/idkmanLool9/OZN/releases/latest/download/ozn-app.apk';
      try {
        const rApi = await fetch(ApkUpdater.RELEASE_API, { cache: 'no-store', headers: { 'Accept': 'application/vnd.github+json' } });
        if (rApi.ok) {
          const j = await rApi.json();
          const asset = (j.assets || []).find(a => a && a.name && a.name.toLowerCase().endsWith('.apk'));
          if (asset && asset.browser_download_url) downloadUrl = asset.browser_download_url;
        }
      } catch (_) {}

      const nieuwer = !!(remoteBuild && remoteBuild > APP_BUILD);
      const info = {
        hasUpdate:     nieuwer,
        localBuild:    APP_BUILD,
        remoteBuild,
        remoteVersion,
        downloadUrl,
      };
      if (nieuwer) ApkUpdater.showBanner(info);
      return info;
    } catch (_) { return null; }
  },

  showBanner(info) {
    const dismissed = localStorage.getItem(ApkUpdater.DISMISSED_KEY);
    if (dismissed && dismissed === String(info.remoteBuild)) return; // gebruiker heeft déze versie al weggeklikt
    const el = document.getElementById('apk-update-banner');
    const txt = document.getElementById('apk-update-banner-info');
    const btn = document.getElementById('apk-update-banner-install');
    const dis = document.getElementById('apk-update-banner-dismiss');
    if (!el || !txt || !btn) return;
    const versieStr = info.remoteVersion ? `v${info.remoteVersion}` : `build ${info.remoteBuild}`;
    txt.textContent = `Nieuwe versie beschikbaar: ${versieStr} (jij: build ${info.localBuild}). Installeer om de laatste verbeteringen te krijgen.`;
    btn.href = info.downloadUrl;
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener');
    // Op Android/iOS met Capacitor: forceer externe browser zodat de APK-
    // download en installer-prompt triggeren. Anders blijft de webview
    // hangen op de github.com-pagina.
    btn.onclick = (e) => {
      try {
        if (typeof Native !== 'undefined' && Native.isApp()) {
          e.preventDefault();
          Native.openUrl(info.downloadUrl);
        }
      } catch (_) {}
    };
    el.hidden = false;
    document.body.classList.add('has-apk-banner');
    if (dis) dis.onclick = () => {
      localStorage.setItem(ApkUpdater.DISMISSED_KEY, String(info.remoteBuild));
      el.hidden = true;
      document.body.classList.remove('has-apk-banner');
    };
  },
};

function updateOfflineUI() {
  const offline = !navigator.onLine || !!Cloud.offline;
  const leesmodus = typeof Auth !== 'undefined' && Auth.isOfflineAuth && Auth.isOfflineAuth();
  const badge = document.getElementById('offline-badge');
  if (badge) {
    badge.hidden = !(offline || leesmodus);
    badge.textContent = leesmodus ? 'leesmodus' : 'offline';
    badge.title = leesmodus
      ? 'Offline-sessie — schrijf-acties worden geblokkeerd tot je weer online bent'
      : 'Geen internet — leesmodus';
  }
  document.body.classList.toggle('is-offline', offline);
  document.body.classList.toggle('is-leesmodus', leesmodus);
}
window.addEventListener('online', () => {
  updateOfflineUI();
  if (Cloud.offline && Auth.current()) {
    Cloud.loadAll().then(() => { updateOfflineUI(); Router.handle(); }).catch(() => {});
  }
});
window.addEventListener('offline', updateOfflineUI);

// Auto-archief: afgehandelde dossiers (rouwauto geweest + alle datums voorbij)
// automatisch naar het archief. Alleen beheerder, alleen als ingeschakeld in
// de instellingen. Medewerkers zien het archief niet (server-side RLS).
async function autoArchiveer() {
  try {
    if (typeof Auth === 'undefined' || !Auth.isBeheerder()) return;
    if (!Settings.get('auto_archief_actief')) return;
    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
    const planning = DB.list(KEYS.PLANNING) || [];
    const kandidaten = (DB.list(KEYS.DOSSIERS) || []).filter(d => {
      if (d.gearchiveerd) return false;
      // Alleen wanneer geen rouwauto is gekozen (leeg) is 't dossier
      // "niet klaar". Bewuste 'nee' is ook een gemaakte keuze.
      if (!d.rouwauto) return false;
      const dates = [];
      if (d.thuis_opbaren_datum) dates.push(new Date(d.thuis_opbaren_datum + 'T00:00:00'));
      if (d.thuis_opbaren_einddatum) dates.push(new Date(d.thuis_opbaren_einddatum + 'T00:00:00'));
      if (d.ophalen_datum) dates.push(new Date(d.ophalen_datum + 'T00:00:00'));
      planning.forEach(p => { if (p.dossier_id === d.id && p.start_ts) dates.push(new Date(p.start_ts)); });
      if (!dates.length) return false;             // geen datum → niet 'afgehandeld'
      return dates.every(dt => !isNaN(dt.getTime()) && dt < vandaag);
    });
    for (const d of kandidaten) {
      try { await DB.update(KEYS.DOSSIERS, d.id, { gearchiveerd: true, gearchiveerd_op: new Date().toISOString() }); } catch (_) {}
    }
  } catch (_) {}
}

Router.add('/', (p, full) => renderDossierList(p, full));
Router.add('/dossiers', (p, full) => renderDossierList(p, full));
Router.add('/dossiers/nieuw', () => renderDossierForm({}));
Router.add('/dossiers/:id', p => renderDossierDetail(p));
Router.add('/dossiers/:id/bewerken', p => renderDossierForm(p));
Router.add('/dossiers/:id/factuur', p => renderFactuur(p));
Router.add('/kisten', () => renderKistenBeheer());
Router.add('/kisten/voorraad', () => renderKistenVoorraad());
Router.add('/kisten/bestellijst', () => renderKistenBestellijst());
Router.add('/planning', () => renderPlanning());
Router.add('/account', () => renderAccount());
Router.add('/logboek', () => renderLogboek());

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
    // Bij elke app-start opnieuw laten kiezen wie er vandaag werkt —
    // profiel-keuze wordt niet meer over sessies heen bewaard.
    try { ActiveProfile.clear(); } catch (_) {}
  }
  updateOfflineUI();
  autoArchiveer();   // afgehandelde dossiers naar archief (indien ingeschakeld)

  // Auto-keepalive: voorkomt dat het gratis Supabase-project pauzeert
  // bij inactiviteit. Doet elke 5+ dagen een mini-query.
  try {
    const lastPing = parseInt(localStorage.getItem('sok_last_ping') || '0', 10);
    const ageMs = Date.now() - lastPing;
    if (sess && navigator.onLine && ageMs > 5 * 24 * 3600 * 1000) {
      sb.from('app_instellingen').select('id').limit(1)
        .then(() => localStorage.setItem('sok_last_ping', String(Date.now())))
        .catch(() => {});
    }
  } catch (_) {}

  // Online: automatisch wegfaden na de ingestelde duur.
  // Offline: blijft staan tot de gebruiker op "Verder" klikt.
  if (splashOn && navigator.onLine && !Cloud.offline) {
    Splash.autoDismiss();
  }

  // R2 auto-sync op de achtergrond (beheerder-only). Migreert losse
  // Supabase-Storage-bestanden naar R2 en zet R2-bestanden in dossier-
  // submappen zonder dat de beheerder ergens op hoeft te klikken.
  if (sess && navigator.onLine && typeof autoSyncNaarR2 === 'function') {
    setTimeout(() => { try { autoSyncNaarR2(); } catch (_) {} }, 5000);
  }

  const clearBtn = document.getElementById('login-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      const errEl = document.getElementById('login-error');
      if (errEl) errEl.hidden = true;
      document.getElementById('login-username').focus();
    });
  }

  const forgot = document.getElementById('login-forgot');
  if (forgot) {
    forgot.addEventListener('click', async e => {
      e.preventDefault();
      const def = document.getElementById('login-username').value.trim();
      const email = prompt('Vul je e-mailadres in om een herstel-link te ontvangen:', def);
      if (!email) return;
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: location.origin + location.pathname,
        });
        if (error) throw error;
        Modal.show({ type: 'success', title: 'Herstel-link verstuurd',
          message: `We hebben een wachtwoord-herstel-link gestuurd naar ${email}. Check je inbox (en spam-map).` });
      } catch (err) {
        Modal.show({ type: 'error', title: 'Verzenden mislukt',
          message: err.message || String(err) });
      }
    });
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
    try { await Cloud.loadAll(); } catch (e2) { Modal.show({ type: 'error', title: 'Laden mislukt', message: e2.message || String(e2) }); }
    try { await Settings.loadFromCloud(); Branding.apply(); } catch (_) {}
    updateOfflineUI();
    if (!location.hash || location.hash === '#/login') location.hash = '#/';
    Router.handle();
  });

  const doLogout = async () => {
    const ok = await Modal.confirm({
      type: 'warning',
      title: 'Uitloggen?',
      message: 'Weet je zeker dat je wilt uitloggen? Niet-opgeslagen wijzigingen kunnen verloren gaan.',
      confirmText: 'Uitloggen',
      cancelText: 'Annuleren',
    });
    if (!ok) return;
    await Auth.logout();
    cleanSessionStorage();
    location.hash = '';
    Router.handle();
  };
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  const btnLogoutSide = document.getElementById('btn-logout-side');
  if (btnLogoutSide) btnLogoutSide.addEventListener('click', doLogout);

  // ─── Profielkeuze: Rume of Robert ────────────────────────────
  function cleanSessionStorage() {
    ActiveProfile.clear();
    Cloud.cache = { dossiers: [], kosten: [], notities: [], kist_afbeeldingen: [], profiles: [], planning_items: [], kist_voorraad: [] };
    Cloud.loaded = false;
    // Sessie-specifieke localStorage opruimen — voorkomt dat de volgende
    // gebruiker op een gedeelde iPad de cache/voorkeuren van de vorige ziet
    // Gevoelige per-account instellingen uit het geheugen halen zodat het
    // volgende account op dit toestel ze niet ziet (opnieuw geladen bij login).
    Settings._secretCache = null;
    try {
      const sessieKeys = ['sok_mirror', 'sok_kosten_collapsed', 'sok_last_ping', 'sok_id_show_color'];
      sessieKeys.forEach(k => localStorage.removeItem(k));
      // Alle draft-keys (per-dossier intake-formulier autosave) én de
      // per-account gevoelige spiegels (sok_secrets_<id>) ook weg
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sok_draft_') || k.startsWith('sok_wizard_step_') || k.startsWith('sok_wizard_max_') || k.startsWith(Settings.SECRET_KEY_PREFIX))) localStorage.removeItem(k);
      }
    } catch (_) {}
  }

  // Event delegation — profielknoppen worden dynamisch gerenderd per opening
  document.getElementById('profile-screen').addEventListener('click', async e => {
    const btn = e.target.closest('.profile-option[data-profile]');
    if (!btn) return;
    const id = btn.getAttribute('data-profile');
    const prof = ActiveProfile.byId(id);
    if (prof && prof.rol === 'beheerder' && prof.pincode) {
      const res = await PincodePrompt.open(prof);
      if (!res) return;
      // Startpincode '0000' (of allemaal nullen) → gebruiker dwingen een
      // eigen pincode te kiezen vóór het profiel actief mag worden.
      if (res === 'setup') {
        const nieuw = await PincodePrompt.setup(prof);
        if (!nieuw) return;
        try {
          const lijst = (Settings.get('profielen') || []).map(p =>
            p.id === prof.id ? Object.assign({}, p, { pincode: nieuw }) : p);
          Settings.set({ profielen: lijst });
          Toast.show('Nieuwe pincode ingesteld — voortaan hiermee inloggen.', 'success');
        } catch (err) {
          Toast.show('Pincode-opslag mislukt: ' + (err.message || err), 'error');
          return;
        }
      }
    }
    ActiveProfile.set(id);
    Router.handle();
    try {
      const p = ActiveProfile.current();
      if (p && p.name) setTimeout(() => Toast.show('Ingelogd als: ' + p.name, 'success'), 60);
    } catch (_) {}
  });
  const btnProfLogout = document.getElementById('profile-logout');
  if (btnProfLogout) btnProfLogout.addEventListener('click', async () => {
    await Auth.logout();
    cleanSessionStorage();
    location.hash = '';
    Router.handle();
  });
  // Klik op de chip in de topbar → terug naar profielkeuze
  document.getElementById('btn-active-profile').addEventListener('click', () => {
    ActiveProfile.clear();
    Router.handle();
  });

  Router.start();

  // APK-update-check op de achtergrond. Doet alleen iets als de app als
  // APK draait (Capacitor native platform). Wacht 4s zodat de app eerst
  // rustig laadt en de gebruiker niet meteen een banner in beeld krijgt.
  setTimeout(() => { try { ApkUpdater.check(); } catch (_) {} }, 4000);
  // En elk uur opnieuw kijken zolang de tablet aanstaat.
  setInterval(() => { try { ApkUpdater.check(); } catch (_) {} }, 60 * 60 * 1000);
})();
