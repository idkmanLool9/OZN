// send-push — Stuurt push-notificaties voor aankomende uitvaarten.
//
// Schedule via Supabase Cron (zie docs/push-setup.md):
//   dagelijks om 07:00 NL-tijd (05:00 UTC zomertijd / 06:00 winter)
//
// Lokaal testen:
//   supabase functions serve send-push --no-verify-jwt
//   curl -X POST http://localhost:54321/functions/v1/send-push
//
// Vereiste env vars (via `supabase secrets set ...`):
//   - SUPABASE_URL                (automatisch beschikbaar)
//   - SUPABASE_SERVICE_ROLE_KEY   (automatisch beschikbaar)
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT               (bv. 'mailto:info@morephrem.com')

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@morephrem.com';

Deno.serve(async (req) => {
  // Vroege env-validatie — geeft duidelijke 500 met JSON-body i.p.v.
  // generieke 'Internal Server Error'
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!VAPID_PUBLIC) missing.push('VAPID_PUBLIC_KEY');
  if (!VAPID_PRIVATE) missing.push('VAPID_PRIVATE_KEY');
  if (missing.length) {
    return jsonResp({
      error: 'missing_secrets',
      msg: `De volgende secrets zijn niet gezet in deze Edge Function: ${missing.join(', ')}. ` +
           `Run \`supabase secrets set ...\` (zie docs/push-setup.md stap 3) en deploy opnieuw.`,
    }, 500);
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e: any) {
    return jsonResp({
      error: 'vapid_invalid',
      msg: 'VAPID-setup faalde. Controleer dat de public/private keys klopt en het subject een mailto: of https: URL is.',
      detail: e?.message || String(e),
    }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // Optioneel: dossier_id en aantal-dagen-vooraf via URL params, anders defaults
  const url = new URL(req.url);
  const overrideDays = url.searchParams.get('days');
  const overrideDate = url.searchParams.get('date'); // YYYY-MM-DD
  const dryRun = url.searchParams.get('dryRun') === '1';

  // 1. Bepaal target-datum
  let daysAhead = 1;
  if (overrideDays !== null) {
    daysAhead = parseInt(overrideDays, 10) || 1;
  } else {
    // Lees uit app_instellingen — maybeSingle zodat 't niet crasht als
    // de rij nog niet bestaat
    const { data: settingsRow } = await supabase
      .from('app_instellingen')
      .select('data')
      .eq('id', 1)
      .maybeSingle();
    daysAhead = (settingsRow?.data as any)?.push_remind_days_ahead ?? 1;
  }

  const targetDay = overrideDate || (() => {
    const t = new Date();
    t.setDate(t.getDate() + daysAhead);
    return t.toISOString().slice(0, 10);
  })();

  // 2. Vind uitvaarten op die datum
  const { data: dossiers, error: dErr } = await supabase
    .from('dossiers')
    .select('id, dossier_nummer, voornaam, achternaam, uitvaart_datum, uitvaart_tijd, kerk_locatie')
    .eq('uitvaart_datum', targetDay);

  if (dErr) {
    return jsonResp({ error: 'dossiers query failed', detail: dErr.message }, 500);
  }
  if (!dossiers || dossiers.length === 0) {
    return jsonResp({ msg: 'Geen aankomende uitvaarten', day: targetDay, daysAhead });
  }

  // 3. Haal alle subscriptions op
  const { data: subs, error: sErr } = await supabase.from('push_subscriptions').select('*');
  if (sErr) {
    return jsonResp({ error: 'subscriptions query failed', detail: sErr.message }, 500);
  }
  if (!subs || subs.length === 0) {
    return jsonResp({ msg: 'Geen subscriptions geregistreerd', dossiers: dossiers.length });
  }

  // 4. Stuur per dossier × subscription een push
  let sent = 0;
  let failed = 0;
  let expired = 0;
  const errors: string[] = [];

  for (const d of dossiers) {
    const naam = [d.voornaam, d.achternaam].filter(Boolean).join(' ') || d.dossier_nummer;
    const whenLabel = daysAhead === 0
      ? 'vandaag'
      : daysAhead === 1 ? 'morgen'
      : `over ${daysAhead} dagen`;
    const body = [d.uitvaart_tijd ? d.uitvaart_tijd + ' uur' : null, d.kerk_locatie]
      .filter(Boolean).join(' · ') || 'Bekijk dossier voor details';

    const payload = JSON.stringify({
      title: `Uitvaart ${naam} ${whenLabel}`,
      body,
      url: `/#/dossiers/${d.id}`,
      tag: `dossier-${d.id}-${targetDay}`,
    });

    for (const sub of subs) {
      if (dryRun) {
        sent++;
        continue;
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
        await supabase
          .from('push_subscriptions')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (e: any) {
        const code = e?.statusCode || 0;
        // 404/410 = subscription verlopen → opruimen
        if (code === 404 || code === 410) {
          expired++;
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          failed++;
          errors.push(`sub ${sub.id}: HTTP ${code} ${(e?.body || e?.message || '').toString().slice(0, 120)}`);
        }
      }
    }
  }

  return jsonResp({
    day: targetDay,
    daysAhead,
    dossiers: dossiers.length,
    subscriptions: subs.length,
    sent,
    failed,
    expired,
    errors: errors.slice(0, 10),
    dryRun,
  });
});

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
