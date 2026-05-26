# リスク表示制御＋冬リスク追加 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** リスクの app-wide 表示ON/OFFトグル・設定画面アイコン追加・冬リスク2種（低温・降雪）を追加する。

**Architecture:** `RiskType` を `store.ts` に移動し `enabledRisks: RiskType[]` を `RiskThresholds` に追加。`detectRisks` 後に `WeatherTab.tsx` でフィルタリングし、下流コンポーネントはすべてフィルタ済みデータを受け取る。

**Tech Stack:** React 19, TypeScript, Zustand 5, Cloud Firestore (firebase 12), Vite（テストランナーなし — 型チェックは `npx tsc --noEmit`、ビルド確認は `npm run build`）

---

## ファイル構成

| ファイル | 変更内容 |
|---------|---------|
| `src/store.ts` | `RiskType` 新規定義（snow・cold 含む9種）、`RiskThresholds` に3フィールド追加、`DEFAULT_RISK_THRESHOLDS` 更新 |
| `src/lib/userRepository.ts` | ローカルコピー `DEFAULT_RISK_THRESHOLDS` に snow・cold・enabledRisks 追加 |
| `src/lib/riskDetection.ts` | 既存 `RiskType` 定義を削除して store.ts から import・re-export。`RISK_BADGES` 2件追加、snow/cold 検知追加、ローカルコピー更新 |
| `src/components/weather/WeatherTab.tsx` | `enabledRisks` フィルタリング追加（5行） |
| `src/components/weather/RiskSummary.tsx` | `ORDERED_TYPES` に cold・snow 追加 |
| `src/components/settings/WeatherSettings.tsx` | アイコン・チェックボックス・snow/cold 行追加、行順変更（全面書き換え） |

---

## Task 1: store.ts — RiskType 定義 + RiskThresholds 拡張

**Files:**
- Modify: `src/store.ts`

**背景:** `RiskType` は現在 `riskDetection.ts` に定義されているが、`RiskThresholds.enabledRisks: RiskType[]` を追加すると循環参照が発生する。`RiskType` を `store.ts` に移動して `riskDetection.ts` から import する。

- [ ] **Step 1: `RiskType` を `store.ts` に追加（`RiskSensitivity` の直後）**

`src/store.ts` の38行目（`export type RiskSensitivity = ...` の直後）に追加：

```typescript
export type RiskType =
  'frost' | 'thunder' | 'hail' | 'wind' | 'rain' | 'heat' | 'dry'
  | 'snow' | 'cold';
```

- [ ] **Step 2: `RiskThresholds` インターフェースに3フィールド追加**

`src/store.ts` の `export interface RiskThresholds` ブロック末尾（`hailFreezingLevel` の後）に追加：

```typescript
  snow:         number;          // 降雪：積雪量 ≥ X cm           デフォルト: 3   NEW
  cold:         number;          // 低温：気温 ≤ X ℃             デフォルト: 0   NEW
  enabledRisks: RiskType[];      // 表示するリスク種別             デフォルト: 全9種 NEW
```

- [ ] **Step 3: `DEFAULT_RISK_THRESHOLDS` を更新**

`src/store.ts` の `DEFAULT_RISK_THRESHOLDS` 定数（`hailFreezingLevel: 3500,` の後）に追加：

```typescript
  snow:         3,
  cold:         0,
  enabledRisks: [
    'frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow',
  ] as RiskType[],
```

- [ ] **Step 4: TypeScript 型チェック**

```bash
cd c:\dev\気象アプリ
npx tsc --noEmit
```

期待：`riskDetection.ts` に `RiskType` 不整合エラーが出る（Task 3 で修正するため想定内）。`store.ts` 自体にエラーがないことを確認。

- [ ] **Step 5: コミット**

```bash
git add src/store.ts
git commit -m "feat: add RiskType to store and extend RiskThresholds with snow/cold/enabledRisks"
```

---

## Task 2: userRepository.ts — ローカルコピー更新

**Files:**
- Modify: `src/lib/userRepository.ts`

**背景:** `userRepository.ts` は循環依存回避のため `store.ts` から値をインポートせず、`DEFAULT_RISK_THRESHOLDS` をローカルコピーしている。新フィールドを同期させる。

