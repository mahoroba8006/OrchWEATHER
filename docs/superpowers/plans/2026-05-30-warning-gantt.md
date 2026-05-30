# 警報・注意報ガントバー表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日別予報・時間別予報のミニグラフ直下に、気象庁注意報・警報の有効期間をガントバーで表示する。

**Architecture:** `jmaWarning.ts` に `startMs`/`endMs` を `JmaWarningItem` に追加し、共通ユーティリティ `warningGantt.ts` と描画コンポーネント `WarningBar.tsx` を新規作成。`DailyForecast` と `HourlyTable` に `jmaWarnings` prop を追加してガントバー行を挿入し、`WeatherTab` からデータを流す。

**Tech Stack:** React 19 + TypeScript。インラインスタイルのみ（既存パターン踏襲）。テストフレームワーク未導入のためビルド通過＋手動動作確認で完了とする。

---

## ファイル構成

| ファイル | 変更種別 | 役割 |
|---|---|---|
| `src/api/jmaWarning.ts` | 修正 | `JmaWarningItem` に `startMs?`/`endMs?` 追加 |
| `src/lib/warningGantt.ts` | 新規 | レーン割り当て・色定数 |
| `src/components/weather/WarningBar.tsx` | 新規 | ガントバー描画コンポーネント |
| `src/components/weather/DailyForecast.tsx` | 修正 | `jmaWarnings` prop 追加・ガントバー行挿入 |
| `src/components/weather/HourlyTable.tsx` | 修正 | `jmaWarnings` prop 追加・ガントバー行挿入 |
| `src/components/weather/WeatherTab.tsx` | 修正 | `jmaWarnings` を両コンポーネントに渡す |

---

## Task 1: jmaWarning.ts — startMs / endMs を JmaWarningItem に追加

**Files:**
- Modify: `src/api/jmaWarning.ts`

### 背景

現在 `ValidPeriodEntry` に `endMs?` があるが `JmaWarningItem` には露出していない。ガントバーの位置計算のため、`startMs`/`endMs` を `JmaWarningItem` に持たせる。

- [ ] **Step 1: `ValidPeriodEntry` に `startMs` を追加し、`buildValidPeriodMap` で算出する**

`src/api/jmaWarning.ts` の `ValidPeriodEntry` インターフェースを変更し、`buildValidPeriodMap` 内で `startMs` を計算する。

```typescript
/** buildValidPeriodMap の返り値型 */
interface ValidPeriodEntry {
  period: string;
  /** 有効期間開始時刻の UTC ms。 */
  startMs?: number;
  /** 有効期間終了時刻の UTC ms。予報期間終端まで続く場合は undefined。 */
  endMs?: number;
}
```

`buildValidPeriodMap` 内の `map.set(code, ...)` 呼び出しを以下のように変更する（2 箇所ある）:

```typescript
// endIdx < defines.length の分岐
const startMs = Date.parse(defines[active[0]]);
const endMs = Date.parse(defines[endIdx]);
map.set(code, {
  period,
  startMs: isNaN(startMs) ? undefined : startMs,
  endMs: isNaN(endMs) ? undefined : endMs,
});

// else 分岐（予報期間終端まで続く場合）
const startMs = Date.parse(defines[active[0]]);
map.set(code, {
  period: `${fmtMDHH(from.month, from.date, from.hour)}〜`,
  startMs: isNaN(startMs) ? undefined : startMs,
});
```

- [ ] **Step 2: `JmaWarningItem` に `startMs?` / `endMs?` を追加する**

```typescript
/** 1件の注意報・警報エントリ */
export interface JmaWarningItem {
  code: string;
  name: string;
  level: WarningLevel;
  /** timeSeries から算出した有効期間。例: "5/29 06:00〜09:00" */
  validPeriod?: string;
  /** 有効期間開始時刻の UTC ms */
  startMs?: number;
  /** 有効期間終了時刻の UTC ms。継続中（解除未定）の場合は undefined */
  endMs?: number;
}
```

