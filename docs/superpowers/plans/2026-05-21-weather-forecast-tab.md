# 天気情報タブ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OrchWEATHER に「天気情報」タブを新設し、1地点の11日間日別予報・7種類リスク自動検出・72時間時間別スプレッド表を表示する。

**Architecture:** 7つの新規ファイル（API層→検出ロジック→フックス→コンポーネント4つ）を積み上げ式に追加し、App.tsx に約30行の変更でタブ切替を実装する。既存の分析コードは一切変更しない。

**Tech Stack:** React 19 + TypeScript (strict) + Vite + Zustand + lucide-react + Open-Meteo forecast API / インラインCSS（Tailwind なし）

> **テスト方針:** プロジェクトにテストフレームワーク未導入のため、各タスクの検証は `npm run build`（TypeScript コンパイル確認）と `npm run dev` での目視確認で行う。

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---|---|---|
| `src/api/forecast.ts` | 新規作成 | Open-Meteo fetch・型定義 |
| `src/lib/riskDetection.ts` | 新規作成 | 7リスク検出・WMO絵文字マップ・コメント生成 |
| `src/hooks/useForecast.ts` | 新規作成 | TTL 30分キャッシュ付き予報フック |
| `src/components/weather/DailyForecast.tsx` | 新規作成 | 11日間横スクロールカード |
| `src/components/weather/RiskSummary.tsx` | 新規作成 | 注意喚起カード（リスクゼロ時は非表示） |
| `src/components/weather/HourlyTable.tsx` | 新規作成 | 左列固定・72時間スプレッド表 |
| `src/components/weather/WeatherTab.tsx` | 新規作成 | 地点セレクター・更新UI・空状態・子コンポーネント配置 |
| `src/App.tsx` | 変更（約30行） | topTab state 追加・タブバー追加・条件付きレンダリング |

---

## Task 1: forecast.ts — API型定義とフェッチ関数

