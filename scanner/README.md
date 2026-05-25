# Verifi — ID-scanner

Een aparte mobiele app die ID-kaarten, paspoorten en rijbewijzen scant
en de gelezen gegevens **direct in een Uitvaartbeheer-dossier** stopt.

Gebruikt dezelfde Supabase-database als de uitvaart-app — login is
gedeeld, dossiers worden uit dezelfde tabel gelezen.

## Cloudflare Pages — deployment

1. **dash.cloudflare.com** → Workers & Pages → **Create** → tab **Pages**
2. **Connect to Git** → repo `idkmanLool9/uitvaart`
3. Build-instellingen:

   | Veld | Waarde |
   |---|---|
   | Project name | `verifi` |
   | Production branch | `claude/funeral-director-website-raXTm` |
   | Framework preset | None |
   | Build command | _(leeg)_ |
   | Build output directory | `scanner` |
   | Root directory | _(leeg)_ |

4. **Save and Deploy** → app komt live op `https://verifi.pages.dev`

Bij elke `git push` deployt Cloudflare automatisch een nieuwe versie.

## Status

**Foundation (build 1):**
- ✅ Login (gedeelde Supabase Auth met uitvaart-app)
- ✅ Dossier-picker met zoek
- ✅ Voor-wie-keuze (overledene / contactpersoon)
- ✅ Documenttype-keuze (ID-kaart / paspoort / rijbewijs)
- ✅ Scan-scherm (placeholder — gebruikt iOS-camera via file-input)
- ✅ Progress-scherm (gestubd, simuleert OCR)
- ✅ OCR-review (editable velden, schrijft naar Supabase)
- ✅ Success-scherm met auto-terug

**Volgende sessies:**
- 🔄 Live randdetectie + auto-crop via jscanify
- 🔄 Echte OCR via Tesseract.js
- 🔄 MRZ-parser voor paspoorten
- 🔄 Auto-roteren van de foto bij landscape-documenten
- 🔄 Multi-foto-vastleggen (voor- en achterkant)
