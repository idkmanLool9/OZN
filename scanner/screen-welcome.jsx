// Screen — Welkom (entry-point, altijd getoond bij app-start)

function WelcomeScreen({ session, onContinue }) {
  return (
    <ScreenShell>
      <div style={{ position: 'absolute', top: -120, right: -120, width: 360, height: 360,
                    background: 'radial-gradient(closest-side, rgba(37,99,235,0.18), rgba(37,99,235,0))',
                    pointerEvents: 'none', zIndex: 0 }}/>
      <div style={{ position: 'absolute', bottom: -160, left: -100, width: 360, height: 360,
                    background: 'radial-gradient(closest-side, rgba(249,115,22,0.12), rgba(249,115,22,0))',
                    pointerEvents: 'none', zIndex: 0 }}/>

      <StatusBar/>

      <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={32}/>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Verifi</span>
        </div>
        <GlassPill style={{ padding: '6px 10px', fontSize: 12, color: T.green }}>
          <Icon.Lock c={T.green} size={12}/>
          On-device
        </GlassPill>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: 18, zIndex: 1 }}>
        <HeroIllustration />
      </div>

      <div style={{ padding: '0 28px 8px', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: T.ink, letterSpacing: -1.1, lineHeight: 1.05 }}>
          Verifieer je<br/>identiteit in seconden.
        </div>
        <div style={{ fontSize: 16, fontWeight: 400, color: T.muted, lineHeight: 1.45, marginTop: 14, letterSpacing: -0.1, maxWidth: 320 }}>
          Scan paspoort, ID-kaart of rijbewijs. Velden worden direct in het juiste dossier gezet.
        </div>
      </div>

      <div style={{ padding: '20px 24px 0', display: 'flex', gap: 8, position: 'relative', zIndex: 2 }}>
        <SupportChip label="Paspoort"/>
        <SupportChip label="ID-kaart"/>
        <SupportChip label="Rijbewijs"/>
      </div>

      <div style={{ padding: '24px 24px 40px', position: 'relative', zIndex: 2 }}>
        <PrimaryButton onClick={onContinue} icon={<Icon.Doc size={18} c="#fff"/>}>
          {session ? 'Document scannen' : 'Aan de slag'}
        </PrimaryButton>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: T.muted, fontWeight: 500 }}>
          <Icon.Shield c={T.muted} size={12}/>
          Beveiligd · gedeelde inlog met Uitvaartbeheer
        </div>
      </div>
    </ScreenShell>
  );
}

window.WelcomeScreen = WelcomeScreen;
