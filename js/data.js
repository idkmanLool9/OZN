// Constanten + catalogi gebaseerd op intake-template St. Ephrem de Syriër Klooster
// en Unigra-tarievenlijst.

const PAROCHIES = [
  'St. Ephrem de Syriër Klooster — Glane/Losser',
  'Mor Ephrem — Glanerbrug',
  'Mor Severios — Hengelo',
  'Mor Kuryakos — Enschede',
  'Mor Aday — Rijssen',
  'Sint Maria — Amsterdam',
  'Mor Gabriël — Holland',
];

// Vaste tarieven uit het intake-formulier
const KOSTEN_PRESETS = [
  { categorie: 'aannametarief', omschrijving: 'Aannametarief — benodigd personeel en uitvoering', bedrag: 622.00 },
  { categorie: 'vervoer',       omschrijving: 'Ziekenhuismortuarium (Almelo / Enschede)',           bedrag: 146.00 },
  { categorie: 'vervoer',       omschrijving: 'Overbrengen overledene (0–40 km vanaf Oldenzaal)',   bedrag: 231.00 },
  { categorie: 'vervoer',       omschrijving: 'Rouwauto op de dag van de uitvaart',                  bedrag: 242.00 },
  { categorie: 'kist',          omschrijving: 'Basismodel kist (incl. opbaardekentje)',              bedrag: 615.40 },
  { categorie: 'aula',          omschrijving: 'Gebruik aula 3 dagen',                                bedrag: 446.00 },
  { categorie: 'verzorging',    omschrijving: 'Verzorging door extern bedrijf',                      bedrag: 111.00 },
  { categorie: 'verzorging',    omschrijving: 'Inkisten',                                            bedrag:  63.00 },
  { categorie: 'kerk',          omschrijving: 'Gebruik Kerk en Dolabani Zaal',                       bedrag: 500.00 },
  { categorie: 'begraafplaats', omschrijving: 'Openen graf',                                         bedrag: 250.00 },
  { categorie: 'begraafplaats', omschrijving: 'Naamsteen',                                           bedrag: 295.00 },
  { categorie: 'begraafplaats', omschrijving: 'Onderhoudskosten',                                    bedrag: 600.00 },
];

