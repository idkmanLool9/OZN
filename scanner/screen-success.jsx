// Screen — Geverifieerd / opgeslagen (Verifi blauwe gradient)

function SuccessScreen({ dossier, target, docType, savedFields = {}, file, onContinue }) {
  const [previewUrl, setPreviewUrl] = React.useState(null);
  React.useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Verzamel summary-rijen op basis van wat is opgeslagen
  const fullName = [savedFields.voornaam || savedFields.contact_voornaam,
                    savedFields.achternaam || savedFields.contact_naam]
                    .filter(Boolean).join(' ') || '(geen naam ingevuld)';
  const dossierName = [dossier.voornaam, dossier.achternaam].filter(Boolean).join(' ');
  const rows = [];
  if (savedFields.voornaam || savedFields.contact_voornaam || savedFields.achternaam || savedFields.contact_naam) {
    rows.push(['Naam', fullName, false]);
  }
  const gb = savedFields.geboortedatum || savedFields.contact_geboortedatum;
  if (gb) rows.push(['Geboortedatum', formatNL(gb), true]);
  if (savedFields.nationaliteit) rows.push(['Nationaliteit', savedFields.nationaliteit, false]);
  if (savedFields.bsn || savedFields.contact_bsn) rows.push(['BSN', savedFields.bsn || savedFields.contact_bsn, true]);
  if (savedFields.geslacht) rows.push(['Geslacht', savedFields.geslacht, false]);

  return (
    <div style={{ width: '100%', minHeight: '100%', background: '#fff', position: 'relative', overflow: 'hidden', fontFamily: T.font, display: 'flex', flexDirection: 'column' }}>
      {/* Blauwe gradient bovenband */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 380,
        background: 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 60%, #1E40AF 100%)',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -240, left: '50%', transform: 'translateX(-50%)', width: 460, height: 460, background: 'radial-gradient(closest-side, rgba(255,255,255,0.22), rgba(255,255,255,0))' }}/>
        <div style={{ position: 'absolute', top: 120, left: -40, width: 240, height: 240, background: 'radial-gradient(closest-side, rgba(249,115,22,0.18), rgba(249,115,22,0))' }}/>
        <div style={{ position: 'absolute', top: 80, right: -50, width: 220, height: 220, background: 'radial-gradient(closest-side, rgba(96,165,250,0.45), rgba(96,165,250,0))' }}/>
      </div>

      <StatusBar dark/>

      <div style={{ position: 'absolute', top: 56, right: 16, zIndex: 5 }}>
        <button onClick={onContinue} style={{
          height: 32, padding: '0 14px',
          border: 'none', borderRadius: 16,
          background: 'rgba(255,255,255,0.14)', color: '#fff',
          fontFamily: T.font, fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
          cursor: 'pointer', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.18)',
        }}>Klaar</button>
      </div>

      {/* Grote success-badge */}
      <div style={{ marginTop: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 4 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 48,
          background: 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 16px 36px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 16.5 L13.5 22 L24 11" stroke={T.green} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div style={{
          marginTop: 22, color: '#fff', fontSize: 28, fontWeight: 700,
          letterSpacing: -0.7, lineHeight: 1.1, textAlign: 'center',
          textShadow: '0 1px 14px rgba(15,23,42,0.25)',
        }}>
          Opgeslagen
        </div>
        <div style={{
          marginTop: 8, color: 'rgba(255,255,255,0.85)',
          fontSize: 15, fontWeight: 500, letterSpacing: -0.1,
          textAlign: 'center', maxWidth: 290, padding: '0 24px',
        }}>
          {docType.label} is toegevoegd aan dossier <strong>{dossier.dossier_nummer}</strong>.
        </div>
      </div>

      {/* Summary-card */}
      <div style={{
        position: 'absolute', top: 356, left: 16, right: 16,
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 20px 50px rgba(15,23,42,0.16), 0 4px 14px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)',
        padding: 18,
        zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 80, height: 50, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewUrl ? (
              <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            ) : (
              <Icon.IDCard c={T.muted} size={20}/>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {dossierName || '(naam onbekend)'}
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, marginTop: 2 }}>
              {docType.label} · {target === 'overledene' ? 'Overledene' : 'Contactpersoon'}
            </div>
          </div>
          <div style={{
            padding: '4px 8px', borderRadius: 999,
            background: T.greenSoft, color: T.green,
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
          }}>Opgeslagen</div>
        </div>

        {rows.length > 0 && (
          <>
            <div style={{ height: 1, background: T.hair, margin: '0 -2px 14px' }}/>
            {rows.map(([label, value, mono], i) => (
              <SummaryRow key={i} label={label} value={value} mono={mono} last={i === rows.length - 1}/>
            ))}
          </>
        )}
      </div>

      {/* CTAs */}
      <div style={{ position: 'absolute', bottom: 32, left: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PrimaryButton onClick={onContinue}>Doorgaan</PrimaryButton>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, letterSpacing: -0.05 }}>{label}</div>
      <div style={{
        fontSize: 14, color: T.ink, fontWeight: 600,
        letterSpacing: mono ? 0.2 : -0.1,
        fontFamily: mono ? T.mono : T.font,
      }}>{value}</div>
    </div>
  );
}

function formatNL(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

window.SuccessScreen = SuccessScreen;