- [ ] **Step 3: `fetchJmaWarnings` の `.map()` で `startMs`/`endMs` を渡す**

`.map((w: any) => ({ ... }))` の中身を以下に変更する:

```typescript
.map((w: any) => {
  const entry = validPeriodMap.get(String(w.code));
  return {
    code:        String(w.code),
    name:        JMA_WARNING_NAMES[String(w.code)] ?? `現象コード${w.code}`,
    level:       toLevel(String(w.code)),
    validPeriod: entry?.period,
    startMs:     entry?.startMs,
    endMs:       entry?.endMs,
  };
})
```

- [ ] **Step 4: ビルドを通す**

```
cd "c:/dev/気象アプリ" && npx tsc --noEmit
```

エラーがなければ OK。

- [ ] **Step 5: コミット**

```bash
git add src/api/jmaWarning.ts
git commit -m "feat: JmaWarningItem に startMs/endMs を追加"
```

---

## Task 2: warningGantt.ts — 共通ユーティリティを新規作成

**Files:**
- Create: `src/lib/warningGantt.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
import type { JmaWarningItem, WarningLevel } from '../api/jmaWarning';

/**
 * 警報レベルごとのグラデーション背景色
 * 設定UIのボタン配色（注意報=黄、警報=ピンク、特別警報=パープル）と一致させる
 */
export const GANTT_GRADIENT: Record<WarningLevel, string> = {
  advisory: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
  warning:  'linear-gradient(90deg, #fb7185, #f43f5e)',
  special:  'linear-gradient(90deg, #c084fc, #a855f7)',
  none:     '',
};

/**
 * 警報リストを時間的に重ならないレーン（行）に分割して返す。
 * グリーディ区間スケジューリング（startMs 昇順）。
 * endMs === undefined の警報はそのレーンを Infinity まで占有する。
 */
export function computeWarningLanes(warnings: JmaWarningItem[]): JmaWarningItem[][] {
  const sorted = [...warnings]
    .filter(w => w.startMs !== undefined)
    .sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));

  // each lane tracks its current tail (Infinity for indefinite warnings)
  const lanes: Array<{ items: JmaWarningItem[]; tail: number }> = [];

  for (const w of sorted) {
    const start = w.startMs!;
    const tail  = w.endMs ?? Infinity;

    let placed = false;
    for (const lane of lanes) {
      if (start >= lane.tail) {
        lane.items.push(w);
        lane.tail = tail;
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push({ items: [w], tail });
    }
  }

  return lanes.map(l => l.items);
}
```

- [ ] **Step 2: ビルドを通す**

```
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/warningGantt.ts
git commit -m "feat: warningGantt ユーティリティを追加（レーン計算・色定数）"
```

---

## Task 3: WarningBar.tsx — ガントバーコンポーネントを新規作成

**Files:**
- Create: `src/components/weather/WarningBar.tsx`

### 仕様
- グラデーション背景 + 白テキスト（警報名のみ）
- バー幅 < 32px はテキスト非表示
- `endMs === undefined`（解除未定）: 右端フェードアウト + `→` マーク
- `position: absolute` で配置（親要素に `position: relative` が必要）

- [ ] **Step 1: ファイルを作成する**

