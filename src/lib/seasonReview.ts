// 季節のあしどり（気温・降水量・積算温度・日照時間の去年・5年平均比）と、節気ふりかえりカードの計算。
// 過去の実績値の集計・比較のみを扱う（将来の見通しは出さない＝予報業務に当たらない）。
// 日付はすべて "YYYY-MM-DD"（JST 暦日）。加減算は dateUtils.addDays（UTC 基準）を使う。
import type { DailyActual } from '../api/weather';
import type { DailyForecastData } from '../api/forecast';
import { addDays } from './dateUtils';
import { SEKKI, sekkiForDate } from './sekki';

/** 5年平均に使う年数（去年〜5年前） */
export const AVG_YEARS = 5;
/** 積算が少ない時期に使う「直近◯日」 */
export const RECENT_DAYS = 30;
/** カードを帯の下に出す日数（新しい節気の初日を含む） */
export const CARD_WINDOW_DAYS = 3;
/** 雨を割合で比べるための最小基準（mm）。未満は mm 差で表す（0除算・誤解の防止） */
export const RAIN_RATIO_MIN_BASE = 5;
/** 「まとまった雨」とみなす日降水量（mm） */
export const HEAVY_RAIN_MM = 10;

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

// ---- 日別データ ----

export interface DayRecord {
  date: string;
  tempMean: number;
  tempMax: number;
  tempMin: number;
  precip: number;
  sunshine: number;
}
export type DayMap = Map<string, DayRecord>;

export function fromArchive(days: DailyActual[]): DayRecord[] {
  return days.map(d => ({
    date: d.date, tempMean: d.tempMean, tempMax: d.tempMax, tempMin: d.tempMin,
    precip: d.precipSum ?? 0, sunshine: d.sunshineDuration,
  }));
}

/** 予報の過去日（archive の直近欠けの補完用）。日平均気温は無いので (最高+最低)/2 で代用 */
export function fromForecastPast(days: DailyForecastData[]): DayRecord[] {
  return days.filter(d => !d.isPlaceholder).map(d => ({
    date: d.date, tempMean: (d.tempMax + d.tempMin) / 2, tempMax: d.tempMax, tempMin: d.tempMin,
    precip: d.precipSum, sunshine: d.sunshineDuration,
  }));
}

/** archive を優先し、archive に無い日だけ fill で補う */
export function buildDayMap(archive: DayRecord[], fill: DayRecord[]): DayMap {
  const map: DayMap = new Map();
  for (const d of archive) map.set(d.date, d);
  for (const d of fill) if (!map.has(d.date)) map.set(d.date, d);
  return map;
}

// ---- 範囲集計 ----

export interface RangeStats { meanTemp: number; precip: number; sunshine: number }

/** start〜end の集計。1日でも欠けがあれば null（欠けた合計を誤って見せない） */
export function rangeStats(map: DayMap, start: string, end: string): RangeStats | null {
  let n = 0, t = 0, p = 0, s = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const r = map.get(d);
    if (!r) return null;
    n++; t += r.tempMean; p += r.precip; s += r.sunshine;
  }
  return n ? { meanTemp: t / n, precip: p, sunshine: s } : null;
}

/** 同じ月日範囲の去年と5年平均（去年〜5年前） */
export function comparisonStats(map: DayMap, start: string, end: string): { lastYear: RangeStats; avg: RangeStats } | null {
  const per: RangeStats[] = [];
  for (let k = 1; k <= AVG_YEARS; k++) {
    const s = rangeStats(map, shiftYear(start, -k), shiftYear(end, -k));
    if (!s) return null;
    per.push(s);
  }
  const mean = (f: (s: RangeStats) => number) => per.reduce((a, s) => a + f(s), 0) / per.length;
  return {
    lastYear: per[0],
    avg: { meanTemp: mean(s => s.meanTemp), precip: mean(s => s.precip), sunshine: mean(s => s.sunshine) },
  };
}

function rangeDays(map: DayMap, start: string, end: string): DayRecord[] {
  const out: DayRecord[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const r = map.get(d);
    if (r) out.push(r);
  }
  return out;
}

// ---- 比較文言 ----

export type Tone = 'more' | 'less' | 'same';
export interface CompareCell { text: string; tone: Tone }
export interface CompareRow { label: string; value: string; vsLastYear: CompareCell; vsAvg: CompareCell }

const toneOf = (v: number): Tone => (v > 0 ? 'more' : v < 0 ? 'less' : 'same');

/** 丸め済みの値に符号を付ける（+1.0 / −1.5 / ±0.0）。マイナスは U+2212 */
function signed(v: number, digits: number): string {
  if (v > 0) return `+${v.toFixed(digits)}`;
  if (v < 0) return `−${Math.abs(v).toFixed(digits)}`;
  return `±${(0).toFixed(digits)}`;
}

