const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'beheerder',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dossiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_nummer TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'nieuw',

  -- Overledene
  voornaam TEXT,
  achternaam TEXT,
  geslacht TEXT,
  geboortedatum TEXT,
  geboorteplaats TEXT,
  overlijdensdatum TEXT,
  overlijdenstijd TEXT,
  overlijdensplaats TEXT,
  adres_overledene TEXT,
  postcode_overledene TEXT,
  woonplaats_overledene TEXT,
  bsn TEXT,
  burgerlijke_staat TEXT,
  nationaliteit TEXT,
  beroep TEXT,
  doopnaam TEXT,
  syrisch_orthodox_lid TEXT,

  -- Aangever / contactpersoon
  contact_naam TEXT,
  contact_relatie TEXT,
  contact_telefoon TEXT,
  contact_email TEXT,
  contact_adres TEXT,
  contact_postcode TEXT,
  contact_woonplaats TEXT,

  -- Kerkelijk
  parochie TEXT,
  priester TEXT,
  huisbezoek_datum TEXT,
  huisbezoek_tijd TEXT,
  avondwake_datum TEXT,
  avondwake_tijd TEXT,
  avondwake_locatie TEXT,

  -- Uitvaartdienst
  uitvaart_type TEXT,
  uitvaart_datum TEXT,
  uitvaart_tijd TEXT,
  kerk_locatie TEXT,
  begraafplaats TEXT,
  graf_nummer TEXT,
  graf_type TEXT,

  -- Logistiek
  kist_type TEXT,
  rouwauto TEXT,
  aantal_volgauto TEXT,
  dragers TEXT,
  bloemstukken TEXT,
  rouwkaarten_aantal TEXT,
  condoleance_locatie TEXT,
  catering TEXT,
  muziek_zang TEXT,

  -- Verzekering / opdrachtgever
  verzekering_maatschappij TEXT,
  polisnummer TEXT,
  opdrachtgever_naam TEXT,
  opdrachtgever_telefoon TEXT,

  -- Bijzonderheden
  bijzonderheden TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS taken (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  omschrijving TEXT NOT NULL,
  deadline TEXT,
  voltooid INTEGER DEFAULT 0,
  voltooid_op TEXT,
  volgorde INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kosten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  omschrijving TEXT NOT NULL,
  categorie TEXT,
  bedrag REAL DEFAULT 0,
  betaald INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documenten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  naam TEXT NOT NULL,
  type TEXT,
  bestand TEXT NOT NULL,
  grootte INTEGER,
  geupload_op TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  tekst TEXT NOT NULL,
  auteur_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
