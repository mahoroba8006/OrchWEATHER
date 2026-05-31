# 地点登録マップ選択 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 地点登録フォームに「マップから選ぶ」ボタンを追加し、Leaflet マップ上でピンを立てることで lat/lon を入力できるようにする。

**Architecture:** `LocationMapModal.tsx`（新規）に full-screen モーダル + Leaflet マップを実装。クリック・ドラッグでピン操作後、確定時に lat/lon と地名候補（GSI 逆ジオコーディング経由）を親に返す。`LocationSettings.tsx` に「マップから選ぶ」ボタンを追加してモーダルを呼び出し、返値で `formData` を更新する。`store.ts` / `locationRepository.ts` / `jmaAreaResolver.ts` はノータッチ。

**Tech Stack:** leaflet@^1（vanilla Leaflet、useEffect で制御）、@types/leaflet（型定義）、react-leaflet は使わない（React 19 との peer dep 競合を回避）

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `package.json` | 自動更新 | `leaflet` 依存追加 |
| `src/main.tsx` | 追記 | `leaflet/dist/leaflet.css` import |
| `src/components/settings/LocationMapModal.tsx` | 新規 | マップモーダルコンポーネント |
| `src/components/settings/LocationSettings.tsx` | 変更 | 「マップから選ぶ」ボタン + モーダル呼び出し |

---

## Task 1: leaflet パッケージのインストール

**Files:**
- Modify: `package.json`（自動）
- Modify: `src/main.tsx`

- [ ] **Step 1: leaflet をインストール**

```bash
npm install leaflet
npm install -D @types/leaflet
```

期待: `package.json` の `dependencies` に `"leaflet"` が追加される。エラーが出る場合は `npm install leaflet --legacy-peer-deps` を試す。

- [ ] **Step 2: leaflet CSS をグローバルインポートに追加**

`src/main.tsx` を以下に変更（`import './index.css'` の直後に1行追加）:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

期待: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "chore: add leaflet dependency"
```

---

## Task 2: LocationMapModal コンポーネント作成

**Files:**
- Create: `src/components/settings/LocationMapModal.tsx`

- [ ] **Step 1: ファイルを作成**

`src/components/settings/LocationMapModal.tsx` を以下の内容で作成:

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import L from 'leaflet';
import { X, MapPin, Loader2 } from 'lucide-react';
import { resolveJmaAreaCode, getAreaName } from '../../lib/jmaAreaResolver';
import { GEO_OPTIONS } from '../../lib/geo';

// Vite + Leaflet のデフォルトアイコン修正
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'];
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export interface LocationMapModalProps {
  initialLat: number;
  initialLon: number;
  onConfirm: (lat: number, lon: number, suggestedName?: string) => void;
  onClose: () => void;
}

export function LocationMapModal({
  initialLat,
  initialLon,
  onConfirm,
  onClose,
}: LocationMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [markerPos, setMarkerPos] = useState<[number, number]>([initialLat, initialLon]);
  const [resolving, setResolving] = useState(false);

  const handleConfirm = useCallback(async () => {
    setResolving(true);
    const [lat, lon] = markerPos;
    let suggestedName: string | undefined;
    try {
      const code = await resolveJmaAreaCode(lat, lon);
      if (code) suggestedName = getAreaName(code) ?? undefined;
    } catch {
      // 地名解決失敗は無視（lat/lon の確定は続行）
    }
    setResolving(false);
    onConfirm(lat, lon, suggestedName);
  }, [markerPos, onConfirm]);

  // マップ初期化（マウント時1回のみ）
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLon], { draggable: true }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setMarkerPos([
        parseFloat(pos.lat.toFixed(6)),
        parseFloat(pos.lng.toFixed(6)),
      ]);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lon = parseFloat(e.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lon]);
      setMarkerPos([lat, lon]);
    });

    // GPS で現在地に移動（成功したらビューとマーカーも移動）
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        map.setView([lat, lon], 13);
        marker.setLatLng([lat, lon]);
        setMarkerPos([lat, lon]);
      },
      () => {
        // GPS 失敗時は日本全体ビュー
        map.setView([36.5, 138.0], 5);
      },
      GEO_OPTIONS,
    );

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  };

  const panelStyle: CSSProperties = {
    width: '100%',
    maxWidth: '600px',
    background: 'var(--glass-bg, rgba(240,248,252,0.97))',
    borderRadius: 'var(--radius-lg, 12px)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 2rem)',
  };

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panelStyle}>
        {/* ヘッダー */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.8rem 1rem',
            borderBottom: '1px solid rgba(13,148,136,0.2)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <MapPin size={18} style={{ color: 'var(--accent-color)' }} />
            マップから地点を選択
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.2rem',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 地図エリア */}
        <div
          ref={mapContainerRef}
          style={{ flex: 1, minHeight: '300px', height: '55vh' }}
        />

        {/* フッター（座標 + ボタン） */}
        <div
          style={{
            padding: '0.8rem 1rem',
            borderTop: '1px solid rgba(13,148,136,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            緯度: {markerPos[0]} / 経度: {markerPos[1]}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={onClose}>
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={resolving}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.88rem',
                background: resolving
                  ? 'rgba(13,148,136,0.3)'
                  : 'rgba(13,148,136,0.85)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: resolving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {resolving ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <MapPin size={16} />
              )}
              {resolving ? '確認中…' : 'この場所を使用'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

期待: TypeScript エラーなし、ビルド成功。

- [ ] **Step 3: コミット**

```bash
git add src/components/settings/LocationMapModal.tsx
git commit -m "feat: add LocationMapModal (Leaflet map picker)"
```

---

## Task 3: LocationSettings に「マップから選ぶ」ボタンを追加

**Files:**
- Modify: `src/components/settings/LocationSettings.tsx`

- [ ] **Step 1: import を追加**

`LocationSettings.tsx` の import セクション末尾に追加:

```tsx
import { LocationMapModal } from './LocationMapModal';
```

- [ ] **Step 2: `showMapModal` state を追加**

`LocationSettings()` 関数内の `saveError` state 宣言の直後に追加:

```tsx
const [showMapModal, setShowMapModal] = useState(false);
```

- [ ] **Step 3: `handleMapConfirm` ハンドラを追加**

`handleSave` 関数の直前に追加:

```tsx
const handleMapConfirm = (lat: number, lon: number, suggestedName?: string) => {
  setFormData((prev) => ({
    ...prev,
    lat,
    lon,
    // 名称が未入力または初期値の場合のみ候補名で上書き
    name:
      prev.name && prev.name !== '新規地点'
        ? prev.name
        : (suggestedName ?? prev.name),
  }));
  setShowMapModal(false);
};
```

- [ ] **Step 4: 「マップから選ぶ」ボタンを lat/lon 入力の下に追加**

`LocationSettings.tsx` の lat/lon の 2カラム `<div>` の閉じタグ（`</div>`）直後に挿入:

```tsx
{/* マップ選択ボタン */}
<button
  type="button"
  onClick={() => setShowMapModal(true)}
  style={{
    ...greenButtonStyle,
    alignSelf: 'flex-start',
    fontSize: '0.82rem',
  }}
