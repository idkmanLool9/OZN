// Screen — Welk type document wordt gescand?

function DocSelectScreen({ dossier, target, onPick, onBack }) {
  return (
    <ScreenShell>
      <StatusBar/>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
        <NavGlyphButton onClick={onBack} ariaLabel="Terug"
                        icon={<Icon.Chevron dir="left" size={14} c={T.ink}/>}/>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>
          {dossier.dossier_nummer || 'Dossier'}
        </div>
        <div style={{ width: 38, height: 38 }}/>
      </div>

      <div style={{ padding: '12px 24px 6px' }}>
        <StepBar step={2} total={4}/>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.ink, letterSpacing: -0.9, lineHeight: 1.1 }}>
          Welk document?
        </div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8, lineHeight: 1.45, letterSpacing: -0.05 }}>
          {target === 'overledene' ? 'Voor de overledene' : 'Voor de contactpersoon'}
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <DocCard
          icon={<Icon.IDCard c={T.blue}/>}
          title="ID-kaart"
          subtitle="Nederlandse identiteitskaart"
          onClick={() => onPick({ type: 'id', label: 'Identiteitskaart' })}
        />
        <DocCard
          icon={<Icon.Passport c={T.blue}/>}
          title="Paspoort"
          subtitle="Nederlands paspoort"
          onClick={() => onPick({ type: 'passport', label: 'Paspoort' })}
        />
        <DocCard
          icon={<Icon.Licence c={T.blue}/>}
          title="Rijbewijs"
          subtitle="Nederlands rijbewijs"
          onClick={() => onPick({ type: 'licence', label: 'Rijbewijs' })}
        />
      </div>
    </ScreenShell>
  );
}

function DocCard({ icon, title, subtitle, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: T.bg, border: '1px solid ' + T.hair, borderRadius: T.r,
      padding: '18px 18px', display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: T.font,
      transition: 'transform .08s ease, box-shadow .12s ease, border-color .12s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.blueTint; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: T.blueSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 3, letterSpacing: -0.05 }}>{subtitle}</div>
      </div>
      <Icon.Chevron size={14} c={T.faint}/>
    </button>
  );
}

window.DocSelectScreen = DocSelectScreen;
