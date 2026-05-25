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
      const result = await Tesseract.recognize(url, 'nld', {
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

  // MRZ-parser — herkent zowel paspoort (2×44) als ID-kaart (3×30)
  _parseMRZ(text, docType) {
    // Pak alle regels die op MRZ lijken (alleen [A-Z0-9<])
    const lines = text.split(/[\r\n]+/)
      .map(l => l.replace(/\s+/g, '').toUpperCase())
      .filter(l => /^[A-Z0-9<]+$/.test(l) && l.length >= 28);

    // Paspoort: 2 regels van 44 (TD3-formaat)
    const td3 = lines.filter(l => l.length >= 42 && l.length <= 46);
    if (td3.length >= 2) {
      const r1 = td3[0].padEnd(44, '<').slice(0, 44);
      const r2 = td3[1].padEnd(44, '<').slice(0, 44);
      if (r1.startsWith('P')) {
        return VerifiOCR._fromMRZ_TD3(r1, r2);
      }
    }

    // ID-kaart: 3 regels van 30 (TD1-formaat)
    const td1 = lines.filter(l => l.length >= 28 && l.length <= 32);
    if (td1.length >= 3) {
      const r1 = td1[0].padEnd(30, '<').slice(0, 30);
      const r2 = td1[1].padEnd(30, '<').slice(0, 30);
      const r3 = td1[2].padEnd(30, '<').slice(0, 30);
      if (r1.startsWith('I') || r1.startsWith('A') || r1.startsWith('C')) {
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

  // Vrije-tekst-parser voor wanneer MRZ niet leesbaar is
  _parseFreeText(text) {
    const out = {};
    const lines = text.split(/[\r\n]+/);

    // BSN: 8 of 9 cijfers, vaak na 'BSN'/'Burgerservicenummer'
    const bsnMatch = text.match(/B\s*S\s*N[:\s.]*([\d\s]{8,12})/i)
                  || text.match(/Burgerservicenummer[:\s.]*([\d\s]{8,12})/i)
                  || text.match(/\b(\d{9})\b/);
    if (bsnMatch) out.bsn = bsnMatch[1].replace(/\s+/g, '');

    // Achternaam — na "Achternaam:" of "ACHTERNAAM"
    const ach = text.match(/Achtername?[:\s]+([A-ZÀ-Ü][A-ZÀ-Ü\s\-']{1,40})/i);
    if (ach) out.achternaam = VerifiOCR._cleanName(ach[1]);

    // Voornaam / Voornamen
    const voor = text.match(/Voorna[ma]en?[:\s]+([A-ZÀ-Ü][A-ZÀ-Ü\s\-'a-z]{1,40})/i);
    if (voor) out.voornaam = VerifiOCR._cleanName(voor[1]);

    // Geboortedatum — diverse formaten
    const date = text.match(/Geb(?:oorte)?\s*dat(?:um)?[:\s]+(\d{1,2}[\s\-\/.]+\S+[\s\-\/.]+\d{2,4})/i);
    if (date) out.geboortedatum = VerifiOCR._parseDate(date[1]);

    // Nationaliteit
    const nat = text.match(/Nationaliteit[:\s]+([A-Za-zÀ-ü\-]+)/i);
    if (nat) out.nationaliteit = nat[1];

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