**Files:**
- Create: `src/api/forecast.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
// src/api/forecast.ts

export interface HourlyForecast {
  time: string;          // "2026-05-21T15:00"
  temperature: number;   // ℃
  precipitation: number; // mm
  precipProb: number;    // %
  dewPoint: number;      // ℃
  humidity: number;      // %
  windSpeed: number;     // m/s
  windGusts: number;     // m/s
  cape: number;          // J/kg
  freezingLevel: number; // m
  pressure: number;      // hPa
  weatherCode: number;   // WMO code
  radiation: number;     // W/m²
  snowfall: number;      // cm
}

export interface DailyForecastData {
  date: string;          // "2026-05-21"
  weatherCode: number;
  tempMax: number;       // ℃
  tempMin: number;       // ℃
  precipProbMax: number; // %
  precipSum: number;     // mm
  humidMin: number;      // %
  sunrise: string;       // "2026-05-21T04:43"
  sunset: string;        // "2026-05-21T18:52"
  radiationSum: number;  // MJ/m²
  snowfallSum: number;   // cm
  windGustsMax: number;  // m/s
}

export interface ForecastData {
  hourly: HourlyForecast[];    // 72エントリ
  daily: DailyForecastData[];  // 11エントリ
  fetchedAt: number;           // Date.now()
}

export async function fetchForecast(lat: number, lon: number): Promise<ForecastData> {
  const hourlyParams = [
    'temperature_2m', 'precipitation', 'precipitation_probability',
    'dew_point_2m', 'relative_humidity_2m',
    'wind_speed_10m', 'wind_gusts_10m',
    'cape', 'freezinglevel_height', 'pressure_msl',
    'weather_code', 'shortwave_radiation', 'snowfall',
  ].join(',');

  const dailyParams = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_probability_max',
    'precipitation_sum', 'relative_humidity_2m_min',
    'sunrise', 'sunset',
    'shortwave_radiation_sum', 'snowfall_sum', 'wind_gusts_10m_max',
  ].join(',');

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lon}`
    + '&timezone=Asia%2FTokyo'
    + '&models=jma_seamless,best_match'
    + '&forecast_days=11'
    + '&forecast_hours=72'
    + `&hourly=${hourlyParams}`
    + `&daily=${dailyParams}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`予報データの取得に失敗しました (${res.status})`);
  const raw = await res.json();

  const hourly: HourlyForecast[] = (raw.hourly.time as string[]).map((t: string, i: number) => ({
    time: t,
    temperature:   raw.hourly.temperature_2m[i]             ?? 0,
    precipitation: raw.hourly.precipitation[i]               ?? 0,
    precipProb:    raw.hourly.precipitation_probability[i]   ?? 0,
    dewPoint:      raw.hourly.dew_point_2m[i]                ?? 0,
    humidity:      raw.hourly.relative_humidity_2m[i]        ?? 0,
    windSpeed:     raw.hourly.wind_speed_10m[i]              ?? 0,
    windGusts:     raw.hourly.wind_gusts_10m[i]              ?? 0,
    cape:          raw.hourly.cape[i]                         ?? 0,
    freezingLevel: raw.hourly.freezinglevel_height[i]        ?? 9999,
    pressure:      raw.hourly.pressure_msl[i]                ?? 1013,
    weatherCode:   raw.hourly.weather_code[i]                ?? 0,
    radiation:     raw.hourly.shortwave_radiation[i]         ?? 0,
    snowfall:      raw.hourly.snowfall[i]                    ?? 0,
  }));

  const daily: DailyForecastData[] = (raw.daily.time as string[]).map((t: string, i: number) => ({
    date:          t,
    weatherCode:   raw.daily.weather_code[i]                   ?? 0,
    tempMax:       raw.daily.temperature_2m_max[i]             ?? 0,
    tempMin:       raw.daily.temperature_2m_min[i]             ?? 0,
    precipProbMax: raw.daily.precipitation_probability_max[i]  ?? 0,
    precipSum:     raw.daily.precipitation_sum[i]              ?? 0,
    humidMin:      raw.daily.relative_humidity_2m_min[i]       ?? 100,
    sunrise:       raw.daily.sunrise[i]                        ?? '',
    sunset:        raw.daily.sunset[i]                         ?? '',
    radiationSum:  raw.daily.shortwave_radiation_sum[i]        ?? 0,
    snowfallSum:   raw.daily.snowfall_sum[i]                   ?? 0,
    windGustsMax:  raw.daily.wind_gusts_10m_max[i]             ?? 0,
  }));

  return { hourly, daily, fetchedAt: Date.now() };
}
```

- [ ] **Step 2: ビルドで型確認**

```
npm run build
```

期待: エラーなし（警告は許容）

- [ ] **Step 3: コミット**

```bash
git add src/api/forecast.ts
git commit -m "feat: add forecast API types and fetch function (Open-Meteo)"
```

---

## Task 2: riskDetection.ts — 7リスク検出ロジック

