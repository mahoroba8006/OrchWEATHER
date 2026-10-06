import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const setDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'ref'), setDoc: (...a: unknown[]) => setDocMock(...a), getDoc: vi.fn(),
  serverTimestamp: vi.fn(), collection: vi.fn(), addDoc: vi.fn(), getDocs: vi.fn(),
  deleteDoc: vi.fn(), updateDoc: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
}));
vi.mock('./lib/firebase', () => ({ db: {}, auth: {} }));

import { loadGuestWeatherCodeMode, useAppStore, useWeatherCodeMode } from './store';

beforeEach(() => {
  setDocMock.mockReset();
  setDocMock.mockResolvedValue(undefined);
  useAppStore.setState({ user: null, userSettings: null, guestWeatherCodeMode: 'severity' } as never);
});
afterEach(() => localStorage.clear());

describe('updateWeatherCodeMode', () => {
  it('ゲストでも切り替わり、localStorage に保存する（Firestore には書かない）', async () => {
    const { result } = renderHook(() => useWeatherCodeMode());
    expect(result.current).toBe('severity');
    await act(() => useAppStore.getState().updateWeatherCodeMode('frequency'));
    expect(result.current).toBe('frequency');
    expect(localStorage.getItem('weatherCodeMode')).toBe('frequency');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('ログイン中は userSettings を更新して Firestore に保存する', async () => {
    useAppStore.setState({ user: { uid: 'u1' }, userSettings: { weatherCodeMode: 'severity' } } as never);
    const { result } = renderHook(() => useWeatherCodeMode());
    await act(() => useAppStore.getState().updateWeatherCodeMode('frequency'));
    expect(result.current).toBe('frequency');
    expect(setDocMock).toHaveBeenCalledWith('ref', { weatherCodeMode: 'frequency' }, { merge: true });
  });
});

describe('loadGuestWeatherCodeMode', () => {
  it('保存値が無い・不正なら severity', () => {
    expect(loadGuestWeatherCodeMode()).toBe('severity');
    localStorage.setItem('weatherCodeMode', 'xxx');
    expect(loadGuestWeatherCodeMode()).toBe('severity');
    localStorage.setItem('weatherCodeMode', 'frequency');
    expect(loadGuestWeatherCodeMode()).toBe('frequency');
  });
});

describe('起動時の復元', () => {
  it('保存済みの frequency を、ストアの初期化時に読み込む', async () => {
    localStorage.setItem('weatherCodeMode', 'frequency');
    vi.resetModules();
    const fresh = await import('./store');
    expect(fresh.useAppStore.getState().guestWeatherCodeMode).toBe('frequency');
  });
});