export function tempCell(cur: number, base: number): CompareCell {
  const d = Number((cur - base).toFixed(1));
  return { text: `${signed(d, 1)}℃`, tone: toneOf(d) };
}

export function sunCell(cur: number, base: number): CompareCell {
  const d = Math.round(cur - base);
  return { text: `${signed(d, 0)}h`, tone: toneOf(d) };
}

export function rainCell(cur: number, base: number): CompareCell {
  if (base < RAIN_RATIO_MIN_BASE) {
    const d = Math.round(cur - base);
    return { text: `${signed(d, 0)}mm`, tone: toneOf(d) };
  }
  const r = Math.round((cur / base) * 10) / 10;
  if (r === 1) return { text: '同じくらい', tone: 'same' };
  if (r < 1) return { text: `${Math.round(r * 10)}割`, tone: 'less' };
  return { text: `${r.toFixed(1)}倍`, tone: 'more' };
}

// ---- 見出し ----

interface Trait { score: number; connective: string; attributive: string }

/** 5年平均とのずれから、ずれの大きい順に最大2項目で一文を作る（score はしきい値で正規化、1以上で該当） */
export function headline(cur: RangeStats, avg: RangeStats): string {
  const traits: Trait[] = [];
  const dt = cur.meanTemp - avg.meanTemp;
  if (dt > 1) traits.push({ score: dt, connective: '暑く', attributive: '暑い' });
  else if (dt < -1) traits.push({ score: -dt, connective: '涼しく', attributive: '涼しい' });
  if (avg.precip >= RAIN_RATIO_MIN_BASE) {
    const r = cur.precip / avg.precip;
    if (r < 0.7) traits.push({ score: 0.7 / Math.max(r, 0.07), connective: '雨が少なく', attributive: '雨の少ない' });
    else if (r > 1.3) traits.push({ score: r / 1.3, connective: '雨が多く', attributive: '雨の多い' });
  }
  if (avg.sunshine > 0) {
    const s = cur.sunshine / avg.sunshine - 1;
    if (s > 0.15) traits.push({ score: s / 0.15, connective: '日差しが多く', attributive: '日差しの多い' });
    else if (s < -0.15) traits.push({ score: -s / 0.15, connective: '日差しが少なく', attributive: '日差しの少ない' });
  }
  if (traits.length === 0) return '平年並みの穏やかな半月でした';
  traits.sort((a, b) => b.score - a.score);
  const [first, second] = traits;
  return second ? `${first.connective}、${second.attributive}半月でした` : `${first.attributive}半月でした`;
}

// ---- 記録 ----

export interface DayValue { date: string; value: number }
export interface SeasonRecords { hottest: DayValue; coolestMorning: DayValue; heavyRain: DayValue | null }

export function records(days: DayRecord[]): SeasonRecords {
  let hot = days[0];
  let cool = days[0];
  let rain: DayRecord | null = null;
  for (const d of days) {
    if (d.tempMax > hot.tempMax) hot = d;
    if (d.tempMin < cool.tempMin) cool = d;
    if (d.precip >= HEAVY_RAIN_MM && (!rain || d.precip > rain.precip)) rain = d;
  }
  return {
    hottest: { date: hot.date, value: hot.tempMax },
    coolestMorning: { date: cool.date, value: cool.tempMin },
    heavyRain: rain ? { date: rain.date, value: rain.precip } : null,
  };
}

// ---- カード ----

export interface SeasonReview {
  range: SekkiRange;
  /** "白露 9/7〜9/22（16日間）" */
  periodLabel: string;
  headline: string;
  rows: CompareRow[];
  /** 期間の日ごとの雨 */
  rain: DayValue[];
  records: SeasonRecords;
  /** "2021〜2025年" */
  avgYears: string;
}

export function buildSeasonReview(map: DayMap, today: string): SeasonReview | null {
  const range = previousSekkiRange(today);
  const cur = rangeStats(map, range.start, range.end);
  const cmp = comparisonStats(map, range.start, range.end);
  if (!cur || !cmp) return null;
  const days = rangeDays(map, range.start, range.end);
  const y = yearOf(range.start);
  return {
    range,
    periodLabel: `${range.name} ${monthDay(range.start)}〜${monthDay(range.end)}（${range.days}日間）`,
    headline: headline(cur, cmp.avg),
    rows: [
      { label: '平均気温', value: `${cur.meanTemp.toFixed(1)}℃`, vsLastYear: tempCell(cur.meanTemp, cmp.lastYear.meanTemp), vsAvg: tempCell(cur.meanTemp, cmp.avg.meanTemp) },
      { label: '雨の量', value: `${Math.round(cur.precip)}mm`, vsLastYear: rainCell(cur.precip, cmp.lastYear.precip), vsAvg: rainCell(cur.precip, cmp.avg.precip) },
      { label: '日照', value: `${Math.round(cur.sunshine)}h`, vsLastYear: sunCell(cur.sunshine, cmp.lastYear.sunshine), vsAvg: sunCell(cur.sunshine, cmp.avg.sunshine) },
    ],
    rain: days.map(d => ({ date: d.date, value: d.precip })),
    records: records(days),
    avgYears: `${y - AVG_YEARS}〜${y - 1}年`,
  };
}