**Files:**
- Create: `src/lib/riskDetection.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
// src/lib/riskDetection.ts
import type { HourlyForecast, DailyForecastData } from '../api/forecast';

export type RiskType = 'frost' | 'thunder' | 'hail' | 'wind' | 'rain' | 'heat' | 'dry';

export interface DayRisk {
  date: string;
  risks: RiskType[];
  comment: string;
}

export interface RiskBadge {
  type: RiskType;
  emoji: string;
  label: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
}

export const RISK_BADGES: Record<RiskType, RiskBadge> = {
  frost:   { type: 'frost',   emoji: '❄',  label: '霜',   badgeBg: '#fcefc4', badgeColor: '#a07825', borderColor: '#e6c478' },
  thunder: { type: 'thunder', emoji: '⚡', label: '雷雨', badgeBg: '#f7d4cf', badgeColor: '#a35047', borderColor: '#d99c93' },
  hail:    { type: 'hail',    emoji: '🧊', label: '雹',   badgeBg: '#f3d4e3', badgeColor: '#9c456e', borderColor: '#d693b3' },
  wind:    { type: 'wind',    emoji: '💨', label: '強風', badgeBg: '#dee0ef', badgeColor: '#5c6385', borderColor: '#9aa1bf' },
  rain:    { type: 'rain',    emoji: '🌊', label: '大雨', badgeBg: '#e6dff0', badgeColor: '#634b85', borderColor: '#ab98c8' },
  heat:    { type: 'heat',    emoji: '☀',  label: '高温', badgeBg: '#fcdcc4', badgeColor: '#c0392b', borderColor: '#d39867' },
  dry:     { type: 'dry',     emoji: '🌵', label: '乾燥', badgeBg: '#ece6d4', badgeColor: '#766a3f', borderColor: '#b8a878' },
};

// WMO weather code → 絵文字
export function weatherCodeToEmoji(code: number): string {
  if (code === 0)                      return '☀️';
  if (code <= 2)                       return '🌤️';
  if (code === 3)                      return '☁️';
  if (code === 45 || code === 48)      return '🌫️';
  if (code >= 51 && code <= 55)        return '🌦️';
  if (code >= 61 && code <= 65)        return '🌧️';
  if (code >= 71 && code <= 75)        return '❄️';
  if (code >= 80 && code <= 82)        return '🌦️';
  if (code >= 85 && code <= 86)        return '🌨️';
  if (code === 95)                     return '⛈️';
  if (code === 96 || code === 99)      return '⛈️';
  return '🌡️';
}

function getTimePrefix(hour: number): string {
  if (hour <= 9)  return '早朝';
  if (hour <= 14) return '昼';
  if (hour <= 18) return '午後';
  return '夜';
}

function buildComment(risks: RiskType[], firstHour?: number): string {
  if (risks.includes('thunder') || risks.includes('hail') || risks.includes('wind') || risks.includes('rain')) {
    const prefix = firstHour !== undefined ? getTimePrefix(firstHour) : '';
    return prefix ? `${prefix} 荒天` : '荒天';
  }
  if (risks.includes('heat') && risks.includes('dry')) return '猛暑＋乾燥';
  if (risks.includes('heat')) return '猛暑日';
  if (risks.includes('frost')) return '早朝 霜';
  if (risks.includes('dry')) return '乾燥注意';
  return '';
}

// 日0-2: hourly 精密判定
function detectHourlyRisks(hours: HourlyForecast[]): { risks: RiskType[]; firstHour: number | undefined } {
  const riskSet = new Set<RiskType>();
  let firstHour: number | undefined;

  for (const h of hours) {
    const hour = parseInt(h.time.slice(11, 13), 10);
    const detected: RiskType[] = [];

    if (h.dewPoint <= 0 && h.temperature <= 3)         detected.push('frost');
    if (h.cape >= 500 || (h.weatherCode >= 95 && h.weatherCode <= 99)) detected.push('thunder');
    if (h.cape >= 1000 && h.freezingLevel <= 3500)     detected.push('hail');
    if (h.windGusts >= 15)                             detected.push('wind');
    if (h.precipitation >= 30)                         detected.push('rain');
    if (h.temperature >= 35)                           detected.push('heat');
    if (h.humidity <= 30)                              detected.push('dry');

    if (detected.length > 0) {
      if (firstHour === undefined) firstHour = hour;
      detected.forEach(r => riskSet.add(r));
    }
  }

  return { risks: Array.from(riskSet), firstHour };
}

// 日3-10: daily 代替判定
function detectDailyRisks(day: DailyForecastData): RiskType[] {
  const risks: RiskType[] = [];
  if (day.tempMin <= 3)                                           risks.push('frost');
  if (day.weatherCode >= 95 && day.weatherCode <= 99)            risks.push('thunder');
  if (day.weatherCode === 96 || day.weatherCode === 99)          risks.push('hail');
  if (day.windGustsMax >= 15)                                     risks.push('wind');
  if (day.precipSum >= 80)                                        risks.push('rain');
  if (day.tempMax >= 35)                                          risks.push('heat');
  if (day.humidMin <= 30)                                         risks.push('dry');
  return risks;
}

/**
 * 全11日分のリスクを判定して返す。
 * hourly データが存在する日（日0-2）は精密判定、それ以外は daily 代替判定。
 */
export function detectRisks(hourly: HourlyForecast[], daily: DailyForecastData[]): DayRisk[] {
  return daily.map((day) => {
    const dayHours = hourly.filter(h => h.time.slice(0, 10) === day.date);

    if (dayHours.length > 0) {
      const { risks, firstHour } = detectHourlyRisks(dayHours);
      return { date: day.date, risks, comment: buildComment(risks, firstHour) };
    } else {
      const risks = detectDailyRisks(day);
      return { date: day.date, risks, comment: buildComment(risks) };
    }
  });
}
```

