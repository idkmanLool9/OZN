// ─── Demo-modus (Apple App Review) ───────────────────────────────────────────
// Als het review-/demo-account inlogt, tonen we NIET de echte dossiers, maar een
// set volledig ingevulde, fictieve demo-dossiers. Alles blijft werken (openen,
// bewerken, kosten toevoegen, kostenraming-PDF, familie-portaal), maar alle
// bewerkingen blijven lokaal in het geheugen — er wordt niets naar de cloud
// geschreven en nergens in de app staat het woord "demo" zichtbaar.
//
// Voeg extra review-accounts toe door hun e-mailadres (kleine letters) aan
// DEMO_ACCOUNTS toe te voegen.
const DEMO_ACCOUNTS = ['reviewer@morephrem.com'];

// Drie realistische, fictieve dossiers — compleet ingevuld zodat een reviewer
// direct de volledige workflow ziet. Geen echte persoonsgegevens.
const DEMO_DOSSIERS = [
  {
    id: 900001, dossier_nummer: '2026-101',
    voornaam: 'Georges', achternaam: 'Aydın', geslacht: 'man',
    geboortedatum: '1947-03-12', geboorteplaats: 'Midyat, Turkije',
    overlijdensdatum: '2026-06-10', overlijdenstijd: '04:20', overlijdensplaats: 'Enschede',
    adres_overledene: 'Lariksstraat 14', postcode_overledene: '7545 XT', woonplaats_overledene: 'Enschede',
    bsn: '111222333', nationaliteit: 'Nederlandse', syrisch_orthodox_lid: 'ja',
    gezinsnummer: 'G-0421', grafnummer: 'A-137',
    partner_naam: 'Saïda Aydın-Barsoum', kinderen_status: '3 kinderen (meerderjarig)',
    contact_voornaam: 'Elias', contact_naam: 'Aydın', contact_relatie: 'Zoon',
    contact_telefoon: '06 24 55 18 90', contact_email: 'elias.aydin@example.com',
    contact_adres: 'Boekweitstraat', contact_huisnummer: '8', contact_postcode: '7545 KL', contact_woonplaats: 'Enschede',
    parochie: 'Mor Kuryakos — Enschede', priester: 'Abuna Yakup', uitvaart_voorganger: 'Mor Polycarpus',
    huisbezoek_datum: '2026-06-11', huisbezoek_tijd: '19:00',
    uitvaart_type: 'Begrafenis', uitvaart_datum: '2026-06-14', uitvaart_tijd: '13:00',
    kerk_locatie: 'Maria kathedraal', begraafplaats: 'St. Ephrem', graf_type: 'Eigen graf',
    kist_type: '1-70 E S', rouwauto: 'ja', aantal_volgauto: '2', dragers: '6',
    verzekering_status: 'met verzekering', verzekering_maatschappij: 'DELA',
    polisnummer: 'DL-88213947',
    verzekering_pakket: 'DELA UitvaartPlan in Diensten — externe uitvaartleider',
    verzekering_dekking: '3957',
    betaalwijze: 'Verzekering + eigen bijdrage', aanbetaling_bedrag: 500, aanbetaling_datum: '2026-06-12',
    opdrachtgever_naam: 'Elias Aydın', opdrachtgever_telefoon: '06 24 55 18 90',
    bijzonderheden: 'Koffie en simit na afloop in de Dolabani-zaal. Familie brengt eigen fotolijst mee.',
    status: 'voltooid',
    created_at: '2026-06-10T06:30:00.000Z', updated_at: '2026-06-15T09:10:00.000Z',
    bijgewerkt_door: 'Robert',
  },
  {
    id: 900002, dossier_nummer: '2026-102',
    voornaam: 'Marta', achternaam: 'Barsoum', geslacht: 'vrouw',
    geboortedatum: '1952-09-01', geboorteplaats: 'Qamishli, Syrië',
    overlijdensdatum: '2026-06-28', overlijdenstijd: '22:05', overlijdensplaats: 'Hengelo',
    adres_overledene: 'Deldenerstraat 210', postcode_overledene: '7551 AG', woonplaats_overledene: 'Hengelo',
    bsn: '123456782', nationaliteit: 'Nederlandse', syrisch_orthodox_lid: 'ja',
    gezinsnummer: 'G-0512', grafnummer: '',
    partner_naam: 'wijlen Isa Barsoum', kinderen_status: '2 kinderen (meerderjarig)',
    contact_voornaam: 'Ninwe', contact_naam: 'Barsoum', contact_relatie: 'Dochter',
    contact_telefoon: '06 41 20 77 63', contact_email: 'ninwe.b@example.com',
    contact_adres: 'Oldenzaalsestraat', contact_huisnummer: '45', contact_postcode: '7551 AB', contact_woonplaats: 'Hengelo',
    parochie: 'Mor Severios — Hengelo', priester: 'Abuna Gabriel', uitvaart_voorganger: '',
    huisbezoek_datum: '2026-06-30', huisbezoek_tijd: '20:00',
    uitvaart_type: 'Begrafenis', uitvaart_datum: '2026-07-05', uitvaart_tijd: '11:00',
    kerk_locatie: 'Mor Severios — Hengelo', begraafplaats: 'St. Ephrem', graf_type: 'Algemeen graf',
    kist_type: '8-10 HC8 Natuur', rouwauto: 'ja', aantal_volgauto: '1', dragers: '6',
    verzekering_status: 'zonder verzekering', verzekering_maatschappij: '', polisnummer: '',
    verzekering_pakket: '', verzekering_dekking: '',
    betaalwijze: 'Eigen betaling', aanbetaling_bedrag: 0,
    opdrachtgever_naam: 'Ninwe Barsoum', opdrachtgever_telefoon: '06 41 20 77 63',
    bijzonderheden: 'Familie wenst extra bloemstukken met linten. Aantal volgauto’s nog te bevestigen.',
    status: 'in_behandeling',
    created_at: '2026-06-29T07:00:00.000Z', updated_at: '2026-07-01T15:45:00.000Z',
    bijgewerkt_door: 'Rume',
  },
  {
    id: 900003, dossier_nummer: '2026-103',
    voornaam: 'Yusuf', achternaam: 'Younan', geslacht: 'man',
    geboortedatum: '1963-11-24', geboorteplaats: 'Bagdad, Irak',
    overlijdensdatum: '2026-07-01', overlijdenstijd: '13:40', overlijdensplaats: 'Almelo',
    adres_overledene: 'Wierdensestraat 66', postcode_overledene: '7607 GJ', woonplaats_overledene: 'Almelo',
    bsn: '111111110', nationaliteit: 'Nederlandse', syrisch_orthodox_lid: 'ja',
    gezinsnummer: 'G-0533', grafnummer: '',
    partner_naam: 'Hana Younan', kinderen_status: '4 kinderen (meerderjarig)',
    contact_voornaam: 'Sargon', contact_naam: 'Younan', contact_relatie: 'Zoon',
    contact_telefoon: '06 38 91 44 02', contact_email: 'sargon.younan@example.com',
    contact_adres: 'Grotestraat', contact_huisnummer: '112', contact_postcode: '7607 CK', contact_woonplaats: 'Almelo',
    parochie: 'Mor Aday — Rijssen', priester: '', uitvaart_voorganger: '',
    huisbezoek_datum: '2026-07-03', huisbezoek_tijd: '18:30',
    uitvaart_type: 'Begrafenis', uitvaart_datum: '2026-07-08', uitvaart_tijd: '13:00',
    kerk_locatie: 'Maria kathedraal', begraafplaats: 'St. Ephrem', graf_type: '',
    kist_type: '', rouwauto: 'ja', aantal_volgauto: '', dragers: '',
    verzekering_status: 'met verzekering', verzekering_maatschappij: 'Monuta',
    polisnummer: 'MON-5521398', verzekering_pakket: 'Standaard pakket', verzekering_dekking: '',
    betaalwijze: '', aanbetaling_bedrag: 0,
    opdrachtgever_naam: 'Sargon Younan', opdrachtgever_telefoon: '06 38 91 44 02',
    bijzonderheden: 'Intake net gestart — kist en dragers nog te bepalen tijdens huisbezoek.',
    status: 'nieuw',
    created_at: '2026-07-01T15:20:00.000Z', updated_at: '2026-07-02T08:05:00.000Z',
  },
];

