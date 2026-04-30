const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const DOSSIER_VELDEN = [
  'voornaam','achternaam','geslacht','geboortedatum','geboorteplaats',
  'overlijdensdatum','overlijdenstijd','overlijdensplaats',
  'adres_overledene','postcode_overledene','woonplaats_overledene',
  'bsn','burgerlijke_staat','nationaliteit','beroep','doopnaam','syrisch_orthodox_lid',
  'contact_naam','contact_relatie','contact_telefoon','contact_email',
  'contact_adres','contact_postcode','contact_woonplaats',
  'parochie','priester','huisbezoek_datum','huisbezoek_tijd',
  'avondwake_datum','avondwake_tijd','avondwake_locatie',
  'uitvaart_type','uitvaart_datum','uitvaart_tijd','kerk_locatie',
  'begraafplaats','graf_nummer','graf_type',
  'kist_type','rouwauto','aantal_volgauto','dragers','bloemstukken',
  'rouwkaarten_aantal','condoleance_locatie','catering','muziek_zang',
  'verzekering_maatschappij','polisnummer','opdrachtgever_naam','opdrachtgever_telefoon',
  'bijzonderheden','status'
];

const STANDAARD_TAKEN = [
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
  'Muziek / zang afstemmen met koor',
  'Aangifte bij Burgerzaken',
  'Verzekering aanmelden',
  'Eindafrekening opstellen',
];

function nextDossierNummer() {
  const jaar = new Date().getFullYear();
  const row = db
    .prepare(
      "SELECT dossier_nummer FROM dossiers WHERE dossier_nummer LIKE ? ORDER BY id DESC LIMIT 1"
    )
    .get(`SOK-${jaar}-%`);
  let volgnr = 1;
  if (row) {
    const m = row.dossier_nummer.match(/-(\d+)$/);
    if (m) volgnr = parseInt(m[1], 10) + 1;
  }
  return `SOK-${jaar}-${String(volgnr).padStart(4, '0')}`;
}

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const status = (req.query.status || '').trim();
  let sql = 'SELECT * FROM dossiers WHERE 1=1';
  const params = [];
  if (q) {
    sql +=
      ' AND (voornaam LIKE ? OR achternaam LIKE ? OR dossier_nummer LIKE ? OR contact_naam LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY datetime(updated_at) DESC';
  const dossiers = db.prepare(sql).all(...params);

  const stats = {
    totaal: db.prepare('SELECT COUNT(*) AS c FROM dossiers').get().c,
    nieuw: db
      .prepare("SELECT COUNT(*) AS c FROM dossiers WHERE status = 'nieuw'")
      .get().c,
    in_behandeling: db
      .prepare("SELECT COUNT(*) AS c FROM dossiers WHERE status = 'in_behandeling'")
      .get().c,
    voltooid: db
      .prepare("SELECT COUNT(*) AS c FROM dossiers WHERE status = 'voltooid'")
      .get().c,
  };

  res.render('dossier_list', { dossiers, q, status, stats });
});

router.get('/nieuw', (req, res) => {
  res.render('dossier_form', {
    dossier: { dossier_nummer: nextDossierNummer(), status: 'nieuw' },
    isNew: true,
  });
});

router.post('/nieuw', (req, res) => {
  const data = {};
  for (const v of DOSSIER_VELDEN) data[v] = (req.body[v] || '').trim();
  if (!data.status) data.status = 'nieuw';

  const dossier_nummer = nextDossierNummer();
  const cols = ['dossier_nummer', 'created_by', ...DOSSIER_VELDEN];
  const placeholders = cols.map(() => '?').join(', ');
  const values = [dossier_nummer, req.session.userId, ...DOSSIER_VELDEN.map(v => data[v])];

  const info = db
    .prepare(`INSERT INTO dossiers (${cols.join(', ')}) VALUES (${placeholders})`)
    .run(...values);

  const insertTaak = db.prepare(
    'INSERT INTO taken (dossier_id, omschrijving, volgorde) VALUES (?, ?, ?)'
  );
  STANDAARD_TAKEN.forEach((t, i) => insertTaak.run(info.lastInsertRowid, t, i));

  res.redirect(`/dossiers/${info.lastInsertRowid}`);
});

