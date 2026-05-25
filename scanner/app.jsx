// Verifi — state-machine + screen-orchestratie.
//
// Flow:
//   loading → login → picker → target → doc-select → scan
//          → progress (kwaliteitscontroles) → review (foto bevestigen)
//          → ocr (velden bewerken) → success → terug naar picker

function App() {
  const [screen, setScreen] = React.useState('loading');
  const [session, setSession] = React.useState(null);
  const [dossier, setDossier] = React.useState(null);
  const [target, setTarget] = React.useState(null);
  const [docType, setDocType] = React.useState(null);
  const [scanFile, setScanFile] = React.useState(null);
  const [ocrFields, setOcrFields] = React.useState({});
  const [ocrRawText, setOcrRawText] = React.useState('');
  const [savedFields, setSavedFields] = React.useState({});
  const [errMsg, setErrMsg] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const sess = await SBAuth.session();
      setSession(sess);
      setScreen('welcome');
    })();
  }, []);

  const onWelcomeContinue = () => {
    if (session) setScreen('picker'); else setScreen('login');
  };
  const onLoggedIn = async () => {
    const sess = await SBAuth.session();
    setSession(sess); setScreen('picker');
  };
  const onSignOut = async () => {
    await SBAuth.signOut();
    setSession(null); setDossier(null); setTarget(null); setDocType(null);
    setScanFile(null); setOcrFields({}); setSavedFields({});
    setScreen('login');
  };
  const onPickDossier = (d) => { setDossier(d); setScreen('target'); };
  const onPickTarget  = (t) => { setTarget(t);  setScreen('doc-select'); };
  const onPickDocType = (dt) => { setDocType(dt); setScreen('scan'); };
  const onScanned     = (f) => { setScanFile(f); setScreen('progress'); };
  const onProgressDone = ({ file, fields, rawText }) => {
    setScanFile(file);
    setOcrFields(fields || {});
    setOcrRawText(rawText || '');
    setScreen('review');
  };
  const onReviewUse = () => { setScreen('ocr'); };
  const onReviewRetake = () => { setScanFile(null); setScreen('scan'); };

  const onConfirm = async (patch, file) => {
    try {
      if (Object.keys(patch).length > 0) {
        await updateDossier(dossier.id, patch);
      }
      if (file) {
        const naam = `${docType.label} — ${target === 'overledene' ? 'overledene' : 'contactpersoon'}`;
        await uploadDocument(dossier.id, file, { naam, type: 'identiteitsbewijs' });
      }
      setSavedFields(patch);
      setScreen('success');
    } catch (e) {
      setErrMsg(e.message || String(e));
      setScreen('error');
    }
  };

  const onContinue = () => {
    setDossier(null); setTarget(null); setDocType(null);
    setScanFile(null); setOcrFields({}); setSavedFields({});
    setScreen('picker');
  };

  let content = null;
  if (screen === 'loading') {
    content = <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><Icon.Spinner size={28} c={T.blue}/></div>;
  } else if (screen === 'welcome') {
    content = <WelcomeScreen session={session} onContinue={onWelcomeContinue}/>;
  } else if (screen === 'login') {
    content = <LoginScreen onSuccess={onLoggedIn} onBack={() => setScreen('welcome')}/>;
  } else if (screen === 'picker') {
    content = <PickerScreen onPick={onPickDossier} onSignOut={onSignOut}/>;
  } else if (screen === 'target') {
    content = <TargetScreen dossier={dossier} onPick={onPickTarget} onBack={() => setScreen('picker')}/>;
  } else if (screen === 'doc-select') {
    content = <DocSelectScreen dossier={dossier} target={target} onPick={onPickDocType} onBack={() => setScreen('target')}/>;
  } else if (screen === 'scan') {
    content = <ScanScreen dossier={dossier} target={target} docType={docType} onScanned={onScanned} onBack={() => setScreen('doc-select')}/>;
  } else if (screen === 'progress') {
    content = <ProgressScreen file={scanFile} docType={docType} onDone={onProgressDone} onBack={() => setScreen('scan')}/>;
  } else if (screen === 'review') {
    content = <ReviewScreen file={scanFile} docType={docType} onUse={onReviewUse} onRetake={onReviewRetake}/>;
  } else if (screen === 'ocr') {
    content = <OCRScreen dossier={dossier} target={target} docType={docType} file={scanFile} fields={ocrFields} rawText={ocrRawText} onConfirm={onConfirm} onBack={() => setScreen('review')}/>;
  } else if (screen === 'success') {
    content = <SuccessScreen dossier={dossier} target={target} docType={docType} savedFields={savedFields} file={scanFile} onContinue={onContinue}/>;
  } else if (screen === 'error') {
    content = (
      <ScreenShell>
        <StatusBar/>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.red, marginBottom: 10 }}>Opslaan mislukt</div>
          <div style={{ fontSize: 14, color: T.muted, marginBottom: 24, maxWidth: 320, lineHeight: 1.5 }}>{errMsg}</div>
          <div style={{ width: '100%', maxWidth: 320 }}>
            <PrimaryButton onClick={() => setScreen('ocr')}>Opnieuw proberen</PrimaryButton>
          </div>
        </div>
      </ScreenShell>
    );
  }

  return (
    <>
      <div className="verifi-shell">{content}</div>
      <InstallPrompt/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