>
  <MapPin size={15} />
  マップから選ぶ
</button>
```

- [ ] **Step 5: `<LocationMapModal>` をレンダリング**

`LocationSettings` の return 文の最後の `</div>` 直前に追加:

```tsx
{showMapModal && editingId && (
  <LocationMapModal
    initialLat={typeof formData.lat === 'number' ? formData.lat : 35.0}
    initialLon={typeof formData.lon === 'number' ? formData.lon : 135.0}
    onConfirm={handleMapConfirm}
    onClose={() => setShowMapModal(false)}
  />
)}
```

- [ ] **Step 6: ビルド確認**

```bash
npm run build
```

期待: エラーなし。

- [ ] **Step 7: dev server で動作確認**

```bash
npm run dev
```

確認事項:
1. 設定タブ → 地点設定 → 「手動で追加」または既存地点の「編集」→ 編集フォームに「マップから選ぶ」ボタンが表示される
2. ボタンをクリック → マップモーダルが開く
3. GPS 取得成功時 → マップが現在地中心・zoom 13 で表示される
4. GPS 取得失敗時 → 日本全体ビュー（zoom 5）で表示される
5. マップ上をクリック → ピンが移動、フッターの座標が更新される
6. ピンをドラッグ → 同様に座標が更新される
7. 「この場所を使用」→ モーダルが閉じ、lat/lon が編集フォームに反映される
8. 地点名が「新規地点」の場合 → 地名候補（例: 「長野」）で上書きされる
9. 地点名が入力済みの場合 → 名前は変わらない
10. 「キャンセル」またはオーバーレイクリック → モーダルが閉じ、formData は変わらない

- [ ] **Step 8: コミット & push**

```bash
git add src/components/settings/LocationSettings.tsx
git commit -m "feat: add 'pick from map' button to location edit form"
git push
```

---

## セルフレビュー

### Spec カバレッジ（ブレインストーミング合意事項）
- [x] 登録方式: マップ選択のみ（住所検索なし）
- [x] 地図ライブラリ: Leaflet（vanilla、react-leaflet 不使用で React 19 対応）
- [x] UI統合: 既存フォームに「マップから選ぶ」ボタンを追加（モーダル型）
- [x] マップ初期中心: Geolocation API（失敗時は日本全体 zoom:5, center:[36.5,138]）
- [x] ピン確定時: lat/lon セット + `getAreaName(resolveJmaAreaCode())` で地名候補表示
- [x] 名称入力済みなら上書きしない（`prev.name !== '新規地点'` チェック）
- [x] ノータッチ: store.ts / locationRepository.ts / jmaAreaResolver.ts

### 型の一貫性
- `LocationMapModalProps.onConfirm: (lat: number, lon: number, suggestedName?: string) => void` → Task 2・Task 3 で一致
- `handleMapConfirm` の引数シグネチャ → 一致
- `markerPos: [number, number]` → `setMarkerPos` の両所で一致
