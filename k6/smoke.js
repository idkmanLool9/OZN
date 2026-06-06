// Smoke-test: minimale "doet alles?"-test met 1 virtuele gebruiker.
// Run vooral DIT eerst voor je load.js of stress.js start, om te bevestigen
// dat de scripts werken en de URLs kloppen.
//
//   k6 run k6/smoke.js
//
// Of met een andere BASE_URL:
//   k6 run -e BASE_URL=https://uitvaart.pages.dev k6/smoke.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://uitvaart.pages.dev';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://mpuejmkhmlbkaelqbnae.supabase.co';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed:   ['rate<0.01'],  // < 1% requests mag falen
    http_req_duration: ['p(95)<2000'], // 95% binnen 2 seconden
  },
};

export default function () {
  // 1. Homepage (Cloudflare Pages)
  const home = http.get(BASE_URL);
  check(home, {
    'homepage 200': r => r.status === 200,
    'homepage bevat uitvaart-app': r => r.body.includes('Uitvaartbeheer'),
  });

  // 2. Supabase auth health (publiek endpoint, geen sleutel)
  const auth = http.get(`${SUPABASE_URL}/auth/v1/health`);
  check(auth, {
    'auth health 200': r => r.status === 200,
  });

  sleep(1);
}