const DEMO_KOSTEN = [
  // Dossier 900001 — vrijwel compleet
  { id: 910001, dossier_id: 900001, categorie: 'aannametarief', omschrijving: 'Benodigd personeel en uitvoering', bedrag: 622.00, aantal: 1, betaald: true },
  { id: 910002, dossier_id: 900001, categorie: 'vervoer',       omschrijving: 'Transport overledene (0–40 km vanaf Oldenzaal)', bedrag: 231.00, aantal: 1, betaald: true },
  { id: 910003, dossier_id: 900001, categorie: 'verzorging',    omschrijving: 'Verzorging & Inkisten', bedrag: 174.00, aantal: 1, betaald: true },
  { id: 910004, dossier_id: 900001, categorie: 'kist',          omschrijving: 'Kist 1-70 E S (massief eiken)', bedrag: 1231.50, aantal: 1, betaald: true },
  { id: 910005, dossier_id: 900001, categorie: 'aula',          omschrijving: 'Gebruik aula 3 dagen', bedrag: 446.00, aantal: 1, betaald: true },
  { id: 910006, dossier_id: 900001, categorie: 'kerk',          omschrijving: 'Gebruik Kerk en Dolabani Zaal', bedrag: 500.00, aantal: 1, betaald: true },
  { id: 910007, dossier_id: 900001, categorie: 'begraafplaats', omschrijving: 'Openen graf', bedrag: 250.00, aantal: 1, betaald: true },
  { id: 910008, dossier_id: 900001, categorie: 'begraafplaats', omschrijving: 'Onderhoudskosten', bedrag: 600.00, aantal: 1, betaald: true },
  { id: 910009, dossier_id: 900001, categorie: 'bloemen',       omschrijving: 'Bloemstuk met lint', bedrag: 145.00, aantal: 1, betaald: true },
  { id: 910010, dossier_id: 900001, categorie: 'administratie', omschrijving: 'Akte van Overlijden', bedrag: 17.80, aantal: 1, betaald: true },
  { id: 910011, dossier_id: 900001, categorie: 'overig',        omschrijving: 'Simit', bedrag: 120.00, aantal: 150, betaald: true },
  // Dossier 900002 — in behandeling
  { id: 910020, dossier_id: 900002, categorie: 'aannametarief', omschrijving: 'Benodigd personeel en uitvoering', bedrag: 622.00, aantal: 1, betaald: false },
  { id: 910021, dossier_id: 900002, categorie: 'vervoer',       omschrijving: 'Kosten ziekenhuismortuarium (Almelo / Enschede)', bedrag: 146.00, aantal: 1, betaald: false },
  { id: 910022, dossier_id: 900002, categorie: 'kist',          omschrijving: 'Kist 8-10 HC8 Natuur', bedrag: 784.50, aantal: 1, betaald: false },
  { id: 910023, dossier_id: 900002, categorie: 'kerk',          omschrijving: 'Gebruik Kerk en Dolabani Zaal', bedrag: 500.00, aantal: 1, betaald: false },
  { id: 910024, dossier_id: 900002, categorie: 'begraafplaats', omschrijving: 'Algemeen graf', bedrag: 1250.00, aantal: 1, betaald: false },
  { id: 910025, dossier_id: 900002, categorie: 'bloemen',       omschrijving: 'Bloemstuk', bedrag: 120.00, aantal: 1, betaald: false },
  // Dossier 900003 — net gestart
  { id: 910030, dossier_id: 900003, categorie: 'aannametarief', omschrijving: 'Benodigd personeel en uitvoering', bedrag: 622.00, aantal: 1, betaald: false },
  { id: 910031, dossier_id: 900003, categorie: 'administratie', omschrijving: 'Akte van Overlijden', bedrag: 17.80, aantal: 1, betaald: false },
];