// Unigra kistencatalogus (adviesprijzen per nov 2025)
const KISTEN_CATALOGUS = [
  { naam: 'Natuurkist',                 materiaal: 'Massief populieren, natuur',  bedrag: 1054.00 },
  { naam: 'Natuurkist Wilgenteen',      materiaal: 'Massief populieren, natuur',  bedrag: 1255.50 },
  { naam: '8-10 HC8 Natuur',            materiaal: 'Massief populieren, natuur',  bedrag:  784.50 },
  { naam: '8-10 TC8 Natuur',            materiaal: 'Massief populieren, natuur',  bedrag:  838.00 },
  { naam: '1-70 HC8 Eco',               materiaal: 'Massief eiken, Eco',          bedrag: 1128.00 },
  { naam: '1-70 TC8 Eco',               materiaal: 'Massief eiken, Eco',          bedrag: 1214.00 },
  { naam: '8-10 HC8 Bloemenband',       materiaal: 'Massief populieren, natuur',  bedrag: 1025.00 },
  { naam: '8-10 HC8 Veldbloemen',       materiaal: 'Massief populieren, natuur',  bedrag: 1029.50 },
  { naam: '8-10 HC8 Rustiek',           materiaal: 'Massief populieren, rustiek', bedrag:  864.50 },
  { naam: 'Kleurplaatkist Aan de oever',materiaal: 'Massief populieren, natuur',  bedrag: 1349.50 },
  { naam: 'Kleurplaatkist Sterrenkijken met beren', materiaal: 'Massief populieren', bedrag: 1349.50 },
  { naam: 'Carino HBL2 (2x1) Eiken',    materiaal: 'Massief eiken',               bedrag: 1310.50 },
  { naam: 'Carino HBL2 (2x1) Natuur',   materiaal: 'Massief populieren, natuur',  bedrag: 1147.00 },
  { naam: 'Fiori',                      materiaal: 'Massief populieren, natuur',  bedrag: 1355.00 },
  { naam: '1-50 HBL2 (2x1) Hollands Hout', materiaal: 'Massief grenen',           bedrag: 1257.00 },
  { naam: 'Opbaarplank Hollands Hout',  materiaal: 'Massief grenen',              bedrag: 1017.50 },
  { naam: '1-70 HC8 Hollands Hout',     materiaal: 'Massief eiken',               bedrag: 1244.00 },
  { naam: 'WigRust',                    materiaal: 'Vuren',                       bedrag: 1148.00 },
  { naam: 'Linum Natuur TC8',           materiaal: 'Massief populieren, Eco',     bedrag: 1290.50 },
  { naam: 'GC Rotan Eco Rond',          materiaal: 'Rotan',                       bedrag: 1245.00 },
  { naam: 'GC Bamboe Eco Rond',         materiaal: 'Bamboe',                      bedrag: 1145.00 },
  { naam: 'GC Wilgenteen Cromer',       materiaal: 'Wilgenteen',                  bedrag: 1075.00 },
  { naam: 'UB07 Abaca',                 materiaal: 'Manillahennep',               bedrag: 1295.50 },
  { naam: 'Opbaarplank Abaca',          materiaal: 'Manillahennep',               bedrag:  956.50 },
  { naam: '1-97 HC8 Wild Eiken',        materiaal: 'Houtdecor, wild eiken',       bedrag:  715.50 },
  { naam: '1-90 HC8 Wild Eiken',        materiaal: 'Houtdecor, wild eiken',       bedrag:  579.00 },
  { naam: '1-97 HC8 Naturel',           materiaal: 'Houtdecor, naturel',          bedrag:  715.50 },
  { naam: '1-90 HC8 Naturel',           materiaal: 'Houtdecor, naturel',          bedrag:  579.00 },
  { naam: '1-97 HC8 Wit Wax',           materiaal: 'Houtdecor, wit wax',          bedrag:  715.50 },
  { naam: '1-90 HC8 Wit Wax',           materiaal: 'Houtdecor, wit wax',          bedrag:  579.00 },
  { naam: '1-97 HC8 Grijs Wax',         materiaal: 'Houtdecor, grijs wax',        bedrag:  715.50 },
  { naam: '1-90 HC8 Grijs Wax',         materiaal: 'Houtdecor, grijs wax',        bedrag:  579.00 },
  { naam: '1-20 WHC8',                  materiaal: 'Eikenprint, wit gelakt',      bedrag:  797.50 },
  { naam: '1-20 HC8 RAL',               materiaal: 'Ralkleur gelakt, zijdeglans', bedrag:  964.00 },
  { naam: '1-77 E S',                   materiaal: 'Massief eiken',               bedrag: 1445.00 },
  { naam: '1-70 E S',                   materiaal: 'Massief eiken',               bedrag: 1231.50 },
  { naam: '2-79 G S',                   materiaal: 'Massief eiken, geprofileerd', bedrag: 1615.00 },
  { naam: '2-79 G S Arti Zwart',        materiaal: 'Massief eiken, Arti zwart',   bedrag: 1967.00 },
  { naam: 'La Linea Wit',               materiaal: 'Wit gelakt, zijdeglans',      bedrag: 1895.50 },
  { naam: 'La Linea Zwart',             materiaal: 'Ralkleur gelakt, zijdeglans', bedrag: 1895.50 },
  { naam: 'T10 S',                      materiaal: 'Massief mahonie, geprofileerd', bedrag: 2349.50 },
  { naam: 'T10 S Wit',                  materiaal: 'Wit gelakt, zijdeglans',      bedrag: 2349.50 },
  { naam: 'Hudson',                     materiaal: 'Massief Hout',                bedrag: 4664.00 },
  { naam: 'Da Vinci',                   materiaal: 'Massief Hout',                bedrag: 4664.00 },
  { naam: 'Provincial',                 materiaal: 'Massief Hout',                bedrag: 4664.00 },
];

