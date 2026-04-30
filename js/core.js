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