- [ ] **Step 2: ビルドで型確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/riskDetection.ts
git commit -m "feat: add 7-risk detection logic and WMO emoji map"
```

---

## Task 3: useForecast.ts — TTL 30分キャッシュフック

**Files:**
- Create: `src/hooks/useForecast.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
// src/hooks/useForecast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchForecast, type ForecastData } from '../api/forecast';

const CACHE_TTL = 30 * 60 * 1000; // 30分
const forecastCache = new Map<string, { data: ForecastData; fetchedAt: number }>();

export function useForecast(lat: number | null, lon: number | null) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // stale レスポンスを無視するために、最後にリクエストしたキーを追跡する
  const activeKey = useRef<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (lat === null || lon === null) {
      setData(null);
      return;
    }
    const key = `${lat},${lon}`;
    activeKey.current = key;

    if (!force) {
      const cached = forecastCache.get(key);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        setData(cached.data);
        setLastUpdated(new Date(cached.fetchedAt));
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchForecast(lat, lon);
      if (activeKey.current !== key) return; // stale
      forecastCache.set(key, { data: result, fetchedAt: result.fetchedAt });
      setData(result);
      setLastUpdated(new Date(result.fetchedAt));
    } catch (err: unknown) {
      if (activeKey.current === key) {
        const message = err instanceof Error ? err.message : '予報データを取得できませんでした';
        setError(message);
      }
    } finally {
      if (activeKey.current === key) {
        setLoading(false);
      }
    }
  }, [lat, lon]);

  // lat/lon 変更時は既存データをクリアして再フェッチ
  useEffect(() => {
    setData(null);
    setLastUpdated(null);
    setError(null);
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, error, lastUpdated, refresh };
}
```

- [ ] **Step 2: ビルドで型確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/hooks/useForecast.ts
git commit -m "feat: add useForecast hook with 30min TTL cache"
```

---

## Task 4: DailyForecast.tsx — 11日間横スクロールカード

**Files:**
- Create: `src/components/weather/DailyForecast.tsx`

- [ ] **Step 1: ディレクトリとファイルを作成する**

まず `src/components/weather/` ディレクトリが存在するか確認してから作成する。