- [ ] **Step 1: import に `RiskType` を追加**

`src/lib/userRepository.ts` 3行目の import を以下に変更：

```typescript
import type { UserSettings, AccumStartDates, AccumDeltaThresholds, RiskThresholds, RiskType } from '../store';
```

- [ ] **Step 2: `DEFAULT_RISK_THRESHOLDS` ローカルコピーに3フィールド追加**

`src/lib/userRepository.ts` の `DEFAULT_RISK_THRESHOLDS` 定数（`hailFreezingLevel: 3500,` の後）に追加：

```typescript
  snow:         3,
  cold:         0,
  enabledRisks: [
    'frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow',
  ] as RiskType[],
```

`getUserSettings` の `riskThresholds` マージ処理（`{ ...DEFAULT_RISK_THRESHOLDS, ...(data?.riskThresholds ?? {}) }`）は既存のパターンのため変更不要。既存ユーザーの Firestore ドキュメントに `enabledRisks` が存在しない場合、デフォルト（全9種 enabled）に自動フォールバックする。

- [ ] **Step 3: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

期待：`riskDetection.ts` のエラーのみ残る（Task 3 で対処）。

- [ ] **Step 4: コミット**

```bash
git add src/lib/userRepository.ts
git commit -m "feat: update userRepository local DEFAULT_RISK_THRESHOLDS with snow/cold/enabledRisks"
```

---

## Task 3: riskDetection.ts — RiskType 移管 + snow/cold 検知追加

**Files:**
- Modify: `src/lib/riskDetection.ts`

- [ ] **Step 1: `RiskType` 定義を削除し、store.ts から import して re-export**

`src/lib/riskDetection.ts` の先頭2行を以下に置き換え：

```typescript
// src/lib/riskDetection.ts
import type { HourlyForecast, DailyForecastData } from '../api/forecast';
import type { RiskThresholds, RiskSensitivity, RiskType } from '../store';

export type { RiskType };  // 既存の consumers（RiskSummary.tsx 等）向けに re-export
```

（元の `export type RiskType = 'frost' | ...;` の行を削除）

- [ ] **Step 2: `RISK_BADGES` に `cold`・`snow` エントリを追加**

`src/lib/riskDetection.ts` の `RISK_BADGES` 定数（`dry: { ... }` の後、`};` の前）に追加：

```typescript
  cold: {
    type: 'cold',
    iconFile: 'thermometer-snow',
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
```

- [ ] **Step 3: `DEFAULT_RISK_THRESHOLDS` ローカルコピーを更新**

`src/lib/riskDetection.ts` の `DEFAULT_RISK_THRESHOLDS` 定数（`hailFreezingLevel: 3500,` の後、`};` の前）に追加：

```typescript
  snow:         3,
  cold:         0,
  enabledRisks: [
    'frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow',
  ] as RiskType[],
```

- [ ] **Step 4: `buildComment` に `cold`・`snow` のコメントを追加**

`src/lib/riskDetection.ts` の `buildComment` 関数の `if (risks.includes('dry')) return '乾燥注意';` の後に追加：

```typescript
  if (risks.includes('snow')) return '降雪注意';
  if (risks.includes('cold')) return '低温注意';
```

- [ ] **Step 5: `detectHourlyRisks` に `cold`・`snow` の追跡変数と検知を追加**

極値追跡変数（`let dryMin = Infinity;` の後）に追加：

```typescript
  let coldMinTemp = Infinity;
  let snowMax = 0;
```

ループ内の検知条件（`if (h.humidity <= t.dry)` の後）に追加：

```typescript
    if (h.temperature <= t.cold) { detected.push('cold');  if (h.temperature < coldMinTemp) coldMinTemp = h.temperature; }
    if (h.snowfall   >= t.snow)  { detected.push('snow');  if (h.snowfall    > snowMax)     snowMax     = h.snowfall;    }
```

metrics 構築部（`if (riskSet.has('dry'))` の後）に追加：

