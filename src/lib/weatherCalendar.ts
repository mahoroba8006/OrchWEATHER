import type { DailyForecastData } from '../api/forecast';
import { addDays } from './dateUtils';
import { selectCode, type WeatherCodeMode } from './wmoSeverity';

// 空もようのカレンダー（今日の2週間前〜2週間後・日曜始まり）のマス
export type CalendarStatus = 'past' | 'today' | 'future';

export interface CalendarDay {
  date: string;
  status: CalendarStatus;
  far: boolean;              // 8日目以降（予報の当たりやすさが下がる）
  code: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipProb: number | null; // 過去の日は出さない
  precipSum: number | null;
  pickable: boolean;         // 下の日別の表にある日
}

export const CALENDAR_RANGE = 14;
const FAR_FROM = 8;

const sum3 = (d: DailyForecastData) =>
  d.amPrecipSum === null || d.pmPrecipSum === null || d.nightPrecipSum === null
    ? d.precipSum
    : d.amPrecipSum + d.pmPrecipSum + d.nightPrecipSum;

/** 1日=4時〜翌4時（午前・午後・夜間の合計）。時間別が無い日は日別の値で補う。範囲外のマスは null */
export function buildCalendar(pastDaily: DailyForecastData[], daily: DailyForecastData[], today: string, mode: WeatherCodeMode): (CalendarDay | null)[] {
  const byDate = new Map([...pastDaily, ...daily].map(d => [d.date, d]));
  const tableDates = new Set(daily.filter(d => !d.isPlaceholder).map(d => d.date));
  const first = addDays(today, -CALENDAR_RANGE);
  const last = addDays(today, CALENDAR_RANGE);
  const dow = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -dow(first));
  const gridEnd = addDays(last, 6 - dow(last));
  const cells: (CalendarDay | null)[] = [];
  for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
    if (date < first || date > last) { cells.push(null); continue; }
    const d = byDate.get(date);
    const status: CalendarStatus = date < today ? 'past' : date === today ? 'today' : 'future';
    const has = d && !d.isPlaceholder;
    const codes = d ? [...d.amCodes, ...d.pmCodes, ...d.nightCodes] : [];
    const probs = d ? [d.amPrecipProb, d.pmPrecipProb, d.nightPrecipProb].filter((p): p is number => p !== null) : [];
    cells.push({
      date,
      status,
      far: date >= addDays(today, FAR_FROM),
      code: !has ? null : codes.length > 0 ? selectCode(codes, mode) : d.weatherCode,
      tempMax: has ? d.tempMax : null,
      tempMin: has ? d.tempMin : null,
      precipProb: !has || status === 'past' ? null : probs.length > 0 ? Math.max(...probs) : d.precipProbMax,
      precipSum: has ? sum3(d) : null,
      pickable: tableDates.has(date),
    });
  }
  return cells;
}
