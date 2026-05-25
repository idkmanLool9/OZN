// Screen — Login (Verifi-welkomscherm-stijl met Supabase Auth)

function LoginScreen({ onSuccess }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await SBAuth.signIn(email, password);
      onSuccess && onSuccess();
    } catch (e) {
      setErr(e.message && /invalid|credentials/i.test(e.message)
        ? 'Onjuist e-mailadres of wachtwoord.'
        : (e.message || 'Inloggen mislukt'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell>
      {/* Background glow blobs */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 360, height: 360,
                    background: 'radial-gradient(closest-side, rgba(37,99,235,0.18), rgba(37,99,235,0))',
                    pointerEvents: 'none', zIndex: 0 }}/>
      <div style={{ position: 'absolute', bottom: -160, left: -100, width: 360, height: 360,
                    background: 'radial-gradient(closest-side, rgba(249,115,22,0.12), rgba(249,115,22,0))',
                    pointerEvents: 'none', zIndex: 0 }}/>

      <StatusBar/>

      {/* Header */}
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

      {!showForm ? (
        // Welcome state — Hero + 'Inloggen om te scannen'
        <>
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
            <PrimaryButton onClick={() => setShowForm(true)} icon={<Icon.Doc size={18} c="#fff"/>}>
              Aan de slag
            </PrimaryButton>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: T.muted, fontWeight: 500 }}>
              <Icon.Shield c={T.muted} size={12}/>
              Beveiligd · gedeelde inlog met Uitvaartbeheer
            </div>
          </div>
        </>
      ) : (
        // Login state — email + wachtwoord
        <>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2, padding: '0 28px' }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: -1, lineHeight: 1.1 }}>Inloggen</div>
                <div style={{ fontSize: 15, color: T.muted, marginTop: 8, lineHeight: 1.45 }}>Met je SOK-uitvaartleider-account.</div>
              </div>

              {err && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', color: T.red,
                  padding: '12px 14px', borderRadius: T.rSm, marginBottom: 14,
                  fontSize: 13.5, fontWeight: 500,
                  border: '1px solid rgba(239,68,68,0.18)',
                }}>{err}</div>
              )}

              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field type="email" placeholder="E-mailadres" value={email} onChange={setEmail} autoComplete="username" required autoFocus/>
                <Field type="password" placeholder="Wachtwoord" value={password} onChange={setPassword} autoComplete="current-password" required/>
                <div style={{ height: 8 }}/>
                <PrimaryButton type="submit" disabled={busy}>{busy ? <Icon.Spinner/> : 'Inloggen'}</PrimaryButton>
                <TertiaryButton onClick={() => { setShowForm(false); setErr(''); }}>Terug</TertiaryButton>
              </form>
            </div>
          </div>
        </>
      )}
    </ScreenShell>
  );
}

function Field({ type, placeholder, value, onChange, autoComplete, required, autoFocus }) {
  return (
    <input
      type={type} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete} required={required} autoFocus={autoFocus}
      style={{
        width: '100%', height: 54, padding: '0 18px',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid ' + T.hair, borderRadius: T.r,
        fontFamily: T.font, fontSize: 16, color: T.ink, outline: 'none',
        transition: 'border-color .12s ease, box-shadow .12s ease',
      }}
      onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.12)'; }}
      onBlur={e => { e.target.style.borderColor = T.hair; e.target.style.boxShadow = 'none'; }}
    />
  );
}

window.LoginScreen = LoginScreen;
