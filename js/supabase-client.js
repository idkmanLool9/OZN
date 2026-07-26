// Supabase-client + Auth- en DB-wrappers (vervangen de localStorage-versies)

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const KEYS = {
  DOSSIERS: 'dossiers',
  KOSTEN: 'kosten',
  NOTITIES: 'notities',
  KIST_AFBEELDINGEN: 'kist_afbeeldingen',
  PROFIELEN: 'profiles',
  PLANNING: 'planning_items',
  KIST_VOORRAAD: 'kist_voorraad', // voorraad per kist-naam (beheerder-only)
};

// ─── Auth ────────────────────────────────────────────────────────────────────
let _session = null;
let _rol = null;   // 'beheerder' | 'medewerker' — uit public.profiles
let _offlineAuth = false;  // draai je op een offline-fallback-sessie?

const AUTH_SNAP_KEY = 'sok_auth_snapshot';

function _saveAuthSnapshot() {
  try {
    if (!_session || !_session.user) return;
    const u = _session.user;
    localStorage.setItem(AUTH_SNAP_KEY, JSON.stringify({
      userId:   u.id,
      email:    u.email,
      fullName: (u.user_metadata && u.user_metadata.full_name) || u.email,
      role:     _rol || 'medewerker',
      savedAt:  Date.now(),
    }));
  } catch (_) {}
}

