// Constanten + catalogi gebaseerd op intake-template St. Ephrem de Syriër Klooster
// en Unigra-tarievenlijst.

const PAROCHIES = [];

// Vaste tarieven uit het intake-formulier
// Categorieën voor kostenposten — volgorde + nette labels worden gebruikt
// in het kosten-overzicht (gegroepeerd per categorie) en in de invul-dropdown.
const KOSTEN_CATEGORIEEN = [
  { id: 'aannametarief', label: 'Aanname & uitvoering', icon: '📋' },
  { id: 'vervoer',       label: 'Vervoer',              icon: '🚐' },
  { id: 'verzorging',    label: 'Verzorging',           icon: '🧴' },
  { id: 'kist',          label: 'Kist',                 icon: '⚰️' },
  { id: 'aula',          label: 'Aula',                 icon: '🏛️' },
  { id: 'rouwkaarten',   label: 'Rouwkaarten',          icon: '✉️' },
  { id: 'schoonmaak',    label: 'Schoonmaak',           icon: '🧹' },
  { id: 'administratie', label: 'Administratie',        icon: '📝' },
  { id: 'overig',        label: 'Overig',               icon: '•'   },
];
function categorieLabel(id) {
  const c = KOSTEN_CATEGORIEEN.find(x => x.id === id);
  return c ? c.label : (id ? (id.charAt(0).toUpperCase() + id.slice(1)) : 'Overig');
}
function categorieIcon(id) {
  const c = KOSTEN_CATEGORIEEN.find(x => x.id === id);
  return c ? c.icon : '•';
}

// Volgorde komt 1-op-1 overeen met de gewenste volgorde van de
// gebruiker. Items met een 'nav'-veld zijn navigatie-tegels die in de
// wizard naar een andere pagina linken (Kisten/Bloemen) of het formulier
// voor 'eigen invoer' openen ('extra').
const KOSTEN_PRESETS = [
  { categorie: 'aannametarief', omschrijving: 'Benodigd personeel en uitvoering',                bedrag: 622.00 },
  { categorie: 'vervoer',       omschrijving: 'Kosten ziekenhuismortuarium (Almelo / Enschede)', bedrag: 146.00 },
  { categorie: 'vervoer',       omschrijving: 'Transport overledene (0–40 km vanaf Oldenzaal)',  bedrag: 231.00 },
  { nav: 'kist',     categorie: 'kist',          omschrijving: '🪦 Kist — kies in catalogus',     bedrag: null   },
  { categorie: 'aula',          omschrijving: 'Gebruik aula 3 dagen',                            bedrag: 446.00 },
  { categorie: 'verzorging',    omschrijving: 'Verzorging & Inkisten',                           bedrag: 174.00 },
  { categorie: 'administratie', omschrijving: 'Akte van Overlijden',                             bedrag:  17.80 },
  { nav: 'extra',    categorie: 'overig',        omschrijving: '＋ Extra uitgave (zelf invullen)', bedrag: null },
];

