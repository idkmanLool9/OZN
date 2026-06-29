// snelstart-webhook — ontvangt meldingen (webhooks) van SnelStart.
//
// SnelStart vraagt bij het aanmaken van een API-sleutel om een webhook-URL.
// Deze functie:
//   1. geeft op elke aanroep 200 OK terug (zodat registratie/validatie slaagt),
//   2. echoot een eventuele verificatie-/challenge-token terug, en
//   3. logt de inkomende payload (zichtbaar in de Supabase function-logs),
//      zodat je later kunt zien wélke gebeurtenissen SnelStart stuurt.
//
// Er staan geen sleutels in deze functie; hij ontvangt alleen.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);

  // Sommige systemen valideren met een challenge/verificatie-token dat
  // letterlijk teruggegeven moet worden. Echo 'm als die meekomt.
  const challenge = url.searchParams.get('challenge')
    || url.searchParams.get('validationToken')
    || url.searchParams.get('hub.challenge');
  if (challenge) {
    return new Response(challenge, { status: 200, headers: { ...cors, 'Content-Type': 'text/plain' } });
  }

  // Body (indien aanwezig) uitlezen en loggen
  let payload: unknown = null;
  try {
    const text = await req.text();
    if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
  } catch (_) { /* geen body */ }

  console.log('SnelStart webhook:', req.method, JSON.stringify(payload));

  return new Response(JSON.stringify({ ok: true, received: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
