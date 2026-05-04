# Cloudflare Pages — setup-handleiding

Deze app wordt op Cloudflare Pages gehost: gratis, snel wereldwijd, met
automatische HTTPS en DDoS-bescherming. Bij elke `git push` deployt
Cloudflare automatisch de nieuwe versie.

## Eenmalige setup

1. **Login** op [dash.cloudflare.com](https://dash.cloudflare.com)
2. Linkermenu → **Workers & Pages** → **Create** → tab **Pages**
3. Klik **Connect to Git** → **GitHub** → autoriseer Cloudflare voor je
   account → kies de repo **`idkmanLool9/uitvaart`**
4. Klik **Begin setup**
5. Vul in:

   | Veld | Waarde |
   |---|---|
   | **Project name** | `uitvaartbeheer` (vrij te kiezen, wordt onderdeel van de URL) |
   | **Production branch** | `claude/funeral-director-website-raXTm` (of `main` als je daar later naar mergt) |
   | **Framework preset** | None |
   | **Build command** | `npm install && npm run build` |
   | **Build output directory** | `www` |
   | **Root directory** | (leeg laten) |

6. **Environment variables** — niet nodig (Supabase URL + key staan al in `js/config.js`)
7. **Save and Deploy** → eerste build duurt ±1 minuut
8. Na success: klik op de URL die Cloudflare geeft, bv.
   `https://uitvaartbeheer.pages.dev` → app staat live

## Daarna

Bij elke `git push` naar de production branch:
- Cloudflare detecteert de push
- Voert `npm install && npm run build` uit
- Publiceert nieuwe versie binnen ±1 minuut

## Eigen domein koppelen (optioneel)

Heb je een eigen domein (bv. `uitvaart.stephremklooster.nl`)?

1. In het project op Cloudflare → tab **Custom domains** → **Set up a custom domain**
2. Typ je domein → **Continue**
3. Cloudflare laat zien welke DNS-record je moet aanmaken:
   - Domein bij Cloudflare zelf? → wordt automatisch geregeld
   - Domein bij een andere registrar? → CNAME-record toevoegen die wijst
     naar `uitvaartbeheer.pages.dev`
4. Wacht 1-5 minuten op DNS-propagatie → SSL-certificaat wordt
   automatisch aangevraagd → klaar

Pas daarna **Privacy Policy URL** in `docs/appstore/metadata.md` aan
naar het nieuwe domein (bv. `https://uitvaart.stephremklooster.nl/privacy.html`).

## GitHub Pages uitschakelen (na succesvolle Cloudflare-deploy)

Cloudflare en GitHub Pages naast elkaar laten draaien is geen probleem,
maar als je opruimt:

1. GitHub → repo → **Settings** → **Pages**
2. **Source**: kies **None** → Save

## Hoe weet ik of het werkt?

Cloudflare's logs:
- Project op dash.cloudflare.com → **Deployments**-tab
- Live logs van elke build (Output, Status, Duration)
- Bij build-fout: rode markering + complete output

Live monitoring:
- **Analytics**-tab toont real-time bezoekers, bandbreedte, Core Web Vitals
- Geen cookies, AVG-conform — geen privacy-melding op de site nodig

## Bouwfout? Veelvoorkomende oorzaken

- **"npm command not found"** → bij Pages-instellingen: vink **Compatibility flags** aan met `nodejs_compat` en zet **Node.js version** naar `20`
- **"npm run build failed"** → check `package.json` en `scripts/build-www.js`
  in de repo. Beide moeten committed zijn.
- **"www directory not found"** → output directory moet exact `www` zijn
  (kleine letters, zonder slash)

## Cloudflare-only voordelen tegenover GitHub Pages

| | GitHub Pages | Cloudflare Pages |
|---|---|---|
| CDN-locaties | ~10 (US/EU) | 300+ wereldwijd |
| Bandbreedte | 100 GB/maand | onbeperkt |
| Build-tijd | ~10 sec | ~30 sec |
| Custom domains | 1, beperkt | onbeperkt, met SSL |
| Web Analytics | nee | ja, gratis, AVG-vriendelijk |
| DDoS-bescherming | nee | ja, automatisch |
| Preview-deploys per PR | nee | ja |
| Kosten | gratis | gratis |
