# リスク閾値カスタマイズ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** リスク検知の閾値をユーザーごとに Firestore へ永続化し、WeatherSettings.tsx でカスタマイズ・保存できるようにする。

**Architecture:** store.ts + userRepository.ts でデータモデルを定義。riskDetection.ts に閾値パラメータを注入し、WeatherTab.tsx 経由で接続。WeatherSettings.tsx が設定 UI を提供する。

**Tech Stack:** React 19 + TypeScript 6 + Zustand 5 + Cloud Firestore（firebase 12）

**仕様書:** `docs/superpowers/specs/2026-05-26-risk-threshold-customization-design.md`

---

## ファイル変更一覧

| ファイル | 変更種別 | 概要 |
|---------|---------|------|
| `src/store.ts` | 変更 | `RiskSensitivity` 型・`RiskThresholds` 型・`DEFAULT_RISK_THRESHOLDS` 追加、`UserSettings` 拡張、`updateRiskThresholds` アクション追加 |
| `src/lib/userRepository.ts` | 変更 | `getUserSettings` に `riskThresholds` マージ追加、`updateRiskThresholds` 関数追加 |
| `src/lib/riskDetection.ts` | 変更 | `detectRisks`・`detectHourlyRisks`・`detectDailyRisks` に `thresholds` パラメータ追加、ハードコード値を置き換え |
| `src/components/weather/WeatherTab.tsx` | 変更 | `userSettings` 取得追加、`detectRisks` 呼び出しに `riskThresholds` を渡す |
| `src/components/settings/WeatherSettings.tsx` | 全面書き換え | プレースホルダーを実装に置き換え |

---

## Task 1: データ層（store.ts + userRepository.ts）

**Files:**
- Modify: `src/store.ts`
- Modify: `src/lib/userRepository.ts`

---

- [ ] **Step 1.1: store.ts — RiskSensitivity 型・RiskThresholds 型を追加**

`src/store.ts` の `AccumDeltaThresholds` インターフェースの直後に以下を挿入する。

```typescript
export type RiskSensitivity = 'low' | 'medium' | 'high';

export interface RiskThresholds {
  frost:              number;          // 霜：気温 ≤ X ℃
  wind:               number;          // 強風：風速 ≥ X m/s
  rainHourly:         number;          // 大雨：時間雨量 ≥ X mm/h
  rainDaily:          number;          // 大雨：日雨量 ≥ X mm
  heat:               number;          // 高温：気温 ≥ X ℃
  dry:                number;          // 乾燥：湿度 ≤ X %
  thunderSensitivity: RiskSensitivity; // 雷雨感度（CAPE閾値に内部マッピング）
  hailSensitivity:    RiskSensitivity; // 雹感度（CAPE閾値に内部マッピング）
}
```

- [ ] **Step 1.2: store.ts — DEFAULT_RISK_THRESHOLDS 定数を追加**

既存の `DEFAULT_ACCUM_DELTA_THRESHOLDS` 定数の直後に以下を挿入する。

```typescript
const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  frost:              3,
  wind:               15,
  rainHourly:         30,
  rainDaily:          80,
  heat:               35,
  dry:                30,
  thunderSensitivity: 'medium',
  hailSensitivity:    'medium',
};
```

- [ ] **Step 1.3: store.ts — UserSettings に riskThresholds を追加**

`UserSettings` インターフェースを以下に置き換える（`riskThresholds` 行を追加）。

```typescript
export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  riskThresholds:       RiskThresholds;
}
```

- [ ] **Step 1.4: store.ts — userRepository からの import に updateRiskThresholds を追加**

既存の import 文を以下に置き換える。

```typescript
import {
  getUserSettings,
  updateBaseTempSettings as updateBaseTempSettingsRemote,
  updateAccumStartDates as updateAccumStartDatesRemote,
  updateAccumDeltaThresholds as updateAccumDeltaThresholdsRemote,
  updateRiskThresholds as updateRiskThresholdsRemote,
} from './lib/userRepository';
```

- [ ] **Step 1.5: store.ts — AppState インターフェースに updateRiskThresholds を追加**

`updateAccumDeltaThresholds` の行の直後に以下を追加する。

