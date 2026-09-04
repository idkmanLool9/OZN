// snelstart — dunne auth-proxy naar de SnelStart B2B API.
//
// De browser mag SnelStart niet direct aanroepen (CORS + sleutels mogen niet
// in de frontend belanden). Deze Edge Function:
//   1. wisselt de 'clientkey' om voor een tijdelijk bearer-token, en
//   2. zet de eigenlijke API-aanroep door met de juiste headers.
//
// De credentials (subscription key + client key) komen MEE in elke request
// vanuit de app-instellingen — er staan dus géén vaste sleutels in deze
// functie. Acties:
//   { action: 'test' }                                  → verbinding testen
//   { action: 'request', method, path, body }           → vrije API-call
//
// SnelStart-documentatie: https://b2bapi.snelstart.nl/

const AUTH_URL = 'https://auth.snelstart.nl/b2b/token';
const API_BASE = 'https://b2bapi.snelstart.nl/v2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Supabase-client alleen voor JWT-verificatie (leest de Auth-headers).
// URL + SERVICE_ROLE zijn nodig om de user achter een JWT te resolven.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function requireBeheerder(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'no_auth' }, 401);
  }
  const jwt = authHeader.slice(7);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return json({ error: 'missing_supabase_env' }, 500);
  }
  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'invalid_auth' }, 401);
    // Alleen beheerders mogen de SnelStart-proxy aanroepen.
    const { data: prof } = await svc.from('profiles').select('rol').eq('id', userData.user.id).maybeSingle();
    if (!prof || prof.rol !== 'beheerder') return json({ error: 'forbidden', msg: 'Alleen beheerders mogen de SnelStart-koppeling gebruiken.' }, 403);
    return { userId: userData.user.id };
  } catch (e: any) {
    return json({ error: 'auth_check_failed', detail: e?.message || String(e) }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // Auth-check VOOR we ook maar iets naar SnelStart doen — anders is deze
    // functie een open proxy voor iedereen op internet.
    const auth = await requireBeheerder(req);
    if (auth instanceof Response) return auth;

    const { action, subscriptionKey, clientKey, method, path, body } = await req.json();

    if (!subscriptionKey || !clientKey) {
      return json({ error: 'missing_credentials', msg: 'Vul de Subscription key en Client key in bij Account → SnelStart-koppeling.' }, 400);
    }

    // 1) Token ophalen (clientkey → tijdelijk bearer-token)
    const tokenResp = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'clientkey', clientkey: clientKey }),
    });
    const tokenText = await tokenResp.text();
    if (!tokenResp.ok) {
      return json({ error: 'auth_failed', status: tokenResp.status, detail: safeParse(tokenText),
        msg: 'Inloggen bij SnelStart mislukt — controleer de Client key.' }, 502);
    }
    const token = safeParse(tokenText)?.access_token;
    if (!token) return json({ error: 'no_token', detail: safeParse(tokenText) }, 502);

    const apiHeaders: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // 2a) Verbinding testen — lichte call die ook de subscription-key valideert
    if (action === 'test') {
      const r = await fetch(`${API_BASE}/relaties?%24top=1`, { headers: apiHeaders });
      const t = await r.text();
      if (!r.ok) {
        return json({ error: 'api_test_failed', status: r.status, detail: safeParse(t),
          msg: r.status === 401 || r.status === 403
            ? 'Token werkt, maar de Subscription key wordt geweigerd — controleer die.'
            : 'SnelStart gaf een fout terug.' }, 502);
      }
      return json({ ok: true, msg: 'Verbinding met SnelStart geslaagd. De sleutels werken.' });
    }

    // 2b) Vrije API-call (proxy) — de app bouwt method/path/body
    if (action === 'request') {
      const r = await fetch(`${API_BASE}${path}`, {
        method: method || 'GET',
        headers: apiHeaders,
        body: (method && method !== 'GET' && body != null) ? JSON.stringify(body) : undefined,
      });
      const t = await r.text();
      return json({ ok: r.ok, status: r.status, data: safeParse(t) }, r.ok ? 200 : 502);
    }

    return json({ error: 'unknown_action', msg: `Onbekende action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: 'unhandled', msg: e?.message || String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
function safeParse(s: string) { try { return JSON.parse(s); } catch { return s; } }
