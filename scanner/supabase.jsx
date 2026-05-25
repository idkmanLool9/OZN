// Supabase-client + helpers. Werkt tegen exact dezelfde database als de
// uitvaart-app — login is gedeeld, dossiers + documenten worden gelezen
// en geschreven via dezelfde tabellen.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

const SBAuth = {
  async session() {
    const { data } = await sb.auth.getSession();
    return data.session || null;
  },
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return data.session;
  },
  async signOut() { await sb.auth.signOut(); },
  current() {
    // Synchroon — alleen na een sessie-check op te halen
    return sb.auth._currentSession ? sb.auth._currentSession.user : null;
  },
};

// Dossiers ophalen voor de picker
async function fetchDossiers() {
  const { data, error } = await sb.from('dossiers')
    .select('id, dossier_nummer, voornaam, achternaam, contact_naam, contact_voornaam, updated_at')
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return data || [];
}

// Eén dossier-rij ophalen (voor preview-info op latere schermen)
async function fetchDossier(id) {
  const { data, error } = await sb.from('dossiers')
    .select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Velden updaten op een dossier (BSN, naam, geboortedatum, etc.)
async function updateDossier(id, patch) {
  patch.updated_at = new Date().toISOString();
  const { error } = await sb.from('dossiers').update(patch).eq('id', id);
  if (error) throw error;
}

// Document uploaden naar Supabase Storage + bijbehorende rij in documenten-tabel
async function uploadDocument(dossierId, file, opts = {}) {
  const safeName = (opts.naam || file.name || 'scan').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${dossierId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await sb.storage.from('documenten').upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await sb.from('documenten').insert({
    dossier_id: dossierId,
    naam: opts.naam || file.name || 'Gescand document',
    type: opts.type || 'identiteitsbewijs',
    storage_pad: path,
    grootte: file.size || null,
  }).select().single();
  if (error) throw error;
  return data;
}

window.sb = sb;
window.SBAuth = SBAuth;
window.fetchDossiers = fetchDossiers;
window.fetchDossier = fetchDossier;
window.updateDossier = updateDossier;
window.uploadDocument = uploadDocument;