```typescript
  updateRiskThresholds: (thresholds: RiskThresholds) => Promise<void>;
```

- [ ] **Step 1.6: store.ts — create() に updateRiskThresholds アクションを追加**

`updateAccumDeltaThresholds` アクション実装の直後に以下を追加する。

```typescript
  updateRiskThresholds: async (thresholds) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateRiskThresholdsRemote(uid, thresholds);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, riskThresholds: thresholds }
        : null,
    }));
  },
```

- [ ] **Step 1.7: store.ts — DEFAULT_RISK_THRESHOLDS をエクスポートに追加**

ファイル末尾の export ブロックを以下に置き換える。

```typescript
export {
  DEFAULT_BASE_TEMP_SETTINGS,
  DEFAULT_ACCUM_START_DATES,
  DEFAULT_ACCUM_DELTA_THRESHOLDS,
  DEFAULT_RISK_THRESHOLDS,
};
```

- [ ] **Step 1.8: userRepository.ts — 型 import に RiskThresholds を追加**

先頭の import 文を以下に置き換える。

```typescript
import type { UserSettings, AccumStartDates, AccumDeltaThresholds, RiskThresholds } from '../store';
```

- [ ] **Step 1.9: userRepository.ts — DEFAULT_RISK_THRESHOLDS 定数を追加**

既存の `DEFAULT_ACCUM_DELTA_THRESHOLDS` 定数の直後に以下を追加する（store.ts の値と必ず一致させること）。

```typescript
const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  frost:              3,
  wind:               15,
  rainHourly:         30,
  rainDaily:          80,
  heat:               35,
  dry:                30,
  thunderSensitivity: 'medium',
  hailSensitivity:    'medium',
};
```

- [ ] **Step 1.10: userRepository.ts — getUserSettings を更新**

`getUserSettings` 関数を以下に置き換える（`riskThresholds` のマージを追加）。

```typescript
export async function getUserSettings(uid: string): Promise<UserSettings> {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const baseTempSettings = data?.baseTempSettings ?? DEFAULT_BASE_TEMP_SETTINGS;
  const accumStartDates: AccumStartDates = {
    ...DEFAULT_ACCUM_START_DATES,
    ...(data?.accumStartDates ?? {}),
  };
  const accumDeltaThresholds: AccumDeltaThresholds = {
    ...DEFAULT_ACCUM_DELTA_THRESHOLDS,
    ...(data?.accumDeltaThresholds ?? {}),
  };
  const riskThresholds: RiskThresholds = {
    ...DEFAULT_RISK_THRESHOLDS,
    ...(data?.riskThresholds ?? {}),
  };
  return { baseTempSettings, accumStartDates, accumDeltaThresholds, riskThresholds };
}
```

- [ ] **Step 1.11: userRepository.ts — updateRiskThresholds 関数を追加**

ファイル末尾の `updateAccumDeltaThresholds` 関数の直後に以下を追加する。

```typescript
export async function updateRiskThresholds(
  uid: string,
  thresholds: RiskThresholds
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { riskThresholds: thresholds }, { merge: true });
}
```

- [ ] **Step 1.12: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。`riskThresholds` に関する型エラーがないこと。

- [ ] **Step 1.13: コミット**

```bash
git add src/store.ts src/lib/userRepository.ts
git commit -m "feat: add RiskThresholds type and Firestore persistence"
```

---

## Task 2: ロジック層（riskDetection.ts + WeatherTab.tsx）

**Files:**
- Modify: `src/lib/riskDetection.ts`
- Modify: `src/components/weather/WeatherTab.tsx`

---

- [ ] **Step 2.1: riskDetection.ts — 型 import を追加**

ファイル先頭の import 行の直後に以下を追加する。
値は store.ts からインポートせず、既存 lib ファイルの慣例に従い内部コピーを定義する（次 Step）。

```typescript
import type { RiskThresholds, RiskSensitivity } from '../store';
```

- [ ] **Step 2.2: riskDetection.ts — モジュール内デフォルト定数と CAPE マッピング定数を追加**