```typescript
  if (riskSet.has('cold')) metrics.cold = `気温 ${coldMinTemp.toFixed(1)}℃`;
  if (riskSet.has('snow')) metrics.snow = `積雪 ${snowMax.toFixed(1)} cm/h`;
```

- [ ] **Step 6: `detectDailyRisks` に `cold`・`snow` を追加**

`src/lib/riskDetection.ts` の `detectDailyRisks` 関数（`if (day.humidMin <= t.dry)` の後）に追加：

```typescript
  if (day.tempMin    <= t.cold)  { risks.push('cold'); metrics.cold = `最低気温 ${day.tempMin.toFixed(1)}℃`;    }
  if (day.snowfallSum >= t.snow) { risks.push('snow'); metrics.snow = `積雪 ${day.snowfallSum.toFixed(1)} cm`; }
```

- [ ] **Step 7: TypeScript 型チェック（エラーゼロを確認）**

```bash
npx tsc --noEmit
```

期待：エラー 0。`RISK_BADGES` は `Record<RiskType, RiskBadge>` 型なので `cold`・`snow` の追加が必須であり、追加済みなら型エラーは出ない。

- [ ] **Step 8: ビルド確認**

```bash
npm run build
```

期待：成功（warnings は許容、errors は不可）。

- [ ] **Step 9: コミット**

```bash
git add src/lib/riskDetection.ts
git commit -m "feat: add snow/cold risk detection and move RiskType to store"
```

---

## Task 4: WeatherTab.tsx + RiskSummary.tsx — フィルタリング＋表示順

**Files:**
- Modify: `src/components/weather/WeatherTab.tsx`
- Modify: `src/components/weather/RiskSummary.tsx`

- [ ] **Step 1: `WeatherTab.tsx` に `enabledRisks` フィルタを追加**

`src/components/weather/WeatherTab.tsx` の4行目を変更（`DEFAULT_RISK_THRESHOLDS` を追加）：

```typescript
// 変更前
import { useAppStore } from '../../store';

// 変更後
import { useAppStore, DEFAULT_RISK_THRESHOLDS } from '../../store';
```

次に、53行目の `const dayRisks = ...` を以下に置き換え：

```typescript
  const enabledSet = new Set(
    userSettings?.riskThresholds?.enabledRisks ?? DEFAULT_RISK_THRESHOLDS.enabledRisks
  );

  const dayRisks = data
    ? detectRisks(data.hourly, data.daily, userSettings?.riskThresholds)
        .map(d => ({
          ...d,
          risks: d.risks.filter(r => enabledSet.has(r)),
        }))
    : [];
```

- [ ] **Step 2: `RiskSummary.tsx` の `ORDERED_TYPES` を更新**

`src/components/weather/RiskSummary.tsx` の9行目を以下に置き換え：

```typescript
const ORDERED_TYPES: RiskType[] = ['frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow'];
```

- [ ] **Step 3: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

期待：エラー 0。

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

期待：成功。

- [ ] **Step 5: 動作確認（ブラウザ）**

`npm run dev` でアプリを起動し、以下を確認：
- 天気タブで注意情報が従来通り表示される
- DevTools > Console にエラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/weather/WeatherTab.tsx src/components/weather/RiskSummary.tsx
git commit -m "feat: filter dayRisks by enabledRisks in WeatherTab, update ORDERED_TYPES"
```

---

## Task 5: WeatherSettings.tsx — アイコン・チェックボックス・冬リスク行追加

**Files:**
- Modify: `src/components/settings/WeatherSettings.tsx`

**背景:** 全面的な書き換えとなる。チェックボックス＋アイコンを各行に追加し、行順を季節順（春→夏→冬）に変更。冬リスク2行（低温・降雪）を追加。

- [ ] **Step 1: `src/components/settings/WeatherSettings.tsx` を以下の内容で全面置き換え**

```typescript
import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import {
  useAppStore,
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
  type RiskSensitivity,
  type RiskType,
} from '../../store';
import { RISK_BADGES } from '../../lib/riskDetection';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

const SAVE_BTN: CSSProperties = {
  background: 'rgba(244,167,185,0.35)',
  color: '#7a2840',
  border: '1px solid rgba(244,167,185,0.6)',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.4rem 0.9rem',
  fontSize: '0.85rem',
};