// Geef een kleur per kist-materiaal voor de preview-afbeelding
function kistKleur(materiaal) {
  const m = (materiaal || '').toLowerCase();
  if (m.includes('zwart') || m.includes('arti zwart')) return '#1f1c1a';
  if (m.includes('wit'))                                return '#ece6d6';
  if (m.includes('grijs'))                              return '#7d7872';
  if (m.includes('mahonie'))                            return '#5a2418';
  if (m.includes('rotan') || m.includes('bamboe') || m.includes('manilla') || m.includes('wilgen'))
                                                        return '#c8a268';
  if (m.includes('eiken') && m.includes('wild'))        return '#9a6a36';
  if (m.includes('eiken'))                              return '#7a4a20';
  if (m.includes('grenen') || m.includes('vuren'))      return '#d2a972';
  if (m.includes('populieren') || m.includes('eco'))    return '#dcc09a';
  if (m.includes('houtdecor'))                          return '#b88a55';
  return '#a07a4a';
}

// SVG-silhouet van een kist in de gegeven kleur (zes-zijdige top-down look)
function kistSVG(materiaal) {
  const k = kistKleur(materiaal);
  const m = (materiaal || '').toLowerCase();
  const grain = m.includes('wit') ? '#a99878' : (m.includes('zwart') ? '#3a3633' : '#00000022');
  const handle = m.includes('zwart') ? '#888' : (m.includes('wit') ? '#9a8a6a' : '#3a2a18');
  return `
    <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="kg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${k}" stop-opacity="1"/>
          <stop offset="1" stop-color="${k}" stop-opacity="0.78"/>
        </linearGradient>
        <pattern id="kgrain" patternUnits="userSpaceOnUse" width="6" height="60" patternTransform="rotate(0)">
          <rect width="6" height="60" fill="url(#kg)"/>
          <path d="M 0 12 Q 3 14 6 12 M 0 28 Q 3 30 6 28 M 0 44 Q 3 46 6 44" stroke="${grain}" stroke-width=".4" fill="none"/>
        </pattern>
      </defs>
      <!-- kist top-down met taps toelopende voetzijde -->
      <path d="M 30 35 L 95 25 L 145 25 L 210 35 L 210 95 L 145 105 L 95 105 L 30 95 Z"
            fill="url(#kgrain)" stroke="#1a120a" stroke-width="1.2"/>
      <!-- kistdeksel-rand -->
      <path d="M 30 35 L 95 25 L 145 25 L 210 35" fill="none" stroke="#00000033" stroke-width=".8"/>
      <!-- handvatten -->
      <rect x="60"  y="55" width="14" height="3" rx="1" fill="${handle}"/>
      <rect x="165" y="55" width="14" height="3" rx="1" fill="${handle}"/>
      <rect x="60"  y="74" width="14" height="3" rx="1" fill="${handle}"/>
      <rect x="165" y="74" width="14" height="3" rx="1" fill="${handle}"/>
      <!-- kruisje midden (subtiel) -->
      <g opacity=".25" fill="${handle}">
        <rect x="118" y="55" width="4" height="20" rx="1"/>
        <rect x="110" y="62" width="20" height="4" rx="1"/>
      </g>
    </svg>`;
}

const STANDAARD_TAKEN_GEMEEN = [
  'Familie informeren en intake afnemen',
  'Overlijdensakte opvragen bij gemeente',
  'Parochie en priester aanstellen',
  'Datum en tijd uitvaartdienst vastleggen',
  'Kerk reserveren en koster informeren',
  'Begraafplaats en graf reserveren',
  'Kist bestellen en ophalen',
  'Rouwvervoer regelen (rouwauto + volgauto\'s)',
  'Dragers regelen',
  'Rouwkaarten ontwerpen en versturen',
  'Bloemstukken bestellen',
  'Avondwake / huisbezoek inplannen',
  'Condoleance en catering organiseren',
  'Aangifte bij Burgerzaken',
];

