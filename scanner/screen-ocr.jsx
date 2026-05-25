// Screen — OCR-resultaat bewerken en bevestigen.
// In de MVP-foundation editable lege velden; volgende sessie wordt
// de fields-prop gevuld door echte OCR-output.

function OCRScreen({ dossier, target, docType, file, fields, onConfirm, onBack }) {
  // Editable kopie van de velden — we tonen lege strings als de OCR
  // nog geen waarde heeft kunnen lezen.
  const [state, setState] = React.useState(() => ({
    voornaam: fields.voornaam || '',
    achternaam: fields.achternaam || '',
    geboortedatum: fields.geboortedatum || '',
    nationaliteit: fields.nationaliteit || (target === 'overledene' ? 'Nederlandse' : ''),
    bsn: fields.bsn || '',
    document_nummer: fields.document_nummer || '',
    verloopdatum: fields.verloopdatum || '',
    geslacht: fields.geslacht || '',
  }));
  const [busy, setBusy] = React.useState(false);

  const set = (k, v) => setState(s => ({ ...s, [k]: v }));

  const onSubmit = () => {
    setBusy(true);
    // mappers: vertaal OCR-velden naar de juiste dossier-kolommen
    const patch = {};
    if (target === 'overledene') {
      if (state.voornaam)      patch.voornaam      = state.voornaam;
      if (state.achternaam)    patch.achternaam    = state.achternaam;
      if (state.geboortedatum) patch.geboortedatum = state.geboortedatum;
      if (state.nationaliteit) patch.nationaliteit = state.nationaliteit;
      if (state.bsn)           patch.bsn           = state.bsn;
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
        <NavGlyphButton onClick={onBack} ariaLabel="Terug"
                        icon={<Icon.Chevron dir="left" size={14} c={T.ink}/>}/>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Gegevens controleren</div>
        <div style={{ width: 38, height: 38 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 0' }}>
        <StepBar step={3} total={4}/>

        <div style={{ fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: -0.7, lineHeight: 1.15 }}>
          Controleer de gegevens.
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 6, marginBottom: 14 }}>
          Tik op een veld om te corrigeren. Lege velden vul je na het opslaan in de uitvaart-app aan.
        </div>

        <div style={{
          background: '#fff', borderRadius: T.r, border: '1px solid ' + T.hair,
          overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}>
          <FieldRow label="Voornaam"      value={state.voornaam}      onChange={v => set('voornaam', v)}/>
          <FieldRow label="Achternaam"    value={state.achternaam}    onChange={v => set('achternaam', v)}/>
          <FieldRow label="Geboortedatum" value={state.geboortedatum} onChange={v => set('geboortedatum', v)} type="date"/>
          <FieldRow label="Nationaliteit" value={state.nationaliteit} onChange={v => set('nationaliteit', v)}/>
          <FieldRow label="BSN"           value={state.bsn}           onChange={v => set('bsn', v)} mono/>
          {target === 'overledene' && (
            <FieldRow label="Documentnummer" value={state.document_nummer} onChange={v => set('document_nummer', v)} mono last/>
          )}
        </div>
      </div>

      <div style={{
        padding: '14px 16px 32px',
        background: 'rgba(247,248,250,0.85)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        borderTop: '1px solid ' + T.hair,
        display: 'flex', gap: 10,
      }}>
        <SecondaryButton style={{ flex: '0 0 120px' }} onClick={onBack}>Opnieuw</SecondaryButton>
        <PrimaryButton style={{ flex: 1 }} onClick={onSubmit} disabled={busy}>
          {busy ? <Icon.Spinner/> : 'Bevestigen'}
        </PrimaryButton>
      </div>
    </ScreenShell>
  );
}

function FieldRow({ label, value, onChange, type = 'text', mono = false, last = false }) {
  return (
    <label style={{
      display: 'block',
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid ' + T.hair,
      cursor: 'text',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: T.muted,
        letterSpacing: 0.4, textTransform: 'uppercase',
        marginBottom: 4,
      }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        style={{
          width: '100%', border: 'none', outline: 'none', background: 'transparent',
          fontFamily: mono ? T.mono : T.font,
          fontSize: 16, fontWeight: 600, color: T.ink,
          letterSpacing: mono ? 0.3 : -0.2, padding: 0,
        }}
      />
    </label>
  );
}

window.OCRScreen = OCRScreen;
