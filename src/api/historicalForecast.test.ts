import { describe, expect, it, vi } from 'vitest';
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
});