const STANDAARD_TAKEN_MET_VERZEKERING = [
  ...STANDAARD_TAKEN_GEMEEN,
  'Polis controleren bij verzekeraar',
  'Declaratie / aanmelding indienen',
  'Akkoord en pakketinhoud bevestigen',
  'Meerprijs met familie afstemmen indien dekking onvoldoende',
];

const STANDAARD_TAKEN_ZONDER_VERZEKERING = [
  ...STANDAARD_TAKEN_GEMEEN,
  'Budget bespreken met familie',
  'Aanbetaling vragen vóór de uitvaart',
  'Eindfactuur opstellen',
  'Eindbetaling ontvangen / voldaan',
];

// Velden die we als 'aangeraden in te vullen' beschouwen — bij opslaan
// zonder deze waardes verschijnt een waarschuwingspop-up.
const AANBEVOLEN_VELDEN = [
  { name: 'voornaam',              label: 'Voornaam overledene' },
  { name: 'achternaam',            label: 'Achternaam overledene' },
  { name: 'geboortedatum',         label: 'Geboortedatum' },
  { name: 'overlijdensdatum',      label: 'Overlijdensdatum' },
  { name: 'adres_overledene',      label: 'Adres overledene' },
  { name: 'woonplaats_overledene', label: 'Woonplaats overledene' },
  { name: 'contact_naam',          label: 'Achternaam contactpersoon' },
  { name: 'contact_telefoon',      label: 'Telefoon contactpersoon' },
  { name: 'parochie',              label: 'Parochie' },
  { name: 'uitvaart_type',         label: 'Type uitvaart' },
  { name: 'uitvaart_datum',        label: 'Datum uitvaart' },
  { name: 'kerk_locatie',          label: 'Kerk / dienstlocatie' },
  { name: 'begraafplaats',         label: 'Begraafplaats' },
  { name: 'verzekering_status',    label: 'Verzekering ja/nee' },
];

// Backwards compat: oude lijst gebruikt voor onbekende status (pre-bestaande dossiers)
const STANDAARD_TAKEN = [
  ...STANDAARD_TAKEN_GEMEEN,
  'Verzekering / financiële afhandeling regelen',
  'Eindafrekening opstellen',
];

const DOSSIER_VELDEN = [
  'voornaam','achternaam','geslacht','geboortedatum','geboorteplaats',
  'overlijdensdatum','overlijdenstijd','overlijdensplaats',
  'adres_overledene','postcode_overledene','woonplaats_overledene',
  'bsn','nationaliteit','syrisch_orthodox_lid',
  'gezinsnummer','grafnummer',
  'partner_naam','kinderen_status','minderjarige_kinderen','kinderen_namen',
  'contact_naam','contact_voornaam','contact_relatie','contact_telefoon','contact_email',
  'contact_adres','contact_huisnummer','contact_postcode','contact_woonplaats',
  'contact_bsn','contact_geboortedatum',
  'parochie','priester','huisbezoek_datum','huisbezoek_tijd',
  'uitvaart_type','uitvaart_datum','uitvaart_tijd','kerk_locatie',
  'begraafplaats','graf_type',
  'kist_type','rouwauto','aantal_volgauto','dragers','bloemstukken',
  'rouwkaarten_aantal','condoleance_locatie','catering',
  'verzekering_status','verzekering_maatschappij','polisnummer',
  'verzekering_polishouder','verzekering_dekking','verzekering_pakket',
  'verzekering_aanmelding_status','verzekering_contact_naam','verzekering_contact_telefoon',
  'betaalwijze','aanbetaling_bedrag','aanbetaling_datum',
  'eindafrekening_bedrag','eindafrekening_status','betalingstermijn',
  'verantwoordelijke_persoon',
  'opdrachtgever_naam','opdrachtgever_telefoon',
  'bijzonderheden','status'
];