`ARATEN_RISK_SET` 定数の直後に以下を追加する。
`DEFAULT_RISK_THRESHOLDS` の値は `store.ts` および `userRepository.ts` の定義と必ず一致させること。

```typescript
const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  frost:              3,
  wind:               15,
  rainHourly:         30,
  rainDaily:          80,
  heat:               35,
  dry:                30,
  thunderSensitivity: 'medium',
  hailSensitivity:    'medium',
};
```

`DEFAULT_RISK_THRESHOLDS` の直後に CAPE マッピング定数を追加する。

```typescript
const THUNDER_CAPE_MAP: Record<RiskSensitivity, number> = {
  low: 1000, medium: 500, high: 250,
};
const HAIL_CAPE_MAP: Record<RiskSensitivity, number> = {
  low: 2000, medium: 1000, high: 500,
};
```

- [ ] **Step 2.3: riskDetection.ts — detectHourlyRisks のシグネチャを変更**

`detectHourlyRisks` 関数のシグネチャを以下に変更する（パラメータに `t`, `thunderCape`, `hailCape` を追加）。

```typescript
function detectHourlyRisks(
  hours: HourlyForecast[],
  t: RiskThresholds,
  thunderCape: number,
  hailCape: number
): {
  risks: RiskType[];
  firstHour: number | undefined;
  metrics: Partial<Record<RiskType, string>>;
}
```

- [ ] **Step 2.4: riskDetection.ts — detectHourlyRisks 内のハードコード値を置き換え**

`detectHourlyRisks` 関数本体内の判定条件を以下に置き換える（ハードコード数値 → `t.xxx` / `thunderCape` / `hailCape`）。

```typescript
    if (h.dewPoint <= 0 && h.temperature <= t.frost) {
      detected.push('frost');
      if (h.temperature < frostMinTemp) frostMinTemp = h.temperature;
      if (h.dewPoint    < frostMinDew)  frostMinDew  = h.dewPoint;
    }
    if (h.cape >= thunderCape || (h.weatherCode >= 95 && h.weatherCode <= 99)) {
      detected.push('thunder');
      if (h.cape > thunderMaxCape) thunderMaxCape = h.cape;
    }
    if (h.cape >= hailCape && h.freezingLevel <= 3500) {
      detected.push('hail');
      if (h.cape          > hailMaxCape)    hailMaxCape    = h.cape;
      if (h.freezingLevel < hailMinFreezing) hailMinFreezing = h.freezingLevel;
    }
    if (h.windSpeed >= t.wind)        { detected.push('wind');    if (h.windSpeed    > windMax)  windMax  = h.windSpeed; }
    if (h.precipitation >= t.rainHourly){ detected.push('rain'); if (h.precipitation > rainMax) rainMax  = h.precipitation; }
    if (h.temperature >= t.heat)      { detected.push('heat');    if (h.temperature  > heatMax)  heatMax  = h.temperature; }
    if (h.humidity <= t.dry)          { detected.push('dry');     if (h.humidity     < dryMin)   dryMin   = h.humidity; }
```

- [ ] **Step 2.5: riskDetection.ts — detectDailyRisks のシグネチャを変更**

`detectDailyRisks` 関数のシグネチャを以下に変更する（パラメータに `t` を追加）。

```typescript
function detectDailyRisks(
  day: DailyForecastData,
  t: RiskThresholds
): {
  risks: RiskType[];
  metrics: Partial<Record<RiskType, string>>;
}
```

- [ ] **Step 2.6: riskDetection.ts — detectDailyRisks 内のハードコード値を置き換え**

`detectDailyRisks` 関数本体内の判定条件を以下に置き換える。

