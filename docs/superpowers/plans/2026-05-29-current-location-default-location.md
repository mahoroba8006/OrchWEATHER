# 現在地表示・デフォルト地点機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全タブに「現在地を表示」ボタンを追加し、デフォルト地点設定と起動時自動位置取得を実装する

**Architecture:** Zustand ストアに `geoLocation`（仮想地点 id=`'__geo__'`）と `geoStatus` を追加し全タブで共有する。デフォルト地点は `UserSettings.defaultLocationId` として Firestore に保存。起動時に App.tsx で一回だけ自動 geo フェッチを行う。

**Tech Stack:** React 19 + TypeScript + Zustand + Firestore + Geolocation API

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `src/lib/geo.ts` | **新規作成** | `GEO_OPTIONS`, `getGeoErrorMessage` の共有ユーティリティ |
| `src/store.ts` | 修正 | `geoLocation`, `geoStatus`, `defaultLocationId` 関連追加 |
| `src/lib/userRepository.ts` | 修正 | `defaultLocationId` の読み書き追加 |
| `src/hooks/useWeather.ts` | 修正 | `locationId === '__geo__'` のとき `geoLocation` を使用 |
| `src/components/settings/LocationSettings.tsx` | 修正 | デフォルト地点 UI 追加 |
| `src/App.tsx` | 修正 | 起動時 geo フェッチ・`getLocationName`・分析 dropdown |
| `src/components/weather/WeatherTab.tsx` | 修正 | 現在地ボタン・初期選択ロジック・`__geo__` オプション |
| `src/components/weather/HistoricalWeatherTab.tsx` | 修正 | WeatherTab と同様 |

---

## Task 1: geo ユーティリティの共有ファイル作成

**Files:**
- Create: `src/lib/geo.ts`
- Modify: `src/components/settings/LocationSettings.tsx:6-23`（既存の重複を削除して import に変更）

- [ ] **Step 1: `src/lib/geo.ts` を作成する**

```typescript
// src/lib/geo.ts
export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

export function getGeoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return '位置情報の許可が必要です。ブラウザの設定からオンにしてください。';
    case err.TIMEOUT:
      return '位置情報の取得がタイムアウトしました。再試行してください。';
    default:
      return '位置情報の取得に失敗しました。再試行してください。';
  }
}

export const GEO_SUPPORTED =
  typeof navigator !== 'undefined' && 'geolocation' in navigator;
```

- [ ] **Step 2: `LocationSettings.tsx` の重複定義を import に差し替える**

`src/components/settings/LocationSettings.tsx` の先頭部分を変更する。

変更前:
```typescript
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

const GEO_SUPPORTED =
  typeof navigator !== 'undefined' && 'geolocation' in navigator;
```

変更後（ファイル先頭の import に追加して上記を削除）:
```typescript
import { GEO_OPTIONS, getGeoErrorMessage, GEO_SUPPORTED } from '../../lib/geo';

type GeoStatus = 'idle' | 'loading' | 'error';
```

- [ ] **Step 3: ビルドエラーがないことを確認する**