function _restoreAuthSnapshot() {
  try {
    const raw = localStorage.getItem(AUTH_SNAP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

const Auth = {
  async init() {
    const { data } = await sb.auth.getSession();
    _session = data.session || null;
    sb.auth.onAuthStateChange((_evt, sess) => {
      _session = sess || null;
      _rol = null;
      _offlineAuth = false;
      if (_session) {
        Auth.loadRol().then(_saveAuthSnapshot);
      } else if (_evt === 'SIGNED_OUT') {
        // Alleen bij expliciete uitloggen de snapshot wissen.
        try { localStorage.removeItem(AUTH_SNAP_KEY); } catch (_) {}
      }
    });
    if (_session) {
      await Auth.loadRol();
      _saveAuthSnapshot();
    } else if (!navigator.onLine) {
      // Offline: fallback op de opgeslagen snapshot zodat de gebruiker
      // gewoon door de app kan bladeren (leesmodus). Als 'ie weer online
      // is, herstelt Supabase de echte sessie en overschrijft deze.
      const snap = _restoreAuthSnapshot();
      if (snap && snap.userId) {
        _session = {
          user: {
            id: snap.userId,
            email: snap.email,
            user_metadata: { full_name: snap.fullName },
          },
          access_token: '',
          refresh_token: '',
        };
        _rol = snap.role || 'medewerker';
        _offlineAuth = true;
      }
    }
    return _session;
  },
  // Ben je nu op een offline-fallback-sessie? Views kunnen dit gebruiken om
  // schrijf-acties te blokkeren of een 'leesmodus'-badge te tonen.
  isOfflineAuth() { return _offlineAuth; },
  // Haal de rol van de ingelogde gebruiker op uit profiles (RLS: eigen rij).
  async loadRol() {
    try {
      const uid = _session && _session.user && _session.user.id;
      if (!uid) { _rol = null; return; }
      const { data } = await sb.from('profiles').select('rol').eq('id', uid).maybeSingle();
      _rol = (data && data.rol) || 'medewerker';
    } catch (_) { _rol = 'medewerker'; }
  },
  // Effectieve rol = laagste van (account-rol, actieve profiel-rol). Zo kan
  // een beheerder-account per profiel worden beperkt tot medewerker-view.
  // Een medewerker-account kan nooit ineens beheerder worden — server-side
  // (RLS) blijft de account-rol de baas.
  _effectieveRol() {
    const acc = _rol || 'medewerker';
    let prof = 'beheerder';
    try {
      if (typeof ActiveProfile !== 'undefined') {
        const p = ActiveProfile.current();
        if (p && p.rol) prof = p.rol;
      }
    } catch (_) {}
    return (acc === 'beheerder' && prof === 'beheerder') ? 'beheerder' : 'medewerker';
  },
  rol() { return Auth._effectieveRol(); },
  isBeheerder() { return Auth._effectieveRol() === 'beheerder'; },
  // Rauwe account-rol (zonder profiel-beperking) — voor UI-plekken die
  // moeten weten of het account onderliggend beheerder is (bv. om aan te
  // geven waarom een medewerker-profiel is gekozen).
  accountRol() { return _rol || 'medewerker'; },
  // Mag deze gebruiker prijzen/bedragen zien? Effectieve beheerder altijd;
  // effectieve medewerker alleen als de gedeelde instelling het toestaat.
  // (Server dwingt dit óók af via mag_prijzen_zien() als het account
  // medewerker is; als het account beheerder is, is server sowieso open.)
  magPrijzenZien() {
    if (Auth._effectieveRol() === 'beheerder') return true;
    try { return !!(typeof Settings !== 'undefined' && Settings.get('medewerker_ziet_prijzen')); }
    catch (_) { return false; }
  },
  current() {
    if (!_session) return null;
    const u = _session.user;
    return { id: u.id, email: u.email, fullName: u.user_metadata?.full_name || u.email, role: _rol || 'medewerker' };
  },
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return error.message;
    _session = data.session;
    await Auth.loadRol();
    try { if (typeof AuditLog !== 'undefined') AuditLog.log('login', null, null, { email: email.trim() }); } catch (_) {}
    return null;
  },
  async logout() {
    try { if (typeof AuditLog !== 'undefined') await AuditLog.log('logout', null, null, null); } catch (_) {}
    await sb.auth.signOut(); _session = null;
  },
  // Auth-metadata van de huidige gebruiker (per-account; alleen zichtbaar voor
  // deze ingelogde gebruiker). Wordt gebruikt voor gevoelige, per-account
  // instellingen zoals API-sleutels.
  metadata() { return (_session && _session.user && _session.user.user_metadata) || {}; },
  async changePassword(newPw) {
    const { error } = await sb.auth.updateUser({ password: newPw });
    return error ? error.message : null;
  },
  async updateDisplayName(fullName) {
    const { data, error } = await sb.auth.updateUser({ data: { full_name: fullName } });
    if (error) return error.message;
    if (data && data.user) _session = Object.assign({}, _session || {}, { user: data.user });
    return null;
  },
  async updateEmail(newEmail) {
    const { error } = await sb.auth.updateUser({ email: newEmail });
    return error ? error.message : null;
  },
};

// ─── Cloud DB met in-memory cache (sync reads, async writes) ────────────────
const Cloud = {
  cache: { dossiers: [], kosten: [], notities: [], kist_afbeeldingen: [], profiles: [], planning_items: [], kist_voorraad: [] },
  loaded: false,
  offline: false,

  async loadAll() {
    // Demo-/review-account: nooit de echte dossiers laden, maar fictieve.
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.loadAll();
    try {
      const [d, k, n, kim, pf, pl, kv] = await Promise.all([
        sb.from('dossiers').select('*').order('updated_at', { ascending: false }),
        // Kosten via SECURITY DEFINER-RPC (bedrag gemaskeerd voor medewerker,
        // rij-filter gelijk aan dossiers_select).
        sb.rpc('get_kosten_zicht'),
        sb.from('notities').select('*').order('created_at', { ascending: false }),
        sb.from('kist_afbeeldingen').select('*'),
        // Accounts + rollen (RLS: medewerker ziet enkel eigen rij, beheerder alle)
        sb.from('profiles').select('*').order('naam', { ascending: true }),
        // Planning-agenda (tolerant als de tabel nog niet bestaat)
        sb.from('planning_items').select('*').order('start_ts', { ascending: true }),
        // Kist-voorraad (RLS: beheerder-only; medewerker krijgt lege lijst)
        sb.from('kist_voorraad').select('*'),
      ]);
      if (d.error) throw d.error;
      Cloud.cache.dossiers = (d.data || []).map(normRow);
      // RPC returns unordered; sorteer in JS op id
      Cloud.cache.kosten = ((k.data || []).slice().sort((a, b) => (a.id||0) - (b.id||0))).map(normKosten);
      Cloud.cache.notities = (n.data || []).map(normRow);
      Cloud.cache.kist_afbeeldingen = (kim.data || []).map(normRow);
      Cloud.cache.profiles = ((pf && pf.data) || []).map(normRow);
      Cloud.cache.planning_items = ((pl && pl.data) || []).map(normRow);
      Cloud.cache.kist_voorraad = ((kv && kv.data) || []).map(normRow);
      Cloud.loaded = true;
      Cloud.offline = false;
      try { localStorage.setItem('sok_mirror', JSON.stringify({ cache: Cloud.cache, savedAt: new Date().toISOString() })); } catch (_) {}
    } catch (err) {
      // Geen verbinding of API-fout: probeer lokale spiegel te gebruiken
      const raw = localStorage.getItem('sok_mirror');
      if (raw) {
        try {
          const m = JSON.parse(raw);
          Cloud.cache = m.cache || Cloud.cache;
          Cloud.cache.savedAt = m.savedAt;
          Cloud.loaded = true;
          Cloud.offline = true;
          return;
        } catch (_) {}
      }
      throw err;
    }
  },
};

// Tabellen die een 'bijgewerkt_door' kolom hebben (zie supabase-schema.sql)
const TRACK_TABLES = new Set(['dossiers', 'kosten', 'documenten', 'gezinnen', 'leden']);

// Wrapper rond insert/update: als de DB nog geen bijgewerkt_door kolom heeft
// (oude schema, gebruiker heeft migratie nog niet gedraaid), proberen we het
// nogmaals zonder het veld in plaats van de hele save te laten falen.
function isMissingTrackColumn(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  // PostgREST: PGRST204 = "Could not find the 'X' column"
  // Postgres : 42703  = "column ... does not exist"
  return (err.code === 'PGRST204' || err.code === '42703') &&
         msg.includes('bijgewerkt_door');
}

async function insertWithTrackFallback(tbl, row) {
  const { data, error } = await sb.from(tbl).insert(row).select().single();
  if (!error) return data;
  if (isMissingTrackColumn(error) && row.bijgewerkt_door !== undefined) {
    const { bijgewerkt_door, ...rest } = row;
    const retry = await sb.from(tbl).insert(rest).select().single();
    if (!retry.error) {
      logTrackColumnHint();
      return retry.data;
    }
  }
  if (isStaleReferenceError(error)) { await handleStaleCache(); throw error; }
  Modal.show({ type: 'error', title: 'Opslaan mislukt', message: error.message });
  throw error;
}

async function updateWithTrackFallback(tbl, id, patch) {
  const { data, error } = await sb.from(tbl).update(patch).eq('id', id).select().single();
  if (!error) return data;
  if (isMissingTrackColumn(error) && patch.bijgewerkt_door !== undefined) {
    const { bijgewerkt_door, ...rest } = patch;
    const retry = await sb.from(tbl).update(rest).eq('id', id).select().single();
    if (!retry.error) {
      logTrackColumnHint();
      return retry.data;
    }
  }
  if (isStaleReferenceError(error)) { await handleStaleCache(); throw error; }
  Modal.show({ type: 'error', title: 'Bijwerken mislukt', message: error.message });
  throw error;
}

let _trackHintLogged = false;
function logTrackColumnHint() {
  if (_trackHintLogged) return;
  _trackHintLogged = true;
  console.warn(
    '[uitvaart] Kolom "bijgewerkt_door" ontbreekt — wie-wijzigde-wat-tracking is uit. ' +
    'Draai de SQL-migratie in supabase-schema.sql (ALTER TABLE dossiers ADD COLUMN bijgewerkt_door TEXT) ' +
    'gevolgd door NOTIFY pgrst, \'reload schema\';');
}

function normRow(r) { return r; }
function normKosten(r) { return Object.assign({}, r, { bedrag: parseFloat(r.bedrag) || 0 }); }
function normBloem(r) { return Object.assign({}, r, { bedrag: parseFloat(r.bedrag) || 0 }); }
function normEten(r)  { return Object.assign({}, r, { bedrag: parseFloat(r.bedrag) || 0 }); }
function normalize(tbl, row) {
  if (tbl === 'kosten') return normKosten(row);
  if (tbl === 'bloemen_catalogus') return normBloem(row);
  if (tbl === 'eten_drinken_catalogus') return normEten(row);
  return row;
}

// DB façade — sync reads uit cache, async writes naar Supabase
// LET OP: id-vergelijking gebeurt ALTIJD als string. Router levert ids als
// string uit URL, Supabase levert ze als number. Zonder deze coercie mist
// findIndex zelfs bij een simpele update — zie audit 2026-07-09 bug J.
function _idEq(a, b) { return String(a) === String(b); }
const DB = {
  list(tbl) { return Cloud.cache[tbl] || []; },
  byId(tbl, id) { return (Cloud.cache[tbl] || []).find(x => _idEq(x.id, id)); },
  where(tbl, fn) { return (Cloud.cache[tbl] || []).filter(fn); },

  async insert(tbl, payload) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.insert(tbl, payload);
    if (!navigator.onLine) {
      try { Toast.show('Offline — wijziging niet opgeslagen. Concept blijft in de wizard bewaard.', 'error'); } catch (_) {}
      throw new Error('offline');
    }
    if (_offlineAuth) {
      try { Toast.show('Leesmodus — log opnieuw in om te kunnen opslaan.', 'error'); } catch (_) {}
      throw new Error('offline_auth');
    }
    const u = Auth.current();
    // Dev-profiel wordt NIET meegeschreven in bijgewerkt_door of auteur —
    // anders ziet het team 'Dev' als laatst gewijzigd op elk dossier waar
    // de maker een test op heeft gedaan.
    const isDev = (typeof ActiveProfile !== 'undefined' && ActiveProfile.isDev && ActiveProfile.isDev());
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current() && !isDev)
      ? ActiveProfile.current().name : null;
    const row = Object.assign({}, payload);
    if (tbl === 'dossiers' && u) row.created_by = u.id;
    if (tbl === 'notities' && u) row.auteur_id = u.id;
    if (tbl === 'documenten' && u) row.geupload_door = u.id;
    // Auto-track: welk profiel (Rume / Robert) deed de wijziging?
    if (TRACK_TABLES.has(tbl) && profielNaam && row.bijgewerkt_door == null) {
      row.bijgewerkt_door = profielNaam;
    }
    if (tbl === 'notities' && profielNaam && !row.auteur) {
      row.auteur = profielNaam;
    }
    cleanEmpty(row);
    const data = await insertWithTrackFallback(tbl, row);
    const norm = normalize(tbl, data);
    Cloud.cache[tbl].push(norm);
    AuditLog.log('insert', tbl, norm && norm.id, { row: sanitizeForAudit(row) });
    return norm;
  },

  async update(tbl, id, patch) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.update(tbl, id, patch);
    if (!navigator.onLine) {
      try { Toast.show('Offline — wijziging niet opgeslagen. Concept blijft in de wizard bewaard.', 'error'); } catch (_) {}
      throw new Error('offline');
    }
    if (_offlineAuth) {
      try { Toast.show('Leesmodus — log opnieuw in om te kunnen opslaan.', 'error'); } catch (_) {}
      throw new Error('offline_auth');
    }
    const p = Object.assign({}, patch);
    const isDev = (typeof ActiveProfile !== 'undefined' && ActiveProfile.isDev && ActiveProfile.isDev());
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current() && !isDev)
      ? ActiveProfile.current().name : null;
    if (TRACK_TABLES.has(tbl) && profielNaam && p.bijgewerkt_door === undefined) {
      p.bijgewerkt_door = profielNaam;
    }
    cleanEmpty(p);
    const oud = (Cloud.cache[tbl] || []).find(x => _idEq(x.id, id));
    const data = await updateWithTrackFallback(tbl, id, p);
    const norm = normalize(tbl, data);
    const i = Cloud.cache[tbl].findIndex(x => _idEq(x.id, id));
    if (i >= 0) Cloud.cache[tbl][i] = norm;
    AuditLog.log('update', tbl, id, { patch: sanitizeForAudit(p), oud: oud ? diffKeys(oud, norm) : null });
    return norm;
  },

  async remove(tbl, id) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.remove(tbl, id);
    if (!navigator.onLine) {
      try { Toast.show('Offline — verwijderen kan niet zolang je geen internet hebt.', 'error'); } catch (_) {}
      throw new Error('offline');
    }
    if (_offlineAuth) {
      try { Toast.show('Leesmodus — log opnieuw in om te kunnen verwijderen.', 'error'); } catch (_) {}
      throw new Error('offline_auth');
    }
    const oud = (Cloud.cache[tbl] || []).find(x => _idEq(x.id, id));
    const { error } = await sb.from(tbl).delete().eq('id', id);
    if (error) {
      Modal.show({ type: 'error', title: 'Verwijderen mislukt', message: error.message });
      throw error;
    }
    Cloud.cache[tbl] = Cloud.cache[tbl].filter(x => !_idEq(x.id, id));
    AuditLog.log('delete', tbl, id, { was: oud ? sanitizeForAudit(oud) : null });
  },

  async removeWhere(tbl, fn) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.removeWhere(tbl, fn);
    const ids = Cloud.cache[tbl].filter(fn).map(x => x.id);
    if (ids.length === 0) return;
    const { error } = await sb.from(tbl).delete().in('id', ids);
    if (error) {
      Modal.show({ type: 'error', title: 'Verwijderen mislukt', message: error.message });
      throw error;
    }
    Cloud.cache[tbl] = Cloud.cache[tbl].filter(x => !ids.includes(x.id));
  },

  async touchDossier(id) {
    return DB.update('dossiers', id, { updated_at: new Date().toISOString() });
  },
};

