// Screen — Document scannen via de camera.
// Stub voor MVP-foundation: accepteert een bestand/camera-opname en geeft
// 'm door aan de volgende stap. Volgende sessie: live randdetectie,
// auto-crop via jscanify, viewfinder-overlay zoals in het mockup-design.

function ScanScreen({ dossier, target, docType, onScanned, onBack }) {
  const inpRef = React.useRef(null);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    onScanned(f);
  };

  return (
    <ScreenShell dark>
      <StatusBar dark/>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', position: 'relative', zIndex: 5 }}>
        <NavGlyphButton dark onClick={onBack} ariaLabel="Terug"
                        icon={<Icon.Chevron dir="left" size={14} c="#fff"/>}/>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
          {docType.label} scannen
        </div>
        <div style={{ width: 38, height: 38 }}/>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
        <div style={{
          width: '100%', maxWidth: 340, aspectRatio: '1.586 / 1',
          position: 'relative',
          border: '1px dashed rgba(255,255,255,0.35)',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CornerBrackets color="#fff" len={36} thickness={3}/>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, padding: 18 }}>
            Houd het document binnen het kader<br/>en tik op <strong>Foto maken</strong>.
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 24px 32px', position: 'relative', zIndex: 5 }}>
        <PrimaryButton onClick={() => inpRef.current?.click()}>
          Foto maken
        </PrimaryButton>
        <input
          ref={inpRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          style={{ display: 'none' }}
        />
        <div style={{ height: 8 }}/>
        <TertiaryButton dark onClick={onBack}>Annuleren</TertiaryButton>
      </div>
    </ScreenShell>
  );
}

window.ScanScreen = ScanScreen;
