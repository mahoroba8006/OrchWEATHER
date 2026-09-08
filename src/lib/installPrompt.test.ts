import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INSTALL_DISMISS_MS,
  isIosOrIpad,
  isStandalone,
  shouldPromptInstall,
} from './installPrompt';

const iphoneUa =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const ipadDesktopUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const androidUa =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
const windowsUa =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const lineUa = `${iphoneUa} Line/14.21.1`;

const baseOptions = {
  standalone: false,
  maxTouchPoints: 0,
  dismissedAt: null,
  now: 1_000_000,
  androidPromptReady: false,
};

describe('isIosOrIpad', () => {
  it('accepts iPhone, iPad, and desktop-form iPad user agents', () => {
    expect(isIosOrIpad(iphoneUa, 0)).toBe(true);
    expect(isIosOrIpad('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 0)).toBe(true);
    expect(isIosOrIpad(ipadDesktopUa, 2)).toBe(true);
  });

  it('does not accept a Mac without touch points', () => {
    expect(isIosOrIpad(ipadDesktopUa, 0)).toBe(false);
  });
});

describe('shouldPromptInstall', () => {
  it('prompts an eligible iPhone on first visit', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: iphoneUa })).toBe(true);
  });

  it('does not prompt when already standalone', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: iphoneUa, standalone: true })).toBe(false);
  });

  it('does not prompt inside LINE', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: lineUa })).toBe(false);
  });

  it('prompts Android after beforeinstallprompt is ready', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: androidUa, androidPromptReady: true })).toBe(true);
  });

  it('does not prompt Android before beforeinstallprompt is ready', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: androidUa })).toBe(false);
  });

  it('does not prompt until the seven-day dismissal period has elapsed', () => {
    expect(
      shouldPromptInstall({
        ...baseOptions,
        ua: iphoneUa,
        dismissedAt: baseOptions.now - INSTALL_DISMISS_MS + 1,
      })
    ).toBe(false);
  });

  it('prompts exactly seven days after dismissal', () => {
    expect(
      shouldPromptInstall({
        ...baseOptions,
        ua: iphoneUa,
        dismissedAt: baseOptions.now - INSTALL_DISMISS_MS,
      })
    ).toBe(true);
  });

  it('prompts a desktop-form iPad with touch points', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: ipadDesktopUa, maxTouchPoints: 2 })).toBe(true);
  });

  it('does not prompt a Mac without touch points', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: ipadDesktopUa })).toBe(false);
  });

  it('does not prompt Windows', () => {
    expect(shouldPromptInstall({ ...baseOptions, ua: windowsUa })).toBe(false);
  });
});

describe('isStandalone', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns true for iOS navigator standalone mode', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { standalone: true },
    });
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    });
    expect(isStandalone()).toBe(true);
  });

  it('returns true for display-mode standalone', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { standalone: false },
    });
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    });
    expect(isStandalone()).toBe(true);
  });
});
