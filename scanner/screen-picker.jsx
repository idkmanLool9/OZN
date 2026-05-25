// Screen — Dossier kiezen (Verifi-stijl, zelfde palet als design)

function PickerScreen({ onPick, onSignOut }) {
  const [dossiers, setDossiers] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchDossiers();
        if (!cancelled) setDossiers(list);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Kon dossiers niet laden');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = React.useMemo(() => {
    if (!dossiers) return null;
    const s = q.trim().toLowerCase();
    if (!s) return dossiers;
    return dossiers.filter(d => {
      const blob = [d.dossier_nummer, d.voornaam, d.achternaam, d.contact_naam, d.contact_voornaam].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(s);
    });
  }, [dossiers, q]);

  return (
    <ScreenShell style={{ background: T.bg2 }}>
      <StatusBar/>

      <div style={{ padding: '6px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={28}/>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Verifi</span>
        </div>
        <TertiaryButton onClick={onSignOut} style={{ width: 'auto', height: 32, padding: '0 12px' }}>Uitloggen</TertiaryButton>
      </div>

      <div style={{ padding: '0 16px 4px' }}>
        <StepBar step={0} total={4}/>
        <div style={{ fontSize: 26, fontWeight: 700, color: T.ink, letterSpacing: -0.8, lineHeight: 1.1 }}>
          Kies een dossier.
        </div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8, lineHeight: 1.45, letterSpacing: -0.05 }}>
          De gescande gegevens worden aan dit dossier toegevoegd.
        </div>
      </div>

      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid ' + T.hair, borderRadius: 14,
          padding: '0 14px', height: 48,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}>
          <Icon.Search size={16} c={T.muted}/>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Zoek op naam of dossiernummer..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: T.font, fontSize: 15, color: T.ink, height: '100%' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 28px' }}>
        {err && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', color: T.red,
            padding: '12px 14px', borderRadius: T.rSm, margin: '8px 0',
            fontSize: 13.5, fontWeight: 500, border: '1px solid rgba(239,68,68,0.18)',
          }}>{err}</div>
        )}

        {filtered === null && !err && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.muted }}>
            <Icon.Spinner size={24} c={T.blue}/>
            <div style={{ marginTop: 10, fontSize: 14 }}>Dossiers laden...</div>
          </div>
        )}

        {filtered && filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.muted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 14 }}>
              {q ? 'Geen dossiers gevonden voor deze zoekterm.' : 'Nog geen dossiers — maak er eerst één aan in de uitvaart-app.'}
            </div>
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(d => <DossierRow key={d.id} d={d} onClick={() => onPick(d)}/>)}
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

function DossierRow({ d, onClick }) {
  const fullName = [d.voornaam, d.achternaam].filter(Boolean).join(' ') || '(geen naam)';
  const contact = [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ');
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left',
      background: '#fff', border: '1px solid ' + T.hair, borderRadius: T.r,
      padding: '14px 16px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: T.font,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      transition: 'transform .08s ease, box-shadow .12s ease, border-color .12s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.blueTint; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: T.blueSoft, color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon.Person size={22} c={T.blue}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.2, lineHeight: 1.2 }}>{fullName}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2, letterSpacing: -0.05, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.body, fontWeight: 600 }}>{d.dossier_nummer || '—'}</span>
          {contact && <span> · {contact}</span>}
        </div>
      </div>
      <Icon.Chevron size={14} c={T.faint}/>
    </button>
  );
}

window.PickerScreen = PickerScreen;
