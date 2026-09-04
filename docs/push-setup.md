# Push-notificaties — installatie-handleiding

Status: **client-kant al klaar**, publieke VAPID-sleutel staat al in de
default-settings. Wat je nog moet doen is de **server-kant** opzetten:
de Edge Function deployen + de private VAPID-sleutel als secret opslaan
+ een dagelijkse cron job configureren.

---

## ⚠️ Belangrijke regel

De **public key** mag in de code (zit nu in `js/app.js`). De **private
key** mag ABSOLUUT NIET in git terechtkomen — die gaat alleen in
Supabase Secrets.

---

## Stap 1 — Supabase CLI installeren (eenmalig)

Op je Windows-machine in PowerShell:

```powershell
# Optie A: via Scoop
scoop install supabase

# Optie B: via Chocolatey
choco install supabase

# Optie C: handmatige download
# https://github.com/supabase/cli/releases — pak de Windows ZIP
```

Verifieer:

```powershell
supabase --version
```

---

## Stap 2 — Inloggen + project linken

```powershell
cd C:\Users\<jij>\Documents\uitvaart
supabase login            # opent browser → autoriseer
supabase link --project-ref cmcbmcyxdndymxgpxmed
```

---

## Stap 3 — Secrets instellen

> 🔒 **Plak je private key NIET in deze file** (die staat in git). Gebruik
> hieronder de placeholders en haal de echte waardes uit je wachtwoord-
> manager of de chat waar je ze gegenereerd hebt.

```powershell
# Public key mag in een commit-file want is per definitie publiek
supabase secrets set VAPID_PUBLIC_KEY="<PLAK HIER DE PUBLIC KEY>"

# Private key NOOIT in git — alleen lokaal pasten in deze terminal
supabase secrets set VAPID_PRIVATE_KEY="<PLAK HIER DE PRIVATE KEY>"

# Subject: een mailto: of https: URL die push-services kunnen gebruiken
# om jou te bereiken bij problemen
supabase secrets set VAPID_SUBJECT="mailto:info@morephrem.com"
```

Verifieer:

```powershell
supabase secrets list
```

Je zou alle drie moeten zien (waardes zijn afgekapt — dat hoort).

---

## Stap 4 — Edge Function deployen

De code staat al klaar in `supabase/functions/send-push/index.ts`.

```powershell
supabase functions deploy send-push --no-verify-jwt
```

> Het `--no-verify-jwt` is omdat de cron job geen JWT meestuurt.
> De function checkt zelf niet wie hem aanroept — dat is veilig
> want hij heeft alleen lees-rechten op publieke data en stuurt
> alleen naar geregistreerde subscriptions.

Test direct dat-ie werkt (PowerShell-vriendelijk):

```powershell
# Optie A: PowerShell-native (mooie JSON-output)
Invoke-RestMethod "https://cmcbmcyxdndymxgpxmed.supabase.co/functions/v1/send-push?dryRun=1"

# Optie B: echte curl forceren (.exe voorkomt PowerShell-alias)
curl.exe -X POST "https://cmcbmcyxdndymxgpxmed.supabase.co/functions/v1/send-push?dryRun=1"
```

> ⚠️ `curl` zonder `.exe` in PowerShell is een alias voor `Invoke-WebRequest`
> die geen `-X` kent. Gebruik `curl.exe` of `Invoke-RestMethod`.

Dry-run geeft een JSON terug zonder echt te versturen. Je ziet:
- aantal aankomende uitvaarten morgen
- aantal subscriptions
- hoeveel zou er verstuurd worden

---

## Stap 5 — Dagelijkse cron job

In **Supabase Dashboard → Database → Extensions** zet je deze 2 extensies aan:

- `pg_cron`
- `pg_net` (voor HTTP-calls vanuit Postgres)

Dan in **Database → SQL Editor**, draai:

```sql
-- Eerst: bestaande job met dezelfde naam opruimen (idempotent)
SELECT cron.unschedule('daily-uitvaart-push')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-uitvaart-push');

-- Plan: elke dag om 05:00 UTC (= 07:00 NL zomertijd / 06:00 wintertijd)
SELECT cron.schedule(
  'daily-uitvaart-push',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cmcbmcyxdndymxgpxmed.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  $$
);
```

Controleer dat-ie aangemaakt is:

```sql
SELECT * FROM cron.job;
```

Logs zien (na de eerste run):

```sql
SELECT * FROM cron.job_run_details
WHERE jobname = 'daily-uitvaart-push'
ORDER BY start_time DESC LIMIT 10;
```

---

## Stap 6 — Test in de webapp

1. Hard refresh de webapp
2. Account → Push-notificaties → controleer dat de public key automatisch ingevuld is
3. Klik **🔔 Inschakelen op dit apparaat** → browser vraagt toestemming → OK
4. Klik **Test-melding** → krijg je direct een lokale notificatie

Op iPad: voeg de app eerst toe aan beginscherm (Deel-knop → "Voeg toe
aan beginscherm"). Pas dan werkt push (Apple-vereiste).

---

## Stap 7 — End-to-end test met echte server

Maak eerst een test-dossier met **uitvaart_datum** op morgen. Trigger
dan de function handmatig:

```powershell
# Dry-run: zien wat er gebeurt, niets versturen
Invoke-RestMethod "https://cmcbmcyxdndymxgpxmed.supabase.co/functions/v1/send-push?dryRun=1"

# Echte test: stuurt push voor morgen
Invoke-RestMethod -Method Post "https://cmcbmcyxdndymxgpxmed.supabase.co/functions/v1/send-push"

# Specifieke datum testen
Invoke-RestMethod -Method Post "https://cmcbmcyxdndymxgpxmed.supabase.co/functions/v1/send-push?date=2026-06-20"
```

> Op Mac/Linux of WSL kun je gewone `curl -X POST ...` gebruiken.

Je moet binnen ~30 seconden een notificatie krijgen.

---

## Optionele query-parameters

De function accepteert:

| Parameter | Voorbeeld | Effect |
|---|---|---|
| `date=YYYY-MM-DD` | `?date=2026-06-25` | Stuurt voor uitvaarten op die specifieke datum |
| `days=N` | `?days=3` | Override `push_remind_days_ahead` voor deze run |
| `dryRun=1` | `?dryRun=1` | Logt wat-ie zou doen zonder echt te versturen |

---

## Veelvoorkomende problemen

| Probleem | Oorzaak | Oplossing |
|---|---|---|
| `webpush.setVapidDetails is not a function` | Verkeerde import | Check `npm:web-push@3.6.7` import in index.ts |
| `400 VAPID public key mismatch` | Public key in webapp ≠ secret server | Check beide identiek |
| `403 invalid subject` | VAPID_SUBJECT geen geldige mailto: of https: | Zet `mailto:adres@domain.nl` |
| Geen melding op iPad | App niet op beginscherm geïnstalleerd | Voeg toe via Deel-knop |
| 410 errors in logs | Subscription verlopen (browser cache gewist) | Function ruimt ze automatisch op |
| Cron draait niet | `pg_cron` of `pg_net` extensie uit | Database → Extensions → beide aan |

---

## Privacy & veiligheid

- Subscriptions zijn gekoppeld aan `auth.users.id` via RLS — niemand anders kan ze lezen of bewerken
- Server gebruikt **service-role key** alleen binnen Edge Function (nooit naar client gestuurd)
- Push-endpoints werken via standaard W3C Web Push (Chrome, Firefox, Safari)
- Geen externe tracking-providers — alles via je eigen Supabase + browser-push-services