```typescript
  if (day.tempMin <= t.frost)                               { risks.push('frost');   metrics.frost   = `最低気温 ${day.tempMin.toFixed(1)}℃`; }
  if (day.weatherCode >= 95 && day.weatherCode <= 99)       { risks.push('thunder'); /* 天気コード判定のため指標値なし */ }
  if (day.weatherCode === 96 || day.weatherCode === 99)     { risks.push('hail');    /* 天気コード判定のため指標値なし */ }
  if (day.windSpeedMax >= t.wind)                           { risks.push('wind');    metrics.wind    = `最大風速 ${day.windSpeedMax.toFixed(1)} m/s`; }
  if (day.precipSum >= t.rainDaily)                         { risks.push('rain');    metrics.rain    = `降水量 ${day.precipSum.toFixed(1)} mm`; }
  if (day.tempMax >= t.heat)                                { risks.push('heat');    metrics.heat    = `最高気温 ${day.tempMax.toFixed(1)}℃`; }
  if (day.humidMin <= t.dry)                                { risks.push('dry');     metrics.dry     = `最低湿度 ${day.humidMin}%`; }
```

- [ ] **Step 2.7: riskDetection.ts — detectRisks のシグネチャを変更**

`detectRisks` 関数全体を以下に置き換える。

```typescript
export function detectRisks(
  hourly: HourlyForecast[],
  daily: DailyForecastData[],
  thresholds?: RiskThresholds
): DayRisk[] {
  const t = { ...DEFAULT_RISK_THRESHOLDS, ...thresholds };
  const thunderCape = THUNDER_CAPE_MAP[t.thunderSensitivity];
  const hailCape    = HAIL_CAPE_MAP[t.hailSensitivity];

  return daily.map((day) => {
    const dayHours = hourly.filter(h => h.time.slice(0, 10) === day.date);

    if (dayHours.length > 0) {
      const { risks, firstHour, metrics } = detectHourlyRisks(dayHours, t, thunderCape, hailCape);
      return { date: day.date, risks, comment: buildComment(risks, firstHour), metrics };
    } else {
      const { risks, metrics } = detectDailyRisks(day, t);
      return { date: day.date, risks, comment: buildComment(risks), metrics };
    }
  });
}
```

- [ ] **Step 2.8: WeatherTab.tsx — userSettings を追加取得し detectRisks に渡す**

`WeatherTab.tsx` の以下の行を変更する。

変更前:
```typescript
  const { locations } = useAppStore();
```

変更後:
```typescript
  const { locations, userSettings } = useAppStore();
```

変更前:
```typescript
  const dayRisks = data ? detectRisks(data.hourly, data.daily) : [];
```

変更後:
```typescript
  const dayRisks = data ? detectRisks(data.hourly, data.daily, userSettings?.riskThresholds) : [];
```

- [ ] **Step 2.9: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。`detectHourlyRisks` / `detectDailyRisks` の引数不足エラーがないこと。

- [ ] **Step 2.10: コミット**

```bash
git add src/lib/riskDetection.ts src/components/weather/WeatherTab.tsx
git commit -m "feat: inject risk thresholds into detectRisks"
```

---

## Task 3: UI 層（WeatherSettings.tsx）

**Files:**
- Modify: `src/components/settings/WeatherSettings.tsx`

---

- [ ] **Step 3.1: WeatherSettings.tsx を以下の内容で全面置き換え**

