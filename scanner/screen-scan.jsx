// Screen — Document scannen (Verifi camera-look)
// MVP: gebruikt iOS-camera via file-input. Volgende sessie: live preview
// via getUserMedia + jscanify auto-crop.

function ScanScreen({ dossier, target, docType, onScanned, onBack }) {
  const inpRef = React.useRef(null);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    onScanned(f);
  };

  // Tab-active op basis van docType
  const active = docType.type === 'passport' ? 'Paspoort'
              : docType.type === 'licence'  ? 'Rijbewijs'
              : 'ID-kaart';

  return (
    <div style={{ width: '100%', minHeight: '100%', position: 'relative', background: '#000', overflow: 'hidden', fontFamily: T.font, display: 'flex', flexDirection: 'column' }}>
      <CameraBg/>

      <StatusBar dark/>

      <CameraTopBar
        docLabel={`${docType.label} · ${target === 'overledene' ? 'Overledene' : 'Contact'}`}
        countryCode="NL"
        onClose={onBack}
      />

      {/* Status pill bovenaan de viewfinder */}
      <div style={{ position: 'absolute', top: 116, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <GlassPill dark>
          <Dot color="#60A5FA" pulse/>
          Klaar om te scannen…
        </GlassPill>
      </div>

      {/* Document-viewfinder (placeholder rechthoek met corner-brackets) */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -54%)',
        width: 308, height: 196,
        zIndex: 4,
      }}>
        <div style={{
          width: '100%', height: '100%',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px dashed rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', color: 'rgba(255,255,255,0.55)',
          fontSize: 12, padding: 18, letterSpacing: -0.1,
        }}>
          Houd het document binnen het kader
        </div>
        <DetectionPolygon color="#60A5FA"/>
        <DetectedCorners color="#60A5FA" glow/>
      </div>

      {/* Doc-type-tabs */}
      <div style={{
        position: 'absolute', bottom: 200, left: 16, right: 16, zIndex: 10,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          borderRadius: 999,
          background: 'rgba(15,18,26,0.55)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '0.5px solid rgba(255,255,255,0.14)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          {['Paspoort', 'ID-kaart', 'Rijbewijs'].map(t => {
            const isActive = t === active;
            return (
              <div key={t} style={{
                padding: '8px 14px', borderRadius: 999,
                fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
                color: isActive ? T.ink : 'rgba(255,255,255,0.78)',
                background: isActive ? '#fff' : 'transparent',
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
              }}>{t}</div>
            );
          })}
        </div>
      </div>

      <CameraFooter status={`Lijn ${docType.label.toLowerCase()} uit`} subtext="Tik op de knop om de foto te maken"/>

      {/* Capture-knop onderaan */}
      <div style={{ position: 'absolute', bottom: 36, left: 0, right: 0, zIndex: 11, display: 'flex', justifyContent: 'center' }}>
        <button onClick={() => inpRef.current?.click()} style={{
          width: 76, height: 76, borderRadius: 38,
          border: 'none', background: '#fff',
          boxShadow: '0 0 0 5px rgba(255,255,255,0.18), 0 12px 30px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} aria-label="Foto maken">
          <span style={{ width: 60, height: 60, borderRadius: 30, background: '#fff', border: '3px solid #0B1220' }}/>
        </button>
      </div>

      <input ref={inpRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }}/>
    </div>
  );
}

window.ScanScreen = ScanScreen;
