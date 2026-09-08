import { detectInAppBrowser } from './inAppBrowser';

export const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type InstallPromptOptions = {
  ua: string;
  standalone: boolean;
  maxTouchPoints: number;
  dismissedAt: number | null;
  now: number;
  androidPromptReady: boolean;
};

export function isIosOrIpad(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
}

export function shouldPromptInstall({
  ua,
  standalone,
  maxTouchPoints,
  dismissedAt,
  now,
  androidPromptReady,
}: InstallPromptOptions): boolean {
  if (standalone || detectInAppBrowser(ua) !== null) return false;
  if (dismissedAt !== null && now - dismissedAt < INSTALL_DISMISS_MS) return false;

  if (isIosOrIpad(ua, maxTouchPoints)) return true;
  if (/Android/i.test(ua)) return androidPromptReady;
  return false;
}

export function isStandalone(): boolean {
  const iosNavigator = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { standalone?: boolean })
    : undefined;
  const iosStandalone =
    iosNavigator?.standalone === true;
  const displayModeStandalone =
    typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayModeStandalone;
}
