# 天気コード集計方式の統一と設定化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `forecast.ts`（最頻値）と`historicalForecast.ts`（最深刻度）で二重管理されていた天気コード集計ロジックを統一し、ユーザーが`'severity'`（最深刻度・デフォルト）と`'frequency'`（最頻値）を設定で切り替えられるようにする。

**Architecture:** `wmoSeverity.ts` に `WeatherCodeMode` 型・`modeCode()`・`selectCode()` を集約し、両APIファイルから共通利用する。`historicalForecast.ts` の `DayAmPmEntry` をコード配列方式（`forecast.ts` 準拠）に統一した後、両フェッチ関数に `mode` パラメーターを追加する。設定はFirestoreの `UserSettings.weatherCodeMode` に保存し、Zustandストア経由で各フックに伝播させる。

**Tech Stack:** TypeScript、Zustand（store）、Firestore（設定永続化）、React hooks

---

### Task 1: wmoSeverity.ts に共通型・関数を追加

**Files:**
- Modify: `src/lib/wmoSeverity.ts`

現在の `wmoSeverity.ts` 末尾に以下を追記する。`modeCode` は `forecast.ts` から移植。`selectCode` が両モードの分岐点になる統一インターフェース。

- [ ] **Step 1: `src/lib/wmoSeverity.ts` を以下の内容に置き換える**

