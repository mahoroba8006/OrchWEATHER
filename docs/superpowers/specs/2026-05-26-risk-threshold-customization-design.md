# リスク閾値カスタマイズ 設計仕様

**作成日:** 2026-05-26
**ステータス:** 承認済み

---

## 概要

ユーザーが「あの時の状況に近い条件になったら通知したい」というニーズに対応するため、
リスク検知の閾値をユーザーごとにカスタマイズできる設定UIを実装する。

Push通知の配信インフラは別フェーズ。本フェーズでは「通知条件の定義UI」のみを実装する。

---

## スコープ

### スコープ内

- リスク閾値の Firestore 永続化
- `riskDetection.ts` への閾値パラメータ注入
- WeatherSettings.tsx への設定UI実装

### スコープ外

- Push通知（PWA Service Worker / Firebase Cloud Messaging）
- アプリ内ヘルプ・値の解説ページ（別途フェーズ）

---

## 対象リスク種別

| リスク | カスタマイズ方式 | 備考 |
|--------|----------------|------|
| 霜     | 数値入力 | 時間別・日別で同一閾値を適用 |
| 強風   | 数値入力 | 時間別・日別で同一閾値を適用 |
| 大雨   | 数値入力（時間雨量・日雨量を別設定） | 夕立型と長雨型を区別 |
| 高温   | 数値入力 | 時間別・日別で同一閾値を適用 |
| 乾燥   | 数値入力 | 時間別・日別で同一閾値を適用 |
| 雷雨   | 感度スライダー（控えめ/標準/敏感） | CAPE閾値に内部マッピング |
| 雹     | 感度スライダー（控えめ/標準/敏感） | CAPE閾値に内部マッピング |

**日別予報の雷雨・雹（WMOコード 95〜99）は変更なし。**
感度スライダーは時間別判定の CAPE 閾値のみに効く。

---

## データモデル

### TypeScript 型定義

```typescript
// src/store.ts に追加
export type RiskSensitivity = 'low' | 'medium' | 'high';

export interface RiskThresholds {
  frost:              number;          // 霜：気温閾値 ℃     デフォルト: 3
  wind:               number;          // 強風：風速閾値 m/s  デフォルト: 15
  rainHourly:         number;          // 大雨：時間雨量 mm/h デフォルト: 30
  rainDaily:          number;          // 大雨：日雨量 mm     デフォルト: 80
  heat:               number;          // 高温：気温閾値 ℃    デフォルト: 35
  dry:                number;          // 乾燥：湿度閾値 %    デフォルト: 30
  thunderSensitivity: RiskSensitivity; // 雷雨感度            デフォルト: 'medium'
  hailSensitivity:    RiskSensitivity; // 雹感度              デフォルト: 'medium'
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  frost:              3,
  wind:               15,
  rainHourly:         30,
  rainDaily:          80,
  heat:               35,
  dry:                30,
  thunderSensitivity: 'medium',
  hailSensitivity:    'medium',
};

// 既存 UserSettings に追加
export interface UserSettings {
  baseTempSettings:      [number, number];
  accumStartDates:       AccumStartDates;
  accumDeltaThresholds:  AccumDeltaThresholds;
  riskThresholds:        RiskThresholds;        // NEW
}
```

### 感度 → CAPE マッピング（内部定数）

| 感度ラベル | 表示名   | 雷雨 CAPE (J/kg) | 雹 CAPE (J/kg) |
|-----------|---------|-----------------|----------------|
| low       | 控えめ   | ≥ 1000          | ≥ 2000         |
| medium    | 標準     | ≥ 500           | ≥ 1000         |
| high      | 敏感     | ≥ 250           | ≥ 500          |

### 入力値バリデーション範囲

| 項目              | 最小    | 最大     | ステップ |
|------------------|--------|---------|---------|
| 霜 気温           | −5 ℃   | 5 ℃    | 0.5     |
| 強風 風速          | 5 m/s  | 30 m/s  | 1       |
| 大雨 時間雨量      | 10 mm/h| 100 mm/h| 5       |
| 大雨 日雨量        | 20 mm  | 300 mm  | 10      |
| 高温 気温          | 28 ℃   | 42 ℃   | 0.5     |
| 乾燥 湿度          | 10 %   | 60 %    | 5       |

### Firestore 構造

既存の `/users/{uid}` ドキュメントに `riskThresholds` フィールドを追加するだけ。
新規サブコレクションや構造変更なし。

```
/users/{uid}
  - createdAt
  - baseTempSettings
  - accumStartDates
  - accumDeltaThresholds
  - riskThresholds          ← NEW（上記 RiskThresholds オブジェクト）
```

---

## riskDetection.ts 変更方針

### 関数シグネチャ変更

```typescript
// 変更前
export function detectRisks(
  hourly: HourlyForecast[],
  daily: DailyForecastData[]
): DayRisk[]

// 変更後
export function detectRisks(
  hourly: HourlyForecast[],
  daily: DailyForecastData[],
  thresholds?: RiskThresholds   // 省略時は DEFAULT_RISK_THRESHOLDS にフォールバック
): DayRisk[]
```

### 内部実装