const SENSITIVITY_LABELS: Record<RiskSensitivity, string> = {
  low:    '控えめ',
  medium: '標準',
  high:   '敏感',
};
const SENSITIVITY_OPTIONS: RiskSensitivity[] = ['low', 'medium', 'high'];

interface NumericField {
  key: keyof Pick<RiskThresholds,
    'frost' | 'frostDewPoint' | 'wind' | 'rainHourly' | 'rainDaily' |
    'heat' | 'dry' | 'hailFreezingLevel' | 'snow' | 'cold'>;
  unit:      string;
  direction: '以上' | '以下';
  min:       number;
  max:       number;
  step:      number;
}

const FROST_TEMP:    NumericField = { key: 'frost',             unit: '℃',   direction: '以下', min: -5,   max: 5,    step: 0.5 };
const FROST_DEW:     NumericField = { key: 'frostDewPoint',     unit: '℃',   direction: '以下', min: -5,   max: 3,    step: 0.5 };
const WIND_FIELD:    NumericField = { key: 'wind',              unit: 'm/s',  direction: '以上', min: 5,    max: 30,   step: 1   };
const HEAT_FIELD:    NumericField = { key: 'heat',              unit: '℃',   direction: '以上', min: 28,   max: 42,   step: 0.5 };
const DRY_FIELD:     NumericField = { key: 'dry',               unit: '%',    direction: '以下', min: 10,   max: 60,   step: 5   };
const RAIN_DAILY:    NumericField = { key: 'rainDaily',         unit: 'mm',   direction: '以上', min: 20,   max: 300,  step: 10  };
const RAIN_HOURLY:   NumericField = { key: 'rainHourly',        unit: 'mm/h', direction: '以上', min: 10,   max: 100,  step: 5   };
const HAIL_FREEZING: NumericField = { key: 'hailFreezingLevel', unit: 'm',    direction: '以下', min: 2000, max: 5000, step: 100 };
const COLD_FIELD:    NumericField = { key: 'cold',              unit: '℃',   direction: '以下', min: -15,  max: 5,    step: 0.5 };
const SNOW_FIELD:    NumericField = { key: 'snow',              unit: 'cm',   direction: '以上', min: 1,    max: 30,   step: 1   };

function sanitiseThresholds(form: RiskThresholds): RiskThresholds {
  const clamp = (v: number, min: number, max: number, fallback: number) =>
    isNaN(v) ? fallback : Math.min(max, Math.max(min, v));
  return {
    frost:              clamp(form.frost,             -5,    5,    DEFAULT_RISK_THRESHOLDS.frost),
    frostDewPoint:      clamp(form.frostDewPoint,     -5,    3,    DEFAULT_RISK_THRESHOLDS.frostDewPoint),
    wind:               clamp(form.wind,               5,    30,   DEFAULT_RISK_THRESHOLDS.wind),
    rainHourly:         clamp(form.rainHourly,         10,   100,  DEFAULT_RISK_THRESHOLDS.rainHourly),
    rainDaily:          clamp(form.rainDaily,          20,   300,  DEFAULT_RISK_THRESHOLDS.rainDaily),
    heat:               clamp(form.heat,               28,   42,   DEFAULT_RISK_THRESHOLDS.heat),
    dry:                clamp(form.dry,                10,   60,   DEFAULT_RISK_THRESHOLDS.dry),
    thunderSensitivity: form.thunderSensitivity,
    hailSensitivity:    form.hailSensitivity,
    hailFreezingLevel:  clamp(form.hailFreezingLevel,  2000, 5000, DEFAULT_RISK_THRESHOLDS.hailFreezingLevel),
    snow:               clamp(form.snow,               1,    30,   DEFAULT_RISK_THRESHOLDS.snow),
    cold:               clamp(form.cold,               -15,  5,    DEFAULT_RISK_THRESHOLDS.cold),
    enabledRisks:       form.enabledRisks,
  };
}

const RISK_LABEL: CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 600,
  minWidth: '3rem',
  flexShrink: 0,
};

const SUB: CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const AND_SEP: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  flexShrink: 0,
};

