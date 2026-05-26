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
  KIST_AFBEELDINGEN: 'kist_afbeeldingen',
  BLOEMEN: 'bloemen_catalogus',
  ETEN_DRINKEN: 'eten_drinken_catalogus',
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
  cache: { dossiers: [], taken: [], kosten: [], notities: [], documenten: [], kist_afbeeldingen: [], bloemen_catalogus: [], eten_drinken_catalogus: [] },
  loaded: false,
  offline: false,

  async loadAll() {
    try {
      const [d, t, k, n, doc, kim, blm, ed] = await Promise.all([
        sb.from('dossiers').select('*').order('updated_at', { ascending: false }),
        sb.from('taken').select('*').order('volgorde', { ascending: true }),
        sb.from('kosten').select('*').order('id', { ascending: true }),
        sb.from('notities').select('*').order('created_at', { ascending: false }),
        sb.from('documenten').select('*').order('geupload_op', { ascending: false }),
        sb.from('kist_afbeeldingen').select('*'),
        sb.from('bloemen_catalogus').select('*').order('naam', { ascending: true }),
        sb.from('eten_drinken_catalogus').select('*').order('naam', { ascending: true }),
      ]);
      if (d.error) throw d.error;
      Cloud.cache.dossiers = (d.data || []).map(normRow);
      Cloud.cache.taken = (t.data || []).map(normRow);
      Cloud.cache.kosten = (k.data || []).map(normKosten);
      Cloud.cache.notities = (n.data || []).map(normRow);
      Cloud.cache.documenten = (doc.data || []).map(normRow);
      Cloud.cache.kist_afbeeldingen = (kim.data || []).map(normRow);
      Cloud.cache.bloemen_catalogus = (blm.data || []).map(normBloem);
      Cloud.cache.eten_drinken_catalogus = (ed.data || []).map(normBloem);
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

function normRow(r) { return r; }
function normKosten(r) { return Object.assign({}, r, { bedrag: parseFloat(r.bedrag) || 0 }); }
function normBloem(r) { return Object.assign({}, r, { bedrag: parseFloat(r.bedrag) || 0 }); }
function normalize(tbl, row) {
  if (tbl === 'kosten') return normKosten(row);
  if (tbl === 'bloemen_catalogus' || tbl === 'eten_drinken_catalogus') return normBloem(row);
  return row;
}

// DB façade — sync reads uit cache, async writes naar Supabase
const DB = {
  list(tbl) { return Cloud.cache[tbl] || []; },
  byId(tbl, id) { return (Cloud.cache[tbl] || []).find(x => x.id === id); },
  where(tbl, fn) { return (Cloud.cache[tbl] || []).filter(fn); },

  async insert(tbl, payload) {
    if (!navigator.onLine) {
      Modal.show({
        type: 'offline',
        title: 'Geen internetverbinding',
        message: 'Wijziging niet bewaard. Bestaande dossiers blijven veilig in de cloud staan. Probeer opnieuw zodra je weer online bent.',
      });
      throw new Error('offline');
    }
    const u = Auth.current();
    const row = Object.assign({}, payload);
    if (tbl === 'dossiers' && u) row.created_by = u.id;
    if (tbl === 'notities' && u) row.auteur_id = u.id;
    if (tbl === 'documenten' && u) row.geupload_door = u.id;
    cleanEmpty(row);
    const { data, error } = await sb.from(tbl).insert(row).select().single();
    if (error) {
      if (isStaleReferenceError(error)) {
        await handleStaleCache();
        throw error;
      }
      Modal.show({ type: 'error', title: 'Opslaan mislukt', message: error.message });
      throw error;
    }
    const norm = normalize(tbl, data);
    Cloud.cache[tbl].push(norm);
    return norm;
  },

  async update(tbl, id, patch) {
    if (!navigator.onLine) {
      Modal.show({
        type: 'offline',
        title: 'Geen internetverbinding',
        message: 'Wijziging niet bewaard. Bestaande dossiers blijven veilig in de cloud staan. Probeer opnieuw zodra je weer online bent.',
      });
      throw new Error('offline');
    }
    const p = Object.assign({}, patch);
    cleanEmpty(p);
    const { data, error } = await sb.from(tbl).update(p).eq('id', id).select().single();
    if (error) {
      if (isStaleReferenceError(error)) {
        await handleStaleCache();
        throw error;
      }
      Modal.show({ type: 'error', title: 'Bijwerken mislukt', message: error.message });
      throw error;
    }
    const norm = normalize(tbl, data);
    const i = Cloud.cache[tbl].findIndex(x => x.id === id);
    if (i >= 0) Cloud.cache[tbl][i] = norm;
    return norm;
  },

  async remove(tbl, id) {
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

// ─── Storage (documenten-uploads, privé) ────────────────────────────────────
const Storage = {
  async upload(dossierId, file) {
    const compressed = await compressImage(file, 2200, 0.9); // images compressed; PDFs etc. blijven onveranderd
    const safe = compressed.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${dossierId}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from('documenten').upload(path, compressed, { upsert: false });
    if (error) {
      Modal.show({ type: 'error', title: 'Upload mislukt', message: error.message });
      throw error;
    }
    return path;
  },
  async signedUrl(path, seconds = 60) {
    const { data, error } = await sb.storage.from('documenten').createSignedUrl(path, seconds);
    if (error) {
      Modal.show({ type: 'error', title: 'Download-link mislukt', message: error.message });
      throw error;
    }
    return data.signedUrl;
  },
  async remove(path) {
    const { error } = await sb.storage.from('documenten').remove([path]);
    if (error) console.warn('Bestand verwijderen faalde:', error.message);
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

// ─── Foto van overledene (publieke bucket 'documenten' — privé via signed URLs zou ook kunnen, maar voor weergave op rouwkaart maken we een aparte bucket) ───
const FotoOverledene = {
  publicUrl(path) {
    if (!path) return null;
    const { data } = sb.storage.from('overledenen').getPublicUrl(path);
    return data?.publicUrl || null;
  },
  urlVoor(path) {
    if (!path) return null;
    const base = FotoOverledene.publicUrl(path);
    if (!base) return null;
    return base + '?v=' + Date.now();
  },
  async upload(dossierId, file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${dossierId}/foto.${ext}`;
    const { error } = await sb.storage.from('overledenen').upload(path, file, {
      upsert: true, cacheControl: '3600', contentType: file.type || undefined,
    });
    if (error) {
      Modal.show({ type: 'error', title: 'Upload mislukt', message: error.message });
      throw error;
    }
    return path;
  },
  async remove(path) {
    if (!path) return;
    await sb.storage.from('overledenen').remove([path]).catch(() => {});
  },
};

// ─── Paspoort-kaart visualisatie (door Android NFC-scanner app gemaakt) ──
// Zelfde 'overledenen' bucket; pad staat in dossiers.paspoort_kaart_pad
const PaspoortKaart = {
  publicUrl(path) {
    if (!path) return null;
    const { data } = sb.storage.from('overledenen').getPublicUrl(path);
    return data?.publicUrl || null;
  },
  urlVoor(path) {
    if (!path) return null;
    const base = PaspoortKaart.publicUrl(path);
    if (!base) return null;
    return base + '?v=' + Date.now();
  },
  async remove(path) {
    if (!path) return;
    await sb.storage.from('overledenen').remove([path]).catch(() => {});
  },
};

// ─── Eten & drinken-catalogus + foto's (publieke bucket) ────────────────────
const EtenDrinkenFotos = {
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
    const r = EtenDrinkenFotos.byNaam(naam);
    if (!r || !r.storage_pad) return null;
    const base = EtenDrinkenFotos.publicUrl(r.storage_pad);
    if (!base) return null;
    const ts = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
    return base + '?v=' + ts;
  },
  async uploadFoto(naam, file) {
    file = await compressImage(file, 1600, 0.85);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${EtenDrinkenFotos.slug(naam)}.${ext}`;
    const oude = (Cloud.cache.eten_drinken_catalogus || []).filter(b => b.naam === naam);
    for (const o of oude) {
      if (o.storage_pad && o.storage_pad !== path) {
        await sb.storage.from('eten_drinken').remove([o.storage_pad]).catch(() => {});
      }
    }
    const { error: upErr } = await sb.storage.from('eten_drinken').upload(path, file, {
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
      await sb.storage.from('eten_drinken').remove([b.storage_pad]).catch(() => {});
    }
  },
};
