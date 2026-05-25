// shared.jsx — design tokens + UI-primitives + camera-helpers
// Overgenomen uit de Claude-Design Verifi-mockups (iOS 26-stijl).

const T = {
  blue: '#2563EB', blueDeep: '#1D4ED8', blueSoft: '#EFF6FF', blueTint: '#DBEAFE',
  orange: '#F97316', orangeSoft: '#FFF7ED',
  green: '#10B981', greenSoft: '#ECFDF5',
  red: '#EF4444',
  ink: '#0B1220', ink2: '#1F2937',
  body: '#374151', muted: '#6B7280', faint: '#9CA3AF',
  hair: 'rgba(15, 23, 42, 0.08)',
  bg: '#FFFFFF', bg2: '#F7F8FA', bg3: '#F2F4F7',
  r: 18, rSm: 12, rLg: 24,
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
};

function ScreenShell({ children, dark = false, style }) {
  return (
    <div className="verifi-fade-in" style={{
      width: '100%', minHeight: '100%',
      background: dark ? '#000' : '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: T.font, color: dark ? '#fff' : T.ink,
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>{children}</div>
  );
}

function StatusBar({ dark = false }) {
  const c = dark ? '#fff' : '#000';
  const [time, setTime] = React.useState(() => {
    const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  });
  React.useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`);
    }, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 24px 4px', boxSizing: 'border-box', zIndex: 20, width: '100%',
      position: 'relative',
    }}>
      <span style={{ fontWeight: 600, fontSize: 15, color: c, letterSpacing: -0.2 }}>{time}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="11" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={c}/><rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={c}/><rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={c}/><rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={c}/></svg>
        <svg width="22" height="11" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill={c}/></svg>
      </span>
    </div>
  );
}

function BrandMark({ size = 44 }) {
  const id = 'bm-grad-' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="44" y2="44">
          <stop offset="0" stopColor="#3B82F6"/>
          <stop offset="1" stopColor="#1D4ED8"/>
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill={`url(#${id})`}/>
      <path d="M22 9 L33 13 V22 C33 28.5 28.4 33 22 35 C15.6 33 11 28.5 11 22 V13 L22 9 Z"
            fill="#fff" fillOpacity="0.18" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M16.5 21.5 L20.5 25.5 L28 18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────
function PrimaryButton({ children, icon, style, dark, onClick, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 56, border: 'none', borderRadius: 28,
      background: disabled ? '#94A3B8' : T.blue, color: '#fff',
      fontFamily: T.font, fontSize: 17, fontWeight: 600, letterSpacing: -0.3,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06), 0 6px 16px rgba(37, 99, 235, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform .12s ease, filter .12s ease',
      ...style,
    }}>{icon}{children}</button>
  );
}

function SecondaryButton({ children, icon, style, dark = false, onClick, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 56, border: 'none', borderRadius: 28,
      background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      color: dark ? '#fff' : T.ink,
      fontFamily: T.font, fontSize: 17, fontWeight: 600, letterSpacing: -0.3,
      boxShadow: dark
        ? 'inset 0 0 0 0.5px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.10)'
        : 'inset 0 0 0 0.5px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(15,23,42,0.03)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      cursor: 'pointer',
      ...style,
    }}>{icon}{children}</button>
  );
}

function TertiaryButton({ children, icon, style, dark = false, onClick, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} style={{
      width: '100%', height: 48, border: 'none', borderRadius: 24,
      background: 'transparent',
      color: dark ? 'rgba(255,255,255,0.82)' : T.muted,
      fontFamily: T.font, fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      cursor: 'pointer',
      ...style,
    }}>{icon}{children}</button>
  );
}

function NavGlyphButton({ icon, onClick, style, dark = false, size = 38, ariaLabel }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} style={{
      width: size, height: size, borderRadius: size/2,
      border: 'none',
      background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(15, 23, 42, 0.04)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      boxShadow: dark
        ? 'inset 0 0 0 0.5px rgba(255,255,255,0.18)'
        : 'inset 0 0 0 0.5px rgba(15, 23, 42, 0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      ...style,
    }}>{icon}</button>
  );
}

function GlassPill({ children, style, dark = false, tint }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px',
      borderRadius: 999,
      background: tint || (dark ? 'rgba(20,22,30,0.55)' : 'rgba(255,255,255,0.72)'),
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      border: '0.5px solid ' + (dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)'),
      boxShadow: dark
        ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(0,0,0,0.25)'
        : '0 4px 14px rgba(0,0,0,0.06)',
      color: dark ? '#fff' : T.ink, fontFamily: T.font, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
      ...style,
    }}>{children}</div>
  );
}

