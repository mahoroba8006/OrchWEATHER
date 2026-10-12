import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'ref'), setDoc: (...a: unknown[]) => setDocMock(...a), getDoc: vi.fn(),
  serverTimestamp: vi.fn(), collection: vi.fn(), addDoc: vi.fn(), getDocs: vi.fn(),
  deleteDoc: vi.fn(), updateDoc: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
}));
vi.mock('./lib/firebase', () => ({ db: {}, auth: {} }));

import { useAppStore } from './store';
import { loadGuestHourlyScenery, parseHourlyScenery, seasonOf } from './lib/hourlyScenery';

beforeEach(() => {
  setDocMock.mockReset();
  useAppStore.setState({ user: null, userSettings: null, guestHourlyScenery: 'seasonal' } as never);
});
afterEach(() => localStorage.clear());

describe('時間別の表の景色の設定', () => {
  it('保存値の読み取り: 知らない値・未保存は季節の色', () => {
    expect(parseHourlyScenery('ink')).toBe('ink');
    expect(parseHourlyScenery('none')).toBe('none');
    expect(parseHourlyScenery('sea')).toBe('seasonal');
    expect(parseHourlyScenery(undefined)).toBe('seasonal');
    expect(loadGuestHourlyScenery()).toBe('seasonal');
  });

  it('ゲストは localStorage に保存してストアを更新し、次の起動で読み戻す', async () => {
    await useAppStore.getState().updateHourlyScenery('ink');
    expect(localStorage.getItem('hourlyScenery')).toBe('ink');
    expect(useAppStore.getState().guestHourlyScenery).toBe('ink');
    expect(loadGuestHourlyScenery()).toBe('ink');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('ログイン中は Firestore の完了後に userSettings を更新する', async () => {
    useAppStore.setState({ user: { uid: 'u1' }, userSettings: { hourlyScenery: 'seasonal' } } as never);
    setDocMock.mockResolvedValue(undefined);
    await useAppStore.getState().updateHourlyScenery('ink');
    expect(setDocMock).toHaveBeenCalledWith('ref', { hourlyScenery: 'ink' }, { merge: true });
    expect(useAppStore.getState().userSettings?.hourlyScenery).toBe('ink');
  });

  it('Firestore が失敗したら拒否し、状態は変わらない', async () => {
    useAppStore.setState({ user: { uid: 'u1' }, userSettings: { hourlyScenery: 'seasonal' } } as never);
    setDocMock.mockRejectedValue(new Error('boom'));
    await expect(useAppStore.getState().updateHourlyScenery('none')).rejects.toThrow('boom');
    expect(useAppStore.getState().userSettings?.hourlyScenery).toBe('seasonal');
  });

  it('季節は節気で決める（立春・立夏・立秋・立冬で切り替わる）', () => {
    expect(seasonOf(new Date('2026-02-03T12:00:00+09:00'))).toBe('winter'); // 節分
    expect(seasonOf(new Date('2026-02-04T12:00:00+09:00'))).toBe('spring'); // 立春
    expect(seasonOf(new Date('2026-05-05T12:00:00+09:00'))).toBe('summer'); // 立夏
    expect(seasonOf(new Date('2026-08-07T12:00:00+09:00'))).toBe('autumn'); // 立秋
    expect(seasonOf(new Date('2026-11-07T12:00:00+09:00'))).toBe('winter'); // 立冬
  });
});