router.get('/:id', (req, res) => {
  const dossier = db
    .prepare('SELECT * FROM dossiers WHERE id = ?')
    .get(req.params.id);
  if (!dossier) return res.status(404).render('404');
  const taken = db
    .prepare('SELECT * FROM taken WHERE dossier_id = ? ORDER BY volgorde, id')
    .all(dossier.id);
  const kosten = db
    .prepare('SELECT * FROM kosten WHERE dossier_id = ? ORDER BY id')
    .all(dossier.id);
  const documenten = db
    .prepare('SELECT * FROM documenten WHERE dossier_id = ? ORDER BY id DESC')
    .all(dossier.id);
  const notities = db
    .prepare(
      `SELECT n.*, u.full_name AS auteur_naam
       FROM notities n LEFT JOIN users u ON u.id = n.auteur_id
       WHERE n.dossier_id = ? ORDER BY datetime(n.created_at) DESC`
    )
    .all(dossier.id);

  const totaalKosten = kosten.reduce((s, k) => s + (k.bedrag || 0), 0);
  const betaaldKosten = kosten
    .filter(k => k.betaald)
    .reduce((s, k) => s + (k.bedrag || 0), 0);

  res.render('dossier_detail', {
    dossier,
    taken,
    kosten,
    documenten,
    notities,
    totaalKosten,
    betaaldKosten,
  });
});

router.get('/:id/bewerken', (req, res) => {
  const dossier = db
    .prepare('SELECT * FROM dossiers WHERE id = ?')
    .get(req.params.id);
  if (!dossier) return res.status(404).render('404');
  res.render('dossier_form', { dossier, isNew: false });
});