function SupportChip({ label }) {
  return (
    <div style={{
      padding: '7px 12px', borderRadius: 999,
      background: T.bg3, color: T.body,
      fontSize: 12.5, fontWeight: 600, letterSpacing: -0.1,
    }}>{label}</div>
  );
}

function StepBar({ step = 1, total = 4 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 14 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i < step ? T.blue : T.bg3,
        }}/>
      ))}
    </div>
  );
}

function Dot({ color = T.green, size = 8, pulse = false }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: size,
      background: color, boxShadow: pulse ? `0 0 0 4px ${color}33` : 'none',
    }} />
  );
}

// ─── Icons ───────────────────────────────────────────────────────
const Icon = {
  Close: ({ size = 18, c = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 18 18" fill="none"><path d="M3.5 3.5l11 11M14.5 3.5l-11 11" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>),
  Chevron: ({ size = 14, c = '#0B1220', dir = 'right' }) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ transform: dir === 'left' ? 'scaleX(-1)' : 'none' }}><path d="M5 2l5 5-5 5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Check: ({ size = 14, c = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M3 7.5L6 10.5 11.5 4" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Shield: ({ size = 14, c = '#10B981' }) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M7 1.5L12 3v4.2c0 2.6-1.9 4.6-5 5.3-3.1-.7-5-2.7-5-5.3V3l5-1.5Z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" fill="none"/><path d="M4.7 7.2L6.4 8.9 9.5 5.8" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>),
  Lock: ({ size = 14, c = '#10B981' }) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><rect x="3" y="6.2" width="8" height="6.3" rx="1.4" stroke={c} strokeWidth="1.4" fill="none"/><path d="M4.6 6.2V4.4a2.4 2.4 0 014.8 0v1.8" stroke={c} strokeWidth="1.4" fill="none"/></svg>),
  Flash: ({ size = 18, c = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 18 18" fill="none"><path d="M10 1L3 10h5l-1 7 7-9H9l1-7z" fill={c}/></svg>),
  Sparkle: ({ size = 14, c = '#F97316' }) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M7 1l1.4 4.2L12.5 7 8.4 8.4 7 12.5 5.6 8.4 1.5 7l4.1-1.8L7 1z" fill={c}/></svg>),
  Edit: ({ size = 14, c = '#6B7280' }) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M2 12l1-3 6.5-6.5a1.4 1.4 0 012 2L5 11l-3 1z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>),
  Retake: ({ size = 18, c = '#0B1220' }) => (<svg width={size} height={size} viewBox="0 0 18 18" fill="none"><path d="M3 9a6 6 0 1 0 1.5-4" stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none"/><path d="M2 3v3h3" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>),
  Doc: ({ size = 16, c = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="10" rx="1.6" stroke={c} strokeWidth="1.5" fill="none"/><path d="M5 6.5h6M5 9h4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>),
  Passport: ({ size = 26, c = '#0B1220' }) => (<svg width={size} height={size} viewBox="0 0 26 26" fill="none"><rect x="4" y="2" width="18" height="22" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="13" cy="11" r="4" stroke={c} strokeWidth="1.5" fill="none"/><path d="M9 19h8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>),
  IDCard: ({ size = 26, c = '#0B1220' }) => (<svg width={size} height={size} viewBox="0 0 26 26" fill="none"><rect x="2" y="5" width="22" height="16" rx="2.4" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="9" cy="12.5" r="2.6" stroke={c} strokeWidth="1.5" fill="none"/><path d="M6.4 18.5c.5-1.6 1.7-2.5 2.6-2.5s2.1.9 2.6 2.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/><path d="M14 11h7M14 14h5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>),
  Licence: ({ size = 26, c = '#0B1220' }) => (<svg width={size} height={size} viewBox="0 0 26 26" fill="none"><rect x="2" y="5" width="22" height="16" rx="2.4" stroke={c} strokeWidth="1.5" fill="none"/><rect x="5" y="9" width="6" height="6" rx="0.8" stroke={c} strokeWidth="1.4" fill="none"/><path d="M14 10h6M14 13h6M14 16h4" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>),
  Person: ({ size = 26, c = '#0B1220' }) => (<svg width={size} height={size} viewBox="0 0 26 26" fill="none"><circle cx="13" cy="9" r="4" stroke={c} strokeWidth="1.5" fill="none"/><path d="M5 22c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>),
  Family: ({ size = 26, c = '#0B1220' }) => (<svg width={size} height={size} viewBox="0 0 26 26" fill="none"><circle cx="8" cy="9" r="3" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="18" cy="9" r="3" stroke={c} strokeWidth="1.5" fill="none"/><path d="M2 21c0-3 2.6-5 6-5s6 2 6 5M12 21c0-3 2.6-5 6-5s6 2 6 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>),
  Search: ({ size = 16, c = '#6B7280' }) => (<svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke={c} strokeWidth="1.6"/><path d="M10.3 10.3L13.5 13.5" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>),
  Spinner: ({ size = 20, c = '#fff' }) => (
    <span style={{ display: 'inline-flex', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.9s linear infinite' }}>
        <circle cx="12" cy="12" r="9" stroke={c} strokeOpacity="0.25" strokeWidth="3" fill="none"/>
        <path d="M21 12a9 9 0 0 0-9-9" stroke={c} strokeWidth="3" strokeLinecap="round" fill="none"/>
      </svg>
    </span>
  ),
};

// ─── Flags (NL hoofdzaak) ────────────────────────────────────────
function Flag({ code = 'NL', size = 22 }) {
  const w = size * 1.4, h = size;
  const flags = {
    NL: <><rect width="30" height="7"  fill="#AE1C28"/><rect width="30" height="7"  y="7"  fill="#fff"/><rect width="30" height="7"  y="14" fill="#21468B"/></>,
    BE: <><rect width="10" height="21" fill="#000"/><rect width="10" height="21" x="10" fill="#FAE042"/><rect width="10" height="21" x="20" fill="#ED2939"/></>,
    DE: <><rect width="30" height="7"  fill="#000"/><rect width="30" height="7"  y="7"  fill="#DD0000"/><rect width="30" height="7"  y="14" fill="#FFCE00"/></>,
  };
  return (
    <span style={{ display: 'inline-block', width: w, height: h, flexShrink: 0, borderRadius: 4, overflow: 'hidden', boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)', verticalAlign: 'middle' }}>
      <svg width={w} height={h} viewBox="0 0 30 21" preserveAspectRatio="none">{flags[code] || <rect width="30" height="21" fill="#E5E7EB"/>}</svg>
    </span>
  );
}

// ─── HeroIllustration (gebruikt op Login/Welcome) ─────────────────
// Gestapelde NL paspoort + ID-kaart, zoals in het mockup.
function HeroIllustration() {
  return (
    <div style={{ position: 'relative', width: 320, height: 230 }}>
      <div style={{
        position: 'absolute', inset: -30,
        background: 'radial-gradient(closest-side, rgba(37,99,235,0.16), rgba(37,99,235,0))',
        filter: 'blur(20px)',
      }} />
      {/* NL Passport burgundy */}
      <div style={{
        position: 'absolute', left: 18, top: 30, width: 180, height: 130, borderRadius: 14,
        background: 'linear-gradient(150deg, #7B1D1D 0%, #5B1414 60%, #3B0A0A 100%)',
        transform: 'rotate(-9deg)',
        boxShadow: '0 22px 50px rgba(15, 23, 42, 0.32), 0 4px 12px rgba(15, 23, 42, 0.16)',
        color: '#E9D9A8', padding: 16,
      }}>
        <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.2, opacity: 0.85, textAlign: 'center' }}>KONINKRIJK DER NEDERLANDEN</div>
        <div style={{ position: 'absolute', top: 36, left: '50%', transform: 'translateX(-50%)', width: 56, height: 56, borderRadius: 28, border: '1.2px solid rgba(233,217,168,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="36" height="40" viewBox="0 0 36 40" fill="none">
            <path d="M18 4 L32 8 V22 C32 30 25 36 18 38 C11 36 4 30 4 22 V8 L18 4 Z" stroke="rgba(233,217,168,0.85)" strokeWidth="1.4" fill="rgba(233,217,168,0.08)"/>
            <path d="M11 16 Q13 12 18 12 Q23 12 25 16 Q24 22 18 26 Q12 22 11 16 Z" fill="rgba(233,217,168,0.7)"/>
          </svg>
        </div>
        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 8, fontWeight: 700, letterSpacing: 2.5, color: 'rgba(233,217,168,0.9)' }}>PASPOORT</div>
      </div>
      {/* NL ID-kaart */}
      <div style={{
        position: 'absolute', right: 8, bottom: 12, width: 220, height: 138, borderRadius: 14,
        background: 'linear-gradient(135deg, #ffffff 0%, #F1F5F9 100%)',
        transform: 'rotate(6deg)',
        boxShadow: '0 28px 60px rgba(15, 23, 42, 0.22), 0 6px 16px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(15, 23, 42, 0.06)',
        padding: 12, overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: `linear-gradient(90deg, #AE1C28, #ffffff 50%, #21468B)` }}/>
        <div style={{ position: 'relative', display: 'flex', gap: 10, paddingTop: 18 }}>
          <div style={{ width: 50, height: 60, borderRadius: 6, background: 'linear-gradient(160deg, #D1D5DB, #9CA3AF)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: 9, background: '#E5E7EB'}}/>
            <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 36, height: 32, borderRadius: '50% 50% 0 0', background: '#E5E7EB'}}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 6, fontWeight: 700, color: T.faint, letterSpacing: 0.6 }}>ACHTERNAAM</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.ink, marginTop: 2, lineHeight: 1.1 }}>VAN DER BERG</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>Sanne M.</div>
            <div style={{ fontSize: 6, fontWeight: 700, color: T.faint, letterSpacing: 0.6, marginTop: 6 }}>GEB.DATUM</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: T.ink2, fontFamily: T.mono }}>14·03·1991</div>
          </div>
        </div>
        <div style={{
          position: 'absolute', top: 30, right: 12, width: 22, height: 18, borderRadius: 3,
          background: 'linear-gradient(135deg, #FBBF24, #D97706)',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
        }}/>
      </div>
    </div>
  );
}

// ─── Camera-helpers (donkere scan-schermen) ──────────────────────
function CameraBg({ children, vignette = true }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at 30% 20%, #1f2937 0%, #0b1220 55%, #050810 100%)',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 0%, transparent 38%, rgba(120,80,60,0.18) 70%, rgba(60,40,30,0.35) 100%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1.5px)', backgroundSize: '3px 3px', mixBlendMode: 'overlay', pointerEvents: 'none' }} />
      {vignette && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)' }}/>}
      {children}
    </div>
  );
}