const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  flexWrap: 'wrap',
};

export function WeatherSettings() {
  const { userSettings, updateRiskThresholds } = useAppStore();
  const [form, setForm] = useState<RiskThresholds>(
    userSettings?.riskThresholds ?? DEFAULT_RISK_THRESHOLDS
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  useEffect(() => {
    if (userSettings?.riskThresholds) {
      setForm({ ...userSettings.riskThresholds });
    }
  }, [userSettings]);

  const handleNumericChange = (key: NumericField['key'], raw: string) => {
    setForm(prev => ({ ...prev, [key]: parseFloat(raw) }));
  };

  const handleSensitivityChange = (
    key: 'thunderSensitivity' | 'hailSensitivity',
    value: RiskSensitivity
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleEnabledChange = (type: RiskType, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      enabledRisks: checked
        ? [...prev.enabledRisks, type]
        : prev.enabledRisks.filter(r => r !== type),
    }));
  };

  const handleSave = async (thresholds: RiskThresholds) => {
    setStatus({ kind: 'saving' });
    try {
      await updateRiskThresholds(sanitiseThresholds(thresholds));
      setStatus({ kind: 'saved', msg: 'リスク閾値を保存しました' });
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      console.error('[WeatherSettings] riskThresholds save failed', err);
      setStatus({
        kind: 'error',
        msg: `保存失敗: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleReset = async () => {
    setForm({ ...DEFAULT_RISK_THRESHOLDS });
    // DEFAULT_RISK_THRESHOLDS を明示的に渡す（setForm の非同期性に依存しないため）
    await handleSave(DEFAULT_RISK_THRESHOLDS);
  };

  const renderStatus = (s: SaveStatus) => {
    if (s.kind === 'idle') return null;
    const color =
      s.kind === 'error'  ? '#c62828' :
      s.kind === 'saved'  ? '#2e7d32' :
      'var(--text-secondary)';
    const text = s.kind === 'saving' ? '保存中…' : s.msg ?? '';
    return (
      <span style={{ marginRight: '0.6rem', fontSize: '0.78rem', color, alignSelf: 'center' }}>
        {text}
      </span>
    );
  };

  const renderInlineInput = (field: NumericField) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={form[field.key] as number}
        onChange={e => handleNumericChange(field.key, e.target.value)}
        style={{ width: '4.5rem' }}
      />
      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {field.unit}　{field.direction}
      </span>
    </div>
  );

  const renderSensitivityToggle = (key: 'thunderSensitivity' | 'hailSensitivity') => (
    <div style={{ display: 'flex', gap: '0.35rem' }}>
      {SENSITIVITY_OPTIONS.map(opt => (
        <button
          key={opt}
          onClick={() => handleSensitivityChange(key, opt)}
          className="secondary"
          style={{
            padding: '0.25rem 0.7rem', fontSize: '0.8rem',
            background: form[key] === opt ? 'rgba(244,167,185,0.45)' : undefined,
            color:      form[key] === opt ? '#7a2840'              : undefined,
            fontWeight: form[key] === opt ? 600                    : undefined,
          }}
        >
          {SENSITIVITY_LABELS[opt]}
        </button>
      ))}
    </div>
  );

  // チェックボックス＋アイコンの共通レンダラー
  const renderRowStart = (type: RiskType) => (
    <>
      <input
        type="checkbox"
        checked={form.enabledRisks.includes(type)}
        onChange={e => handleEnabledChange(type, e.target.checked)}
        style={{ flexShrink: 0, cursor: 'pointer', width: '1rem', height: '1rem' }}
      />
      <img
        src={`/icons/weather/${RISK_BADGES[type].iconFile}.svg`}
        width={18}
        height={18}
        alt={RISK_BADGES[type].label}
        style={{ flexShrink: 0 }}
      />
    </>
  );

  return (
    <div
      className="glass-panel"
      style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>リスク検知の閾値</h3>

      {/* 霜（春） */}
      <div style={ROW}>
        {renderRowStart('frost')}
        <span style={RISK_LABEL}>霜</span>
        <span style={SUB}>気温</span>
        {renderInlineInput(FROST_TEMP)}
        <span style={AND_SEP}>＆</span>
        <span style={SUB}>露点</span>
        {renderInlineInput(FROST_DEW)}
      </div>

      {/* 雷雨（夏） */}
      <div style={ROW}>
        {renderRowStart('thunder')}
        <span style={RISK_LABEL}>雷雨</span>
        {renderSensitivityToggle('thunderSensitivity')}
      </div>

      {/* 雹（夏） */}
      <div style={ROW}>
        {renderRowStart('hail')}
        <span style={RISK_LABEL}>雹</span>
        {renderSensitivityToggle('hailSensitivity')}
        <span style={AND_SEP}>＆</span>
        <span style={SUB}>0℃層高度</span>
        {renderInlineInput(HAIL_FREEZING)}
      </div>

      {/* 大雨（夏〜秋） */}
      <div style={ROW}>
        {renderRowStart('rain')}
        <span style={RISK_LABEL}>大雨</span>
        <span style={SUB}>（24時間雨量）</span>
        {renderInlineInput(RAIN_DAILY)}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>／</span>
        <span style={SUB}>（1時間雨量）</span>
        {renderInlineInput(RAIN_HOURLY)}
      </div>

      {/* 強風 */}
      <div style={ROW}>
        {renderRowStart('wind')}
        <span style={RISK_LABEL}>強風</span>
        <span style={SUB}>風速</span>
        {renderInlineInput(WIND_FIELD)}
      </div>

      {/* 高温（夏） */}
      <div style={ROW}>
        {renderRowStart('heat')}
        <span style={RISK_LABEL}>高温</span>
        <span style={SUB}>気温</span>
        {renderInlineInput(HEAT_FIELD)}
      </div>

      {/* 乾燥（秋〜冬） */}
      <div style={ROW}>
        {renderRowStart('dry')}
        <span style={RISK_LABEL}>乾燥</span>
        <span style={SUB}>湿度</span>
        {renderInlineInput(DRY_FIELD)}
      </div>

      {/* 低温（冬） */}
      <div style={ROW}>
        {renderRowStart('cold')}
        <span style={RISK_LABEL}>低温</span>
        <span style={SUB}>気温</span>
        {renderInlineInput(COLD_FIELD)}
      </div>

      {/* 降雪（冬） */}
      <div style={ROW}>
        {renderRowStart('snow')}
        <span style={RISK_LABEL}>降雪</span>
        <span style={SUB}>積雪量</span>
        {renderInlineInput(SNOW_FIELD)}
      </div>

      {/* フッター：デフォルトに戻す + 保存 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={handleReset}
          disabled={status.kind === 'saving'}
          className="secondary"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.82rem', padding: '0.4rem 0.75rem',
            opacity: status.kind === 'saving' ? 0.6 : 1,
            cursor:  status.kind === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          <RotateCcw size={13} /> デフォルトに戻す
        </button>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {renderStatus(status)}
          <button
            onClick={() => handleSave(form)}
            disabled={status.kind === 'saving'}
            style={{
              ...SAVE_BTN,
              cursor:  status.kind === 'saving' ? 'not-allowed' : 'pointer',
              opacity: status.kind === 'saving' ? 0.6 : 1,
            }}
          >
            <Save size={14} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

期待：エラー 0。

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

期待：成功。

- [ ] **Step 4: 動作確認（ブラウザ）**

`npm run dev` でアプリを起動し、設定タブ → 天気設定 で以下を確認：

1. 各リスク行の左端にチェックボックスとアイコンが表示される
2. 行順が「霜→雷雨→雹→大雨→強風→高温→乾燥→低温→降雪」になっている
3. チェックボックスを外して保存すると、天気タブのリスクサマリーと日別カードから対象リスクが消える
4. 「デフォルトに戻す」で全チェックが復活する
5. 低温・降雪の閾値入力が正常に動作する

- [ ] **Step 5: コミット**

```bash
git add src/components/settings/WeatherSettings.tsx
git commit -m "feat: add icon, checkbox toggle, and winter risk rows to WeatherSettings"
```

- [ ] **Step 6: プッシュ**

```bash
git push
```
