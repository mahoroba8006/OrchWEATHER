# 日別天気アイコン インライン切替 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「空もよう」「あの日の空」タブの日別予報ブロック上部に [リスクを優先 | 概況を優先] トグルを追加し、APIの再フェッチなしにワンタップで切り替えられるようにする。切り替えは即時（< 1ms）。

**Architecture:** `fetchForecast`/`fetchHistoricalForecast` から `mode` パラメーターを廃止し、`DailyForecastData` に `amCodes/pmCodes/nightCodes: number[]` を追加してキャッシュに保持する。`DailyForecast.tsx` がレンダー時に `selectCode(codes, mode)` を呼び出すことでモード変更は API コール不要・Zustand 再レンダーのみで反映される。`store.ts` の `updateWeatherCodeMode` を楽観的更新（Zustand 先行、Firestore は非同期）に変更して体感速度を最大化する。両タブで同一の Zustand `weatherCodeMode` を共有。選択されていない方のコードをミニアイコン（20px・opacity 0.45）として各セルに表示する。

**Tech Stack:** TypeScript、React、Zustand、`src/lib/wmoSeverity.ts`（selectCode/WeatherCodeMode）

---

### Task 1: DailyForecastData 型変更 + forecast.ts のコード生成削除

**Files:**
- Modify: `src/api/forecast.ts`

現在 `amWeatherCode/pmWeatherCode/nightWeatherCode: number | null` が `DailyForecastData` に定義されているが、これはモード依存の派生値なので削除し、生の `amCodes/pmCodes/nightCodes: number[]` を追加する。`fetchForecast` から `mode` パラメーターと `selectCode` 呼び出しを削除する。

- [ ] **Step 1: `DailyForecastData` インターフェースを変更する（forecast.ts:40-42行付近）**

変更前:
```ts
  amWeatherCode:    number | null; // WMO max 04:00-11:00
  pmWeatherCode:    number | null; // WMO max 12:00-19:00
  nightWeatherCode: number | null; // WMO max 20:00-翌3:00
```

変更後:
```ts
  amCodes:   number[]; // WMO codes 04:00-11:00（モード選択はレンダー側で行う）
  pmCodes:   number[]; // WMO codes 12:00-19:00
  nightCodes: number[]; // WMO codes 20:00-翌3:00
```

- [ ] **Step 2: `fetchForecast` の import と mode パラメーターを変更する（forecast.ts:1-5行付近）**

変更前:
```ts
import { selectCode, type WeatherCodeMode } from '../lib/wmoSeverity';
```

変更後:
```ts
// wmoSeverity の import は不要になる（selectCode / WeatherCodeMode の使用箇所が消える）
```

`fetchForecast` 関数シグネチャ（forecast.ts:79行付近）:

変更前:
```ts
export async function fetchForecast(lat: number, lon: number, mode: WeatherCodeMode = 'severity'): Promise<ForecastData> {
```

変更後:
```ts
export async function fetchForecast(lat: number, lon: number): Promise<ForecastData> {
```

- [ ] **Step 3: daily 配列マッピングの amWeatherCode 行を amCodes に変更する（forecast.ts:221-223行付近）**

変更前:
```ts
    amWeatherCode:    selectCode(dayAmPm.get(t)?.amCodes    ?? [], mode),
    pmWeatherCode:    selectCode(dayAmPm.get(t)?.pmCodes    ?? [], mode),
    nightWeatherCode: selectCode(dayAmPm.get(t)?.nightCodes ?? [], mode),
```

変更後:
```ts
    amCodes:   dayAmPm.get(t)?.amCodes    ?? [],
    pmCodes:   dayAmPm.get(t)?.pmCodes    ?? [],
    nightCodes: dayAmPm.get(t)?.nightCodes ?? [],
```

- [ ] **Step 4: ビルドエラーがないことを確認する**

```bash
npm run build
```

期待: `forecast.ts` 周辺の型エラーのみ（他ファイルから `amWeatherCode` を読んでいる箇所が壊れる）。Task 5 で DailyForecast.tsx を直すまで一時的にエラーが出るため、エラー内容をメモして次のタスクへ進む。

---

### Task 2: historicalForecast.ts の変更

**Files:**
- Modify: `src/api/historicalForecast.ts`

`createPlaceholderDay`・`expandDayAmPm`・フェッチ関数3つから `mode` を取り除き、生のコード配列をパススルーする。

