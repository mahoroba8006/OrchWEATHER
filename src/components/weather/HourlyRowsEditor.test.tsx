import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store';
import { DEFAULT_HIDDEN_HOURLY_ROWS } from '../../lib/hourlyRows';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { HourlyRowsEditor } from './HourlyRowsEditor';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const sw = (name: string) => screen.getByRole('switch', { name }) as HTMLButtonElement;

describe('HourlyRowsEditor', () => {
  beforeEach(() => {
    useAppStore.setState({ user: null, userSettings: null, guestHiddenHourlyRows: ['pressure'] } as never);
  });

  it('非表示の項目はオフ、それ以外はオンで表示される', () => {
    renderWithMotion(<HourlyRowsEditor />);
    expect(sw('気圧').getAttribute('aria-checked')).toBe('false');
    expect(sw('気温').getAttribute('aria-checked')).toBe('true');
  });

  it('切り替えると非表示リストを保存アクションに渡す', async () => {
    const update = vi.fn(async (rows: string[]) => { useAppStore.setState({ guestHiddenHourlyRows: rows } as never); });
    useAppStore.setState({ updateHiddenHourlyRows: update } as never);
    renderWithMotion(<HourlyRowsEditor />);
    fireEvent.click(sw('風速'));
    expect(update).toHaveBeenCalledWith(['windSpeed', 'pressure']);
    await waitFor(() => expect(screen.getByText('保存しました')).toBeTruthy());
    fireEvent.click(sw('気圧'));
    expect(update).toHaveBeenLastCalledWith(['windSpeed']);
  });

  it('おすすめに戻すでデフォルトを渡す', () => {
    const update = vi.fn(async () => {});
    useAppStore.setState({ updateHiddenHourlyRows: update } as never);
    renderWithMotion(<HourlyRowsEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'おすすめに戻す' }));
    expect(update).toHaveBeenCalledWith(DEFAULT_HIDDEN_HOURLY_ROWS);
  });

  it('保存中は切替を無効にし、失敗したらエラーを出して元の状態を保つ', async () => {
    let reject!: (e: Error) => void;
    const update = vi.fn(() => new Promise<void>((_, r) => { reject = r; }));
    useAppStore.setState({ updateHiddenHourlyRows: update } as never);
    renderWithMotion(<HourlyRowsEditor />);
    fireEvent.click(sw('風速'));
    expect(sw('気温').disabled).toBe(true);
    reject(new Error('permission-denied'));
    await waitFor(() => expect(screen.getByText('保存失敗: permission-denied')).toBeTruthy());
    expect(sw('風速').getAttribute('aria-checked')).toBe('true');
    expect(sw('気温').disabled).toBe(false);
  });
});