// Lege strings → null zodat Postgres DATE/etc. kolommen niet klagen
function cleanEmpty(obj) {
  for (const k in obj) {
    if (obj[k] === '' || obj[k] === undefined) obj[k] = null;
  }
}

// Detecteert FK-violation of dossier-niet-gevonden errors
function isStaleReferenceError(err) {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  // Postgres FK-violation = 23503 ; ook 'PGRST...' codes voor row-not-found
  return code === '23503' ||
         msg.includes('violates foreign key') ||
         msg.includes('not found in') ||
         msg.includes('jsonb_object_field');
}

// Cache opnieuw laden + duidelijke uitleg aan de gebruiker
async function handleStaleCache() {
  try { await Cloud.loadAll(); } catch (_) {}
  Modal.show({
    type: 'warning',
    title: 'Gegevens waren verouderd',
    message: 'Je lokale kopie liep niet meer synchroon met de cloud. Alles is nu opnieuw geladen — open het dossier opnieuw via "Dossiers" en probeer het nog een keer.',
  });
}

// ─── R2 (Cloudflare, bucket 'ozn-dossiers') ────────────────────────────────
// Nieuwe uploads gaan hierheen. Paden krijgen prefix 'r2:' zodat we ze in de
// database kunnen onderscheiden van de oude Supabase Storage-paden. Het
// systeem valt terug op Supabase Storage voor paden zonder prefix, zodat
// bestaande dossiers blijven werken tot ze zijn gemigreerd.
const R2_PREFIX_TAG = 'r2:';
const R2 = {
  isR2(path) { return typeof path === 'string' && path.startsWith(R2_PREFIX_TAG); },
  key(path) { return R2.isR2(path) ? path.slice(R2_PREFIX_TAG.length) : path; },
  tag(key)  { return R2_PREFIX_TAG + key; },

  async _sign(op, key, opts = {}) {
    const { data, error } = await sb.functions.invoke('r2-sign', {
      body: { op, key, contentType: opts.contentType, expires: opts.expires },
    });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error + (data.detail ? ': ' + data.detail : ''));
    return data;
  },

  // Sanitize een naam voor gebruik als map-naam op R2 (alleen a-z0-9._-)
  folderName(dossier) {
    if (!dossier) return null;
    const clean = (s) => String(s || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
    const naam = clean([dossier.achternaam, dossier.voornaam].filter(Boolean).join(' '));
    const nummer = clean(dossier.dossier_nummer || (dossier.id ? 'D' + dossier.id : ''));
    const parts = [naam, nummer].filter(Boolean);
    if (!parts.length) return null;
    return parts.join('_');
  },

  // Bestand uploaden. keyPrefix = type ('artsverklaring/', 'bezittingen/'…).
  // Nieuwe structuur (dossier-first):
  //   dossiers/<Achternaam_Dnummer>/<type>/<timestamp>-<random>-<safeName>
  // Voor dossier-snapshots (keyPrefix = 'dossiers/' of leeg) komt het
  // bestand direct in de dossier-map: dossiers/<sub>/<filename>.
  // Zonder dossier-context gebruiken we tijdelijke map _nieuw_<timestamp>;
  // de auto-reorder verplaatst 'm zodra het dossier een naam/ID heeft.
  async upload(file, keyPrefix, dossier) {
    const rawName = (file && file.name) || 'bestand';
    const safe = String(rawName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const rand = Math.random().toString(36).slice(2, 8);
    const sub = R2.folderName(dossier) || `_nieuw_${Date.now()}_${rand}`;
    const type = String(keyPrefix || '').replace(/\/$/, '');
    const filename = `${Date.now()}-${rand}-${safe}`;
    const key = (!type || type === 'dossiers')
      ? `dossiers/${sub}/${filename}`
      : `dossiers/${sub}/${type}/${filename}`;
    const { url, method } = await R2._sign('put', key, { contentType: file.type || 'application/octet-stream' });
    const resp = await fetch(url, {
      method,
      body: file,
      headers: { 'content-type': file.type || 'application/octet-stream' },
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`R2 upload faalde (${resp.status}): ${txt.slice(0, 200)}`);
    }
    return R2.tag(key);
  },

  // Presigned GET URL — te gebruiken als <img src>, downloadlink of fetch().
  async signedUrl(pathOrKey, seconds = 900) {
    const key = R2.key(pathOrKey);
    const { url } = await R2._sign('get', key, { expires: seconds });
    return url;
  },

  async remove(pathOrKey) {
    try {
      const key = R2.key(pathOrKey);
      const { url, method } = await R2._sign('delete', key);
      await fetch(url, { method }).catch(() => {});
    } catch (_) { /* stil */ }
  },
};

// ─── Artsverklaring (nieuw → R2, oud → Supabase 'documenten') ───────────────
// Scan/foto van de artsverklaring of overdraagformulier. Privé opgeslagen;
// bekijken via tijdelijke signed URL. Bestaande paden zonder 'r2:'-prefix
// blijven werken via de oude Supabase Storage.
const ArtsVerklaring = {
  async upload(file, keyPrefix = 'artsverklaring/', dossier = null) {
    const compressed = await compressImage(file, 2200, 0.9);
    try {
      return await R2.upload(compressed, keyPrefix, dossier);
    } catch (e) {
      Modal.show({
        type: 'error',
        title: 'Upload naar R2 mislukt',
        message: (e && e.message) + '\n\nHet bestand is NIET opgeslagen. Controleer de internetverbinding en probeer opnieuw. Als dit blijft: check R2-credentials in Account → Cloudflare R2.',
      });
      throw e;
    }
  },
  async signedUrl(path, seconds = 300) {
    if (!path) return null;
    if (R2.isR2(path)) return R2.signedUrl(path, Math.max(60, seconds));
    const { data, error } = await sb.storage.from('documenten').createSignedUrl(path, seconds);
    if (error) { Modal.show({ type: 'error', title: 'Link mislukt', message: error.message }); throw error; }
    return data.signedUrl;
  },
  async remove(path) {
    if (!path) return;
    if (R2.isR2(path)) return R2.remove(path);
    await sb.storage.from('documenten').remove([path]).catch(() => {});
  },
};

// ─── Archief-compressie: foto's van een gearchiveerd dossier verkleinen ─────
// Doel: storage sparen zonder de foto's kwijt te raken. We downloaden elke
// foto via een tijdelijke signed URL, comprimeren agressief (400 px, 60%
// JPEG — typisch 8-10× kleiner), en overschrijven het bestand op dezelfde
// storage-pad. Het pad in de dossier-rij blijft dus geldig.
const ArchiefCompressie = {
  MAX_DIM: 400,
  QUALITY: 0.60,

  // Verzamel alle storage-paden die bij een dossier horen.
  padenVan(dossier) {
    const paden = [];
    if (dossier.artsverklaring_pad)     paden.push(dossier.artsverklaring_pad);
    if (dossier.overdraagformulier_pad) paden.push(dossier.overdraagformulier_pad);
    if (dossier.bezit_oorbellen_foto)   paden.push(dossier.bezit_oorbellen_foto);
    if (dossier.bezit_ringen_foto)      paden.push(dossier.bezit_ringen_foto);
    if (dossier.bezit_armbanden_foto)   paden.push(dossier.bezit_armbanden_foto);
    if (Array.isArray(dossier.extra_bezittingen)) {
      dossier.extra_bezittingen.forEach(b => { if (b && b.foto_pad) paden.push(b.foto_pad); });
    }
    return paden;
  },

  // Één foto comprimeren: download, hercomprimeer, upload (upsert=true) op
  // hetzelfde pad. Retourneer besparing in bytes (of 0). Alleen voor
  // Supabase Storage-paden; R2-uploads worden al bij het uploaden agressief
  // gecomprimeerd door compressImage(), dus daar is een tweede ronde onnodig.
  async comprimeer1(pad) {
    if (!pad) return 0;
    if (R2.isR2(pad)) return 0;
    try {
      const { data: sign, error: sErr } = await sb.storage.from('documenten').createSignedUrl(pad, 300);
      if (sErr || !sign) return 0;
      const resp = await fetch(sign.signedUrl);
      if (!resp.ok) return 0;
      const blob = await resp.blob();
      const oud = blob.size;
      if (!blob.type || !blob.type.startsWith('image/')) return 0; // PDF/svg overslaan
      // File nodig voor compressImage
      const file = new File([blob], (pad.split('/').pop() || 'foto.jpg'), { type: blob.type });
      const kleiner = await compressImage(file, ArchiefCompressie.MAX_DIM, ArchiefCompressie.QUALITY);
      if (!kleiner || kleiner.size >= oud) return 0;
      const { error: upErr } = await sb.storage.from('documenten').upload(pad, kleiner, {
        upsert: true, contentType: 'image/jpeg', cacheControl: '3600',
      });
      if (upErr) return 0;
      return Math.max(0, oud - kleiner.size);
    } catch (_) { return 0; }
  },

  // Alle foto's van een dossier comprimeren. Retourneer {aantal, bespaardMB}.
  async comprimeerDossier(dossier) {
    const paden = ArchiefCompressie.padenVan(dossier);
    if (!paden.length) return { aantal: 0, bespaard: 0 };
    let totaal = 0;
    let aantal = 0;
    for (const p of paden) {
      const b = await ArchiefCompressie.comprimeer1(p);
      if (b > 0) { totaal += b; aantal++; }
    }
    return { aantal, bespaard: totaal };
  },
};

// ─── Bezittingen-foto's (privé, bucket 'documenten', prefix 'bezittingen/') ─
// Foto's van sieraden e.d. Zelfde patroon als ArtsVerklaring — signed URLs
// om te bekijken; RLS op documenten (documenten_zicht) beperkt tot zichtbare
// dossiers.
const BezittingenFotos = {
  async upload(file, tag = 'item', dossier = null) {
    const compressed = await compressImage(file, 1600, 0.85);
    const safe = (tag || 'item').replace(/[^a-zA-Z0-9._-]/g, '_');
    // Bestandsnaam-hint voor R2 (compressImage geeft geen name terug)
    const named = new File([compressed], `${safe}.jpg`, { type: 'image/jpeg' });
    try {
      return await R2.upload(named, 'bezittingen/', dossier);
    } catch (e) {
      Modal.show({
        type: 'error',
        title: 'Foto niet opgeslagen',
        message: (e && e.message) + '\n\nR2 niet bereikbaar. Probeer opnieuw als de verbinding er weer is.',
      });
      throw e;
    }
  },
  async signedUrl(path, seconds = 300) {
    if (!path) return null;
    if (R2.isR2(path)) return R2.signedUrl(path, Math.max(60, seconds));
    const { data, error } = await sb.storage.from('documenten').createSignedUrl(path, seconds);
    if (error) { Modal.show({ type: 'error', title: 'Link mislukt', message: error.message }); throw error; }
    return data.signedUrl;
  },
  async remove(path) {
    if (!path) return;
    if (R2.isR2(path)) return R2.remove(path);
    await sb.storage.from('documenten').remove([path]).catch(() => {});
  },
};

// ─── R2-migratie: Supabase Storage → R2 voor bestaande dossier-bestanden ───
// Loopt door alle dossiers, pakt de _pad-kolommen die nog op Supabase staan
// (geen r2:-prefix), kopieert het bestand naar R2 en werkt het pad in de DB
// bij. Idempotent: bestaat het bestand al in R2 (r2:-prefix), skip.
// Retourneert per iteratie een progress-callback zodat de UI live kan updaten.
const R2Migratie = {
  // Alle _pad-kolommen die we ondersteunen. Bezittingen-foto's (bezit_X_foto)
  // en extra_bezittingen zitten in aparte structuren.
  DOSSIER_PAD_COLUMNS: [
    'artsverklaring_pad', 'overdraagformulier_pad',
    'bezit_oorbellen_foto', 'bezit_ringen_foto', 'bezit_armbanden_foto',
    'bezit_ketting_foto',   'bezit_bril_foto',   'bezit_horloge_foto',
  ],

  // Verzamel alles wat nog op Supabase staat. Retourneert:
  //   [{ dossierId, veld, pad, extraIdx? }]
  verzamel() {
    const werk = [];
    (Cloud.cache.dossiers || []).forEach(d => {
      R2Migratie.DOSSIER_PAD_COLUMNS.forEach(veld => {
        const p = d[veld];
        if (p && !R2.isR2(p)) werk.push({ dossierId: d.id, veld, pad: p });
      });
      // extra_bezittingen: array met foto_pad-velden
      if (Array.isArray(d.extra_bezittingen)) {
        d.extra_bezittingen.forEach((b, i) => {
          if (b && b.foto_pad && !R2.isR2(b.foto_pad)) {
            werk.push({ dossierId: d.id, veld: '__extra__', pad: b.foto_pad, extraIdx: i });
          }
        });
      }
    });
    return werk;
  },

  // Eén bestand migreren via de r2-migrate-one Edge Function:
  //  1) bereken de nieuwe R2-key mét dossier-submap zodat de mappenstructuur
  //     op R2 direct netjes is (artsverklaring/Achternaam_Dnummer/xxx.jpg)
  //  2) EF haalt file uit Supabase Storage en zet 'm op de nieuwe R2-key
  //  3) client update de DB en verwijdert het origineel uit Supabase Storage
  async migreer1(item) {
    const { dossierId, veld, pad, extraIdx } = item;
    const dossier = DB.byId(KEYS.DOSSIERS, dossierId);
    const sub = dossier ? R2.folderName(dossier) : null;
    // pad = 'artsverklaring/1234-x.jpg' → prefix = 'artsverklaring/', rest = '1234-x.jpg'
    const firstSlash = pad.indexOf('/');
    const prefix = firstSlash >= 0 ? pad.slice(0, firstSlash + 1) : '';
    const restRaw = firstSlash >= 0 ? pad.slice(firstSlash + 1) : pad;
    // Als het bestaande pad al een submap heeft, pak alleen het laatste segment
    const filename = restRaw.split('/').pop();
    const destKey = sub ? `${prefix}${sub}/${filename}` : pad;
    // 1) migreer via Edge Function
    const { data, error } = await sb.functions.invoke('r2-migrate-one', {
      body: { key: pad, destKey },
    });
    if (error) throw new Error('edge-function faalde: ' + (error.message || String(error)));
    if (!data || !data.ok) {
      const det = data && (data.detail || data.error) || 'onbekend';
      throw new Error(det);
    }
    const nieuwPad = R2.tag(data.newKey);
    // 2) DB bijwerken
    if (veld === '__extra__') {
      const d = DB.byId(KEYS.DOSSIERS, dossierId);
      if (!d) throw new Error(`dossier ${dossierId} niet gevonden`);
      const arr = Array.isArray(d.extra_bezittingen) ? d.extra_bezittingen.map(x => ({ ...x })) : [];
      if (arr[extraIdx]) arr[extraIdx].foto_pad = nieuwPad;
      await DB.update(KEYS.DOSSIERS, dossierId, { extra_bezittingen: arr });
    } else {
      await DB.update(KEYS.DOSSIERS, dossierId, { [veld]: nieuwPad });
    }
    // 3) origineel weghalen uit Supabase Storage (best-effort)
    await sb.storage.from('documenten').remove([pad]).catch(() => {});
    return { pad, nieuwPad, bytes: data.bytes || 0 };
  },

  // Batch-migratie. onProgress({ done, totaal, huidig, resultaat, error }).
  async migreerAlles(onProgress) {
    const werk = R2Migratie.verzamel();
    const totaal = werk.length;
    let done = 0;
    let bytesTotaal = 0;
    const errors = [];
    for (const item of werk) {
      onProgress && onProgress({ done, totaal, huidig: item.pad });
      try {
        const r = await R2Migratie.migreer1(item);
        bytesTotaal += r.bytes || 0;
        done++;
        onProgress && onProgress({ done, totaal, huidig: item.pad, resultaat: r });
      } catch (e) {
        errors.push({ pad: item.pad, error: e.message || String(e) });
        onProgress && onProgress({ done, totaal, huidig: item.pad, error: e.message || String(e) });
      }
    }
    return { totaal, done, errors, bytesTotaal };
  },
};

// ─── R2Reorg: bestaande R2-bestanden verplaatsen naar dossier-first schema
// Nieuw pad: dossiers/<Achternaam_Dnummer>/<type>/<filename>
// Oud patroon (nog aanwezig na eerdere migraties):
//   <type>/<filename>              — plat
//   <type>/<sub>/<filename>        — type-first
// Beide worden geïdentificeerd en server-side (r2-move) verplaatst.
const R2Reorg = {
  DOSSIER_PAD_COLUMNS: [
    'artsverklaring_pad', 'overdraagformulier_pad',
    'bezit_oorbellen_foto', 'bezit_ringen_foto', 'bezit_armbanden_foto',
    'bezit_ketting_foto',   'bezit_bril_foto',   'bezit_horloge_foto',
  ],

  _typeVoorVeld(veld) {
    if (veld === 'artsverklaring_pad')     return 'artsverklaring';
    if (veld === 'overdraagformulier_pad') return 'overdraagformulier';
    if (veld === '__extra__')              return 'bezittingen';
    if (veld && veld.indexOf('bezit_') === 0) return 'bezittingen';
    return 'overig';
  },

  _computeDest(sub, type, sourceKey) {
    const parts = sourceKey.split('/');
    const filename = parts[parts.length - 1];
    return `dossiers/${sub}/${type}/${filename}`;
  },

  verzamel() {
    const werk = [];
    (Cloud.cache.dossiers || []).forEach(d => {
      const sub = R2.folderName(d);
      if (!sub) return; // dossier zonder naam/nummer: submap kunnen we niet bepalen
      R2Reorg.DOSSIER_PAD_COLUMNS.forEach(veld => {
        const p = d[veld];
        if (!p || !R2.isR2(p)) return;
        const sourceKey = R2.key(p);
        const type = R2Reorg._typeVoorVeld(veld);
        const expectedPrefix = `dossiers/${sub}/${type}/`;
        if (sourceKey.startsWith(expectedPrefix)) return; // al goed
        const destKey = R2Reorg._computeDest(sub, type, sourceKey);
        werk.push({ dossierId: d.id, veld, oldPath: p, sourceKey, destKey });
      });
      if (Array.isArray(d.extra_bezittingen)) {
        d.extra_bezittingen.forEach((b, i) => {
          if (!b || !b.foto_pad || !R2.isR2(b.foto_pad)) return;
          const sourceKey = R2.key(b.foto_pad);
          const type = 'bezittingen';
          const expectedPrefix = `dossiers/${sub}/${type}/`;
          if (sourceKey.startsWith(expectedPrefix)) return;
          const destKey = R2Reorg._computeDest(sub, type, sourceKey);
          werk.push({ dossierId: d.id, veld: '__extra__', extraIdx: i, oldPath: b.foto_pad, sourceKey, destKey });
        });
      }
    });
    return werk;
  },

  async verplaats1(item) {
    const { dossierId, veld, extraIdx, sourceKey, destKey } = item;
    const { data, error } = await sb.functions.invoke('r2-move', {
      body: { sourceKey, destKey },
    });
    if (error) throw new Error('edge-function faalde: ' + (error.message || String(error)));
    if (!data || !data.ok) throw new Error((data && (data.detail || data.error)) || 'onbekend');
    const nieuwPad = R2.tag(destKey);
    if (veld === '__extra__') {
      const d = DB.byId(KEYS.DOSSIERS, dossierId);
      if (!d) throw new Error(`dossier ${dossierId} niet gevonden`);
      const arr = Array.isArray(d.extra_bezittingen) ? d.extra_bezittingen.map(x => ({ ...x })) : [];
      if (arr[extraIdx]) arr[extraIdx].foto_pad = nieuwPad;
      await DB.update(KEYS.DOSSIERS, dossierId, { extra_bezittingen: arr });
    } else {
      await DB.update(KEYS.DOSSIERS, dossierId, { [veld]: nieuwPad });
    }
    return { sourceKey, destKey };
  },

  async reorganiseerAlles(onProgress) {
    const werk = R2Reorg.verzamel();
    const totaal = werk.length;
    let done = 0;
    const errors = [];
    for (const item of werk) {
      onProgress && onProgress({ done, totaal, huidig: item.sourceKey });
      try {
        await R2Reorg.verplaats1(item);
        done++;
        onProgress && onProgress({ done, totaal, huidig: item.sourceKey, resultaat: { destKey: item.destKey } });
      } catch (e) {
        errors.push({ key: item.sourceKey, error: e.message || String(e) });
        onProgress && onProgress({ done, totaal, huidig: item.sourceKey, error: e.message || String(e) });
      }
    }
    return { totaal, done, errors };
  },
};

// ─── Autonome R2-sync: draait stil op de achtergrond ───────────────────────
// 1) Migreer alles wat nog op Supabase Storage staat → R2
// 2) Order alle R2-bestanden in dossier-submappen
// Faalt stil (niet blokkerend voor de gebruiker); alleen console-log.
// Wordt aangeroepen:
//   - eenmalig per sessie, ~5 sec na login (voor beheerders)
//   - na elke dossier-save, alleen voor dat ene dossier (fijn na intake)
let _r2AutoSyncBusy = false;
async function autoSyncNaarR2() {
  if (_r2AutoSyncBusy) return;
  if (!navigator.onLine) return;
  if (typeof Auth === 'undefined' || !Auth.isBeheerder()) return; // alleen beheerders mogen r2-migrate-one aanroepen
  _r2AutoSyncBusy = true;
  try {
    // Migratie SB Storage → R2 (max 20 tegelijk om lange kliks te voorkomen)
    const mig = R2Migratie.verzamel().slice(0, 20);
    for (const item of mig) {
      try { await R2Migratie.migreer1(item); }
      catch (e) { console.warn('R2 auto-migratie faalde voor', item.pad, e && e.message); }
    }
    // Reorder R2 → submap per dossier (max 40)
    const reorg = R2Reorg.verzamel().slice(0, 40);
    for (const item of reorg) {
      try { await R2Reorg.verplaats1(item); }
      catch (e) { console.warn('R2 auto-reorder faalde voor', item.sourceKey, e && e.message); }
    }
    if (mig.length || reorg.length) {
      console.log(`R2 auto-sync: ${mig.length} gemigreerd, ${reorg.length} geordend.`);
    }
  } finally {
    _r2AutoSyncBusy = false;
  }
}

// Reorder alleen bestanden die bij één specifiek dossier horen. Handig na
// een dossier-save: nieuwe uploads onder 'Achternaam/xxx' krijgen dan meteen
// hun D-nummer erbij ('Achternaam_D42/xxx').
async function autoSyncDossierNaarR2(dossierId) {
  if (!navigator.onLine) return;
  if (typeof Auth === 'undefined' || !Auth.isBeheerder()) return;
  try {
    const werk = R2Reorg.verzamel().filter(i => i.dossierId === dossierId);
    for (const item of werk) {
      try { await R2Reorg.verplaats1(item); }
      catch (e) { console.warn('R2 dossier-reorder faalde voor', item.sourceKey, e && e.message); }
    }
  } catch (e) { console.warn('autoSyncDossierNaarR2:', e && e.message); }
}

// ─── Dossier-PDF automatisch naar R2 (na elke save) ────────────────────────
// Genereert een PDF van het dossier via de bestaande PdfGen + dossierSpec en
// zet 'm neer als dossiers/<folder>/dossier-<yyyy-mm-dd-hhmm>.pdf op R2.
// Wordt asynchroon aangeroepen na een succesvolle save; faalt stil (niet
// blokkerend voor de gebruiker) maar logt naar console.
async function uploadDossierPdfNaarR2(dossier, kostenLijst) {
  try {
    if (!dossier || !dossier.id) return;
    if (typeof PdfGen === 'undefined' || typeof dossierSpec === 'undefined') return;
    const blob = await PdfGen.blobFromSpec(dossierSpec(dossier, kostenLijst || []));
    if (!blob) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const named = new File([blob], `dossier-${stamp}.pdf`, { type: 'application/pdf' });
    await R2.upload(named, 'dossiers/', dossier);
  } catch (e) {
    console.warn('Dossier-PDF-upload naar R2 faalde:', e && e.message);
  }
}

// ─── Kist-voorraad (beheerder-only) ─────────────────────────────────────────
const KistVoorraad = {
  // Alles synchroon uit de cache: welke rij hoort bij deze kist-naam?
  byNaam(naam) { return (Cloud.cache.kist_voorraad || []).find(r => r.naam === naam); },
  all() { return Cloud.cache.kist_voorraad || []; },
  // Alle kisten die onder hun minimum zitten (of geen voorraad hebben).
  laag() {
    return KistVoorraad.all().filter(r => (r.aantal || 0) < (r.min_aantal || 0));
  },
  // Upsert per kist. Werkt met SEL/UPSERT op de 'naam'-PK.
  async upsert(naam, patch) {
    if (!navigator.onLine) throw new Error('offline');
    const bestaand = KistVoorraad.byNaam(naam);
    const row = Object.assign({ naam }, bestaand || {}, patch);
    // Wie wijzigde: actief profiel of e-mail
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current())
      ? ActiveProfile.current().name : null;
    const u = Auth.current();
    row.bijgewerkt_door = profielNaam || (u ? (u.fullName || u.email) : null);
    const { data, error } = await sb.from('kist_voorraad')
      .upsert(row, { onConflict: 'naam' }).select().single();
    if (error) throw error;
    // Cache bijwerken
    const arr = Cloud.cache.kist_voorraad;
    const i = arr.findIndex(x => x.naam === naam);
    if (i >= 0) arr[i] = data; else arr.push(data);
    // Log de handmatige mutatie (aantal / min_aantal wijzigingen)
    try {
      const was = bestaand ? { aantal: bestaand.aantal, min_aantal: bestaand.min_aantal } : null;
      const nu  = { aantal: data.aantal, min_aantal: data.min_aantal };
      AuditLog.log('voorraad', 'kist_voorraad', naam, {
        naam, was, nu, delta: was ? (data.aantal - was.aantal) : data.aantal, reden: 'handmatig',
      });
    } catch (_) {}
    return data;
  },
  // Reserveer 1 stuk (bij dossier-koppeling). Fout is niet-fataal.
  async reserveer1(naam, ctx) { return KistVoorraad._delta(naam, -1, ctx || { reden: 'dossier-koppeling' }); },
  // Omgekeerde van reserveer1: als een dossier van kist wisselt of een kist
  // verwijderd wordt, geeft de oude voorraad +1 terug.
  async terug1(naam, ctx) { return KistVoorraad._delta(naam, +1, ctx || { reden: 'dossier-ontkoppeling' }); },
  // Atomair: 1 RPC-call, oud terug + nieuw gereserveerd binnen één transactie.
  // Voorkomt drift als reserveer1 faalt nadat terug1 al slaagde.
  async wissel(oud, nieuw, ctx) {
    const oudN = (oud || '').trim();
    const nwN  = (nieuw || '').trim();
    if (oudN === nwN) return;
    try {
      const { data, error } = await sb.rpc('kist_voorraad_wissel', { p_oud: oudN || null, p_nieuw: nwN || null });
      if (error) throw error;
      const arr = Cloud.cache.kist_voorraad;
      if (data && data.oud_nieuw != null && oudN) {
        const i = arr.findIndex(r => r.naam === oudN);
        if (i >= 0) arr[i] = Object.assign({}, arr[i], { aantal: data.oud_nieuw });
      }
      if (data && data.nieuw_nieuw != null && nwN) {
        const i = arr.findIndex(r => r.naam === nwN);
        if (i >= 0) arr[i] = Object.assign({}, arr[i], { aantal: data.nieuw_nieuw });
      }
      // Audit-entries voor beide zijden
      try {
        const dossierId = ctx && ctx.dossier_id != null ? String(ctx.dossier_id) : null;
        if (oudN) AuditLog.log('voorraad', 'kist_voorraad', oudN, { naam: oudN, delta: 1, nu: data?.oud_nieuw, reden: 'kist-wissel (oud terug)', dossier_id: dossierId });
        if (nwN)  AuditLog.log('voorraad', 'kist_voorraad', nwN,  { naam: nwN,  delta: -1, nu: data?.nieuw_nieuw, reden: 'kist-wissel (nieuw gereserveerd)', dossier_id: dossierId });
      } catch (_) {}
    } catch (_) {}
  },
  // Atomaire delta via RPC — voorkomt race tussen twee gelijktijdige
  // reserveringen die anders beide dezelfde 'was'-waarde zouden lezen.
  async _delta(naam, delta, ctx) {
    if (!naam) return;
    const cur = KistVoorraad.byNaam(naam);
    if (!cur) return; // nog geen voorraadregel = niet bijhouden
    try {
      const { data, error } = await sb.rpc('kist_voorraad_delta', { p_naam: naam, p_delta: delta });
      if (error) throw error;
      const nieuw = (typeof data === 'number') ? data : Math.max(0, (cur.aantal || 0) + delta);
      const arr = Cloud.cache.kist_voorraad;
      const i = arr.findIndex(r => r.naam === naam);
      if (i >= 0) arr[i] = Object.assign({}, arr[i], { aantal: nieuw });
      // Auditlog: 'voorraad' actie met naam, delta en context (welk dossier).
      try {
        AuditLog.log('voorraad', 'kist_voorraad', naam, {
          naam, delta,
          was: cur.aantal,
          nu: nieuw,
          reden: (ctx && ctx.reden) || (delta < 0 ? 'reservering' : 'teruggave'),
          dossier_id: ctx && ctx.dossier_id != null ? String(ctx.dossier_id) : null,
        });
      } catch (_) {}
    } catch (_) {}
  },
};

