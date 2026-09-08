import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentGuidance } from './EnvironmentGuidance';

const setUserAgent = (userAgent: string, maxTouchPoints = 0) => {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints });
};

const dispatchInstallPrompt = () => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  return event;
};

describe('EnvironmentGuidance', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
  });

  it('prioritizes external-browser guidance over an Android install event', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Line/14.10.0');
    render(<EnvironmentGuidance />);
    dispatchInstallPrompt();

    expect(await screen.findByRole('dialog', { name: 'ブラウザで開くお願い' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'ホーム画面に追加' })).toBeNull();
  });

  it('shows iPhone installation instructions instead of a fake install button', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15');
    render(<EnvironmentGuidance />);

    expect(await screen.findByText('共有ボタン → ホーム画面に追加')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'ホーム画面に追加' })).toBeNull();
  });

  it('shows the Android install button only after beforeinstallprompt arrives', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36');
    render(<EnvironmentGuidance />);

    expect(screen.queryByRole('dialog', { name: 'ホーム画面に追加' })).toBeNull();

    dispatchInstallPrompt();
    expect(await screen.findByRole('button', { name: 'ホーム画面に追加' })).not.toBeNull();
  });

  it('keeps an external-browser dismissal only for the current session', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Line/14.10.0');
    render(<EnvironmentGuidance />);

    fireEvent.click(await screen.findByRole('button', { name: 'あとで' }));
    await waitFor(() => expect(sessionStorage.getItem('orchweather.inapp-dismissed')).toBe('1'));
    expect(screen.queryByRole('dialog', { name: 'ブラウザで開くお願い' })).toBeNull();
  });
});
