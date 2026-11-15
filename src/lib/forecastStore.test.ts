import { beforeEach, describe, expect, it } from 'vitest';
import type { ForecastData } from '../api/forecast';
import { loadStoredForecast, saveStoredForecast, STORED_FORECAST_MAX_AGE_MS } from './forecastStore';

const NOW = Date.parse('2026-11-15T06:00:00+09:00');
const fc = (lat: number, lon: number, fetchedAt = NOW) =>
  ({ hourly: [], daily: [], pastDaily: [], fetchedAt, lat, lon }) as unknown as ForecastData;

beforeEach(() => localStorage.clear());

describe('前回の予報を端末に保存', () => {
  it('保存した地点の予報を読み出せる・別の地点は無い', () => {
    saveStoredForecast(fc(35, 139), 35, 139);
    expect(loadStoredForecast(35, 139, NOW)?.lat).toBe(35);
    expect(loadStoredForecast(36, 138, NOW)).toBeNull();
  });
  it('12時間より古い予報は出さない', () => {
    saveStoredForecast(fc(35, 139), 35, 139);
    expect(loadStoredForecast(35, 139, NOW + STORED_FORECAST_MAX_AGE_MS)).not.toBeNull();
    expect(loadStoredForecast(35, 139, NOW + STORED_FORECAST_MAX_AGE_MS + 1)).toBeNull();
  });
  it('日本時間で日付をまたいだ予報は出さない（23:59 に取って 0:01 に開く）', () => {
    const t = Date.parse('2026-11-14T23:59:00+09:00');
    saveStoredForecast(fc(35, 139, t), 35, 139);
    expect(loadStoredForecast(35, 139, Date.parse('2026-11-14T23:59:59+09:00'))).not.toBeNull();
    expect(loadStoredForecast(35, 139, Date.parse('2026-11-15T00:01:00+09:00'))).toBeNull();
  });
  it('新しい順に3地点まで残し、同じ地点は置き換える', () => {
    for (const lat of [1, 2, 3, 4]) saveStoredForecast(fc(lat, 0), lat, 0);
    saveStoredForecast(fc(3, 0, NOW + 1), 3, 0);
    expect(loadStoredForecast(1, 0, NOW)).toBeNull();
    expect(loadStoredForecast(3, 0, NOW)?.fetchedAt).toBe(NOW + 1);
    expect(loadStoredForecast(2, 0, NOW)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('orch.forecast.v1')!)).toHaveLength(3);
  });
  it('壊れた保存内容は無視する', () => {
    localStorage.setItem('orch.forecast.v1', '{not json');
    expect(loadStoredForecast(35, 139, NOW)).toBeNull();
    localStorage.setItem('orch.forecast.v1', JSON.stringify([{ key: '35,139', data: { hourly: 1 } }]));
    expect(loadStoredForecast(35, 139, NOW)).toBeNull();
  });
});
