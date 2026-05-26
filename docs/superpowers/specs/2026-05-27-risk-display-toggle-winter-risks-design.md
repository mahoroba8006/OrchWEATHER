# リスク表示制御＋冬リスク追加 設計仕様

**作成日:** 2026-05-27
**ステータス:** 承認済み

---

## 概要

3つの機能を一括実装する。いずれも `RiskThresholds` を中心に変更が収束するため、単一フェーズで扱う。

1. **アイコン追加**：WeatherSettings の各リスク行の先頭に既存 `RISK_BADGES` のアイコンを表示する
2. **表示要否トグル**：リスクごとにチェックボックスで ON/OFF を制御。OFF にしたリスクはアプリ全体（RiskSummary・DailyForecast 含む）から非表示になる
3. **冬リスク追加**：降雪（積雪量 cm 以上）・低温（気温 ℃ 以下）を新規リスク種別として追加

---

## スコープ

### スコープ内

- `RiskType` に `snow`・`cold` 追加
- `RiskThresholds` に `snow`・`cold`・`enabledRisks` フィールド追加
- `RISK_BADGES` に `snow`・`cold` 追加
- 降雪・低温の検知ロジック実装（時間別・日別）
- WeatherTab でのフィルタリング（enabledRisks による app-wide 非表示）
- WeatherSettings UI：アイコン・チェックボックス・冬リスク行追加

### スコープ外

- API 変更（`snowfall`・`snowfallSum` は既存データに存在）
- Push 通知
- リスクの重み付け・優先度変更

---

## データモデル

### RiskType 拡張

```typescript
// src/lib/riskDetection.ts
export type RiskType =
  'frost' | 'thunder' | 'hail' | 'wind' | 'rain' | 'heat' | 'dry'
  | 'snow' | 'cold';  // NEW
```

### RiskThresholds（src/store.ts）

```typescript
export interface RiskThresholds {
  frost:              number;          // 霜：気温 ≤ X ℃             デフォルト: 3
  frostDewPoint:      number;          // 霜：露点温度 ≤ X ℃          デフォルト: 0  ※時間別のみ
  wind:               number;          // 強風：風速 ≥ X m/s           デフォルト: 15
  rainHourly:         number;          // 大雨：時間雨量 ≥ X mm/h      デフォルト: 30
  rainDaily:          number;          // 大雨：日雨量 ≥ X mm           デフォルト: 80
  heat:               number;          // 高温：気温 ≥ X ℃             デフォルト: 35
  dry:                number;          // 乾燥：湿度 ≤ X %             デフォルト: 30
  thunderSensitivity: RiskSensitivity; // 雷雨感度                     デフォルト: 'medium'
  hailSensitivity:    RiskSensitivity; // 雹感度                       デフォルト: 'medium'
  hailFreezingLevel:  number;          // 雹：0℃層高度 ≤ X m          デフォルト: 3500  ※時間別のみ
  snow:               number;          // 降雪：積雪量 ≥ X cm           デフォルト: 3   NEW
  cold:               number;          // 低温：気温 ≤ X ℃             デフォルト: 0   NEW
  enabledRisks:       RiskType[];      // 表示するリスク種別             デフォルト: 全9種 NEW
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  frost:              3,
  frostDewPoint:      0,
  wind:               15,
  rainHourly:         30,
  rainDaily:          80,
  heat:               35,
  dry:                30,
  thunderSensitivity: 'medium',
  hailSensitivity:    'medium',
  hailFreezingLevel:  3500,
  snow:               3,    // NEW
  cold:               0,    // NEW
  enabledRisks: [           // NEW
    'frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow',
  ],
};
```

### 入力値バリデーション範囲

| 項目 | 最小 | 最大 | ステップ |
|------|------|------|---------|
| 降雪 積雪量 | 1 cm | 30 cm | 1 |
| 低温 気温 | −15 ℃ | 5 ℃ | 0.5 |

### Firestore 構造

既存の `/users/{uid}.riskThresholds` に `snow`・`cold`・`enabledRisks` フィールドを追加するだけ。
新規サブコレクション・構造変更なし。

既存ユーザーは `getUserSettings` のマージ処理により自動的に全9種 enabled のデフォルト状態になる。

---

## RISK_BADGES 追加（riskDetection.ts）

```typescript
export const RISK_BADGES: Record<RiskType, RiskBadge> = {
  // 既存7件はそのまま...
  cold: {
    type: 'cold',
    iconFile: 'thermometer-snow',        // 霜と同アイコン・色で区別
    label: '低温',
    badgeBg:    '#d4e8fc',
    badgeColor: '#1a5276',
    borderColor:'#7ab3e0',
  },
  snow: {
    type: 'snow',
    iconFile: 'overcast-snow',
    label: '降雪',
    badgeBg:    '#e8f0f8',
    badgeColor: '#2c5f8a',
    borderColor:'#a0c4e8',
  },
};
```

---

## 表示順（RiskSummary.tsx）

`ORDERED_TYPES` は `RiskSummary.tsx` に定義されている。cold・snow を末尾に追加する。

```typescript
// src/components/weather/RiskSummary.tsx
const ORDERED_TYPES: RiskType[] = [
  'frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow',
];
```

春（霜）→ 夏（雷雨・雹・大雨・強風・高温・乾燥）→ 冬（低温・降雪）の季節順。

---

## リスク検知ロジック（riskDetection.ts）

