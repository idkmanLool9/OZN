// send-email — verstuur een HTML-mail via Brevo (voorheen Sendinblue).
// Brevo laat je verzenden vanaf elk email-adres na click-verificatie
// (geen domein-verificatie nodig, dus @hotmail.com werkt gewoon).
//
// Secrets (Project Settings → Edge Functions → Secrets):
//   BREVO_API_KEY   — API-key van brevo.com (Settings → SMTP & API → API Keys)
//   EMAIL_FROM      — bv. "ozndossier@hotmail.com"  (moet als sender
//                     geverifieerd zijn in Brevo)
//   EMAIL_FROM_NAME — bv. "OZN"  (weergavenaam, optioneel)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const BREVO_API_KEY   = Deno.env.get('BREVO_API_KEY') || '';
const EMAIL_FROM      = Deno.env.get('EMAIL_FROM') || '';
const EMAIL_FROM_NAME = Deno.env.get('EMAIL_FROM_NAME') || 'OZN';

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

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/?(p|h1|h2|h3|h4|tr|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResp({ error: 'method_not_allowed' }, 405);

  try {
    const missing: string[] = [];
    if (!SUPABASE_URL)          missing.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!BREVO_API_KEY)         missing.push('BREVO_API_KEY');
    if (!EMAIL_FROM)            missing.push('EMAIL_FROM');
    if (missing.length) return jsonResp({ error: 'missing_secrets', missing }, 500);

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

    let body: any;
    try { body = await req.json(); }
    catch { return jsonResp({ error: 'invalid_json' }, 400); }

    const to      = Array.isArray(body?.to) ? body.to : (body?.to ? [body.to] : []);
    const bccArr  = Array.isArray(body?.bcc) ? body.bcc : (body?.bcc ? [body.bcc] : []);
    const subject = String(body?.subject || '').trim();
    const html    = String(body?.html || '').trim();
    // Reply-to defaultt naar EMAIL_FROM (het OZN-adres) i.p.v. het persoonlijke
    // login-adres van de medewerker — anders belanden replies in privé-inbox.
    const replyTo = String(body?.replyTo || EMAIL_FROM || '').trim();
    // Bijlagen: array van { name, contentBase64 } — worden 1-op-1 als
    // attachment in Brevo doorgegeven zodat ze in de mailbox als
    // paperclip-attachment verschijnen.
    const rawAttachments = Array.isArray(body?.attachments) ? body.attachments : [];
    const attachments = rawAttachments
      .filter((a: any) => a && typeof a.name === 'string' && typeof a.contentBase64 === 'string')
      .map((a: any) => ({ name: a.name, content: a.contentBase64 }));

    if (!to.length)      return jsonResp({ error: 'missing_to' }, 400);
    if (!subject)        return jsonResp({ error: 'missing_subject' }, 400);
    if (!html)           return jsonResp({ error: 'missing_html' }, 400);
    if (subject.length > 300) return jsonResp({ error: 'subject_too_long' }, 400);
    if (html.length > 500_000) return jsonResp({ error: 'html_too_large' }, 400);
    // Bijlagen: Brevo max ~10 MB per attachment. Guardrail hier op 12 MB
    // encoded (~9 MB binair) om requests niet op te blazen.
    const totalAttachBytes = attachments.reduce((n, a) => n + (a.content?.length || 0), 0);
    if (totalAttachBytes > 12_000_000) return jsonResp({ error: 'attachments_too_large' }, 413);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const adr of to) {
      if (typeof adr !== 'string' || !emailRe.test(adr)) {
        return jsonResp({ error: 'invalid_recipient', adr }, 400);
      }
    }
    for (const adr of bccArr) {
      if (typeof adr !== 'string' || !emailRe.test(adr)) {
        return jsonResp({ error: 'invalid_bcc', adr }, 400);
      }
    }

    // Rate-limit-check
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

    // Brevo API-aanroep
    const brevoResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept':       'application/json',
        'content-type': 'application/json',
        'api-key':      BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender:  { name: EMAIL_FROM_NAME, email: EMAIL_FROM },
        to:      to.map((email: string) => ({ email })),
        bcc:     bccArr.length ? bccArr.map((email: string) => ({ email })) : undefined,
        subject,
        htmlContent: html,
        textContent: htmlToPlain(html),
        replyTo: replyTo ? { email: replyTo } : undefined,
        attachment: attachments.length ? attachments : undefined,
      }),
    });
    const brevoBody = await brevoResp.json().catch(() => ({}));

    if (!brevoResp.ok) {
      return jsonResp({
        error:  'brevo_failed',
        status: brevoResp.status,
        detail: brevoBody?.message || brevoBody?.code || JSON.stringify(brevoBody),
      }, 502);
    }

    // Loggen (fire-and-forget)
    svc.from('email_log').insert({
      user_id:   userId,
      to:        to,
      subject,
      resend_id: brevoBody?.messageId || null,
    }).then(({ error }: any) => { if (error) console.error('email_log insert:', error.message); });

    return jsonResp({ ok: true, messageId: brevoBody?.messageId || null });
  } catch (e: any) {
    return jsonResp({ error: 'unhandled', detail: e?.message || String(e), stack: e?.stack || null }, 500);
  }
});
