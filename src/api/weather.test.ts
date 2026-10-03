import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/weatherFetch', () => ({ weatherFetch: vi.fn() }));
import { weatherFetch } from '../lib/weatherFetch';
import { fetchWeatherData } from './weather';

const body = {
  daily: {
    time: ['2026-01-01'],
    temperature_2m_mean: [5], temperature_2m_max: [9], temperature_2m_min: [1],
    precipitation_sum: [0],
    relative_humidity_2m_mean: [60], relative_humidity_2m_max: [80], relative_humidity_2m_min: [40],
    shortwave_radiation_sum: [10], sunshine_duration: [3600],
  },
};
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-03T03:00:00Z'));
  vi.mocked(weatherFetch).mockReset();
  vi.mocked(weatherFetch).mockImplementation(async () => new Response(JSON.stringify(body)));
  // 年境界の月平均（素の fetch）は失敗させて null 扱いにする
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// キャッシュはモジュール共有のため、テストごとに別の地点を使う
describe('fetchWeatherData のキャッシュ', () => {
  it('当年分は6時間で取り直す', async () => {
    await fetchWeatherData(35.1, 139.1, 2026);
    await fetchWeatherData(35.1, 139.1, 2026);
    expect(weatherFetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 6 * HOUR + 1));
    await fetchWeatherData(35.1, 139.1, 2026);
    expect(weatherFetch).toHaveBeenCalledTimes(2);
  });

  it('過去年は確定値なので取り直さない', async () => {
    await fetchWeatherData(35.2, 139.2, 2025);
    vi.setSystemTime(new Date(Date.now() + 7 * HOUR));
    await fetchWeatherData(35.2, 139.2, 2025);
    expect(weatherFetch).toHaveBeenCalledTimes(1);
  });
});