- [ ] **Step 1: import から `selectCode` と `WeatherCodeMode` を削除する（historicalForecast.ts:18行）**

変更前:
```ts
import { selectCode, type WeatherCodeMode } from '../lib/wmoSeverity';
```

変更後:
```ts
// wmoSeverity の import を削除
```

（`worstCode` も使っていない場合は行ごと削除。もし他の用途で使っていれば必要なものだけ残す。）

- [ ] **Step 2: `createPlaceholderDay` の amWeatherCode 行を変更する（historicalForecast.ts:67行）**

変更前:
```ts
    amWeatherCode:    null, pmWeatherCode:    null, nightWeatherCode: null,
```

変更後:
```ts
    amCodes: [], pmCodes: [], nightCodes: [],
```

- [ ] **Step 3: `expandDayAmPm` 関数を変更する（historicalForecast.ts:143-161行）**

変更前:
```ts
function expandDayAmPm(map: Map<string, DayAmPmEntry>, t: string, mode: WeatherCodeMode) {
  return {
    amWeatherCode:    selectCode(map.get(t)?.amCodes    ?? [], mode),
    pmWeatherCode:    selectCode(map.get(t)?.pmCodes    ?? [], mode),
    nightWeatherCode: selectCode(map.get(t)?.nightCodes ?? [], mode),
    amPrecipProb: ...
```

変更後:
```ts
function expandDayAmPm(map: Map<string, DayAmPmEntry>, t: string) {
  return {
    amCodes:   map.get(t)?.amCodes    ?? [],
    pmCodes:   map.get(t)?.pmCodes    ?? [],
    nightCodes: map.get(t)?.nightCodes ?? [],
    amPrecipProb: ...
```

- [ ] **Step 4: `fetchViaForecastEndpoint` から `mode` を削除する（historicalForecast.ts:172-179行）**

変更前:
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

変更後:
```ts
async function fetchViaForecastEndpoint(
  baseUrl: string,
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<ForecastData> {
```

同関数内の `expandDayAmPm(dayAmPm, t, mode)` を `expandDayAmPm(dayAmPm, t)` に変更（2箇所ある場合はすべて）。

- [ ] **Step 5: `fetchViaArchiveApi` から `mode` を削除する（fetchViaForecastEndpoint の下にある関数）**

`fetchViaForecastEndpoint` と同じ変更を `fetchViaArchiveApi` にも適用する。シグネチャから `mode: WeatherCodeMode` を削除し、内部の `expandDayAmPm` 呼び出しを `mode` なしに変更する。

- [ ] **Step 6: `fetchHistoricalForecast` から `mode` を削除する**

変更前:
```ts
export async function fetchHistoricalForecast(
  lat: number,
  lon: number,
  startDate: string,
  mode: WeatherCodeMode = 'severity',
): Promise<ForecastData> {
```

変更後:
```ts
export async function fetchHistoricalForecast(
  lat: number,
  lon: number,
  startDate: string,
): Promise<ForecastData> {
```

関数内の `fetchViaForecastEndpoint(...)` 2箇所と `fetchViaArchiveApi(...)` 1箇所から末尾の `, mode` 引数を削除する。

- [ ] **Step 7: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `historicalForecast.ts` 周辺のエラーが解消される。残るエラーは `DailyForecast.tsx` / `useForecast.ts` / `useHistoricalForecast.ts` / `App.tsx` など（後続タスクで解消）。

---

### Task 3: キャッシュフックから mode を除去

**Files:**
- Modify: `src/hooks/useForecast.ts`
- Modify: `src/hooks/useHistoricalForecast.ts`

- [ ] **Step 1: `useForecast.ts` から `mode` を削除する**

変更前（useForecast.ts:9行）:
```ts
export function useForecast(lat: number | null, lon: number | null, mode: WeatherCodeMode = 'severity') {
```

変更後:
```ts
export function useForecast(lat: number | null, lon: number | null) {
```

キャッシュキー（useForecast.ts:24行）:

変更前:
```ts
    const key = `${lat},${lon},${mode}`;
```

変更後:
```ts
    const key = `${lat},${lon}`;
```

`fetchForecast` 呼び出し（useForecast.ts:42行）:

変更前:
```ts
      const result = await fetchForecast(lat, lon, mode);
```

変更後:
```ts
      const result = await fetchForecast(lat, lon);
```

`useCallback` deps（useForecast.ts:59行）:

