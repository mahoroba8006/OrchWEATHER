# 今年のあゆみ＋節気ふりかえりカード 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 空もようタブのヒーロー直下に「今年のあゆみ（積算気温の早い・遅い）」の帯と、節気の変わり目3日間だけ現れる「節気ふりかえりカード」を追加する。

**Architecture:** 計算はすべて純粋関数 `src/lib/seasonReview.ts`（日付文字列 "YYYY-MM-DD" の Map を入力）。取得は `useSeasonReview` フックが予報取得完了後に既存 `fetchWeatherData`（年単位・メモリキャッシュ）で必要年を並列取得し、予報の `pastDaily` で直近の欠けを補う。表示は帯・カード・シートの3部品で、予報表示を待たせない。

**Tech Stack:** React 19 / TypeScript / Vite / Vitest + Testing Library / motion（`m.*`） / 既存 UI 部品（Skeleton・Sheet）

**仕様書:** [docs/superpowers/specs/2026-10-03-season-review-design.md](../specs/2026-10-03-season-review-design.md)

**法的前提（実装者向け）:** 過去実績の集計・比較のみ。将来の見通しを表す文言（「〜になりそう」等）を一切追加しないこと。

---

## ファイル構成

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/lib/seasonReview.ts` | 新規 | 純粋関数（節気範囲・データ結合・集計・比較文言・見出し・積算ペース） |
| `src/lib/seasonReview.test.ts` | 新規 | 上記の単体テスト |
| `src/lib/analytics.ts` | 変更 | `logSeasonCardView` / `logSeasonCardOpen` 追加 |
| `src/api/weather.ts` | 変更 | 当年分のメモリキャッシュを6時間で失効 |
| `src/api/weather.test.ts` | 新規 | キャッシュ失効のテスト |
| `src/api/forecast.ts` | 変更 | 予報データに取得地点 `lat/lon` を付与 |
| `src/hooks/useSeasonReview.ts` | 新規 | 必要年の取得→計算。状態 idle/loading/hidden/ready |
| `src/hooks/useSeasonReview.test.ts` | 新規 | フックのテスト |
| `src/components/season/YearPaceStrip.tsx` | 新規 | 一行比較の帯（骨組み→本体） |
| `src/components/season/SeasonReviewCard.tsx` | 新規 | カード本体＋帯下に滑らかに出す `SeasonInlineCard` |
| `src/components/season/season.css` | 新規 | 帯・カードのスタイル |
| `src/components/season/season.test.tsx` | 新規 | 部品テスト |
| `src/components/sky/SekkiBadge.tsx` | 変更 | `onOpen` があればボタン化 |
| `src/components/sky/SekkiBadge.test.tsx` | 変更 | ボタン化のテスト追加 |
| `src/components/sky/SkyHero.tsx` | 変更 | `onSekkiOpen` を SekkiBadge へ中継 |
| `src/components/sky/sky.css` | 変更 | バッジボタンのスタイル |
| `src/components/weather/WeatherTab.tsx` | 変更 | フック・帯・カード・シートの配置 |

テスト実行コマンドは `npx vitest run <path>`。全体は `npm test`。

---

### Task 1: 日付・節気範囲・必要年

**Files:**
- Create: `src/lib/seasonReview.ts`
- Test: `src/lib/seasonReview.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/seasonReview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  currentSekkiStart, daysBetween, isInCardWindow, previousSekkiRange, requiredYears, shiftYear,
} from './seasonReview';

describe('日付ユーティリティ', () => {
  it('shiftYear は年だけずらし、2/29 は平年で 2/28 にする', () => {
    expect(shiftYear('2026-09-07', -5)).toBe('2021-09-07');
    expect(shiftYear('2024-02-29', -1)).toBe('2023-02-28');
  });
  it('daysBetween は両端を含む日数', () => {
    expect(daysBetween('2026-09-07', '2026-09-22')).toBe(16);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(2);
  });
});

describe('節気範囲', () => {
  // 国立天文台 暦要項 2026: 白露 9/7、秋分 9/23、小寒 1/5
  it('今の節気の開始日', () => {
    expect(currentSekkiStart('2026-10-01')).toBe('2026-09-23');
  });
  it('直前に終わった節気の範囲', () => {
    expect(previousSekkiRange('2026-10-01')).toEqual({
      index: 14, name: '白露', start: '2026-09-07', end: '2026-09-22', days: 16,
    });
  });
  it('年をまたぐ節気（冬至）', () => {
    const r = previousSekkiRange('2026-01-06');
    expect(r.name).toBe('冬至');
    expect(r.start.startsWith('2025-12-2')).toBe(true);
    expect(r.end).toBe('2026-01-04');
  });
  it('カードは新しい節気の初日から3日間だけ', () => {
    expect(isInCardWindow('2026-09-23')).toBe(true);
    expect(isInCardWindow('2026-09-25')).toBe(true);
    expect(isInCardWindow('2026-09-26')).toBe(false);
  });
});

