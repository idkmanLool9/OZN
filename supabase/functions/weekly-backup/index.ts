// Wekelijkse JSON-backup van alle relevante OZN-tabellen naar de private
// 'backups'-bucket in Supabase Storage. Wordt aangeroepen door pg_cron
// (elke maandag 03:00). Bewaart de laatste 12 backups, oudere worden
// automatisch verwijderd.
//
// Deploy: `supabase functions deploy weekly-backup --no-verify-jwt`
// (De pg_cron-job passeert geen JWT — we controleren zelf de secret.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET  = Deno.env.get('BACKUP_CRON_SECRET') || '';

// Alle tabellen die we backuppen. Views + storage-objecten laten we buiten
// beschouwing (die zijn afgeleid).
const TABLES = [
  'dossiers',
  'kosten',
  'notities',
  'documenten',
  'kist_afbeeldingen',
  'kist_voorraad',
  'planning_items',
  'profiles',
  'app_instellingen',
];

const KEEP_N = 12; // hoeveel oude backups bewaren

Deno.serve(async (req) => {
  // Alleen aanroepbaar met de juiste cron-secret (of vanaf pg_net met header).
  const auth = req.headers.get('x-cron-secret') || '';
  if (!CRON_SECRET || auth !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const backup: Record<string, unknown> = {
    version: 1,
    project: 'OZN',
    created_at: now.toISOString(),
    tables: {},
  };

  // Alle tabellen ophalen
  for (const t of TABLES) {
    try {
      const { data, error } = await sb.from(t).select('*');
      if (error) {
        (backup.tables as Record<string, unknown>)[t] = { error: error.message };
      } else {
        (backup.tables as Record<string, unknown>)[t] = data || [];
      }
    } catch (e) {
      (backup.tables as Record<string, unknown>)[t] = { error: String(e) };
    }
  }

  const body = new TextEncoder().encode(JSON.stringify(backup));
  const path = `backup-${stamp}.json`;

  const { error: upErr } = await sb.storage.from('backups').upload(path, body, {
    contentType: 'application/json',
    upsert: true,
  });
  if (upErr) return new Response('upload failed: ' + upErr.message, { status: 500 });

  // Retentie: verwijder alles behalve de laatste KEEP_N (op naam gesorteerd).
  const { data: lijst } = await sb.storage.from('backups').list('', {
    limit: 1000, sortBy: { column: 'name', order: 'desc' },
  });
  if (lijst && lijst.length > KEEP_N) {
    const teVerwijderen = lijst.slice(KEEP_N).map(f => f.name);
    await sb.storage.from('backups').remove(teVerwijderen);
  }

  return new Response(JSON.stringify({
    ok: true, path, size_bytes: body.byteLength,
    tables: Object.keys(backup.tables as object).length,
  }), { headers: { 'content-type': 'application/json' } });
});