```bash
cd c:\dev\気象アプリ && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミットする**

```bash
git add src/lib/geo.ts src/components/settings/LocationSettings.tsx
git commit -m "refactor: extract geo utilities to src/lib/geo.ts"
```

---

## Task 2: Store + UserSettings に `geoLocation` / `defaultLocationId` を追加

**Files:**
- Modify: `src/store.ts`
- Modify: `src/lib/userRepository.ts`

- [ ] **Step 1: `UserSettings` インターフェースに `defaultLocationId` を追加する**

`src/store.ts` の `UserSettings` インターフェースを変更する。

変更前:
```typescript
export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  riskThresholds:       RiskThresholds;
}
```

変更後:
```typescript
export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  riskThresholds:       RiskThresholds;
  defaultLocationId:    string | null;
}
```

- [ ] **Step 2: `AppState` インターフェースに geo 関連フィールドとアクションを追加する**

`src/store.ts` の `interface AppState {` ブロックを変更する。

変更前:
```typescript
interface AppState {
  user: User | null;
  authLoading: boolean;
  locations: LocationInfo[];
  locationsLoading: boolean;
  userSettings: UserSettings | null;

  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  loadLocations: (uid: string) => Promise<void>;
  loadUserSettings: (uid: string) => Promise<void>;
  updateBaseTempSettings: (settings: [number, number]) => Promise<void>;
  updateAccumStartDates: (dates: AccumStartDates) => Promise<void>;
  updateAccumDeltaThresholds: (thresholds: AccumDeltaThresholds) => Promise<void>;
  updateRiskThresholds: (thresholds: RiskThresholds) => Promise<void>;
  addLocation: (loc: Omit<LocationInfo, 'id'>) => Promise<void>;
  updateLocation: (id: string, loc: Partial<LocationInfo>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
}
```

変更後:
```typescript
interface AppState {
  user: User | null;
  authLoading: boolean;
  locations: LocationInfo[];
  locationsLoading: boolean;
  userSettings: UserSettings | null;
  geoLocation: LocationInfo | null;
  geoStatus: 'idle' | 'loading' | 'error';

  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setGeoLocation: (loc: LocationInfo | null) => void;
  setGeoStatus: (status: 'idle' | 'loading' | 'error') => void;
  loadLocations: (uid: string) => Promise<void>;
  loadUserSettings: (uid: string) => Promise<void>;
  updateBaseTempSettings: (settings: [number, number]) => Promise<void>;
  updateAccumStartDates: (dates: AccumStartDates) => Promise<void>;
  updateAccumDeltaThresholds: (thresholds: AccumDeltaThresholds) => Promise<void>;
  updateRiskThresholds: (thresholds: RiskThresholds) => Promise<void>;
  updateDefaultLocationId: (id: string | null) => Promise<void>;
  addLocation: (loc: Omit<LocationInfo, 'id'>) => Promise<void>;
  updateLocation: (id: string, loc: Partial<LocationInfo>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
}
```

- [ ] **Step 3: `useAppStore` の初期状態と実装を追加する**

`src/store.ts` の `useAppStore = create<AppState>()((set, get) => ({` ブロックの初期値部分に追加する。

変更前:
```typescript
export const useAppStore = create<AppState>()((set, get) => ({
  user: null,
  authLoading: true,
  locations: [],
  locationsLoading: false,
  userSettings: null,

  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
```

変更後:
```typescript
export const useAppStore = create<AppState>()((set, get) => ({
  user: null,
  authLoading: true,
  locations: [],
  locationsLoading: false,
  userSettings: null,
  geoLocation: null,
  geoStatus: 'idle',

  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  setGeoLocation: (loc) => set({ geoLocation: loc }),
  setGeoStatus: (status) => set({ geoStatus: status }),
```

- [ ] **Step 4: `updateDefaultLocationId` アクションを追加する**

`src/store.ts` の `updateRiskThresholds` アクションの直後（`addLocation` の前）に追加する。

変更前:
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

  addLocation: async (loc) => {
```

変更後:
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

  updateDefaultLocationId: async (id) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateDefaultLocationIdRemote(uid, id);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, defaultLocationId: id }
        : null,
    }));
  },

  addLocation: async (loc) => {
```

- [ ] **Step 5: `store.ts` の import に `updateDefaultLocationId` を追加する**

`src/store.ts` の先頭 import を変更する。

変更前:
```typescript
import {
  getUserSettings,
  updateBaseTempSettings as updateBaseTempSettingsRemote,
  updateAccumStartDates as updateAccumStartDatesRemote,
  updateAccumDeltaThresholds as updateAccumDeltaThresholdsRemote,
  updateRiskThresholds as updateRiskThresholdsRemote,
} from './lib/userRepository';
```

変更後:
```typescript
import {
  getUserSettings,
  updateBaseTempSettings as updateBaseTempSettingsRemote,
  updateAccumStartDates as updateAccumStartDatesRemote,
  updateAccumDeltaThresholds as updateAccumDeltaThresholdsRemote,
  updateRiskThresholds as updateRiskThresholdsRemote,
  updateDefaultLocationId as updateDefaultLocationIdRemote,
} from './lib/userRepository';
```

- [ ] **Step 6: `userRepository.ts` の `getUserSettings` に `defaultLocationId` を追加する**

`src/lib/userRepository.ts` の `getUserSettings` を変更する。

変更前:
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

変更後:
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
  const defaultLocationId: string | null = data?.defaultLocationId ?? null;
  return { baseTempSettings, accumStartDates, accumDeltaThresholds, riskThresholds, defaultLocationId };
}
```

- [ ] **Step 7: `userRepository.ts` に `updateDefaultLocationId` 関数を追加する**

`src/lib/userRepository.ts` のファイル末尾に追加する。

```typescript
export async function updateDefaultLocationId(
  uid: string,
  id: string | null
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { defaultLocationId: id }, { merge: true });
}
```

- [ ] **Step 8: ビルドエラーがないことを確認する**

```bash
cd c:\dev\気象アプリ && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 9: コミットする**

```bash
git add src/store.ts src/lib/userRepository.ts
git commit -m "feat: add geoLocation/geoStatus to store and defaultLocationId to UserSettings"
```

---

## Task 3: `useWeatherData` の `__geo__` 対応

**Files:**
- Modify: `src/hooks/useWeather.ts`

- [ ] **Step 1: `geoLocation` を store から取得し `__geo__` を解決するよう変更する**

`src/hooks/useWeather.ts` を以下の通り変更する。

変更前（全体）:
```typescript
import { useState, useEffect, useRef } from 'react';
import { fetchWeatherData, type WeatherData } from '../api/weather';
import { useAppStore } from '../store';

export interface CompareTarget {
  id: string;
  locationId: string;
  year: number;
}

type TargetSpec = { locationId: string; year: number };

export function useWeatherData(targets: CompareTarget[]) {
  const { locations } = useAppStore();
  const [data, setData] = useState<Record<string, WeatherData>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 直前にフェッチ済みのターゲット仕様を記憶する（id → {locationId, year}）
  const fetchedSpecsRef = useRef<Map<string, TargetSpec>>(new Map());

  useEffect(() => {
    if (targets.length === 0) {
      setData({});
      fetchedSpecsRef.current.clear();
      return;
    }

    // 変更・追加されたターゲットだけ抽出
    const targetsToFetch = targets.filter(target => {
      const prev = fetchedSpecsRef.current.get(target.id);
      return !prev || prev.locationId !== target.locationId || prev.year !== target.year;
    });

    if (targetsToFetch.length === 0) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const promises = targetsToFetch.map(async (target) => {
          const loc = locations.find(l => l.id === target.locationId);
          if (!loc) {
            console.warn(`対象地点が見つかりません(削除済み等): ${target.locationId}`);
            return { id: target.id, result: { year: target.year, daily: [] } as WeatherData };
          }
          const result = await fetchWeatherData(loc.lat, loc.lon, target.year);
          return { id: target.id, result };
        });

        const results = await Promise.all(promises);

        if (isMounted) {
          // フェッチ済み仕様を更新
          targetsToFetch.forEach(t => {
            fetchedSpecsRef.current.set(t.id, { locationId: t.locationId, year: t.year });
          });

          setData(prev => {
            const next: Record<string, WeatherData> = {};
            // 現在のターゲット分だけ残す（削除されたターゲットを除去）
            const currentIds = new Set(targets.map(t => t.id));
            Object.entries(prev).forEach(([id, d]) => {
              if (currentIds.has(id)) next[id] = d;
            });
            // 新規・更新分を上書き
            results.forEach(({ id, result }) => { next[id] = result; });
            return next;
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'データの取得に失敗しました');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [JSON.stringify(targets), locations]);

  return { data, loading, error };
}
```

変更後（全体）:
```typescript
import { useState, useEffect, useRef } from 'react';
import { fetchWeatherData, type WeatherData } from '../api/weather';
import { useAppStore } from '../store';

export interface CompareTarget {
  id: string;
  locationId: string;
  year: number;
}

type TargetSpec = { locationId: string; year: number };

export function useWeatherData(targets: CompareTarget[]) {
  const { locations, geoLocation } = useAppStore();
  const [data, setData] = useState<Record<string, WeatherData>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 直前にフェッチ済みのターゲット仕様を記憶する（id → {locationId, year}）
  const fetchedSpecsRef = useRef<Map<string, TargetSpec>>(new Map());
  // geoLocation の変化を検知して __geo__ エントリを無効化する
  const prevGeoKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (targets.length === 0) {
      setData({});
      fetchedSpecsRef.current.clear();
      return;
    }

    // geoLocation が変化したとき __geo__ キャッシュを無効化して再取得を促す
    const geoKey = geoLocation ? `${geoLocation.lat},${geoLocation.lon}` : null;
    if (geoKey !== prevGeoKeyRef.current) {
      prevGeoKeyRef.current = geoKey;
      fetchedSpecsRef.current.forEach((spec, id) => {
        if (spec.locationId === '__geo__') fetchedSpecsRef.current.delete(id);
      });
    }

    // 変更・追加されたターゲットだけ抽出
    const targetsToFetch = targets.filter(target => {
      const prev = fetchedSpecsRef.current.get(target.id);
      return !prev || prev.locationId !== target.locationId || prev.year !== target.year;
    });

    if (targetsToFetch.length === 0) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const promises = targetsToFetch.map(async (target) => {
          // __geo__ は store の geoLocation を使う
          const loc = target.locationId === '__geo__'
            ? (geoLocation ?? undefined)
            : locations.find(l => l.id === target.locationId);
          if (!loc) {
            console.warn(`対象地点が見つかりません(削除済み等): ${target.locationId}`);
            return { id: target.id, result: { year: target.year, daily: [] } as WeatherData };
          }
          const result = await fetchWeatherData(loc.lat, loc.lon, target.year);
          return { id: target.id, result };
        });

        const results = await Promise.all(promises);

        if (isMounted) {
          // フェッチ済み仕様を更新
          targetsToFetch.forEach(t => {
            fetchedSpecsRef.current.set(t.id, { locationId: t.locationId, year: t.year });
          });

          setData(prev => {
            const next: Record<string, WeatherData> = {};
            // 現在のターゲット分だけ残す（削除されたターゲットを除去）
            const currentIds = new Set(targets.map(t => t.id));
            Object.entries(prev).forEach(([id, d]) => {
              if (currentIds.has(id)) next[id] = d;
            });
            // 新規・更新分を上書き
            results.forEach(({ id, result }) => { next[id] = result; });
            return next;
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'データの取得に失敗しました');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [JSON.stringify(targets), geoLocation, locations]);

  return { data, loading, error };
}
```

- [ ] **Step 2: ビルドエラーがないことを確認する**

```bash
cd c:\dev\気象アプリ && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミットする**

```bash
git add src/hooks/useWeather.ts
git commit -m "feat: support __geo__ locationId in useWeatherData"
```

---

## Task 4: LocationSettings にデフォルト地点 UI を追加

**Files:**
- Modify: `src/components/settings/LocationSettings.tsx`

- [ ] **Step 1: `useAppStore` から `userSettings` と `updateDefaultLocationId` を取得する**

`src/components/settings/LocationSettings.tsx` の `LocationSettings` 関数の冒頭を変更する。

変更前:
```typescript
export function LocationSettings() {
  const { locations, addLocation, updateLocation, deleteLocation } =
    useAppStore();
```

変更後:
```typescript
export function LocationSettings() {
  const { locations, addLocation, updateLocation, deleteLocation, userSettings, updateDefaultLocationId } =
    useAppStore();
  const defaultLocationId = userSettings?.defaultLocationId ?? null;
```

- [ ] **Step 2: 地点カードのボタン行にデフォルト設定 UI を追加する**

各地点カードの `<div style={{ display: 'flex', gap: '0.5rem' }}>` ブロックを変更する。

変更前:
```tsx
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={() => handleEdit(loc)}>
              編集
            </button>
            <button
              className="secondary"
              onClick={() => handleDelete(loc.id)}
              style={{ color: 'var(--chart-temp)' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
```

変更後:
```tsx
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {defaultLocationId === loc.id ? (
              <>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--accent-color)',
                  background: 'rgba(13,148,136,0.12)',
                  border: '1px solid rgba(13,148,136,0.3)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.6rem',
                  whiteSpace: 'nowrap',
                }}>
                  ★ デフォルト
                </span>
                <button
                  className="secondary"
                  onClick={() => updateDefaultLocationId(null)}
                  style={{ fontSize: '0.75rem' }}
                >
                  解除
                </button>
              </>
            ) : (
              <button
                className="secondary"
                onClick={() => updateDefaultLocationId(loc.id)}
                style={{ fontSize: '0.75rem' }}
              >
                デフォルトに設定
              </button>
            )}
            <button className="secondary" onClick={() => handleEdit(loc)}>
              編集
            </button>
            <button
              className="secondary"
              onClick={() => handleDelete(loc.id)}
              style={{ color: 'var(--chart-temp)' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
```

- [ ] **Step 3: ビルドエラーがないことを確認する**

```bash
cd c:\dev\気象アプリ && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: 手動確認**

`npm run dev` でアプリを起動し、設定タブ→地点設定を開く。

- 地点カードに「デフォルトに設定」ボタンが表示されること
- ボタンを押すと「★ デフォルト」バッジ＋「解除」ボタンに切り替わること
- 別の地点で「デフォルトに設定」を押すと前の地点のデフォルトが解除され新しい地点がデフォルトになること
- Firestore コンソール（または再読み込み後）に `defaultLocationId` が保存されていること

- [ ] **Step 5: コミットする**

```bash
git add src/components/settings/LocationSettings.tsx
git commit -m "feat: add default location UI to LocationSettings"
```

---

## Task 5: App.tsx — 起動時 geo フェッチ・`getLocationName`・分析 dropdown

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: `useAppStore` の分解に geo 関連を追加する**

`src/App.tsx` の `function App()` 内の `useAppStore` 分解を変更する。

変更前:
```typescript
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings } = useAppStore();
```

変更後:
```typescript
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings, geoLocation, geoStatus, setGeoLocation, setGeoStatus } = useAppStore();
```

- [ ] **Step 2: `geoAttemptedRef` を追加し起動時 geo フェッチの `useEffect` を追加する**

`src/App.tsx` の auth `useEffect`（`onAuthStateChanged` を呼ぶもの）の直後に以下を追加する。
追加位置: `const initialLocation = locations.length > 0 ? locations[0].id : '';` の前。

```typescript
  const geoAttemptedRef = useRef(false);

  // 起動時: デフォルト地点がなければ自動で現在地を取得する
  useEffect(() => {
    if (authLoading) return;
    if (geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;

    const defaultLocId = userSettings?.defaultLocationId;
    const hasValidDefault = defaultLocId && locations.some(l => l.id === defaultLocId);
    if (hasValidDefault) return;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('error');
      return;
    }

    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
        setGeoStatus('idle');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, [authLoading]);
```

- [ ] **Step 3: `getLocationName` に `__geo__` 対応を追加する**

`src/App.tsx` の `getLocationName` を変更する。

変更前:
```typescript
  const getLocationName = (id: string) => {
    const loc = locations.find(l => l.id === id);
    return loc ? loc.name : '未設定';
  };
```

変更後:
```typescript
  const getLocationName = (id: string) => {
    if (id === '__geo__') return '現在地';
    const loc = locations.find(l => l.id === id);
    return loc ? loc.name : '未設定';
  };
```

- [ ] **Step 4: 削除済み地点復旧 `useEffect` に `__geo__` を除外する**

`src/App.tsx` の locations 変化時の復旧 useEffect を変更する。

変更前:
```typescript
  useEffect(() => {
    setTargets(prev => {
      let changed = false;
      const validIds = new Set(locations.map(l => l.id));
      const next = prev.map(t => {
        if (!validIds.has(t.locationId)) {
          changed = true;
          return { ...t, locationId: locations.length > 0 ? locations[0].id : '' };
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, [locations]);
```

変更後:
```typescript
  useEffect(() => {
    setTargets(prev => {
      let changed = false;
      const validIds = new Set(locations.map(l => l.id));
      const defaultLocId = userSettings?.defaultLocationId;
      const hasValidDefault = defaultLocId && validIds.has(defaultLocId);
      const next = prev.map(t => {
        // __geo__ は仮想地点なので復旧対象外
        if (t.locationId === '__geo__') return t;
        if (!validIds.has(t.locationId)) {
          changed = true;
          const fallback = hasValidDefault
            ? defaultLocId!
            : locations.length > 0 ? locations[0].id : '';
          return { ...t, locationId: fallback };
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, [locations, userSettings?.defaultLocationId]);
```

- [ ] **Step 5: geoLocation が取得されたとき空の targets を `__geo__` に更新する useEffect を追加する**

`src/App.tsx` の削除済み地点復旧 `useEffect` の直後に追加する。

```typescript
  // geoLocation が取得されたとき locationId が空の targets を __geo__ に切り替える
  useEffect(() => {
    if (!geoLocation) return;
    setTargets(prev => {
      const hasEmpty = prev.some(t => t.locationId === '');
      if (!hasEmpty) return prev;
      return prev.map(t => t.locationId === '' ? { ...t, locationId: '__geo__' } : t);
    });
  }, [geoLocation]);
```

- [ ] **Step 6: 分析タブの地点ドロップダウンに `__geo__` オプションを追加する**

`src/App.tsx` の分析タブ内の targets ループの地点 `<select>` を変更する（行 1356-1364 付近）。

変更前:
```tsx
                <select
                  value={target.locationId}
                  onChange={(e) => updateTarget(target.id, 'locationId', e.target.value)}
                  style={{ flex: 2, minWidth: 0, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                  {locations.length === 0 && <option value="">地点未設定</option>}
                </select>
```

変更後:
```tsx
                <select
                  value={target.locationId}
                  onChange={(e) => updateTarget(target.id, 'locationId', e.target.value)}
                  style={{ flex: 2, minWidth: 0, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                >
                  {geoLocation && <option value="__geo__">📍 現在地</option>}
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                  {!geoLocation && locations.length === 0 && <option value="">地点未設定</option>}
                </select>
```

- [ ] **Step 7: ビルドエラーがないことを確認する**

```bash
cd c:\dev\気象アプリ && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 8: コミットする**

```bash
git add src/App.tsx
git commit -m "feat: startup geo fetch, getLocationName __geo__ support, analysis tab geo dropdown"
```

---

## Task 6: WeatherTab に現在地ボタンと初期選択ロジックを追加

**Files:**
- Modify: `src/components/weather/WeatherTab.tsx`

- [ ] **Step 1: import を更新する**

`src/components/weather/WeatherTab.tsx` の先頭を変更する。

変更前:
```typescript
import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore, DEFAULT_RISK_THRESHOLDS } from '../../store';
```

変更後:
```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw, MapPin, Loader2 } from 'lucide-react';
import { useAppStore, DEFAULT_RISK_THRESHOLDS } from '../../store';
import { GEO_OPTIONS, getGeoErrorMessage } from '../../lib/geo';
```

- [ ] **Step 2: ストアから geo 関連を取得し、ローカル状態とロジックを追加する**

`src/components/weather/WeatherTab.tsx` の `WeatherTab` 関数冒頭を変更する。

変更前:
```typescript
export function WeatherTab() {
  const { locations, userSettings } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();

  // selectedLocationId が未設定の場合は最初の地点にフォールバック
  const location = locations.find(l => l.id === selectedLocationId) ?? locations[0] ?? null;
```

変更後:
```typescript
export function WeatherTab() {
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [buttonGeoLoading, setButtonGeoLoading] = useState(false);
  const [buttonGeoError, setButtonGeoError] = useState('');
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();

  // デフォルト地点 or geoLocation が揃ったとき初期選択を確定させる
  useEffect(() => {
    if (selectedLocationId !== '') return;
    const defaultLocId = userSettings?.defaultLocationId;
    if (defaultLocId && locations.some(l => l.id === defaultLocId)) {
      setSelectedLocationId(defaultLocId);
      return;
    }
    if (geoLocation) {
      setSelectedLocationId('__geo__');
    }
  }, [selectedLocationId, userSettings?.defaultLocationId, geoLocation, locations]);

  // 地点の解決: __geo__ → geoLocation、それ以外 → locations から検索してフォールバック
  const location = (() => {
    if (selectedLocationId === '__geo__') return geoLocation;
    return locations.find(l => l.id === selectedLocationId) ?? geoLocation ?? locations[0] ?? null;
  })();

  // 現在地ボタンのハンドラ
  const handleGetCurrentLocation = () => {
    setButtonGeoLoading(true);
    setButtonGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
        setSelectedLocationId('__geo__');
        setButtonGeoLoading(false);
      },
      (err) => {
        setButtonGeoError(getGeoErrorMessage(err));
        setButtonGeoLoading(false);
      },
      GEO_OPTIONS,
    );
  };
```

- [ ] **Step 3: 地点未登録時の表示ロジックを更新する**

`src/components/weather/WeatherTab.tsx` の地点未登録チェックを変更する。

変更前:
```typescript
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
```

変更後:
```typescript
  // 地点未登録かつ geo も未取得
  if (locations.length === 0 && !geoLocation) {
    const emptyStyle = {
      maxWidth: 1200,
      margin: '0 auto',
      padding: '4rem 1rem',
      textAlign: 'center' as const,
      color: '#8a93a6',
    };
    if (geoStatus === 'loading') {
      return (
        <div style={emptyStyle}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '1rem' }}>位置情報を取得中…</p>
        </div>
      );
    }
    if (geoStatus === 'error') {
      return (
        <div style={emptyStyle}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>位置情報が取得できませんでした</p>
          <p style={{ fontSize: '0.85rem' }}>設定タブから地点を登録するか、上のボタンで現在地を取得してください</p>
        </div>
      );
    }
    return (
      <div style={emptyStyle}>
        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>地点を登録すると予報が表示されます</p>
        <p style={{ fontSize: '0.85rem' }}>「設定」タブから地点を追加してください</p>
      </div>
    );
  }
```

- [ ] **Step 4: ドロップダウンと「現在地を表示」ボタンの UI を更新する**

`src/components/weather/WeatherTab.tsx` のツールバー `glass-panel` 内の `<select>` 部分を変更する。

変更前:
```tsx
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{
            fontSize: '0.85rem',
            padding: '0.4rem 0.75rem',
          }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
```

変更後:
```tsx
        <button
          onClick={handleGetCurrentLocation}
          disabled={buttonGeoLoading}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.8rem',
            background: 'rgba(13,148,136,0.12)',
            color: 'var(--accent-color)',
            border: '1px solid rgba(13,148,136,0.3)',
            borderRadius: 'var(--radius-md, 6px)',
            cursor: buttonGeoLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            opacity: buttonGeoLoading ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {buttonGeoLoading
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />取得中…</>
            : <><MapPin size={14} />現在地を表示</>}
        </button>
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
        >
          {geoLocation && <option value="__geo__">📍 現在地</option>}
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        {buttonGeoError && (
          <span style={{ fontSize: '0.78rem', color: '#c62828', width: '100%' }}>
            ⚠ {buttonGeoError}
          </span>
        )}
        <span style={{ flex: 1 }} />
```

- [ ] **Step 5: ビルドエラーがないことを確認する**

```bash
cd c:\dev\気象アプリ && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 6: 手動確認**

`npm run dev` でアプリを起動し、天気情報タブを確認する。

- 「現在地を表示」ボタンが表示されること
- ボタンを押すと位置情報許可ダイアログが出て、許可後にドロップダウンで「📍 現在地」が選択されること
- 現在地の天気データが読み込まれること
- ドロップダウンで登録地点に切り替えられること
- 地点登録がない状態でアプリを開いたとき、自動的に現在地の天気が表示されること

- [ ] **Step 7: コミットする**

```bash
git add src/components/weather/WeatherTab.tsx
git commit -m "feat: add current location button and geo support to WeatherTab"
```

---

## Task 7: HistoricalWeatherTab に現在地ボタンと初期選択ロジックを追加

**Files:**
- Modify: `src/components/weather/HistoricalWeatherTab.tsx`

- [ ] **Step 1: import を更新する**

`src/components/weather/HistoricalWeatherTab.tsx` の先頭を変更する。

変更前:
```typescript
// src/components/weather/HistoricalWeatherTab.tsx
import { useState, useRef, useCallback } from 'react';
import { useAppStore, DEFAULT_RISK_THRESHOLDS } from '../../store';
```

変更後:
```typescript
// src/components/weather/HistoricalWeatherTab.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useAppStore, DEFAULT_RISK_THRESHOLDS } from '../../store';
import { GEO_OPTIONS, getGeoErrorMessage } from '../../lib/geo';
```

- [ ] **Step 2: ストアから geo 関連を取得し、ローカル状態とロジックを追加する**

`src/components/weather/HistoricalWeatherTab.tsx` の `HistoricalWeatherTab` 関数冒頭を変更する。

変更前:
```typescript
export function HistoricalWeatherTab() {
  const { locations, userSettings } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [yesterday] = useState(jstYesterday);
  const [startDate, setStartDate] = useState<string>(yesterday);
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();

  // selectedLocationId が未設定の場合は最初の地点にフォールバック
  const location = locations.find(l => l.id === selectedLocationId) ?? locations[0] ?? null;
```

変更後:
```typescript
export function HistoricalWeatherTab() {
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [buttonGeoLoading, setButtonGeoLoading] = useState(false);
  const [buttonGeoError, setButtonGeoError] = useState('');
  const [yesterday] = useState(jstYesterday);
  const [startDate, setStartDate] = useState<string>(yesterday);
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();

  // デフォルト地点 or geoLocation が揃ったとき初期選択を確定させる
  useEffect(() => {
    if (selectedLocationId !== '') return;
    const defaultLocId = userSettings?.defaultLocationId;
    if (defaultLocId && locations.some(l => l.id === defaultLocId)) {
      setSelectedLocationId(defaultLocId);
      return;
    }
    if (geoLocation) {
      setSelectedLocationId('__geo__');
    }
  }, [selectedLocationId, userSettings?.defaultLocationId, geoLocation, locations]);

  // 地点の解決: __geo__ → geoLocation、それ以外 → locations から検索してフォールバック
  const location = (() => {
    if (selectedLocationId === '__geo__') return geoLocation;
    return locations.find(l => l.id === selectedLocationId) ?? geoLocation ?? locations[0] ?? null;
  })();

  // 現在地ボタンのハンドラ
  const handleGetCurrentLocation = () => {
    setButtonGeoLoading(true);
    setButtonGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
        setSelectedLocationId('__geo__');
        setButtonGeoLoading(false);
      },
      (err) => {
        setButtonGeoError(getGeoErrorMessage(err));
        setButtonGeoLoading(false);
      },
      GEO_OPTIONS,
    );
  };
```

- [ ] **Step 3: 地点未登録時の表示ロジックを更新する**

`src/components/weather/HistoricalWeatherTab.tsx` の地点未登録チェックを変更する。

変更前:
```typescript
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
          地点を登録すると過去の気象が表示されます
        </p>
        <p style={{ fontSize: '0.85rem' }}>
          「分析」タブの設定から地点を追加してください
        </p>
      </div>
    );
  }
```

変更後:
```typescript
  // 地点未登録かつ geo も未取得
  if (locations.length === 0 && !geoLocation) {
    const emptyStyle = {
      maxWidth: 1200,
      margin: '0 auto',
      padding: '4rem 1rem',
      textAlign: 'center' as const,
      color: '#8a93a6',
    };
    if (geoStatus === 'loading') {
      return (
        <div style={emptyStyle}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '1rem' }}>位置情報を取得中…</p>
        </div>
      );
    }
    if (geoStatus === 'error') {
      return (
        <div style={emptyStyle}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>位置情報が取得できませんでした</p>
          <p style={{ fontSize: '0.85rem' }}>設定タブから地点を登録するか、上のボタンで現在地を取得してください</p>
        </div>
      );
    }
    return (
      <div style={emptyStyle}>
        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>地点を登録すると過去の気象が表示されます</p>
        <p style={{ fontSize: '0.85rem' }}>「設定」タブから地点を追加してください</p>
      </div>
    );
  }
```

- [ ] **Step 4: ドロップダウンと「現在地を表示」ボタンの UI を更新する**

`src/components/weather/HistoricalWeatherTab.tsx` のツールバー `glass-panel` 内のセレクター部分を変更する。

変更前:
```tsx
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          開始日
        </span>
```

変更後:
```tsx
        <button
          onClick={handleGetCurrentLocation}
          disabled={buttonGeoLoading}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.8rem',
            background: 'rgba(13,148,136,0.12)',
            color: 'var(--accent-color)',
            border: '1px solid rgba(13,148,136,0.3)',
            borderRadius: 'var(--radius-md, 6px)',
            cursor: buttonGeoLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            opacity: buttonGeoLoading ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {buttonGeoLoading
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />取得中…</>
            : <><MapPin size={14} />現在地を表示</>}
        </button>
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
        >
          {geoLocation && <option value="__geo__">📍 現在地</option>}
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        {buttonGeoError && (
          <span style={{ fontSize: '0.78rem', color: '#c62828', width: '100%' }}>
            ⚠ {buttonGeoError}
          </span>
        )}

        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          開始日
        </span>
```

- [ ] **Step 5: ビルドエラーがないことを確認する**

```bash
cd c:\dev\気象アプリ && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 6: 手動確認**

`npm run dev` でアプリを起動し、「あの時の天気」タブを確認する。

- 「現在地を表示」ボタンが表示されること
- ボタンを押すと現在地の過去天気データが読み込まれること
- 開始日を変更しても現在地が維持されること
- 登録地点への切り替えが正常に動作すること

- [ ] **Step 7: コミットする**

```bash
git add src/components/weather/HistoricalWeatherTab.tsx
git commit -m "feat: add current location button and geo support to HistoricalWeatherTab"
```

---

## 完了後の最終確認チェックリスト

- [ ] デフォルト地点を設定 → アプリを再起動 → その地点が表示されること
- [ ] デフォルト地点を「解除」→ アプリを再起動 → 現在地が自動取得されること
- [ ] 地点登録なし → アプリを開く → 現在地が自動表示されること
- [ ] GPS 拒否 → アプリを開く → エラーメッセージが表示されること
- [ ] 分析タブのドロップダウンで「📍 現在地」が選択可能であること
- [ ] `npx tsc --noEmit` がエラーなしで完了すること
