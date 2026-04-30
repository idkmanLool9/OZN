// Helpers + hash-router
// (DB en Auth staan in supabase-client.js)

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function esc(v) {
  return v == null ? '' : String(v).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmt(v) { return v && String(v).trim() ? v : '—'; }
function fmtEUR(n) { return '€ ' + (Number(n) || 0).toFixed(2).replace('.', ','); }
function parseEUR(s) { return parseFloat(String(s || '').replace(/[€\s.]/g, '').replace(',', '.')) || 0; }
function fmtDate(iso) {
  if (!iso) return '';
  if (typeof iso === 'string' && iso.length === 10) return iso.split('-').reverse().join('-');
  const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('nl-NL');
}
function fullName(d) { return [d.voornaam, d.achternaam].filter(Boolean).join(' '); }

// Foto-compressie vóór upload: verkleint grote afbeeldingen naar maxDim px
// (langste zijde) en re-encodet als JPEG met quality (0..1). SVG, GIF en kleine
// bestanden worden ongemoeid gelaten. Bespaart fors op Supabase Storage.
async function compressImage(file, maxDim = 1600, quality = 0.85) {
  if (!file || !file.type) return file;
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  if (file.size < 200 * 1024) return file; // al klein genoeg

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
    if (ratio >= 1 && file.size < 800 * 1024) return file; // al klein
    const w = Math.round(img.width  * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // compressie maakte het groter
    return new File([blob], file.name.replace(/\.[a-zA-Z0-9]+$/, '.jpg'), { type: 'image/jpeg' });
  } catch (_) {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Modal-pop-up (vervangt browser-alert) ─────────────────────────────────
const Modal = {
  _busy: false,
  _queue: [],
  show(opts) {
    if (Modal._busy) {
      // Volgende boodschap pas tonen na huidige
      Modal._queue.push(opts);
      return Promise.resolve();
    }
    return Modal._present(opts);
  },
  _present(opts) {
    const { type = 'info', title = '', message = '', confirmText = 'Begrepen' } = opts || {};
    const m = document.getElementById('modal');
    if (!m) { alert((title ? title + ': ' : '') + message); return Promise.resolve(); }
    Modal._busy = true;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    const btn = document.getElementById('modal-confirm');
    btn.textContent = confirmText;
    document.getElementById('modal-icon').innerHTML = Modal._iconFor(type);
    m.className = 'modal modal-' + type;
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('shown'));
    setTimeout(() => btn.focus(), 60);

    return new Promise(resolve => {
      const dismiss = () => {
        m.classList.remove('shown');
        m.classList.add('fading');
        btn.removeEventListener('click', dismiss);
        document.removeEventListener('keydown', keyHandler);
        backdrop && backdrop.removeEventListener('click', dismiss);
        setTimeout(() => {
          m.hidden = true;
          m.classList.remove('fading');
          Modal._busy = false;
          resolve();
          // Volgende uit queue
          if (Modal._queue.length) {
            const next = Modal._queue.shift();
            setTimeout(() => Modal._present(next), 60);
          }
        }, 280);
      };
      const keyHandler = e => {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); dismiss(); }
      };
      btn.addEventListener('click', dismiss);
      document.addEventListener('keydown', keyHandler);
      const backdrop = m.querySelector('.modal-backdrop');
      if (backdrop) backdrop.addEventListener('click', dismiss);
    });
  },
  _iconFor(type) {
    if (type === 'offline' || type === 'warning') {
      return `<svg viewBox="0 0 64 64" width="42" height="42" aria-hidden="true">
        <path d="M32 50 L36 54 L32 58 L28 54 Z" fill="currentColor"/>
        <path d="M22 40 Q32 32 42 40" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M14 32 Q32 18 50 32" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".75"/>
        <path d="M6 24 Q32 4 58 24" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".5"/>
        <line x1="10" y1="10" x2="54" y2="54" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>`;
    }
    if (type === 'error') {
      return `<svg viewBox="0 0 64 64" width="42" height="42"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3.5"/><line x1="22" y1="22" x2="42" y2="42" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><line x1="42" y1="22" x2="22" y2="42" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`;
    }
    if (type === 'success') {
      return `<svg viewBox="0 0 64 64" width="42" height="42"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3.5"/><polyline points="20,33 28,41 44,24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<svg viewBox="0 0 64 64" width="42" height="42"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="32" cy="22" r="2.5" fill="currentColor"/><line x1="32" y1="30" x2="32" y2="46" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  },
};

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
    const fullHash = (location.hash || '#/').slice(1) || '/';
    const path = fullHash.split('?')[0].split('#')[0];

    if (!Auth.current()) { showLogin(); return; }
    showApp();

    for (const r of Router.routes) {
      const m = path.match(r.regex);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
        r.handler(params, fullHash);
        $$('#topnav a').forEach(a => {
          const route = a.getAttribute('data-route');
          let active = false;
          if (route === '/') active = path === '/';
          else if (route === '/dossiers/nieuw') active = path === '/dossiers/nieuw';
          else if (route === '/dossiers') active = path.startsWith('/dossiers') && path !== '/dossiers/nieuw';
          else active = path === route;
          a.classList.toggle('active', active);
        });
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
  const s = Auth.current(); if (s) $('#user-name').textContent = s.fullName || s.email;
}