router.post('/:id/bewerken', (req, res) => {
  const dossier = db
    .prepare('SELECT id FROM dossiers WHERE id = ?')
    .get(req.params.id);
  if (!dossier) return res.status(404).render('404');

  const sets = DOSSIER_VELDEN.map(v => `${v} = ?`).join(', ');
  const values = DOSSIER_VELDEN.map(v => (req.body[v] || '').trim());
  values.push(req.params.id);
  db.prepare(
    `UPDATE dossiers SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).run(...values);
  res.redirect(`/dossiers/${req.params.id}`);
});

router.post('/:id/verwijderen', (req, res) => {
  const documenten = db
    .prepare('SELECT bestand FROM documenten WHERE dossier_id = ?')
    .all(req.params.id);
  for (const d of documenten) {
    const p = path.join(uploadDir, d.bestand);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  }
  db.prepare('DELETE FROM dossiers WHERE id = ?').run(req.params.id);
  res.redirect('/dossiers');
});

router.get('/:id/print', (req, res) => {
  const dossier = db
    .prepare('SELECT * FROM dossiers WHERE id = ?')
    .get(req.params.id);
  if (!dossier) return res.status(404).render('404');
  const taken = db
    .prepare('SELECT * FROM taken WHERE dossier_id = ? ORDER BY volgorde, id')
    .all(dossier.id);
  const kosten = db
    .prepare('SELECT * FROM kosten WHERE dossier_id = ? ORDER BY id')
    .all(dossier.id);
  const totaalKosten = kosten.reduce((s, k) => s + (k.bedrag || 0), 0);
  res.render('dossier_print', { dossier, taken, kosten, totaalKosten });
});

// Taken
router.post('/:id/taken', (req, res) => {
  const omschrijving = (req.body.omschrijving || '').trim();
  if (!omschrijving) return res.redirect(`/dossiers/${req.params.id}#taken`);
  const max = db
    .prepare('SELECT COALESCE(MAX(volgorde), 0) AS m FROM taken WHERE dossier_id = ?')
    .get(req.params.id).m;
  db.prepare(
    'INSERT INTO taken (dossier_id, omschrijving, deadline, volgorde) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, omschrijving, req.body.deadline || null, max + 1);
  res.redirect(`/dossiers/${req.params.id}#taken`);
});

router.post('/:id/taken/:taakId/toggle', (req, res) => {
  const taak = db
    .prepare('SELECT * FROM taken WHERE id = ? AND dossier_id = ?')
    .get(req.params.taakId, req.params.id);
  if (!taak) return res.redirect(`/dossiers/${req.params.id}#taken`);
  const nieuweStatus = taak.voltooid ? 0 : 1;
  db.prepare(
    "UPDATE taken SET voltooid = ?, voltooid_op = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ?"
  ).run(nieuweStatus, nieuweStatus, taak.id);
  res.redirect(`/dossiers/${req.params.id}#taken`);
});

router.post('/:id/taken/:taakId/verwijderen', (req, res) => {
  db.prepare('DELETE FROM taken WHERE id = ? AND dossier_id = ?').run(
    req.params.taakId,
    req.params.id
  );
  res.redirect(`/dossiers/${req.params.id}#taken`);
});

// Kosten
router.post('/:id/kosten', (req, res) => {
  const omschrijving = (req.body.omschrijving || '').trim();
  const bedrag = parseFloat((req.body.bedrag || '0').replace(',', '.')) || 0;
  if (!omschrijving) return res.redirect(`/dossiers/${req.params.id}#kosten`);
  db.prepare(
    'INSERT INTO kosten (dossier_id, omschrijving, categorie, bedrag, betaald) VALUES (?, ?, ?, ?, ?)'
  ).run(
    req.params.id,
    omschrijving,
    req.body.categorie || null,
    bedrag,
    req.body.betaald ? 1 : 0
  );
  res.redirect(`/dossiers/${req.params.id}#kosten`);
});

router.post('/:id/kosten/:kostenId/toggle', (req, res) => {
  const k = db
    .prepare('SELECT * FROM kosten WHERE id = ? AND dossier_id = ?')
    .get(req.params.kostenId, req.params.id);
  if (!k) return res.redirect(`/dossiers/${req.params.id}#kosten`);
  db.prepare('UPDATE kosten SET betaald = ? WHERE id = ?').run(
    k.betaald ? 0 : 1,
    k.id
  );
  res.redirect(`/dossiers/${req.params.id}#kosten`);
});

router.post('/:id/kosten/:kostenId/verwijderen', (req, res) => {
  db.prepare('DELETE FROM kosten WHERE id = ? AND dossier_id = ?').run(
    req.params.kostenId,
    req.params.id
  );
  res.redirect(`/dossiers/${req.params.id}#kosten`);
});

// Documenten
router.post('/:id/documenten', upload.single('bestand'), (req, res) => {
  if (!req.file) return res.redirect(`/dossiers/${req.params.id}#documenten`);
  db.prepare(
    'INSERT INTO documenten (dossier_id, naam, type, bestand, grootte) VALUES (?, ?, ?, ?, ?)'
  ).run(
    req.params.id,
    (req.body.naam || req.file.originalname).trim(),
    req.body.type || null,
    req.file.filename,
    req.file.size
  );
  res.redirect(`/dossiers/${req.params.id}#documenten`);
});

router.get('/:id/documenten/:docId/download', (req, res) => {
  const doc = db
    .prepare('SELECT * FROM documenten WHERE id = ? AND dossier_id = ?')
    .get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).send('Niet gevonden');
  res.download(path.join(uploadDir, doc.bestand), doc.naam);
});

router.post('/:id/documenten/:docId/verwijderen', (req, res) => {
  const doc = db
    .prepare('SELECT * FROM documenten WHERE id = ? AND dossier_id = ?')
    .get(req.params.docId, req.params.id);
  if (doc) {
    const p = path.join(uploadDir, doc.bestand);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
    db.prepare('DELETE FROM documenten WHERE id = ?').run(doc.id);
  }
  res.redirect(`/dossiers/${req.params.id}#documenten`);
});

// Notities
router.post('/:id/notities', (req, res) => {
  const tekst = (req.body.tekst || '').trim();
  if (!tekst) return res.redirect(`/dossiers/${req.params.id}#notities`);
  db.prepare(
    'INSERT INTO notities (dossier_id, tekst, auteur_id) VALUES (?, ?, ?)'
  ).run(req.params.id, tekst, req.session.userId);
  res.redirect(`/dossiers/${req.params.id}#notities`);
});

router.post('/:id/notities/:notitieId/verwijderen', (req, res) => {
  db.prepare('DELETE FROM notities WHERE id = ? AND dossier_id = ?').run(
    req.params.notitieId,
    req.params.id
  );
  res.redirect(`/dossiers/${req.params.id}#notities`);
});

module.exports = router;