// ─── Audit-log ──────────────────────────────────────────────────────────────
// Alle mutaties, logins, logouts en profielwissels worden via de RPC
// `audit_log_schrijf` in de tabel `audit_log` geschreven. Alleen beheerders
// mogen lezen (RLS). Client-side hulp om entries te loggen én op te halen.
function sanitizeForAudit(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const OUT_MAX = 5000;
  const out = {};
  for (const k in obj) {
    const v = obj[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.length > 400) out[k] = v.slice(0, 400) + '…';
    else if (Array.isArray(v)) out[k] = v.length > 20 ? v.slice(0, 20).concat(['…+' + (v.length - 20)]) : v;
    else out[k] = v;
  }
  const s = JSON.stringify(out);
  return s.length > OUT_MAX ? { _truncated: true, keys: Object.keys(out) } : out;
}
function diffKeys(oud, nieuw) {
  if (!oud || !nieuw) return null;
  const changed = {};
  for (const k in nieuw) {
    if (k === 'updated_at' || k === 'bijgewerkt_door') continue;
    if (JSON.stringify(oud[k]) !== JSON.stringify(nieuw[k])) {
      changed[k] = { was: oud[k], nu: nieuw[k] };
    }
  }
  return Object.keys(changed).length ? sanitizeForAudit(changed) : null;
}
const AuditLog = {
  async log(actie, tabel, recordId, detail) {
    try {
      if (!navigator.onLine) return; // stil overslaan als offline; niet blokkerend
      const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current())
        ? ActiveProfile.current().name : null;
      const rid = recordId != null ? String(recordId) : null;
      await sb.rpc('audit_log_schrijf', {
        p_actie: actie,
        p_tabel: tabel || null,
        p_record_id: rid,
        p_detail: detail || null,
        p_profiel_naam: profielNaam,
      });
    } catch (_) { /* logging faalt nooit hard */ }
  },
  async fetch({ limit = 200, offset = 0, actie = null, tabel = null, sinds = null } = {}) {
    if (!navigator.onLine) return [];
    let q = sb.from('audit_log').select('*').order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (actie) q = q.eq('actie', actie);
    if (tabel) q = q.eq('tabel', tabel);
    if (sinds) q = q.gte('created_at', sinds);
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  },
};

