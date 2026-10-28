import { describe, expect, it } from 'vitest';
import { buildCalendar, skyKind } from './weatherCalendar';
import { addDays } from './dateUtils';
import type { DailyForecastData } from '../api/forecast';

const day = (date: string, extra: Partial<DailyForecastData> = {}): DailyForecastData => ({
  date, weatherCode: 3, tempMax: 20, tempMin: 10, precipProbMax: 50, precipSum: 9,
  humidMin: 40, humidMax: 80, sunrise: `${date}T05:00`, sunset: `${date}T18:00`,
  radiationSum: 10, snowfallSum: 0, windSpeedMax: 3, sunshineDuration: 8,
  amCodes: [0, 0, 0], pmCodes: [0, 61], nightCodes: [0],
  amPrecipProb: 10, pmPrecipProb: 40, nightPrecipProb: 20,
  amPrecipSum: 0.5, pmPrecipSum: 1, nightPrecipSum: 0,
  amTempMax: 20, amTempMin: 10, pmTempMax: 20, pmTempMin: 10, nightTempMax: 20, nightTempMin: 10,
  amWindMax: 2, pmWindMax: 2, nightWindMax: 2,
  ...extra,
});

const today = '2026-10-28'; // 水曜
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => day(addDays(today, from + i)));
const past = range(-17, -1);
const future = range(0, 14);

describe('buildCalendar', () => {
  it('日曜始まりで、2週間前を含む週の日曜から天気を埋め、2週間後より先は空きマス', () => {
    const cells = buildCalendar(past, future, today, 'severity');
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 4).map(c => [c!.date, c!.status, c!.code !== null])).toEqual([
      ['2026-10-11', 'past', true], ['2026-10-12', 'past', true], ['2026-10-13', 'past', true], ['2026-10-14', 'past', true],
    ]);
    expect(cells[31]!.date).toBe('2026-11-11');
    expect(cells.slice(32)).toEqual([null, null, null]);
    expect(cells.filter(c => c?.status === 'today').map(c => c!.date)).toEqual([today]);
  });

  it('天気は午前・午後・夜間を合わせてリスク／概況で選び、雨は3つの合計・確率は最大', () => {
    const risk = buildCalendar(past, future, today, 'severity').find(c => c?.date === today)!;
    const freq = buildCalendar(past, future, today, 'frequency').find(c => c?.date === today)!;
    expect(risk.code).toBe(61);
    expect(freq.code).toBe(0);
    expect(risk.precipSum).toBe(1.5);
    expect(risk.precipProb).toBe(40);
  });

  it('過去の日は降水確率を出さず、押せない。8日目以降は far', () => {
    const cells = buildCalendar(past, future, today, 'severity');
    const y = cells.find(c => c?.date === '2026-10-27')!;
    expect(y.precipProb).toBeNull();
    expect(y.pickable).toBe(false);
    expect(cells.find(c => c?.date === today)!.pickable).toBe(true);
    expect(cells.find(c => c?.date === '2026-11-04')!.far).toBe(false);
    expect(cells.find(c => c?.date === '2026-11-05')!.far).toBe(true);
  });

  it('時間別が無い日は日別の値、データの無い日は空欄', () => {
    const noHourly = day('2026-10-20', { amCodes: [], pmCodes: [], nightCodes: [], amPrecipSum: null, pmPrecipSum: null, nightPrecipSum: null });
    const cells = buildCalendar([noHourly], [day(today, { isPlaceholder: true })], today, 'severity');
    const c = cells.find(x => x?.date === '2026-10-20')!;
    expect(c.code).toBe(3);
    expect(c.precipSum).toBe(9);
    const t = cells.find(x => x?.date === today)!;
    expect([t.code, t.tempMax, t.precipProb, t.pickable]).toEqual([null, null, null, false]);
    expect(cells.find(x => x?.date === '2026-10-21')!.code).toBeNull();
  });
});

describe('skyKind', () => {
  it('太陽が描かれる 快晴・晴れ・晴れ時々曇り は晴れ、曇り・霧はくもり', () => {
    expect([0, 1, 2].map(skyKind)).toEqual(['clear', 'clear', 'clear']);
    expect([3, 45, 48].map(skyKind)).toEqual(['cloud', 'cloud', 'cloud']);
    expect([51, 61, 80, 66].map(skyKind)).toEqual(['rain', 'rain', 'rain', 'rain']);
    expect([71, 77, 85, 86].map(skyKind)).toEqual(['snow', 'snow', 'snow', 'snow']);
    expect([95, 99].map(skyKind)).toEqual(['thunder', 'thunder']);
  });
});
