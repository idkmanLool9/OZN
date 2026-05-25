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

  // Vrije-tekst-parser — REGEL-GEBASEERD.
  // NL ID-kaarten zetten labels (Achternaam / Surname / Nom) op één regel
  // en de waarde op de regel daarna. Oude regex pakte de tweede taal-versie
  // van het label als waarde — daarom kreeg je "Nom" als achternaam.
  // Nu zoeken we per label de eerstvolgende regel die ZELF géén label is.
  _parseFreeText(text) {
    const out = {};
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    // Een regel die zelf nog een label-keyword bevat → overslaan als waarde
    const LABEL_RX = /\b(?:achternaam|voornam[ea]n|voornaam|geboorte|geslacht|nationaliteit|document|verloop|expir|surname|family|given|date|place|sex|sexe|prenom|prénom|nom|burgerservice|personal|number|nummer|bsn|forename)\b/i;

    function valueAfter(labelRegexes, opts) {
      opts = opts || {};
      for (let i = 0; i < lines.length; i++) {
        for (const rx of labelRegexes) {
          if (!rx.test(lines[i])) continue;
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const cand = lines[j];
            if (LABEL_RX.test(cand) && cand.length < 50) continue;
            if (/^[A-Z0-9<]{20,}$/.test(cand.replace(/\s+/g, ''))) continue;
            if (opts.needsDigit && !/\d/.test(cand)) continue;
            return cand;
          }
        }
      }
      return '';
    }

    // Achternaam
    const achRaw = valueAfter([
      /^\s*Achterna[am]/i, /^\s*Surname/i, /^\s*Family\s*name/i, /^\s*Nom\s*$/i,
    ]);
    if (achRaw) out.achternaam = VerifiOCR._cleanName(achRaw.replace(/[<\/].*$/, ''));

    // Voornaam
    const voorRaw = valueAfter([
      /^\s*Voornam/i, /^\s*Given\s*names?/i, /^\s*Pr[eé]nom/i, /^\s*Forename/i,
    ]);
    if (voorRaw) out.voornaam = VerifiOCR._cleanName(voorRaw.replace(/[<\/].*$/, ''));

    // Geboortedatum
    const dobRaw = valueAfter([
      /^\s*Geboortedat/i, /^\s*Date\s*of\s*birth/i, /^\s*Birth\s*date/i, /^\s*Geb\.?\s*dat/i,
    ], { needsDigit: true });
    if (dobRaw) {
      const parsed = VerifiOCR._parseDate(dobRaw);
      if (parsed) out.geboortedatum = parsed;
    }

    // Geboorteplaats
    const placeRaw = valueAfter([
      /^\s*Geboorteplaats/i, /^\s*Place\s*of\s*birth/i,
    ]);
    if (placeRaw) out.geboorteplaats = VerifiOCR._cleanName(placeRaw);

    // Nationaliteit
    const natRaw = valueAfter([/^\s*Nationaliteit/i, /^\s*Nationality/i]);
    if (natRaw) {
      if (/nederland|nld/i.test(natRaw)) out.nationaliteit = 'Nederlandse';
      else out.nationaliteit = natRaw.split(/[\/\s]/)[0];
    } else if (/\bNLD\b/.test(text)) {
      out.nationaliteit = 'Nederlandse';
    }

    // Geslacht
    const sexRaw = valueAfter([/^\s*Geslacht/i, /^\s*Sex\b/i, /^\s*Sexe/i]);
    if (sexRaw) {
      const m = sexRaw.match(/\b([MFV])\b/i);
      if (m) {
        const s = m[1].toUpperCase();
        out.geslacht = (s === 'M') ? 'Man' : 'Vrouw';
      }
    }

    // Documentnummer
    const docRaw = valueAfter([
      /^\s*Documentnummer/i, /^\s*Document\s*number/i, /^\s*Documentnr/i,
    ]);
    if (docRaw) {
      const m = docRaw.match(/\b[A-Z0-9]{6,12}\b/);
      if (m) out.document_nummer = m[0];
    }

    // Verloopdatum
    const expRaw = valueAfter([
      /^\s*Verloopdat/i, /^\s*Date\s*of\s*expir/i, /^\s*Expir(?:y|ation)/i,
    ], { needsDigit: true });
    if (expRaw) {
      const parsed = VerifiOCR._parseDate(expRaw);
      if (parsed) out.verloopdatum = parsed;
    }

    // BSN
    const bsnRaw = valueAfter([
      /^\s*BSN/i, /^\s*Burgerservice/i, /^\s*Personal\s*number/i,
    ], { needsDigit: true });
    if (bsnRaw) {
      const m = bsnRaw.match(/\d[\d\s]{7,11}\d/);
      if (m) out.bsn = m[0].replace(/\s+/g, '');
    }
    if (!out.bsn) {
      const loose = text.match(/(?:^|\D)(\d{9})(?:\D|$)/m);
      if (loose) out.bsn = loose[1];
    }

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