変更前:
```ts
  }, [lat, lon, mode]);
```

変更後:
```ts
  }, [lat, lon]);
```

import の `WeatherCodeMode` も不要になれば削除する。

- [ ] **Step 2: `useHistoricalForecast.ts` から `mode` を同様に削除する**

`useHistoricalForecast` のシグネチャから `mode: WeatherCodeMode = 'severity'` を削除する。

キャッシュキーから `,${mode}` を削除する（`${lat},${lon},${startDate}` に戻す）。

`fetchHistoricalForecast(lat, lon, startDate, mode)` を `fetchHistoricalForecast(lat, lon, startDate)` に変更する。

`useCallback` deps から `mode` を削除する。

- [ ] **Step 3: ビルドエラー確認**

```bash
npm run build
```

期待: `App.tsx`・`WeatherTab.tsx`・`HistoricalWeatherTab.tsx` で「mode 引数を余分に渡している」エラーが出る（次タスクで解消）。

---

### Task 4: store.ts の updateWeatherCodeMode を楽観的更新に変更

**Files:**
- Modify: `src/store.ts`

現在 Firestore を await してから Zustand を更新しているため、UI反映に ~300ms かかる。Zustand を先に更新することで即時反映する。

- [ ] **Step 1: `updateWeatherCodeMode` アクションを変更する（store.ts:252-261行）**

変更前:
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

変更後:
```ts
  updateWeatherCodeMode: async (mode) => {
    const uid = get().user?.uid;
    if (!uid) return;
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, weatherCodeMode: mode }
        : null,
    }));
    updateWeatherCodeModeRemote(uid, mode).catch(() => {/* best-effort */});
  },
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `store.ts` に型エラーなし。

---

### Task 5: DailyForecast.tsx の更新（weatherCodeMode prop + ミニアイコン）

**Files:**
- Modify: `src/components/weather/DailyForecast.tsx`

`DailyForecast` に `weatherCodeMode` prop を追加し、レンダー時に `selectCode` でメインコードと代替コードを計算する。代替コードが異なる場合はミニアイコンを表示する。

- [ ] **Step 1: import と Props を更新する（DailyForecast.tsx:1-13行）**

ファイル先頭に追加:
```ts
import { selectCode, type WeatherCodeMode } from '../../lib/wmoSeverity';
```

Props インターフェースに追加:
```ts
interface Props {
  daily: DailyForecastData[];
  weatherCodeMode: WeatherCodeMode;
  onHalfDayClick?: (date: string, period: 'am' | 'pm' | 'night') => void;
  jmaWarnings?: JmaWarningItem[];
}
```

`DailyForecast` 関数のデストラクチャリングに追加:
```ts
export function DailyForecast({ daily, weatherCodeMode, onHalfDayClick, jmaWarnings }: Props) {
```

- [ ] **Step 2: 天気テキスト行（時間帯別天気テキスト）を更新する（DailyForecast.tsx:408-419行）**

変更前:
```tsx
            <tr>
              {daily.map((day, i) => {
                const wStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 };
                return (
                  <Fragment key={day.date}>
                    <td style={amCell(day)}><div style={wStyle}>{day.amWeatherCode !== null ? (codeToLabel(day.amWeatherCode) ?? '—') : '—'}</div></td>
                    <td style={pmCell(day)}><div style={wStyle}>{day.pmWeatherCode !== null ? (codeToLabel(day.pmWeatherCode) ?? '—') : '—'}</div></td>
                    <td style={nightCell(day, i)}><div style={wStyle}>{day.nightWeatherCode !== null ? (codeToLabel(day.nightWeatherCode) ?? '—') : '—'}</div></td>
                  </Fragment>
                );
              })}
            </tr>
```

変更後:
```tsx
            <tr>
              {daily.map((day, i) => {
                const wStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 };
                const amMain    = selectCode(day.amCodes,    weatherCodeMode);
                const pmMain    = selectCode(day.pmCodes,    weatherCodeMode);
                const nightMain = selectCode(day.nightCodes, weatherCodeMode);
                return (
                  <Fragment key={day.date}>
                    <td style={amCell(day)}><div style={wStyle}>{amMain !== null ? (codeToLabel(amMain) ?? '—') : '—'}</div></td>
                    <td style={pmCell(day)}><div style={wStyle}>{pmMain !== null ? (codeToLabel(pmMain) ?? '—') : '—'}</div></td>
                    <td style={nightCell(day, i)}><div style={wStyle}>{nightMain !== null ? (codeToLabel(nightMain) ?? '—') : '—'}</div></td>
                  </Fragment>
                );
              })}
            </tr>
