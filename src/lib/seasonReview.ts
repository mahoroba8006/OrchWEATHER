// 今年のあゆみ（積算気温の早い・遅い）と、節気ふりかえりカードの計算。
// 過去の実績値の集計・比較のみを扱う（将来の見通しは出さない＝予報業務に当たらない）。
// 日付はすべて "YYYY-MM-DD"（JST 暦日）。加減算は dateUtils.addDays（UTC 基準）を使う。
import { addDays } from './dateUtils';
import { SEKKI, sekkiForDate } from './sekki';

/** 5年平均に使う年数（去年〜5年前） */
export const AVG_YEARS = 5;
/** 積算が少ない時期に使う「直近◯日」 */
export const RECENT_DAYS = 30;
/** カードを帯の下に出す日数（新しい節気の初日を含む） */
export const CARD_WINDOW_DAYS = 3;

const yearOf = (date: string) => Number(date.slice(0, 4));
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 年だけずらす（2/29 → 平年は 2/28） */
export function shiftYear(date: string, k: number): string {
  const y = yearOf(date) + k;
  const md = date.slice(5);
  return md === '02-29' && !isLeap(y) ? `${y}-02-28` : `${y}-${md}`;
}

const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** start〜end の日数（両端を含む） */
export function daysBetween(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / 86400000) + 1;
}

/** "9/7" */
export function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

const sekkiIndexOf = (date: string) => sekkiForDate(new Date(`${date}T12:00:00+09:00`)).index;

export interface SekkiRange { index: number; name: string; start: string; end: string; days: number }

/** today が属する節気の開始日 */
export function currentSekkiStart(today: string): string {
  const idx = sekkiIndexOf(today);
  let d = today;
  while (sekkiIndexOf(addDays(d, -1)) === idx) d = addDays(d, -1);
  return d;
}

/** 直前に終わった節気の範囲 */
export function previousSekkiRange(today: string): SekkiRange {
  const end = addDays(currentSekkiStart(today), -1);
  const start = currentSekkiStart(end);
  const index = sekkiIndexOf(end);
  return { index, name: SEKKI[index].name, start, end, days: daysBetween(start, end) };
}

/** 新しい節気の初日から CARD_WINDOW_DAYS 日間か */
export function isInCardWindow(today: string): boolean {
  return daysBetween(currentSekkiStart(today), today) <= CARD_WINDOW_DAYS;
}

/** 計算に必要な年（昇順）。実績は昨日までなので、上限は昨日の年 */
export function requiredYears(today: string): number[] {
  const yesterday = addDays(today, -1);
  const last = yearOf(yesterday);
  const earliest = Math.min(
    yearOf(previousSekkiRange(today).start),
    yearOf(addDays(yesterday, -(RECENT_DAYS - 1))),
  ) - AVG_YEARS;
  return Array.from({ length: last - earliest + 1 }, (_, i) => earliest + i);
}
