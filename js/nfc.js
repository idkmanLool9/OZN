// NFC: koppel een fysieke NFC-tag/kaart aan een dossier.
//
// Browser-ondersteuning:
//  · Web NFC API werkt momenteel alleen op Chrome voor Android.
//  · iOS Safari ondersteunt het niet (privacy-restrictie van Apple).
//  · In de toekomstige iOS-app via Capacitor zal een NFC-plugin het
//    voor zowel iOS als Android afhandelen — deze module schakelt
//    daar automatisch op over zodra die plugin aanwezig is.
//
// Voor nu valt de UI op niet-ondersteunde platforms terug op handmatige
// invoer van het tag-ID — zo kan de uitvaartleider het serienummer
// alvast registreren via een externe NFC-reader-app.

const NFC = {
  // Detecteer welke route we kunnen gebruiken
  isWebNfcSupported() { return typeof window !== 'undefined' && 'NDEFReader' in window; },
  isCapacitorNfcAvailable() {
    return typeof window !== 'undefined' &&
      window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NFC;
  },
  isAvailable() { return NFC.isWebNfcSupported() || NFC.isCapacitorNfcAvailable(); },

  // Eenmalige tag-scan: wachten op een tag aan te raken, geeft serial-number terug
  async readSerial({ timeoutMs = 30000 } = {}) {
    if (NFC.isCapacitorNfcAvailable()) {
      const { NFC: NfcPlugin } = window.Capacitor.Plugins;
      const result = await NfcPlugin.read();
      return result && (result.serial || result.id || result.serialNumber || '');
    }
    if (NFC.isWebNfcSupported()) {
      const reader = new NDEFReader();
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        await reader.scan({ signal: ctrl.signal });
        return await new Promise((resolve, reject) => {
          // Eén-keer-vlag voorkomt dat de abort-handler de promise alsnog
          // afwijst nadat 'reading' al heeft geresolved.
          let settled = false;
          const finish = (fn, val) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            fn(val);
            // Stop de NFC-radio NA het settle, zodat de daaropvolgende
            // abort-event geen onterechte 'afgebroken'-reject veroorzaakt.
            setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, 0);
          };
          reader.addEventListener('reading', ev => {
            finish(resolve, (ev.serialNumber || '').toLowerCase());
          }, { once: true });
          reader.addEventListener('readingerror', () => {
            finish(reject, new Error('Kon de tag niet lezen'));
          }, { once: true });
          ctrl.signal.addEventListener('abort', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            reject(new Error('Wachten op NFC-tag afgebroken'));
          });
        });
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'NotAllowedError') {
          throw new Error('NFC-toestemming geweigerd. Sta NFC toe in de browser.');
        }
        throw e;
      }
    }
    throw new Error('NFC wordt op dit apparaat niet ondersteund');
  },

  // Schrijven naar een tag (alleen Web NFC + Capacitor — iOS-Safari kan niet)
  async writeText(text, { timeoutMs = 30000 } = {}) {
    if (NFC.isCapacitorNfcAvailable()) {
      const { NFC: NfcPlugin } = window.Capacitor.Plugins;
      return await NfcPlugin.write({ records: [{ recordType: 'text', data: String(text) }] });
    }
    if (NFC.isWebNfcSupported()) {
      const writer = new NDEFReader();
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        await writer.write({ records: [{ recordType: 'text', data: String(text) }] }, { signal: ctrl.signal });
      } finally {
        clearTimeout(timeout);
      }
      return true;
    }
    throw new Error('NFC-schrijven wordt op dit apparaat niet ondersteund');
  },

  // UI: koppel-modal die een tag laat scannen of handmatig invoeren.
  // Resolved met de serial (string) of null bij annuleren.
  promptKoppel() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal shown';
      overlay.style.zIndex = 200;
      const supported = NFC.isAvailable();
      overlay.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-card nfc-prompt-card">
          <div class="nfc-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="56" height="56" fill="none"
                 stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 24 Q32 12 48 24"/>
              <path d="M22 32 Q32 24 42 32" opacity=".7"/>
              <path d="M28 40 Q32 36 36 40" opacity=".5"/>
              <circle cx="32" cy="48" r="2.5" fill="currentColor"/>
            </svg>
          </div>
          <h2>NFC-tag koppelen</h2>
          <p class="muted small" id="nfc-prompt-msg">
            ${supported
              ? 'Houd een NFC-tag of -kaart tegen de achterkant van het apparaat. Het serienummer wordt automatisch herkend.'
              : 'Web NFC werkt op dit apparaat niet (alleen Chrome op Android of de toekomstige iOS-app). Voer het serienummer handmatig in als je het kent.'}
          </p>
          <div id="nfc-prompt-status" class="nfc-status muted small" aria-live="polite">
            ${supported ? 'Wachten op tag...' : 'Handmatige invoer'}
          </div>
          <label class="full" style="margin-top:.5rem;">
            <span>Serienummer (handmatig)</span>
            <input type="text" id="nfc-prompt-input" placeholder="bv. 04:a3:b1:c2:d4:e5:f6" autocomplete="off">
          </label>
          <div class="modal-buttons">
            <button type="button" class="btn btn-ghost" data-act="cancel">Annuleren</button>
            <button type="button" class="btn btn-primary" data-act="ok">Koppelen</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const inp = overlay.querySelector('#nfc-prompt-input');
      const status = overlay.querySelector('#nfc-prompt-status');
      let abortController = null;

      const close = (val) => {
        if (abortController) try { abortController.abort(); } catch (_) {}
        overlay.remove();
        resolve(val);
      };

      // Auto-scan starten als ondersteund
      if (supported) {
        (async () => {
          try {
            status.textContent = 'Houd een tag tegen de iPad/telefoon...';
            const serial = await NFC.readSerial({ timeoutMs: 60000 });
            if (serial) {
              inp.value = serial;
              status.textContent = '✓ Tag herkend — klik Koppelen om te bevestigen';
              status.style.color = 'var(--green)';
            }
          } catch (e) {
            status.textContent = e.message || String(e);
            status.style.color = 'var(--amber)';
          }
        })();
      }

      overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
      overlay.querySelector('.modal-backdrop').addEventListener('click', () => close(null));
      overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
        const v = inp.value.trim();
        if (!v) {
          status.textContent = 'Vul een serienummer in of laat een tag scannen';
          status.style.color = 'var(--red)';
          return;
        }
        close(v);
      });
    });
  },
};
