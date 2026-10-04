import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/weatherFetch', () => ({ weatherFetch: vi.fn() }));
import { weatherFetch } from '../lib/weatherFetch';
import { fetchDailyActuals, fetchWeatherData, hasStoredPast } from './weather';

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

describe('fetchDailyActuals（過去年は端末に保存し、今年分だけ取り直す）', () => {
  // URL の start_date〜end_date に合わせて毎日 10℃・雨1mm・日照1h を返す。nullDate の日は未確定（null）
  function archiveMock(nullDate?: string) {
    vi.mocked(weatherFetch).mockImplementation(async (url: string) => {
      const start = url.match(/start_date=([\d-]+)/)![1];
      const end = url.match(/end_date=([\d-]+)/)![1];
      const time: string[] = [];
      for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) time.push(new Date(t).toISOString().slice(0, 10));
      const v = (x: number) => time.map(d => (d === nullDate ? null : x));
      return new Response(JSON.stringify({ daily: {
        time, temperature_2m_mean: v(10), temperature_2m_max: v(15), temperature_2m_min: v(5),
        precipitation_sum: v(1), sunshine_duration: v(3600),
      } }));
    });
  }
  const ranges = () => vi.mocked(weatherFetch).mock.calls.map(([u]) => `${u.match(/start_date=([\d-]+)/)![1]}..${u.match(/end_date=([\d-]+)/)![1]}`);
  beforeEach(() => localStorage.clear());

  it('過去年と今年分の2回に分けて順に取得し、つなげて返す（日照は時間に直す）', async () => {
    archiveMock();
    const days = await fetchDailyActuals(35.31, 139.31, '2020-01-01', '2026-10-03');
    expect(ranges()).toEqual(['2020-01-01..2025-12-31', '2026-01-01..2026-10-03']);
    expect(days[0]).toEqual({ date: '2020-01-01', tempMean: 10, tempMax: 15, tempMin: 5, precipSum: 1, sunshineDuration: 1 });
    expect(days.at(-1)?.date).toBe('2026-10-03');
    expect(days).toHaveLength(2192 + 276); // 2020〜2025年（閏年2回）＋今年
  });

  it('2回目（翌日など）は過去年を端末から読み、今年分だけ取得する', async () => {
    archiveMock();
    await fetchDailyActuals(35.32, 139.32, '2020-01-01', '2026-10-03');
    const days = await fetchDailyActuals(35.32, 139.32, '2020-01-01', '2026-10-04');
    expect(ranges()).toEqual(['2020-01-01..2025-12-31', '2026-01-01..2026-10-03', '2026-01-01..2026-10-04']);
    expect(days.find(d => d.date === '2024-02-29')?.tempMean).toBe(10);
    expect(days).toHaveLength(2192 + 277);
  });

  it('欠け（未確定の日）がある過去年は保存しない', async () => {
    archiveMock('2025-12-31');
    await fetchDailyActuals(35.33, 139.33, '2020-01-01', '2026-10-03');
    // 同じセッション内はメモリのキャッシュが効くが、端末には保存されない（次回開いたときは取り直す）
    expect(Object.keys(localStorage).filter(k => k.startsWith('pastActuals:'))).toHaveLength(0);
  });

  it('現在地の小さな揺れ（約1km未満）では取り直さない', async () => {
    archiveMock();
    await fetchDailyActuals(35.3401, 139.3401, '2020-01-01', '2026-10-03');
    await fetchDailyActuals(35.3404, 139.3398, '2020-01-01', '2026-10-04');
    expect(ranges().filter(r => r.startsWith('2020-01-01'))).toHaveLength(1);
  });

  it('保存済みより古い年が要るときは、足りない年だけ取り寄せて保存分とつなぐ（去年分を先に取る段階表示用）', async () => {
    archiveMock();
    await fetchDailyActuals(35.36, 139.36, '2025-01-01', '2026-10-03');
    expect(hasStoredPast(35.36, 139.36, '2025-01-01', '2026-10-03')).toBe(true);
    expect(hasStoredPast(35.36, 139.36, '2020-01-01', '2026-10-03')).toBe(false);
    const days = await fetchDailyActuals(35.36, 139.36, '2020-01-01', '2026-10-04');
    expect(ranges()).toEqual(['2025-01-01..2025-12-31', '2026-01-01..2026-10-03', '2020-01-01..2024-12-31', '2026-01-01..2026-10-04']);
    expect(days).toHaveLength(2192 + 277);
    expect(new Set(days.map(d => d.date)).size).toBe(days.length); // 重複なし
    expect(hasStoredPast(35.36, 139.36, '2020-01-01', '2026-10-04')).toBe(true);
  });

  it('同じ期間の今年分は6時間メモリにキャッシュし、過ぎたら取り直す', async () => {
    archiveMock();
    await fetchDailyActuals(35.35, 139.35, '2026-01-01', '2026-10-03');
    await fetchDailyActuals(35.35, 139.35, '2026-01-01', '2026-10-03');
    expect(weatherFetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 6 * HOUR + 1));
    await fetchDailyActuals(35.35, 139.35, '2026-01-01', '2026-10-03');
    expect(weatherFetch).toHaveBeenCalledTimes(2);
  });
});
