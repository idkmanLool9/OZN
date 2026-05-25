// utils.jsx — device-detectie + PWA install-helpers

const Device = {
  // iPad detecteert zichzelf op iPadOS 13+ als "MacIntel" → check ook touch
  isIPad() {
    const ua = navigator.userAgent;
    if (/iPad/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  },
  isIPhone() { return /iPhone/.test(navigator.userAgent); },
  isAndroidPhone() {
    const ua = navigator.userAgent;
    return /Android/.test(ua) && /Mobile/.test(ua);
  },
  isAndroidTablet() {
    const ua = navigator.userAgent;
    return /Android/.test(ua) && !/Mobile/.test(ua);
  },
  isMobile() { return Device.isIPhone() || Device.isAndroidPhone(); },
  isTablet() { return Device.isIPad() || Device.isAndroidTablet(); },
  isIOS() { return Device.isIPhone() || Device.isIPad(); },
  isDesktop() { return !Device.isMobile() && !Device.isTablet(); },
  isStandalone() {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  },
  isChrome() {
    const ua = navigator.userAgent;
    return /Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua);
  },
  isSafari() {
    const ua = navigator.userAgent;
    return /Safari/.test(ua) && !/Chrome/.test(ua);
  },
  type() {
    if (Device.isMobile())  return 'phone';
    if (Device.isTablet())  return 'tablet';
    return 'desktop';
  },
};

// PWA install: vang het beforeinstallprompt-event (Chromium-browsers) zodat
// we 'm later kunnen tonen via een eigen knop. Op iOS/iPadOS bestaat dit
// event niet — daar moet de gebruiker via Safari's deel-menu installeren.
let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
});
window.addEventListener('appinstalled', () => { _deferredPrompt = null; });

const PWAInstall = {
  // Kan via Chrome's prompt?
  canPromptChrome() { return !!_deferredPrompt; },
  // Open Chrome's eigen install-prompt
  async promptChrome() {
    if (!_deferredPrompt) return false;
    _deferredPrompt.prompt();
    const choice = await _deferredPrompt.userChoice;
    _deferredPrompt = null;
    return choice.outcome === 'accepted';
  },
  // Of we überhaupt iets moeten tonen
  shouldShow() {
    if (Device.isStandalone()) return false; // al geïnstalleerd
    if (sessionStorage.getItem('verifi-install-dismissed')) return false;
    return true;
  },
  dismiss() {
    try { sessionStorage.setItem('verifi-install-dismissed', '1'); } catch (_) {}
  },
};

window.Device = Device;
window.PWAInstall = PWAInstall;
