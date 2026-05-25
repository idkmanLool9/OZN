// VerifiOCR — Tesseract.js-laden + Nederlandse identiteitsdocument-parser.
//
// Workflow:
//   1. Lazy-load Tesseract (eerste keer ~2 MB JS + ~5 MB taaldata 'nld')
//   2. OCR draaien op de gemaakte foto
//   3. Resultaat door de parser halen die MRZ-strookjes herkent
//      (paspoort 2×44, ID-kaart 3×30) én vrije tekst-velden parseert
//
// Geeft een fields-object terug met de relevante kolommen voor het
// dossier (voornaam, achternaam, geboortedatum YYYY-MM-DD, bsn, etc.).

const VerifiOCR = {
  TESSERACT_CDN: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  _loadingPromise: null,

  async _loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    if (this._loadingPromise) return this._loadingPromise;
    this._loadingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = this.TESSERACT_CDN;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error('Kon Tesseract.js niet laden'));
      document.head.appendChild(s);
    });
    return this._loadingPromise;
  },

  async recognize(file, onProgress) {
    const Tesseract = await this._loadTesseract();
    if (onProgress) onProgress({ phase: 'loading', progress: 0.05 });

    const url = URL.createObjectURL(file);
    try {
      const result = await Tesseract.recognize(url, 'nld+eng', {
        logger: m => {
          if (!onProgress) return;
          if (m.status === 'loading tesseract core') onProgress({ phase: 'loading', progress: 0.10 });
          else if (m.status === 'loading language traineddata') onProgress({ phase: 'loading', progress: 0.20 });
          else if (m.status === 'initializing api') onProgress({ phase: 'loading', progress: 0.30 });
          else if (m.status === 'recognizing text') onProgress({ phase: 'ocr', progress: 0.30 + 0.65 * (m.progress || 0) });
        },
      });
      if (onProgress) onProgress({ phase: 'parsing', progress: 0.97 });
      return result.data.text || '';
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  // Hoofd-parse — combineert MRZ en vrije-tekst-extractie
  parse(text, docType) {
    const out = {};
    const t = String(text || '');

    // 1. MRZ-zone proberen (meest betrouwbaar)
    const mrz = VerifiOCR._parseMRZ(t, docType);
    Object.assign(out, mrz);

    // 2. Vrije-tekst-velden aanvullen waar MRZ niets gaf
    const free = VerifiOCR._parseFreeText(t);
    for (const k in free) if (!out[k]) out[k] = free[k];

    return out;
  },

  // MRZ-parser — herkent zowel paspoort (2×44) als ID-kaart (3×30).
  // Soepel: OCR maakt vaak ruis (spaties, 0/O verwisseling, K/<-verwarring)
  _parseMRZ(text, docType) {
    // Normalize: OCR-foutjes corrigeren die de structuur kapot maken
    const norm = text
      .replace(/[«»]/g, '<')           // soort guillemets → <
      .replace(/[«»]/g, '<') // andere quotes
      .replace(/\s+/g, '\n');          // alle whitespace naar newlines
    const lines = norm.split('\n')
      .map(l => l.toUpperCase())
      .filter(l => /^[A-Z0-9<«]{20,}$/i.test(l));

    // Paspoort: 2 regels van 30-50 (we accepteren ruis)
    const td3 = lines.filter(l => l.length >= 38 && l.length <= 50);
    if (td3.length >= 2) {
      const r1 = td3[0].padEnd(44, '<').slice(0, 44);
      const r2 = td3[1].padEnd(44, '<').slice(0, 44);
      if (r1.startsWith('P')) {
        return VerifiOCR._fromMRZ_TD3(r1, r2);
      }
    }

    // ID-kaart: 3 regels van 24-34 (soepel)
    const td1 = lines.filter(l => l.length >= 24 && l.length <= 34);
    if (td1.length >= 3) {
      const r1 = td1[0].padEnd(30, '<').slice(0, 30);
      const r2 = td1[1].padEnd(30, '<').slice(0, 30);
      const r3 = td1[2].padEnd(30, '<').slice(0, 30);
      if (/^[IAC]/.test(r1)) {
        return VerifiOCR._fromMRZ_TD1(r1, r2, r3);
      }
    }

    return {};
  },

  // TD3 (paspoort): regel 1 = doctype/country/names, regel 2 = nummer/dob/sex/exp
  _fromMRZ_TD3(r1, r2) {
    // r1: P<CCCSURNAME<<GIVEN<NAMES<<<<<...
    const namesPart = r1.slice(5);
    const [surnameRaw, givenRaw] = namesPart.split('<<');
    const out = {};
    if (surnameRaw) out.achternaam = VerifiOCR._cleanName(surnameRaw);
    if (givenRaw)   out.voornaam   = VerifiOCR._cleanName(givenRaw);
    // r2: NUMMER(9)CK(1)NAT(3)DOB(6)CK(1)SEX(1)EXP(6)CK(1)PERSONAL(14)CK(1)CK(1)
    const docNr  = r2.slice(0, 9).replace(/</g, '');
    const dob    = r2.slice(13, 19);
    const sex    = r2.slice(20, 21);
    const exp    = r2.slice(21, 27);
    if (docNr) out.document_nummer = docNr;
    out.geboortedatum = VerifiOCR._mrzDate(dob, true);  // verleden
    out.verloopdatum  = VerifiOCR._mrzDate(exp, false); // toekomst
    if (sex === 'M' || sex === 'F') out.geslacht = sex === 'M' ? 'Man' : 'Vrouw';
    const nat = r2.slice(10, 13);
    if (nat === 'NLD') out.nationaliteit = 'Nederlandse';
    return out;
  },

  // TD1 (ID-kaart): 3 regels van 30
  _fromMRZ_TD1(r1, r2, r3) {
    const out = {};
    // r1: I<CCCDOCNUMBER(9)CK(1)OPTIONAL(15)
    const docNr = r1.slice(5, 14).replace(/</g, '');
    if (docNr) out.document_nummer = docNr;
    // r2: DOB(6)CK(1)SEX(1)EXP(6)CK(1)NAT(3)OPTIONAL(11)CK(1)
    const dob = r2.slice(0, 6);
    const sex = r2.slice(7, 8);
    const exp = r2.slice(8, 14);
    const nat = r2.slice(15, 18);
    out.geboortedatum = VerifiOCR._mrzDate(dob, true);
    out.verloopdatum  = VerifiOCR._mrzDate(exp, false);
    if (sex === 'M' || sex === 'F') out.geslacht = sex === 'M' ? 'Man' : 'Vrouw';
    if (nat === 'NLD') out.nationaliteit = 'Nederlandse';
    // r3: SURNAME<<GIVEN<NAMES<<<...
    const [surnameRaw, givenRaw] = r3.split('<<');
    if (surnameRaw) out.achternaam = VerifiOCR._cleanName(surnameRaw);
    if (givenRaw)   out.voornaam   = VerifiOCR._cleanName(givenRaw);
    return out;
  },

  _cleanName(raw) {
    // 'VAN<DER<BERG<<<' → 'Van Der Berg'
    return raw.replace(/<+/g, ' ').trim()
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  },

  // YYMMDD → YYYY-MM-DD. assumePast=true: 90 wordt 1990 (geboortedatum),
  // anders 2032 (verloopdatum).
  _mrzDate(yymmdd, assumePast) {
    if (!/^\d{6}$/.test(yymmdd)) return '';
    const yy = parseInt(yymmdd.slice(0, 2), 10);
    const mm = yymmdd.slice(2, 4);
    const dd = yymmdd.slice(4, 6);
    const thisYY = new Date().getFullYear() % 100;
    let yyyy;
    if (assumePast) {
      yyyy = yy > thisYY ? 1900 + yy : 2000 + yy;
    } else {
      yyyy = yy < thisYY ? 2000 + yy + 100 : 2000 + yy; // grof: kies dichtbij
      if (yyyy - new Date().getFullYear() > 30) yyyy -= 100;
    }
    return `${yyyy}-${mm}-${dd}`;
  },

  // Vrije-tekst-parser — heel soepel. OCR maakt vaak rommel
  // (extra spaties, opgesplitste woorden, mixed labels NL/EN).
  _parseFreeText(text) {
    const out = {};
    const lines = text.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);

    // BSN: 8 of 9 cijfers ergens in de tekst, voorkeur na 'BSN'-label
    const bsnLabel = text.match(/BSN[^\d]{0,8}(\d[\d\s]{7,11}\d)/i)
                  || text.match(/Burgerservice[^\d]{0,8}(\d[\d\s]{7,11}\d)/i)
                  || text.match(/Personal\s*number[^\d]{0,8}(\d[\d\s]{7,11}\d)/i);
    if (bsnLabel) {
      out.bsn = bsnLabel[1].replace(/\s+/g, '');
    } else {
      // Fallback: een los 9-cijferig getal (NL BSN heeft 9 digits, oud 8)
      const loose = text.match(/(?:^|\s)(\d{9})(?:\s|$)/m);
      if (loose) out.bsn = loose[1];
    }

    // Achternaam — meerdere label-varianten (NL én EN)
    const ach =
         text.match(/Achterna[am]?e?n?\s*[:\/]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-'<]{1,40})/i)
      || text.match(/Surname\s*[:\/]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-'<]{1,40})/i)
      || text.match(/Family\s*name\s*[:\/]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-'<]{1,40})/i)
      || text.match(/Nom\s*[:\/]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-'<]{1,40})/i);
    if (ach) out.achternaam = VerifiOCR._cleanName(ach[1]);

    // Voornaam / Voornamen
    const voor =
         text.match(/Voornam?e?n?\s*[:\/]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-'<]{1,40})/i)
      || text.match(/Given\s*name[s]?\s*[:\/]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-'<]{1,40})/i)
      || text.match(/Pr[ée]nom[s]?\s*[:\/]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-'<]{1,40})/i);
    if (voor) out.voornaam = VerifiOCR._cleanName(voor[1]);

    // Geboortedatum — label gevolgd door datum (NL + EN)
    const dt =
         text.match(/(?:Geb(?:oorte)?\s*dat(?:um)?|Date\s*of\s*birth|Birth\s*date|Né[e]?\s*le)\s*[:\/]?\s*(\d{1,2}[\s\-\/.]+\S+[\s\-\/.]+\d{2,4})/i);
    if (dt) {
      const parsed = VerifiOCR._parseDate(dt[1]);
      if (parsed) out.geboortedatum = parsed;
    } else {
      // Fallback: zoek een datum in DD MMM YYYY formaat (zoals op NL ID-kaart)
      const looseDate = text.match(/\b(\d{1,2}\s+(?:JAN|FEB|MRT|MAR|APR|MEI|MAY|JUN|JUL|AUG|SEP|OKT|OCT|NOV|DEC)\s+\d{4})\b/i);
      if (looseDate) {
        const parsed = VerifiOCR._parseDate(looseDate[1]);
        if (parsed) out.geboortedatum = parsed;
      }
    }

    // Geslacht
    const sex = text.match(/(?:Geslacht|Sex|Sexe)\s*[:\/]?\s*([MFVmfv])(?!\w)/);
    if (sex) {
      const s = sex[1].toUpperCase();
      out.geslacht = (s === 'M') ? 'Man' : 'Vrouw';
    }

    // Nationaliteit — NLD-code of label
    const nat =
         text.match(/Nationaliteit\s*[:\/]?\s*([A-Za-zÀ-ÿ\-]{4,20})/i)
      || text.match(/Nationality\s*[:\/]?\s*([A-Za-zÀ-ÿ\-]{4,20})/i);
    if (nat) {
      const v = nat[1].toLowerCase();
      if (/nederland|netherlands|nld/.test(v)) out.nationaliteit = 'Nederlandse';
      else out.nationaliteit = nat[1];
    } else if (/\bNLD\b/.test(text)) {
      out.nationaliteit = 'Nederlandse';
    }

    // Document-nummer — NL ID is meestal 9 alfanumeriek
    const docNr = text.match(/(?:Document(?:nummer)?|Documentnr|Number)\s*[:\/]?\s*([A-Z0-9]{6,12})/i);
    if (docNr) out.document_nummer = docNr[1];

    return out;
  },

  _parseDate(raw) {
    const m = raw.match(/(\d{1,2})[\s\-\/.]+(\d{1,2}|[A-Za-z]+)[\s\-\/.]+(\d{2,4})/);
    if (!m) return '';
    const dd = String(m[1]).padStart(2, '0');
    let mm;
    const monthsNL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
    const monthsShort = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    if (/^\d+$/.test(m[2])) {
      mm = String(parseInt(m[2], 10)).padStart(2, '0');
    } else {
      const l = m[2].toLowerCase();
      let idx = monthsShort.findIndex(n => l.startsWith(n));
      if (idx < 0) idx = monthsNL.findIndex(n => l.startsWith(n.slice(0, 3)));
      mm = idx >= 0 ? String(idx + 1).padStart(2, '0') : '';
    }
    let yy = m[3];
    if (yy.length === 2) yy = (parseInt(yy, 10) > 30 ? '19' : '20') + yy;
    if (!mm || !dd) return '';
    return `${yy}-${mm}-${dd}`;
  },
};

window.VerifiOCR = VerifiOCR;
