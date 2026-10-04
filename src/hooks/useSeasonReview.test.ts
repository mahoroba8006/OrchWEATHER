import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastData } from '../api/forecast';

vi.mock('../api/weather', () => ({ fetchDailyActuals: vi.fn(), hasStoredPast: vi.fn(() => true) }));
vi.mock('../lib/seasonReview', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/seasonReview')>();
  return { ...mod, computeSeasonView: vi.fn() };
});

import { fetchDailyActuals, hasStoredPast } from '../api/weather';
import { computeSeasonView, DEFAULT_PACE_OPTIONS } from '../lib/seasonReview';
import { useSeasonReview } from './useSeasonReview';

const forecast = { hourly: [], daily: [], pastDaily: [], fetchedAt: 1, lat: 35, lon: 139 } as unknown as ForecastData;
const view = { paceItems: [{ kind: 'temp' as const, name: '気温', period: 'この30日', text: 'T' }], review: null, reviews: [], showCard: false };

beforeEach(() => {
  vi.mocked(fetchDailyActuals).mockReset();
  vi.mocked(computeSeasonView).mockReset();
});

describe('useSeasonReview', () => {
  it('予報が無ければ idle（取得しない）', () => {
    const { result } = renderHook(() => useSeasonReview(35, 139, null, DEFAULT_PACE_OPTIONS));
    expect(result.current.status).toBe('idle');
    expect(fetchDailyActuals).not.toHaveBeenCalled();
  });

  it('予報が別地点のもの（地点切替直後）なら loading のまま取得しない', () => {
    const { result } = renderHook(() => useSeasonReview(36, 140, forecast, DEFAULT_PACE_OPTIONS));
    expect(result.current.status).toBe('loading');
    expect(fetchDailyActuals).not.toHaveBeenCalled();
  });

  it('予報が揃うと loading → ready', async () => {
    vi.mocked(fetchDailyActuals).mockResolvedValue([]);
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast, DEFAULT_PACE_OPTIONS));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', view }));
  });

  it('計算できなければ hidden', async () => {
    vi.mocked(fetchDailyActuals).mockResolvedValue([]);
    vi.mocked(computeSeasonView).mockReturnValue(null);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast, DEFAULT_PACE_OPTIONS));
    await waitFor(() => expect(result.current.status).toBe('hidden'));
  });

  it('取得失敗は hidden（エラーを表に出さない）', async () => {
    vi.mocked(fetchDailyActuals).mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast, DEFAULT_PACE_OPTIONS));
    await waitFor(() => expect(result.current.status).toBe('hidden'));
  });
});

describe('useSeasonReview（手動更新）', () => {
  it('予報を取り直しても（fetchedAt が変わっても）骨組みに戻らず、再取得もしない', async () => {
    vi.mocked(fetchDailyActuals).mockResolvedValue([]);
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result, rerender } = renderHook(({ f }) => useSeasonReview(35, 139, f, DEFAULT_PACE_OPTIONS), { initialProps: { f: forecast } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ f: { ...forecast, fetchedAt: 2 } as ForecastData });
    expect(result.current.status).toBe('ready');
    expect(fetchDailyActuals).toHaveBeenCalledTimes(1);
  });
});

describe('useSeasonReview（比べ方の設定変更）', () => {
  it('設定が変わったら取り直さずに計算し直す', async () => {
    vi.mocked(fetchDailyActuals).mockResolvedValue([]);
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result, rerender } = renderHook(({ o }) => useSeasonReview(35, 139, forecast, o), { initialProps: { o: DEFAULT_PACE_OPTIONS } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ o: { ...DEFAULT_PACE_OPTIONS, modes: { ...DEFAULT_PACE_OPTIONS.modes, gdd: 'recent' } } });
    expect(fetchDailyActuals).toHaveBeenCalledTimes(1);
    expect(vi.mocked(computeSeasonView).mock.lastCall?.[2].modes.gdd).toBe('recent');
  });
});

describe('useSeasonReview（はじめての地点は去年分を先に）', () => {
  it('保存が無ければ、去年分→全部の順に取り寄せ、去年分の時点で表示する', async () => {
    vi.mocked(hasStoredPast).mockReturnValue(false);
    let resolveAll: (v: never[]) => void = () => {};
    vi.mocked(fetchDailyActuals)
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise(r => { resolveAll = r as never; }));
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast, DEFAULT_PACE_OPTIONS));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const calls = vi.mocked(fetchDailyActuals).mock.calls;
    expect(calls).toHaveLength(2);
    expect(Number(calls[0][2].slice(0, 4))).toBeGreaterThan(Number(calls[1][2].slice(0, 4))); // 1回目の方が新しい年から
    resolveAll([]);
    await waitFor(() => expect(vi.mocked(computeSeasonView).mock.calls.length).toBeGreaterThan(1));
    expect(result.current.status).toBe('ready');
  });

  it('全部の取り寄せに失敗しても、去年分の表示は残す', async () => {
    vi.mocked(hasStoredPast).mockReturnValue(false);
    vi.mocked(fetchDailyActuals).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('429'));
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast, DEFAULT_PACE_OPTIONS));
    await waitFor(() => expect(vi.mocked(fetchDailyActuals).mock.calls).toHaveLength(2));
    await new Promise(r => setTimeout(r, 0));
    expect(result.current.status).toBe('ready');
  });

  it('保存が揃っていれば1回で取り寄せる', async () => {
    vi.mocked(hasStoredPast).mockReturnValue(true);
    vi.mocked(fetchDailyActuals).mockResolvedValue([]);
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast, DEFAULT_PACE_OPTIONS));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fetchDailyActuals).toHaveBeenCalledTimes(1);
  });
});
