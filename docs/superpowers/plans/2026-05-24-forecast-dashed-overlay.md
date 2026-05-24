# 10日間予報点線オーバーレイ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分析タブの全7チャートに Open-Meteo 予報 API（既存 `useForecast`）の今後10日分データを点線で重ね描きする

**Architecture:** `src/api/forecast.ts` に `sunshine_duration` を追加 → `src/App.tsx` の `baseChartData` / `gddData` 両 useMemo 内に予報オーバーレイを統合（targets[0] かつ今年のみ）→ 各チャートに `strokeDasharray="5 4"` の `<Line>` を追加。月次モードでは非表示。

**Tech Stack:** React 19 + TypeScript, Recharts（ComposedChart / Line / Bar）, 既存 `useForecast` hook

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/api/forecast.ts` | **Modify** | `DailyForecastData` に `sunshineDuration` 追加、API パラメータに `sunshine_duration` 追加 |
| `src/App.tsx` | **Modify** | `useForecast` 呼び出し、`baseChartData` / `gddData` にオーバーレイ統合、7チャートに予報 Line 追加、凡例更新 |

---

## データキー命名規則

| キー名 | 意味 |
|---|---|
| `forecast_temp_max_<id>` | 予報最高気温 (℃) |
| `forecast_temp_min_<id>` | 予報最低気温 (℃) |
| `forecast_accum_precip_<id>` | 予報累積降水量 (mm) |
| `forecast_accum_sunshine_<id>` | 予報累積日照時間 (h) |
| `forecast_accum_radiation_<id>` | 予報累積日射量 (MJ/m²) |
| `forecast_accum_gdd_<id>` | 予報累積GDD (℃) |
| `forecast_humid_min_<id>` | 予報最低湿度 (%) |
| `forecast_vpd_max_<id>` | 予報最高飽差 (g/m³) |

※ 累積チャート（降水・日照・日射・GDD）は **累積ラインのみ** 点線で表示（日次バーの追加は行わない）。  
※ 今日以前の Historical API 末尾（昨日）は実線で終端し、今日から点線が始まる。

---

## Task 1: `forecast.ts` に sunshine_duration を追加

**Files:**
- Modify: `src/api/forecast.ts`

- [ ] **Step 1: `DailyForecastData` インターフェースに `sunshineDuration` を追加**

`src/api/forecast.ts` の `DailyForecastData` インターフェースの末尾（`windSpeedMax` の直後）に追加：

```typescript
  sunshineDuration: number;  // h（日照時間、秒→時間に変換済み）
```

- [ ] **Step 2: `dailyParams` に `sunshine_duration` を追加**

`fetchForecast` 内の `dailyParams` を修正：

```typescript
  const dailyParams = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_probability_max',
    'precipitation_sum', 'relative_humidity_2m_min',
    'sunrise', 'sunset',
    'shortwave_radiation_sum', 'snowfall_sum', 'wind_speed_10m_max',
    'sunshine_duration',
  ].join(',');
```

- [ ] **Step 3: daily マッピング配列に `sunshineDuration` を追加**

`fetchForecast` 内の `daily` マッピング（`(raw.daily.time as string[]).map(...)` の中）で、`windSpeedMax` の直後に追加：

```typescript
    sunshineDuration: (raw.daily.sunshine_duration?.[i] ?? 0) / 3600,
```

- [ ] **Step 4: 動作確認（型チェック）**

```
cd c:\dev\気象アプリ
npx tsc --noEmit
```

TypeScript エラーなしで通ることを確認。

- [ ] **Step 5: コミット**

```
git add src/api/forecast.ts
git commit -m "feat: add sunshineDuration to DailyForecastData and forecast API params"
```

---

## Task 2: App.tsx に useForecast を追加し、currentYear・currentTargetHasForecast を定義

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: `useForecast` の import を追加**

`src/App.tsx` の既存 import 群に追加（`useWeatherData` の import 行の近く）：

```typescript
import { useForecast } from './hooks/useForecast';
```

- [ ] **Step 2: `currentYear` 定数を App 関数内に追加**

`App()` 関数内、`const [topTab, setTopTab]` 宣言の直後に追加：

```typescript
  const currentYear = new Date().getFullYear();