```tsx
// src/components/weather/DailyForecast.tsx
import React from 'react';
import type { DailyForecastData } from '../../api/forecast';
import type { DayRisk } from '../../lib/riskDetection';
import { RISK_BADGES, weatherCodeToEmoji } from '../../lib/riskDetection';

interface Props {
  daily: DailyForecastData[];
  dayRisks: DayRisk[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function DailyForecast({ daily, dayRisks }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ padding: '0.9rem 1rem 0.4rem', fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em' }}>
        日別 ／ 今日〜10日後
      </div>
      <div style={{ overflowX: 'auto', background: '#fff', borderTop: '1px solid #ebeef5', borderBottom: '1px solid #ebeef5' }}>
        <div style={{ display: 'inline-flex' }}>
          {daily.map((day, i) => {
            const riskDay = dayRisks.find(r => r.date === day.date);
            const hasRisk = riskDay !== undefined && riskDay.risks.length > 0;
            const isToday = day.date === today;
            // JST の日付文字列（"YYYY-MM-DD"）を直接パース（UTC変換しない）
            const dow = new Date(`${day.date}T00:00:00`).getDay();
            const mm = parseInt(day.date.slice(5, 7), 10);
            const dd = parseInt(day.date.slice(8, 10), 10);
            const dayLabel = isToday
              ? `今日 ${mm}/${dd}`
              : `${mm}/${dd} (${DAY_NAMES[dow]})`;

            return (
              <div
                key={day.date}
                style={{
                  width: 96,
                  borderRight: i < daily.length - 1 ? '1px solid #f3f4f8' : undefined,
                  padding: '0.6rem 0.25rem',
                  textAlign: 'center',
                  background: isToday ? '#f8fbff' : hasRisk ? '#fafaf6' : undefined,
                  flexShrink: 0,
                }}
              >
                <div style={{
                  fontSize: '0.72rem',
                  color: isToday ? '#5e8ad1' : '#5b6478',
                  fontWeight: isToday ? 600 : undefined,
                }}>
                  {dayLabel}
                </div>
                <div style={{ fontSize: '2rem', margin: '0.3rem 0', lineHeight: 1 }}>
                  {weatherCodeToEmoji(day.weatherCode)}
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                  <span style={{ color: '#e08a7f', fontWeight: 600 }}>{Math.round(day.tempMax)}</span>
                  {' / '}
                  <span style={{ color: '#7da6d9' }}>{Math.round(day.tempMin)}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a8aebc', marginTop: '0.25rem' }}>
                  降水 {day.precipProbMax}%
                </div>
                {hasRisk && riskDay && (
                  <>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      {riskDay.risks.map(r => {
                        const badge = RISK_BADGES[r];
                        return (
                          <span
                            key={r}
                            style={{
                              fontSize: '0.6rem',
                              background: badge.badgeBg,
                              color: r === 'heat' ? '#c0392b' : badge.badgeColor,
                              borderRadius: 3,
                              padding: '1px 4px',
                              ...(r === 'heat' ? { filter: 'drop-shadow(0 0 3px #f87171)' } : {}),
                            }}
                          >
                            {badge.emoji}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#7a5d20', marginTop: '0.2rem' }}>
                      {riskDay.comment}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ビルドで型確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/weather/DailyForecast.tsx
git commit -m "feat: add DailyForecast component (11-day horizontal scroll)"
```

---

## Task 5: RiskSummary.tsx — 注意喚起カード

**Files:**
- Create: `src/components/weather/RiskSummary.tsx`

- [ ] **Step 1: ファイルを作成する**

```tsx
// src/components/weather/RiskSummary.tsx
import React from 'react';
import type { DayRisk, RiskType } from '../../lib/riskDetection';
import { RISK_BADGES } from '../../lib/riskDetection';

interface Props {
  dayRisks: DayRisk[];
}

export function RiskSummary({ dayRisks }: Props) {
  const riskyDays = dayRisks.filter(d => d.risks.length > 0);
  if (riskyDays.length === 0) return null;

  // リスク種別ごとに発生日をまとめる
  const riskTypeMap = new Map<RiskType, string[]>();
  for (const day of riskyDays) {
    for (const r of day.risks) {
      if (!riskTypeMap.has(r)) riskTypeMap.set(r, []);
      riskTypeMap.get(r)!.push(day.date);
    }
  }

  // RISK_BADGES の定義順（frost→thunder→hail→wind→rain→heat→dry）で表示
  const orderedTypes: RiskType[] = ['frost', 'thunder', 'hail', 'wind', 'rain', 'heat', 'dry'];

  return (
    <div style={{ padding: '0.6rem 1rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
        注意喚起
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {orderedTypes.filter(t => riskTypeMap.has(t)).map(riskType => {
          const badge = RISK_BADGES[riskType];
          const dates = riskTypeMap.get(riskType)!;
          const dateLabels = dates.map(d => {
            const mm = parseInt(d.slice(5, 7), 10);
            const dd = parseInt(d.slice(8, 10), 10);
            return `${mm}/${dd}`;
          }).join(', ');

          return (
            <div
              key={riskType}
              style={{
                borderLeft: `4px solid ${badge.borderColor}`,
                background: badge.badgeBg,
                borderRadius: '0 6px 6px 0',
                padding: '0.45rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{
                fontSize: '1.2rem',
                ...(riskType === 'heat'
                  ? { color: '#c0392b', filter: 'drop-shadow(0 0 6px #f87171)' }
                  : {}),
              }}>
                {badge.emoji}
              </span>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: badge.badgeColor }}>
                  {badge.label}リスク
                </span>
                <span style={{ fontSize: '0.8rem', color: '#5b6478', marginLeft: '0.5rem' }}>
                  {dateLabels}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ビルドで型確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/weather/RiskSummary.tsx
git commit -m "feat: add RiskSummary component (risk alert cards)"
```

