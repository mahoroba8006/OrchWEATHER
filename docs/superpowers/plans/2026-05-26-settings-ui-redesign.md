# 設定UI再設計 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SettingsModal を廃止し、設定専用タブ（ネストタブ3段）とタブバー統合ヘッダーに再構築する。現在地登録機能も同時追加。

**Architecture:** ヘッダーを廃止してタブバー1層（sticky top:0）に統合。設定タブは `SettingsTab` ルートコンポーネント配下に `LocationSettings` / `WeatherSettings` / `AnalysisSettings` の3サブコンポーネントで構成。`SettingsModal.tsx` は各サブコンポーネントへ移植後に削除。

**Tech Stack:** React 19, TypeScript, lucide-react, Zustand (`useAppStore`), Firebase Auth (`signOut`), Geolocation API

---

## ファイル構成

| 種別 | ファイル | 役割 |
|------|---------|------|
| 新規 | `src/components/settings/AnalysisSettings.tsx` | 比較分析サブタブ（基準温度・累積設定） |
| 新規 | `src/components/settings/WeatherSettings.tsx` | 気象情報サブタブ（プレースホルダー） |
| 新規 | `src/components/settings/LocationSettings.tsx` | 地点設定サブタブ（リスト・編集・現在地登録） |
| 新規 | `src/components/settings/SettingsTab.tsx` | 設定タブルート（アカウントエリア・サブタブルーティング） |
| 変更 | `src/App.tsx` | ヘッダー廃止・タブバー改修・設定タブ接続・SettingsModal削除 |
| 変更 | `src/components/Footer.tsx` | ロゴテキスト追加 |
| 削除 | `src/SettingsModal.tsx` | 各サブコンポーネントへ移植後に削除 |

---

## Task 1: AnalysisSettings.tsx を作成

**Files:**
- Create: `src/components/settings/AnalysisSettings.tsx`

- [ ] **Step 1: ファイルを作成する**

`src/components/settings/AnalysisSettings.tsx` を以下の内容で作成する。`SettingsModal.tsx` の「有効積算温度の設定」「累積の開始日・日数差 表示設定」セクションを移植したもの。

```tsx
import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import {
  useAppStore,
  DEFAULT_ACCUM_START_DATES,
  DEFAULT_ACCUM_DELTA_THRESHOLDS,
  type AccumStartDates,
  type AccumDeltaThresholds,
} from '../../store';

const START_DATE_PRESETS: Array<{ label: string; mmdd: string }> = [
  { label: '1/1', mmdd: '01-01' },
  { label: '4/1', mmdd: '04-01' },
  { label: '5/1', mmdd: '05-01' },
  { label: '6/1', mmdd: '06-01' },
];

const ACCUM_CHART_LABELS: Record<keyof AccumStartDates, string> = {
  precip: '降水量',
  sunshine: '日照時間',
  radiation: '日射量',
  gdd: '有効積算温度',
};

const ACCUM_CHART_ORDER: Array<keyof AccumStartDates> = ['precip', 'sunshine', 'radiation', 'gdd'];

const parseMMDD = (s: string): { mm: number; dd: number } => {
  const [m, d] = s.split('-').map(Number);
  return { mm: m || 1, dd: d || 1 };
};

const formatMMDD = (mm: number, dd: number): string =>
  `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

const lastDayOf = (mm: number): number => {
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[mm - 1] || 31;
};

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