```

- [ ] **Step 3: `forecastLoc` useMemo を追加**

`const { data: weatherData, loading, error } = useWeatherData(targets);` の直後に追加：

```typescript
  // 分析タブ用予報データ（targets[0] の地点のみ取得）
  const forecastLoc = useMemo(() => {
    const t = targets[0];
    if (!t) return null;
    const loc = locations.find(l => l.id === t.locationId);
    return loc ? { lat: loc.lat, lon: loc.lon } : null;
  }, [targets, locations]);

  const { data: forecastData } = useForecast(
    forecastLoc?.lat ?? null,
    forecastLoc?.lon ?? null,
  );
```

- [ ] **Step 4: `currentTargetHasForecast` 変数を追加**

`const isMonthly = chartViewMode === 'monthly';` の直後に追加：

```typescript
  // 日次モード + 今年 + 予報取得済み の3条件が揃ったとき点線オーバーレイを表示
  const currentTargetHasForecast =
    !isMonthly && !!forecastData && targets[0]?.year === currentYear;
```

- [ ] **Step 5: 型チェック**

```
npx tsc --noEmit
```

エラーなし確認。

- [ ] **Step 6: コミット**

```
git add src/App.tsx
git commit -m "feat: wire useForecast into analysis tab for dashed forecast overlay"
```

---

## Task 3: baseChartData useMemo に予報データを統合

**Files:**
- Modify: `src/App.tsx`（`baseChartData` useMemo）

- [ ] **Step 1: `baseChartData` の useMemo に予報ループを追加**

`baseChartData` useMemo 内の `targets.forEach((target, index) => { ... })` コールバックを以下のように修正する。**追加位置は `// 12/31：12月と翌年1月の中間値` ブロックの直後（`});` の直前）**：

```typescript
      // ── 予報オーバーレイ（targets[0] + 今年のみ） ──────────────────────────
      if (index === 0 && forecastData && target.year === currentYear) {
        forecastData.daily.forEach(fDay => {
          const mmdd = fDay.date.slice(5); // "YYYY-MM-DD" → "MM-DD"

          if (!map.has(mmdd)) {
            map.set(mmdd, { dateStr: mmdd });
          }
          const entry = map.get(mmdd)!;

          // 基本指標（点線 Line 用）
          entry[`forecast_temp_max_${target.id}`]  = fDay.tempMax;
          entry[`forecast_temp_min_${target.id}`]  = fDay.tempMin;
          entry[`forecast_humid_min_${target.id}`] = fDay.humidMin;
          entry[`forecast_vpd_max_${target.id}`]   = calcVPD(fDay.tempMax, fDay.humidMin);

          // 累積系（前の accumXxxRunning 変数が履歴ループ後の最終値を保持している）
          if (mmdd >= precipStart) {
            accumPrecipRunning += fDay.precipSum;
            entry[`forecast_accum_precip_${target.id}`] = accumPrecipRunning;
          }
          if (mmdd >= sunshineStart) {
            accumSunshineRunning += fDay.sunshineDuration;
            entry[`forecast_accum_sunshine_${target.id}`] = accumSunshineRunning;
          }
          if (mmdd >= radiationStart) {
            accumRadiationRunning += fDay.radiationSum;
            entry[`forecast_accum_radiation_${target.id}`] = accumRadiationRunning;
          }
        });
      }
```

- [ ] **Step 2: `baseChartData` の依存配列に `forecastData` / `currentYear` を追加**

useMemo の deps 配列を修正：

```typescript
  }, [weatherData, targets, userSettings, forecastData, currentYear]);
```

- [ ] **Step 3: 型チェック**

```
npx tsc --noEmit
```

エラーなし確認。