---

## Task 6: HourlyTable.tsx — 72時間スプレッド表

**Files:**
- Create: `src/components/weather/HourlyTable.tsx`

- [ ] **Step 1: ファイルを作成する**

```tsx
// src/components/weather/HourlyTable.tsx
import React from 'react';
import type { HourlyForecast } from '../../api/forecast';
import { weatherCodeToEmoji } from '../../lib/riskDetection';

interface Props {
  hourly: HourlyForecast[];
}

const ROWS: {
  key: string;
  label: string;
  fmt: (h: HourlyForecast) => string;
  isRisk: (h: HourlyForecast) => boolean;
}[] = [
  {
    key: 'time',
    label: '時刻',
    fmt: h => h.time.slice(11, 16),
    isRisk: () => false,
  },
  {
    key: 'weather',
    label: '天気',
    fmt: h => weatherCodeToEmoji(h.weatherCode),
    isRisk: () => false,
  },
  {
    key: 'temperature',
    label: '気温(℃)',
    fmt: h => h.temperature.toFixed(1),
    isRisk: h => h.temperature >= 35 || h.temperature <= 3,
  },
  {
    key: 'precip',
    label: '降水(mm)',
    fmt: h => h.precipitation.toFixed(1),
    isRisk: h => h.precipitation >= 30,
  },
  {
    key: 'precipProb',
    label: '降水確率(%)',
    fmt: h => String(h.precipProb),
    isRisk: () => false,
  },
  {
    key: 'dewPoint',
    label: '露点(℃)',
    fmt: h => h.dewPoint.toFixed(1),
    isRisk: h => h.dewPoint <= 0,
  },
  {
    key: 'humidity',
    label: '湿度(%)',
    fmt: h => String(h.humidity),
    isRisk: h => h.humidity <= 30,
  },
  {
    key: 'windSpeed',
    label: '風速(m/s)',
    fmt: h => h.windSpeed.toFixed(1),
    isRisk: () => false,
  },
  {
    key: 'windGusts',
    label: '突風(m/s)',
    fmt: h => h.windGusts.toFixed(1),
    isRisk: h => h.windGusts >= 15,
  },
  {
    key: 'cape',
    label: 'CAPE(J/kg)',
    fmt: h => Math.round(h.cape).toString(),
    isRisk: h => h.cape >= 500,
  },
  {
    key: 'freezing',
    label: '0℃層高度(m)',
    fmt: h => Math.round(h.freezingLevel).toString(),
    isRisk: h => h.freezingLevel <= 3500 && h.cape >= 1000,
  },
  {
    key: 'pressure',
    label: '気圧(hPa)',
    fmt: h => h.pressure.toFixed(1),
    isRisk: () => false,
  },
];

export function HourlyTable({ hourly }: Props) {
  return (
    <div>
      <div style={{ padding: '0.9rem 1rem 0.4rem', fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em' }}>
        時間別 ／ 72時間
      </div>
      <div
        style={{
          overflowX: 'auto',
          touchAction: 'pan-x', // モバイル縦スクロールとの干渉を防ぐ
          background: '#fff',
          borderTop: '1px solid #ebeef5',
          borderBottom: '1px solid #ebeef5',
        }}
      >
        <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.key} style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: '#f8f9fc',
                    padding: '0.3rem 0.6rem',
                    fontWeight: 500,
                    color: '#5b6478',
                    borderRight: '1px solid #ebeef5',
                    zIndex: 1,
                    minWidth: 90,
                  }}
                >
                  {row.label}
                </td>
                {hourly.map((h, i) => {
                  const risk = row.isRisk(h);
                  return (
                    <td
                      key={i}
                      style={{
                        padding: '0.3rem 0.4rem',
                        textAlign: 'center',
                        background: risk ? '#fafaf6' : undefined,
                        fontWeight: risk ? 700 : undefined,
                        minWidth: 50,
                        color: '#4b5563',
                      }}
                    >
                      {row.fmt(h)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ビルドで型確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/weather/HourlyTable.tsx
git commit -m "feat: add HourlyTable component (72h spread with sticky labels)"
```