const DEMO_NOTITIES = [
  { id: 920001, dossier_id: 900001, tekst: 'Familie akkoord met kostenraming op 12-06. Aanbetaling €500 ontvangen.', auteur: 'Robert', created_at: '2026-06-12T10:00:00.000Z' },
  { id: 920002, dossier_id: 900002, tekst: 'Huisbezoek gepland op 30-06 om 20:00. Dochter Ninwe is contactpersoon.', auteur: 'Rume', created_at: '2026-06-30T09:00:00.000Z' },
];

// Ledenadministratie — fictieve gezinnen, gekoppeld aan de demo-dossiers via
// hetzelfde gezinsnummer.
const DEMO_GEZINNEN = [
  { id: 930001, gezinsnummer: 'G-0421', familienaam: 'Aydın', parochie: 'Mor Kuryakos — Enschede', adres: 'Lariksstraat 14', postcode: '7545 XT', woonplaats: 'Enschede', telefoon: '06 24 55 18 90', email: 'familie.aydin@example.com', status: 'actief', notities: '', created_at: '2026-01-10T09:00:00.000Z', updated_at: '2026-06-15T09:10:00.000Z', bijgewerkt_door: 'Robert' },
  { id: 930002, gezinsnummer: 'G-0512', familienaam: 'Barsoum', parochie: 'Mor Severios — Hengelo', adres: 'Deldenerstraat 210', postcode: '7551 AG', woonplaats: 'Hengelo', telefoon: '06 41 20 77 63', email: 'familie.barsoum@example.com', status: 'actief', notities: '', created_at: '2026-02-02T09:00:00.000Z', updated_at: '2026-07-01T15:45:00.000Z', bijgewerkt_door: 'Rume' },
  { id: 930003, gezinsnummer: 'G-0533', familienaam: 'Younan', parochie: 'Mor Aday — Rijssen', adres: 'Wierdensestraat 66', postcode: '7607 GJ', woonplaats: 'Almelo', telefoon: '06 38 91 44 02', email: 'familie.younan@example.com', status: 'actief', notities: '', created_at: '2026-03-18T09:00:00.000Z', updated_at: '2026-07-02T08:05:00.000Z' },
];

