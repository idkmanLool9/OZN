// Screen — Analyseren (echte OCR via Tesseract.js)

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
  const [pct, setPct] = React.useState(0);
  const [phase, setPhase] = React.useState('loading'); // loading | ocr | parsing | done
  const [err, setErr] = React.useState('');
  const [previewUrl, setPreviewUrl] = React.useState(null);

  React.useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await VerifiOCR.recognize(file, (p) => {
          if (cancelled) return;
          setPhase(p.phase);
          setPct(Math.round((p.progress || 0) * 100));
        });
        if (cancelled) return;
        const fields = VerifiOCR.parse(text, docType.type);
        setPct(100); setPhase('done');
        // Korte pauze zodat 100% even zichtbaar is
        setTimeout(() => onDone({ file, fields, rawText: text }), 400);
      } catch (e) {
        if (cancelled) return;
        setErr(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 5 checks mappen op de phases
  const checks = [
    { label: 'Randdetectie',           done: phase !== 'loading' || pct > 5 },
    { label: 'Schittering & reflectie', done: phase !== 'loading' || pct > 15 },
    { label: 'Scherpte & bewegingsblur', done: phase !== 'loading' || pct > 25 },
    { label: 'OCR-tekstherkenning',    done: phase === 'parsing' || phase === 'done', active: phase === 'ocr' },
    { label: 'Velden uitlezen',         done: phase === 'done', active: phase === 'parsing' },
  ];
  // Markeer de eerste niet-done als active als er nog niets active is
  let hasActive = checks.some(c => c.active);
  if (!hasActive) {
    for (const c of checks) {
      if (!c.done) { c.active = true; break; }
    }
  }

  return (
    <div style={{ width: '100%', minHeight: '100%', position: 'relative', background: '#000', overflow: 'hidden', fontFamily: T.font }}>
      <CameraBg/>

      <div style={{
        position: 'absolute', top: 180, left: '50%', transform: 'translateX(-50%)',
        width: 380, height: 240,
        background: 'radial-gradient(closest-side, rgba(16,185,129,0.35), rgba(16,185,129,0))',
        pointerEvents: 'none', zIndex: 1,
      }}/>

      <StatusBar dark/>
      <CameraTopBar docLabel={`${docType.label} · Opgenomen`} countryCode={docType.country || 'NL'} onClose={onBack}/>

      <div style={{ position: 'absolute', top: 116, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <GlassPill dark style={{ paddingLeft: 10 }}>
          <span style={{ width: 18, height: 18, borderRadius: 9, background: T.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon.Check size={11} c="#fff"/>
          </span>
          Opgenomen · analyseren
        </GlassPill>
      </div>

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

        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 60, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: 60,
            background: 'linear-gradient(180deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.35) 60%, rgba(16,185,129,0.9) 100%)',
            animation: 'scanLine 2.4s ease-in-out infinite',
          }}/>
        </div>

        <DetectedCorners color={T.green} glow/>
      </div>

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
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
            {err ? 'Fout' : 'Document analyseren'}
          </div>
          {!err && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, fontFamily: T.mono, letterSpacing: 0.4 }}>{pct}%</div>}
        </div>

        {err ? (
          <>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>{err}</div>
            <button onClick={onBack} style={{
              width: '100%', height: 44, borderRadius: 22, border: 'none',
              background: T.blue, color: '#fff', fontFamily: T.font, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Opnieuw proberen</button>
          </>
        ) : (<>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontWeight: 500, letterSpacing: -0.05, marginBottom: 12 }}>
            {phase === 'loading' ? 'Tekst-engine laden (eerste keer ~5 sec)...'
              : phase === 'ocr' ? 'Tekstherkenning loopt — houd het toestel stil'
              : phase === 'parsing' ? 'Velden uit het document uitlezen...'
              : 'Klaar — naar review'}
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

          {checks.map((c, i) => (
            <ProgressCheckItem key={i} label={c.label} state={c.done ? 'done' : c.active ? 'active' : 'pending'}/>
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
        </>)}
      </div>
    </div>
  );
}

window.ProgressScreen = ProgressScreen;
