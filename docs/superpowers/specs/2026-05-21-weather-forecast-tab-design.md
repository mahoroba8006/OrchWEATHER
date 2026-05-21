# 天気情報タブ 設計書

**作成日:** 2026-05-21  
**ステータス:** 承認待ち

---

## 概要

OrchWEATHER に「天気情報」タブを新設する。  
選択中の地点について今後10日間の予報と72時間の時間別詳細を表示し、農作業現場で必要な7種類のリスク（霜・雷雨・雹・強風・大雨・高温・乾燥）を自動検出して注意喚起する。

---

## 決定事項まとめ

| 項目 | 決定 |
|---|---|
| 粒度 | ハイブリッド：日別 11日（今日〜10日後）＋ 時間別 72時間 |
| 地点 | 1地点。上部セレクターで切替 |
| デフォルトタブ | 天気情報（アプリ起動時） |
| 更新戦略 | タブ表示時に自動取得。TTL 30分。手動更新ボタン付き |
| 空状態 | 地点未登録時は案内メッセージ＋分析タブへの誘導 |
| モバイル | PCと同一の横スクロール |
| 高温アイコン | ☀ + 赤CSS グロー（`color:#c0392b; filter:drop-shadow(0 0 6px #f87171)`） |

---

## レイアウト構造

```
[App Header]
[トップタブバー: 天気情報 | 分析]
[地点セレクター] [最終更新: HH:MM ↻]

① 日別エリア（横スクロール 11列）
② 注意喚起サマリ（リスク発生時のみ）
③ 時間別エリア（横スクロール 72列）
```

### ① 日別カード構造（1列 = 1日）

```
日にち            ← 常に表示
天気アイコン      ← 常に表示（WMO → 絵文字）
最高 / 最低気温   ← 常に表示
降水確率          ← 常に表示
─────────────────
リスクバッジ      ← リスク発生日のみ
コメント          ← リスク発生日のみ
```

今日の列は薄青背景（`#f8fbff`）でハイライト。  
リスク発生日は淡ウォームグレー（`#fafaf6`）背景。

### ② 注意喚起サマリ

リスク1件 = カード1枚。左ボーダー色でリスク種別を識別。  
複数リスクは縦に並べる。リスクがゼロの場合はこのセクション自体を非表示。

### ③ 時間別スプレッド表

左列固定（変数ラベル）、右を横スクロール（72時間）。  
リスク該当セルは背景 `#fafaf6` ＋ 値を太字で強調。

**表示変数（行）:**

| 行 | 変数 | 単位 |
|---|---|---|
| 時刻 | time | - |
| 天気 | weather_code → 絵文字 | - |
| 気温 | temperature_2m | ℃ |
| 降水 | precipitation | mm |
| 降水確率 | precipitation_probability | % |
| 露点 | dew_point_2m | ℃ |
| 湿度 | relative_humidity_2m | % |
| 風速 | wind_speed_10m | m/s |
| 突風 | wind_gusts_10m | m/s |
| CAPE | cape | J/kg |
| 0℃層高度 | freezinglevel_height | m |
| 気圧 | pressure_msl | hPa |

---

## データ層

### APIエンドポイント

**ベースURL:** `https://api.open-meteo.com/v1/forecast`

**パラメータ:**
```
latitude={lat}&longitude={lon}
&timezone=Asia/Tokyo
&models=jma_seamless
&forecast_days=11
&forecast_hours=72
&hourly=temperature_2m,precipitation,precipitation_probability,
        dew_point_2m,relative_humidity_2m,
        wind_speed_10m,wind_gusts_10m,
        cape,freezinglevel_height,pressure_msl,
        weather_code,shortwave_radiation,snowfall
&daily=weather_code,temperature_2m_max,temperature_2m_min,
       precipitation_probability_max,
       sunrise,sunset,
       shortwave_radiation_sum,snowfall_sum,wind_gusts_10m_max
```

### 型定義

```typescript
interface HourlyForecast {
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

interface DailyForecastData {
  date: string;             // "2026-05-21"
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipProbMax: number;    // %
  sunrise: string;          // "2026-05-21T04:43"
  sunset: string;           // "2026-05-21T18:52"
  radiationSum: number;     // MJ/m²
  snowfallSum: number;      // cm
  windGustsMax: number;     // m/s
}

interface ForecastData {
  hourly: HourlyForecast[];     // 72エントリ
  daily: DailyForecastData[];   // 11エントリ
  fetchedAt: number;            // Date.now()（TTL計算用）
}
```

### キャッシュ戦略（useForecast.ts）

```typescript
const CACHE_TTL = 30 * 60 * 1000; // 30分
const forecastCache = new Map<string, { data: ForecastData; fetchedAt: number }>();
// キー: "${lat},${lon}"
// TTL内: キャッシュ返却
// 期限切れ or refresh(): 再フェッチ
```