- [ ] **Step 4: コミット**

```
git add src/App.tsx
git commit -m "feat: integrate forecast data into baseChartData useMemo (temp/precip/sunshine/radiation/humid/vpd)"
```

---

## Task 4: gddData useMemo に予報GDDを統合

**Files:**
- Modify: `src/App.tsx`（`gddData` useMemo）

- [ ] **Step 1: `gddData` useMemo に予報GDDループを追加**

`gddData` useMemo 内の `targets.forEach((target) => { ... })` コールバックで、`seriesByTarget.set(target.id, series);` の直後に追加：

```typescript
      // ── 予報GDD累積（targets[0] + 今年のみ） ────────────────────────────────
      if (targets[0]?.id === target.id && forecastData && target.year === currentYear) {
        let forecastGddRunning = runningAccumTemp; // 昨日時点の累積GDD

        forecastData.daily.forEach(fDay => {
          const mmdd = fDay.date.slice(5); // "YYYY-MM-DD" → "MM-DD"
          const existing = overlay.get(mmdd) ?? {};

          if (mmdd >= gddStart) {
            const tempMean = (fDay.tempMax + fDay.tempMin) / 2;
            const diff = tempMean - selectedBaseTemp;
            const dailyGdd = diff > 0 ? diff : 0;
            forecastGddRunning += dailyGdd;
            existing[`forecast_accum_gdd_${target.id}`] = forecastGddRunning;
          }
          overlay.set(mmdd, existing);
        });
      }
```

- [ ] **Step 2: `gddData` の依存配列に `forecastData` / `currentYear` を追加**

```typescript
  }, [weatherData, targets, userSettings, selectedBaseTempIndex, forecastData, currentYear]);
```

- [ ] **Step 3: 型チェック**

```
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```
git add src/App.tsx
git commit -m "feat: integrate forecast GDD into gddData useMemo"
```

---

## Task 5: 気温チャートに予報点線を追加

**Files:**
- Modify: `src/App.tsx`（気温セクション）

- [ ] **Step 1: 気温チャートの `targets.map` ブロックに予報 Line を追加**

気温チャートの `targets.map((target, index) => { ... return (<React.Fragment>...</React.Fragment>); })` の `</React.Fragment>` 閉じタグの直前に追加：

```tsx
                          {/* 10日予報（点線） */}
                          {currentTargetHasForecast && index === 0 && (
                            <>
                              <Line
                                type="monotone"
                                dataKey={`forecast_temp_max_${target.id}`}
                                name={`${getLocationName(target.locationId)} ${target.year}年 予報最高気温`}
                                stroke={color}
                                strokeWidth={1.5}
                                strokeDasharray="5 4"
                                dot={false}
                                connectNulls={false}
                                isAnimationActive={false}
                              />
                              <Line
                                type="monotone"
                                dataKey={`forecast_temp_min_${target.id}`}
                                name={`${getLocationName(target.locationId)} ${target.year}年 予報最低気温`}
                                stroke={color}
                                strokeWidth={1.5}
                                strokeDasharray="5 4"
                                dot={false}
                                connectNulls={false}
                                isAnimationActive={false}
                              />
                            </>
                          )}
```

- [ ] **Step 2: 気温チャートの `renderCustomLegend` 呼び出しを更新**

```tsx
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月間平均', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
```

- [ ] **Step 3: 型チェック**

```
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```
git add src/App.tsx
git commit -m "feat: add forecast dashed lines to temperature chart"
```

---

## Task 6: 降水量チャートに予報点線を追加

**Files:**
- Modify: `src/App.tsx`（降水量セクション）

- [ ] **Step 1: 降水量チャートの累積 Line `targets.map` の直後に予報 Line を追加**

累積降水量 Line の `targets.map` ブロック（`key={accumPrecip_${target.id}}`）の閉じ `})}` の直後に追加：

