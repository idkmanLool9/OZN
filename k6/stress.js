// Stress-test: pushen tot hij omvalt.
// Ramps up: 100 → 500 → 1000 virtuele gebruikers over 6 minuten.
//
//   k6 run k6/stress.js
//
// ⚠️ WAARSCHUWING ⚠️
// Dit verbruikt veel Cloudflare-bandbreedte (~15.000 page-loads ≈ 600 MB)
// en kan Supabase Free-tier rate-limits raken (60 req/s per IP).
// Run dit MAXIMAAL 1× per maand en niet tijdens werkuren.
//
// Beter: gebruik Grafana Cloud k6 — die verdeelt het verkeer over
// meerdere regio's en pakt de cloud-resources op. Free tier = 500
// VU-hours/maand, dik genoeg voor maandelijkse stresstest.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://uitvaart.pages.dev';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://mpuejmkhmlbkaelqbnae.supabase.co';

export const options = {
  stages: [
    { duration: '1m', target: 100  },
    { duration: '2m', target: 500  },
    { duration: '2m', target: 1000 },  // het breekpunt
    { duration: '1m', target: 0    },
  ],
  thresholds: {
    // Bewust soepel — we zoeken juist het breekpunt
    http_req_failed:   ['rate<0.10'],   // tot 10% failure is "nog ok"
    http_req_duration: ['p(95)<10000'], // 95% binnen 10s
  },
};

export default function () {
  const res = http.get(BASE_URL);
  check(res, {
    'status < 500': r => r.status < 500,
  });

  // Lichter dan load.js — alleen homepage, want we testen de webserver-capaciteit
  if (Math.random() < 0.3) {
    http.get(`${SUPABASE_URL}/auth/v1/health`);
  }

  sleep(Math.random() * 1.5);
}