// ---- 季節のあしどり ----

/** analysis = 空くらべの開始日・基準温度に合わせる / recent = すべて直近30日で比べる */
export type SeasonPaceMode = 'analysis' | 'recent';

export interface PaceOptions {
  mode: SeasonPaceMode;
  /** 積算温度の基準温度（℃）。空くらべの基準温度1 */
  baseTemp: number;
  /** 空くらべの累積開始日（MM-DD） */
  startDates: { precip: string; sunshine: string; gdd: string };
  /** 積算温度がこの値（℃日）未満のうちは日数差を出さず差で示す。空くらべの「日数差」ガードと共有 */
  gddDaysMin: number;
}

export const DEFAULT_PACE_OPTIONS: PaceOptions = {
  mode: 'analysis',
  baseTemp: 10,
  startDates: { precip: '01-01', sunshine: '01-01', gdd: '01-01' },
  gddDaysMin: 30,
};

export type PaceItemKind = 'temp' | 'precip' | 'gdd' | 'sunshine';
/** name=項目名（本文の先頭に出す）、period=比べた期間（見出しに出す）、text=去年・5年平均との比較 */
export interface PaceItem { kind: PaceItemKind; name: string; period: string; text: string }

/** 正 = 何日早い、負 = 何日遅い、'ahead' = 比較年が年末までに届かない（今年がかなり早い） */
type PaceDiff = number | 'ahead';

/** onOrBefore 以前でデータがある最新日 */
function latestDate(map: DayMap, onOrBefore: string): string | null {
  let best: string | null = null;
  for (const d of map.keys()) if (d <= onOrBefore && (best === null || d > best)) best = d;
  return best;
}

/** start〜end の日ごとの有効積算温度（base℃を引いた分。下回る日は0）。欠けがあれば null */
function cumulative(map: DayMap, start: string, end: string, base: number): number[] | null {
  const out: number[] = [];
  let sum = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const r = map.get(d);
    if (!r) return null;
    sum += Math.max(0, r.tempMean - base);
    out.push(sum);
  }
  return out;
}

const lastOf = (s: number[]) => s[s.length - 1];
const degDays = (v: number) => `${signed(Math.round(v), 0)}℃日`;

function paceClause(subject: string, d: PaceDiff): string {
  if (d === 'ahead') return `${subject}より早いペース`;
  if (d === 0) return `${subject}と同じペース`;
  return d > 0 ? `${subject}より${d}日早い` : `${subject}より${-d}日遅い`;
}

/** 「6割」「1.5倍」は「去年の〜」、「同じくらい」は「去年と〜」、mm 差は「去年より〜」 */
function ratioClause(subject: string, c: CompareCell): string {
  if (c.text === '同じくらい') return `${subject}と同じくらい`;
  if (c.text.endsWith('割') || c.text.endsWith('倍')) return `${subject}の${c.text}`;
  return `${subject}より${c.text}`;
}

const both = (f: (subject: string) => string) => `${f('去年')}・${f('5年平均')}`;

/** 期間 [start, last] と、去年・5年平均の同じ月日範囲 */
function windowStats(map: DayMap, start: string, last: string) {
  const cur = rangeStats(map, start, last);
  const cmp = comparisonStats(map, start, last);
  return cur && cmp ? { cur, ...cmp } : null;
}

/** 開始日からの積算温度の早い・遅い（比較年が今年の現在値に届いた日との差）。序盤は℃日の差 */
function gddPace(map: DayMap, start: string, last: string, opts: PaceOptions): string | null {
  const cur = cumulative(map, start, last, opts.baseTemp);
  if (!cur || cur.length === 0) return null;
  const series: number[][] = [];
  for (let k = 1; k <= AVG_YEARS; k++) {
    const s = cumulative(map, shiftYear(start, -k), `${yearOf(start) - k}-12-31`, opts.baseTemp);
    if (!s) return null;
    series.push(s);
  }
  // 5年平均は「開始日からの通し日数」ごとの積算値の平均（閏年は短い方に揃える）
  const len = Math.min(...series.map(s => s.length));
  const avg = Array.from({ length: len }, (_, i) => series.reduce((a, s) => a + s[i], 0) / series.length);
  const target = lastOf(cur);
  const idx = cur.length - 1;
  if (target < opts.gddDaysMin) {
    const at = (s: number[]) => s[Math.min(idx, s.length - 1)];
    return `去年より${degDays(target - at(series[0]))}・5年平均より${degDays(target - at(avg))}`;
  }
  const diff = (s: number[]): PaceDiff => {
    const j = s.findIndex(v => v >= target);
    return j === -1 ? 'ahead' : j - idx;
  };
  return `${paceClause('去年', diff(series[0]))}・${paceClause('5年平均', diff(avg))}`;
}

