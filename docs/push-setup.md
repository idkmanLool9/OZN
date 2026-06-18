# Push-notificaties: setup-handleiding

Werkend op alle moderne browsers + iOS Safari 16.4+ (de app moet wel via "Op
beginscherm" geïnstalleerd zijn). Vereist eenmalig wat setup-werk: VAPID-
sleutels genereren + een Edge Function in Supabase die de notificaties
verstuurt.

---

## Stap 1 — VAPID-sleutels genereren (eenmalig)

Op je computer met Node.js geïnstalleerd:

```bash
npx web-push generate-vapid-keys
```

Output ziet er zo uit:

```
Public Key: BNbxxx...long base64-url string
Private Key: zzz...shorter base64-url string
```

- **Public Key** → vul in via Account → Push-notificaties → **VAPID public key**
- **Private Key** → bewaar geheim, gaat in stap 2 als Supabase secret

---

## Stap 2 — Supabase Edge Function `send-push`

### a) Geheim instellen

```bash
supabase secrets set VAPID_PRIVATE_KEY="<plak hier de private key>"
supabase secrets set VAPID_PUBLIC_KEY="<plak hier de public key>"
supabase secrets set VAPID_SUBJECT="mailto:info@morephrem.com"
```

### b) Functie aanmaken

```bash
supabase functions new send-push
```

Vervang de inhoud van `supabase/functions/send-push/index.ts` door:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'https://deno.land/x/djwt@v3.0.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@example.com';

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // Pak alle dossiers met uitvaart over X dagen
  const settings = await supabase.from('app_instellingen').select('data').eq('id', 1).single();
  const daysAhead = settings.data?.data?.push_remind_days_ahead || 1;

  const target = new Date();
  target.setDate(target.getDate() + daysAhead);
  const targetDay = target.toISOString().slice(0, 10);

  const { data: dossiers } = await supabase
    .from('dossiers')
    .select('id, voornaam, achternaam, uitvaart_datum, uitvaart_tijd, kerk_locatie')
    .eq('uitvaart_datum', targetDay);

  if (!dossiers || dossiers.length === 0) {
    return new Response('Geen aankomende uitvaarten.', { status: 200 });
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (!subs) return new Response('Geen subscriptions.', { status: 200 });

  let sent = 0;
  for (const d of dossiers) {
    const naam = [d.voornaam, d.achternaam].filter(Boolean).join(' ');
    const payload = {
      title: `Uitvaart ${naam} ${daysAhead === 0 ? 'vandaag' : daysAhead === 1 ? 'morgen' : 'over ' + daysAhead + ' dagen'}`,
      body: `${d.uitvaart_tijd || ''} · ${d.kerk_locatie || ''}`.trim(),
      url: `/#/dossiers/${d.id}`,
      tag: `dossier-${d.id}`,
    };

    for (const sub of subs) {
      try {
        await sendWebPush(sub, payload);
        sent++;
        await supabase.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id);
      } catch (e) {
        // Subscription is mogelijk expired — opruimen
        if (e.message.includes('410')) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }
  return new Response(`Verstuurd: ${sent}`, { status: 200 });
});

async function sendWebPush(sub: any, payload: any) {
  // Web Push protocol RFC 8030 + RFC 8291 — wordt makkelijker met een lib.
  // Gebruik bv. https://deno.land/x/webpush voor productie.
  // Voor de overzichtelijkheid een ge-stripte versie hier:
  const url = sub.endpoint;
  const audience = new URL(url).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const claims = { aud: audience, exp, sub: VAPID_SUBJECT };
  // ... (verkortingsteken voor duidelijkheid — gebruik npm:web-push of npm:@negrel/webpush)
  throw new Error('Gebruik een Web Push lib: import * as webpush from "npm:web-push"');
}
```

> **Tip**: in plaats van zelf web-push protocol te implementeren, importeer je
> de bestaande lib in Deno via `import webpush from "npm:web-push";` en gebruik
> `webpush.sendNotification(sub, JSON.stringify(payload), { vapidDetails: {...} })`.

### c) Deployen

```bash
supabase functions deploy send-push --no-verify-jwt
```

### d) Schedule (dagelijks om 07:00 NL-tijd = 05:00 UTC)

In Supabase Dashboard → **Database → Cron Jobs**:

```sql
SELECT cron.schedule(
  'daily-uitvaart-push',
  '0 5 * * *',
  $$ SELECT net.http_post(
       url := 'https://mpuejmkhmlbkaelqbnae.supabase.co/functions/v1/send-push',
       headers := '{"Authorization":"Bearer <SUPABASE_ANON_KEY>"}'::jsonb
     ); $$
);
```

---

## Stap 3 — Test in de app

1. Hard refresh de webapp
2. Account → Push-notificaties → vul de public key in → **Opslaan**
3. Klik **🔔 Inschakelen op dit apparaat** → browser vraagt toestemming → OK
4. Klik **Test-melding** → je krijgt direct een notificatie

Op iPad: voeg de app eerst toe aan beginscherm (Share → "Voeg toe aan
beginscherm"). Pas dan werkt push.

---

## Veelvoorkomende problemen

| Probleem | Oorzaak | Oplossing |
|---|---|---|
| "Deze browser ondersteunt geen..." | Te oude browser | Update naar laatste Chrome/Safari/Firefox |
| Toestemming geweigerd | Notificaties handmatig geblokkeerd | Browser-instellingen → site-rechten → notificaties toestaan |
| Geen melding ontvangen na cron-run | Endpoint expired (typisch na lange tijd) | App opnieuw inschakelen via knop |
| iOS krijgt niks | App moet 'op beginscherm' staan | Share → "Voeg toe aan beginscherm" → open vanaf beginscherm |

---

## Privacy

Subscriptions worden gekoppeld aan jouw `auth.users.id`. Een subscription
bevat een endpoint-URL (push-service van browser) + twee crypto-sleutels.
Bij uitloggen wordt de subscription verwijderd. De server kan ALLEEN
notificaties versturen naar geregistreerde subscriptions — niet via
endpoint-URLs van derden.