```

- [ ] **Step 3: 天気アイコン行を更新する（DailyForecast.tsx:421-462行）**

変更前（isPlaceholder でない日の Fragment）:
```tsx
                return (
                  <Fragment key={day.date}>
                    <td
                      style={{ ...amCell(day), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'am')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                        {day.amWeatherCode !== null ? <WeatherIcon code={day.amWeatherCode} size={84} /> : '—'}
                      </div>
                    </td>
                    <td
                      style={{ ...pmCell(day), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'pm')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                        {day.pmWeatherCode !== null ? <WeatherIcon code={day.pmWeatherCode} size={84} /> : '—'}
                      </div>
                    </td>
                    <td
                      style={{ ...nightCell(day, i), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'night')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                        {day.nightWeatherCode !== null ? <WeatherIcon code={day.nightWeatherCode} size={84} isNight /> : '—'}
                      </div>
                    </td>
                  </Fragment>
                );
```

変更後:

> **レイアウト方針:** コンテナを `height: 108`（固定）に統一する。`84px（メインアイコン）+ 2px（gap）+ 20px（ミニアイコンスロット）+ 2px（paddingTop）= 108px`。ミニアイコンスロット（`height: 20` の div）は常にレンダーし、中身を条件分岐することで全セルの高さを揃える。メインアイコンは `size={84}` を維持（縮小なし）。

プレースホルダーセルの `dashCell` も高さを合わせる（同じ行の手前に記述されている）:

変更前:
```tsx
                const dashCell: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84, color: 'var(--text-tertiary)', fontSize: '1rem' };
```

変更後:
```tsx
                const dashCell: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 108, color: 'var(--text-tertiary)', fontSize: '1rem' };
```

isPlaceholder でない日の Fragment:
```tsx
                const altMode   = weatherCodeMode === 'severity' ? 'frequency' : 'severity';
                const amMain    = selectCode(day.amCodes,    weatherCodeMode);
                const pmMain    = selectCode(day.pmCodes,    weatherCodeMode);
                const nightMain = selectCode(day.nightCodes, weatherCodeMode);
                const amAlt     = selectCode(day.amCodes,    altMode);
                const pmAlt     = selectCode(day.pmCodes,    altMode);
                const nightAlt  = selectCode(day.nightCodes, altMode);
                // アイコンセルの共通コンテナスタイル
                // height: 108 = paddingTop(2) + icon(84) + gap(2) + mini slot(20)
                const iconContainer: CSSProperties = {
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'flex-start', height: 108, paddingTop: 2, gap: 2,
                };
                return (
                  <Fragment key={day.date}>
                    <td
                      style={{ ...amCell(day), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'am')}
                    >
                      <div style={iconContainer}>
                        {amMain !== null ? <WeatherIcon code={amMain} size={84} /> : '—'}
                        <div style={{ height: 20, width: 20, flexShrink: 0 }}>
                          {amAlt !== null && amAlt !== amMain && (
                            <WeatherIcon code={amAlt} size={20} style={{ opacity: 0.45 }} />
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      style={{ ...pmCell(day), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'pm')}
                    >
                      <div style={iconContainer}>
                        {pmMain !== null ? <WeatherIcon code={pmMain} size={84} /> : '—'}
                        <div style={{ height: 20, width: 20, flexShrink: 0 }}>
                          {pmAlt !== null && pmAlt !== pmMain && (
                            <WeatherIcon code={pmAlt} size={20} style={{ opacity: 0.45 }} />
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      style={{ ...nightCell(day, i), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'night')}
                    >
                      <div style={iconContainer}>
                        {nightMain !== null ? <WeatherIcon code={nightMain} size={84} isNight /> : '—'}
                        <div style={{ height: 20, width: 20, flexShrink: 0 }}>
                          {nightAlt !== null && nightAlt !== nightMain && (
                            <WeatherIcon code={nightAlt} size={20} isNight style={{ opacity: 0.45 }} />
                          )}
                        </div>
                      </div>
                    </td>
                  </Fragment>
                );
```

- [ ] **Step 4: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `DailyForecast.tsx` のエラーが解消される。残るエラーは `WeatherTab.tsx` / `HistoricalWeatherTab.tsx` / `App.tsx` で「weatherCodeMode prop が不足」または「mode 引数を余分に渡している」もの（次タスクで解消）。

---

### Task 6: WeatherTab.tsx にトグルUI追加

**Files:**
- Modify: `src/components/weather/WeatherTab.tsx`

`useForecast` への `mode` 引数を削除し、`updateWeatherCodeMode` を Zustand から取得してトグルボタンを追加する。`DailyForecast` に `weatherCodeMode` を渡す。

- [ ] **Step 1: `useAppStore` のデストラクチャリングに `updateWeatherCodeMode` を追加する（WeatherTab.tsx:18行）**

変更前:
```ts
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, user } = useAppStore();
```

変更後:
```ts
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, user, updateWeatherCodeMode } = useAppStore();
```

`weatherCodeMode` を導出する行を追加:
```ts
  const weatherCodeMode = userSettings?.weatherCodeMode ?? 'severity';
```

- [ ] **Step 2: `useForecast` 呼び出しから `weatherCodeMode` を削除する（WeatherTab.tsx:64-68行）**

変更前:
```ts
  const { data, loading, loadingStatus, error, lastUpdated, refresh } = useForecast(
    location?.lat ?? null,
    location?.lon ?? null,
    userSettings?.weatherCodeMode ?? 'severity',
  );
```

変更後:
```ts
  const { data, loading, loadingStatus, error, lastUpdated, refresh } = useForecast(
    location?.lat ?? null,
    location?.lon ?? null,
  );
```

- [ ] **Step 3: DailyForecast を囲む `<section>` の直前にトグルボタンを追加する（WeatherTab.tsx:240行付近）**

変更前:
```tsx
          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <DailyForecast daily={data.daily} onHalfDayClick={scrollToHour} jmaWarnings={filteredJmaWarning?.items} />
          </section>
```

変更後:
```tsx
          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem', padding: '0 0.75rem 0.5rem' }}>
              <button
                onClick={() => updateWeatherCodeMode('severity')}
                className="secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  background: weatherCodeMode === 'severity' ? 'rgba(244,167,185,0.45)' : undefined,
                  color: weatherCodeMode === 'severity' ? '#7a2840' : undefined,
                }}
              >
                リスクを優先
              </button>
              <button
                onClick={() => updateWeatherCodeMode('frequency')}
                className="secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  background: weatherCodeMode === 'frequency' ? 'rgba(244,167,185,0.45)' : undefined,
                  color: weatherCodeMode === 'frequency' ? '#7a2840' : undefined,
                }}
              >
                概況を優先
              </button>
            </div>
            <DailyForecast
              daily={data.daily}
              weatherCodeMode={weatherCodeMode}
              onHalfDayClick={scrollToHour}
              jmaWarnings={filteredJmaWarning?.items}
            />
          </section>
