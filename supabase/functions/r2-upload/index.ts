// r2-upload — server-side proxy naar Cloudflare R2. Ontvangt bytes van de
// client (multipart/form-data of raw body) en uploadt naar R2 via aws4fetch.
// Nodig omdat directe browser-PUT naar R2 vaak faalt met "Failed to fetch"
// door CORS (R2-bucket moet dan expliciet CORS-headers krijgen — dat is
// een aparte configuratie in Cloudflare dashboard, en werkt niet vanuit
// Capacitor WebView-origins zonder allowlist).
//
// Secrets (Project Settings → Edge Functions → Secrets):
//   R2_ACCOUNT_ID       — Cloudflare account-ID
//   R2_ACCESS_KEY_ID    — R2 API-token access key
//   R2_SECRET_ACCESS_KEY — R2 API-token secret
//   R2_BUCKET           — bucket-naam (bv. 'ozn-dossiers')
//
// Client roept aan met:
//   const fd = new FormData();
//   fd.append('key', 'dossiers/x/foto.jpg');
//   fd.append('file', file);
//   await sb.functions.invoke('r2-upload', { body: fd });

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const R2_ACCOUNT_ID    = Deno.env.get('R2_ACCOUNT_ID') || '';
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') || '';
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
const R2_BUCKET        = Deno.env.get('R2_BUCKET') || 'ozn-dossiers';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method-not-allowed' }, 405);

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return json({ error: 'r2-config-missing', detail: 'R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY ontbreken in secrets.' }, 500);
  }

  let key = '';
  let bytes: Uint8Array | null = null;
  let contentType = 'application/octet-stream';

  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.startsWith('multipart/form-data')) {
      const form = await req.formData();
      key = String(form.get('key') || '').trim();
      const f = form.get('file');
      if (f && f instanceof File) {
        bytes = new Uint8Array(await f.arrayBuffer());
        contentType = f.type || contentType;
      }
    } else {
      // Fallback: raw body + key via query of header
      const url = new URL(req.url);
      key = url.searchParams.get('key') || req.headers.get('x-r2-key') || '';
      contentType = req.headers.get('x-r2-content-type') || ct || contentType;
      const buf = await req.arrayBuffer();
      bytes = new Uint8Array(buf);
    }
  } catch (e) {
    return json({ error: 'body-parse-failed', detail: String((e as Error).message || e) }, 400);
  }

  if (!key)   return json({ error: 'missing-key' }, 400);
  if (!bytes || !bytes.byteLength) return json({ error: 'missing-file' }, 400);

  // Sanity: key mag niet buiten de bucket-root wijzen
  if (key.startsWith('/') || key.includes('..')) {
    return json({ error: 'invalid-key' }, 400);
  }

  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeURI(key)}`;

  try {
    const resp = await aws.fetch(url, {
      method: 'PUT',
      body: bytes,
      headers: { 'content-type': contentType },
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return json({ error: 'r2-put-failed', status: resp.status, detail: txt.slice(0, 400) }, 502);
    }
    return json({ ok: true, key, size: bytes.byteLength, contentType });
  } catch (e) {
    return json({ error: 'r2-fetch-failed', detail: String((e as Error).message || e) }, 502);
  }
});