const SAVE_BTN: React.CSSProperties = {
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

export function AnalysisSettings() {
  const {
    userSettings,
    updateBaseTempSettings,
    updateAccumStartDates,
    updateAccumDeltaThresholds,
  } = useAppStore();

  const [baseTempForm, setBaseTempForm] = useState<[number, number]>(
    userSettings?.baseTempSettings ?? [10, 3.5]
  );
  const [accumStartForm, setAccumStartForm] = useState<AccumStartDates>(
    userSettings?.accumStartDates ?? DEFAULT_ACCUM_START_DATES
  );
  const [accumThresholdForm, setAccumThresholdForm] = useState<AccumDeltaThresholds>(
    userSettings?.accumDeltaThresholds ?? DEFAULT_ACCUM_DELTA_THRESHOLDS
  );
  const [baseTempStatus, setBaseTempStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [accumStatus, setAccumStatus] = useState<SaveStatus>({ kind: 'idle' });

  useEffect(() => {
    if (userSettings) {
      setBaseTempForm([...userSettings.baseTempSettings]);
      setAccumStartForm({ ...userSettings.accumStartDates });
      setAccumThresholdForm({ ...userSettings.accumDeltaThresholds });
    }
  }, [userSettings]);

  const updateAccumStart = (chart: keyof AccumStartDates, mmdd: string) => {
    setAccumStartForm((prev) => ({ ...prev, [chart]: mmdd }));
  };

  const renderStatus = (status: SaveStatus) => {
    if (status.kind === 'idle') return null;
    const color =
      status.kind === 'error' ? '#c62828'
      : status.kind === 'saved' ? '#2e7d32'
      : 'var(--text-secondary)';
    const text = status.kind === 'saving' ? '保存中…' : status.msg ?? '';
    return (
      <span style={{ marginRight: '0.6rem', fontSize: '0.78rem', color, alignSelf: 'center' }}>
        {text}
      </span>
    );
  };

  const handleSaveBaseTempSettings = async () => {
    setBaseTempStatus({ kind: 'saving' });
    try {
      await updateBaseTempSettings(baseTempForm);
      setBaseTempStatus({ kind: 'saved', msg: '基準温度を保存しました' });
      setTimeout(() => setBaseTempStatus({ kind: 'idle' }), 2500);
    } catch (err: any) {
      console.error('[AnalysisSettings] baseTemp save failed', err);
      setBaseTempStatus({ kind: 'error', msg: `保存失敗: ${err?.message || err}` });
    }
  };

  const handleSaveAccumSettings = async () => {
    const clampInt = (v: number, max: number) => Math.min(max, Math.max(1, Math.round(v) || 1));
    setAccumStatus({ kind: 'saving' });
    try {
      await Promise.all([
        updateAccumStartDates(accumStartForm),
        updateAccumDeltaThresholds({
          gdd: clampInt(accumThresholdForm.gdd, 500),
          radiation: clampInt(accumThresholdForm.radiation, 2000),
        }),
      ]);
      setAccumStatus({ kind: 'saved', msg: '累積設定を保存しました' });
      setTimeout(() => setAccumStatus({ kind: 'idle' }), 2500);
    } catch (err: any) {
      console.error('[AnalysisSettings] accum settings save failed', err);
      setAccumStatus({ kind: 'error', msg: `保存失敗: ${err?.message || err}` });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 有効積算温度の設定 */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>有効積算温度の設定</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {([0, 1] as const).map((i) => (
            <div className="form-group" key={i} style={{ flex: 1, minWidth: '120px' }}>
              <label>基準温度{i + 1} (℃)</label>
              <input
                type="number"
                step="0.1"
                value={baseTempForm[i]}
                onChange={(e) => {
                  const next: [number, number] = [...baseTempForm] as [number, number];
                  next[i] = parseFloat(e.target.value);
                  setBaseTempForm(next);
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {renderStatus(baseTempStatus)}
          <button
            onClick={handleSaveBaseTempSettings}
            disabled={baseTempStatus.kind === 'saving'}
            style={{ ...SAVE_BTN, opacity: baseTempStatus.kind === 'saving' ? 0.6 : 1, cursor: baseTempStatus.kind === 'saving' ? 'not-allowed' : 'pointer' }}
          >
            <Save size={14} /> 保存
          </button>
        </div>
      </div>

      {/* 累積開始日・日数差ガード閾値の設定 */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>累積の開始日・日数差 表示設定</h3>
        {ACCUM_CHART_ORDER.map((chart) => {
          const { mm, dd } = parseMMDD(accumStartForm[chart]);
          const maxDay = lastDayOf(mm);
          const safeDay = Math.min(dd, maxDay);
          return (
            <div key={chart} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ACCUM_CHART_LABELS[chart]} 累積開始日</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={mm}
                  onChange={(e) => {
                    const newMm = parseInt(e.target.value, 10);
                    const newDd = Math.min(safeDay, lastDayOf(newMm));
                    updateAccumStart(chart, formatMMDD(newMm, newDd));
                  }}
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
                <select
                  value={safeDay}
                  onChange={(e) => updateAccumStart(chart, formatMMDD(mm, parseInt(e.target.value, 10)))}
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>クイック:</span>
                {START_DATE_PRESETS.map((p) => (
                  <button
                    key={p.mmdd}
                    onClick={() => updateAccumStart(chart, p.mmdd)}
                    className="secondary"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem',
                      background: accumStartForm[chart] === p.mmdd ? 'rgba(244,167,185,0.45)' : undefined,
                      color: accumStartForm[chart] === p.mmdd ? '#7a2840' : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>日数差 表示開始閾値</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            累積値がこの値未満の期間は日数差を非表示にします（序盤の不安定な状況における表示を抑制）。
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>有効積算温度 (℃)</label>
              <input
                type="number" min={1} max={500} step={1}
                value={accumThresholdForm.gdd}
                onChange={(e) => setAccumThresholdForm({ ...accumThresholdForm, gdd: parseInt(e.target.value, 10) || 1 })}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>範囲: 1〜500</div>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>累積日射量 (MJ/m²)</label>
              <input
                type="number" min={1} max={2000} step={10}
                value={accumThresholdForm.radiation}
                onChange={(e) => setAccumThresholdForm({ ...accumThresholdForm, radiation: parseInt(e.target.value, 10) || 1 })}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>範囲: 1〜2000</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {renderStatus(accumStatus)}
          <button
            onClick={handleSaveAccumSettings}
            disabled={accumStatus.kind === 'saving'}
            style={{ ...SAVE_BTN, opacity: accumStatus.kind === 'saving' ? 0.6 : 1, cursor: accumStatus.kind === 'saving' ? 'not-allowed' : 'pointer' }}
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

期待結果: エラーなし（`AnalysisSettings.tsx` 単体ではまだ App.tsx から参照されないためエラーは出ない）

- [ ] **Step 3: コミット**

```bash
git add src/components/settings/AnalysisSettings.tsx
git commit -m "feat: add AnalysisSettings component (extracted from SettingsModal)"
```

---

## Task 2: WeatherSettings.tsx を作成

**Files:**
- Create: `src/components/settings/WeatherSettings.tsx`

- [ ] **Step 1: ファイルを作成する**

```tsx
export function WeatherSettings() {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ fontSize: '2rem' }}>🌿</span>
      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>リスク閾値の設定は準備中です</div>
      <div style={{ fontSize: '0.82rem', lineHeight: 1.6, maxWidth: 320 }}>
        霜・強風・大雨などの判定基準を
        ユーザーがカスタマイズできるようになります。
      </div>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/settings/WeatherSettings.tsx
git commit -m "feat: add WeatherSettings component (placeholder)"
```

---

## Task 3: LocationSettings.tsx を作成

**Files:**
- Create: `src/components/settings/LocationSettings.tsx`

- [ ] **Step 1: ファイルを作成する**

`SettingsModal.tsx` の「登録地点」セクションを移植し、現在地登録ボタンを追加したもの。

```tsx
import { useState } from 'react';
import { MapPin, Plus, Save, Trash2, Loader2 } from 'lucide-react';
import { useAppStore, type LocationInfo } from '../../store';

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

type GeoStatus = 'idle' | 'loading' | 'error';

function getGeoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return '位置情報の許可が必要です。ブラウザの設定からオンにしてください。';
    case err.TIMEOUT:
      return '位置情報の取得がタイムアウトしました。再試行してください。';
    default:
      return '位置情報の取得に失敗しました。再試行してください。';
  }
}

const GEO_SUPPORTED = typeof navigator !== 'undefined' && 'geolocation' in navigator;

const ADD_BTN: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  fontSize: '0.8rem',
  background: 'rgba(244,167,185,0.35)',
  color: '#7a2840',
  border: '1px solid rgba(244,167,185,0.6)',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
};

const GEO_BTN: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  fontSize: '0.8rem',
  background: 'rgba(13,148,136,0.12)',
  color: 'var(--accent-color)',
  border: '1px solid rgba(13,148,136,0.3)',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: GEO_SUPPORTED ? 'pointer' : 'not-allowed',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  opacity: GEO_SUPPORTED ? 1 : 0.5,
};

export function LocationSettings() {
  const { locations, addLocation, updateLocation, deleteLocation } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<LocationInfo>>({});
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleAddNew = () => {
    setEditingId('new');
    setFormData({ name: '新規地点', lat: 35.0, lon: 135.0 });
    setGeoError(null);
  };

  const handleGetCurrentLocation = () => {
    if (!GEO_SUPPORTED) return;
    setGeoStatus('loading');
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditingId('new');
        setFormData({
          name: '現在地',
          lat: Math.round(pos.coords.latitude * 1000000) / 1000000,
          lon: Math.round(pos.coords.longitude * 1000000) / 1000000,
        });
        setGeoStatus('idle');
      },
      (err) => {
        setGeoError(getGeoErrorMessage(err));
        setGeoStatus('error');
      },
      GEO_OPTIONS,
    );
  };

  const handleEdit = (loc: LocationInfo) => {
    setEditingId(loc.id);
    setFormData(loc);
    setGeoError(null);
  };

  const handleSave = () => {
    if (editingId === 'new') {
      addLocation(formData as Omit<LocationInfo, 'id'>);
    } else if (editingId) {
      updateLocation(editingId, formData);
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('本当に削除しますか？')) {
      deleteLocation(id);
      if (editingId === id) setEditingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* アクションボタン */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleGetCurrentLocation}
          disabled={!GEO_SUPPORTED || geoStatus === 'loading'}
          style={{
            ...GEO_BTN,
            opacity: (!GEO_SUPPORTED || geoStatus === 'loading') ? 0.6 : 1,
            cursor: (!GEO_SUPPORTED || geoStatus === 'loading') ? 'not-allowed' : 'pointer',
          }}
          title={GEO_SUPPORTED ? '現在地の緯度経度を自動取得して登録フォームを開きます' : 'このブラウザは位置情報に対応していません'}
        >
          {geoStatus === 'loading'
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> 取得中…</>
            : <><MapPin size={15} /> 現在地で登録</>
          }
        </button>
        <button onClick={handleAddNew} style={ADD_BTN}>
          <Plus size={16} /> 手動で追加
        </button>
      </div>

      {/* Geolocation エラー表示 */}
      {geoError && (
        <div style={{
          padding: '0.6rem 0.9rem',
          background: 'rgba(198,40,40,0.08)',
          border: '1px solid rgba(198,40,40,0.25)',
          borderRadius: 'var(--radius-md, 6px)',
          fontSize: '0.8rem',
          color: '#c62828',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.4rem',
        }}>
          ⚠ {geoError}
        </div>
      )}

      {/* 地点リスト */}
      {locations.map((loc) => (
        <div
          key={loc.id}
          className="glass-card"
          style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{loc.name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              緯度: {loc.lat} / 経度: {loc.lon}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={() => handleEdit(loc)}>編集</button>
            <button
              className="secondary"
              onClick={() => handleDelete(loc.id)}
              style={{ color: 'var(--chart-temp)' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      {/* インライン編集フォーム */}
      {editingId && (
        <div
          className="glass-panel"
          style={{ padding: '1.5rem', border: '1px solid var(--accent-light)' }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>
            {editingId === 'new' ? '新規地点の追加' : '地点の編集'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>地点名</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                <label>緯度 (Latitude)</label>
                <input
                  type="number" step="0.000001"
                  value={formData.lat || ''}
                  onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                <label>経度 (Longitude)</label>
                <input
                  type="number" step="0.000001"
                  value={formData.lon || ''}
                  onChange={(e) => setFormData({ ...formData, lon: parseFloat(e.target.value) })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="secondary" onClick={() => setEditingId(null)}>キャンセル</button>
              <button
                onClick={handleSave}
                style={{
                  background: 'rgba(244,167,185,0.35)',
                  color: '#7a2840',
                  border: '1px solid rgba(244,167,185,0.6)',
                  borderRadius: 'var(--radius-md, 6px)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.5rem 1rem',
                }}
              >
                <Save size={16} /> 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

期待結果: エラーなし（`Loader2` が lucide-react に存在しない場合は `RefreshCw` などに差し替える）

- [ ] **Step 3: コミット**

```bash
git add src/components/settings/LocationSettings.tsx
git commit -m "feat: add LocationSettings component with geolocation support"
```

---

## Task 4: SettingsTab.tsx を作成

**Files:**
- Create: `src/components/settings/SettingsTab.tsx`

- [ ] **Step 1: ファイルを作成する**

```tsx
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAppStore } from '../../store';
import { LocationSettings } from './LocationSettings';
import { WeatherSettings } from './WeatherSettings';
import { AnalysisSettings } from './AnalysisSettings';

type SettingsSubTab = 'location' | 'weather' | 'analysis';

const SUB_TAB_LABELS: Record<SettingsSubTab, string> = {
  location: '地点設定',
  weather: '気象情報',
  analysis: '比較分析',
};

const SUB_TABS: SettingsSubTab[] = ['location', 'weather', 'analysis'];

export function SettingsTab() {
  const [subTab, setSubTab] = useState<SettingsSubTab>('location');
  const { user } = useAppStore();
  const isMobile = window.innerWidth < 768;

  return (
    <div className="app-container">
      {/* アカウントエリア（Mobile のみ） */}
      {isMobile && user && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.9rem 1rem',
            borderBottom: '1px solid var(--card-border)',
            marginBottom: '0.5rem',
          }}
        >
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ''}
              width={36}
              height={36}
              style={{ borderRadius: '50%', border: '1.5px solid var(--accent-color)', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          </div>
          <button
            className="secondary"
            onClick={() => signOut(auth)}
            style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}
          >
            <LogOut size={13} /> ログアウト
          </button>
        </div>
      )}

      {/* サブタブナビゲーション（下線型） */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--card-border)',
          marginBottom: '1.25rem',
        }}
      >
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              padding: '0.65rem 1.2rem',
              fontSize: '0.88rem',
              fontWeight: subTab === tab ? 700 : 500,
              color: subTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: subTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            {SUB_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* サブタブコンテンツ */}
      {subTab === 'location' && <LocationSettings />}
      {subTab === 'weather' && <WeatherSettings />}
      {subTab === 'analysis' && <AnalysisSettings />}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

期待結果: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/settings/SettingsTab.tsx
git commit -m "feat: add SettingsTab component with nested sub-tabs and account area"
```

---

## Task 5: App.tsx を改修

**Files:**
- Modify: `src/App.tsx`

### 変更箇所一覧

| 行 | 変更内容 |
|----|---------|
| 6 | `SettingsModal` import を削除し `SettingsTab` import を追加 |
| 165 | `topTab` 型を `'weather' \| 'analysis' \| 'settings'` に変更 |
| 168 | `isSettingsOpen` state を削除 |
| 1233〜1259 | `<header>` ブロック全体を削除 |
| 1261〜1284 | タブバー div を改修（アイコン追加・設定タブ追加・アバター/logout 移動） |
| 1293〜1295 | 「地点設定」ボタンを削除 |
| 2043 | `<SettingsModal ...>` 行を `{topTab === 'settings' && <SettingsTab />}` に置き換え |

- [ ] **Step 1: SettingsModal import を削除し SettingsTab import を追加**

`src/App.tsx` 6行目を変更する：

```tsx
// Before:
import { SettingsModal } from './SettingsModal';

// After:
import { SettingsTab } from './components/settings/SettingsTab';
```

- [ ] **Step 2: topTab 型を拡張し isSettingsOpen を削除**

`src/App.tsx` 165〜168行目を変更する：

```tsx
// Before:
const [topTab, setTopTab] = useState<'weather' | 'analysis'>('weather');
// ...
const [isSettingsOpen, setIsSettingsOpen] = useState(false);

// After:
const [topTab, setTopTab] = useState<'weather' | 'analysis' | 'settings'>('weather');
// isSettingsOpen の行は削除
```

- [ ] **Step 3: ヘッダーブロックを削除**

`src/App.tsx` の以下のブロック全体（27行）を削除する：

```tsx
// 削除対象（App.tsx 1233〜1259 行）:
<header style={{ position: 'sticky', top: 0, zIndex: 50, ... }}>
  <div style={{ maxWidth: 1200, ... }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <img src="/icon.png" alt="Orch.Weather" style={{ width: 34, height: 34 }} />
      <h1 className="title">Orch.Weather</h1>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      {user.photoURL && ( <img ... /> )}
      <button className="secondary" onClick={() => signOut(auth)} ...>
        <LogOut size={14} /> ログアウト
      </button>
    </div>
  </div>
</header>
```

- [ ] **Step 4: タブバー div を改修**

`src/App.tsx` の既存タブバー div（1261〜1284行）を以下に置き換える：

```tsx
<div style={{
  background: 'rgba(255, 255, 255, 0.75)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderBottom: '1px solid var(--card-border)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 1rem',
  height: 56,
  position: 'sticky',
  top: 0,
  zIndex: 50,
  gap: '0.5rem',
}}>
  {/* アプリアイコン（装飾のみ） */}
  <img
    src="/icon.png"
    alt=""
    aria-hidden="true"
    style={{ width: 24, height: 24, flexShrink: 0, pointerEvents: 'none', marginRight: '0.25rem' }}
  />

  {/* メインタブ */}
  <div className="premium-segmented-tab" style={{ background: 'rgba(167, 203, 192, 0.15)', flex: 1 }}>
    {(['weather', 'analysis', 'settings'] as const).map((tab) => (
      <button
        key={tab}
        onClick={() => setTopTab(tab)}
        style={{
          padding: '0.5rem 1.2rem',
          background: topTab === tab ? 'linear-gradient(135deg, var(--accent-color) 0%, #0f766e 100%)' : 'transparent',
          color: topTab === tab ? '#ffffff' : 'var(--text-secondary)',
          border: 'none',
          fontWeight: topTab === tab ? 700 : 500,
          fontSize: '0.88rem',
          cursor: 'pointer',
          borderRadius: 'calc(var(--radius-md) - 4px)',
          boxShadow: topTab === tab ? '0 4px 12px rgba(13, 148, 136, 0.15)' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
      >
        {tab === 'weather' ? '天気情報'
          : tab === 'analysis' ? '比較分析'
          : <><Settings size={13} /> 設定</>}
      </button>
    ))}
  </div>

  {/* Desktop のみ: アバター＋ログアウト */}
  {!isMobile && (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0, marginLeft: '0.25rem' }}>
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt={user.displayName ?? ''}
          width={28}
          height={28}
          style={{ borderRadius: '50%', border: '1.5px solid var(--accent-color)' }}
        />
      )}
      <button
        className="secondary"
        onClick={() => signOut(auth)}
        title="ログアウト"
        style={{ padding: '0.4rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', borderRadius: 'var(--radius-md)' }}
      >
        <LogOut size={13} /> ログアウト
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 5: 比較分析タブ内の「地点設定」ボタンを削除**

`src/App.tsx` 1291〜1296行目の button 要素を削除する：

```tsx
// 削除対象:
<button className="secondary" title="設定" onClick={() => setIsSettingsOpen(true)} style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}>
  <Settings size={14} /> 地点設定
</button>
```

- [ ] **Step 6: SettingsModal 描画を SettingsTab 描画に置き換え**

`src/App.tsx` 2043行目を変更する：

```tsx
// Before:
<SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

// After:
{topTab === 'settings' && <SettingsTab />}
```

※ 既存の `{topTab === 'weather' && <WeatherTab />}` と `{topTab === 'analysis' && (...)}` の後に並べる形であれば位置は問わない。ただし `<SettingsModal>` の行を削除して同じ位置に書くのが最もシンプル。

- [ ] **Step 7: TypeScript 型チェック＆ビルド確認**

```bash
npx tsc --noEmit
```

期待結果: エラーなし。`isSettingsOpen` の参照が残っていれば「Cannot find name 'isSettingsOpen'」と表示されるので、見逃した箇所を修正する。

- [ ] **Step 8: コミット**

```bash
git add src/App.tsx
git commit -m "feat: replace header+modal with unified tabbar and SettingsTab"
```

---

## Task 6: Footer.tsx を更新

**Files:**
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: ロゴテキストを追加する**

`src/components/Footer.tsx` を以下に置き換える：

```tsx
import { type CSSProperties } from 'react';

const FOOTER_STYLE: CSSProperties = {
  padding: '1.5rem 1rem',
  textAlign: 'center',
  fontSize: '0.72rem',
  color: '#c0c6d4',
  borderTop: '1px solid #ebeef5',
  marginTop: '1.5rem',
  background: '#fafbfd',
};

const LINK_STYLE: CSSProperties = {
  color: '#b0b8c9',
  textDecoration: 'none',
  margin: '0 0.6rem',
};

const LOGO_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#b0b8c9',
  letterSpacing: '0.04em',
  marginBottom: '0.5rem',
};

export function Footer() {
  return (
    <footer style={FOOTER_STYLE}>
      <span style={LOGO_STYLE}>Orch.Weather</span>
      <a href="/privacy-policy" style={LINK_STYLE}>プライバシーポリシー</a>
    </footer>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/Footer.tsx
git commit -m "feat: add logo text to footer"
```

---

## Task 7: SettingsModal.tsx を削除・動作確認

**Files:**
- Delete: `src/SettingsModal.tsx`

- [ ] **Step 1: SettingsModal.tsx を削除する**

```bash
git rm src/SettingsModal.tsx
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npx tsc --noEmit
npm run build
```

期待結果: エラーなし。`SettingsModal` への参照が残っていれば「Module not found」が出るので修正する。

- [ ] **Step 3: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザで以下を確認する：

| 確認項目 | 期待動作 |
|---------|---------|
| タブバー表示 | アイコン＋天気情報・比較分析・⚙設定の3タブが並ぶ |
| Desktop: タブバー右端 | アバター＋ログアウトボタンが表示される |
| Mobile(375px幅): タブバー | 右端にアバター/ログアウトが表示されない |
| 設定タブ → 地点設定 | 地点リストが表示され編集・削除が動作する |
| 設定タブ → 地点設定 | 「現在地で登録」ボタンをタップすると位置情報ダイアログが出る |
| 設定タブ → 地点設定 | 位置情報許可後、フォームに緯度経度が自動入力される |
| 設定タブ → 気象情報 | プレースホルダーメッセージが表示される |
| 設定タブ → 比較分析 | 基準温度・累積設定が表示され保存できる |
| Mobile: 設定タブ → 上部 | アバター＋表示名＋ログアウトボタンが表示される |
| フッター | 「Orch.Weather」テキストが表示される |
| 旧SettingsModal | 表示されない・エラーが出ない |

- [ ] **Step 4: 最終コミット**

```bash
git add -A
git commit -m "feat: remove SettingsModal, complete settings UI redesign"
```

---

## 補足: React.CSSProperties の型エラーについて

`AnalysisSettings.tsx` と `LocationSettings.tsx` で `React.CSSProperties` を型として使用しているが、これらのファイルは React を名前空間としてインポートしていない。TypeScript チェックでエラーが出た場合は、ファイル先頭に以下を追加する：

```tsx
import type { CSSProperties } from 'react';
```

そして `React.CSSProperties` を `CSSProperties` に置き換える（例: `const SAVE_BTN: CSSProperties = {`）。

---

## 補足: lucide-react の Loader2 アイコンについて

Task 3 の `LocationSettings.tsx` で `Loader2` を使用している。lucide-react にこのアイコンが存在しない場合は `RefreshCw` で代替する：

```tsx
// Loader2 が存在しない場合:
import { MapPin, Plus, Save, Trash2, RefreshCw } from 'lucide-react';

// 使用箇所:
<RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
```

スピンアニメーション用に `App.css` か `index.css` に以下を追加する（未定義の場合）：

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```