```

- [ ] **Step 4: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `WeatherTab.tsx` のエラーが解消される。

---

### Task 7: HistoricalWeatherTab.tsx にトグルUI追加

**Files:**
- Modify: `src/components/weather/HistoricalWeatherTab.tsx`

WeatherTab と同じパターンを適用する。

- [ ] **Step 1: `useAppStore` のデストラクチャリングに `updateWeatherCodeMode` を追加する（HistoricalWeatherTab.tsx:20行）**

変更前:
```ts
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation } = useAppStore();
```

変更後:
```ts
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, updateWeatherCodeMode } = useAppStore();
```

`weatherCodeMode` を導出する行を追加（`startDate` state の直下あたり）:
```ts
  const weatherCodeMode = userSettings?.weatherCodeMode ?? 'severity';
```

- [ ] **Step 2: `useHistoricalForecast` 呼び出しから `weatherCodeMode` を削除する（HistoricalWeatherTab.tsx:68-73行）**

変更前:
```ts
  const { data, loading, loadingStatus, error } = useHistoricalForecast(
    location?.lat ?? null,
    location?.lon ?? null,
    startDate,
    userSettings?.weatherCodeMode ?? 'severity',
  );
```

変更後:
```ts
  const { data, loading, loadingStatus, error } = useHistoricalForecast(
    location?.lat ?? null,
    location?.lon ?? null,
    startDate,
  );
