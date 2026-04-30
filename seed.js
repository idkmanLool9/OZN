const bcrypt = require('bcryptjs');
const db = require('./db');

const username = process.env.SEED_USER || 'beheerder';
const password = process.env.SEED_PASS || 'uitvaart2025';
const fullName = process.env.SEED_NAME || 'Uitvaartleider';

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
  console.log(`Gebruiker '${username}' bestaat al (id ${existing.id}). Niets gewijzigd.`);
  process.exit(0);
}

const hash = bcrypt.hashSync(password, 10);
db.prepare(
  'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
).run(username, hash, fullName, 'beheerder');

console.log('Beheerder aangemaakt:');
console.log(`  Gebruikersnaam: ${username}`);
console.log(`  Wachtwoord:     ${password}`);
console.log('Wijzig dit direct na de eerste login.');
