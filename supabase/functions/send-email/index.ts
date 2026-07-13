// send-email — verstuur een HTML-mail via Resend vanuit de OZN-app.
//
// Aanroep (JS): supabase.functions.invoke('send-email', {
//   body: { to, subject, html, replyTo? }
// })
//
// Beveiliging:
//   - verify_jwt = true (moet ingelogde gebruiker zijn)
//   - Rate-limit: max 60 mails per gebruiker per uur
//   - Alleen jouw eigen adres in FROM (RESEND_FROM env), zodat spoofing van
//     andere domeinen niet kan.
//
// Secrets (supabase secrets set NAAM=VALUE):
//   RESEND_API_KEY  — API-key van resend.com
//   RESEND_FROM     — verzendadres, bv. "OZN <info@ozn.nl>" (domein moet
//                     op resend.com als 'verified' staan)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY        = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM           = Deno.env.get('RESEND_FROM') || '';

const RATE_LIMIT_PER_HOUR = 60;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResp({ error: 'method_not_allowed' }, 405);

  try {
    const missing: string[] = [];
    if (!SUPABASE_URL)          missing.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!RESEND_API_KEY)        missing.push('RESEND_API_KEY');
    if (!RESEND_FROM)           missing.push('RESEND_FROM');
    if (missing.length) return jsonResp({ error: 'missing_secrets', missing }, 500);

    // Wie stuurt deze mail?
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResp({ error: 'no_auth' }, 401);
    }
    const jwt = authHeader.slice(7);
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
    if (userErr || !userData?.user) return jsonResp({ error: 'invalid_auth' }, 401);
    const userId = userData.user.id;
    const userEmail = userData.user.email || '';

    // Body valideren
    let body: any;
    try { body = await req.json(); }
    catch { return jsonResp({ error: 'invalid_json' }, 400); }

    const to      = Array.isArray(body?.to) ? body.to : (body?.to ? [body.to] : []);
    const subject = String(body?.subject || '').trim();
    const html    = String(body?.html || '').trim();
    const replyTo = String(body?.replyTo || userEmail || '').trim();

    if (!to.length)      return jsonResp({ error: 'missing_to' }, 400);
    if (!subject)        return jsonResp({ error: 'missing_subject' }, 400);
    if (!html)           return jsonResp({ error: 'missing_html' }, 400);
    if (subject.length > 300) return jsonResp({ error: 'subject_too_long' }, 400);
    if (html.length > 500_000) return jsonResp({ error: 'html_too_large' }, 400);

    // Zeer simpele adres-validatie
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const adr of to) {
      if (typeof adr !== 'string' || !emailRe.test(adr)) {
        return jsonResp({ error: 'invalid_recipient', adr }, 400);
      }
    }

    // Rate-limit: aantal verstuurde mails in laatste uur
    const sinceIso = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: cntErr } = await svc
      .from('email_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('sent_at', sinceIso);
    if (cntErr) return jsonResp({ error: 'rate_check_failed', detail: cntErr.message }, 500);
    if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
      return jsonResp({ error: 'rate_limited', limit: RATE_LIMIT_PER_HOUR, window: '1u' }, 429);
    }

    // Resend aanroepen
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     RESEND_FROM,
        to,
        subject,
        html,
        reply_to: replyTo || undefined,
      }),
    });
    const resendBody = await resendResp.json().catch(() => ({}));
    if (!resendResp.ok) {
      return jsonResp({
        error: 'resend_failed',
        status: resendResp.status,
        detail: resendBody,
      }, 502);
    }

    // Loggen (fire-and-forget — falen mag verzending niet omkeren)
    svc.from('email_log').insert({
      user_id:   userId,
      to:        to,
      subject,
      resend_id: resendBody?.id || null,
    }).then(({ error }) => { if (error) console.error('email_log insert:', error.message); });

    return jsonResp({ ok: true, id: resendBody?.id || null });
  } catch (e: any) {
    return jsonResp({ error: 'unhandled', detail: e?.message || String(e) }, 500);
  }
});