戻り値: `{ data, loading, error, lastUpdated: Date | null, refresh: () => void }`

---

## リスク検出ロジック（riskDetection.ts）

### 7リスクの判定条件

| リスク | 判定（時間別データから） | バッジ | バッジ背景 | サマリカード左ボーダー |
|---|---|---|---|---|
| ❄ 霜 | dewPoint ≤ 0℃ AND temperature ≤ 3℃ | ❄ | #fcefc4 | #e6c478 |
| ⚡ 雷雨 | cape ≥ 1000 OR weatherCode 95–99 | ⚡ | #f7d4cf | #d99c93 |
| 🧊 雹 | cape ≥ 1500 AND freezingLevel ≤ 3500 | 🧊 | #f3d4e3 | #d693b3 |
| 💨 強風 | windGusts ≥ 15 m/s | 💨 | #dee0ef | #9aa1bf |
| 🌊 大雨 | precipitation ≥ 30 mm（1時間） | 🌊 | #e6dff0 | #ab98c8 |
| ☀ 高温 | temperature ≥ 35℃ | ☀* | #fcdcc4 | #d39867 |
| 🌵 乾燥 | humidity ≤ 30% | 🌵 | #ece6d4 | #b8a878 |

*高温バッジの ☀ には `color:#c0392b; filter:drop-shadow(0 0 6px #f87171)` を適用する。

### コメント自動生成ルール

```typescript
function buildComment(risks: RiskType[]): string {
  if (risks.includes('thunder') || risks.includes('hail') ||
      risks.includes('wind') || risks.includes('rain')) return '荒天';
  if (risks.includes('heat') && risks.includes('dry')) return '猛暑＋乾燥';
  if (risks.includes('heat')) return '猛暑日';
  if (risks.includes('frost')) return '早朝 霜';
  if (risks.includes('dry'))   return '乾燥注意';
  return '';
}

// 時間帯付きコメント例: "午後 荒天", "早朝 霜"
// 時間帯は risk が発生した最初の時刻から判定:
//   0–9時 → "早朝", 10–14時 → "昼", 15–18時 → "午後", 19–23時 → "夜"
```

### 日別カードへの集約

各日の hourly データ（0〜23時）をスキャンし、該当リスクが1件でも検出されたらバッジ＋コメントを表示。

---

## WMOコード → 絵文字マッピング

```typescript
function weatherCodeToEmoji(code: number): string {
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
```

---

## ファイル構成（案A：最小侵襲）

### 新規ファイル（7つ）

```
src/
├── api/
│   └── forecast.ts
├── lib/
│   └── riskDetection.ts
├── hooks/
│   └── useForecast.ts
└── components/weather/
    ├── WeatherTab.tsx
    ├── DailyForecast.tsx
    ├── RiskSummary.tsx
    └── HourlyTable.tsx
```

### App.tsx 変更（約30行）

1. `topTab` state 追加: `useState<'weather' | 'analysis'>('weather')`
2. ヘッダー直下にトップタブバー追加
3. 既存 `<main>` を `{topTab === 'analysis' && (...)}` で囲む
4. `{topTab === 'weather' && <WeatherTab />}` を追加

**既存の分析ロジック（1785行）は一切変更しない。**

### 各コンポーネントの責務

| ファイル | 責務 |
|---|---|
| `forecast.ts` | Open-Meteo API フェッチ・型変換 |
| `riskDetection.ts` | 時間別データからリスク検出・コメント生成 |
| `useForecast.ts` | フェッチ + TTL 30分キャッシュ + `refresh()` |
| `WeatherTab.tsx` | 地点セレクター・更新UI・空状態・子コンポーネント配置 |
| `DailyForecast.tsx` | 横スクロール日別カード11枚 |
| `RiskSummary.tsx` | 注意喚起カード（リスクゼロ時は非表示） |
| `HourlyTable.tsx` | 左列固定・72時間スプレッド表 |

---

## エラー・空状態の扱い

| 状況 | 表示 |
|---|---|
| 地点未登録 | 「地点を登録すると予報が表示されます」＋分析タブへのリンク |
| API取得失敗 | 「予報データを取得できませんでした。↻ で再試行」 |
| ロード中 | スピナー（既存デザインに合わせる） |
| JMA seamless が該当地点未対応 | フォールバックなし（エラー扱い） |

---

## 非機能要件

- **パフォーマンス:** 予報フェッチは分析データとは独立。タブ表示時に初回フェッチ（遅延ロード）
- **キャッシュ:** モジュールレベルの Map（`weatherCache` と同パターン）、TTL 30分
- **型安全:** TypeScript strict。`null` チェックを徹底
- **リグレッション:** 分析タブの既存コードを変更しないため、分析機能への影響はゼロ
