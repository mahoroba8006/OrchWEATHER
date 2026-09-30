import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from './MotionProvider';
import { Sheet } from './Sheet';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    renderWithMotion(<Sheet open={false} onClose={() => {}} title="設定">中身</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a labelled modal dialog when open', () => {
    renderWithMotion(<Sheet open onClose={() => {}} title="設定">中身</Sheet>);
    const dialog = screen.getByRole('dialog', { name: '設定' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('中身')).toBeTruthy();
  });

  it('closes on Escape, close button, and backdrop click', () => {
    const onClose = vi.fn();
    renderWithMotion(<Sheet open onClose={onClose} title="設定">中身</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('uses the side placement class', () => {
    renderWithMotion(<Sheet open onClose={() => {}} title="ヘルプ" placement="side">中身</Sheet>);
    expect(screen.getByRole('dialog').className).toContain('ui-sheet--side');
  });

  it('moves focus into the sheet and restores it after closing', async () => {
    const launcher = document.createElement('button');
    launcher.textContent = '開く';
    document.body.appendChild(launcher);
    launcher.focus();

    const { rerender } = renderWithMotion(<Sheet open onClose={() => {}} title="設定">中身</Sheet>);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    rerender(<MotionProvider><Sheet open={false} onClose={() => {}} title="設定">中身</Sheet></MotionProvider>);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(launcher));
    launcher.remove();
  });
});