```typescript
import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import {
  useAppStore,
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
  type RiskSensitivity,
} from '../../store';

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
  key:       keyof Pick<RiskThresholds, 'frost' | 'wind' | 'rainHourly' | 'rainDaily' | 'heat' | 'dry'>;
  label:     string;
  unit:      string;
  direction: '≤' | '≥';
  min:       number;
  max:       number;
  step:      number;
}

const NUMERIC_FIELDS: NumericField[] = [
  { key: 'frost',      label: '霜',          unit: '℃',    direction: '≤', min: -5,  max: 5,   step: 0.5 },
  { key: 'heat',       label: '高温',        unit: '℃',    direction: '≥', min: 28,  max: 42,  step: 0.5 },
  { key: 'wind',       label: '強風',        unit: 'm/s',  direction: '≥', min: 5,   max: 30,  step: 1   },
  { key: 'dry',        label: '乾燥',        unit: '%',    direction: '≤', min: 10,  max: 60,  step: 5   },
  { key: 'rainHourly', label: '大雨 時間雨量', unit: 'mm/h', direction: '≥', min: 10,  max: 100, step: 5   },
  { key: 'rainDaily',  label: '大雨 日雨量',  unit: 'mm',   direction: '≥', min: 20,  max: 300, step: 10  },
];

function sanitiseThresholds(form: RiskThresholds): RiskThresholds {
  const clamp = (v: number, min: number, max: number, fallback: number) =>
    isNaN(v) ? fallback : Math.min(max, Math.max(min, v));
  return {
    frost:              clamp(form.frost,       -5,  5,   DEFAULT_RISK_THRESHOLDS.frost),
    wind:               clamp(form.wind,         5,  30,  DEFAULT_RISK_THRESHOLDS.wind),
    rainHourly:         clamp(form.rainHourly,  10,  100, DEFAULT_RISK_THRESHOLDS.rainHourly),
    rainDaily:          clamp(form.rainDaily,   20,  300, DEFAULT_RISK_THRESHOLDS.rainDaily),
    heat:               clamp(form.heat,        28,  42,  DEFAULT_RISK_THRESHOLDS.heat),
    dry:                clamp(form.dry,         10,  60,  DEFAULT_RISK_THRESHOLDS.dry),
    thunderSensitivity: form.thunderSensitivity,
    hailSensitivity:    form.hailSensitivity,
  };
}

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

  const handleNumericChange = (
    key: keyof Pick<RiskThresholds, 'frost' | 'wind' | 'rainHourly' | 'rainDaily' | 'heat' | 'dry'>,
    raw: string
  ) => {
    setForm((prev) => ({ ...prev, [key]: parseFloat(raw) }));
  };

  const handleSensitivityChange = (
    key: 'thunderSensitivity' | 'hailSensitivity',
    value: RiskSensitivity
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  return (
    <div
      className="glass-panel"
      style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>リスク検知の閾値</h3>

      {/* 数値閾値 — 2カラムグリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {NUMERIC_FIELDS.map((field) => (
          <div className="form-group" key={field.key}>
            <label>
              {field.label} {field.direction}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={form[field.key] as number}
                onChange={(e) => handleNumericChange(field.key, e.target.value)}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {field.unit}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {field.min}〜{field.max}
            </div>
          </div>
        ))}
      </div>

      {/* 区切り線 */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />

      {/* 感度トグル（雷雨・雹） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {(
          [
            { key: 'thunderSensitivity', label: '雷雨感度' },
            { key: 'hailSensitivity',    label: '雹 感度' },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '4.5rem' }}>
              {label}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {SENSITIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSensitivityChange(key, opt)}
                  className="secondary"
                  style={{
                    padding: '0.25rem 0.7rem',
                    fontSize: '0.8rem',
                    background:  form[key] === opt ? 'rgba(244,167,185,0.45)' : undefined,
                    color:       form[key] === opt ? '#7a2840' : undefined,
                    fontWeight:  form[key] === opt ? 600 : undefined,
                  }}
                >
                  {SENSITIVITY_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* フッター：デフォルトに戻す + 保存 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem' }}>
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

- [ ] **Step 3.2: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。`RotateCcw` import エラーや型エラーがないこと。

- [ ] **Step 3.3: 手動動作確認チェックリスト**

`npm run dev` でアプリを起動し、以下を確認する。

1. ⚙設定タブ → 気象情報サブタブ を開く
   - 「リスク検知の閾値」カードが表示される
   - 数値フィールドが6つ（霜/高温/強風/乾燥/大雨時間/大雨日）表示される
   - 雷雨感度・雹感度のトグルが「標準」で選択されている

2. 霜の閾値を `3` → `0` に変更し「保存」を押す
   - 「保存中…」→「リスク閾値を保存しました」と表示される
   - ページをリロードして `0` が維持されていることを確認（Firestore 永続化）

3. 「デフォルトに戻す」を押す
   - 全フィールドがデフォルト値（霜: 3、強風: 15 など）に戻る
   - 即座に保存が実行され「保存しました」が表示される

4. 天気タブに移動し、リスクサマリーが引き続き正常に表示されることを確認

- [ ] **Step 3.4: コミット**

```bash
git add src/components/settings/WeatherSettings.tsx
git commit -m "feat: implement risk threshold customization UI"
```

- [ ] **Step 3.5: プッシュ**

```bash
git push origin main
```

Expected: Cloudflare Pages のビルドが通ること。
