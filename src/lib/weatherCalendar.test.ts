import { describe, expect, it } from 'vitest';
import { buildCalendar, calendarRange, currentPeriodStart, skyKind } from './weatherCalendar';
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
const past = range(-10, -1);
const future = range(0, 14);

describe('buildCalendar', () => {
  it('日曜始まりで、前週の日曜から天気を埋め、日別の表の最終日より先は空きマス', () => {
    const cells = buildCalendar(past, future, today, 'severity');
    expect(cells).toHaveLength(28);
    expect(cells.slice(0, 4).map(c => [c!.date, c!.status, c!.code !== null])).toEqual([
      ['2026-10-18', 'past', true], ['2026-10-19', 'past', true], ['2026-10-20', 'past', true], ['2026-10-21', 'past', true],
    ]);
    expect(cells[24]!.date).toBe('2026-11-11');
    expect(cells.slice(25)).toEqual([null, null, null]);
    expect(cells.filter(c => c?.status === 'today').map(c => c!.date)).toEqual([today]);
  });

  it('天気はリスク・概況で選び、雨は午前・午後・夜間の合計・確率は最大', () => {
    const risk = buildCalendar(past, future, today, 'severity').find(c => c?.date === today)!;
    const freq = buildCalendar(past, future, today, 'frequency').find(c => c?.date === today)!;
    expect(risk.code).toBe(61);
    expect(freq.code).toBe(0);
    expect(risk.precipSum).toBe(1.5);
    expect(risk.precipProb).toBe(40);
  });

  it('概況は午前・午後（4〜20時）だけで決め、リスクは夜間も含める', () => {
    // 日中は晴れ4・雨4（同じなら降っている方 → 雨）。夜間まで含めると晴れ11・雨5で晴れになる
    const d = day(today, { amCodes: [0, 0, 0, 0], pmCodes: [61, 61, 61, 61], nightCodes: [0, 0, 0, 0, 0, 0, 0, 95] });
    const at = (mode: 'severity' | 'frequency') => buildCalendar(past, [d, ...future.slice(1)], today, mode).find(c => c?.date === today)!;
    expect(at('frequency').code).toBe(61);
    expect(at('severity').code).toBe(95);
  });

  it('過去の日は降水確率を出さず、データがあれば押せる（空しらべへ）。8日目以降は far', () => {
    const cells = buildCalendar(past, future, today, 'severity');
    const y = cells.find(c => c?.date === '2026-10-27')!;
    expect(y.precipProb).toBeNull();
    expect(y.pickable).toBe(true);
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

describe('calendarRange', () => {
  it('前週の日曜から。日曜・土曜の今日でも前週の日曜', () => {
    expect(calendarRange('2026-11-01', []).first).toBe('2026-10-25'); // 日曜
    expect(calendarRange('2026-10-31', []).first).toBe('2026-10-18'); // 土曜
  });

  it('これから側は午前・午後・夜間の予報がそろう最後の日まで（未計算の日・時間別の欠けた日は含めない）', () => {
    const daily = [...range(0, 12), day(addDays(today, 13), { nightCodes: [] }), day(addDays(today, 14), { isPlaceholder: true })];
    expect(calendarRange(today, daily)).toMatchObject({ last: '2026-11-09', gridEnd: '2026-11-14' });
    expect(buildCalendar(past, daily, today, 'severity').filter(c => c === null)).toHaveLength(5);
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

describe('currentPeriodStart', () => {
  const at = (jst: string) => new Date(`${jst}+09:00`);
  it('今の時間帯（午前4〜12時・午後12〜20時・夜間20〜翌4時）の始まり', () => {
    expect(currentPeriodStart(at('2026-10-29T04:00'))).toBe('2026-10-29T04:00');
    expect(currentPeriodStart(at('2026-10-29T11:59'))).toBe('2026-10-29T04:00');
    expect(currentPeriodStart(at('2026-10-29T12:00'))).toBe('2026-10-29T12:00');
    expect(currentPeriodStart(at('2026-10-29T19:30'))).toBe('2026-10-29T12:00');
    expect(currentPeriodStart(at('2026-10-29T20:00'))).toBe('2026-10-29T20:00');
    expect(currentPeriodStart(at('2026-10-29T23:59'))).toBe('2026-10-29T20:00');
  });

  it('0〜4時は前日の夜間の始まり（月をまたいでも）', () => {
    expect(currentPeriodStart(at('2026-10-30T03:59'))).toBe('2026-10-29T20:00');
    expect(currentPeriodStart(at('2026-11-01T00:00'))).toBe('2026-10-31T20:00');
  });
});