const DEMO_LEDEN = [
  // Aydın
  { id: 940001, gezin_id: 930001, voornaam: 'Georges', achternaam: 'Aydın', doopnaam: 'Gewargis', geslacht: 'man', relatie: 'hoofd', geboortedatum: '1947-03-12', geboorteplaats: 'Midyat, Turkije', doopdatum: '1947-05-04', doopplaats: 'Midyat', status: 'overleden', overlijdensdatum: '2026-06-10', notities: '' },
  { id: 940002, gezin_id: 930001, voornaam: 'Saïda', achternaam: 'Aydın-Barsoum', geslacht: 'vrouw', relatie: 'partner', geboortedatum: '1951-08-19', geboorteplaats: 'Midyat, Turkije', status: 'actief', telefoon: '06 24 55 18 91' },
  { id: 940003, gezin_id: 930001, voornaam: 'Elias', achternaam: 'Aydın', geslacht: 'man', relatie: 'kind', geboortedatum: '1978-02-27', geboorteplaats: 'Enschede', doopdatum: '1978-04-16', doopplaats: 'Enschede', status: 'actief', telefoon: '06 24 55 18 90', email: 'elias.aydin@example.com' },
  // Barsoum
  { id: 940010, gezin_id: 930002, voornaam: 'Marta', achternaam: 'Barsoum', geslacht: 'vrouw', relatie: 'hoofd', geboortedatum: '1952-09-01', geboorteplaats: 'Qamishli, Syrië', status: 'overleden', overlijdensdatum: '2026-06-28' },
  { id: 940011, gezin_id: 930002, voornaam: 'Ninwe', achternaam: 'Barsoum', geslacht: 'vrouw', relatie: 'kind', geboortedatum: '1983-05-12', geboorteplaats: 'Hengelo', status: 'actief', telefoon: '06 41 20 77 63', email: 'ninwe.b@example.com' },
  // Younan
  { id: 940020, gezin_id: 930003, voornaam: 'Yusuf', achternaam: 'Younan', geslacht: 'man', relatie: 'hoofd', geboortedatum: '1963-11-24', geboorteplaats: 'Bagdad, Irak', status: 'overleden', overlijdensdatum: '2026-07-01' },
  { id: 940021, gezin_id: 930003, voornaam: 'Hana', achternaam: 'Younan', geslacht: 'vrouw', relatie: 'partner', geboortedatum: '1968-06-30', geboorteplaats: 'Bagdad, Irak', status: 'actief' },
  { id: 940022, gezin_id: 930003, voornaam: 'Sargon', achternaam: 'Younan', geslacht: 'man', relatie: 'kind', geboortedatum: '1992-10-08', geboorteplaats: 'Almelo', status: 'actief', telefoon: '06 38 91 44 02', email: 'sargon.younan@example.com' },
];