```ts
// WMO Weather code → 深刻度スコア
// WMOコードは現象ブロック別に整理されており、数値の大小と深刻度は連動しない。
// このマップで正規化し、ブロックをまたぐ比較を正確に行う。
const WMO_SEVERITY: Record<number, number> = {
  0: 1, 1: 2, 2: 3, 3: 4,         // 快晴〜曇り
  45: 5, 48: 5,                     // 霧
  51: 6, 53: 7, 55: 8,              // 霧雨
  56: 9, 57: 10,                    // 着氷性の霧雨・雨
  80: 11, 85: 12,                   // にわか雨弱・にわか雪弱
  61: 13, 71: 14,                   // 小雨・小雪
  81: 15, 86: 16,                   // にわか雨・にわか雪
  82: 17,                           // 激しいにわか雨
  66: 18,                           // みぞれ
  63: 19, 73: 20, 77: 20,           // 雨・雪・雪粒（77は大雪より軽い）
  67: 21,                           // みぞれ強
  65: 22, 75: 23,                   // 大雨・大雪
  95: 24, 96: 25, 99: 26,           // 雷雨・雷雨ひょう・激しい雷雨ひょう
};

export function wmoSeverity(code: number): number {
  return WMO_SEVERITY[code] ?? 0;
}

/** 2つのWMOコードのうち深刻度が高い方を返す */
export function worstCode(a: number, b: number): number {
  return wmoSeverity(a) >= wmoSeverity(b) ? a : b;
}

/** 天気コード集計方式 */
export type WeatherCodeMode = 'severity' | 'frequency';

/**
 * コード配列から最頻値を返す。同頻度の場合は深刻度が高い方を採用。
 * frequency モードで使用。
 */
export function modeCode(codes: number[]): number | null {
  if (codes.length === 0) return null;
  const freq = new Map<number, number>();
  for (const c of codes) freq.set(c, (freq.get(c) ?? 0) + 1);
  let maxFreq = 0, result = 0;
  for (const [code, count] of freq) {
    if (count > maxFreq || (count === maxFreq && wmoSeverity(code) > wmoSeverity(result))) {
      maxFreq = count; result = code;
    }
  }
  return result;
}

/**
 * モードに応じてコード配列から代表値を選択する統一関数。
 * severity: 最深刻度（デフォルト）
 * frequency: 最頻値（同数タイは深刻度高い方）
 */
export function selectCode(codes: number[], mode: WeatherCodeMode): number | null {
  if (codes.length === 0) return null;
  if (mode === 'severity') {
    return codes.reduce((a, b) => wmoSeverity(a) >= wmoSeverity(b) ? a : b);
  }
  return modeCode(codes);
}
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

- [ ] **Step 3: コミットする**

```bash
git add src/lib/wmoSeverity.ts
git commit -m "feat(wmo): WeatherCodeMode型・modeCode・selectCodeを追加"
```

---

### Task 2: forecast.ts をmode対応に変更

**Files:**
- Modify: `src/api/forecast.ts`

インライン定義されていた `modeCode()` を削除し、`selectCode` を wmoSeverity.ts からインポートして使用。`fetchForecast` に `mode` パラメーターを追加（デフォルト `'severity'`）。

- [ ] **Step 1: `src/api/forecast.ts` のimportとmodeCode削除・selectCode追加を行う**

ファイル冒頭のimportを変更（既存: `import { wmoSeverity } from '../lib/wmoSeverity';`）:

```ts
import { selectCode, type WeatherCodeMode } from '../lib/wmoSeverity';
```

- [ ] **Step 2: `fetchForecast` のシグネチャを変更する**

変更前:
```ts
export async function fetchForecast(lat: number, lon: number): Promise<ForecastData> {
```

変更後:
```ts
export async function fetchForecast(lat: number, lon: number, mode: WeatherCodeMode = 'severity'): Promise<ForecastData> {
```

- [ ] **Step 3: インライン `modeCode` 関数を削除する**

以下のブロック（137〜149行付近）を丸ごと削除:

```ts
  // 最頻値を返す。同頻度の場合は大きい（悪い）コードを採用
  function modeCode(codes: number[]): number | null {
    if (codes.length === 0) return null;
    const freq = new Map<number, number>();
    for (const c of codes) freq.set(c, (freq.get(c) ?? 0) + 1);
    let maxFreq = 0, result = 0;
    for (const [code, count] of freq) {
      if (count > maxFreq || (count === maxFreq && wmoSeverity(code) > wmoSeverity(result))) {
        maxFreq = count; result = code;
      }
    }
    return result;
  }
```

- [ ] **Step 4: `modeCode(...)` 呼び出し3箇所を `selectCode(..., mode)` に置き換える**

変更前（234〜236行付近）:
```ts
    amWeatherCode:    modeCode(dayAmPm.get(t)?.amCodes    ?? []),
    pmWeatherCode:    modeCode(dayAmPm.get(t)?.pmCodes    ?? []),
    nightWeatherCode: modeCode(dayAmPm.get(t)?.nightCodes ?? []),
```

変更後:
```ts
    amWeatherCode:    selectCode(dayAmPm.get(t)?.amCodes    ?? [], mode),
    pmWeatherCode:    selectCode(dayAmPm.get(t)?.pmCodes    ?? [], mode),
    nightWeatherCode: selectCode(dayAmPm.get(t)?.nightCodes ?? [], mode),
```

- [ ] **Step 5: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

- [ ] **Step 6: コミットする**

```bash
git add src/api/forecast.ts
git commit -m "refactor(forecast): modeCodeを削除しselectCode(mode)に統一"
```

---

### Task 3: historicalForecast.ts をmode対応・配列方式に統一

**Files:**
- Modify: `src/api/historicalForecast.ts`

`DayAmPmEntry` の `amCode/pmCode/nightCode`（単一値）を `amCodes/pmCodes/nightCodes`（配列）に変更し、インライン `worstCode` 削減を廃止。`expandDayAmPm` に `mode` を追加し `selectCode` を使用。3つのフェッチ関数にも `mode` を追加。

- [ ] **Step 1: importを変更する**

変更前:
```ts
import { worstCode } from '../lib/wmoSeverity';
```

変更後:
```ts
import { selectCode, type WeatherCodeMode } from '../lib/wmoSeverity';
```

- [ ] **Step 2: `DayAmPmEntry` 型を配列方式に変更する（79〜84行付近）**

変更前:
```ts
type DayAmPmEntry = {
  amCode: number | null; pmCode: number | null; nightCode: number | null;
  amProb: number | null; pmProb: number | null; nightProb: number | null;
  amPrecipSum: number;   pmPrecipSum: number;   nightPrecipSum: number;
  amWindMax: number | null; pmWindMax: number | null; nightWindMax: number | null;
};
```

変更後:
```ts
type DayAmPmEntry = {
  amCodes: number[]; pmCodes: number[]; nightCodes: number[];
  amProb: number | null; pmProb: number | null; nightProb: number | null;
  amPrecipSum: number;   pmPrecipSum: number;   nightPrecipSum: number;
  amWindMax: number | null; pmWindMax: number | null; nightWindMax: number | null;
};
```

- [ ] **Step 3: `buildDayAmPmMap` の初期化とコード蓄積を配列方式に変更する（111〜136行付近）**

変更前（初期化）:
```ts
    if (!map.has(targetDate)) {
      map.set(targetDate, {
        amCode: null, pmCode: null, nightCode: null,
        amProb: null, pmProb: null, nightProb: null,
        amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
        amWindMax: null, pmWindMax: null, nightWindMax: null,
      });
    }
    const d = map.get(targetDate)!;
    if (period === 'am') {
      d.amCode       = d.amCode === null ? h.weatherCode : worstCode(d.amCode, h.weatherCode);
      d.amProb       = d.amProb === null ? h.precipProb  : Math.max(d.amProb,  h.precipProb);
      d.amPrecipSum += h.precipitation;
      d.amWindMax    = d.amWindMax === null ? h.windSpeed  : Math.max(d.amWindMax, h.windSpeed);
    } else if (period === 'pm') {
      d.pmCode       = d.pmCode === null ? h.weatherCode : worstCode(d.pmCode, h.weatherCode);
      d.pmProb       = d.pmProb === null ? h.precipProb  : Math.max(d.pmProb,  h.precipProb);
      d.pmPrecipSum += h.precipitation;
      d.pmWindMax    = d.pmWindMax === null ? h.windSpeed  : Math.max(d.pmWindMax, h.windSpeed);
    } else {
      d.nightCode       = d.nightCode === null ? h.weatherCode : worstCode(d.nightCode, h.weatherCode);
      d.nightProb       = d.nightProb === null ? h.precipProb  : Math.max(d.nightProb,  h.precipProb);
      d.nightPrecipSum += h.precipitation;
      d.nightWindMax    = d.nightWindMax === null ? h.windSpeed  : Math.max(d.nightWindMax, h.windSpeed);
    }
```

変更後:
```ts
    if (!map.has(targetDate)) {
      map.set(targetDate, {
        amCodes: [], pmCodes: [], nightCodes: [],
        amProb: null, pmProb: null, nightProb: null,
        amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
        amWindMax: null, pmWindMax: null, nightWindMax: null,
      });
    }
    const d = map.get(targetDate)!;
    if (period === 'am') {
      d.amCodes.push(h.weatherCode);
      d.amProb       = d.amProb === null ? h.precipProb  : Math.max(d.amProb,  h.precipProb);
      d.amPrecipSum += h.precipitation;
      d.amWindMax    = d.amWindMax === null ? h.windSpeed  : Math.max(d.amWindMax, h.windSpeed);
    } else if (period === 'pm') {
      d.pmCodes.push(h.weatherCode);
      d.pmProb       = d.pmProb === null ? h.precipProb  : Math.max(d.pmProb,  h.precipProb);
      d.pmPrecipSum += h.precipitation;
      d.pmWindMax    = d.pmWindMax === null ? h.windSpeed  : Math.max(d.pmWindMax, h.windSpeed);
    } else {
      d.nightCodes.push(h.weatherCode);
      d.nightProb       = d.nightProb === null ? h.precipProb  : Math.max(d.nightProb,  h.precipProb);
      d.nightPrecipSum += h.precipitation;
      d.nightWindMax    = d.nightWindMax === null ? h.windSpeed  : Math.max(d.nightWindMax, h.windSpeed);
    }
```

- [ ] **Step 4: `expandDayAmPm` のシグネチャとコード選択を変更する（142〜161行付近）**

変更前:
```ts
function expandDayAmPm(map: Map<string, DayAmPmEntry>, t: string) {
  return {
    amWeatherCode:    map.get(t)?.amCode    ?? null,
    pmWeatherCode:    map.get(t)?.pmCode    ?? null,
    nightWeatherCode: map.get(t)?.nightCode ?? null,
```

変更後:
```ts
function expandDayAmPm(map: Map<string, DayAmPmEntry>, t: string, mode: WeatherCodeMode) {
  return {
    amWeatherCode:    selectCode(map.get(t)?.amCodes    ?? [], mode),
    pmWeatherCode:    selectCode(map.get(t)?.pmCodes    ?? [], mode),
    nightWeatherCode: selectCode(map.get(t)?.nightCodes ?? [], mode),
```

- [ ] **Step 5: `fetchViaForecastEndpoint` に `mode` パラメーターを追加し `expandDayAmPm` に渡す（172〜178行付近）**

変更前:
```ts
async function fetchViaForecastEndpoint(
  baseUrl: string,
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<ForecastData> {
```

変更後:
```ts
async function fetchViaForecastEndpoint(
  baseUrl: string,
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  mode: WeatherCodeMode,
): Promise<ForecastData> {
```

同関数内の `expandDayAmPm(dayAmPm, t)` を `expandDayAmPm(dayAmPm, t, mode)` に変更（2箇所ある場合はすべて）。

- [ ] **Step 6: `fetchViaArchiveApi` に同様の変更を行う（268〜274行付近）**

変更前:
```ts
async function fetchViaArchiveApi(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<ForecastData> {
```

変更後:
```ts
async function fetchViaArchiveApi(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  mode: WeatherCodeMode,
): Promise<ForecastData> {
```

同関数内の `expandDayAmPm(dayAmPm, t)` を `expandDayAmPm(dayAmPm, t, mode)` に変更。

- [ ] **Step 7: `fetchHistoricalForecast` に `mode` パラメーターを追加し内部呼び出しに渡す（377行付近）**

変更前:
```ts
export async function fetchHistoricalForecast(
  lat: number,
  lon: number,
  startDate: string,
): Promise<ForecastData> {
```

変更後:
```ts
export async function fetchHistoricalForecast(
  lat: number,
  lon: number,
  startDate: string,
  mode: WeatherCodeMode = 'severity',
): Promise<ForecastData> {
```

関数内の `fetchViaForecastEndpoint(...)` 呼び出し2箇所と `fetchViaArchiveApi(...)` 呼び出し1箇所の末尾に `, mode` を追加:

```ts
// 段階1
apiData = await fetchViaForecastEndpoint(
  'https://api.open-meteo.com/v1/forecast',
  lat, lon, startDate, apiEndDate, mode,
);
// 段階2
apiData = await fetchViaForecastEndpoint(
  'https://historical-forecast-api.open-meteo.com/v1/forecast',
  lat, lon, startDate, apiEndDate, mode,
);
// 段階3
apiData = await fetchViaArchiveApi(lat, lon, startDate, apiEndDate, mode);
```

- [ ] **Step 8: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

- [ ] **Step 9: コミットする**

```bash
git add src/api/historicalForecast.ts
git commit -m "refactor(historical): DayAmPmEntryを配列方式に統一しselectCode(mode)を使用"
```

---

### Task 4: UserSettings に weatherCodeMode を追加

**Files:**
- Modify: `src/store.ts`
- Modify: `src/lib/userRepository.ts`

- [ ] **Step 1: `src/store.ts` に `WeatherCodeMode` をインポートし `UserSettings` に追加する**

ファイル冒頭のインポートに追加:
```ts
import type { WeatherCodeMode } from './lib/wmoSeverity';
```

`UserSettings` インターフェースに追加（既存フィールドの末尾）:
```ts
export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  defaultLocationId:    string | null;
  enabledJmaGroups:     JmaWarningGroup[];
  enabledAiSections:    AiSection[];
  aiCustomPrompt:       string;
  weatherCodeMode:      WeatherCodeMode;
}
```

- [ ] **Step 2: `AppState` に `updateWeatherCodeMode` アクションを追加する**

`AppState` インターフェースに追加（`updateAiCustomPrompt` の後）:
```ts
  updateWeatherCodeMode: (mode: WeatherCodeMode) => Promise<void>;
```

- [ ] **Step 3: `store.ts` の import に `updateWeatherCodeMode as updateWeatherCodeModeRemote` を追加する**

既存のimport群に追記:
```ts
import {
  // ...既存...
  updateWeatherCodeMode as updateWeatherCodeModeRemote,
} from './lib/userRepository';
```

- [ ] **Step 4: store の実装に `updateWeatherCodeMode` アクションを追加する**

`updateAiCustomPrompt` アクションの後に追加:
```ts
  updateWeatherCodeMode: async (mode) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateWeatherCodeModeRemote(uid, mode);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, weatherCodeMode: mode }
        : null,
    }));
  },
```

- [ ] **Step 5: `src/lib/userRepository.ts` の `getUserSettings` に `weatherCodeMode` を追加する**

`getUserSettings` 内の `return` 直前に追加:
```ts
  const weatherCodeMode: WeatherCodeMode =
    data?.weatherCodeMode === 'frequency' ? 'frequency' : 'severity';
```

`return` ブロックに追加:
```ts
  return {
    baseTempSettings, accumStartDates, accumDeltaThresholds,
    defaultLocationId, enabledJmaGroups, enabledAiSections, aiCustomPrompt,
    weatherCodeMode,
  };
```

`userRepository.ts` のインポートに型を追加:
```ts
import type { UserSettings, AccumStartDates, AccumDeltaThresholds, JmaWarningGroup, AiSection, WeatherCodeMode } from '../store';
```

※ `WeatherCodeMode` は `store.ts` が `wmoSeverity.ts` から re-export しないため、直接 `wmoSeverity.ts` からインポートする:
```ts
import type { WeatherCodeMode } from './wmoSeverity';
```

（`store.ts` のimportとは別に追加する）

- [ ] **Step 6: `userRepository.ts` に `updateWeatherCodeMode` 関数を追加する**

ファイル末尾に追加:
```ts
export async function updateWeatherCodeMode(
  uid: string,
  mode: WeatherCodeMode,
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { weatherCodeMode: mode }, { merge: true });
}
```

- [ ] **Step 7: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

- [ ] **Step 8: コミットする**

```bash
git add src/store.ts src/lib/userRepository.ts
git commit -m "feat(settings): UserSettingsにweatherCodeModeを追加"
```

---

### Task 5: フックに mode パラメーターを追加

**Files:**
- Modify: `src/hooks/useForecast.ts`
- Modify: `src/hooks/useHistoricalForecast.ts`

- [ ] **Step 1: `src/hooks/useForecast.ts` を変更する**

インポートに追加:
```ts
import type { WeatherCodeMode } from '../lib/wmoSeverity';
```

`useForecast` のシグネチャを変更:
```ts
export function useForecast(lat: number | null, lon: number | null, mode: WeatherCodeMode = 'severity') {
```

キャッシュキーに `mode` を追加:
```ts
    const key = `${lat},${lon},${mode}`;
```

`fetchForecast` 呼び出しに `mode` を追加:
```ts
      const result = await fetchForecast(lat, lon, mode);
```

`useCallback` の deps に `mode` を追加:
```ts
  }, [lat, lon, mode]);
```

- [ ] **Step 2: `src/hooks/useHistoricalForecast.ts` を変更する**

インポートに追加:
```ts
import type { WeatherCodeMode } from '../lib/wmoSeverity';
```

`useHistoricalForecast` のシグネチャを変更:
```ts
export function useHistoricalForecast(
  lat: number | null,
  lon: number | null,
  startDate: string | null,
  mode: WeatherCodeMode = 'severity',
) {
```

キャッシュキーに `mode` を追加:
```ts
    const key = `${lat},${lon},${startDate},${mode}`;
```

`fetchHistoricalForecast` 呼び出しに `mode` を追加:
```ts
      const result = await fetchHistoricalForecast(lat, lon, startDate, mode);
```

`useCallback` の deps に `mode` を追加:
```ts
  }, [lat, lon, startDate, mode]);
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

- [ ] **Step 4: コミットする**

```bash
git add src/hooks/useForecast.ts src/hooks/useHistoricalForecast.ts
git commit -m "feat(hooks): useForecast/useHistoricalForecastにmodeパラメーターを追加"
```

---

### Task 6: 呼び出し元に weatherCodeMode を渡す

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/weather/HistoricalWeatherTab.tsx`

- [ ] **Step 1: `src/App.tsx` の `useForecast` 呼び出し2箇所に `weatherCodeMode` を追加する**

`userSettings` を取得している行を確認（既に `userSettings` は `useAppStore()` から取得済み）。

変更前（320〜323行付近）:
```tsx
  const { data: forecastData } = useForecast(
    forecastLoc?.lat ?? null,
    forecastLoc?.lon ?? null,
  );
```

変更後:
```tsx
  const { data: forecastData } = useForecast(
    forecastLoc?.lat ?? null,
    forecastLoc?.lon ?? null,
    userSettings?.weatherCodeMode ?? 'severity',
  );
```

変更前（334〜337行付近）:
```tsx
  const { data: forecastData2 } = useForecast(
    forecastLoc2?.lat ?? null,
    forecastLoc2?.lon ?? null,
  );
```

変更後:
```tsx
  const { data: forecastData2 } = useForecast(
    forecastLoc2?.lat ?? null,
    forecastLoc2?.lon ?? null,
    userSettings?.weatherCodeMode ?? 'severity',
  );
```

- [ ] **Step 2: `src/components/weather/HistoricalWeatherTab.tsx` の `useHistoricalForecast` 呼び出しに `weatherCodeMode` を追加する**

`const { userSettings, ... } = useAppStore()` はすでにある（20行付近）。

変更前（68〜72行付近）:
```tsx
  const { data, loading, loadingStatus, error } = useHistoricalForecast(
    location?.lat ?? null,
    location?.lon ?? null,
    startDate,
  );
```

変更後:
```tsx
  const { data, loading, loadingStatus, error } = useHistoricalForecast(
    location?.lat ?? null,
    location?.lon ?? null,
    startDate,
    userSettings?.weatherCodeMode ?? 'severity',
  );
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

- [ ] **Step 4: コミットする**

```bash
git add src/App.tsx src/components/weather/HistoricalWeatherTab.tsx
git commit -m "feat: useForecast/useHistoricalForecastにweatherCodeModeを伝播"
```

---

### Task 7: 設定UIにトグルを追加

**Files:**
- Modify: `src/components/settings/AnalysisSettings.tsx`

`AnalysisSettings.tsx` の先頭部分（累積開始日セクションの前）に天気コード集計方式トグルを追加する。

- [ ] **Step 1: `AnalysisSettings.tsx` のインポートに追加する**

```ts
import { useAppStore, DEFAULT_ACCUM_START_DATES, DEFAULT_ACCUM_DELTA_THRESHOLDS, type AccumStartDates, type AccumDeltaThresholds } from '../../store';
```

（`useAppStore` はすでにインポートされているはずなので、`updateWeatherCodeMode` アクションが使える。）

- [ ] **Step 2: コンポーネント内で `weatherCodeMode` と `updateWeatherCodeMode` を取得する**

`AnalysisSettings` 関数内の `useAppStore` 呼び出しに追加:

```ts
  const { user, userSettings, updateWeatherCodeMode, /* 既存 */ } = useAppStore();
  const weatherCodeMode = userSettings?.weatherCodeMode ?? 'severity';
```

- [ ] **Step 3: 天気コードセクションのJSXを追加する**

既存の累積開始日セクション（最初の `<section>` タグ）の直前に追加:

```tsx
      {/* 天気コード集計方式 */}
      <section className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 600 }}>天気コードの集計方式</h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          時間別データから午前・午後・夜間の天気アイコンを決定する方法です。予報・過去データの両方に適用されます。
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={weatherCodeMode === 'severity' ? 'primary' : 'secondary'}
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
            onClick={() => { if (user && weatherCodeMode !== 'severity') updateWeatherCodeMode('severity'); }}
          >
            最深刻度（推奨）
          </button>
          <button
            className={weatherCodeMode === 'frequency' ? 'primary' : 'secondary'}
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
            onClick={() => { if (user && weatherCodeMode !== 'frequency') updateWeatherCodeMode('frequency'); }}
          >
            最頻値
          </button>
        </div>
      </section>
```

- [ ] **Step 4: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

- [ ] **Step 5: dev server で動作確認する**

```bash
npm run dev
```

確認項目:
- 設定 → 空くらべ タブに「天気コードの集計方式」セクションが表示される
- 「最深刻度（推奨）」がデフォルトで active（primary ボタン）になっている
- 「最頻値」をクリックするとボタンが切り替わり、画面を再読み込みしても設定が保持される
- 設定変更後、日別予報の午前・午後・夜間アイコンが変化する（雨+晴れ混在時間帯で確認）

- [ ] **Step 6: コミットする**

```bash
git add src/components/settings/AnalysisSettings.tsx
git commit -m "feat(settings): 天気コード集計方式トグルUIを追加"
```

---

### Task 8: push

- [ ] **Step 1: すべてのコミットをプッシュする**

```bash
git push
```

期待: Cloudflare Pages のビルドが成功する
