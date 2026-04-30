// Supabase-client + Auth- en DB-wrappers (vervangen de localStorage-versies)

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const KEYS = {
  DOSSIERS: 'dossiers',
  TAKEN: 'taken',
  KOSTEN: 'kosten',
  NOTITIES: 'notities',
  DOCUMENTEN: 'documenten',
};

// ─── Auth ────────────────────────────────────────────────────────────────────
let _session = null;

const Auth = {
  async init() {
    const { data } = await sb.auth.getSession();
    _session = data.session || null;
    sb.auth.onAuthStateChange((_evt, sess) => { _session = sess || null; });
    return _session;
  },
  current() {
    if (!_session) return null;
    const u = _session.user;
    return { id: u.id, email: u.email, fullName: u.user_metadata?.full_name || u.email, role: 'beheerder' };
  },
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return error.message;
    _session = data.session;
    return null;
  },
  async logout() { await sb.auth.signOut(); _session = null; },
  async changePassword(newPw) {
    const { error } = await sb.auth.updateUser({ password: newPw });
    return error ? error.message : null;
  },
};

// ─── Cloud DB met in-memory cache (sync reads, async writes) ────────────────
const Cloud = {
  cache: { dossiers: [], taken: [], kosten: [], notities: [], documenten: [] },
  loaded: false,

  async loadAll() {
    const [d, t, k, n, doc] = await Promise.all([
      sb.from('dossiers').select('*').order('updated_at', { ascending: false }),
      sb.from('taken').select('*').order('volgorde', { ascending: true }),
      sb.from('kosten').select('*').order('id', { ascending: true }),
      sb.from('notities').select('*').order('created_at', { ascending: false }),
      sb.from('documenten').select('*').order('geupload_op', { ascending: false }),
    ]);
    if (d.error) throw d.error;
    Cloud.cache.dossiers = (d.data || []).map(normRow);
    Cloud.cache.taken = (t.data || []).map(normRow);
    Cloud.cache.kosten = (k.data || []).map(normKosten);
    Cloud.cache.notities = (n.data || []).map(normRow);
    Cloud.cache.documenten = (doc.data || []).map(normRow);
    Cloud.loaded = true;
  },
};

function normRow(r) { return r; }
function normKosten(r) { return Object.assign({}, r, { bedrag: parseFloat(r.bedrag) || 0 }); }

// DB façade — sync reads uit cache, async writes naar Supabase
const DB = {
  list(tbl) { return Cloud.cache[tbl] || []; },
  byId(tbl, id) { return (Cloud.cache[tbl] || []).find(x => x.id === id); },
  where(tbl, fn) { return (Cloud.cache[tbl] || []).filter(fn); },

  async insert(tbl, payload) {
    const u = Auth.current();
    const row = Object.assign({}, payload);
    if (tbl === 'dossiers' && u) row.created_by = u.id;
    if (tbl === 'notities' && u) row.auteur_id = u.id;
    if (tbl === 'documenten' && u) row.geupload_door = u.id;
    cleanEmpty(row);
    const { data, error } = await sb.from(tbl).insert(row).select().single();
    if (error) { alert('Opslaan mislukt: ' + error.message); throw error; }
    const norm = tbl === 'kosten' ? normKosten(data) : data;
    Cloud.cache[tbl].push(norm);
    return norm;
  },

  async update(tbl, id, patch) {
    const p = Object.assign({}, patch);
    cleanEmpty(p);
    const { data, error } = await sb.from(tbl).update(p).eq('id', id).select().single();
    if (error) { alert('Bijwerken mislukt: ' + error.message); throw error; }
    const norm = tbl === 'kosten' ? normKosten(data) : data;
    const i = Cloud.cache[tbl].findIndex(x => x.id === id);
    if (i >= 0) Cloud.cache[tbl][i] = norm;
    return norm;
  },

  async remove(tbl, id) {
    const { error } = await sb.from(tbl).delete().eq('id', id);
    if (error) { alert('Verwijderen mislukt: ' + error.message); throw error; }
    Cloud.cache[tbl] = Cloud.cache[tbl].filter(x => x.id !== id);
  },

  async removeWhere(tbl, fn) {
    const ids = Cloud.cache[tbl].filter(fn).map(x => x.id);
    if (ids.length === 0) return;
    const { error } = await sb.from(tbl).delete().in('id', ids);
    if (error) { alert('Verwijderen mislukt: ' + error.message); throw error; }
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

// ─── Storage (documenten-uploads) ───────────────────────────────────────────
const Storage = {
  async upload(dossierId, file) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${dossierId}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from('documenten').upload(path, file, { upsert: false });
    if (error) { alert('Upload mislukt: ' + error.message); throw error; }
    return path;
  },
  async signedUrl(path, seconds = 60) {
    const { data, error } = await sb.storage.from('documenten').createSignedUrl(path, seconds);
    if (error) { alert('Download-link mislukt: ' + error.message); throw error; }
    return data.signedUrl;
  },
  async remove(path) {
    const { error } = await sb.storage.from('documenten').remove([path]);
    if (error) console.warn('Bestand verwijderen faalde:', error.message);
  },
};