```typescript
const t = { ...DEFAULT_RISK_THRESHOLDS, ...thresholds };

const THUNDER_CAPE_MAP: Record<RiskSensitivity, number> = {
  low: 1000, medium: 500, high: 250
};
const HAIL_CAPE_MAP: Record<RiskSensitivity, number> = {
  low: 2000, medium: 1000, high: 500
};
const thunderCape = THUNDER_CAPE_MAP[t.thunderSensitivity];
const hailCape    = HAIL_CAPE_MAP[t.hailSensitivity];
```

### ハードコード値の置き換え

| 判定 | 変更前 | 変更後 |
|------|--------|--------|
| 霜（時間別） | `h.temperature <= 3` | `h.temperature <= t.frost` |
| 雷雨（時間別） | `h.cape >= 500` | `h.cape >= thunderCape` |
| 雹（時間別） | `h.cape >= 1000` | `h.cape >= hailCape` |
| 強風（時間別） | `h.windSpeed >= 15` | `h.windSpeed >= t.wind` |
| 大雨（時間別） | `h.precipitation >= 30` | `h.precipitation >= t.rainHourly` |
| 高温（時間別） | `h.temperature >= 35` | `h.temperature >= t.heat` |
| 乾燥（時間別） | `h.humidity <= 30` | `h.humidity <= t.dry` |
| 霜（日別） | `day.tempMin <= 3` | `day.tempMin <= t.frost` |
| 強風（日別） | `day.windSpeedMax >= 15` | `day.windSpeedMax >= t.wind` |
| 大雨（日別） | `day.precipSum >= 80` | `day.precipSum >= t.rainDaily` |
| 高温（日別） | `day.tempMax >= 35` | `day.tempMax >= t.heat` |
| 乾燥（日別） | `day.humidMin <= 30` | `day.humidMin <= t.dry` |

### 呼び出し側（WeatherTab.tsx）

`detectRisks` は `App.tsx` ではなく `WeatherTab.tsx` で呼ばれている。
`useAppStore` はすでにインポート済みなので `userSettings` を追加で取得するだけ。

```typescript
// WeatherTab.tsx
const { locations, userSettings } = useAppStore();

// 変更前
const dayRisks = data ? detectRisks(data.hourly, data.daily) : [];

// 変更後
const dayRisks = data
  ? detectRisks(data.hourly, data.daily, userSettings?.riskThresholds)
  : [];
```

---

## WeatherSettings UI

### レイアウト

1つの `glass-panel` に全8設定をまとめる。

```
┌─ glass-panel ──────────────────────────────────────────┐
│ h3: リスク検知の閾値                                      │
│                                                         │
│  ┌──────────────────┐  ┌───────────────────┐           │
│  │ 霜  気温 ≤         │  │ 高温 気温 ≥         │           │
│  │ [  3.0  ] ℃      │  │ [ 35.0  ] ℃       │           │
│  └──────────────────┘  └───────────────────┘           │
│  ┌──────────────────┐  ┌───────────────────┐           │
│  │ 強風 風速 ≥        │  │ 乾燥 湿度 ≤         │           │
│  │ [ 15  ] m/s      │  │ [ 30  ] %          │           │
│  └──────────────────┘  └───────────────────┘           │
│  ┌──────────────────┐  ┌───────────────────┐           │
│  │ 大雨 時間雨量 ≥    │  │ 大雨 日雨量 ≥       │           │
│  │ [ 30  ] mm/h     │  │ [ 80  ] mm         │           │
│  └──────────────────┘  └───────────────────┘           │
│                                                         │
│  ─────────────────────────────────────────             │
│                                                         │
│  雷雨感度  [控えめ]  [標準 ✓]  [敏感]                      │
│  雹 感度   [控えめ]  [標準 ✓]  [敏感]                      │
│                                                         │
│  [デフォルトに戻す]                      [保存]            │
└─────────────────────────────────────────────────────────┘
```

### 挙動

| 操作 | 挙動 |
|------|------|
| 数値入力変更 | ローカル状態のみ更新（未保存） |
| 感度トグル変更 | ローカル状態のみ更新（未保存） |
| 「保存」ボタン押下 | NaN・範囲外をクランプ → Firestore setDoc → 「保存しました」フィードバック（2.5秒） |
| 「デフォルトに戻す」押下 | DEFAULT_RISK_THRESHOLDS でフォーム書き換え → 即時 Firestore 保存 |
| ページ離脱（未保存） | 警告なし（AnalysisSettings と同仕様） |

### SaveStatus フィードバック

AnalysisSettings と同一の `SaveStatus` 型（idle / saving / saved / error）を使用。

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `src/store.ts` | 変更 | `RiskSensitivity`・`RiskThresholds`・`DEFAULT_RISK_THRESHOLDS` 追加、`UserSettings` に `riskThresholds` 追加、`updateRiskThresholds` アクション追加 |
| `src/lib/userRepository.ts` | 変更 | `DEFAULT_RISK_THRESHOLDS` 追加、`getUserSettings` のマージ処理に `riskThresholds` 追加、`updateRiskThresholds` 関数追加 |
| `src/lib/riskDetection.ts` | 変更 | `detectRisks` にthresholdsパラメータ追加、ハードコード値を置き換え |
| `src/components/weather/WeatherTab.tsx` | 変更 | `useAppStore` から `userSettings` を追加取得、`detectRisks` 呼び出しに `userSettings?.riskThresholds` を渡す |
| `src/components/settings/WeatherSettings.tsx` | 全面書き換え | プレースホルダーを実装に置き換え |
