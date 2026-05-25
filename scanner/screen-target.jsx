// Screen — Voor wie scannen we? Overledene of contactpersoon.
// Bepaalt op welke velden in het dossier de OCR-resultaten landen.

function TargetScreen({ dossier, onPick, onBack }) {
  const fullName = [dossier.voornaam, dossier.achternaam].filter(Boolean).join(' ') || '(geen naam)';
  const contact = [dossier.contact_voornaam, dossier.contact_naam].filter(Boolean).join(' ') || '(geen contactpersoon)';

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
        <StepBar step={1} total={4}/>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.ink, letterSpacing: -0.9, lineHeight: 1.1 }}>
          Voor wie scan je nu?
        </div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8, lineHeight: 1.45, letterSpacing: -0.05 }}>
          De velden uit het document worden in het juiste deel van het dossier gezet.
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TargetCard
          icon={<Icon.Person size={26} c={T.blue}/>}
          title="Overledene"
          subtitle={fullName}
          onClick={() => onPick('overledene')}
        />
        <TargetCard
          icon={<Icon.Family size={26} c={T.blue}/>}
          title="Contactpersoon"
          subtitle={contact}
          onClick={() => onPick('contact')}
        />
      </div>
    </ScreenShell>
  );
}

function TargetCard({ icon, title, subtitle, onClick }) {
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
        <div style={{ fontSize: 13, color: T.muted, marginTop: 3, letterSpacing: -0.05,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
      </div>
      <Icon.Chevron size={14} c={T.faint}/>
    </button>
  );
}

window.TargetScreen = TargetScreen;
