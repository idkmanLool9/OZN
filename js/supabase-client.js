// Supabase-client + Auth- en DB-wrappers (vervangen de localStorage-versies)

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const KEYS = {
  DOSSIERS: 'dossiers',
  KOSTEN: 'kosten',
  NOTITIES: 'notities',
  KIST_AFBEELDINGEN: 'kist_afbeeldingen',
  BLOEMEN: 'bloemen_catalogus',
  ETEN: 'eten_drinken_catalogus',
  GEZINNEN: 'gezinnen',
  LEDEN: 'leden',
  PROFIELEN: 'profiles',
  PLANNING: 'planning_items',
};

// ─── Auth ────────────────────────────────────────────────────────────────────
let _session = null;
let _rol = null;   // 'beheerder' | 'medewerker' — uit public.profiles

const Auth = {
  async init() {
    const { data } = await sb.auth.getSession();
    _session = data.session || null;
    sb.auth.onAuthStateChange((_evt, sess) => {
      _session = sess || null;
      _rol = null;
      if (_session) Auth.loadRol();
    });
    if (_session) await Auth.loadRol();
    return _session;
  },
  // Haal de rol van de ingelogde gebruiker op uit profiles (RLS: eigen rij).
  async loadRol() {
    try {
      const uid = _session && _session.user && _session.user.id;
      if (!uid) { _rol = null; return; }
      const { data } = await sb.from('profiles').select('rol').eq('id', uid).maybeSingle();
      _rol = (data && data.rol) || 'medewerker';
    } catch (_) { _rol = 'medewerker'; }
  },
  rol() { return _rol || 'medewerker'; },
  isBeheerder() { return _rol === 'beheerder'; },
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
    return null;
  },
  async logout() { await sb.auth.signOut(); _session = null; },
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
  cache: { dossiers: [], kosten: [], notities: [], kist_afbeeldingen: [], bloemen_catalogus: [], eten_drinken_catalogus: [], gezinnen: [], leden: [], profiles: [], planning_items: [] },
  loaded: false,
  offline: false,

  async loadAll() {
    // Demo-/review-account: nooit de echte dossiers laden, maar fictieve.
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.loadAll();
    try {
      const [d, k, n, kim, blm, etn, gz, ld, pf, pl] = await Promise.all([
        sb.from('dossiers').select('*').order('updated_at', { ascending: false }),
        sb.from('kosten').select('*').order('id', { ascending: true }),
        sb.from('notities').select('*').order('created_at', { ascending: false }),
        sb.from('kist_afbeeldingen').select('*'),
        sb.from('bloemen_catalogus').select('*').order('naam', { ascending: true }),
        sb.from('eten_drinken_catalogus').select('*').order('naam', { ascending: true }),
        // Ledenadministratie — tolerant: als de tabellen nog niet bestaan
        // (migratie nog niet gedraaid) blijven ze gewoon leeg.
        sb.from('gezinnen').select('*').order('familienaam', { ascending: true }),
        sb.from('leden').select('*').order('achternaam', { ascending: true }),
        // Accounts + rollen (RLS: medewerker ziet enkel eigen rij, beheerder alle)
        sb.from('profiles').select('*').order('naam', { ascending: true }),
        // Planning-agenda (tolerant als de tabel nog niet bestaat)
        sb.from('planning_items').select('*').order('start_ts', { ascending: true }),
      ]);
      if (d.error) throw d.error;
      Cloud.cache.dossiers = (d.data || []).map(normRow);
      Cloud.cache.kosten = (k.data || []).map(normKosten);
      Cloud.cache.notities = (n.data || []).map(normRow);
      Cloud.cache.kist_afbeeldingen = (kim.data || []).map(normRow);
      Cloud.cache.bloemen_catalogus = (blm.data || []).map(normBloem);
      Cloud.cache.eten_drinken_catalogus = ((etn && etn.data) || []).map(normEten);
      Cloud.cache.gezinnen = ((gz && gz.data) || []).map(normRow);
      Cloud.cache.leden = ((ld && ld.data) || []).map(normRow);
      Cloud.cache.profiles = ((pf && pf.data) || []).map(normRow);
      Cloud.cache.planning_items = ((pl && pl.data) || []).map(normRow);
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
const DB = {
  list(tbl) { return Cloud.cache[tbl] || []; },
  byId(tbl, id) { return (Cloud.cache[tbl] || []).find(x => x.id === id); },
  where(tbl, fn) { return (Cloud.cache[tbl] || []).filter(fn); },

  async insert(tbl, payload) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.insert(tbl, payload);
    if (!navigator.onLine) {
      Modal.show({
        type: 'offline',
        title: 'Geen internetverbinding',
        message: 'Wijziging niet bewaard. Bestaande dossiers blijven veilig in de cloud staan. Probeer opnieuw zodra je weer online bent.',
      });
      throw new Error('offline');
    }
    const u = Auth.current();
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current())
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
    return norm;
  },

  async update(tbl, id, patch) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.update(tbl, id, patch);
    if (!navigator.onLine) {
      Modal.show({
        type: 'offline',
        title: 'Geen internetverbinding',
        message: 'Wijziging niet bewaard. Bestaande dossiers blijven veilig in de cloud staan. Probeer opnieuw zodra je weer online bent.',
      });
      throw new Error('offline');
    }
    const p = Object.assign({}, patch);
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current())
      ? ActiveProfile.current().name : null;
    if (TRACK_TABLES.has(tbl) && profielNaam && p.bijgewerkt_door === undefined) {
      p.bijgewerkt_door = profielNaam;
    }
    cleanEmpty(p);
    const data = await updateWithTrackFallback(tbl, id, p);
    const norm = normalize(tbl, data);
    const i = Cloud.cache[tbl].findIndex(x => x.id === id);
    if (i >= 0) Cloud.cache[tbl][i] = norm;
    return norm;
  },

  async remove(tbl, id) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return Demo.remove(tbl, id);
    if (!navigator.onLine) {
      Modal.show({
        type: 'offline',
        title: 'Geen internetverbinding',
        message: 'Verwijderen kan niet zolang je offline bent. Probeer opnieuw zodra je weer online bent.',
      });
      throw new Error('offline');
    }
    const { error } = await sb.from(tbl).delete().eq('id', id);
    if (error) {
      Modal.show({ type: 'error', title: 'Verwijderen mislukt', message: error.message });
      throw error;
    }
    Cloud.cache[tbl] = Cloud.cache[tbl].filter(x => x.id !== id);
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

// ─── Artsverklaring (privé, bucket 'documenten') ────────────────────────────
// Scan/foto van de artsverklaring (overlijdensverklaring). Privé opgeslagen;
// bekijken via tijdelijke signed URL.
const ArtsVerklaring = {
  async upload(file) {
    const compressed = await compressImage(file, 2200, 0.9);
    const safe = (compressed.name || 'artsverklaring').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `artsverklaring/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from('documenten').upload(path, compressed, { upsert: false });
    if (error) { Modal.show({ type: 'error', title: 'Upload mislukt', message: error.message }); throw error; }
    return path;
  },
  async signedUrl(path, seconds = 300) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('documenten').createSignedUrl(path, seconds);
    if (error) { Modal.show({ type: 'error', title: 'Link mislukt', message: error.message }); throw error; }
    return data.signedUrl;
  },
  async remove(path) {
    if (!path) return;
    await sb.storage.from('documenten').remove([path]).catch(() => {});
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
