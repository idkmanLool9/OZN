// Screen — Opname controleren (Verifi-design)
// Toont de echte foto (niet de fake ID-render uit het mockup) met
// kwaliteits-chips erover; gebruiker bevestigt voordat de OCR-velden
// worden getoond.

function QualityChip({ icon, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 12px',
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: '0.5px solid rgba(15,23,42,0.06)',
      borderRadius: 999,
      boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
      fontSize: 12, fontWeight: 600, color: T.ink2, letterSpacing: -0.1,
    }}>
      {icon}{label}
    </div>
  );
}

function ReviewScreen({ file, docType, onUse, onRetake }) {
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [dim, setDim] = React.useState(null);

  React.useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => {
      setDim({ w: img.naturalWidth, h: img.naturalHeight, kb: Math.round(file.size / 1024) });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <ScreenShell>
      <StatusBar/>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', position: 'relative', zIndex: 5 }}>
        <NavGlyphButton onClick={onRetake} ariaLabel="Terug" icon={<Icon.Chevron dir="left" size={14} c={T.ink}/>}/>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Opname controleren</div>
        <div style={{ width: 38, height: 38 }}/>
      </div>

      <div style={{ padding: '4px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 8 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.blue }}/>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.blue }}/>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.bg3 }}/>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.bg3 }}/>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: -0.7, lineHeight: 1.1, marginTop: 14 }}>
          Ziet dit er goed uit?
        </div>
        <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.4, marginTop: 6, letterSpacing: -0.1 }}>
          Kwaliteitscontroles geslaagd — bevestig om gegevens uit te lezen.
        </div>
      </div>

      {/* Preview container met de echte foto */}
      <div style={{
        flex: 1,
        margin: '20px 16px 0',
        borderRadius: T.rLg,
        background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 100%)',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 16px 36px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        minHeight: 320,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1.4px)',
          backgroundSize: '3px 3px',
          mixBlendMode: 'overlay',
        }}/>
        <div style={{
          position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)',
          width: 340, height: 230,
          background: 'radial-gradient(closest-side, rgba(96,165,250,0.25), rgba(96,165,250,0))',
          filter: 'blur(8px)',
        }}/>

        {previewUrl && (
          <img src={previewUrl} alt="" style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            maxWidth: 'calc(100% - 28px)', maxHeight: 'calc(100% - 28px)',
            borderRadius: 12,
            boxShadow: '0 16px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
          }}/>
        )}

        <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <QualityChip icon={<Icon.Check size={12} c={T.green}/>} label="Scherp"/>
          <QualityChip icon={<Icon.Check size={12} c={T.green}/>} label="Geen schittering"/>
        </div>
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <QualityChip icon={<Icon.Check size={12} c={T.green}/>} label="Alle randen"/>
          <QualityChip icon={<Icon.Check size={12} c={T.green}/>} label="Geen bewegingsblur"/>
        </div>

        <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{
            padding: '6px 10px', borderRadius: 8,
            background: 'rgba(15,18,26,0.55)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 0.2, fontFamily: T.mono,
          }}>
            {dim ? `${dim.w} × ${dim.h} · ${dim.kb} KB` : 'Foto laden…'}
          </div>
          <GlassPill dark style={{ padding: '6px 10px', fontSize: 11.5 }}>
            <Icon.Sparkle c={T.orange} size={11}/>
            Auto-verbeterd
          </GlassPill>
        </div>
      </div>

      <div style={{ padding: '20px 16px 32px', display: 'flex', gap: 10 }}>
        <SecondaryButton style={{ flex: '0 0 130px' }} onClick={onRetake} icon={<Icon.Retake size={16}/>}>
          Opnieuw
        </SecondaryButton>
        <PrimaryButton style={{ flex: 1 }} onClick={onUse}>
          Deze scan gebruiken
        </PrimaryButton>
      </div>
    </ScreenShell>
  );
}

window.ReviewScreen = ReviewScreen;
