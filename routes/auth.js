const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { redirectIfAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/login', redirectIfAuth, (req, res) => {
  res.render('login', { error: null, username: '' });
});

router.post('/login', redirectIfAuth, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).render('login', {
      error: 'Vul gebruikersnaam en wachtwoord in.',
      username: username || '',
    });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render('login', {
      error: 'Onjuiste gebruikersnaam of wachtwoord.',
      username,
    });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.fullName = user.full_name;
  req.session.role = user.role;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/account', requireAuth, (req, res) => {
  res.render('account', { error: null, success: null });
});

router.post('/account/wachtwoord', requireAuth, (req, res) => {
  const { huidig, nieuw, herhaal } = req.body;
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user || !bcrypt.compareSync(huidig || '', user.password_hash)) {
    return res
      .status(400)
      .render('account', { error: 'Huidig wachtwoord klopt niet.', success: null });
  }
  if (!nieuw || nieuw.length < 6) {
    return res.status(400).render('account', {
      error: 'Nieuw wachtwoord moet minstens 6 tekens zijn.',
      success: null,
    });
  }
  if (nieuw !== herhaal) {
    return res
      .status(400)
      .render('account', { error: 'Wachtwoorden komen niet overeen.', success: null });
  }
  const hash = bcrypt.hashSync(nieuw, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hash,
    user.id
  );
  res.render('account', { error: null, success: 'Wachtwoord gewijzigd.' });
});

module.exports = router;
