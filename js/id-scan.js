// IDScan: scan een paspoort of NL ID-kaart (voorkant + achterkant) via de
// camera → auto-crop + Tesseract.js → regex-parser haalt naam, geboortedatum,
// BSN, doc-nummer, etc. eruit → patcht het huidige dossier of voorgevuld
// nieuw-dossier-formulier.

const IDScan = {
  TESSERACT_CDN: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',

  async _loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = IDScan.TESSERACT_CDN;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Kon Tesseract.js niet laden'));
      document.head.appendChild(s);
    });
    return window.Tesseract;
  },

  // Bestand-kiezer (camera of galerij)
  _pickImage() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.capture = 'environment';
      inp.style.display = 'none';
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0];
        document.body.removeChild(inp);
        resolve(f || null);
      }, { once: true });
      inp.addEventListener('cancel', () => {
        document.body.removeChild(inp);
        resolve(null);
      }, { once: true });
      document.body.appendChild(inp);
      inp.click();
    });
  },

  // Hoofd-flow voor BESTAAND dossier — vraagt zelf om PATCH naar Supabase
  async scanForDossier(dossierId) {
    const fields = await IDScan._scanFlow();
    if (!fields || Object.keys(fields).length === 0) return;
    const ok = await IDScan._confirm(fields, 'Velden overnemen in dit dossier?');
    if (!ok) return;
    try {
      // De webapp gebruikt zelfde DB-abstractie als de form-view; ondersteunt
      // zowel online (Supabase) als offline (localStorage cache)
      await DB.update(KEYS.DOSSIERS, dossierId, fields);
      Modal.show({ type: 'success', title: 'Bijgewerkt', message: 'Het dossier is bijgewerkt met de gescande gegevens.' });
      if (typeof Router !== 'undefined') Router.go(`/dossiers/${dossierId}`);
    } catch (e) {
      Modal.show({ type: 'error', title: 'Bijwerken mislukt', message: e.message || String(e) });
    }
  },

  // Hoofd-flow voor NIEUW dossier — slaat op in localStorage en opent intake
  async scanForNew() {
    const fields = await IDScan._scanFlow();
    if (!fields || Object.keys(fields).length === 0) return;
    const ok = await IDScan._confirm(fields, 'Maak een nieuw dossier met deze gegevens?');
    if (!ok) return;
    try { localStorage.setItem('sok_scan_prefill', JSON.stringify(fields)); } catch (_) {}
    Router.go('/dossiers/nieuw');
  },

  // Twee-zijdige scan-flow: eerst voorkant, optioneel achterkant
  async _scanFlow() {
    const front = await IDScan._scanOne('Voorkant');
    if (!front) return null;

    const wantBack = await IDScan._yesNo(
      'Achterkant ook scannen?',
      'Op de achterkant van NL ID-kaarten staat het BSN. Zonder achterkant blijft dat veld leeg.',
      'Ja, scan achterkant',
      'Nee, overslaan'
    );

    let back = {};
    if (wantBack) {
      const backFields = await IDScan._scanOne('Achterkant');
      if (backFields) back = backFields;
    }

    // Merge: achterkant overschrijft alleen lege voorkant-velden
    const merged = { ...front };
    for (const [k, v] of Object.entries(back)) {
      if (!merged[k] && v) merged[k] = v;
    }
    return merged;
  },

  async _scanOne(label) {
    const file = await IDScan._pickImage();
    if (!file) return null;

    let userCancelled = false;
    let programmaticClose = false;
    Modal.show({
      type: 'info',
      title: `${label} scannen…`,
      message: 'Document wordt uitgesneden en de tekst herkend. Eerste scan kan iets langer duren (model wordt geladen).',
      confirmText: 'Annuleren',
    }).then(() => { if (!programmaticClose) userCancelled = true; });

    let scanned;
    try { scanned = await DocumentScanner.scan(file); }
    catch (_) { scanned = file; }
    if (userCancelled) return null;

    let text = '';
    try {
      const Tesseract = await IDScan._loadTesseract();
      if (userCancelled) return null;
      const blobUrl = URL.createObjectURL(scanned);
      // 'nld+eng' omdat ID-documenten meestal tweetalig zijn
      const result = await Tesseract.recognize(blobUrl, 'nld+eng');
      text = (result && result.data && result.data.text) || '';
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      programmaticClose = true;
      Modal.close();
      Modal.show({
        type: 'error',
        title: 'Tekst herkennen mislukt',
        message: 'OCR mislukte: ' + (e.message || e) + '. Probeer een scherpere foto.',
      });
      return null;
    }
    if (userCancelled) return null;

    programmaticClose = true;
    Modal.close();
    return IDScan._parse(text);
  },

  // Regex-parser: zoekt veldlabels EN MRZ-strookjes
  _parse(text) {
    const out = {};
    const t = String(text || '').replace(/ /g, ' ');

    const grab = (re) => {
      const m = t.match(re);
      return m ? (m[1] || '').trim().replace(/\s+/g, ' ') : '';
    };

    // ─── BSN (11-proef gevalideerd) ──────────────────────────────────────
    // Pakt alle 9-cijferige reeksen; eerste die de NL 11-proef haalt wint.
    const bsnCandidates = (t.match(/\d{9}/g) || []);
    for (const c of bsnCandidates) {
      if (IDScan._isValidBsn(c)) { out.bsn = c; break; }
    }

    // ─── MRZ-detectie (TD3 paspoort 2x44 of TD1 ID-kaart 3x30) ──────────
    // Zoek lijnen die er MRZ-achtig uitzien
    const lines = t.split('\n').map(l => l.replace(/\s/g, '').toUpperCase());
    const mrzLines = lines.filter(l => /^[A-Z0-9<]{28,46}$/.test(l));
    if (mrzLines.length >= 2) {
      const mrz = IDScan._parseMrz(mrzLines);
      if (mrz) {
        if (mrz.surname && !out.achternaam) out.achternaam = IDScan._titleCase(mrz.surname);
        if (mrz.givenNames && !out.voornaam) out.voornaam = IDScan._titleCase(mrz.givenNames.split(' ')[0]);
        if (mrz.documentNumber) out.documentnummer = mrz.documentNumber;
        if (mrz.dateOfBirth) out.geboortedatum = IDScan._yymmddToIso(mrz.dateOfBirth);
        if (mrz.gender) out.geslacht = mrz.gender;
        if (mrz.nationality) out.nationaliteit = mrz.nationality;
        // BSN via MRZ optional data (sommige oude paspoorten)
        if (mrz.bsn && !out.bsn) out.bsn = mrz.bsn;
      }
    }

    // ─── Plain-text labels (voor wanneer MRZ niet geheel zichtbaar is) ──
    if (!out.achternaam) out.achternaam = IDScan._titleCase(
      grab(/(?:Surname|Naam|Apellido|Nom)\s*\/?\s*\w*\s*[:\s]+([A-Z][A-Z\- ]+)/m)
    );
    if (!out.voornaam) out.voornaam = IDScan._titleCase(
      grab(/(?:Given\s*names|Voornamen|Vorname|Prénoms?)\s*\/?\s*\w*\s*[:\s]+([A-Z][A-Z\- ]+)/m)
    );

    // Geboortedatum / datum patronen: 12-03-1985 of 12 MAR/MAY/etc 1985
    if (!out.geboortedatum) {
      out.geboortedatum = IDScan._extractDate(t, /(?:Date\s*of\s*birth|Geboortedatum|Geburtsdatum)[:\s]+([0-9A-Za-z\-.\/\s]{8,20})/i);
    }
    // Geboorteplaats
    out.geboorteplaats = IDScan._titleCase(
      grab(/(?:Place\s*of\s*birth|Geboorteplaats|Geburtsort)[:\s]+([A-Z][A-Z\- ']+)/m)
    );

    // Nationaliteit (3-letter ISO of woord)
    if (!out.nationaliteit) {
      out.nationaliteit = grab(/(?:Nationality|Nationaliteit|Staatsangeh)[^\n:]*[:\s]+([A-Z]{3}|Nederlandse|Dutch|[A-Z][a-z]+)/i);
    }

    // Adres (kan op achterkant staan)
    out.adres_overledene = IDScan._titleCase(
      grab(/(?:Adres|Address|Straat)[:\s]+([A-Z][A-Z0-9\- .]+)/m)
    );
    // Postcode pattern in tekst
    const pc = t.match(/\b(\d{4}\s?[A-Z]{2})\b/);
    if (pc) out.postcode_overledene = pc[1].toUpperCase().replace(/\s+/g, ' ');

    // Schoon: lege waarden weg
    Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
    return out;
  },

  // ─── MRZ-parser (compact, dezelfde logica als de Android-app) ─────────
  _parseMrz(lines) {
    // TD3 = paspoort, 2 lijnen van 44
    for (let i = 0; i < lines.length - 1; i++) {
      const l1 = lines[i].padEnd(44, '<').slice(0, 44);
      const l2 = lines[i + 1].padEnd(44, '<').slice(0, 44);
      if (lines[i].length < 40 || lines[i + 1].length < 40) continue;
      if (l1[0] !== 'P') continue;

      const nat = l1.substr(2, 3).replace(/</g, '');
      const namePart = l1.substr(5);
      const [surname, given] = namePart.split('<<').map(s => s.replace(/</g, ' ').trim());

      const docNum = l2.substr(0, 9).replace(/</g, '');
      const dob = l2.substr(13, 6);
      const sex = l2[20] === 'M' ? 'M' : (l2[20] === 'F' ? 'V' : null);
      const expiry = l2.substr(21, 6);
      const personalNumber = l2.substr(28, 14).replace(/</g, '');
      const bsn = IDScan._findValidBsn(personalNumber);

      if (!/^\d{6}$/.test(dob)) continue;
      return { surname, givenNames: given, nationality: nat, documentNumber: docNum,
        dateOfBirth: dob, dateOfExpiry: expiry, gender: sex, bsn };
    }
    // TD1 = ID-kaart, 3 lijnen van 30
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].length < 28 || lines[i + 1].length < 28) continue;
      const l1 = lines[i].padEnd(30, '<').slice(0, 30);
      const l2 = lines[i + 1].padEnd(30, '<').slice(0, 30);
      if (!/^[IAC]/.test(l1)) continue;

      const nat = l1.substr(2, 3).replace(/</g, '');
      const docNum = l1.substr(5, 9).replace(/</g, '');
      const opt1 = l1.substr(15);
      const dob = l2.substr(0, 6);
      const sex = l2[7] === 'M' ? 'M' : (l2[7] === 'F' ? 'V' : null);
      const expiry = l2.substr(8, 6);
      const bsn = IDScan._findValidBsn(opt1);

      if (!/^\d{6}$/.test(dob)) continue;

      // L3 (lines[i+2]) bevat de namen, indien aanwezig
      let surname = '', given = '';
      if (lines[i + 2] && lines[i + 2].length >= 28) {
        const l3 = lines[i + 2].padEnd(30, '<').slice(0, 30);
        const parts = l3.split('<<');
        surname = (parts[0] || '').replace(/</g, ' ').trim();
        given = (parts[1] || '').replace(/</g, ' ').trim();
      }
      return { surname, givenNames: given, nationality: nat, documentNumber: docNum,
        dateOfBirth: dob, dateOfExpiry: expiry, gender: sex, bsn };
    }
    return null;
  },

  // ─── Helpers ─────────────────────────────────────────────────────────
  _isValidBsn(s) {
    if (!/^\d{9}$/.test(s)) return false;
    const w = [9, 8, 7, 6, 5, 4, 3, 2, -1];
    const sum = s.split('').reduce((a, c, i) => a + parseInt(c, 10) * w[i], 0);
    return sum % 11 === 0;
  },

  _findValidBsn(field) {
    const digits = (field || '').replace(/\D/g, '');
    for (let i = 0; i + 9 <= digits.length; i++) {
      const c = digits.substr(i, 9);
      if (IDScan._isValidBsn(c)) return c;
    }
    return null;
  },

  _yymmddToIso(yymmdd) {
    if (!/^\d{6}$/.test(yymmdd)) return '';
    const yy = parseInt(yymmdd.substr(0, 2), 10);
    const mm = yymmdd.substr(2, 2);
    const dd = yymmdd.substr(4, 2);
    const thisYY = new Date().getFullYear() % 100;
    const century = yy > thisYY + 10 ? '19' : '20';
    return `${century}${yymmdd.substr(0, 2)}-${mm}-${dd}`;
  },

  _extractDate(text, label) {
    const m = text.match(label);
    if (!m) return '';
    const val = m[1].trim();
    // 12-03-1985, 12/03/1985, 12.03.1985
    let dm = val.match(/(\d{1,2})[\-\/.\s]+(\d{1,2}|\w+)[\-\/.\s]+(\d{2,4})/);
    if (!dm) return '';
    const day = String(dm[1]).padStart(2, '0');
    let monthRaw = dm[2].toLowerCase();
    let month;
    if (/^\d+$/.test(monthRaw)) {
      month = String(parseInt(monthRaw, 10)).padStart(2, '0');
    } else {
      const months = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec',
                      'mar','may','oct','dec'];
      const idx = months.findIndex(n => monthRaw.startsWith(n));
      if (idx < 0) return '';
      const monthMap = { jan:1, feb:2, mrt:3, apr:4, mei:5, jun:6, jul:7, aug:8, sep:9, okt:10, nov:11, dec:12,
                         mar:3, may:5, oct:10 };
      month = String(monthMap[monthRaw.slice(0, 3)] || 0).padStart(2, '0');
    }
    let year = dm[3];
    if (year.length === 2) year = (parseInt(year, 10) > 30 ? '19' : '20') + year;
    return `${year}-${month}-${day}`;
  },

  _titleCase(s) {
    if (!s) return '';
    return s.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).trim();
  },

  // ─── Bevestigingsdialoog (preview gevonden velden) ───────────────────
  _confirm(fields, intro) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal shown';
      overlay.style.zIndex = 200;

      const labels = {
        voornaam: 'Voornaam', achternaam: 'Achternaam',
        geboortedatum: 'Geboortedatum', geboorteplaats: 'Geboorteplaats',
        geslacht: 'Geslacht', nationaliteit: 'Nationaliteit',
        documentnummer: 'Documentnummer', bsn: 'BSN',
        adres_overledene: 'Adres', postcode_overledene: 'Postcode',
      };
      const order = Object.keys(labels);

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
          <p class="muted small">${esc(intro)}</p>
          ${empty
            ? '<p class="muted">Niets automatisch herkend. Probeer een scherpere foto of vul handmatig in.</p>'
            : '<div class="scan-confirm-rows">' + rows + '</div>'}
          <div class="modal-buttons">
            <button type="button" class="btn btn-ghost" data-act="cancel">Annuleren</button>
            <button type="button" class="btn btn-primary" data-act="ok">Bevestigen</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const close = (result) => {
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

  // Simpele ja/nee modal
  _yesNo(title, message, yesText, noText) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal shown';
      overlay.style.zIndex = 200;
      overlay.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-card">
          <h2>${esc(title)}</h2>
          <p>${esc(message)}</p>
          <div class="modal-buttons">
            <button type="button" class="btn btn-ghost" data-act="no">${esc(noText)}</button>
            <button type="button" class="btn btn-primary" data-act="yes">${esc(yesText)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const close = (v) => { overlay.remove(); resolve(v); };
      overlay.querySelector('[data-act="no"]').addEventListener('click', () => close(false));
      overlay.querySelector('[data-act="yes"]').addEventListener('click', () => close(true));
      overlay.querySelector('.modal-backdrop').addEventListener('click', () => close(false));
    });
  },
};