```

- [ ] **Step 3: DailyForecast を囲む `<section>` にトグルボタンと `weatherCodeMode` prop を追加する（HistoricalWeatherTab.tsx:220-225行）**

変更前:
```tsx
          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <DailyForecast
              daily={nonPlaceholderDaily}
              onHalfDayClick={scrollToHour}
            />
          </section>
```

変更後:
```tsx
          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem', padding: '0 0.75rem 0.5rem' }}>
              <button
                onClick={() => updateWeatherCodeMode('severity')}
                className="secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  background: weatherCodeMode === 'severity' ? 'rgba(244,167,185,0.45)' : undefined,
                  color: weatherCodeMode === 'severity' ? '#7a2840' : undefined,
                }}
              >
                リスクを優先
              </button>
              <button
                onClick={() => updateWeatherCodeMode('frequency')}
                className="secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  background: weatherCodeMode === 'frequency' ? 'rgba(244,167,185,0.45)' : undefined,
                  color: weatherCodeMode === 'frequency' ? '#7a2840' : undefined,
                }}
              >
                概況を優先
              </button>
            </div>
            <DailyForecast
              daily={nonPlaceholderDaily}
              weatherCodeMode={weatherCodeMode}
              onHalfDayClick={scrollToHour}
            />
          </section>
```

- [ ] **Step 4: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `HistoricalWeatherTab.tsx` のエラーが解消される。

---

### Task 8: App.tsx から mode 引数を削除

**Files:**
- Modify: `src/App.tsx`

空くらべタブ用の `useForecast` 2呼び出しから `weatherCodeMode` を削除する。

- [ ] **Step 1: `useForecast` 呼び出し2箇所を変更する（App.tsx:320-340行付近）**

1箇所目（変更前）:
```ts
  const { data: forecastData } = useForecast(
    forecastLoc?.lat ?? null,
    forecastLoc?.lon ?? null,
    userSettings?.weatherCodeMode ?? 'severity',
  );
```

変更後:
```ts
  const { data: forecastData } = useForecast(
    forecastLoc?.lat ?? null,
    forecastLoc?.lon ?? null,
  );
```

2箇所目（変更前）:
```ts
  const { data: forecastData2 } = useForecast(
    forecastLoc2?.lat ?? null,
    forecastLoc2?.lon ?? null,
    userSettings?.weatherCodeMode ?? 'severity',
  );
```

変更後:
```ts
  const { data: forecastData2 } = useForecast(
    forecastLoc2?.lat ?? null,
    forecastLoc2?.lon ?? null,
  );
```

- [ ] **Step 2: ビルドが完全に通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーゼロ。

---

### Task 9: JmaWarningSettings.tsx ラベル更新 + 即時保存化

**Files:**
- Modify: `src/components/settings/JmaWarningSettings.tsx`

設定タブ側のトグルラベルを統一し、「保存ボタン」を廃止して即時保存に変更する。

- [ ] **Step 1: `pendingMode` state と `modeStatus` state を削除し、即時保存に変更する（JmaWarningSettings.tsx:120-123行）**

削除対象:
```ts
  const [pendingMode, setPendingMode] = useState<'severity' | 'frequency'>(
    userSettings?.weatherCodeMode ?? 'severity'
  );
  const [modeStatus, setModeStatus] = useState<SaveStatus>({ kind: 'idle' });
```

`useEffect` の `setPendingMode` 行も削除（enabledJmaGroups の `setEnabled` は残す）:

変更前:
```ts
  useEffect(() => {
    if (userSettings?.enabledJmaGroups) {
      setEnabled(userSettings.enabledJmaGroups);
    }
    if (userSettings?.weatherCodeMode) {
      setPendingMode(userSettings.weatherCodeMode);
    }
  }, [userSettings]);
```

変更後:
```ts
  useEffect(() => {
    if (userSettings?.enabledJmaGroups) {
      setEnabled(userSettings.enabledJmaGroups);
    }
  }, [userSettings]);