```tsx
import type { JmaWarningItem } from '../../api/jmaWarning';
import { GANTT_GRADIENT } from '../../lib/warningGantt';

interface WarningBarProps {
  warning: JmaWarningItem;
  left: number;   // px: バー左端の絶対位置（親要素基点）
  width: number;  // px: バーの幅
}

export function WarningBar({ warning, left, width }: WarningBarProps) {
  const bg = GANTT_GRADIENT[warning.level] || GANTT_GRADIENT.advisory;
  const indefinite = warning.endMs === undefined;
  const showText = width >= 32;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        width,
        top: 1,
        height: 20,
        background: bg,
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* 警報名テキスト */}
      {showText && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            paddingLeft: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
            lineHeight: 1,
          }}
        >
          {warning.name}
        </span>
      )}
      {/* 解除未定: 右端フェードアウトと → マーク */}
      {indefinite && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 16,
              width: 28,
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65))',
              pointerEvents: 'none',
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: '#fff',
              paddingRight: 4,
              flexShrink: 0,
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            →
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルドを通す**

```
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/weather/WarningBar.tsx
git commit -m "feat: WarningBar コンポーネントを追加"
```

---

## Task 4: DailyForecast.tsx — ガントバー行を挿入

**Files:**
- Modify: `src/components/weather/DailyForecast.tsx`

### 設計

`dayX[]`/`dayWidths[]` の測定値を使い、各日の列境界（UTC ms）を表す `DailyColumn` 配列を構築する。各警報を対応する列にマッピングし、`WarningBar` で描画する。

列境界（JST 左閉・右開区間）:
- Split日 AM: `[dateT04:00, dateT12:00)`
- Split日 PM: `[dateT12:00, dateT20:00)`
- Split日 Night: `[dateT20:00, 翌dateT04:00)`
- 4日目以降: `[dateT00:00, 翌dateT00:00)`

- [ ] **Step 1: import と Props を更新する**

ファイル先頭の import に追加:

```typescript
import type { JmaWarningItem } from '../../api/jmaWarning';
import { computeWarningLanes } from '../../lib/warningGantt';
import { WarningBar } from './WarningBar';
```

Props インターフェースを変更:

```typescript
interface Props {
  daily: DailyForecastData[];
  onHalfDayClick?: (date: string, period: 'am' | 'pm' | 'night') => void;
  jmaWarnings?: JmaWarningItem[];
}
```

関数シグネチャも更新:

```typescript
export function DailyForecast({ daily, onHalfDayClick, jmaWarnings }: Props) {
```

- [ ] **Step 2: ヘルパー関数を `DailyForecast` 関数の外（コンポーネント外）に追加する**

```typescript
/** "YYYY-MM-DD" に n 日加算して返す */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** 各列の x 座標・幅・時間範囲（UTC ms）を構築する */
interface DailyColumn {
  x: number;
  width: number;
  startMs: number;
  endMs: number; // exclusive
}

function buildDailyColumns(
  daily: DailyForecastData[],
  dayX: number[],
  dayWidths: number[],
): DailyColumn[] {
  const cols: DailyColumn[] = [];
  for (let i = 0; i < daily.length; i++) {
    const dateStr = daily[i].date;
    if (i < SPLIT_DAYS) {
      const subW = dayWidths[i] / 3;
      const nextDate = i + 1 < daily.length ? daily[i + 1].date : addDays(dateStr, 1);
      cols.push({
        x: dayX[i],
        width: subW,
        startMs: Date.parse(`${dateStr}T04:00:00+09:00`),
        endMs:   Date.parse(`${dateStr}T12:00:00+09:00`),
      });
      cols.push({
        x: dayX[i] + subW,
        width: subW,
        startMs: Date.parse(`${dateStr}T12:00:00+09:00`),
        endMs:   Date.parse(`${dateStr}T20:00:00+09:00`),
      });
      cols.push({
        x: dayX[i] + 2 * subW,
        width: subW,
        startMs: Date.parse(`${dateStr}T20:00:00+09:00`),
        endMs:   Date.parse(`${nextDate}T04:00:00+09:00`),
      });
    } else {
      const nextDate = i + 1 < daily.length ? daily[i + 1].date : addDays(dateStr, 1);
      cols.push({
        x: dayX[i],
        width: dayWidths[i],
        startMs: Date.parse(`${dateStr}T00:00:00+09:00`),
        endMs:   Date.parse(`${nextDate}T00:00:00+09:00`),
      });
    }
  }
  return cols;
}

/** 警報の有効期間を DailyColumn 配列にマッピングして left/width を返す */
function warningToBar(
  warning: JmaWarningItem,
  cols: DailyColumn[],
): { left: number; width: number } | null {
  if (!warning.startMs || cols.length === 0) return null;

  const wStart = warning.startMs;
  const wEnd   = warning.endMs ?? Infinity;

  // 開始列: wStart を含む列（なければ先頭列が wEnd より前なら先頭から開始）
  let startColIdx = cols.findIndex(c => wStart >= c.startMs && wStart < c.endMs);
  if (startColIdx === -1) {
    // 警報開始が予報範囲より前だが有効期間が続く場合（継続中の警報）
    if (wStart < cols[0].startMs && wEnd > cols[0].startMs) {
      startColIdx = 0;
    } else {
      return null;
    }
  }

  // 終端列: wEnd と重なる最後の列
  let endColIdx = startColIdx;
  for (let i = cols.length - 1; i >= startColIdx; i--) {
    if (cols[i].startMs < wEnd) {
      endColIdx = i;
      break;
    }
  }

  const left  = cols[startColIdx].x;
  const right = cols[endColIdx].x + cols[endColIdx].width;
  return { left, width: right - left };
}
```

- [ ] **Step 3: ガントバー行をミニグラフ行の直後に挿入する**

既存の `<tbody>` 内のミニチャート行の `</tr>` の後（`</tbody>` の前）に以下を追加する。

```tsx
{/* ガントバー行（jmaWarnings があり dayX が確定してから描画） */}
{jmaWarnings && jmaWarnings.length > 0 && dayX && dayWidths && (() => {
  const cols = buildDailyColumns(daily, dayX, dayWidths);
  const lanes = computeWarningLanes(jmaWarnings);
  return lanes.map((lane, laneIdx) => (
    <tr key={`gantt-${laneIdx}`}>
      <td colSpan={chartColSpan} style={{ padding: 0, position: 'relative', height: 22 }}>
        {lane.map(warning => {
          const bar = warningToBar(warning, cols);
          if (!bar) return null;
          return (
            <WarningBar
              key={warning.code}
              warning={warning}
              left={bar.left}
              width={bar.width}
            />
          );
        })}
      </td>
    </tr>
  ));
})()}
```

- [ ] **Step 4: ビルドを通す**

```
npx tsc --noEmit
```

- [ ] **Step 5: コミット**

```bash
git add src/components/weather/DailyForecast.tsx
git commit -m "feat: DailyForecast にガントバー行を追加"
```

---

## Task 5: HourlyTable.tsx — ガントバー行を挿入

**Files:**
- Modify: `src/components/weather/HourlyTable.tsx`

### 設計

`tl` 配列上の `hourlyPos[]`（hourly エントリの列インデックス配列）を `HourlyTable` の親スコープに移動し、警報の startMs/endMs から列インデックスを求めて `WarningBar` で描画する。

`HourlyForecast.time` は `"YYYY-MM-DDTHH:00"`（JST）形式。startMs/endMs（UTC ms）を JST 時刻文字列に変換してバイナリサーチで一致列を探す。

- [ ] **Step 1: import と Props を更新する**

ファイル先頭の import に追加:

```typescript
import type { JmaWarningItem } from '../../api/jmaWarning';
import { computeWarningLanes } from '../../lib/warningGantt';
import { WarningBar } from './WarningBar';
```

Props インターフェースに `jmaWarnings` を追加:

```typescript
interface Props {
  hourly: HourlyForecast[];
  daily: DailyForecastData[];
  scrollRef?: RefObject<HTMLDivElement | null>;
  scrollTarget?: string;
  disablePastOpacity?: boolean;
  jmaWarnings?: JmaWarningItem[];
}
```

関数シグネチャも更新:

```typescript
export function HourlyTable({ hourly, daily, scrollRef, scrollTarget, disablePastOpacity, jmaWarnings }: Props) {
```

- [ ] **Step 2: `hourlyPos` を HourlyTable スコープに移動し、MiniChartRow へ prop として渡す**

`HourlyTable` 内の `tl` 構築の直後（`useEffect` の前）に `hourlyPos` を追加:

```typescript
// hourly エントリの tl 列インデックス（MiniChartRow と gantt 行で共用）
const hourlyPos: number[] = [];
tl.forEach((e, i) => { if (e.kind === 'hourly') hourlyPos.push(i); });
```

`MiniChartRow` の Props 型を更新し、内部のローカル `hourlyPos` 計算を除去する:

```typescript
function MiniChartRow({ tl, hourlyPos }: { tl: TLEntry[]; hourlyPos: number[] }) {
  // hourlyPos はpropsから受け取る（親スコープで計算済み）
  const hourlyItems: HourlyEntry[] = tl.filter((e): e is HourlyEntry => e.kind === 'hourly');
  // ... 以降は既存コードのまま（hourlyPos/hourlyItems の宣言行のみ削除）
```

`<MiniChartRow>` の呼び出し箇所を更新:

```tsx
<MiniChartRow tl={tl} hourlyPos={hourlyPos} />
```

- [ ] **Step 3: ヘルパー関数を `HourlyTable` 関数の外（コンポーネント外）に追加する**

```typescript
/** UTC ms を JST 時刻文字列 "YYYY-MM-DDTHH:00" に変換する */
function toJSTHourStr(utcMs: number): string {
  const jstMs = utcMs + 9 * 60 * 60 * 1000;
  const d = new Date(jstMs);
  const y  = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  const h  = String(d.getUTCHours()).padStart(2, '0');
  return `${y}-${mo}-${dy}T${h}:00`;
}

/**
 * 警報の startMs/endMs から left/width を返す。
 * - start: startMs を JST に変換し hourly 配列から floor インデックスを求める
 * - end:   endMs が undefined なら最終列の右端、それ以外は ceil インデックス
 */
function warningToHourlyBar(
  warning: JmaWarningItem,
  hourly: HourlyForecast[],
  hourlyPos: number[],
): { left: number; width: number } | null {
  if (!warning.startMs || hourly.length === 0) return null;

  const startStr = toJSTHourStr(warning.startMs);

  // floor: startStr 以下の最後の hourly インデックス
  let startHIdx = 0;
  for (let i = 0; i < hourly.length; i++) {
    if (hourly[i].time <= startStr) startHIdx = i;
    else break;
  }
  // startMs が全 hourly より未来 → 表示範囲外
  if (startStr > hourly[hourly.length - 1].time) return null;

  let endHIdx: number;
  if (!warning.endMs) {
    // 解除未定: 最終 hourly の右端（+1 列分）まで
    endHIdx = hourly.length - 1;
    const left  = hourlyPos[startHIdx] * COL_W;
    const right = (hourlyPos[endHIdx] + 1) * COL_W;
    return { left, width: right - left };
  }

  const endStr = toJSTHourStr(warning.endMs);

  // ceil: endStr 以上の最初の hourly インデックス
  endHIdx = hourly.length - 1;
  for (let i = 0; i < hourly.length; i++) {
    if (hourly[i].time >= endStr) { endHIdx = i; break; }
  }

  const left  = hourlyPos[startHIdx] * COL_W;
  const right = hourlyPos[endHIdx] * COL_W;
  if (right <= left) return null;
  return { left, width: right - left };
}
```

- [ ] **Step 4: ガントバー行をミニグラフ行（MiniChartRow）の直後に挿入する**

`<MiniChartRow tl={tl} hourlyPos={hourlyPos} />` の呼び出しの直後（同じ JSX ブロック内）に追加する:

```tsx
{/* ガントバー行 */}
{jmaWarnings && jmaWarnings.length > 0 && (() => {
  const lanes = computeWarningLanes(jmaWarnings);
  return lanes.map((lane, laneIdx) => (
    <tr key={`gantt-${laneIdx}`}>
      <td style={{ ...STICKY, padding: 0, borderBottom: 'none', minWidth: 90 }} />
      <td colSpan={tl.length} style={{ padding: 0, position: 'relative', height: 22 }}>
        {lane.map(warning => {
          const bar = warningToHourlyBar(warning, hourly, hourlyPos);
          if (!bar) return null;
          return (
            <WarningBar
              key={warning.code}
              warning={warning}
              left={bar.left}
              width={bar.width}
            />
          );
        })}
      </td>
    </tr>
  ));
})()}
```

- [ ] **Step 5: ビルドを通す**

```
npx tsc --noEmit
```

- [ ] **Step 6: コミット**

```bash
git add src/components/weather/HourlyTable.tsx
git commit -m "feat: HourlyTable にガントバー行を追加"
```

---

## Task 6: WeatherTab.tsx — jmaWarnings を両コンポーネントに渡す

**Files:**
- Modify: `src/components/weather/WeatherTab.tsx`

- [ ] **Step 1: DailyForecast と HourlyTable に jmaWarnings を渡す**

`<DailyForecast>` の呼び出し行を変更:

```tsx
<DailyForecast
  daily={data.daily}
  onHalfDayClick={scrollToHour}
  jmaWarnings={filteredJmaWarning?.items}
/>
```

`<HourlyTable>` の呼び出し行を変更:

```tsx
<HourlyTable
  hourly={filteredHourly}
  daily={data.daily}
  scrollRef={hourlyScrollRef}
  scrollTarget={scrollTarget}
  jmaWarnings={filteredJmaWarning?.items}
/>
```

- [ ] **Step 2: ビルドを通す**

```
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/weather/WeatherTab.tsx
git commit -m "feat: WeatherTab から jmaWarnings を予報コンポーネントに流す"
```

---

## Task 7: 動作確認

- [ ] **Step 1: 開発サーバーを起動する**

```
npm run dev
```

- [ ] **Step 2: 注意報・警報が発令されている地点で確認する**

設定タブで `jmaAreaCode` が設定されている地点を選択し、以下を確認する。

**日別予報:**
- [ ] ミニグラフの直下にガントバーが表示される
- [ ] 警報名（例:「大雨」）がバー内に表示される
- [ ] 注意報は黄〜オレンジ、警報はピンク〜レッド、特別警報はパープル
- [ ] 複数の同時発令がある場合、行が増えて重ならない
- [ ] 終了時刻が不明の場合、右端がフェードアウトし `→` が表示される

**時間別予報:**
- [ ] ミニグラフの直下にガントバーが表示される
- [ ] 対応する時間帯の列にバーが配置される
- [ ] 日別と同じ色・テキストルールが適用される
- [ ] 左端のラベル列（sticky）との高さ・位置がズレない

**エッジケース:**
- [ ] `jmaAreaCode` が未設定の地点では何も表示されない（エラーにならない）
- [ ] 警報が 1 件もない時はガントバー行が追加されない

- [ ] **Step 3: 最終コミット（問題なければ）**

```bash
git add -A
git commit -m "feat: 注意報・警報ガントバー表示を実装"
```

---

## Self-Review Notes

**仕様カバレッジ確認:**
- [x] `startMs` 追加 → Task 1
- [x] `computeWarningLanes` + `GANTT_GRADIENT` → Task 2
- [x] `WarningBar` コンポーネント（色・テキスト・フェード） → Task 3
- [x] 日別ガントバー行（列マッピング・連続バー） → Task 4
- [x] 時間別ガントバー行（hourlyPos 共用） → Task 5
- [x] WeatherTab からのデータ伝達 → Task 6
- [x] 左閉・右開区間境界値 → Task 4 `buildDailyColumns`
- [x] `endMs === undefined` の Infinity 扱い → Task 2 `computeWarningLanes`
- [x] HourlyTable ラベル列との空セル合わせ → Task 5 Step 4
- [x] startMs 年またぎ（`Date.parse` で ISO 文字列をそのままパース → 既存 endMs と同ロジック）

**型の一貫性:**
- `WarningBar` の props は `warning: JmaWarningItem` + `left: number` + `width: number`
- `warningToBar` と `warningToHourlyBar` は同じシグネチャで `{ left, width } | null` を返す
- `computeWarningLanes` の入出力: `JmaWarningItem[]` → `JmaWarningItem[][]`