```tsx
                    {/* 10日予報累積降水量（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_precip_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予報累積降水`}
                          stroke={getYearColor(0, 'var(--chart-precip)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
```

- [ ] **Step 2: 降水量チャートの `renderCustomLegend` を更新**

```tsx
              {renderCustomLegend(isMonthly ? [
                { label: '月間降水量', type: 'thick-bar' },
                { label: '累積降水量', type: 'solid' }
              ] : [
                { label: '降水量', type: 'thin-bar' },
                { label: '月間降水量', type: 'thick-bar' },
                { label: '累積降水量', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
```

- [ ] **Step 3: 型チェック**

```
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```
git add src/App.tsx
git commit -m "feat: add forecast dashed line to precipitation chart"
```

---

## Task 7: 日照時間チャートに予報点線を追加

**Files:**
- Modify: `src/App.tsx`（日照時間セクション）

- [ ] **Step 1: 日照時間チャートの累積 Line ブロックの直後に予報 Line を追加**

累積日照時間 Line の `targets.map` ブロック（`key={accumSunshine_${target.id}}`）の閉じ `})}` の直後に追加：

```tsx
                    {/* 10日予報累積日照時間（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_sunshine_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予報累積日照`}
                          stroke={getYearColor(0, 'var(--chart-sunshine)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
```

- [ ] **Step 2: 日照時間チャートの `renderCustomLegend` を更新**

```tsx
              {renderCustomLegend([
                { label: '日照時間', type: 'thin-bar' },
                { label: '累積日照時間', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
```

- [ ] **Step 3: 型チェック & コミット**

```
npx tsc --noEmit
git add src/App.tsx
git commit -m "feat: add forecast dashed line to sunshine duration chart"
```

---

## Task 8: 日射量チャートに予報点線を追加

**Files:**
- Modify: `src/App.tsx`（日射量セクション）

- [ ] **Step 1: 日射量チャートの累積 Line ブロックの直後に予報 Line を追加**

累積日射量 Line の `targets.map` ブロック（`key={accumRadiation_${target.id}}`）の閉じ `})}` の直後に追加：

```tsx
                    {/* 10日予報累積日射量（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_radiation_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予報累積日射`}
                          stroke={getYearColor(0, 'var(--chart-sunshine)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
```

- [ ] **Step 2: `renderCustomLegend` を更新**

```tsx
              {renderCustomLegend([
                { label: '日射量', type: 'thin-bar' },
                { label: '累積日射量', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
```

- [ ] **Step 3: 型チェック & コミット**

```
npx tsc --noEmit
git add src/App.tsx
git commit -m "feat: add forecast dashed line to solar radiation chart"
```

---

## Task 9: GDDチャートに予報点線を追加

**Files:**
- Modify: `src/App.tsx`（GDD セクション）

- [ ] **Step 1: GDDチャートの累積 Line ブロックの直後に予報 Line を追加**

累積GDD Line の `targets.map` ブロック（`key={accum_${target.id}}`）の閉じ `})}` の直後に追加：

```tsx
                    {/* 10日予報累積GDD（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_gdd_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予報累積積算`}
                          stroke={getYearColor(0, 'var(--chart-sunshine)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
```

- [ ] **Step 2: `renderCustomLegend` を更新**

```tsx
              {renderCustomLegend([
                { label: '有効積算温度', type: 'thin-bar' },
                { label: '累積有効積算温度', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
```

- [ ] **Step 3: 型チェック & コミット**

```
npx tsc --noEmit
git add src/App.tsx
git commit -m "feat: add forecast dashed line to GDD chart"
```

---

## Task 10: 湿度チャートに予報点線を追加

**Files:**
- Modify: `src/App.tsx`（湿度セクション）

- [ ] **Step 1: 湿度チャートの `targets.map` 内 `</React.Fragment>` 直前に予報 Line を追加**

```tsx
                          {/* 10日予報最低湿度（点線） */}
                          {currentTargetHasForecast && index === 0 && (
                            <Line
                              type="monotone"
                              dataKey={`forecast_humid_min_${target.id}`}
                              name={`${getLocationName(target.locationId)} ${target.year}年 予報最低湿度`}
                              stroke={color}
                              strokeWidth={1.5}
                              strokeDasharray="5 4"
                              dot={false}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          )}
```

- [ ] **Step 2: `renderCustomLegend` を更新**

```tsx
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月間平均', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報最低湿度', type: 'dashed' as const }] : []),
              ])}
```

- [ ] **Step 3: 型チェック & コミット**

```
npx tsc --noEmit
git add src/App.tsx
git commit -m "feat: add forecast dashed line to humidity chart"
```

---

## Task 11: 飽差チャートに予報点線を追加

**Files:**
- Modify: `src/App.tsx`（飽差セクション）

- [ ] **Step 1: 飽差チャートの `targets.map` 内 `</React.Fragment>` 直前に予報 Line を追加**

```tsx
                          {/* 10日予報最高飽差（点線） */}
                          {currentTargetHasForecast && index === 0 && (
                            <Line
                              type="monotone"
                              dataKey={`forecast_vpd_max_${target.id}`}
                              name={`${getLocationName(target.locationId)} ${target.year}年 予報最高飽差`}
                              stroke={color}
                              strokeWidth={1.5}
                              strokeDasharray="5 4"
                              dot={false}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          )}
```

- [ ] **Step 2: `renderCustomLegend` を更新**

```tsx
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月平均最高飽差', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報最高飽差', type: 'dashed' as const }] : []),
              ])}
