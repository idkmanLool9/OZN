// send-email — verstuur een HTML-mail via SMTP (Hotmail/Outlook) vanuit
// het OZN-account.
//
// Secrets:
//   SMTP_HOST   — smtp-mail.outlook.com  (default)
//   SMTP_PORT   — 587                    (default; STARTTLS)
//   SMTP_USER   — jouw@hotmail.com
//   SMTP_PASS   — app-wachtwoord (2FA vereist)
//   SMTP_FROM   — bv. "OZN <jouw@hotmail.com>"  (default: SMTP_USER)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp-mail.outlook.com';
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587', 10);
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USER;

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
    if (!SMTP_USER)             missing.push('SMTP_USER');
    if (!SMTP_PASS)             missing.push('SMTP_PASS');
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
    const subject = String(body?.subject || '').trim();
    const html    = String(body?.html || '').trim();
    const replyTo = String(body?.replyTo || userEmail || '').trim();

    if (!to.length)      return jsonResp({ error: 'missing_to' }, 400);
    if (!subject)        return jsonResp({ error: 'missing_subject' }, 400);
    if (!html)           return jsonResp({ error: 'missing_html' }, 400);
    if (subject.length > 300) return jsonResp({ error: 'subject_too_long' }, 400);
    if (html.length > 500_000) return jsonResp({ error: 'html_too_large' }, 400);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const adr of to) {
      if (typeof adr !== 'string' || !emailRe.test(adr)) {
        return jsonResp({ error: 'invalid_recipient', adr }, 400);
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

    // Nodemailer SMTP-transport (STARTTLS op 587, of implicit TLS op 465).
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    try {
      const info = await transporter.sendMail({
        from:    SMTP_FROM,
        to:      to.join(', '),
        replyTo: replyTo || undefined,
        subject,
        text:    htmlToPlain(html),
        html,
      });

      // Loggen (fire-and-forget)
      svc.from('email_log').insert({
        user_id:   userId,
        to:        to,
        subject,
        resend_id: info?.messageId || null,
      }).then(({ error }: any) => { if (error) console.error('email_log insert:', error.message); });

      return jsonResp({ ok: true, messageId: info?.messageId || null });
    } catch (smtpErr: any) {
      return jsonResp({
        error:  'smtp_failed',
        detail: smtpErr?.message || String(smtpErr),
        code:   smtpErr?.code || null,
      }, 502);
    }
  } catch (e: any) {
    return jsonResp({ error: 'unhandled', detail: e?.message || String(e), stack: e?.stack || null }, 500);
  }
});