// ─── Kistfoto's (publieke bucket) ───────────────────────────────────────────
const KistFotos = {
  slug(naam) {
    return naam.toLowerCase()
      .replace(/[\s/]+/g, '-')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },
  publicUrl(path) {
    if (!path) return null;
    // Volledige URL (bv. hergebruikte kistfoto's uit het andere project) →
    // rechtstreeks gebruiken. Anders bouwen we de URL uit de eigen bucket.
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = sb.storage.from('kisten').getPublicUrl(path);
    return data?.publicUrl || null;
  },
  // Lookup helpers — werken op de cache
  byNaam(naam) {
    return (Cloud.cache.kist_afbeeldingen || []).find(k => k.naam === naam);
  },
  urlVoor(naam) {
    const r = KistFotos.byNaam(naam);
    if (!r) return null;
    const base = KistFotos.publicUrl(r.storage_pad);
    if (!base) return null;
    // cache-buster zodat een nieuwe upload meteen zichtbaar is
    const ts = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
    return base + '?v=' + ts;
  },
  async upload(naam, file) {
    file = await compressImage(file, 1600, 0.85);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${KistFotos.slug(naam)}.${ext}`;
    // Verwijder eerst eventueel oude bestanden (verschillende extensies) van dit model
    const oude = (Cloud.cache.kist_afbeeldingen || []).filter(k => k.naam === naam);
    for (const o of oude) {
      if (o.storage_pad !== path) {
        await sb.storage.from('kisten').remove([o.storage_pad]).catch(() => {});
      }
    }
    const { error: upErr } = await sb.storage.from('kisten').upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || undefined,
    });
    if (upErr) {
      Modal.show({ type: 'error', title: 'Upload mislukt', message: upErr.message });
      throw upErr;
    }
    const row = { naam, storage_pad: path, updated_at: new Date().toISOString() };
    const { data, error } = await sb.from('kist_afbeeldingen').upsert(row, { onConflict: 'naam' }).select().single();
    if (error) {
      Modal.show({ type: 'error', title: 'Opslaan in database mislukt', message: error.message });
      throw error;
    }
    const i = Cloud.cache.kist_afbeeldingen.findIndex(k => k.naam === naam);
    if (i >= 0) Cloud.cache.kist_afbeeldingen[i] = data;
    else Cloud.cache.kist_afbeeldingen.push(data);
    return data;
  },
  async remove(naam) {
    const r = KistFotos.byNaam(naam);
    if (!r) return;
    await sb.storage.from('kisten').remove([r.storage_pad]).catch(() => {});
    const { error } = await sb.from('kist_afbeeldingen').delete().eq('naam', naam);
    if (error) {
      Modal.show({ type: 'error', title: 'Verwijderen mislukt', message: error.message });
      throw error;
    }
    Cloud.cache.kist_afbeeldingen = Cloud.cache.kist_afbeeldingen.filter(k => k.naam !== naam);
  },
};

// ─── Bloemen-catalogus + foto's (publieke bucket) ───────────────────────────
const BloemenFotos = {
  slug(naam) {
    return naam.toLowerCase()
      .replace(/[\s/]+/g, '-')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },
  publicUrl(path) {
    if (!path) return null;
    const { data } = sb.storage.from('bloemen').getPublicUrl(path);
    return data?.publicUrl || null;
  },
  byNaam(naam) {
    return (Cloud.cache.bloemen_catalogus || []).find(b => b.naam === naam);
  },
  urlVoor(naam) {
    const r = BloemenFotos.byNaam(naam);
    if (!r || !r.storage_pad) return null;
    const base = BloemenFotos.publicUrl(r.storage_pad);
    if (!base) return null;
    const ts = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
    return base + '?v=' + ts;
  },
  async uploadFoto(naam, file) {
    file = await compressImage(file, 1600, 0.85);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${BloemenFotos.slug(naam)}.${ext}`;
    const oude = (Cloud.cache.bloemen_catalogus || []).filter(b => b.naam === naam);
    for (const o of oude) {
      if (o.storage_pad && o.storage_pad !== path) {
        await sb.storage.from('bloemen').remove([o.storage_pad]).catch(() => {});
      }
    }
    const { error: upErr } = await sb.storage.from('bloemen').upload(path, file, {
      upsert: true, cacheControl: '3600', contentType: file.type || undefined,
    });
    if (upErr) {
      Modal.show({ type: 'error', title: 'Upload mislukt', message: upErr.message });
      throw upErr;
    }
    return path;
  },
  async removeFoto(b) {
    if (b && b.storage_pad) {
      await sb.storage.from('bloemen').remove([b.storage_pad]).catch(() => {});
    }
  },
};