```

- [ ] **Step 2: 天気アイコン表示設定セクションの JSX を更新する（JmaWarningSettings.tsx:179-232行付近）**

変更前（ボタン・保存ボタン周辺）:
```tsx
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setPendingMode('severity')}
            className="secondary"
            style={{
              padding: '0.5rem 1rem',
              background: pendingMode === 'severity' ? 'rgba(244,167,185,0.45)' : undefined,
              color: pendingMode === 'severity' ? '#7a2840' : undefined,
            }}
          >
            悪い天気を優先
          </button>
          <button
            onClick={() => setPendingMode('frequency')}
            className="secondary"
            style={{
              padding: '0.5rem 1rem',
              background: pendingMode === 'frequency' ? 'rgba(244,167,185,0.45)' : undefined,
              color: pendingMode === 'frequency' ? '#7a2840' : undefined,
            }}
          >
            多い天気を優先
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          午前・午後・夜間に表示される天気のルールです。
        </p>
        <ul style={{ margin: 0, padding: '0 0 0 1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>「悪い天気を優先」　時間帯内で最も荒れた天気を表示（守り重視）</li>
          <li>「多い天気を優先」　時間帯内で最も多い天気を表示（実態重視）</li>
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
          {modeStatus.kind !== 'idle' && (
            <span style={{...}}>
              {modeStatus.kind === 'saving' ? '保存中…' : modeStatus.msg}
            </span>
          )}
          <button onClick={async () => { /* await updateWeatherCodeMode(pendingMode) ... */ }}>
            保存
          </button>
        </div>
```

変更後（`currentMode` を直接参照、即時保存、保存ボタン廃止）:
```tsx
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => updateWeatherCodeMode('severity')}
            className="secondary"
            style={{
              padding: '0.5rem 1rem',
              background: currentMode === 'severity' ? 'rgba(244,167,185,0.45)' : undefined,
              color: currentMode === 'severity' ? '#7a2840' : undefined,
            }}
          >
            リスクを優先
          </button>
          <button
            onClick={() => updateWeatherCodeMode('frequency')}
            className="secondary"
            style={{
              padding: '0.5rem 1rem',
              background: currentMode === 'frequency' ? 'rgba(244,167,185,0.45)' : undefined,
              color: currentMode === 'frequency' ? '#7a2840' : undefined,
            }}
          >
            概況を優先
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          午前・午後・夜間に表示される天気のルールです。
        </p>
        <ul style={{ margin: 0, padding: '0 0 0 1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>「リスクを優先」　時間帯内で最も荒れた天気を表示（守り重視）</li>
          <li>「概況を優先」　時間帯内で最も多い天気を表示（実態重視）</li>
        </ul>
```

`currentMode` の定義をコンポーネント内に追加する（`useAppStore` のデストラクチャリング直下）:
```ts
  const currentMode = userSettings?.weatherCodeMode ?? 'severity';
```

- [ ] **Step 3: 完全ビルドを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーゼロ。

---

### Task 10: dev server で動作確認 + commit & push

- [ ] **Step 1: dev server で動作確認する**

```bash
npm run dev
```

確認項目:
- 「空もよう」タブ → 日別予報ブロック右上に [リスクを優先] [概況を優先] ボタンが表示される
- デフォルトで「リスクを優先」がアクティブ（薄赤背景）
- 「概況を優先」クリック → アイコンが即時切り替わる（数秒待たない）
- 晴れ時々雨のような混在日に、メインアイコンとは異なるミニアイコンが下に表示される
- 「あの日の空」タブにも同じトグルが表示され、「空もよう」と連動して切り替わる
- 設定 → 天気情報タブのトグルも「リスクを優先 / 概況を優先」に変わっており、即時保存（保存ボタンが不要に）

- [ ] **Step 2: コミットする**

```bash
git add src/api/forecast.ts src/api/historicalForecast.ts
git commit -m "refactor(forecast): DailyForecastDataをamCodes[]配列方式に変更しmode依存を廃止"

git add src/hooks/useForecast.ts src/hooks/useHistoricalForecast.ts src/store.ts
git commit -m "refactor(hooks): キャッシュキーからmodeを除去・updateWeatherCodeModeを楽観的更新に変更"

git add src/components/weather/DailyForecast.tsx
git commit -m "feat(ui): DailyForecastにweatherCodeMode propを追加しミニアイコン表示を実装"

git add src/components/weather/WeatherTab.tsx src/components/weather/HistoricalWeatherTab.tsx src/App.tsx
git commit -m "feat(ui): 空もよう・あの日の空タブにリスク/概況トグルボタンを追加"

git add src/components/settings/JmaWarningSettings.tsx
git commit -m "feat(settings): 天気アイコン設定ラベルをリスクを優先/概況を優先に統一・即時保存化"
```

- [ ] **Step 3: push する**

```bash
git push
```

期待: Cloudflare Pages のビルドが成功する。
