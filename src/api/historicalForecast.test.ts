import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHistoricalForecast, HISTORY_DAYS } from './historicalForecast';

describe('fetchHistoricalForecast', () => {
  it('開始日から16日分の日を並べ、今日以降はプレースホルダー（取得しない）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const jst = new Date(Date.now() + 9 * 3600_000);
    const today = jst.toISOString().slice(0, 10);
    const r = await fetchHistoricalForecast(35, 139, today);
    expect(HISTORY_DAYS).toBe(16);
    expect(r.daily).toHaveLength(16);
    expect(r.daily[0].date).toBe(today);
    expect(r.daily.every(d => d.isPlaceholder)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  describe('最終日の夜間', () => {
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    // 指定した時間ごとの雨（各1mm）を返す偽の API
    const fakeApi = (times: string[]) => {
      const dates = [...new Set(times.map(t => t.slice(0, 10)))];
      return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        hourly: { time: times, precipitation: times.map(() => 1), weather_code: times.map(() => 61) },
        daily: { time: dates, temperature_2m_max: dates.map(() => 20), temperature_2m_min: dates.map(() => 10) },
      })));
    };
    const hoursOf = (date: string, from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => `${date}T${String(from + i).padStart(2, '0')}:00`);

    it('昨日の夜間に今日の0〜3時を含める（翌日まで取得し、時間別は今日の4時より前で切る）', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-29T13:00:00+09:00'));
      const spy = fakeApi([...hoursOf('2026-10-28', 0, 23), ...hoursOf('2026-10-29', 0, 23)]);
      const r = await fetchHistoricalForecast(35, 139, '2026-10-20');
      expect(spy.mock.calls[0][0]).toContain('end_date=2026-10-29');
      const y = r.daily.find(d => d.date === '2026-10-28')!;
      expect(y.nightPrecipSum).toBe(8); // 20〜23時＋0〜3時
      expect(r.hourly.at(-1)!.time).toBe('2026-10-29T03:00');
      expect(r.daily.find(d => d.date === '2026-10-29')!.isPlaceholder).toBe(true);
    });

    it('今が0〜4時なら、今の時刻より前までにする', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-29T02:30:00+09:00'));
      fakeApi([...hoursOf('2026-10-28', 0, 23), ...hoursOf('2026-10-29', 0, 23)]);
      const r = await fetchHistoricalForecast(35, 139, '2026-10-20');
      expect(r.hourly.at(-1)!.time).toBe('2026-10-29T01:00');
      expect(r.daily.find(d => d.date === '2026-10-28')!.nightPrecipSum).toBe(6);
    });
  });
});
