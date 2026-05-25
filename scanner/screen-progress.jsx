// Screen — Analyseren (Verifi-progress met glassmorphism-sheet)

function ProgressCheckItem({ label, state }) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11,
        background: isDone ? T.green : isActive ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
        border: isActive ? '1.5px solid rgba(255,255,255,0.6)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isDone ? '0 0 0 4px rgba(16,185,129,0.18)' : 'none',
        flexShrink: 0,
      }}>
        {isDone && <Icon.Check size={12} c="#fff"/>}
        {isActive && (<div style={{ width: 8, height: 8, borderRadius: 4, background: T.orange, boxShadow: '0 0 8px rgba(249,115,22,0.8)' }}/>)}
      </div>
      <div style={{
        flex: 1,
        color: isDone ? 'rgba(255,255,255,0.96)' : isActive ? '#fff' : 'rgba(255,255,255,0.55)',
        fontSize: 14, fontWeight: isActive ? 600 : 500, letterSpacing: -0.1,
      }}>{label}</div>
      {isActive && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: T.mono, letterSpacing: 0.3 }}>Bezig…</div>}
      {isDone && <div style={{ fontSize: 11, color: 'rgba(16,185,129,0.9)', fontFamily: T.mono, letterSpacing: 0.3 }}>OK</div>}
    </div>
  );
}

function ProgressScreen({ file, docType, onDone, onBack }) {
  const [step, setStep] = React.useState(0);
  const steps = [
    'Randdetectie',
    'Schittering & reflectie',
    'Scherpte & bewegingsblur',
    'OCR-tekstherkenning',
    'MRZ-pariteitscontrole',
  ];

  const [previewUrl, setPreviewUrl] = React.useState(null);
  React.useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  React.useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      if (i >= steps.length) {
        // Volgende sessie: hier komt de echte Tesseract.js-OCR. Voor nu
        // leveren we een lege fields-object door.
        onDone({ file, fields: {} });
        return;
      }
      setStep(i);
      setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round(((step + 1) / steps.length) * 100);

  return (
    <div style={{ width: '100%', minHeight: '100%', position: 'relative', background: '#000', overflow: 'hidden', fontFamily: T.font }}>
      <CameraBg/>

      {/* Soft green glow boven het opgenomen doc */}
      <div style={{
        position: 'absolute', top: 180, left: '50%', transform: 'translateX(-50%)',
        width: 380, height: 240,
        background: 'radial-gradient(closest-side, rgba(16,185,129,0.35), rgba(16,185,129,0))',
        pointerEvents: 'none', zIndex: 1,
      }}/>

      <StatusBar dark/>
      <CameraTopBar docLabel={`${docType.label} · Opgenomen`} countryCode="NL" onClose={onBack}/>

      {/* Success pill */}
      <div style={{ position: 'absolute', top: 116, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <GlassPill dark style={{ paddingLeft: 10 }}>
          <span style={{ width: 18, height: 18, borderRadius: 9, background: T.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon.Check size={11} c="#fff"/>
          </span>
          Opgenomen · analyseren
        </GlassPill>
      </div>

      {/* Werkelijke foto-preview, niet meer de fake ID-kaart-render */}
      <div style={{
        position: 'absolute', top: 180, left: '50%',
        transform: 'translateX(-50%) rotate(-0.4deg)',
        width: 308, height: 196, zIndex: 4,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 14px 30px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ position: 'absolute', inset: -6, borderRadius: 14, background: 'rgba(16,185,129,0.4)', filter: 'blur(20px)', opacity: 0.6, zIndex: -1 }}/>
        {previewUrl ? (
          <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#0B1220' }}/>
        )}

        {/* Animated scan-line over de top */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 60, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: 60,
            background: 'linear-gradient(180deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.35) 60%, rgba(16,185,129,0.9) 100%)',
            animation: 'scanLine 2.4s ease-in-out infinite',
          }}/>
        </div>

        <DetectedCorners color={T.green} glow/>
      </div>

      {/* Bottom analysis sheet (glassmorphism) */}
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 34,
        borderRadius: 24,
        background: 'rgba(15,18,26,0.75)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        padding: '20px 22px 22px',
        zIndex: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Document analyseren</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, fontFamily: T.mono, letterSpacing: 0.4 }}>{pct}%</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontWeight: 500, letterSpacing: -0.05, marginBottom: 12 }}>
          Kwaliteitscontroles draaien lokaal · houd het toestel stil
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${T.blue}, #60A5FA)`,
            borderRadius: 2, boxShadow: '0 0 8px rgba(96,165,250,0.6)',
            transition: 'width .3s ease',
          }}/>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px -2px 4px' }}/>

        {steps.map((s, i) => (
          <ProgressCheckItem key={i} label={s} state={i < step ? 'done' : i === step ? 'active' : 'pending'}/>
        ))}

        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 12,
          background: 'rgba(16,185,129,0.12)', border: '0.5px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon.Lock c="#34D399" size={13}/>
          <div style={{ fontSize: 12, color: '#A7F3D0', fontWeight: 600, letterSpacing: -0.05 }}>
            Lokale verwerking · niets verlaat je telefoon
          </div>
        </div>
      </div>
    </div>
  );
}

window.ProgressScreen = ProgressScreen;
