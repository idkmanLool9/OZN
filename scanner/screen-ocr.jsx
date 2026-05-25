// Screen — OCR-resultaat (Verifi-stijl: header-kaart + field-cards
// met confidence-badges + bottom action-bar).

function ConfidenceBadge({ level = 'high' }) {
  const map = {
    high: { color: T.green,  bg: 'rgba(16,185,129,0.10)', label: 'Hoog' },
    mid:  { color: '#D97706', bg: 'rgba(217,119,6,0.10)', label: 'Gemiddeld' },
    low:  { color: T.red,    bg: 'rgba(239,68,68,0.10)',  label: 'Laag' },
  };
  const c = map[level] || map.high;
  return (
    <div style={{
      padding: '2px 7px', borderRadius: 999,
      background: c.bg, color: c.color,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 3, background: c.color }}/>
      {c.label}
    </div>
  );
}

function FieldCard({ label, value, onChange, mono, confidence, last = false, type = 'text' }) {
  const empty = !value;
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12, cursor: 'text',
      padding: '14px 16px',
      borderBottom: last ? 'none' : '1px solid ' + T.hair,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)} placeholder="—"
          style={{
            width: '100%', border: 'none', outline: 'none', background: 'transparent',
            fontSize: 16, fontWeight: 600, color: empty ? T.faint : T.ink,
            fontFamily: mono ? T.mono : T.font,
            letterSpacing: mono ? 0.3 : -0.2, lineHeight: 1.2, padding: 0,
          }}
        />
      </div>
      {confidence && <ConfidenceBadge level={confidence}/>}
      <div style={{ width: 32, height: 32, borderRadius: 16, background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon.Edit size={14} c={T.body}/>
      </div>
    </label>
  );
}

function OCRScreen({ dossier, target, docType, file, fields, onConfirm, onBack }) {
  const [state, setState] = React.useState(() => ({
    voornaam: fields.voornaam || '',
    achternaam: fields.achternaam || '',
    geboortedatum: fields.geboortedatum || '',
    nationaliteit: fields.nationaliteit || (target === 'overledene' ? 'Nederlandse' : ''),
    bsn: fields.bsn || '',
    document_nummer: fields.document_nummer || '',
    geslacht: fields.geslacht || '',
  }));
  const [busy, setBusy] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState(null);

  React.useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (k, v) => setState(s => ({ ...s, [k]: v }));
  const filledCount = Object.values(state).filter(v => v && String(v).trim()).length;

  const onSubmit = () => {
    setBusy(true);
    const patch = {};
    if (target === 'overledene') {
      if (state.voornaam)      patch.voornaam      = state.voornaam;
      if (state.achternaam)    patch.achternaam    = state.achternaam;
      if (state.geboortedatum) patch.geboortedatum = state.geboortedatum;
      if (state.nationaliteit) patch.nationaliteit = state.nationaliteit;
      if (state.bsn)           patch.bsn           = state.bsn;
      if (state.geslacht)      patch.geslacht      = state.geslacht;
    } else {
      if (state.voornaam)      patch.contact_voornaam = state.voornaam;
      if (state.achternaam)    patch.contact_naam     = state.achternaam;
      if (state.geboortedatum) patch.contact_geboortedatum = state.geboortedatum;
      if (state.bsn)           patch.contact_bsn      = state.bsn;
    }
    onConfirm(patch, file);
  };

  return (
    <ScreenShell style={{ background: T.bg2 }}>
      <StatusBar/>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
        <NavGlyphButton onClick={onBack} ariaLabel="Terug" icon={<Icon.Chevron dir="left" size={14} c={T.ink}/>}/>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Gegevens controleren</div>
        <div style={{ width: 38, height: 38 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 0' }}>
        <StepBar step={3} total={4}/>

        <div style={{ fontSize: 26, fontWeight: 700, color: T.ink, letterSpacing: -0.8, lineHeight: 1.1 }}>
          We hebben je<br/>gegevens uitgelezen.
        </div>
        <div style={{ fontSize: 14, fontWeight: 400, color: T.muted, lineHeight: 1.4, marginTop: 8, marginBottom: 14, letterSpacing: -0.1 }}>
          Tik op een veld om aan te passen.
        </div>

        {/* Header-card met foto-thumbnail + doc-info */}
        <div style={{
          background: '#fff', borderRadius: T.r, padding: 12,
          border: '1px solid ' + T.hair,
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 14,
        }}>
          <div style={{ width: 72, height: 46, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewUrl ? (
              <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            ) : (
              <Icon.IDCard c={T.muted} size={20}/>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{docType.label}</div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginTop: 2 }}>
              {target === 'overledene' ? 'Voor overledene' : 'Voor contactpersoon'} · {filledCount} {filledCount === 1 ? 'veld' : 'velden'} ingevuld
            </div>
          </div>
          <div style={{
            padding: '5px 9px', borderRadius: 999,
            background: T.greenSoft, color: T.green,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Icon.Check c={T.green} size={11}/>
            Klaar
          </div>
        </div>

        {/* Field-cards */}
        <div style={{
          background: '#fff', borderRadius: T.r, border: '1px solid ' + T.hair,
          overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}>
          <FieldCard label="Voornaam" value={state.voornaam} onChange={v => set('voornaam', v)}/>
          <FieldCard label="Achternaam" value={state.achternaam} onChange={v => set('achternaam', v)}/>
          <FieldCard label="Geboortedatum" value={state.geboortedatum} onChange={v => set('geboortedatum', v)} type="date" mono/>
          <FieldCard label="Nationaliteit" value={state.nationaliteit} onChange={v => set('nationaliteit', v)}/>
          <FieldCard label="BSN" value={state.bsn} onChange={v => set('bsn', v)} mono/>
          {target === 'overledene' && (
            <FieldCard label="Geslacht" value={state.geslacht} onChange={v => set('geslacht', v)} last/>
          )}
        </div>

        {filledCount === 0 && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: T.orangeSoft, borderRadius: T.rSm,
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid rgba(249,115,22,0.18)',
          }}>
            <Icon.Sparkle c={T.orange} size={12}/>
            <div style={{ fontSize: 12, color: '#9A3412', fontWeight: 600, letterSpacing: -0.05 }}>
              Geen velden automatisch herkend — vul handmatig in.
            </div>
          </div>
        )}

        <div style={{ height: 20 }}/>
      </div>

      {/* Bottom action-bar */}
      <div style={{
        padding: '14px 16px 32px',
        background: 'rgba(247,248,250,0.85)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        borderTop: '1px solid ' + T.hair,
        display: 'flex', gap: 10,
      }}>
        <SecondaryButton style={{ flex: '0 0 120px' }} onClick={onBack} icon={<Icon.Retake size={16}/>}>
          Opnieuw
        </SecondaryButton>
        <PrimaryButton style={{ flex: 1 }} onClick={onSubmit} disabled={busy}>
          {busy ? <Icon.Spinner/> : 'Bevestigen'}
        </PrimaryButton>
      </div>
    </ScreenShell>
  );
}

window.OCRScreen = OCRScreen;
