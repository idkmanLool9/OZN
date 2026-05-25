// Screen — Success-bevestiging na opslaan.

function SuccessScreen({ dossier, target, docType, onContinue }) {
  React.useEffect(() => {
    // Auto-terug na 3 seconden
    const t = setTimeout(() => onContinue(), 3000);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <ScreenShell>
      <StatusBar/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 48,
          background: T.greenSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 0 0 8px rgba(16,185,129,0.08)',
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M12 24l8 8 16-16" stroke={T.green} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div style={{ fontSize: 28, fontWeight: 700, color: T.ink, letterSpacing: -0.8, textAlign: 'center' }}>
          Opgeslagen.
        </div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 10, textAlign: 'center', maxWidth: 280, lineHeight: 1.45 }}>
          {docType.label} is toegevoegd aan dossier <strong style={{ color: T.body }}>{dossier.dossier_nummer}</strong> ({target === 'overledene' ? 'overledene' : 'contactpersoon'}).
        </div>

        <div style={{ marginTop: 28, width: '100%', maxWidth: 320 }}>
          <PrimaryButton onClick={onContinue}>Naar dossiers</PrimaryButton>
        </div>
      </div>
    </ScreenShell>
  );
}

window.SuccessScreen = SuccessScreen;
