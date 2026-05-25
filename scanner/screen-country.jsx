// Country picker — bottom-sheet modal die over het doc-select-scherm
// heen ligt. Voor SOK is Nederland de standaard, maar gebruiker kan
// alsnog wijzigen voor mensen met buitenlandse documenten.

const COUNTRIES = [
  // Geselecteerd / aanbevolen
  { code: 'NL', name: 'Nederland',         sub: 'NLD · EU · ICAO 9303', section: 'aanbevolen' },
  // Veelgekozen voor SOK-context (Syrisch-orthodoxe diaspora)
  { code: 'BE', name: 'België',            sub: 'BEL · EU',             section: 'veelgekozen' },
  { code: 'DE', name: 'Duitsland',         sub: 'DEU · EU',             section: 'veelgekozen' },
  // Alle landen — A
  { code: 'AT', name: 'Oostenrijk',        sub: 'AUT · EU',             section: 'alle' },
];

function CountrySheet({ open, current, onPick, onClose }) {
  const [q, setQ] = React.useState('');
  if (!open) return null;

  const filtered = COUNTRIES.filter(c => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s);
  });

  const grouped = {
    aanbevolen: filtered.filter(c => c.section === 'aanbevolen'),
    veelgekozen: filtered.filter(c => c.section === 'veelgekozen'),
    alle: filtered.filter(c => c.section === 'alle'),
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fadeIn .25s ease both',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      }}/>

      <div style={{
        position: 'relative',
        background: '#fff',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        boxShadow: '0 -20px 50px rgba(15,23,42,0.18)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '78%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 5, borderRadius: 3, background: T.bg3 }}/>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px' }}>
          <div style={{ width: 70 }}/>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Land van afgifte</div>
          <button onClick={onClose} style={{
            height: 32, padding: '0 14px',
            border: 'none', borderRadius: 16,
            background: T.blueSoft, color: T.blue,
            fontFamily: T.font, fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
            cursor: 'pointer',
          }}>Klaar</button>
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', background: T.bg3, borderRadius: 12,
          }}>
            <Icon.Search size={16} c={T.muted}/>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder='Zoek land of code (bv. "NL")'
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: T.font, fontSize: 15, color: T.ink }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          {grouped.aanbevolen.length > 0 && (<>
            <SectionHeader>Geselecteerd</SectionHeader>
            {grouped.aanbevolen.map(c => (
              <CountryRow key={c.code} c={c} selected={current === c.code} onClick={() => { onPick(c.code); onClose(); }}/>
            ))}
            <div style={{ height: 1, background: T.hair, margin: '4px 16px' }}/>
          </>)}
          {grouped.veelgekozen.length > 0 && (<>
            <SectionHeader>Veelgekozen</SectionHeader>
            {grouped.veelgekozen.map(c => (
              <CountryRow key={c.code} c={c} selected={current === c.code} onClick={() => { onPick(c.code); onClose(); }}/>
            ))}
            <div style={{ height: 1, background: T.hair, margin: '4px 16px' }}/>
          </>)}
          {grouped.alle.length > 0 && (<>
            <SectionHeader>Alle landen — A</SectionHeader>
            {grouped.alle.map(c => (
              <CountryRow key={c.code} c={c} selected={current === c.code} onClick={() => { onPick(c.code); onClose(); }}/>
            ))}
          </>)}

          {(grouped.aanbevolen.length + grouped.veelgekozen.length + grouped.alle.length) === 0 && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: T.muted, fontSize: 14 }}>
              Geen land gevonden voor "{q}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CountryRow({ c, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', background: 'transparent', border: 'none',
      padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 14,
      cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
    }}>
      <Flag code={c.code} size={24}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>{c.name}</div>
        <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, marginTop: 1 }}>{c.sub}</div>
      </div>
      {selected ? (
        <div style={{ width: 22, height: 22, borderRadius: 11, background: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon.Check size={12} c="#fff"/>
        </div>
      ) : (
        <div style={{ width: 22, height: 22, borderRadius: 11, border: '1.5px solid ' + T.hair }}/>
      )}
    </button>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ padding: '14px 20px 6px', fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

function countryByCode(code) { return COUNTRIES.find(c => c.code === code) || COUNTRIES[0]; }

window.CountrySheet = CountrySheet;
window.countryByCode = countryByCode;
