# Load testing met k6 (Grafana Labs)

`k6` is een gratis CLI van Grafana Labs die simuleert dat veel gebruikers
tegelijk je site bezoeken. Hiermee zie je *wanneer* de site omvalt en
*waar* de bottleneck zit (Cloudflare? Supabase? PostgREST?).

---

## 1. k6 installeren (Windows)

Open PowerShell als beheerder en kies een van deze:

```powershell
# Optie A — winget (Windows 10/11, eenvoudigst)
winget install k6 --source winget

# Optie B — Chocolatey
choco install k6

# Optie C — Scoop
scoop install k6
```

Verifieer:

```powershell
k6 version
# k6 v0.50.0 (...)
```

Mac of Linux: zie https://k6.io/docs/get-started/installation/

---

## 2. De 3 scripts

| Script | Duur | Doel | Wanneer draaien |
|---|---|---|---|
| `smoke.js`  | 30s   | "Werkt mijn script + zijn de URLs goed?" | Elke keer voor je load/stress test |
| `load.js`   | ~3min | Realistische werkdag — 10→50→100 gebruikers | Wekelijks of na een release |
| `stress.js` | ~6min | Wanneer breekt-ie? — tot 1000 gebruikers | **Max 1× per maand**, buiten werkuren |

---

## 3. Lokaal draaien

```powershell
# Vanuit de repo-root:
k6 run k6/smoke.js
k6 run k6/load.js
k6 run k6/stress.js
```

Output verschijnt live in de terminal: requests/seconde, p95-latency,
error-rate. Aan het einde een tabel met "PASS" / "FAIL" per threshold.

Een andere site testen (bv. een preview-deployment):

```powershell
k6 run -e BASE_URL=https://abc123.uitvaart.pages.dev k6/load.js
```

---

## 4. Resultaten interpreteren

Belangrijkste metrics:

- **`http_req_duration p(95)`** — 95% van de requests is sneller dan dit.
  Onder de 1500ms = goed, boven de 3000ms = traag, boven 10s = stuk.
- **`http_req_failed`** — % requests dat fout terugkwam (5xx of timeout).
  Onder 1% = gezond, boven 5% = problemen, boven 20% = down.
- **`vus_max`** — hoeveel virtuele users actief waren toen het misging.
  Dát is je capaciteit.

Als `load.js` groen is met 100 VUs, kun je rustig 100 gebruikers tegelijk
aan (≫ alle parochies bij elkaar).

---

## 5. Met dashboard: Grafana Cloud k6 (gratis)

Voor mooie grafieken en distributed runs (verkeer uit 5 regio's tegelijk):

1. Account: https://grafana.com/auth/sign-up/create-user → **Free**
2. In de Grafana Cloud-UI: **k6 → Settings → API token** → kopieer
3. Lokaal:
   ```powershell
   k6 login cloud --token <PLAK-HIER>
   ```
4. Draaien:
   ```powershell
   k6 cloud k6/load.js
   ```
5. Output: live URL met dashboard ("test result is at https://app.k6.io/runs/...")

Free tier: **500 VU-hours/maand**. `load.js` kost ~5 VU-hours, `stress.js`
kost ~50. Dik genoeg voor maandelijkse runs.

---

## 6. ⚠️ Voor je BEGINT

- ✅ **Smoke draaien eerst.** Anders verspil je quota op een script met
  een typo.
- ⚠️ **Supabase Free-tier limieten:** je hebt 5 GB bandbreedte/maand en
  rate limiting op auth (~30 req/s/IP). `stress.js` kan je rate-limiet
  raken — dat is ok voor de test, maar pas op dat je echte gebruikers
  niet tijdens jouw test inloggen.
- ⚠️ **Cloudflare Pages Free:** 100.000 requests/dag. `stress.js`
  verbruikt ~15.000 — past, maar één per dag is het max.
- 🕐 **Doe het buiten werkuren** (19:00+) zodat Rume/Robert tijdens een
  echte uitvaart niet plots geen verbinding hebben.

---

## 7. Wat als hij crasht?

Als `load.js` errors geeft bij maar 50 VUs:

1. Check Cloudflare Pages: **Analytics → Web Analytics** in CF dashboard.
   Zie je 5xx-pieken? Dan zit het probleem bij Pages (bv. asset-cache
   probleem).
2. Check Supabase: **Logs → Edge Logs**. Zie je 503-respons of
   "remaining limit 0"? Dan rate-limit van Supabase.
3. Check de k6-output: welk endpoint faalde eerst (tag-naam in de tabel).

Veelvoorkomende eerste-bottleneck bij een free-tier setup:
**PostgREST connection pool** op Supabase. Oplossing: minder
parallel calls vanuit de webapp, of upgraden naar Pro ($25/mnd).
