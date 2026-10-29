import type { DailyForecastData } from '../api/forecast';
import { addDays } from './dateUtils';
import { selectCode, type WeatherCodeMode } from './wmoSeverity';

// 空もようのカレンダー（前週の日曜〜下の日別の表の最終日・日曜始まり）のマス
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
  pickable: boolean;         // 下の日別の表にある日と、データのある過ぎた日（空しらべへ）
}

const FAR_FROM = 8;

/** 下の日別の表で午前・午後・夜間の予報が出る最後の日（無ければ今日） */
function lastForecastDate(daily: DailyForecastData[], today: string): string {
  const days = daily.filter(d => !d.isPlaceholder && d.amCodes.length > 0 && d.pmCodes.length > 0 && d.nightCodes.length > 0);
  return days.reduce((last, d) => (d.date > last ? d.date : last), today);
}

/** マスの並び。過去側は前週の日曜から、これから側は下の日別の表の最終日まで天気を埋め、その週の土曜までは日付だけ */
export function calendarRange(today: string, daily: DailyForecastData[]): { first: string; last: string; gridEnd: string } {
  const dow = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();
  const last = lastForecastDate(daily, today);
  return { first: addDays(today, -7 - dow(today)), last, gridEnd: addDays(last, 6 - dow(last)) };
}

const sum3 = (d: DailyForecastData) =>
  d.amPrecipSum === null || d.pmPrecipSum === null || d.nightPrecipSum === null
    ? d.precipSum
    : d.amPrecipSum + d.pmPrecipSum + d.nightPrecipSum;

/** 1日=4時〜翌4時（午前・午後・夜間の合計）。時間別が無い日は日別の値で補う。日別の表の最終日より先のマスは null */
export function buildCalendar(pastDaily: DailyForecastData[], daily: DailyForecastData[], today: string, mode: WeatherCodeMode): (CalendarDay | null)[] {
  const byDate = new Map([...pastDaily, ...daily].map(d => [d.date, d]));
  const tableDates = new Set(daily.filter(d => !d.isPlaceholder).map(d => d.date));
  const { first, last, gridEnd } = calendarRange(today, daily);
  const cells: (CalendarDay | null)[] = [];
  for (let date = first; date <= gridEnd; date = addDays(date, 1)) {
    if (date > last) { cells.push(null); continue; }
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
      pickable: tableDates.has(date) || (status === 'past' && !!has),
    });
  }
  return cells;
}

/** マスの地の色の系統。マークに太陽が描かれる「晴れ時々曇り」（2）までは晴れ */
export type SkyKind = 'thunder' | 'snow' | 'rain' | 'cloud' | 'clear';
export function skyKind(code: number): SkyKind {
  if (code >= 95) return 'thunder';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 51) return 'rain';
  if (code >= 3) return 'cloud';
  return 'clear';
}

/** 今の時間帯（午前4〜12時・午後12〜20時・夜間20〜翌4時）の始まり "YYYY-MM-DDTHH:00"。0〜4時は前日の夜間 */
export function currentPeriodStart(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 3600000);
  const date = jst.toISOString().slice(0, 10);
  const h = jst.getUTCHours();
  if (h < 4) return `${addDays(date, -1)}T20:00`;
  return `${date}T${h >= 20 ? '20' : h >= 12 ? '12' : '04'}:00`;
}