---

## Task 7: WeatherTab.tsx — 天気情報タブ最上位コンポーネント

**Files:**
- Create: `src/components/weather/WeatherTab.tsx`

- [ ] **Step 1: ファイルを作成する**

```tsx
// src/components/weather/WeatherTab.tsx
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store';
import { useForecast } from '../../hooks/useForecast';
import { detectRisks } from '../../lib/riskDetection';
import { DailyForecast } from './DailyForecast';
import { RiskSummary } from './RiskSummary';
import { HourlyTable } from './HourlyTable';

export function WeatherTab() {
  const { locations } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // selectedLocationId が未設定の場合は最初の地点にフォールバック
  const location = locations.find(l => l.id === selectedLocationId) ?? locations[0] ?? null;

  const { data, loading, error, lastUpdated, refresh } = useForecast(
    location?.lat ?? null,
    location?.lon ?? null,
  );

  // 地点未登録
  if (locations.length === 0) {
    return (
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '4rem 1rem',
        textAlign: 'center',
        color: '#8a93a6',
      }}>
        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          地点を登録すると予報が表示されます
        </p>
        <p style={{ fontSize: '0.85rem' }}>
          「分析」タブの設定から地点を追加してください
        </p>
      </div>
    );
  }

  const timeStr = lastUpdated
    ? `${String(lastUpdated.getHours()).padStart(2, '0')}:${String(lastUpdated.getMinutes()).padStart(2, '0')}`
    : null;

  const dayRisks = data ? detectRisks(data.hourly, data.daily) : [];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 地点セレクター + 更新UI */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1rem',
        background: '#fff',
        borderBottom: '1px solid #ebeef5',
        flexWrap: 'wrap',
      }}>
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{
            fontSize: '0.85rem',
            padding: '0.25rem 0.5rem',
            borderRadius: 6,
            border: '1px solid #d4d8e4',
            color: '#37445e',
          }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        {timeStr && (
          <span style={{ fontSize: '0.78rem', color: '#a8aebc' }}>
            最終更新: {timeStr}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.65rem',
            fontSize: '0.78rem',
            border: '1px solid #d4d8e4',
            borderRadius: 6,
            background: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: '#5b6478',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={13} />
          更新
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div style={{ padding: '1rem', color: '#c0392b', fontSize: '0.85rem', textAlign: 'center', background: '#fff9f8' }}>
          {error}。↻ で再試行してください。
        </div>
      )}

      {/* ローディング（初回のみ、データ未取得時） */}
      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#8a93a6' }}>
          取得中...
        </div>
      )}

      {/* コンテンツ */}
      {data && (
        <>
          <DailyForecast daily={data.daily} dayRisks={dayRisks} />
          <RiskSummary dayRisks={dayRisks} />
          <HourlyTable hourly={data.hourly} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルドで型確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/weather/WeatherTab.tsx
git commit -m "feat: add WeatherTab component (location selector, loading/error states)"
```

---

## Task 8: App.tsx 統合 — トップタブバー追加

**Files:**
- Modify: `src/App.tsx:1` (import 追加)
- Modify: `src/App.tsx:99` (topTab state 追加)
- Modify: `src/App.tsx:1074` (return 内にタブバー・条件レンダー追加)