const Demo = {
  isActive() {
    const u = (typeof Auth !== 'undefined' && Auth.current()) || null;
    const e = u && u.email ? u.email.toLowerCase() : '';
    return !!e && DEMO_ACCOUNTS.includes(e);
  },
  _clone(x) { return JSON.parse(JSON.stringify(x)); },

  // In plaats van de echte tabellen laden: fictieve dossiers seeden. Publieke
  // catalogi (niet gevoelig) laden we wél mee zodat Kisten/Bloemen/Eten gevuld
  // zijn. Faalt dat (offline), dan blijven die gewoon leeg.
  async loadAll() {
    Cloud.cache.dossiers = Demo._clone(DEMO_DOSSIERS);
    Cloud.cache.kosten   = Demo._clone(DEMO_KOSTEN).map(normKosten);
    Cloud.cache.notities = Demo._clone(DEMO_NOTITIES);
    Cloud.cache.gezinnen = Demo._clone(DEMO_GEZINNEN);
    Cloud.cache.leden    = Demo._clone(DEMO_LEDEN);
    try {
      const [kim, blm, etn] = await Promise.all([
        sb.from('kist_afbeeldingen').select('*'),
        sb.from('bloemen_catalogus').select('*').order('naam', { ascending: true }),
        sb.from('eten_drinken_catalogus').select('*').order('naam', { ascending: true }),
      ]);
      Cloud.cache.kist_afbeeldingen = ((kim && kim.data) || []).map(normRow);
      Cloud.cache.bloemen_catalogus = ((blm && blm.data) || []).map(normBloem);
      Cloud.cache.eten_drinken_catalogus = ((etn && etn.data) || []).map(normEten);
    } catch (_) {
      Cloud.cache.kist_afbeeldingen = Cloud.cache.kist_afbeeldingen || [];
      Cloud.cache.bloemen_catalogus = Cloud.cache.bloemen_catalogus || [];
      Cloud.cache.eten_drinken_catalogus = Cloud.cache.eten_drinken_catalogus || [];
    }
    Cloud.loaded = true;
    Cloud.offline = false;
  },

  nextId(tbl) {
    const rows = Cloud.cache[tbl] || [];
    let max = 900000;
    for (const r of rows) if (typeof r.id === 'number' && r.id > max) max = r.id;
    return max + 1;
  },

  // Schrijf-operaties: uitsluitend in het geheugen (nooit naar Supabase).
  insert(tbl, payload) {
    const now = new Date().toISOString();
    const row = Object.assign({}, payload, { id: Demo.nextId(tbl) });
    if (tbl === 'dossiers') {
      row.created_at = row.created_at || now; row.updated_at = now;
      if (!row.status) row.status = 'nieuw';
      if (!row.dossier_nummer) row.dossier_nummer = '2026-' + (row.id - 899900);
    }
    else {
      row.created_at = row.created_at || now;
      if (tbl === 'gezinnen' || tbl === 'leden') row.updated_at = now;
    }
    const norm = (typeof normalize !== 'undefined') ? normalize(tbl, row) : row;
    (Cloud.cache[tbl] = Cloud.cache[tbl] || []).push(norm);
    return Promise.resolve(norm);
  },
  update(tbl, id, patch) {
    const rows = Cloud.cache[tbl] || [];
    const i = rows.findIndex(x => x.id === id);
    if (i < 0) return Promise.resolve(null);
    const merged = Object.assign({}, rows[i], patch);
    if (tbl === 'dossiers' || tbl === 'gezinnen' || tbl === 'leden') merged.updated_at = new Date().toISOString();
    const norm = (typeof normalize !== 'undefined') ? normalize(tbl, merged) : merged;
    rows[i] = norm;
    return Promise.resolve(norm);
  },
  remove(tbl, id) {
    Cloud.cache[tbl] = (Cloud.cache[tbl] || []).filter(x => x.id !== id);
    return Promise.resolve();
  },
  removeWhere(tbl, fn) {
    Cloud.cache[tbl] = (Cloud.cache[tbl] || []).filter(x => !fn(x));
    return Promise.resolve();
  },
};
