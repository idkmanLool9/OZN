// IntakeScan: scan een ingevuld papieren aangifte-formulier (St. Ephrem)
// → auto-crop via DocumentScanner → OCR via Tesseract.js (NL) → regex-parser
// extraheert bekende velden → opent het nieuwe-dossier-formulier voorgevuld.

const IntakeScan = {
  TESSERACT_CDN: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',

  // Tesseract lazy laden (±2 MB) — alleen wanneer scan-knop wordt gebruikt
  async _loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = IntakeScan.TESSERACT_CDN;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Kon Tesseract.js niet laden'));
      document.head.appendChild(s);
    });
    return window.Tesseract;
  },

  // Hoofd-flow: van knop-klik tot voorgevuld dossier
  async start() {
    // 1. Bestand kiezen (camera of galerij)
    const file = await IntakeScan._pickImage();
    if (!file) return;

    // 2. Auto-crop + perspective-correctie via bestaande DocumentScanner
    const loading = Modal.show({
      type: 'info',
      title: 'Bezig met scannen...',
      message: 'Het document wordt eerst uitgesneden en rechtgezet, daarna leest de app de tekst uit. Dit kan een paar seconden duren bij de eerste keer.',
      confirmText: 'Annuleren',
    });

    let scanned;
    try {
      scanned = await DocumentScanner.scan(file);
    } catch (e) {
      // Lukt de auto-crop niet, gebruik dan gewoon het origineel
      scanned = file;
    }

    // 3. OCR via Tesseract — Nederlands
    let text = '';
    try {
      const Tesseract = await IntakeScan._loadTesseract();
      const blobUrl = URL.createObjectURL(scanned);
      const result = await Tesseract.recognize(blobUrl, 'nld', {
        // Geen logger — Modal.show is non-blocking en sluit straks vanzelf
      });
      text = (result && result.data && result.data.text) || '';
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      Modal.show({
        type: 'error',
        title: 'Tekst herkennen mislukt',
        message: 'Het scannen van de tekst lukte niet: ' + (e.message || e) + '. Probeer een scherpere foto, of vul het formulier handmatig in.',
      });
      return;
    }

    // 4. Velden uit de tekst halen
    const fields = IntakeScan._parse(text);

    // 5. Toon preview + bevestig
    const ok = await IntakeScan._confirm(fields, text);
    if (!ok) return;

    // 6. Sla op in localStorage zodat het nieuwe-dossier-formulier de
    //    velden voorgeladen kan tonen
    try {
      localStorage.setItem('sok_scan_prefill', JSON.stringify(fields));
    } catch (_) {}
    Router.go('/dossiers/nieuw');
  },

  // Bestand-kiezer (camera of galerij)
  _pickImage() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*,application/pdf';
      inp.capture = 'environment';
      inp.style.display = 'none';
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0];
        document.body.removeChild(inp);
        resolve(f || null);
      }, { once: true });
      // Cancel detectie: 'cancel' event bestaat in moderne browsers
      inp.addEventListener('cancel', () => {
        document.body.removeChild(inp);
        resolve(null);
      }, { once: true });
      document.body.appendChild(inp);
      inp.click();
    });
  },

  // Regex-parser voor het St. Ephrem-aangifte-formulier
  // Werkt op ruwe OCR-tekst; tolerant voor kleine fouten.
  _parse(text) {
    const out = {};
    const t = String(text || '').replace(/[ ]/g, ' ');

    const grab = (re) => {
      const m = t.match(re);
      return m ? (m[1] || '').trim().replace(/\s+/g, ' ') : '';
    };
    const grabDate = (re) => {
      const v = grab(re);
      // Formaten: 12-3-1985, 12/03/1985, 12.03.85, 12 maart 1985
      let m = v.match(/(\d{1,2})[\-\/.\s]+(\d{1,2}|\w+)[\-\/.\s]+(\d{2,4})/);
      if (!m) return '';
      const day = String(m[1]).padStart(2, '0');
      let monthRaw = m[2].toLowerCase();
      const monthsNL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
      let month;
      if (/^\d+$/.test(monthRaw)) {
        month = String(parseInt(monthRaw, 10)).padStart(2, '0');
      } else {
        const idx = monthsNL.findIndex(n => monthRaw.startsWith(n.slice(0, 3)));
        month = idx >= 0 ? String(idx + 1).padStart(2, '0') : '';
      }
      let year = m[3];
      if (year.length === 2) year = (parseInt(year, 10) > 30 ? '19' : '20') + year;
      if (!month || !day) return '';
      return `${year}-${month}-${day}`;
    };

    // Achternaam + voornamen
    out.achternaam = grab(/Naam\s*overledene[:\s]+([^\n\r]+)/i);
    const voorn = grab(/Voornam[ea]n?[:\s]+([^\n\r]+)/i);
    if (voorn) out.voornaam = voorn;

    // Geboren te / op
    out.geboorteplaats = grab(/Geboren\s*te[:\s]+([^\n\r:]+?)(?=\s+Op[:\s]|\n|$)/i);
    out.geboortedatum = grabDate(/Op[:\s]+(\d{1,2}[\-\/.\s]+\S+[\-\/.\s]+\d{2,4})/i);

    // Overlijden
    out.overlijdensdatum = grabDate(/Datum[:\s]+(\d{1,2}[\-\/.\s]+\S+[\-\/.\s]+\d{2,4})\s*(?:Uur|tijd|$)/i);
    out.overlijdenstijd  = grab(/Uur[:\s]+(\d{1,2}[:.]\d{2})/i).replace('.', ':');
    out.overlijdensplaats = grab(/Overleden\s*te[:\s]+([^\n\r]+)/i);

    // Adres / wonende te
    out.adres_overledene = grab(/Adres\s*van\s*overlijden[:\s]+([^\n\r]+)/i)
                        || grab(/Wonende\s*te[:\s]+([^\n\r]+)/i);

    // BSN
    out.bsn = grab(/BSN[:\s]*([0-9]{8,9})/i);

    // Postcode in adres-tekst
    const pc = (out.adres_overledene || '').match(/(\d{4}\s*[A-Z]{2})/);
    if (pc) out.postcode_overledene = pc[1].toUpperCase().replace(/\s+/g, ' ');

    // Erfgenaam / contactpersoon
    out.contact_naam = grab(/Erfgenaam[:\s]+([^\n\r]+?)(?:\n|Naam|$)/i);

    // Schoonmaak: lege strings weg
    Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
    return out;
  },

  // Bevestigings-modal toont de gevonden velden + ruwe tekst (inklapbaar)
  _confirm(fields, rawText) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal shown';
      overlay.style.zIndex = 200;

      const labels = {
        voornaam: 'Voornaam', achternaam: 'Achternaam',
        geboortedatum: 'Geboortedatum', geboorteplaats: 'Geboorteplaats',
        overlijdensdatum: 'Overlijdensdatum', overlijdenstijd: 'Tijdstip overlijden',
        overlijdensplaats: 'Plaats overlijden', adres_overledene: 'Adres',
        postcode_overledene: 'Postcode', bsn: 'BSN',
        contact_naam: 'Contactpersoon',
      };
      const order = ['voornaam','achternaam','geboortedatum','geboorteplaats',
        'overlijdensdatum','overlijdenstijd','overlijdensplaats',
        'adres_overledene','postcode_overledene','bsn','contact_naam'];

      const rows = order
        .filter(k => fields[k])
        .map(k => `
          <div class="scan-confirm-row">
            <span class="scan-confirm-label">${esc(labels[k] || k)}</span>
            <input type="text" class="scan-confirm-input" data-field="${esc(k)}" value="${esc(fields[k])}">
          </div>`)
        .join('');

      const empty = order.every(k => !fields[k]);

      overlay.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-card scan-confirm-card">
          <h2>Gevonden gegevens</h2>
          ${empty
            ? '<p class="muted">Geen velden automatisch herkend. Je kunt het dossier alsnog handmatig invullen.</p>'
            : '<p class="muted small">Controleer of de gegevens kloppen voordat je het dossier aanmaakt. Je kunt nog aanpassen.</p>'}
          <div class="scan-confirm-rows">${rows}</div>
          <details class="scan-confirm-raw">
            <summary>Ruwe gescande tekst tonen</summary>
            <pre class="scan-confirm-text">${esc(rawText)}</pre>
          </details>
          <div class="modal-buttons">
            <button type="button" class="btn btn-ghost" data-act="cancel">Annuleren</button>
            <button type="button" class="btn btn-primary" data-act="ok">Maak dossier</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const close = (result) => {
        // Lees evt. handmatig aangepaste waarden
        if (result) {
          overlay.querySelectorAll('.scan-confirm-input').forEach(inp => {
            const k = inp.dataset.field;
            const v = inp.value.trim();
            if (v) fields[k] = v; else delete fields[k];
          });
        }
        overlay.remove();
        resolve(result);
      };
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
      overlay.querySelector('.modal-backdrop').addEventListener('click', () => close(false));
      overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    });
  },
};
