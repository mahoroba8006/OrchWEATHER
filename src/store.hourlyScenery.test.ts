import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'ref'), setDoc: (...a: unknown[]) => setDocMock(...a), getDoc: vi.fn(),
  serverTimestamp: vi.fn(), collection: vi.fn(), addDoc: vi.fn(), getDocs: vi.fn(),
  deleteDoc: vi.fn(), updateDoc: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
}));
vi.mock('./lib/firebase', () => ({ db: {}, auth: {} }));

import { useAppStore } from './store';
import { loadGuestHourlyScenery, parseHourlyScenery } from './lib/hourlyScenery';

beforeEach(() => {
  setDocMock.mockReset();
  useAppStore.setState({ user: null, userSettings: null, guestHourlyScenery: 'mountains' } as never);
});
afterEach(() => localStorage.clear());

describe('時間別の表の景色の設定', () => {
  it('保存値の読み取り: 知らない値・未保存は山並み', () => {
    expect(parseHourlyScenery('sea')).toBe('sea');
    expect(parseHourlyScenery('none')).toBe('none');
    expect(parseHourlyScenery('forest')).toBe('mountains');
    expect(parseHourlyScenery(undefined)).toBe('mountains');
    expect(loadGuestHourlyScenery()).toBe('mountains');
  });

  it('ゲストは localStorage に保存してストアを更新し、次の起動で読み戻す', async () => {
    await useAppStore.getState().updateHourlyScenery('hills');
    expect(localStorage.getItem('hourlyScenery')).toBe('hills');
    expect(useAppStore.getState().guestHourlyScenery).toBe('hills');
    expect(loadGuestHourlyScenery()).toBe('hills');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('ログイン中は Firestore の完了後に userSettings を更新する', async () => {
    useAppStore.setState({ user: { uid: 'u1' }, userSettings: { hourlyScenery: 'mountains' } } as never);
    setDocMock.mockResolvedValue(undefined);
    await useAppStore.getState().updateHourlyScenery('sea');
    expect(setDocMock).toHaveBeenCalledWith('ref', { hourlyScenery: 'sea' }, { merge: true });
    expect(useAppStore.getState().userSettings?.hourlyScenery).toBe('sea');
  });

  it('Firestore が失敗したら拒否し、状態は変わらない', async () => {
    useAppStore.setState({ user: { uid: 'u1' }, userSettings: { hourlyScenery: 'mountains' } } as never);
    setDocMock.mockRejectedValue(new Error('boom'));
    await expect(useAppStore.getState().updateHourlyScenery('none')).rejects.toThrow('boom');
    expect(useAppStore.getState().userSettings?.hourlyScenery).toBe('mountains');
  });
});
