# 現在地表示・デフォルト地点機能 設計書

**日付:** 2026-05-29  
**対象タブ:** 天気情報・あの時の天気・比較分析・設定（地点設定）

---

## 概要

- 全タブの地点セレクター近くに「📍 現在地を表示」ボタンを追加
- GPSで取得した仮の地点（保存なし）を全タブで表示できるようにする
- 地点登録カードに「デフォルトに設定」機能を追加
- 起動時に自動でデフォルト地点または現在地を表示する

---

## データ層設計

### store.ts への追加

```typescript
geoLocation: LocationInfo | null   // id = '__geo__'、Firestoreには保存しない
geoStatus: 'idle' | 'loading' | 'error'
setGeoLocation: (loc: LocationInfo | null) => void
setGeoStatus: (s: 'idle' | 'loading' | 'error') => void
```

### UserSettings への追加

```typescript
defaultLocationId: string | null   // デフォルト: null
```

Firestore の `/users/{uid}` ドキュメントに `defaultLocationId` フィールドとして保存。

`userRepository.ts` に追加：
- `getUserSettings` の復元ロジックに `defaultLocationId` を含める
- `updateDefaultLocationId(uid, id | null)` 関数を追加
- store.ts に `updateDefaultLocationId` アクションを追加

### DEFAULT_RISK_THRESHOLDS 同期ルールへの影響

`defaultLocationId` は `UserSettings` の一部だが、`DEFAULT_RISK_THRESHOLDS` とは別オブジェクト（`UserSettings` 直下）なので、3箇所コピーのルール対象外。`userRepository.ts` の `getUserSettings` のみ修正すればよい。

---

## useWeatherData フックへの追加

`locationId === '__geo__'` のとき、`locations.find(...)` の代わりにストアの `geoLocation` を lat/lon として使用する。

```typescript
// フック冒頭で geoLocation も取得
const { locations, geoLocation } = useAppStore();

// lat/lon 解決時
const loc = target.locationId === '__geo__'
  ? geoLocation
  : locations.find(l => l.id === target.locationId);
```

---

## UI設計

### 天気情報タブ・あの時の天気タブ（WeatherTab / HistoricalWeatherTab）

**地点セレクター行の変更:**

```
[ 📍 現在地を表示 ] [ ドロップダウン ▼ ]  ← 現在地取得済みの場合は先頭に「📍 現在地」オプション追加
```

- ボタンスタイル: `LocationSettings` の `greenButtonStyle` と統一（teal系）
- GPS取得中: スピナー + 「取得中…」テキスト
- GPS失敗: ボタン下に赤字エラーメッセージ「位置情報が取得できませんでした」
- 取得成功: ドロップダウン先頭に `{ value: '__geo__', label: '📍 現在地' }` を追加し自動選択
- ドロップダウンで登録地点に切り替え可能（自由に往来できる）

**初期選択ロジック（各タブのマウント時）:**

```
1. defaultLocationId が設定済みかつ locations に存在する → そのIDを選択
2. geoLocation が既に取得済み → '__geo__' を選択
3. 上記どちらでもない → '' (空) のままで自動geo取得を待つ
   → geoLocation が store にセットされたら '__geo__' に切り替える (useEffect)
```

### 比較分析タブ（App.tsx の targets ドロップダウン）

- `geoLocation` が取得済みの場合、各ターゲットの地点ドロップダウンの先頭に `'📍 現在地'` オプションを追加
- ボタンは追加しない（行が複数あるため）
- ドロップダウンで `'__geo__'` を選択すると `useWeatherData` が `geoLocation` の座標でデータ取得

### 設定タブ → 地点設定（LocationSettings）

各地点カードの右下ボタン群に追加：

- **デフォルト未設定の地点:** 「デフォルトに設定」ボタン（グレー系スタイル）
- **デフォルト設定済みの地点:** 「★ デフォルト」バッジ（アクセントカラー） + 「解除」ボタン
- デフォルトは同時に1地点のみ（新しく設定すると前のデフォルトは自動解除）

---

## 起動時の自動地点選択（App.tsx）

`authLoading === false` かつ `userSettings !== null` になったタイミングで1回だけ実行：

```
1. defaultLocationId が設定済みかつ locations に存在する
   → 各タブのデフォルト選択地点として使用（geoフェッチなし）

2. 上記以外（地点登録なし or デフォルト未設定 or デフォルト地点が削除済み）
   → Geolocation API で現在地を自動取得
   → 成功: geoLocation をストアにセット (id='__geo__', name='現在地')
   → 失敗: geoStatus = 'error' → タブ側でエラーメッセージ表示
```

GPS失敗時かつ登録地点がある場合は、タブ側で「位置情報が取得できませんでした」を表示しつつ、ドロップダウンから登録地点を選択できる状態にする。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/store.ts` | `geoLocation`, `geoStatus`, `setGeoLocation`, `setGeoStatus`, `updateDefaultLocationId` を追加 |
| `src/lib/userRepository.ts` | `getUserSettings` に `defaultLocationId` 復元追加、`updateDefaultLocationId` 関数追加 |
| `src/App.tsx` | 起動時自動geo取得ロジック、分析タブのドロップダウンに `'__geo__'` オプション追加 |
| `src/hooks/useWeather.ts` | `locationId === '__geo__'` のときストアの `geoLocation` を使う分岐追加 |
| `src/components/weather/WeatherTab.tsx` | 「現在地を表示」ボタン、初期選択ロジック、`'__geo__'` ドロップダウンオプション |
| `src/components/weather/HistoricalWeatherTab.tsx` | WeatherTab と同様 |
| `src/components/settings/LocationSettings.tsx` | 「デフォルトに設定」ボタン・「★ デフォルト」バッジ追加 |

---

## エラーハンドリング

| ケース | 対応 |
|--------|------|
| GPS拒否 | 「位置情報の許可が必要です」赤字メッセージ |
| GPSタイムアウト | 「位置情報の取得がタイムアウトしました」赤字メッセージ |
| GPS失敗（その他） | 「位置情報が取得できませんでした」赤字メッセージ |
| defaultLocationId が登録済みリストにない（削除済み） | 自動geo取得にフォールバック |

---

## 制約・注意事項

- `geoLocation` はセッションメモリのみ（Firestoreには保存しない）
- `getLocationName('__geo__')` → `'現在地'` を返すよう `App.tsx` の `getLocationName` 関数に分岐追加
- `useWeatherData` がストアの `geoLocation` を直接参照するため、geo取得前に `'__geo__'` がターゲットとして設定されていると空データが返る（ローディング表示で対応）
