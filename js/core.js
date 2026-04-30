// Core: localStorage DB, auth, helpers, hash router

const KEYS = {
  USERS: 'sok_users',
  SESSION: 'sok_session',
  DOSSIERS: 'sok_dossiers',
  TAKEN: 'sok_taken',
  KOSTEN: 'sok_kosten',
  NOTITIES: 'sok_notities',
  COUNTER: 'sok_dossier_counter',
};

const DB = {
  get(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  list(key) { return DB.get(key, []); },
  insert(key, item) {
    const arr = DB.list(key);
    item.id = (arr.reduce((m, x) => Math.max(m, x.id || 0), 0)) + 1;
    item.created_at = item.created_at || new Date().toISOString();
    arr.push(item); DB.set(key, arr); return item;
  },
  update(key, id, patch) {
    const arr = DB.list(key);
    const i = arr.findIndex(x => x.id === id);
    if (i < 0) return null;
    arr[i] = Object.assign({}, arr[i], patch, { updated_at: new Date().toISOString() });
    DB.set(key, arr); return arr[i];
  },
  remove(key, id) {
    DB.set(key, DB.list(key).filter(x => x.id !== id));
  },
  removeWhere(key, fn) {
    DB.set(key, DB.list(key).filter(x => !fn(x)));
  },
  byId(key, id) { return DB.list(key).find(x => x.id === id); },
  where(key, fn) { return DB.list(key).filter(fn); },
};

// Auth — SHA-256 met salt; client-side, gegevens blijven lokaal
const Auth = {
  async sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  async hashPw(username, password) {
    return Auth.sha256(`sok-uitvaart::${username.toLowerCase()}::${password}`);
  },
  async ensureDefaultUser() {
    const users = DB.get(KEYS.USERS, null);
    if (users && Object.keys(users).length > 0) return false;
    const hash = await Auth.hashPw('beheerder', 'uitvaart2025');
    DB.set(KEYS.USERS, { beheerder: { hash, fullName: 'Uitvaartleider', role: 'beheerder' } });
    return true;
  },
  async login(username, password) {
    const users = DB.get(KEYS.USERS, {});
    const u = users[username.trim().toLowerCase()];
    if (!u) return false;
    const hash = await Auth.hashPw(username.trim().toLowerCase(), password);
    if (hash !== u.hash) return false;
    DB.set(KEYS.SESSION, { username: username.trim().toLowerCase(), fullName: u.fullName, role: u.role, loginAt: Date.now() });
    return true;
  },
  logout() { localStorage.removeItem(KEYS.SESSION); },
  current() {
    const s = DB.get(KEYS.SESSION, null);
    if (!s) return null;
    if (Date.now() - (s.loginAt || 0) > 1000 * 60 * 60 * 12) { Auth.logout(); return null; }
    return s;
  },
  async changePassword(username, oldPw, newPw) {
    const users = DB.get(KEYS.USERS, {});
    const u = users[username];
    if (!u) return 'Gebruiker niet gevonden.';
    if ((await Auth.hashPw(username, oldPw)) !== u.hash) return 'Huidig wachtwoord klopt niet.';
    if (!newPw || newPw.length < 6) return 'Nieuw wachtwoord moet minstens 6 tekens zijn.';
    u.hash = await Auth.hashPw(username, newPw);
    users[username] = u;
    DB.set(KEYS.USERS, users);
    return null;
  },
};

// Helpers
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] === true) e.setAttribute(k, '');
    else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
  }
  if (children != null) {
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return e;
}

function esc(v) { return v == null ? '' : String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmt(v) { return v && String(v).trim() ? v : '—'; }
function fmtEUR(n) { return '€ ' + (Number(n) || 0).toFixed(2).replace('.', ','); }
function parseEUR(s) { return parseFloat(String(s || '').replace(/[€\s.]/g, '').replace(',', '.')) || 0; }
function fmtDate(iso) {
  if (!iso) return '';
  if (iso.length === 10) return iso.split('-').reverse().join('-');
  const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('nl-NL');
}
function fullName(d) { return [d.voornaam, d.achternaam].filter(Boolean).join(' '); }

function nextDossierNummer() {
  const jaar = new Date().getFullYear();
  const counters = DB.get(KEYS.COUNTER, {});
  counters[jaar] = (counters[jaar] || 0) + 1;
  DB.set(KEYS.COUNTER, counters);
  return `SOK-${jaar}-${String(counters[jaar]).padStart(4, '0')}`;
}

// Hash router
const Router = {
  routes: [],
  add(pattern, handler) {
    const keys = [];
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
    Router.routes.push({ regex, keys, handler });
  },
  go(path) { location.hash = '#' + path; },
  start() {
    window.addEventListener('hashchange', Router.handle);
    Router.handle();
  },
  handle() {
    const path = (location.hash || '#/').slice(1) || '/';
    if (!Auth.current()) { showLogin(); return; }
    showApp();
    for (const r of Router.routes) {
      const m = path.match(r.regex);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
        r.handler(params, path);
        $$('#topnav a').forEach(a => {
          const route = a.getAttribute('data-route');
          a.classList.toggle('active', path === route || (route !== '/' && path.startsWith(route) && route !== '/dossiers/nieuw') || path === route);
        });
        if (path === '/dossiers/nieuw') {
          $$('#topnav a').forEach(a => a.classList.toggle('active', a.getAttribute('data-route') === '/dossiers/nieuw'));
        }
        window.scrollTo(0, 0);
        return;
      }
    }
    render404();
  },
};

function showLogin() { $('#login-screen').hidden = false; $('#app').hidden = true; }
function showApp() {
  $('#login-screen').hidden = true; $('#app').hidden = false;
  const s = Auth.current(); if (s) $('#user-name').textContent = s.fullName || s.username;
}
