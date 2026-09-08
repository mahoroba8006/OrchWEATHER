import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentGuidance } from './EnvironmentGuidance';

const setUserAgent = (userAgent: string, maxTouchPoints = 0) => {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints });
};

const dispatchInstallPrompt = ({ outcome = 'accepted', rejects = false }: { outcome?: 'accepted' | 'dismissed'; rejects?: boolean } = {}) => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockImplementation(() => rejects ? Promise.reject(new Error('prompt failed')) : Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
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

  it('dismisses external-browser guidance even when sessionStorage access throws', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Line/14.10.0');
    render(<EnvironmentGuidance />);
    const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => { throw new DOMException('blocked', 'SecurityError'); } });

    try {
      fireEvent.click(await screen.findByRole('button', { name: 'あとで' }));
      expect(screen.queryByRole('dialog', { name: 'ブラウザで開くお願い' })).toBeNull();
    } finally {
      if (descriptor) Object.defineProperty(window, 'sessionStorage', descriptor);
    }
  });

  it('dismisses install guidance even when localStorage access throws', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36');
    render(<EnvironmentGuidance />);
    dispatchInstallPrompt();
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('blocked', 'SecurityError'); } });

    try {
      fireEvent.click(await screen.findByRole('button', { name: 'あとで' }));
      expect(screen.queryByRole('dialog', { name: 'ホーム画面に追加' })).toBeNull();
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    }
  });

  it('hides Android guidance after an accepted native install prompt', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36');
    render(<EnvironmentGuidance />);
    const event = dispatchInstallPrompt();
    fireEvent.click(await screen.findByRole('button', { name: 'ホーム画面に追加' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'ホーム画面に追加' })).toBeNull());
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('suppresses Android guidance for seven days after a dismissed native prompt', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36');
    render(<EnvironmentGuidance />);
    dispatchInstallPrompt({ outcome: 'dismissed' });
    fireEvent.click(await screen.findByRole('button', { name: 'ホーム画面に追加' }));

    await waitFor(() => expect(Number(localStorage.getItem('orchweather.install-dismissed-at'))).toBeGreaterThan(0));
    expect(screen.queryByRole('dialog', { name: 'ホーム画面に追加' })).toBeNull();
  });

  it('hides Android guidance when the browser reports appinstalled', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36');
    render(<EnvironmentGuidance />);
    dispatchInstallPrompt();
    await screen.findByRole('dialog', { name: 'ホーム画面に追加' });
    window.dispatchEvent(new Event('appinstalled'));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'ホーム画面に追加' })).toBeNull());
  });

  it('shows fallback guidance when Android native prompting fails', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36');
    render(<EnvironmentGuidance />);
    dispatchInstallPrompt({ rejects: true });
    fireEvent.click(await screen.findByRole('button', { name: 'ホーム画面に追加' }));

    expect(await screen.findByText('インストール画面を開けませんでした。ブラウザのメニューから、あとでお試しください。')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'ホーム画面に追加' })).toBeNull();
  });
});
