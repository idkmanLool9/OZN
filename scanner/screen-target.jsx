// Screen — Voor wie scannen we? Overledene of contactpersoon.

function TargetScreen({ dossier, onPick, onBack }) {
  const fullName = [dossier.voornaam, dossier.achternaam].filter(Boolean).join(' ') || '(geen naam)';
  const contact = [dossier.contact_voornaam, dossier.contact_naam].filter(Boolean).join(' ') || '(geen contactpersoon)';

  return (
    <ScreenShell style={{ background: T.bg2 }}>
      <StatusBar/>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
        <NavGlyphButton onClick={onBack} ariaLabel="Terug" icon={<Icon.Chevron dir="left" size={14} c={T.ink}/>}/>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>
          {dossier.dossier_nummer || 'Dossier'}
        </div>
        <div style={{ width: 38, height: 38 }}/>
      </div>

      <div style={{ padding: '12px 16px 6px' }}>
        <StepBar step={1} total={4}/>
        <div style={{ fontSize: 26, fontWeight: 700, color: T.ink, letterSpacing: -0.8, lineHeight: 1.1 }}>
          Voor wie scan je nu?
        </div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8, lineHeight: 1.45, letterSpacing: -0.05 }}>
          De velden uit het document worden in het juiste deel van het dossier gezet.
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TargetCard
          icon={<Icon.Person size={26} c={T.blue}/>}
          title="Overledene"
          subtitle={fullName}
          tag="Aanbevolen"
          onClick={() => onPick('overledene')}
        />
        <TargetCard
          icon={<Icon.Family size={26} c={T.blue}/>}
          title="Contactpersoon"
          subtitle={contact}
          onClick={() => onPick('contact')}
        />
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ padding: '14px 16px 32px' }}>
        <div style={{
          padding: '12px 14px', borderRadius: 14,
          background: T.greenSoft, border: '1px solid rgba(16,185,129,0.18)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ marginTop: 2 }}><Icon.Shield c={T.green} size={14}/></span>
          <div style={{ fontSize: 12.5, color: '#047857', fontWeight: 600, letterSpacing: -0.05, lineHeight: 1.4 }}>
            Wijzigingen worden direct in Uitvaartbeheer zichtbaar — geen aparte synchronisatie nodig.
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

function TargetCard({ icon, title, subtitle, tag, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: '#fff', border: '1px solid ' + T.hair, borderRadius: T.r,
      padding: '18px 18px', display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: T.font,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      transition: 'transform .08s ease, box-shadow .12s ease, border-color .12s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.blueTint; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 16, background: T.blueSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>{title}</div>
          {tag && (
            <span style={{ padding: '2px 7px', borderRadius: 999, background: T.blueSoft, color: T.blue, fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>{tag}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 3, letterSpacing: -0.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
      </div>
      <Icon.Chevron size={14} c={T.faint}/>
    </button>
  );
}

window.TargetScreen = TargetScreen;