describe('requiredYears', () => {
  it('通常は昨日の年から5年前まで', () => {
    expect(requiredYears('2026-10-03')).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
  });
  it('年をまたぐ節気・30日範囲では前年起点で5年前まで', () => {
    expect(requiredYears('2026-01-06')).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });
  it('1/1 は今年のデータが無いので今年を含めない', () => {
    expect(requiredYears('2026-01-01')).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/seasonReview.test.ts`
Expected: FAIL（`./seasonReview` が存在しない）

- [ ] **Step 3: 実装**

`src/lib/seasonReview.ts`:

```ts
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
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/seasonReview.test.ts`
Expected: PASS（8件）。節気日付のテストが落ちた場合は、`sekkiForDate` の結果を出力して国立天文台の暦要項と照合し、**誤っている側を特定してから**直す（テストの期待値を安易に変えない）。

- [ ] **Step 5: コミット**

```bash
git add src/lib/seasonReview.ts src/lib/seasonReview.test.ts
git commit -m "feat: 節気範囲と必要年の計算を追加"
```

---

### Task 2: 日別データの結合・範囲集計・比較文言・見出し・カード組み立て

**Files:**
- Modify: `src/lib/seasonReview.ts`
- Test: `src/lib/seasonReview.test.ts`

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/seasonReview.test.ts` の import を次に置き換え、末尾にテストを追記:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildDayMap, buildSeasonReview, currentSekkiStart, daysBetween, fromForecastPast, headline,
  isInCardWindow, previousSekkiRange, rainCell, requiredYears, shiftYear, tempCell,
  type DayMap, type DayRecord,
} from './seasonReview';
import { addDays } from './dateUtils';
import type { DailyForecastData } from '../api/forecast';

const rec = (date: string, r: Partial<DayRecord> = {}): DayRecord => ({
  date, tempMean: 10, tempMax: 15, tempMin: 5, precip: 0, sunshine: 5, ...r,
});
function fill(map: DayMap, start: string, end: string, r: Partial<DayRecord>) {
  for (let d = start; d <= end; d = addDays(d, 1)) map.set(d, rec(d, r));
}
```

追記するテスト:

```ts
describe('buildDayMap', () => {
  it('archive を優先し、無い日だけ補完する', () => {
    const map = buildDayMap(
      [rec('2026-09-20', { precip: 1 })],
      [rec('2026-09-20', { precip: 9 }), rec('2026-09-21', { precip: 2 })],
    );
    expect(map.get('2026-09-20')?.precip).toBe(1);
    expect(map.get('2026-09-21')?.precip).toBe(2);
  });
  it('予報の pastDaily は (最高+最低)/2 を日平均にし、placeholder を除く', () => {
    const base = { tempMax: 30, tempMin: 20, precipSum: 3, sunshineDuration: 4 };
    const days = fromForecastPast([
      { ...base, date: '2026-09-21' } as DailyForecastData,
      { ...base, date: '2026-09-22', isPlaceholder: true } as DailyForecastData,
    ]);
    expect(days).toEqual([{ date: '2026-09-21', tempMean: 25, tempMax: 30, tempMin: 20, precip: 3, sunshine: 4 }]);
  });
});

describe('比較文言', () => {
  it('tempCell は小数1桁の符号付き', () => {
    expect(tempCell(24, 23)).toEqual({ text: '+1.0℃', tone: 'more' });
    expect(tempCell(22.96, 23)).toEqual({ text: '±0.0℃', tone: 'same' });
    expect(tempCell(21.5, 23)).toEqual({ text: '−1.5℃', tone: 'less' });
  });
  it('rainCell は基準5mm以上で割合、未満で mm 差', () => {
    expect(rainCell(38, 64)).toEqual({ text: '6割', tone: 'less' });
    expect(rainCell(100, 64)).toEqual({ text: '1.6倍', tone: 'more' });
    expect(rainCell(64, 64)).toEqual({ text: '同じくらい', tone: 'same' });
    expect(rainCell(3, 2)).toEqual({ text: '+1mm', tone: 'more' });
  });
});

describe('headline', () => {
  const avg = { meanTemp: 23, precip: 64, sunshine: 80 };
  it('ずれの大きい2項目を組み合わせる', () => {
    expect(headline({ meanTemp: 24, precip: 38, sunshine: 96 }, avg)).toBe('日差しが多く、雨の少ない半月でした');
  });
  it('1項目だけなら連体形で終える', () => {
    expect(headline({ meanTemp: 25, precip: 64, sunshine: 80 }, avg)).toBe('暑い半月でした');
  });
  it('該当なしは平年並み', () => {
    expect(headline({ meanTemp: 23.5, precip: 60, sunshine: 85 }, avg)).toBe('平年並みの穏やかな半月でした');
  });
  it('5年平均の雨が5mm未満なら雨は判定しない', () => {
    expect(headline({ meanTemp: 23, precip: 20, sunshine: 80 }, { ...avg, precip: 2 })).toBe('平年並みの穏やかな半月でした');
  });
});

describe('buildSeasonReview', () => {
  // 白露 2026-09-07〜09-22（16日）。過去5年は毎日 23℃・4mm・5h
  function sampleMap(): DayMap {
    const map: DayMap = new Map();
    for (let y = 2021; y <= 2025; y++) fill(map, `${y}-09-01`, `${y}-09-30`, { tempMean: 23, precip: 4, sunshine: 5 });
    fill(map, '2026-09-01', '2026-09-30', { tempMean: 24, tempMax: 30, tempMin: 18, precip: 0, sunshine: 6 });
    map.set('2026-09-09', rec('2026-09-09', { tempMean: 24, tempMax: 33.2, tempMin: 18, sunshine: 6 }));
    map.set('2026-09-11', rec('2026-09-11', { tempMean: 24, tempMax: 30, tempMin: 18, precip: 22, sunshine: 6 }));
    map.set('2026-09-12', rec('2026-09-12', { tempMean: 24, tempMax: 30, tempMin: 18, precip: 16, sunshine: 6 }));
    map.set('2026-09-21', rec('2026-09-21', { tempMean: 24, tempMax: 30, tempMin: 15.8, sunshine: 6 }));
    return map;
  }

  it('期間・見出し・3項目・雨の棒・記録を組み立てる', () => {
    const r = buildSeasonReview(sampleMap(), '2026-10-01')!;
    expect(r.periodLabel).toBe('白露 9/7〜9/22（16日間）');
    expect(r.headline).toBe('日差しが多く、雨の少ない半月でした');
    expect(r.rows).toEqual([
      { label: '平均気温', value: '24.0℃', vsLastYear: { text: '+1.0℃', tone: 'more' }, vsAvg: { text: '+1.0℃', tone: 'more' } },
      { label: '雨の量', value: '38mm', vsLastYear: { text: '6割', tone: 'less' }, vsAvg: { text: '6割', tone: 'less' } },
      { label: '日照', value: '96h', vsLastYear: { text: '+16h', tone: 'more' }, vsAvg: { text: '+16h', tone: 'more' } },
    ]);
    expect(r.rain).toHaveLength(16);
    expect(r.records).toEqual({
      hottest: { date: '2026-09-09', value: 33.2 },
      coolestMorning: { date: '2026-09-21', value: 15.8 },
      heavyRain: { date: '2026-09-11', value: 22 },
    });
    expect(r.avgYears).toBe('2021〜2025年');
  });

  it('期間内に欠けがあれば null', () => {
    const map = sampleMap();
    map.delete('2026-09-15');
    expect(buildSeasonReview(map, '2026-10-01')).toBeNull();
  });

  it('10mm 以上の雨が無ければ heavyRain は null', () => {
    const map = sampleMap();
    map.set('2026-09-11', rec('2026-09-11', { precip: 9 }));
    map.set('2026-09-12', rec('2026-09-12', { precip: 9 }));
    expect(buildSeasonReview(map, '2026-10-01')!.records.heavyRain).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/seasonReview.test.ts`
Expected: FAIL（`buildDayMap` などが未定義）

- [ ] **Step 3: 実装**

`src/lib/seasonReview.ts` の import 2行を次に置き換える:

```ts
import type { DailyWeather } from '../api/weather';
import type { DailyForecastData } from '../api/forecast';
import { addDays } from './dateUtils';
import { SEKKI, sekkiForDate } from './sekki';
```

定数の下に追加:

```ts
/** 雨を割合で比べるための最小基準（mm）。未満は mm 差で表す（0除算・誤解の防止） */
export const RAIN_RATIO_MIN_BASE = 5;
/** 「まとまった雨」とみなす日降水量（mm） */
export const HEAVY_RAIN_MM = 10;
```

ファイル末尾に追加:

```ts
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

export function fromArchive(days: DailyWeather[]): DayRecord[] {
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
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/seasonReview.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add src/lib/seasonReview.ts src/lib/seasonReview.test.ts
git commit -m "feat: 節気ふりかえりの集計・比較文言・見出しを追加"
```

---

### Task 3: 積算気温のペースと表示用ビュー

**Files:**
- Modify: `src/lib/seasonReview.ts`
- Test: `src/lib/seasonReview.test.ts`

- [ ] **Step 1: 失敗するテストを追記**

import に `computeSeasonView, computeYearPace, formatYearPace` を追加し、末尾に追記:

```ts
describe('積算気温のペース', () => {
  // 過去年（2020〜2025）は毎日 10℃
  function pastYears(): DayMap {
    const map: DayMap = new Map();
    for (let y = 2020; y <= 2025; y++) fill(map, `${y}-01-01`, `${y}-12-31`, { tempMean: 10 });
    return map;
  }

  it('今年が暖かいと「早い」（10/2 時点・毎日11℃ → 28日早い）', () => {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-10-02', { tempMean: 11 });
    const p = computeYearPace(map, '2026-10-03')!;
    expect(p).toEqual({ kind: 'accum', vsLastYear: 28, vsAvg: 28 });
    expect(formatYearPace(p)).toEqual({
      label: '今年のあゆみ（1月1日から）',
      text: '積算気温 去年より28日早い・5年平均より28日早い',
    });
  });

  it('今年が涼しいと「遅い」', () => {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-10-02', { tempMean: 9 });
    const p = computeYearPace(map, '2026-10-03')!;
    expect(p).toEqual({ kind: 'accum', vsLastYear: -27, vsAvg: -27 });
    expect(formatYearPace(p).text).toBe('積算気温 去年より27日遅い・5年平均より27日遅い');
  });

  it('比較年が年末までに届かなければ「早いペース」', () => {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-10-02', { tempMean: 30 });
    const p = computeYearPace(map, '2026-10-03')!;
    expect(p).toEqual({ kind: 'accum', vsLastYear: 'ahead', vsAvg: 'ahead' });
    expect(formatYearPace(p).text).toBe('積算気温 去年より早いペース・5年平均より早いペース');
  });

  it('同じなら「同じペース」', () => {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-10-02', { tempMean: 10 });
    expect(formatYearPace(computeYearPace(map, '2026-10-03')!).text)
      .toBe('積算気温 去年と同じペース・5年平均と同じペース');
  });

  it('積算 200℃・日 未満の時期は直近30日の平均気温差', () => {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-01-09', { tempMean: 11 });
    const p = computeYearPace(map, '2026-01-10')!;
    expect(p.kind).toBe('recent');
    expect(formatYearPace(p)).toEqual({
      label: 'この30日',
      text: '平均気温 去年より+0.3℃・5年平均より+0.3℃',
    });
  });

  it('0℃未満の日は0として積算する（積算値を減らさない）', () => {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-01-31', { tempMean: -5 });
    fill(map, '2026-02-01', '2026-10-02', { tempMean: 11 });
    // 244日×11 = 2684 → 過去年は 269日目（通し番号268）で到達 → 268-274 = 6日遅い
    expect(computeYearPace(map, '2026-10-03')).toEqual({ kind: 'accum', vsLastYear: -6, vsAvg: -6 });
  });

  it('1/1 は前年分を「今年」として数えず、直近30日に切り替える', () => {
    const p = computeYearPace(pastYears(), '2026-01-01')!;
    expect(p.kind).toBe('recent');
    expect(formatYearPace(p).text).toBe('平均気温 去年より±0.0℃・5年平均より±0.0℃');
  });

  it('当年データが未着の 1/2 も前年を「今年」として数えない', () => {
    expect(computeYearPace(pastYears(), '2026-01-02')!.kind).toBe('recent');
  });

  it('データが無ければ null', () => {
    expect(computeYearPace(new Map(), '2026-10-03')).toBeNull();
  });
});

describe('computeSeasonView', () => {
  it('どちらも作れなければ null', () => {
    expect(computeSeasonView(new Map(), '2026-10-03')).toBeNull();
  });
  it('カード表示は節気の変わり目3日間のみ', () => {
    const map: DayMap = new Map();
    for (let y = 2021; y <= 2026; y++) fill(map, `${y}-01-01`, `${y}-12-31`, { tempMean: 10 });
    expect(computeSeasonView(map, '2026-09-24')!.showCard).toBe(true);
    expect(computeSeasonView(map, '2026-10-03')!.showCard).toBe(false);
    expect(computeSeasonView(map, '2026-10-03')!.review?.range.name).toBe('白露');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/seasonReview.test.ts`
Expected: FAIL（`computeYearPace` が未定義）

- [ ] **Step 3: 実装**

定数に追加:

```ts
/** 積算気温が小さい時期（主に1月）は日数差がぶれるため、直近30日の平均に切り替えるしきい値（℃・日） */
export const PACE_MIN_ACCUM = 200;
```

ファイル末尾に追加:

```ts
// ---- 今年のあゆみ ----

/** 正 = 何日早い、負 = 何日遅い、'ahead' = 比較年が年末までに届かない（今年がかなり早い） */
export type PaceDiff = number | 'ahead';
export type YearPace =
  | { kind: 'accum'; vsLastYear: PaceDiff; vsAvg: PaceDiff }
  | { kind: 'recent'; vsLastYear: number; vsAvg: number };

/** onOrBefore 以前でデータがある最新日 */
function latestDate(map: DayMap, onOrBefore: string): string | null {
  let best: string | null = null;
  for (const d of map.keys()) if (d <= onOrBefore && (best === null || d > best)) best = d;
  return best;
}

/** その年の 1/1 から end までの日ごとの有効積算気温（0℃基準＝0℃未満の日は0）。欠けがあれば null */
function cumulative(map: DayMap, year: number, end: string): number[] | null {
  const out: number[] = [];
  let sum = 0;
  for (let d = `${year}-01-01`; d <= end; d = addDays(d, 1)) {
    const r = map.get(d);
    if (!r) return null;
    sum += Math.max(0, r.tempMean);
    out.push(sum);
  }
  return out;
}

export function computeYearPace(map: DayMap, today: string): YearPace | null {
  const last = latestDate(map, addDays(today, -1));
  if (!last) return null;
  // 「今年」は today の暦年で固定する。最新実績が前年（1/1・当年データ未着）なら積算は使わない
  const y = yearOf(today);
  const cur = yearOf(last) === y ? cumulative(map, y, last) : null;

  if (cur && cur.length > 0 && cur[cur.length - 1] >= PACE_MIN_ACCUM) {
    const target = cur[cur.length - 1];
    const idx = cur.length - 1;
    const series: number[][] = [];
    for (let k = 1; k <= AVG_YEARS; k++) {
      const s = cumulative(map, y - k, `${y - k}-12-31`);
      if (!s) return null;
      series.push(s);
    }
    // 5年平均は「1/1 からの通し日数」ごとの積算値の平均（閏年は短い方に揃える）
    const len = Math.min(...series.map(s => s.length));
    const avg = Array.from({ length: len }, (_, i) => series.reduce((a, s) => a + s[i], 0) / series.length);
    const diff = (s: number[]): PaceDiff => {
      const j = s.findIndex(v => v >= target);
      return j === -1 ? 'ahead' : j - idx;
    };
    return { kind: 'accum', vsLastYear: diff(series[0]), vsAvg: diff(avg) };
  }

  const start = addDays(last, -(RECENT_DAYS - 1));
  const c = rangeStats(map, start, last);
  const cmp = comparisonStats(map, start, last);
  if (!c || !cmp) return null;
  return { kind: 'recent', vsLastYear: c.meanTemp - cmp.lastYear.meanTemp, vsAvg: c.meanTemp - cmp.avg.meanTemp };
}

export interface PaceView { label: string; text: string }

function paceClause(subject: string, d: PaceDiff): string {
  if (d === 'ahead') return `${subject}より早いペース`;
  if (d === 0) return `${subject}と同じペース`;
  return d > 0 ? `${subject}より${d}日早い` : `${subject}より${-d}日遅い`;
}

export function formatYearPace(p: YearPace): PaceView {
  if (p.kind === 'accum') {
    return {
      label: '今年のあゆみ（1月1日から）',
      text: `積算気温 ${paceClause('去年', p.vsLastYear)}・${paceClause('5年平均', p.vsAvg)}`,
    };
  }
  const t = (d: number) => tempCell(d, 0).text;
  return { label: `この${RECENT_DAYS}日`, text: `平均気温 去年より${t(p.vsLastYear)}・5年平均より${t(p.vsAvg)}` };
}

// ---- 画面用ビュー ----

export interface SeasonView {
  pace: PaceView | null;
  review: SeasonReview | null;
  /** カードを帯の下に出すか（節気の変わり目 CARD_WINDOW_DAYS 日間） */
  showCard: boolean;
}

export function computeSeasonView(map: DayMap, today: string): SeasonView | null {
  const pace = computeYearPace(map, today);
  const review = buildSeasonReview(map, today);
  if (!pace && !review) return null;
  return { pace: pace ? formatYearPace(pace) : null, review, showCard: !!review && isInCardWindow(today) };
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/seasonReview.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add src/lib/seasonReview.ts src/lib/seasonReview.test.ts
git commit -m "feat: 積算気温のペース（去年・5年平均比）を追加"
```

---

### Task 4: 計測イベント

**Files:**
- Modify: `src/lib/analytics.ts`（末尾に追記）

- [ ] **Step 1: 実装**（firebase 依存のため単体テストは書かない。既存関数と同じ形）

```ts
// season_card_view はセッション中に一度だけ撃つ（タブ往復・帯下とシートの両方で膨らませない）。
let seasonCardViewLogged = false;
/** 節気ふりかえりカード本体が画面に入った。1セッション1回のみ実発火。source は最初に見た場所。 */
export function logSeasonCardView(source: 'inline' | 'sheet'): void {
  if (seasonCardViewLogged) return;
  seasonCardViewLogged = true;
  track('season_card_view', { source });
}

/** ヒーローの節気名からふりかえりカードを開いた。 */
export function logSeasonCardOpen(): void {
  track('season_card_open');
}
```

- [ ] **Step 2: 型確認**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: エラーなし（`tsconfig.app.json` が無ければ `npx tsc -b` を使う）

- [ ] **Step 3: コミット**

```bash
git add src/lib/analytics.ts
git commit -m "feat: ふりかえりカードの計測イベントを追加"
```

---

### Task 5: 当年キャッシュの失効と、予報データへの取得地点の付与

**Files:**
- Modify: `src/api/weather.ts:4,69-74,145`
- Modify: `src/api/forecast.ts:71-77,255`
- Test: `src/api/weather.test.ts`（新規）

理由: `fetchWeatherData` は当年分も無期限にメモリキャッシュするため、開いたまま日をまたぐと直近の実績が伸びず、予報 `pastDaily`（過去7日）の補完範囲を超えた欠けが残る。また、フックが「今の地点の予報が届いた」ことを確かめられるよう、予報データに取得地点を持たせる。

- [ ] **Step 1: 失敗するテストを書く**

`src/api/weather.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/weatherFetch', () => ({ weatherFetch: vi.fn() }));
import { weatherFetch } from '../lib/weatherFetch';
import { fetchWeatherData } from './weather';

const body = {
  daily: {
    time: ['2026-01-01'],
    temperature_2m_mean: [5], temperature_2m_max: [9], temperature_2m_min: [1],
    precipitation_sum: [0],
    relative_humidity_2m_mean: [60], relative_humidity_2m_max: [80], relative_humidity_2m_min: [40],
    shortwave_radiation_sum: [10], sunshine_duration: [3600],
  },
};
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-03T03:00:00Z'));
  vi.mocked(weatherFetch).mockReset();
  vi.mocked(weatherFetch).mockImplementation(async () => new Response(JSON.stringify(body)));
  // 年境界の月平均（素の fetch）は失敗させて null 扱いにする
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// キャッシュはモジュール共有のため、テストごとに別の地点を使う
describe('fetchWeatherData のキャッシュ', () => {
  it('当年分は6時間で取り直す', async () => {
    await fetchWeatherData(35.1, 139.1, 2026);
    await fetchWeatherData(35.1, 139.1, 2026);
    expect(weatherFetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 6 * HOUR + 1));
    await fetchWeatherData(35.1, 139.1, 2026);
    expect(weatherFetch).toHaveBeenCalledTimes(2);
  });

  it('過去年は確定値なので取り直さない', async () => {
    await fetchWeatherData(35.2, 139.2, 2025);
    vi.setSystemTime(new Date(Date.now() + 7 * HOUR));
    await fetchWeatherData(35.2, 139.2, 2025);
    expect(weatherFetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/api/weather.test.ts`
Expected: 「当年分は6時間で取り直す」が FAIL（呼び出し1回のまま）

- [ ] **Step 3: 実装（weather.ts）**

4行目 `const weatherCache = new Map<string, WeatherData>();` を置き換え:

```ts
/** 当年分は日々データが伸びるため、この時間で取り直す（過去年は確定値なので無期限） */
const CURRENT_YEAR_TTL_MS = 6 * 60 * 60 * 1000;
const weatherCache = new Map<string, { data: WeatherData; fetchedAt: number }>();
```

`fetchWeatherData` の冒頭（キャッシュ確認〜`isCurrentYear` 定義）を置き換え:

```ts
export async function fetchWeatherData(lat: number, lon: number, year: number): Promise<WeatherData> {
  const key = buildCacheKey(lat, lon, year);
  const currentYear = new Date().getFullYear();
  const isCurrentYear = year === currentYear;

  const cached = weatherCache.get(key);
  if (cached && (!isCurrentYear || Date.now() - cached.fetchedAt < CURRENT_YEAR_TTL_MS)) return cached.data;
```

末尾の `weatherCache.set(key, result);` を置き換え:

```ts
  weatherCache.set(key, { data: result, fetchedAt: Date.now() });
```

- [ ] **Step 4: 実装（forecast.ts）**

`ForecastData` の `availability?` の行の後に追加:

```ts
  /** 取得した地点（fetchForecast のみ設定）。表示中の地点の予報かを照合するために使う */
  lat?: number;
  lon?: number;
```

`fetchForecast` の return（255行目）を置き換え:

```ts
  return { hourly: hourly.slice(0, 20 + 240), daily: futureDaily, pastDaily, fetchedAt: Date.now(), lat, lon };
```

- [ ] **Step 5: 成功・回帰を確認**

Run: `npx vitest run src/api && npx tsc -b`
Expected: PASS・型エラーなし（空くらべは `fetchWeatherData` の戻り値の形が変わらないので影響なし）

- [ ] **Step 6: コミット**

```bash
git add src/api/weather.ts src/api/weather.test.ts src/api/forecast.ts
git commit -m "feat: 当年の実績キャッシュを6時間で失効し、予報に取得地点を持たせる"
```

---

### Task 6: useSeasonReview フック

**Files:**
- Create: `src/hooks/useSeasonReview.ts`
- Test: `src/hooks/useSeasonReview.test.ts`

設計メモ（実装者向け）:
- effect 内で同期的に setState しない。結果は `{ key, view }` で保持し、状態は描画時に key 比較で導出する（地点切替時に古い結果を出さない）。
- 地点切替直後の数レンダーは「新しい lat/lon＋旧地点の予報」になる（useForecast のリセットは effect 内のため）。予報の `lat/lon`（Task 5 で付与）が今の地点と一致するまで**取得を始めず** loading を返す。これで予報より先に年別取得が走ることも、新予報到着後に同じ年を重複取得することも防ぐ。
- key に `forecast.fetchedAt` を含めるため、手動更新でも key が変わり一瞬骨組みに戻る。archive はメモリキャッシュ済みで即時に戻るため許容する。

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/useSeasonReview.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastData } from '../api/forecast';

vi.mock('../api/weather', () => ({ fetchWeatherData: vi.fn() }));
vi.mock('../lib/seasonReview', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/seasonReview')>();
  return { ...mod, computeSeasonView: vi.fn() };
});

import { fetchWeatherData } from '../api/weather';
import { computeSeasonView } from '../lib/seasonReview';
import { useSeasonReview } from './useSeasonReview';

const forecast = { hourly: [], daily: [], pastDaily: [], fetchedAt: 1, lat: 35, lon: 139 } as unknown as ForecastData;
const view = { pace: { label: 'L', text: 'T' }, review: null, showCard: false };

beforeEach(() => {
  vi.mocked(fetchWeatherData).mockReset();
  vi.mocked(computeSeasonView).mockReset();
});

describe('useSeasonReview', () => {
  it('予報が無ければ idle（取得しない）', () => {
    const { result } = renderHook(() => useSeasonReview(35, 139, null));
    expect(result.current.status).toBe('idle');
    expect(fetchWeatherData).not.toHaveBeenCalled();
  });

  it('予報が別地点のもの（地点切替直後）なら loading のまま取得しない', () => {
    const { result } = renderHook(() => useSeasonReview(36, 140, forecast));
    expect(result.current.status).toBe('loading');
    expect(fetchWeatherData).not.toHaveBeenCalled();
  });

  it('予報が揃うと loading → ready', async () => {
    vi.mocked(fetchWeatherData).mockResolvedValue({ year: 2026, daily: [] });
    vi.mocked(computeSeasonView).mockReturnValue(view);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', view }));
  });

  it('計算できなければ hidden', async () => {
    vi.mocked(fetchWeatherData).mockResolvedValue({ year: 2026, daily: [] });
    vi.mocked(computeSeasonView).mockReturnValue(null);
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast));
    await waitFor(() => expect(result.current.status).toBe('hidden'));
  });

  it('取得失敗は hidden（エラーを表に出さない）', async () => {
    vi.mocked(fetchWeatherData).mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useSeasonReview(35, 139, forecast));
    await waitFor(() => expect(result.current.status).toBe('hidden'));
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/hooks/useSeasonReview.test.ts`
Expected: FAIL（`./useSeasonReview` が存在しない）

- [ ] **Step 3: 実装**

`src/hooks/useSeasonReview.ts`:

```ts
// src/hooks/useSeasonReview.ts
//
// 今年のあゆみ＋節気ふりかえりのデータ。予報の取得完了後に必要年の実績を並列取得する
// （予報と通信を取り合わない）。年単位の実績は fetchWeatherData のメモリキャッシュを空くらべと共有。
// 非ブロッキング: 失敗・計算不能は hidden（エラー表示しない）。
//
// 状態は「どの key の結果か」を持ち、描画時に key 比較で導出する（effect 内で同期 setState しない）。
// 地点切替直後は useForecast がまだ旧地点の予報を返すため、予報の取得地点が今の地点と一致するまで
// 取得を始めない（予報より先に走らせない・新予報の到着後に同じ年を重複取得しない）。
import { useEffect, useRef, useState } from 'react';
import { fetchWeatherData } from '../api/weather';
import type { ForecastData } from '../api/forecast';
import {
  buildDayMap, computeSeasonView, fromArchive, fromForecastPast, requiredYears, type SeasonView,
} from '../lib/seasonReview';
import { jstDateString } from '../lib/sky';

export type SeasonState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'ready'; view: SeasonView };

export function useSeasonReview(lat: number | null, lon: number | null, forecast: ForecastData | null): SeasonState {
  const today = jstDateString(new Date());
  const forecastMatches = forecast !== null && lat !== null && lon !== null && forecast.lat === lat && forecast.lon === lon;
  const key = forecast && forecastMatches ? `${lat},${lon},${today},${forecast.fetchedAt}` : null;
  const [result, setResult] = useState<{ key: string; view: SeasonView | null } | null>(null);

  // 最新の予報を ref で読む（参照は毎回変わりうるため effect の依存には key だけを使う）
  const forecastRef = useRef(forecast);
  forecastRef.current = forecast;

  useEffect(() => {
    if (key === null || lat === null || lon === null) return;
    const fill = fromForecastPast(forecastRef.current?.pastDaily ?? []);
    let cancelled = false;
    Promise.all(requiredYears(today).map(y => fetchWeatherData(lat, lon, y)))
      .then(years => {
        if (cancelled) return;
        const map = buildDayMap(years.flatMap(w => fromArchive(w.daily)), fill);
        setResult({ key, view: computeSeasonView(map, today) });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, view: null });
      });
    return () => { cancelled = true; };
    // key に lat・lon・today・予報の取得時刻が含まれる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (lat === null || lon === null || !forecast) return { status: 'idle' };
  // 予報が今の地点に追いつくまで（key === null）と、取得中は骨組み
  if (key === null || !result || result.key !== key) return { status: 'loading' };
  return result.view ? { status: 'ready', view: result.view } : { status: 'hidden' };
}
```

注: `forecastRef.current = forecast` の描画中代入が `react-hooks/refs` で lint エラーになる場合は、既存 `useAiComment.ts` と同じ書き方なので、そちらの lint 結果と同じ扱いにする（`npx eslint src/hooks/useAiComment.ts` で既存も同じ指摘が出るか確認し、出るなら同じ箇所に `// eslint-disable-next-line react-hooks/refs` を付ける）。

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/hooks/useSeasonReview.test.ts`
Expected: PASS（5件）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useSeasonReview.ts src/hooks/useSeasonReview.test.ts
git commit -m "feat: 今年のあゆみ・ふりかえりの取得フックを追加"
```

---

### Task 7: 帯とカードの部品

**Files:**
- Create: `src/components/season/YearPaceStrip.tsx`
- Create: `src/components/season/SeasonReviewCard.tsx`
- Create: `src/components/season/season.css`
- Test: `src/components/season/season.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/season/season.test.tsx`:

```tsx
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import type { SeasonReview } from '../../lib/seasonReview';

vi.mock('../../lib/analytics', () => ({ logSeasonCardView: vi.fn() }));
import { logSeasonCardView } from '../../lib/analytics';
import { YearPaceStrip } from './YearPaceStrip';
import { SeasonInlineCard, SeasonReviewCard } from './SeasonReviewCard';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const review: SeasonReview = {
  range: { index: 14, name: '白露', start: '2026-09-07', end: '2026-09-22', days: 16 },
  periodLabel: '白露 9/7〜9/22（16日間）',
  headline: '日差しが多く、雨の少ない半月でした',
  rows: [
    { label: '平均気温', value: '24.0℃', vsLastYear: { text: '+1.0℃', tone: 'more' }, vsAvg: { text: '+1.0℃', tone: 'more' } },
    { label: '雨の量', value: '38mm', vsLastYear: { text: '6割', tone: 'less' }, vsAvg: { text: '6割', tone: 'less' } },
    { label: '日照', value: '96h', vsLastYear: { text: '+16h', tone: 'more' }, vsAvg: { text: '+16h', tone: 'more' } },
  ],
  rain: [{ date: '2026-09-07', value: 0 }, { date: '2026-09-08', value: 22 }],
  records: {
    hottest: { date: '2026-09-09', value: 33.2 },
    coolestMorning: { date: '2026-09-21', value: 15.8 },
    heavyRain: null,
  },
  avgYears: '2021〜2025年',
};

describe('YearPaceStrip', () => {
  it('loading は骨組み', () => {
    renderWithMotion(<YearPaceStrip state={{ status: 'loading' }} />);
    expect(screen.getByRole('status', { name: '今年のあゆみを集計中' })).toBeTruthy();
  });
  it('ready は文言', () => {
    renderWithMotion(<YearPaceStrip state={{ status: 'ready', view: { pace: { label: '今年のあゆみ（1月1日から）', text: '積算気温 去年より4日早い・5年平均より2日早い' }, review: null, showCard: false } }} />);
    expect(screen.getByText('積算気温 去年より4日早い・5年平均より2日早い')).toBeTruthy();
  });
  it('hidden・idle は何も描かない', () => {
    const { container } = renderWithMotion(<YearPaceStrip state={{ status: 'hidden' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('SeasonReviewCard', () => {
  it('期間・見出し・表・記録を表示し、まとまった雨なしは「なし」', () => {
    renderWithMotion(<SeasonReviewCard review={review} source="sheet" />);
    expect(screen.getByText('ふりかえり ─ 白露 9/7〜9/22（16日間）')).toBeTruthy();
    expect(screen.getByText('日差しが多く、雨の少ない半月でした')).toBeTruthy();
    expect(screen.getByText('38mm')).toBeTruthy();
    expect(screen.getAllByText('6割')).toHaveLength(2);
    expect(screen.getByText('9/9 33.2℃')).toBeTruthy();
    expect(screen.getByText('9/21 15.8℃')).toBeTruthy();
    expect(screen.getByText('なし')).toBeTruthy();
    expect(screen.getByText(/5年平均は2021〜2025年/)).toBeTruthy();
  });
});

describe('カード閲覧の計測', () => {
  // jsdom には IntersectionObserver が無いので、コールバックを手で呼べる偽物を入れる
  let fire: (isIntersecting: boolean) => void = () => {};
  beforeEach(() => {
    vi.mocked(logSeasonCardView).mockClear();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        fire = (isIntersecting) => cb([{ isIntersecting }]);
      }
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('マウントだけでは計測せず、画面に入ったら場所つきで計測する', () => {
    renderWithMotion(<SeasonInlineCard review={review} />);
    expect(logSeasonCardView).not.toHaveBeenCalled();
    act(() => fire(true));
    expect(logSeasonCardView).toHaveBeenCalledWith('inline');
  });

  it('シート内のカードも計測する', () => {
    renderWithMotion(<SeasonReviewCard review={review} source="sheet" />);
    act(() => fire(true));
    expect(logSeasonCardView).toHaveBeenCalledWith('sheet');
  });

  it('IntersectionObserver が無い環境でも落ちない', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    renderWithMotion(<SeasonReviewCard review={review} source="sheet" />);
    expect(logSeasonCardView).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/season/season.test.tsx`
Expected: FAIL（部品が存在しない）

- [ ] **Step 3: 実装**

`src/components/season/YearPaceStrip.tsx`:

```tsx
// 空もようのヒーロー直下に常設する「今年のあゆみ」の帯。
// 取得中は同じ高さの骨組みで場所を確保し、予報が後から押し下げられないようにする。
import { Skeleton } from '../ui/Skeleton';
import type { SeasonState } from '../../hooks/useSeasonReview';
import './season.css';

export function YearPaceStrip({ state }: { state: SeasonState }) {
  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="今年のあゆみを集計中">
        <Skeleton height={52} radius="var(--radius-md)" />
      </div>
    );
  }
  if (state.status !== 'ready' || !state.view.pace) return null;
  const { label, text } = state.view.pace;
  return (
    <section className="season-strip" aria-label={label}>
      <span className="season-strip__label">{label}</span>
      <span className="season-strip__text">{text}</span>
    </section>
  );
}
```

`src/components/season/SeasonReviewCard.tsx`:

```tsx
// 節気ふりかえりカード。帯の下（節気の変わり目3日間）とシート内で共用する。
// 閲覧の計測は「本体の半分以上が画面に入った」時点（マウント＝閲覧ではない）。重複除去は analytics 側。
import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { SekkiArt } from '../sky/sekkiArt';
import { springs } from '../../lib/motion';
import { logSeasonCardView } from '../../lib/analytics';
import { monthDay, type CompareCell, type SeasonReview } from '../../lib/seasonReview';
import './season.css';

function Cell({ c }: { c: CompareCell }) {
  return <td className={`season-card__cmp season-card__cmp--${c.tone}`}>{c.text}</td>;
}

export function SeasonReviewCard({ review, source }: { review: SeasonReview; source: 'inline' | 'sheet' }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        logSeasonCardView(source);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [source]);

  const maxRain = Math.max(1, ...review.rain.map(r => r.value));
  const { hottest, coolestMorning, heavyRain } = review.records;
  return (
    <article ref={ref} className="season-card" aria-label={`${review.range.name}のふりかえり`}>
      <header className="season-card__head">
        <SekkiArt index={review.range.index} size={56} className="season-card__art" />
        <div className="season-card__heading">
          <p className="season-card__period">{`ふりかえり ─ ${review.periodLabel}`}</p>
          <h3 className="season-card__title">{review.headline}</h3>
        </div>
      </header>

      <table className="season-card__table">
        <thead>
          <tr>
            <td aria-hidden="true" />
            <th scope="col">今年</th>
            <th scope="col">去年比</th>
            <th scope="col">5年平均比</th>
          </tr>
        </thead>
        <tbody>
          {review.rows.map(r => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="season-card__value">{r.value}</td>
              <Cell c={r.vsLastYear} />
              <Cell c={r.vsAvg} />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="season-card__rain">
        <div className="season-card__bars" role="img" aria-label={`日ごとの雨（${monthDay(review.range.start)}〜${monthDay(review.range.end)}）`}>
          {review.rain.map(r => (
            <i key={r.date} style={{ height: `${(r.value / maxRain) * 100}%` }} />
          ))}
        </div>
        <div className="season-card__axis" aria-hidden="true">
          <span>{monthDay(review.range.start)}</span>
          <span>日ごとの雨</span>
          <span>{monthDay(review.range.end)}</span>
        </div>
      </div>

      <dl className="season-card__records">
        <div><dt>いちばん暑い日</dt><dd>{`${monthDay(hottest.date)} ${hottest.value.toFixed(1)}℃`}</dd></div>
        <div><dt>いちばん涼しい朝</dt><dd>{`${monthDay(coolestMorning.date)} ${coolestMorning.value.toFixed(1)}℃`}</dd></div>
        <div><dt>まとまった雨</dt><dd>{heavyRain ? `${monthDay(heavyRain.date)} ${Math.round(heavyRain.value)}mm` : 'なし'}</dd></div>
      </dl>

      <p className="season-card__note">{`比較は同じ月日の期間の実績。5年平均は${review.avgYears}の平均です。`}</p>
    </article>
  );
}

/** 帯の下に、高さを滑らかに広げて登場させる（reduced-motion は MotionProvider 側で即時化） */
export function SeasonInlineCard({ review }: { review: SeasonReview }) {
  return (
    <m.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      transition={springs.enter}
      style={{ overflow: 'hidden' }}
    >
      <SeasonReviewCard review={review} source="inline" />
    </m.div>
  );
}
```

`src/components/season/season.css`:

```css
/* 今年のあゆみの帯・節気ふりかえりカード */
.season-strip {
  box-sizing: border-box;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0.45rem 0.85rem;
  background: var(--surface-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}
.season-strip__label { font-size: 0.7rem; color: var(--ink-3); line-height: 1.3; }
.season-strip__text { font-size: 0.85rem; font-weight: 600; color: var(--ink-1); line-height: 1.4; }

.season-card {
  padding: 0.85rem 1rem 0.9rem;
  background: var(--surface-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  color: var(--ink-1);
}
.season-card__head { display: flex; gap: 0.75rem; align-items: center; }
.season-card__art { flex-shrink: 0; }
.season-card__heading { min-width: 0; }
.season-card__period { margin: 0; font-size: 0.72rem; color: var(--ink-3); }
.season-card__title { margin: 0.15rem 0 0; font-size: 1rem; font-weight: 700; line-height: 1.4; }

.season-card__table { width: 100%; margin-top: 0.7rem; border-collapse: collapse; font-size: 0.8rem; }
.season-card__table th, .season-card__table td { padding: 0.35rem 0.25rem; text-align: right; font-variant-numeric: tabular-nums; }
.season-card__table thead th { font-size: 0.68rem; font-weight: 500; color: var(--ink-3); }
.season-card__table tbody tr { border-top: 1px solid var(--line); }
.season-card__table tbody th { text-align: left; font-weight: 500; color: var(--ink-2); }
.season-card__value { font-weight: 700; }
.season-card__cmp--more { color: #c0502a; }
.season-card__cmp--less { color: #2a6fb0; }
.season-card__cmp--same { color: var(--ink-3); }

.season-card__rain { margin-top: 0.6rem; }
.season-card__bars { display: flex; align-items: flex-end; gap: 2px; height: 36px; }
.season-card__bars i { flex: 1; min-height: 1px; background: rgba(var(--accent-rgb), 0.55); border-radius: 2px 2px 0 0; }
.season-card__axis { display: flex; justify-content: space-between; margin-top: 2px; font-size: 0.65rem; color: var(--ink-3); }

.season-card__records { margin: 0.6rem 0 0; display: grid; gap: 0.2rem; font-size: 0.78rem; }
.season-card__records div { display: flex; justify-content: space-between; gap: 0.5rem; }
.season-card__records dt { color: var(--ink-2); }
.season-card__records dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }

.season-card__note { margin: 0.6rem 0 0; font-size: 0.65rem; color: var(--ink-3); line-height: 1.5; }
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/components/season/season.test.tsx`
Expected: PASS（8件）

- [ ] **Step 5: コミット**

```bash
git add src/components/season
git commit -m "feat: 今年のあゆみの帯と節気ふりかえりカードの部品を追加"
```

---

### Task 8: 節気名をタップでふりかえりを開く

**Files:**
- Modify: `src/components/sky/SekkiBadge.tsx`
- Modify: `src/components/sky/SkyHero.tsx:16-40,169`
- Modify: `src/components/sky/sky.css`（`.sekki-badge` 定義の直後）
- Test: `src/components/sky/SekkiBadge.test.tsx`

- [ ] **Step 1: 失敗するテストを追記**

`SekkiBadge.test.tsx` の import に `fireEvent` と `vi` を追加（`import { cleanup, fireEvent, screen } from '@testing-library/react';`、`import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';`）し、describe 内に追記:

```tsx
  it('onOpen があれば、直前の節気のふりかえりを開くボタンになる', () => {
    const onOpen = vi.fn();
    renderWithMotion(<SekkiBadge date={date} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: /白露のふりかえりを開く/ });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('onOpen が無ければボタンにしない', () => {
    renderWithMotion(<SekkiBadge date={date} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/sky/SekkiBadge.test.tsx`
Expected: FAIL（ボタンが無い）

- [ ] **Step 3: 実装**

`SekkiBadge.tsx`: import を `import { SEKKI, sekkiForDate } from '../../lib/sekki';` に変え、シグネチャと return を次に置き換える:

```tsx
export function SekkiBadge({ date, onOpen }: { date?: Date; onOpen?: () => void }) {
```

（`useMemo`・`readingRef`・`useLayoutEffect` 部分はそのまま）

```tsx
  const label = `二十四節気 ${s.name}、七十二候 ${s.kou.name}（${s.kou.reading}）`;
  const text = (
    <div className="sekki-badge__text">
      <span className="sekki-badge__sekki">
        {s.name}
        {onOpen && <span className="sekki-badge__chev" aria-hidden="true">›</span>}
      </span>
      <span className="sekki-badge__kou">{s.kou.name}</span>
      <span
        ref={readingRef}
        className={`sekki-badge__reading${clipped ? ' sekki-badge__reading--clipped' : ''}`}
      >
        {s.kou.reading}
      </span>
    </div>
  );

  if (onOpen) {
    const prevName = SEKKI[(s.index + 23) % 24].name;
    return (
      <button type="button" className="sekki-badge sekki-badge--button" aria-label={`${label}。${prevName}のふりかえりを開く`} onClick={onOpen}>
        {text}
      </button>
    );
  }
  return (
    <div className="sekki-badge" role="group" aria-label={label}>
      {text}
    </div>
  );
}
```

`sky.css` の `.sekki-badge { ... }` の直後に追加:

```css
.sekki-badge--button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
}
.sekki-badge--button:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.85); outline-offset: 3px; }
.sekki-badge__chev { margin-left: 0.25em; opacity: 0.75; }
```

`SkyHero.tsx`:
- `SkyHeroProps` の `children?: ReactNode;` の直前に追加:

```ts
  /** 節気名タップでふりかえりを開く（未指定ならタップ不可の表示のみ） */
  onSekkiOpen?: () => void;
```

- 分割代入に `onSekkiOpen` を追加: `locationSlot, onLocate, locating, onRefresh, onSekkiOpen, children,`
- 169行目を `<div className="sky-hero__sekki"><SekkiBadge onOpen={onSekkiOpen} /></div>` に変更

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/components/sky`
Expected: PASS（既存含め全件）

- [ ] **Step 5: コミット**

```bash
git add src/components/sky
git commit -m "feat: ヒーローの節気名からふりかえりを開けるように"
```

---

### Task 9: 空もようタブへの配置

**Files:**
- Modify: `src/components/weather/WeatherTab.tsx`

- [ ] **Step 1: import を追加**（既存 import 群の末尾）

```tsx
import { Sheet } from '../ui/Sheet';
import { useSeasonReview } from '../../hooks/useSeasonReview';
import { YearPaceStrip } from '../season/YearPaceStrip';
import { SeasonInlineCard, SeasonReviewCard } from '../season/SeasonReviewCard';
import { logSeasonCardOpen } from '../../lib/analytics';
```

- [ ] **Step 2: フックと状態を追加**（`useForecast(...)` の呼び出し直後。早期 return より前であること）

```tsx
  // 今年のあゆみ・節気ふりかえり（予報の取得完了後に非同期で集計。予報表示は待たせない）
  const season = useSeasonReview(location?.lat ?? null, location?.lon ?? null, data);
  const seasonReview = season.status === 'ready' ? season.view.review : null;
  const [seasonOpen, setSeasonOpen] = useState(false);
```

- [ ] **Step 3: ヒーローにタップを渡す**（`<SkyHero` の props に `onRefresh={refresh}` の次に追加）

```tsx
        onSekkiOpen={seasonReview ? () => { setSeasonOpen(true); logSeasonCardOpen(); } : undefined}
```

- [ ] **Step 4: 帯とカードを配置**（`{data && (` 直後の `<>` の次、「AI ステータスバー」コメントの前）

```tsx
          <YearPaceStrip state={season} />
          {season.status === 'ready' && season.view.showCard && season.view.review && (
            <SeasonInlineCard review={season.view.review} />
          )}
```

- [ ] **Step 5: シートを配置**（`<Footer />` の直前）

```tsx
      <Sheet
        open={seasonOpen && seasonReview !== null}
        onClose={() => setSeasonOpen(false)}
        title={seasonReview ? `${seasonReview.range.name}のふりかえり` : 'ふりかえり'}
      >
        {seasonReview && <SeasonReviewCard review={seasonReview} source="sheet" />}
      </Sheet>
```

- [ ] **Step 6: 型・テスト・lint**

Run: `npx tsc -b && npm test && npx eslint src/lib/seasonReview.ts src/hooks/useSeasonReview.ts src/components/season src/components/sky src/components/weather/WeatherTab.tsx`
Expected: 型エラーなし・全テスト PASS・新規/変更ファイルに新たな lint エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/weather/WeatherTab.tsx
git commit -m "feat: 空もようにあゆみの帯とふりかえりカードを配置"
```

---

### Task 10: 検証

- [ ] **Step 1: ビルドとバンドル増分**

Run: `npm run build`
Vite 出力のメインチャンク `index-*.js` の gzip 値を記録し、**todo.md 記載の基準（メイン 428.81KB gzip ＋ 節気追加 +7.2KB ≒ 436KB）** と比較する。目安: +5KB gzip 以内。

- [ ] **Step 2: 実画面確認（dev サーバー）**

Run: `npm run dev` → ブラウザで空もようを開き、以下を確認（スクリーンショットを撮る）:
1. 予報が先に表示され、帯は骨組み → 文言に差し替わる（予報が押し下がらない）
2. 帯の文言が「積算気温 去年より◯日早い/遅い・5年平均より◯日…」
3. 節気名に「›」が付き、タップでシートにカード（白露のふりかえり）が出る。数値が空くらべの同期間と矛盾しない
4. 375px 幅で帯・カードが折り返して崩れない
5. 今日はカードの帯下表示は出ない（秋分 9/23 から4日目以降）。帯下表示の確認は、`useSeasonReview` の `today` を一時的に `'2026-09-24'` に書き換えて目視し、**確認後に必ず戻す**
6. 地点切替（ログイン時）: DevTools の Network で、`api.open-meteo.com`（予報）の応答が返るまで `archive-api` への要求が出ないこと、同じ年の archive 要求が重複しないこと
7. 帯下カード・シート内カードのどちらを先に見ても、`season_card_view` が1回だけ（DevTools で `analytics` の `track` 呼び出しをブレークポイント、または GA4 DebugView）
8. 年初の表示: `today` を一時的に `'2026-01-01'` / `'2026-01-02'` に書き換え、帯が「この30日」になり前年を「今年のあゆみ」と出さないこと（**確認後に必ず戻す**）

- [ ] **Step 3: todo 更新とコミット**

`tasks/todo.md` の先頭に本機能のセクション（計画・テスト件数・バンドル増分・持ち越し）を追記し、コミット:

```bash
git add tasks/todo.md
git commit -m "docs: 今年のあゆみ・節気ふりかえりの実装結果をtodoに記録"
```
