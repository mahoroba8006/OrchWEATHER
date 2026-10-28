import { describe, expect, it } from 'vitest';
import { buildCalendar } from './weatherCalendar';
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
const past = range(-14, -1);
const future = range(0, 14);

describe('buildCalendar', () => {
  it('日曜始まりで今日の2週間前〜2週間後を並べ、範囲外は空きマス', () => {
    const cells = buildCalendar(past, future, today, 'severity');
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 3)).toEqual([null, null, null]); // 10/11〜10/13
    expect(cells[3]!.date).toBe('2026-10-14');
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
