// Load-test: realistische gebruikslast voor een interne app.
// Ramps up: 10 → 50 → 100 virtuele gebruikers over 3 minuten.
// Verwacht: ruim binnen limieten, geen failures.
//
//   k6 run k6/load.js
//
// LET OP: dit ráákt je echte Cloudflare Pages + Supabase. Reken op
// ~3000 page-loads en ~6000 Supabase REST-calls bij deze run. Past
// makkelijk binnen Cloudflare Free + Supabase Free, maar als je het
// dagelijks doet ga je over je gratis bandbreedte heen.

import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://uitvaart.pages.dev';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://cmcbmcyxdndymxgpxmed.supabase.co';
const SUPABASE_KEY = __ENV.SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtY2JtY3l4ZG5keW14Z3B4bWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzgzMjAsImV4cCI6MjA5ODkxNDMyMH0.sVhIpC3l4_J1RGJiPEwBcw15sbOdIOMvVbD_51ULnlg';

export const options = {
  stages: [
    { duration: '30s', target: 10  },  // warm-up
    { duration: '1m',  target: 50  },  // typische piek (kerk-vrijdag, veel gebruikers tegelijk)
    { duration: '1m',  target: 100 },  // dubbele piek
    { duration: '30s', target: 0   },  // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.02'],   // < 2% failure
    http_req_duration: ['p(95)<3000'],  // 95% binnen 3 seconden
    'http_req_duration{name:HomePage}':  ['p(95)<1500'],
    'http_req_duration{name:Supabase}':  ['p(95)<2000'],
  },
};

export default function () {
  group('Pagina + assets laden', () => {
    const home = http.get(BASE_URL, { tags: { name: 'HomePage' } });
    check(home, { 'homepage 200': r => r.status === 200 });

    // De assets die de browser óók parallel ophaalt
    const assets = http.batch([
      ['GET', `${BASE_URL}/style.css`,           null, { tags: { name: 'Asset' } }],
      ['GET', `${BASE_URL}/js/app.js`,           null, { tags: { name: 'Asset' } }],
      ['GET', `${BASE_URL}/js/supabase-client.js`,null, { tags: { name: 'Asset' } }],
      ['GET', `${BASE_URL}/manifest.webmanifest`,null, { tags: { name: 'Asset' } }],
    ]);
    assets.forEach(r => check(r, { 'asset 200': r => r.status === 200 }));
  });

  group('Supabase publieke calls', () => {
    // Auth health (geen sleutel nodig)
    const auth = http.get(`${SUPABASE_URL}/auth/v1/health`, { tags: { name: 'Supabase' } });
    check(auth, { 'auth health 200': r => r.status === 200 });

    // PostgREST root (vereist anon-key)
    const rest = http.get(`${SUPABASE_URL}/rest/v1/?select=`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      tags: { name: 'Supabase' },
    });
    check(rest, { 'rest 200': r => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);  // 1-3s "denken"
}
