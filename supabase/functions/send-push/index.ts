// send-push — Stuurt push-notificaties voor aankomende uitvaarten.
//
// Bulletproof versie: dynamische imports + top-level try/catch zodat
// elke fout een leesbare JSON-response oplevert i.p.v. een blanco 500.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@morephrem.com';

Deno.serve(async (req) => {
  try {
    // ── 1. ENV CHECK ──────────────────────────────────────────────
    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!VAPID_PUBLIC) missing.push('VAPID_PUBLIC_KEY');
    if (!VAPID_PRIVATE) missing.push('VAPID_PRIVATE_KEY');
    if (missing.length) {
      return jsonResp({
        error: 'missing_secrets',
        missing,
        msg: `Set these secrets via 'supabase secrets set NAAM="..."' en deploy opnieuw.`,
      }, 500);
    }

    // ── 2. WEB-PUSH LADEN (dynamic import zodat fouten netjes catchen) ──
    let webpush: any;
    try {
      webpush = (await import('npm:web-push@3.6.7')).default;
    } catch (e: any) {
      return jsonResp({
        error: 'webpush_import_failed',
        msg: 'npm:web-push kon niet geladen worden in Deno.',
        detail: e?.message || String(e),
      }, 500);
    }

    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    } catch (e: any) {
      return jsonResp({
        error: 'vapid_setup_failed',
        msg: 'setVapidDetails faalde. Check dat de keys geldig zijn en het subject een mailto:/https: URL is.',
        subject_used: VAPID_SUBJECT,
        public_key_len: VAPID_PUBLIC.length,
        private_key_len: VAPID_PRIVATE.length,
        detail: e?.message || String(e),
      }, 500);
    }

    // ── 3. PARAMS LEZEN ───────────────────────────────────────────
    const url = new URL(req.url);
    const overrideDays = url.searchParams.get('days');
    const overrideDate = url.searchParams.get('date');
    const dryRun = url.searchParams.get('dryRun') === '1';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // ── 4. DAGEN-VOORAF BEPALEN ───────────────────────────────────
    let daysAhead = 1;
    if (overrideDays !== null) {
      daysAhead = parseInt(overrideDays, 10) || 1;
    } else {
      const { data: settingsRow } = await supabase
        .from('app_instellingen').select('data').eq('id', 1).maybeSingle();
      daysAhead = (settingsRow?.data as any)?.push_remind_days_ahead ?? 1;
    }

    const targetDay = overrideDate || (() => {
      const t = new Date();
      t.setDate(t.getDate() + daysAhead);
      return t.toISOString().slice(0, 10);
    })();

    // ── 5. UITVAARTEN OPHALEN ─────────────────────────────────────
    const { data: dossiers, error: dErr } = await supabase
      .from('dossiers')
      .select('id, dossier_nummer, voornaam, achternaam, uitvaart_datum, uitvaart_tijd, kerk_locatie')
      .eq('uitvaart_datum', targetDay);

    if (dErr) {
      return jsonResp({ error: 'dossiers_query_failed', detail: dErr.message }, 500);
    }
    if (!dossiers || dossiers.length === 0) {
      return jsonResp({ msg: 'Geen aankomende uitvaarten', day: targetDay, daysAhead });
    }

    // ── 6. SUBSCRIPTIONS OPHALEN ──────────────────────────────────
    const { data: subs, error: sErr } = await supabase.from('push_subscriptions').select('*');
    if (sErr) {
      return jsonResp({ error: 'subscriptions_query_failed', detail: sErr.message }, 500);
    }
    if (!subs || subs.length === 0) {
      return jsonResp({ msg: 'Geen subscriptions geregistreerd', dossiers: dossiers.length });
    }

    // ── 7. PUSH STUREN ────────────────────────────────────────────
    let sent = 0, failed = 0, expired = 0;
    const errors: string[] = [];

    for (const d of dossiers) {
      const naam = [d.voornaam, d.achternaam].filter(Boolean).join(' ') || d.dossier_nummer;
      const whenLabel = daysAhead === 0 ? 'vandaag'
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
        if (dryRun) { sent++; continue; }
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
          await supabase.from('push_subscriptions')
            .update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id);
        } catch (e: any) {
          const code = e?.statusCode || 0;
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
      day: targetDay, daysAhead,
      dossiers: dossiers.length, subscriptions: subs.length,
      sent, failed, expired,
      errors: errors.slice(0, 10),
      dryRun,
    });
  } catch (e: any) {
    // Vangnet: élke onverwachte fout komt hier terecht met een leesbare JSON
    return jsonResp({
      error: 'unhandled_exception',
      msg: e?.message || String(e),
      stack: (e?.stack || '').toString().split('\n').slice(0, 6),
    }, 500);
  }
});

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
