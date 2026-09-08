import { useEffect, useMemo, useState } from 'react';
import { detectInAppBrowser } from '../lib/inAppBrowser';
import { isIosOrIpad, isStandalone, shouldPromptInstall } from '../lib/installPrompt';
import { InstallPrompt } from './InstallPrompt';
import { OpenInBrowserNotice } from './OpenInBrowserNotice';

const IN_APP_DISMISSED_KEY = 'orchweather.inapp-dismissed';
const INSTALL_DISMISSED_KEY = 'orchweather.install-dismissed-at';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function readSessionDismissal(): boolean {
  try { return sessionStorage.getItem(IN_APP_DISMISSED_KEY) === '1'; } catch { return false; }
}

function readInstallDismissal(): number | null {
  try {
    const value = Number(localStorage.getItem(INSTALL_DISMISSED_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch { return null; }
}

function persistDismissal(key: string, value: string, storage: Storage): void {
  try { storage.setItem(key, value); } catch { /* Blocked storage must not prevent app use. */ }
}

function currentPlatform(userAgent: string, maxTouchPoints: number): 'ios' | 'android' | null {
  if (isIosOrIpad(userAgent, maxTouchPoints)) return 'ios';
  return /Android/i.test(userAgent) ? 'android' : null;
}

export function EnvironmentGuidance() {
  const [inAppDismissed, setInAppDismissed] = useState(readSessionDismissal);
  const [installDismissedAt, setInstallDismissedAt] = useState(readInstallDismissal);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [promptError, setPromptError] = useState(false);
  const [displayStartedAt] = useState(Date.now);
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints;
  const inAppBrowser = useMemo(() => detectInAppBrowser(userAgent), [userAgent]);
  const platform = currentPlatform(userAgent, maxTouchPoints);
  const eligibleForInstall = !installed && shouldPromptInstall({
    ua: userAgent, standalone: isStandalone(), maxTouchPoints, dismissedAt: installDismissedAt,
    now: displayStartedAt, androidPromptReady: installEvent !== null,
  });
  const showExternalBrowserNotice = inAppBrowser !== null && !inAppDismissed;
  const showInstallPrompt = !showExternalBrowserNotice && platform !== null && (eligibleForInstall || promptError);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptError(false);
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setPromptError(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showExternalBrowserNotice && !showInstallPrompt) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showExternalBrowserNotice, showInstallPrompt]);

  const dismissExternalBrowserNotice = () => {
    persistDismissal(IN_APP_DISMISSED_KEY, '1', sessionStorage);
    setInAppDismissed(true);
  };
  const dismissInstallPrompt = () => {
    const now = Date.now();
    persistDismissal(INSTALL_DISMISSED_KEY, String(now), localStorage);
    setInstallDismissedAt(now);
    setInstallEvent(null);
    setPromptError(false);
  };
  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      if (choice.outcome === 'dismissed') dismissInstallPrompt();
    } catch {
      setInstallEvent(null);
      setPromptError(true);
    }
  };

  if (showExternalBrowserNotice && inAppBrowser) return <OpenInBrowserNotice app={inAppBrowser.app} onDismiss={dismissExternalBrowserNotice} />;
  if (showInstallPrompt && platform) return <InstallPrompt platform={platform} promptError={promptError} onInstall={install} onDismiss={dismissInstallPrompt} />;
  return null;
}