> **注意:** App.tsx は1785行の大きなファイル。最小限の変更（3箇所）のみ行う。

- [ ] **Step 1: WeatherTab の import を追加する**

`src/App.tsx` の既存 import ブロック末尾（`import './App.css';` の直前）に追加する：

```tsx
import { WeatherTab } from './components/weather/WeatherTab';
```

現在の該当箇所（11行目付近）:
```tsx
import { ensureUserDocument } from './lib/userRepository';
import './App.css';
```

変更後:
```tsx
import { ensureUserDocument } from './lib/userRepository';
import { WeatherTab } from './components/weather/WeatherTab';
import './App.css';
```

- [ ] **Step 2: topTab state を追加する**

`function App()` の `useState` ブロック（約100行目付近）に追加する。
既存の最初の `useState` の直前に挿入：

現在:
```tsx
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings } = useAppStore();
  const [selectedBaseTempIndex, setSelectedBaseTempIndex] = useState<0 | 1>(0);
```

変更後:
```tsx
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings } = useAppStore();
  const [topTab, setTopTab] = useState<'weather' | 'analysis'>('weather');
  const [selectedBaseTempIndex, setSelectedBaseTempIndex] = useState<0 | 1>(0);
```

- [ ] **Step 3: return 文内にタブバーと条件レンダーを追加する**

`</header>` の直後から `<div className="app-container">` の手前を変更する。

現在（1102〜1104行目付近）:
```tsx
      </header>

      <div className="app-container">
```

変更後:
```tsx
      </header>

      {/* トップタブバー */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebeef5', display: 'flex', padding: '0 1rem', position: 'sticky', top: 64, zIndex: 40 }}>
        {(['weather', 'analysis'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setTopTab(tab)}
            style={{
              padding: '0.7rem 1.2rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${topTab === tab ? '#6c9ee0' : 'transparent'}`,
              color: topTab === tab ? '#6c9ee0' : '#8a93a6',
              fontWeight: topTab === tab ? 600 : undefined,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            {tab === 'weather' ? '天気情報' : '分析'}
          </button>
        ))}
      </div>

      {topTab === 'weather' && <WeatherTab />}

      {topTab === 'analysis' && (
      <div className="app-container">
```

- [ ] **Step 4: `</div>` の閉じタグを `}` で囲む**

現在（最後の `</div>` と `<SettingsModal>` の後）、`return` ブロック末尾の構造を確認する。

現在（1777〜1781行目付近）:
```tsx
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  </>
```

変更後:
```tsx
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
    )}
  </>
```

- [ ] **Step 5: ビルドで型確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 6: 開発サーバーで動作確認**

```
npm run dev
```

確認項目:
1. アプリ起動時にデフォルトで「天気情報」タブが選択されている
2. 「分析」タブに切り替えると既存グラフが表示される
3. 「天気情報」タブに戻ると地点セレクター＋予報データが表示される
4. 地点が登録されていない場合は案内メッセージが表示される
5. ↻ボタンで手動更新が動作する
6. 日別カードでリスクバッジが表示される（高温の☀に赤グローがある）
7. 72時間テーブルで左列が固定されてスクロールできる

- [ ] **Step 7: コミット**

```bash
git add src/App.tsx
git commit -m "feat: integrate WeatherTab with top-level tab bar in App.tsx"
```

---

## 完了チェックリスト

- [ ] `npm run build` がエラーなしで通る
- [ ] 天気情報タブがデフォルトで開く
- [ ] 11列の日別カードが横スクロールで表示される
- [ ] リスク発生日にバッジとコメントが表示される（リスクなし日は表示なし）
- [ ] 注意喚起サマリがリスクゼロ時に非表示になる
- [ ] 72時間テーブルの左ラベル列が固定されている
- [ ] リスクセルに `#fafaf6` 背景＋太字がある
- [ ] 分析タブの既存機能が正常に動作する（リグレッションなし）
- [ ] モバイルで `touch-action: pan-x` が効いて縦スクロールと干渉しない
