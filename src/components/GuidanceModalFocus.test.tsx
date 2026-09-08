import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InstallPrompt } from './InstallPrompt';
import { OpenInBrowserNotice } from './OpenInBrowserNotice';

const createLauncher = () => {
  const launcher = document.createElement('button');
  launcher.textContent = '元の操作';
  document.body.appendChild(launcher);
  launcher.focus();
  return launcher;
};

describe('guidance modal focus management', () => {
  afterEach(() => {
    cleanup();
    document.querySelector('[data-test-launcher]')?.remove();
  });

  it('focuses, traps, and restores focus for external-browser guidance', () => {
    const launcher = createLauncher();
    launcher.dataset.testLauncher = 'true';
    const { unmount } = render(<OpenInBrowserNotice app="LINE" onDismiss={() => {}} />);
    const close = screen.getByRole('button', { name: '閉じる' });
    const later = screen.getByRole('button', { name: 'あとで' });

    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(later);
    fireEvent.keyDown(later, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    unmount();
    expect(document.activeElement).toBe(launcher);
  });

  it('focuses and restores focus for install guidance', () => {
    const launcher = createLauncher();
    launcher.dataset.testLauncher = 'true';
    const { unmount } = render(<InstallPrompt platform="ios" promptError={false} onInstall={() => {}} onDismiss={() => {}} />);
    const close = screen.getByRole('button', { name: '閉じる' });

    expect(document.activeElement).toBe(close);
    unmount();
    expect(document.activeElement).toBe(launcher);
  });
});
