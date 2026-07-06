# SnelStart-koppeling — instellen

De app kan koppelen met je **SnelStart**-administratie via de officiële
**B2B API**. Zodra je de sleutels hebt, vul je ze in de app in — er hoeft
verder niets aan code te gebeuren.

## Wat je nodig hebt (uit SnelStart)

Vraag in je SnelStart-account de **B2B API**-toegang aan. Je krijgt dan twee
sleutels:

1. **Subscription key** — de sleutel voor de API-gateway
   (gaat mee als `Ocp-Apim-Subscription-Key`).
2. **Client key** — een sleutel **per administratie**; hiermee logt de app
   namens jouw administratie in.

> Beide sleutels zijn geheim. Bewaar ze veilig.

## Invullen in de app

1. Ga naar **Account → SnelStart-koppeling (boekhouding)**.
2. Zet **Koppeling actief** aan.
3. Plak de **Subscription key** en de **Client key**.
4. Klik op **⇄ Test verbinding**.
   - ✓ groen = de sleutels werken en de app heeft contact met SnelStart.
   - ✗ rood = lees de melding; meestal is één van de sleutels verkeerd.
5. Klik op **Opslaan**.

De sleutels worden in de cloud-instellingen bewaard en alleen via een
beveiligde serverfunctie (`snelstart` Edge Function) naar SnelStart gestuurd —
nooit rechtstreeks vanuit de browser (dat kan ook niet i.v.m. CORS).

## Hoe het technisch werkt

- **`js/snelstart.js`** — `SnelStart.test()` en `SnelStart.request(method, path, body)`.
- **Edge Function `snelstart`** (`supabase/functions/snelstart/index.ts`) —
  wisselt de client key om voor een bearer-token en zet de API-call door.
  Al gedeployd op project `cmcbmcyxdndymxgpxmed`.

## Facturen/boekingen versturen — vervolgstap

De verbinding + proxy staan klaar. Het automatisch wegschrijven van een
**verkoopboeking** vereist nog je administratie-specifieke gegevens
(grootboekrekening omzet, btw-soort en het relatie/debiteur-record). Dat is
het beste in te regelen zodra de verbinding getest is, want die waarden
verschillen per SnelStart-administratie. Vanuit de app kan dat via:

```js
// voorbeeld: relaties ophalen
await SnelStart.request('GET', '/relaties?$top=5');

// voorbeeld: verkoopboeking aanmaken (velden afhankelijk van je administratie)
await SnelStart.request('POST', '/verkoopboekingen', { /* … */ });
```
