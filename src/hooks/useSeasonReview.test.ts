import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastData } from '../api/forecast';

vi.mock('../api/weather', () => ({ fetchWeatherData: vi.fn() }));
vi.mock('../lib/seasonReview', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/seasonReview')>();
  return { ...mod, computeSeasonView: vi.fn() };
});

import { fetchWeatherData } from '../api/weather';
import { computeSeasonView } from '../lib/seasonReview';
import { useSeasonReview } from './useSeasonReview';

const forecast = { hourly: [], daily: [], pastDaily: [], fetchedAt: 1, lat: 35, lon: 139 } as unknown as ForecastData;
const view = { pace: { label: 'L', text: 'T' }, review: null, showCard: false };

beforeEach(() => {
  vi.mocked(fetchWeatherData).mockReset();
  vi.mocked(computeSeasonView).mockReset();
});

describe('useSeasonReview', () => {
  it('予報が無ければ idle（取得しない）', () => {
    const { result } = renderHook(() => useSeasonReview(35, 139, null));
    expect(result.current.status).toBe('idle');
    expect(fetchWeatherData).not.toHaveBeenCalled();
  });

  it('予報が別地点のもの（地点切替直後）なら loading のまま取得しない', () => {
    const { result } = renderHook(() => useSeasonReview(36, 140, forecast));
    expect(result.current.status).toBe('loading');
    expect(fetchWeatherData).not.toHaveBeenCalled();
  });

  it('予報が揃うと loading → ready', async () => {
    vi.mocked(fetchWeatherData).mockResolvedValue({ year: 2026, daily: [] });
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', view }));
  });

  it('計算できなければ hidden', async () => {
    vi.mocked(fetchWeatherData).mockResolvedValue({ year: 2026, daily: [] });
    vi.mocked(computeSeasonView).mockReturnValue(null);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast));
    await waitFor(() => expect(result.current.status).toBe('hidden'));
  });

  it('取得失敗は hidden（エラーを表に出さない）', async () => {
    vi.mocked(fetchWeatherData).mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast));
    await waitFor(() => expect(result.current.status).toBe('hidden'));
  });
});
