// Screen — Analyseren (OCR loopt).
// Stub voor MVP-foundation: simuleert de progress. Volgende sessie:
// echte Tesseract.js-OCR met live status-messages.

function ProgressScreen({ file, docType, onDone, onBack }) {
  const [step, setStep] = React.useState(0);
  const steps = [
    'Document detecteren...',
    'Uitsnijden en rechtzetten...',
    'Tekst herkennen...',
    'Velden controleren...',
  ];

  React.useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      if (i >= steps.length) {
        // Stub: lever lege OCR-result en originele file door.
        // Volgende sessie: echte OCR-velden hier vullen.
        onDone({ file, fields: {} });
        return;
      }
      setStep(i);
      setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScreenShell>
      <StatusBar/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24 }}>
        <div style={{ position: 'relative', width: 88, height: 88, marginBottom: 24 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 44,
                        background: T.blueSoft }}/>
          <div style={{ position: 'absolute', inset: 8, borderRadius: 36,
                        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon.Spinner size={32} c={T.blue}/>
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: -0.6, textAlign: 'center' }}>
          {steps[step]}
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 8, textAlign: 'center' }}>
          Dit duurt enkele seconden.
        </div>

        <div style={{ marginTop: 32, width: '100%', maxWidth: 280 }}>
          <StepBar step={step + 1} total={steps.length}/>
        </div>
      </div>
    </ScreenShell>
  );
}

window.ProgressScreen = ProgressScreen;