function CameraTopBar({ docLabel = 'Document', countryCode = 'NL', onClose, onFlash }) {
  return (
    <div style={{
      position: 'absolute', top: 56, left: 0, right: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
    }}>
      <NavGlyphButton dark size={40} onClick={onClose} ariaLabel="Sluiten" icon={<Icon.Close size={16}/>}/>
      <GlassPill dark style={{ padding: '6px 12px 6px 6px', fontSize: 13, gap: 8 }}>
        <Flag code={countryCode} size={20}/>
        {docLabel}
      </GlassPill>
      <NavGlyphButton dark size={40} onClick={onFlash} ariaLabel="Flits" icon={<Icon.Flash size={16}/>}/>
    </div>
  );
}

function CameraFooter({ status, subtext }) {
  return (
    <div style={{
      position: 'absolute', bottom: 130, left: 0, right: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '0 24px', textAlign: 'center',
    }}>
      <div style={{ color: '#fff', fontSize: 17, fontWeight: 600, letterSpacing: -0.3 }}>{status}</div>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 500, letterSpacing: -0.1 }}>{subtext}</div>
    </div>
  );
}

function DetectedCorners({ color = '#60A5FA', glow = false, style }) {
  const t = 3, len = 26;
  const corner = (rot, pos, key) => (
    <div key={key} style={{ position: 'absolute', ...pos, width: len, height: len, transform: `rotate(${rot}deg)` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: t, height: len, background: color, borderRadius: t, boxShadow: glow ? `0 0 12px ${color}` : 'none' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: len, height: t, background: color, borderRadius: t, boxShadow: glow ? `0 0 12px ${color}` : 'none' }} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: -10, pointerEvents: 'none', ...style }}>
      {corner(0,   { left: 0, top: 0 }, 1)}
      {corner(90,  { right: 0, top: 0 }, 2)}
      {corner(-90, { left: 0, bottom: 0 }, 3)}
      {corner(180, { right: 0, bottom: 0 }, 4)}
    </div>
  );
}

function DetectionPolygon({ color = '#60A5FA' }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} preserveAspectRatio="none" viewBox="0 0 100 100">
      <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="2" ry="2" fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="0.45" strokeDasharray="2 1.4" />
    </svg>
  );
}

Object.assign(window, {
  T, ScreenShell, StatusBar, BrandMark,
  PrimaryButton, SecondaryButton, TertiaryButton, NavGlyphButton, GlassPill,
  SupportChip, StepBar, Dot, Icon, Flag, HeroIllustration,
  CameraBg, CameraTopBar, CameraFooter, DetectedCorners, DetectionPolygon,
});
