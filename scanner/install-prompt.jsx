// PWA Install Prompt — toont een banner met installatie-instructies of
// roept Chrome's eigen install-prompt aan, afhankelijk van het apparaat.

function InstallPrompt({ onDismiss }) {
  const [open, setOpen] = React.useState(false);
  const [forceClosed, setForceClosed] = React.useState(false);

  // Toon de prompt eenmaal per sessie, na 2 seconden, op tablet/desktop
  React.useEffect(() => {
    if (!PWAInstall.shouldShow()) return;
    if (Device.isMobile()) return; // op telefoon doe je 'toevoegen aan beginscherm' impliciet
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    setForceClosed(true);
    PWAInstall.dismiss();
    onDismiss && onDismiss();
  };

  const install = async () => {
    if (PWAInstall.canPromptChrome()) {
      const ok = await PWAInstall.promptChrome();
      if (ok) close();
    }
  };

  if (!open || forceClosed) return null;

  // Twee varianten: Chromium met native prompt, of iOS Safari (handmatige instructies)
  const canPrompt = PWAInstall.canPromptChrome();
  const isIos = Device.isIOS();

  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
      width: '100%', maxWidth: 420, padding: '0 16px',
      zIndex: 1000, animation: 'fadeIn .35s ease both',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 20px 50px rgba(15,23,42,0.25), 0 0 0 1px rgba(15,23,42,0.06)',
        padding: '16px 18px',
        display: 'flex', gap: 14, alignItems: 'flex-start',
        fontFamily: T.font,
      }}>
        <div style={{ flexShrink: 0 }}>
          <BrandMark size={42}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>
            Installeer Verifi
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, marginTop: 2, lineHeight: 1.4, letterSpacing: -0.05 }}>
            {canPrompt
              ? 'Voeg toe als app — voelt en werkt sneller dan in de browser.'
              : isIos
                ? <>Tik op <strong style={{ color: T.ink }}>⎙ Deel</strong> onderin Safari → <strong style={{ color: T.ink }}>Voeg toe aan beginscherm</strong>.</>
                : 'Klik op het install-icoon in je adresbalk om de app te installeren.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {canPrompt && (
              <button onClick={install} style={{
                height: 36, padding: '0 14px',
                border: 'none', borderRadius: 18, background: T.blue, color: '#fff',
                fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
              }}>Installeren</button>
            )}
            <button onClick={close} style={{
              height: 36, padding: '0 14px',
              border: 'none', borderRadius: 18,
              background: T.bg3, color: T.body,
              fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
            }}>{canPrompt ? 'Niet nu' : 'Begrepen'}</button>
          </div>
        </div>
        <button onClick={close} style={{
          width: 28, height: 28, border: 'none', borderRadius: 14,
          background: T.bg3, color: T.body, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }} aria-label="Sluiten">
          <Icon.Close size={12} c={T.body}/>
        </button>
      </div>
    </div>
  );
}

window.InstallPrompt = InstallPrompt;