// ─── Eten & drinken-catalogus + foto's (publieke bucket) ───────────────────
const EtenFotos = {
  slug(naam) {
    return naam.toLowerCase()
      .replace(/[\s/]+/g, '-')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },
  publicUrl(path) {
    if (!path) return null;
    const { data } = sb.storage.from('eten_drinken').getPublicUrl(path);
    return data?.publicUrl || null;
  },
  byNaam(naam) {
    return (Cloud.cache.eten_drinken_catalogus || []).find(b => b.naam === naam);
  },
  urlVoor(naam) {
    const r = EtenFotos.byNaam(naam);
    if (!r || !r.storage_pad) return null;
    const base = EtenFotos.publicUrl(r.storage_pad);
    if (!base) return null;
    const ts = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
    return base + '?v=' + ts;
  },
  async uploadFoto(naam, file) {
    file = await compressImage(file, 1600, 0.85);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${EtenFotos.slug(naam)}.${ext}`;
    const oude = (Cloud.cache.eten_drinken_catalogus || []).filter(b => b.naam === naam);
    for (const o of oude) {
      if (o.storage_pad && o.storage_pad !== path) {
        await sb.storage.from('eten_drinken').remove([o.storage_pad]).catch(() => {});
      }
    }
    const { error } = await sb.storage.from('eten_drinken').upload(path, file, { upsert: true, cacheControl: '3600' });
    if (error) throw error;
    return path;
  },
  async removeFoto(b) {
    if (b && b.storage_pad) {
      await sb.storage.from('eten_drinken').remove([b.storage_pad]).catch(() => {});
    }
  },
};
