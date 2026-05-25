// shared.jsx — design tokens + UI-primitives (Verifi iOS 26-stijl)
// Overgenomen uit de Claude-Design-mockups, kleine aanpassingen voor
// productie-gebruik (geen PhoneFrame, geen DesignCanvas).

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
  // Achtergrond + flex-kolom. Voor dark camera-schermen pas je de bg aan.
  return (
    <div className="verifi-fade-in" style={{
      width: '100%', minHeight: '100%',
      background: dark ? '#0B1220' : '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: T.font, color: dark ? '#fff' : T.ink,
      ...style,
    }}>{children}</div>
  );
}

// iOS status-bar simulatie — eenvoudige header met tijd + signal-iconen
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
      padding: '14px 24px 6px', boxSizing: 'border-box', zIndex: 20, width: '100%',
    }}>
      <span style={{ fontWeight: 600, fontSize: 15, color: c, letterSpacing: -0.2 }}>{time}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="11" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={c}/><rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={c}/><rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={c}/><rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={c}/></svg>
        <svg width="22" height="11" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill={c}/></svg>
      </span>
    </div>
  );
}

// Branded logo: een schild met checkmark in een blauwe afgeronde tegel
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

// 4 L-vormige corner-brackets voor de camera-viewfinder
function CornerBrackets({ color = '#fff', size = 28, thickness = 4, style, len }) {
  const L = len || size;
  const corner = (rot, pos) => (
    <div style={{ position: 'absolute', ...pos, width: L, height: L, transform: `rotate(${rot}deg)` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: thickness, height: L, background: color, borderRadius: thickness/2 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: L, height: thickness, background: color, borderRadius: thickness/2 }} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
      {corner(0, { left: 0, top: 0 })}
      {corner(90, { right: 0, top: 0 })}
      {corner(-90, { left: 0, bottom: 0 })}
      {corner(180, { right: 0, bottom: 0 })}
    </div>
  );
}

// Knoppen — iOS 26-stijl, 56px hoog, 28px radius
function PrimaryButton({ children, icon, style, dark, onClick, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 56, border: 'none', borderRadius: 28,
      background: disabled ? '#94A3B8' : T.blue, color: '#fff',
      fontFamily: T.font, fontSize: 17, fontWeight: 600, letterSpacing: -0.3,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06), 0 6px 16px rgba(37, 99, 235, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform .12s ease, filter .12s ease, box-shadow .12s ease',
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

// Klein cirkel-glyph-knopje (back-arrow / close)
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
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      borderRadius: 999,
      background: tint || (dark ? 'rgba(20,22,30,0.55)' : 'rgba(255,255,255,0.72)'),
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      border: '0.5px solid ' + (dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)'),
      color: dark ? '#fff' : T.ink, fontFamily: T.font, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
      ...style,
    }}>{children}</div>
  );
}

// Stappen-progress-bar (4 segmenten, vul-percentage instelbaar)
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

const Icon = {
  Close: ({ size = 18, c = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none"><path d="M3.5 3.5l11 11M14.5 3.5l-11 11" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>
  ),
  Chevron: ({ size = 14, c = '#0B1220', dir = 'right' }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ transform: dir === 'left' ? 'scaleX(-1)' : 'none' }}><path d="M5 2l5 5-5 5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Check: ({ size = 14, c = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M3 7.5L6 10.5 11.5 4" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Lock: ({ size = 14, c = '#10B981' }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none"><rect x="3" y="6.2" width="8" height="6.3" rx="1.4" stroke={c} strokeWidth="1.4" fill="none"/><path d="M4.6 6.2V4.4a2.4 2.4 0 014.8 0v1.8" stroke={c} strokeWidth="1.4" fill="none"/></svg>
  ),
  Search: ({ size = 16, c = '#6B7280' }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke={c} strokeWidth="1.6"/><path d="M10.3 10.3L13.5 13.5" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  Spinner: ({ size = 20, c = '#fff' }) => (
    <span style={{ display: 'inline-flex', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.9s linear infinite' }}>
        <circle cx="12" cy="12" r="9" stroke={c} strokeOpacity="0.25" strokeWidth="3" fill="none"/>
        <path d="M21 12a9 9 0 0 0-9-9" stroke={c} strokeWidth="3" strokeLinecap="round" fill="none"/>
      </svg>
    </span>
  ),
  IDCard: ({ size = 26, c = '#0B1220' }) => (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none"><rect x="2" y="5" width="22" height="16" rx="2.4" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="9" cy="12.5" r="2.6" stroke={c} strokeWidth="1.5" fill="none"/><path d="M6.4 18.5c.5-1.6 1.7-2.5 2.6-2.5s2.1.9 2.6 2.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/><path d="M14 11h7M14 14h5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  Passport: ({ size = 26, c = '#0B1220' }) => (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none"><rect x="4" y="2" width="18" height="22" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="13" cy="11" r="4" stroke={c} strokeWidth="1.5" fill="none"/><path d="M9 19h8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  Licence: ({ size = 26, c = '#0B1220' }) => (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none"><rect x="2" y="5" width="22" height="16" rx="2.4" stroke={c} strokeWidth="1.5" fill="none"/><rect x="5" y="9" width="6" height="6" rx="0.8" stroke={c} strokeWidth="1.4" fill="none"/><path d="M14 10h6M14 13h6M14 16h4" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>
  ),
  Person: ({ size = 26, c = '#0B1220' }) => (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none"><circle cx="13" cy="9" r="4" stroke={c} strokeWidth="1.5" fill="none"/><path d="M5 22c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
  ),
  Family: ({ size = 26, c = '#0B1220' }) => (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none"><circle cx="8" cy="9" r="3" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="18" cy="9" r="3" stroke={c} strokeWidth="1.5" fill="none"/><path d="M2 21c0-3 2.6-5 6-5s6 2 6 5M12 21c0-3 2.6-5 6-5s6 2 6 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
  ),
};

Object.assign(window, { T, ScreenShell, StatusBar, BrandMark, CornerBrackets, PrimaryButton, SecondaryButton, TertiaryButton, NavGlyphButton, GlassPill, StepBar, Icon });
