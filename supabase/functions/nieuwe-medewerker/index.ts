// Nieuw medewerker-account aanmaken vanuit de OZN-app.
// Alleen aanroepbaar door een ingelogde beheerder (JWT wordt gecontroleerd op
// role='beheerder' via de profiles-tabel). De service-role key wordt binnen
// deze functie gebruikt om admin.createUser aan te roepen — nooit
// blootgesteld aan de client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('method not allowed', { status: 405, headers: CORS });

  // 1) Wie is de aanroeper? Controleer via de anon-client met het JWT.
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return new Response('no auth', { status: 401, headers: CORS });

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'ongeldige sessie' }), { status: 401, headers: { ...CORS, 'content-type': 'application/json' } });
  }

  // 2) Is de aanroeper beheerder? (RLS zorgt dat medewerker alleen eigen rij ziet)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: profiel } = await admin.from('profiles').select('rol').eq('id', userData.user.id).maybeSingle();
  if (!profiel || profiel.rol !== 'beheerder') {
    return new Response(JSON.stringify({ error: 'alleen beheerder' }), { status: 403, headers: { ...CORS, 'content-type': 'application/json' } });
  }

  // 3) Body parsen
  let body: { email?: string; password?: string; naam?: string; rol?: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'ongeldige body' }), { status: 400, headers: { ...CORS, 'content-type': 'application/json' } }); }

  const email    = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const naam     = (body.naam || '').trim();
  const rol      = body.rol === 'beheerder' ? 'beheerder' : 'medewerker';

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'e-mail en wachtwoord verplicht' }), { status: 400, headers: { ...CORS, 'content-type': 'application/json' } });
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'wachtwoord moet minimaal 8 tekens zijn' }), { status: 400, headers: { ...CORS, 'content-type': 'application/json' } });
  }

  // 4) Account aanmaken (email al bevestigd, zodat inloggen direct werkt)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: naam ? { full_name: naam } : undefined,
  });
  if (createErr || !created?.user) {
    return new Response(JSON.stringify({ error: createErr?.message || 'aanmaken mislukt' }), { status: 400, headers: { ...CORS, 'content-type': 'application/json' } });
  }

  // 5) Zorg dat er een profiles-rij is met de juiste naam + rol
  //    (Een trigger kan er ook al een hebben aangemaakt — upsert is idempotent.)
  const uid = created.user.id;
  const profielNaam = naam || email.split('@')[0];
  const { error: upErr } = await admin.from('profiles').upsert({
    id: uid, naam: profielNaam, rol,
  }, { onConflict: 'id' });
  if (upErr) {
    return new Response(JSON.stringify({ error: 'account aangemaakt maar profiel niet: ' + upErr.message, user_id: uid }), { status: 500, headers: { ...CORS, 'content-type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true, user_id: uid, email, rol }), { headers: { ...CORS, 'content-type': 'application/json' } });
});
