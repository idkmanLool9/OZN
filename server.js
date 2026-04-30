const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const db = require('./db');
const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const dossierRoutes = require('./routes/dossiers');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
    secret: process.env.SESSION_SECRET || 'sok-uitvaart-geheim-wijzig-dit',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.use('/', authRoutes);
app.use('/dossiers', dossierRoutes);

app.get('/', requireAuth, (req, res) => {
  const stats = {
    totaal: db.prepare('SELECT COUNT(*) AS c FROM dossiers').get().c,
    nieuw: db.prepare("SELECT COUNT(*) AS c FROM dossiers WHERE status = 'nieuw'").get().c,
    in_behandeling: db
      .prepare("SELECT COUNT(*) AS c FROM dossiers WHERE status = 'in_behandeling'").get().c,
    voltooid: db.prepare("SELECT COUNT(*) AS c FROM dossiers WHERE status = 'voltooid'").get().c,
  };
  const recent = db
    .prepare("SELECT * FROM dossiers ORDER BY datetime(updated_at) DESC LIMIT 8")
    .all();
  const aankomend = db
    .prepare(
      `SELECT * FROM dossiers
       WHERE uitvaart_datum IS NOT NULL AND uitvaart_datum != ''
       AND date(uitvaart_datum) >= date('now')
       ORDER BY date(uitvaart_datum) ASC LIMIT 5`
    )
    .all();
  const openTaken = db
    .prepare(
      `SELECT t.*, d.dossier_nummer, d.voornaam, d.achternaam
       FROM taken t JOIN dossiers d ON d.id = t.dossier_id
       WHERE t.voltooid = 0 AND t.deadline IS NOT NULL AND t.deadline != ''
       ORDER BY date(t.deadline) ASC LIMIT 8`
    )
    .all();
  res.render('dashboard', { stats, recent, aankomend, openTaken });
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render('500', { error: err });
});

app.listen(PORT, () => {
  console.log(`Uitvaart-app draait op http://localhost:${PORT}`);
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    console.log('LET OP: nog geen gebruikers. Voer eerst `npm run seed` uit.');
  }
});
