// SnelStart-koppeling (boekhouding). Praat via de Edge Function 'snelstart'
// met de SnelStart B2B API. De sleutels staan in de app-instellingen en
// worden per aanroep meegestuurd — niet hardcoded in de frontend.

const SnelStart = {
  /** Is de koppeling aangezet én zijn beide sleutels ingevuld? */
  isConfigured() {
    return !!(Settings.get('snelstart_actief') &&
      (Settings.get('snelstart_subscription_key') || '').trim() &&
      (Settings.get('snelstart_client_key') || '').trim());
  },

  _creds() {
    return {
      subscriptionKey: (Settings.get('snelstart_subscription_key') || '').trim(),
      clientKey: (Settings.get('snelstart_client_key') || '').trim(),
    };
  },

  async _call(payload) {
    // Stuur de user-JWT (sessie) mee, niet de anon-key. De Edge Function
    // verifieert dat het een ingelogde beheerder is — anders was 't een
    // open proxy voor iedereen op internet.
    let jwt = null;
    try {
      if (typeof sb !== 'undefined' && sb.auth) {
        const { data } = await sb.auth.getSession();
        jwt = data?.session?.access_token || null;
      }
    } catch (_) {}
    if (!jwt) return { error: 'not_authenticated', msg: 'Niet ingelogd — kan SnelStart niet aanroepen.' };
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/snelstart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });
    let data = null;
    try { data = await resp.json(); } catch (_) { data = { error: 'invalid_json' }; }
    return data;
  },

  /** Verbinding testen — wisselt de clientkey om en doet een lichte API-call. */
  async test() {
    return SnelStart._call(Object.assign({ action: 'test' }, SnelStart._creds()));
  },

  /** Vrije API-call (proxy). bv. request('GET', '/relaties?$top=5'). */
  async request(method, path, body) {
    return SnelStart._call(Object.assign({ action: 'request', method, path, body }, SnelStart._creds()));
  },
};