/** 直近期間の積算温度の差（℃日） */
function gddRecent(map: DayMap, start: string, last: string, base: number): string | null {
  const cur = cumulative(map, start, last, base);
  if (!cur || cur.length === 0) return null;
  const per: number[] = [];
  for (let k = 1; k <= AVG_YEARS; k++) {
    const s = cumulative(map, shiftYear(start, -k), shiftYear(last, -k), base);
    if (!s || s.length === 0) return null;
    per.push(lastOf(s));
  }
  const avg = per.reduce((a, v) => a + v, 0) / per.length;
  return `去年より${degDays(lastOf(cur) - per[0])}・5年平均より${degDays(lastOf(cur) - avg)}`;
}

/**
 * 季節のあしどりの各項目（気温・降水量・積算温度・日照時間の順）。作れない項目は含めない。
 * 「今年」は today の暦年で固定（1/1 などに前年分を今年として数えない）。
 */
export function computePaceItems(map: DayMap, today: string, opts: PaceOptions): PaceItem[] {
  const last = latestDate(map, addDays(today, -1));
  if (!last) return [];
  const y = yearOf(today);
  const recentStart = addDays(last, -(RECENT_DAYS - 1));
  const recentLabel = `この${RECENT_DAYS}日`;
  const items: PaceItem[] = [];

  // 気温はどちらのモードでも直近30日の平均（起点からの平均は季節がまざって差が見えにくい）
  const t = windowStats(map, recentStart, last);
  if (t) {
    items.push({
      kind: 'temp',
      name: '気温',
      period: recentLabel,
      text: both(s => `${s}より${tempCell(t.cur.meanTemp, (s === '去年' ? t.lastYear : t.avg).meanTemp).text}`),
    });
  }

  // 比べる期間: recent は直近30日、analysis は今年の開始日から（開始日がまだ来ていなければ出さない）
  const windowOf = (mmdd: string): { start: string; label: string } | null => {
    if (opts.mode === 'recent') return { start: recentStart, label: recentLabel };
    const start = shiftYear(`2000-${mmdd}`, y - 2000); // 2/29 開始を平年は 2/28 に
    return start <= last ? { start, label: `${Number(mmdd.slice(0, 2))}月${Number(mmdd.slice(3, 5))}日から` } : null;
  };

  const pw = windowOf(opts.startDates.precip);
  const p = pw && windowStats(map, pw.start, last);
  if (pw && p) {
    items.push({
      kind: 'precip',
      name: '降水量',
      period: pw.label,
      text: both(s => ratioClause(s, rainCell(p.cur.precip, (s === '去年' ? p.lastYear : p.avg).precip))),
    });
  }

  const gw = windowOf(opts.startDates.gdd);
  const g = gw && (opts.mode === 'recent'
    ? gddRecent(map, gw.start, last, opts.baseTemp)
    : gddPace(map, gw.start, last, opts));
  if (gw && g) {
    items.push({ kind: 'gdd', name: '積算温度', period: `${gw.label}・${opts.baseTemp}℃基準`, text: g });
  }

  const sw = windowOf(opts.startDates.sunshine);
  const sun = sw && windowStats(map, sw.start, last);
  if (sw && sun) {
    items.push({
      kind: 'sunshine',
      name: '日照時間',
      period: sw.label,
      text: both(s => `${s}より${sunCell(sun.cur.sunshine, (s === '去年' ? sun.lastYear : sun.avg).sunshine).text}`),
    });
  }
  return items;
}

// ---- 画面用ビュー ----

export interface SeasonView {
  /** 季節のあしどりの項目（帯で順番に切り替えて見せる） */
  paceItems: PaceItem[];
  review: SeasonReview | null;
  /** カードを帯の下に出すか（節気の変わり目 CARD_WINDOW_DAYS 日間） */
  showCard: boolean;
}

export function computeSeasonView(map: DayMap, today: string, opts: PaceOptions): SeasonView | null {
  const paceItems = computePaceItems(map, today, opts);
  const review = buildSeasonReview(map, today);
  if (paceItems.length === 0 && !review) return null;
  return { paceItems, review, showCard: !!review && isInCardWindow(today) };
}