// Beheermodus-overrides: prijzen + verberg-vlag worden in Settings
// opgeslagen. Helpers passen ze toe op de "view" van de catalogus
// zonder de constante zelf te muteren — zo blijven de fabrieksprijzen
// bewaard en kan een gebruiker eenvoudig terugzetten.
function effectieveKostenPresets({ includeHidden = false } = {}) {
  const ov = (typeof Settings !== 'undefined' && Settings.get('kosten_overrides')) || {};
  const extra = (typeof Settings !== 'undefined' && Array.isArray(Settings.get('kosten_extra')))
    ? Settings.get('kosten_extra') : [];
  const base = KOSTEN_PRESETS
    .filter(p => p.nav || includeHidden || !(ov[p.omschrijving] && ov[p.omschrijving].hidden))
    .map(p => {
      if (p.nav) return p;
      const o = ov[p.omschrijving];
      if (!o) return p;
      const out = Object.assign({}, p);
      if (o.bedrag != null) { out.bedrag = Number(o.bedrag); out._customBedrag = true; }
      if (o.hidden) out._hidden = true;
      return out;
    });
  // Beheerder-aangemaakte kostenposten toevoegen na de standaardlijst.
  const eigen = extra
    .filter(p => p && p.omschrijving)
    .filter(p => includeHidden || !(ov[p.omschrijving] && ov[p.omschrijving].hidden))
    .map(p => {
      const out = { omschrijving: p.omschrijving, categorie: p.categorie || 'overig', bedrag: p.bedrag != null ? Number(p.bedrag) : null, _custom: true };
      const o = ov[p.omschrijving];
      if (o) {
        if (o.bedrag != null) { out.bedrag = Number(o.bedrag); out._customBedrag = true; }
        if (o.hidden) out._hidden = true;
      }
      return out;
    });
  const insertIdx = base.findIndex(p => p.nav === 'extra');
  if (insertIdx >= 0) return [...base.slice(0, insertIdx), ...eigen, ...base.slice(insertIdx)];
  return [...base, ...eigen];
}
function effectieveKistenCatalogus({ includeHidden = false } = {}) {
  const ov = (typeof Settings !== 'undefined' && Settings.get('kisten_overrides')) || {};
  return KISTEN_CATALOGUS
    .filter(k => includeHidden || !(ov[k.naam] && ov[k.naam].hidden))
    .map(k => {
      const o = ov[k.naam];
      if (!o) return k;
      const out = Object.assign({}, k);
      if (o.bedrag != null) { out.bedrag = Number(o.bedrag); out._customBedrag = true; }
      if (o.hidden) out._hidden = true;
      return out;
    });
}
function vindKist(naam) {
  // Lookup-by-naam met override toegepast (ook voor verborgen kisten —
  // zodat oude dossiers nog correct hun kist-prijs vertonen).
  const ov = (typeof Settings !== 'undefined' && Settings.get('kisten_overrides')) || {};
  const k = KISTEN_CATALOGUS.find(x => x.naam === naam);
  if (!k) return null;
  const o = ov[naam];
  if (!o || o.bedrag == null) return k;
  return Object.assign({}, k, { bedrag: Number(o.bedrag), _customBedrag: true });
}

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

// Velden die we als 'aangeraden in te vullen' beschouwen — bij opslaan
// zonder deze waardes verschijnt een waarschuwingspop-up.
// Niets is verplicht in het dossier — leeg laten betekent geen
// "ontbrekende gegevens"-waarschuwing bij opslaan.
const AANBEVOLEN_VELDEN = [];

const DOSSIER_VELDEN = [
  'dossier_nummer',
  'opdrachtgever_naam',
  'voornaam','achternaam','geslacht','geboortedatum','geboorteplaats',
  'overlijdensdatum','overlijdensplaats',
  'adres_overledene','postcode_overledene','woonplaats_overledene',
  'bezit_oorbellen','bezit_oorbellen_aantal','bezit_oorbellen_foto',
  'bezit_ringen','bezit_ringen_aantal','bezit_ringen_foto',
  'bezit_armbanden','bezit_armbanden_aantal','bezit_armbanden_foto',
  'bezit_ketting','bezit_ketting_aantal','bezit_ketting_foto',
  'bezit_bril','bezit_bril_aantal','bezit_bril_foto',
  'bezit_horloge','bezit_horloge_aantal','bezit_horloge_foto',
  'artsverklaring_pad','overdraagformulier_pad',
  'opbaring_type',
  'opbaring_bed','opbaring_kist',
  'ophalen_datum','ophalen_tijd',
  'thuis_opbaren_datum','thuis_opbaren_tijd',
  'thuis_opbaren_einddatum','thuis_opbaren_eindtijd','benodigde_rouwgoederen',
  'opbaarlocatie_type',
  'verzorgd_gekleed_datum','verzorgd_gekleed_waar','verzorgd_gekleed_familie',
  'gekist_datum','gekist_waar',
  'mond_gehecht','oogkapjes',
  'peacemaker_verwijderd','peacemaker_verwijderd_datum',
  'thanatopraxie','thanatopraxie_datum','thanatopraxie_waar',
  'buikpunctie',
  'kist_type','rouwauto',
  'aanbetaling_bedrag','aanbetaling_datum',
  'eindafrekening_bedrag','eindafrekening_status',
  'bijzonderheden','status'
];
