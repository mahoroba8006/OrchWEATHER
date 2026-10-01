import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { LocationSettings } from './LocationSettings';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const loc = { id: 'loc-1', name: 'やままつ農園', lat: 34.7, lon: 137.7 };

const openDeleteDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: '削除' }));
  return screen.getByRole('dialog');
};

describe('地点の削除（Firestore 書き込みの完了を待つ）', () => {
  beforeEach(() => {
    useAppStore.setState({ locations: [loc] } as never);
  });

  it('削除の完了を待ってからダイアログを閉じる', async () => {
    let resolve!: () => void;
    const deleteLocation = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    useAppStore.setState({ deleteLocation } as never);
    renderWithMotion(<LocationSettings />);

    const dialog = openDeleteDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '削除' }));
    expect(deleteLocation).toHaveBeenCalledWith('loc-1');
    // 書き込み中はダイアログが残り、ボタンは押せない
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: '削除中…' }) as HTMLButtonElement).disabled).toBe(true);

    resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('失敗したらダイアログを閉じずにエラーを表示する', async () => {
    const deleteLocation = vi.fn(() => Promise.reject(new Error('permission-denied')));
    useAppStore.setState({ deleteLocation } as never);
    renderWithMotion(<LocationSettings />);

    const dialog = openDeleteDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '削除' }));
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toContain('permission-denied'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