### detectHourlyRisks への追加

```typescript
// 低温：気温 ≤ t.cold（霜とは独立。重複検知を許容）
if (h.temperature <= t.cold) { detected.push('cold'); ... }

// 降雪：積雪量 ≥ t.snow cm/h
if (h.snowfall >= t.snow) { detected.push('snow'); ... }
```

### detectDailyRisks への追加

```typescript
// 低温：最低気温 ≤ t.cold
if (day.tempMin <= t.cold) { risks.push('cold'); metrics.cold = `最低気温 ${day.tempMin.toFixed(1)}℃`; }

// 降雪：日積雪量 ≥ t.snow
if (day.snowfallSum >= t.snow) { risks.push('snow'); metrics.snow = `積雪 ${day.snowfallSum.toFixed(1)} cm`; }
```

### metrics 文字列

```
cold  →「最低気温 X.X℃」（日別）／「気温 X.X℃」（時間別）
snow  →「積雪 X.X cm」
```

### ローカルコピー更新

`riskDetection.ts` 内の `DEFAULT_RISK_THRESHOLDS` ローカルコピーに `snow: 3`・`cold: 0`・`enabledRisks: [...]` を追加。

---

## フィルタリング（WeatherTab.tsx）

`detectRisks` の結果を `enabledRisks` でフィルタし、下流の全コンポーネントへ渡す。

```typescript
const { locations, userSettings } = useAppStore();

const enabledSet = new Set(
  userSettings?.riskThresholds?.enabledRisks ?? DEFAULT_ENABLED_RISKS
);

const dayRisks = data
  ? detectRisks(data.hourly, data.daily, userSettings?.riskThresholds)
      .map(d => ({
        ...d,
        risks: d.risks.filter(r => enabledSet.has(r)),
      }))
  : [];
```

`DEFAULT_ENABLED_RISKS` は `riskDetection.ts` に定義する全9種の配列定数。
この1箇所のフィルタで `RiskSummary`・`DailyForecast` を含む全表示コンポーネントが自動的に対応する。

---

## WeatherSettings UI

### 各行の構造

```
[checkbox] [icon 18px] [リスクラベル]  [入力要素]
```

チェックボックスが最左。アイコンはラベルの直前。

### 設定行の並び順（区切り線なし）

```
[ ] 🌡 霜     気温 [  ] ℃以下  ＆  露点 [  ] ℃以下
[ ] ⚡ 雷雨   [控えめ][標準][敏感]
[ ] 🧊 雹     [控えめ][標準][敏感]  ＆  0℃層高度 [  ] m以下
[ ] 🌧 大雨   （24h雨量）[  ] mm以上  ／  （1h雨量）[  ] mm/h以上
[ ] 💨 強風   風速 [  ] m/s以上
[ ] 🌡 高温   気温 [  ] ℃以上
[ ] 💧 乾燥   湿度 [  ] %以下
[ ] 🌡 低温   気温 [  ] ℃以下
[ ] 🌨 降雪   積雪量 [  ] cm以上
```

（絵文字は概念イメージ。実際は `/icons/weather/*.svg` を使用）

### チェックボックスの挙動

| 操作 | 挙動 |
|------|------|
| チェック変更 | `enabledRisks` 配列を更新（ローカル状態）。保存ボタン押下まで Firestore 未更新 |
| 保存ボタン | 閾値・感度・enabledRisks を一括で `updateRiskThresholds` に渡す（既存フロー変更なし） |
| デフォルトに戻す | 全9種 enabled、閾値もデフォルト値にリセットして即時保存 |

### sanitiseThresholds の更新

`WeatherSettings.tsx` の `sanitiseThresholds` 関数に `snow`・`cold` のクランプ処理を追加する。

```typescript
snow: clamp(form.snow, 1, 30, DEFAULT_RISK_THRESHOLDS.snow),
cold: clamp(form.cold, -15, 5, DEFAULT_RISK_THRESHOLDS.cold),
enabledRisks: form.enabledRisks,  // 配列はそのまま（クランプ不要）
```

### handleEnabledChange の実装方針

```typescript
const handleEnabledChange = (type: RiskType, checked: boolean) => {
  setForm(prev => ({
    ...prev,
    enabledRisks: checked
      ? [...prev.enabledRisks, type]
      : prev.enabledRisks.filter(r => r !== type),
  }));
};
```

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `src/store.ts` | 変更 | `RiskType`（snow・cold追加）、`RiskThresholds`（3フィールド追加）、`DEFAULT_RISK_THRESHOLDS` 更新 |
| `src/lib/userRepository.ts` | 変更 | ローカルコピー `DEFAULT_RISK_THRESHOLDS` 更新（snow・cold・enabledRisks追加） |
| `src/lib/riskDetection.ts` | 変更 | `RiskType` 更新、`RISK_BADGES` 2件追加、snow/cold 検知ロジック追加、ローカルコピー更新、`DEFAULT_ENABLED_RISKS` 定数追加 |
| `src/components/weather/WeatherTab.tsx` | 変更 | `enabledRisks` フィルタリング追加（約5行） |
| `src/components/weather/RiskSummary.tsx` | 変更 | `ORDERED_TYPES` 更新（cold・snow 追加） |
| `src/components/settings/WeatherSettings.tsx` | 変更 | アイコン表示・チェックボックス・low/snow 入力行 追加、行順変更 |
