// Screen — Documentkeuze met klikbare country picker

function DocSelectScreen({ dossier, target, onPick, onBack }) {
  const [country, setCountry] = React.useState('NL');
  const [picker, setPicker] = React.useState(false);
  const c = countryByCode(country);

  return (
    <ScreenShell style={{ background: T.bg2 }}>
      <StatusBar/>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
        <NavGlyphButton onClick={onBack} ariaLabel="Terug" icon={<Icon.Chevron dir="left" size={14} c={T.ink}/>}/>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Kies je document</div>
        <div style={{ width: 38, height: 38 }}/>
      </div>

      <div style={{ padding: '4px 16px 0' }}>
        <StepBar step={2} total={4}/>

        <div style={{ fontSize: 26, fontWeight: 700, color: T.ink, letterSpacing: -0.8, lineHeight: 1.1 }}>
          Welk document<br/>ga je scannen?
        </div>
        <div style={{ fontSize: 14, fontWeight: 400, color: T.muted, lineHeight: 1.4, marginTop: 8, letterSpacing: -0.1 }}>
          {target === 'overledene' ? 'Voor de overledene' : 'Voor de contactpersoon'} · we stellen de scanner af op het type document.
        </div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 1, textTransform: 'uppercase', padding: '0 4px 8px' }}>Land van afgifte</div>
        <button onClick={() => setPicker(true)} style={{
          width: '100%', background: '#fff', border: '1px solid ' + T.hair, borderRadius: T.r,
          padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          transition: 'border-color .12s ease, box-shadow .12s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.blueTint; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; }}
        >
          <Flag code={c.code} size={28}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginTop: 1 }}>{c.sub}</div>
          </div>
          <span style={{ padding: '5px 10px', borderRadius: 999, background: T.blueSoft, color: T.blue, fontSize: 12, fontWeight: 600, letterSpacing: -0.1 }}>Wijzigen</span>
          <Icon.Chevron size={14} c={T.muted}/>
        </button>
      </div>

      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 1, textTransform: 'uppercase', padding: '0 4px 8px' }}>Documenttype</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DocTileRow
            icon={<Icon.IDCard c={T.blue}/>}
            label={`${c.code === 'NL' ? 'Nederlandse ' : ''}identiteitskaart`}
            sub="Voor- en achterkant · NFC-chip ondersteund"
            tag="Aanbevolen" tagColor={T.blue}
            onClick={() => onPick({ type: 'id', label: 'ID-kaart', country: c.code })}
          />
          <DocTileRow
            icon={<Icon.Passport c={T.blue}/>}
            label="Paspoort"
            sub="Met MRZ-zone op de fotopagina"
            onClick={() => onPick({ type: 'passport', label: 'Paspoort', country: c.code })}
          />
          <DocTileRow
            icon={<Icon.Licence c={T.blue}/>}
            label="Rijbewijs"
            sub="EU-formaat, model 2014 en later"
            onClick={() => onPick({ type: 'licence', label: 'Rijbewijs', country: c.code })}
          />
        </div>
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
            Tekst-herkenning draait lokaal op het apparaat. Gegevens belanden direct in het Uitvaartbeheer-dossier.
          </div>
        </div>
      </div>

      <CountrySheet
        open={picker}
        current={country}
        onPick={setCountry}
        onClose={() => setPicker(false)}
      />
    </ScreenShell>
  );
}

function DocTileRow({ icon, label, sub, tag, tagColor, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: '#fff', border: '1px solid ' + T.hair, borderRadius: T.r,
      padding: 14, display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)', position: 'relative',
      fontFamily: T.font,
      transition: 'transform .08s ease, box-shadow .12s ease, border-color .12s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.blueTint; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.hair; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: T.blueSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{label}</div>
          {tag && (
            <span style={{ padding: '2px 7px', borderRadius: 999, background: T.blueSoft, color: tagColor || T.blue, fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>{tag}</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, marginTop: 3, letterSpacing: -0.05 }}>{sub}</div>
      </div>
      <Icon.Chevron size={14} c={T.faint}/>
    </button>
  );
}

window.DocSelectScreen = DocSelectScreen;
