import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'ref'), setDoc: (...a: unknown[]) => setDocMock(...a), getDoc: vi.fn(),
  serverTimestamp: vi.fn(), collection: vi.fn(), addDoc: vi.fn(), getDocs: vi.fn(),
  deleteDoc: vi.fn(), updateDoc: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
}));
vi.mock('./lib/firebase', () => ({ db: {}, auth: {} }));

import { useAppStore } from './store';
import { DEFAULT_HIDDEN_HOURLY_ROWS } from './lib/hourlyRows';

beforeEach(() => {
  setDocMock.mockReset();
  useAppStore.setState({ user: null, userSettings: null, guestHiddenHourlyRows: DEFAULT_HIDDEN_HOURLY_ROWS } as never);
});
afterEach(() => localStorage.clear());

describe('updateHiddenHourlyRows', () => {
  it('ゲストは localStorage に保存してストアを更新する', async () => {
    await useAppStore.getState().updateHiddenHourlyRows(['cape']);
    expect(JSON.parse(localStorage.getItem('hiddenHourlyRows')!)).toEqual(['cape']);
    expect(useAppStore.getState().guestHiddenHourlyRows).toEqual(['cape']);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('ログイン中は Firestore の完了後に userSettings を更新する', async () => {
    useAppStore.setState({ user: { uid: 'u1' }, userSettings: { hiddenHourlyRows: [] } } as never);
    setDocMock.mockResolvedValue(undefined);
    await useAppStore.getState().updateHiddenHourlyRows(['pressure']);
    expect(setDocMock).toHaveBeenCalledWith('ref', { hiddenHourlyRows: ['pressure'] }, { merge: true });
    expect(useAppStore.getState().userSettings?.hiddenHourlyRows).toEqual(['pressure']);
  });

  it('Firestore が失敗したら拒否し、状態は変わらない', async () => {
    useAppStore.setState({ user: { uid: 'u1' }, userSettings: { hiddenHourlyRows: [] } } as never);
    setDocMock.mockRejectedValue(new Error('boom'));
    await expect(useAppStore.getState().updateHiddenHourlyRows(['pressure'])).rejects.toThrow('boom');
    expect(useAppStore.getState().userSettings?.hiddenHourlyRows).toEqual([]);
  });
});