```

- [ ] **Step 3: 型チェック & コミット**

```
npx tsc --noEmit
git add src/App.tsx
git commit -m "feat: add forecast dashed line to VPD chart"
```

---

## Task 12: 動作確認・最終コミット

- [ ] **Step 1: dev サーバー起動**

```
cd c:\dev\気象アプリ
npm run dev
```

- [ ] **Step 2: ブラウザで以下を確認**

1. 分析タブ → 日次モード → 基準ターゲットが **今年** の場合  
   → 全7チャートに、実線ラインの末尾から続く **点線** が表示される  
   → 点線は今後10日分（今日〜10日後の MM-DD）  
   → 凡例に「10日予報」ダッシュが追加されている

2. ターゲットを **今年以外**（例：2024年）に変更  
   → 点線は表示されない（`currentTargetHasForecast = false`）

3. 表示単位を **月次** に切り替え  
   → 点線は表示されない（`isMonthly = true`）

4. 表示期間を今日の月が **含まれない範囲**（例：1月〜3月、今が5月）に絞る  
   → 点線は表示されない（`filteredBaseChartData` に今日以降の MM-DD が含まれないため）

- [ ] **Step 3: `tasks/lessons.md` に教訓を追記**（もし問題が発生した場合のみ）

- [ ] **Step 4: 最終コミット**

```
git add -A
git commit -m "feat: add 10-day forecast dashed overlay to all analysis charts

- forecast_temp_max/min: dashed lines on temperature chart
- forecast_accum_precip/sunshine/radiation/gdd: dashed cumulative lines
- forecast_humid_min: dashed line on humidity chart
- forecast_vpd_max: dashed line on VPD chart
- Monthly mode and non-current-year targets: overlay hidden
- Legend updated with '10日予報' entry when overlay is active
- sunshine_duration added to forecast API params"
git push origin main
```

---

## 注意事項・既知の制限

- **年またぎ（12月末〜1月）**: 今日が12月下旬の場合、予報の「01-xx」エントリが MM-DD ソートで年始（左端）に移動する。発生頻度が低く UX への影響も限定的なため、初期実装では未対処。
- **Historical API 障害中**: 分析タブの過去データは Open-Meteo Historical API が復旧するまで取得できない。予報点線のみのテストは、天気タブで予報データの取得が正常であることを確認してから行う。
- **sunshineとradiationのY軸**: 予報累積ラインは既存の `yAxisId="right"` を共有するため、Y軸スケールは既存の実線と自動調整される。
