# 内部設計書 — Orch.Weather

| 項目 | 内容 |
|------|------|
| 文書種別 | 内部設計書（モジュール分割・各モジュールの処理概要） |
| 基準リビジョン | `6512b83`（2026-07-10） |
| 関連文書 | [外部設計書](02-external-design.md) / [モジュール設計書](04-module-design.md) |

> 本書はモジュールの**分割方針**と各モジュールの**処理概要（責務・入出力・依存）**を示す。分岐・判断のロジックレベル解説は [モジュール設計書](04-module-design.md) を参照。

---

## 1. モジュール分割方針

### 1.1 レイヤと依存方向
上位が下位に依存する単方向構成。逆流（下位→上位）はしない。

```
┌─ エントリ/オーケストレーション層 ── main.tsx / App.tsx / store.ts
│      │ 呼ぶ
├─ 画面層 ───────────────── components/**（tab・settings・weather・LP）
│      │ 呼ぶ
├─ フック層 ───────────────── hooks/**（非同期データ取得の状態管理）
│      │ 呼ぶ
├─ API層 ─────────────────── api/**（外部気象APIのフェッチ・整形）
│      │ 呼ぶ
└─ ドメイン/ユーティリティ層 ── lib/**（Firebase・リポジトリ・計算・変換）

（別プロセス）サーバー層 ────── functions/api/**（Cloudflare Pages Functions）
```

### 1.2 分割の原則
- **画面とデータ取得の分離:** 画面（components）は「何を表示するか」、フック（hooks）は「どう取得・キャッシュするか」を担う。
- **API整形の集約:** 外部APIのレスポンス整形は api 層に閉じ、上位には型付きドメインオブジェクトのみ渡す。
- **単一ソースの徹底:** グローバル状態は store、警報フィルタは `fetchJmaWarnings`、日付計算は `dateUtils.addDays`、天気コード判定は `wmoSeverity` に集約。
- **秘匿処理はサーバーへ:** Gemini キーとアクセス認可は functions 層のみ。

### 1.3 モジュール規模（実測）
TS/TSX 約54ファイル・約12,000行。最大は `App.tsx`（2,625行・分析チャート統合を担う）、次いで `LandingPage.tsx`（1,020行）。

---

## 2. モジュール依存関係（主要経路）

```
WeatherTab ─┬─ useForecast ── forecast.ts ── weatherFetch / dateUtils
            ├─ useJmaWarning ─ jmaWarning.ts ─ jmaAreaResolver
            ├─ useAiComment ──┬ aiCommentInput ─ (calcVpd/hash/bucket)
            │                 ├ aiCommentCache ─ firebase(Firestore)
            │                 └ aiComment ────── /api/ai-comment → Gemini
            ├─ DailyForecast ─ WeatherIcon / wmoSeverity / warningGantt
            └─ HourlyTable ─── WeatherIcon / warningGantt

App(analysis) ─ useWeather ── weather.ts ── weatherFetch
HistoricalWeatherTab ─ useHistoricalForecast ─ historicalForecast.ts
store ─┬ locationRepository ─ firebase(Firestore)
       ├ userRepository ───── firebase(Firestore)
       └ me(client) ───────── /api/me
```

---

## 3. 各モジュールの処理概要

### 3.1 エントリ / オーケストレーション層

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `main.tsx` | 起動 | React ルートを StrictMode で描画。Leaflet CSS を読込。 |
| `App.tsx` | 全体統括・分析タブ | 認証ライフサイクル（`onAuthStateChanged`→`ensureUserDocument`→locations/settings ロード→`/api/me`）、トップタブ切替（weather/history/analysis/settings/help）、未ログイン時のLP/ゲスト分岐、**空くらべ（分析）の7チャート構築**（履歴データ＋予報オーバーレイの `useMemo` 群）、GDD/日射のΔ日逆引き。 |
| `store.ts` | グローバル状態 | Zustand ストア。user/locations/userSettings/geo/aiAllowed/guestMode を保持。更新アクションは「Firestore書込→state更新」順。地点上限（10/50）・`resetUserData`・guestMode の localStorage 永続を担う。 |

### 3.2 画面層 — トップ / 共通

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `LandingPage.tsx` | 未ログインLP | 価値訴求・ティア比較表・ゲスト開始/ログイン導線。`login`/`guest_start` イベント発火。 |
| `LoginScreen.tsx` | ログイン画面 | Google サインイン（iOS=redirect/他=popup 分岐）。 |
| `HelpPage.tsx` | 使い方 | アプリ機能の説明。開く前タブへ戻る。 |
| `Footer.tsx` | フッター | プライバシーポリシー・免責へのリンク・注記。 |
| `MonthsTable.tsx` | 月別統計表（旧） | 月別集計テーブル（現行UIでの使用状況は限定的）。 |
| `DailyRawTable.tsx` | 生データ表 | 空しらべ/空くらべの全指標×日数の一覧。CSV出力（`aiAllowed` 限定・UTF-8 BOM付）。 |

### 3.3 画面層 — 空もよう（weather）

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `weather/WeatherTab.tsx` | 空もよう統括 | 地点解決（`__geo__`/登録/フォールバック）、`useForecast`/`useJmaWarning`/`useAiComment`/`useAiCustomComment` の呼び出し、警報のグループフィルタ（特別警報・未分類は常時表示）、天気コードモード切替、AIステータスバー、各セクションの配置。 |
| `weather/DailyForecast.tsx` | 日別予報 | 15日分を午前/午後/夜間3分割で描画。`selectCode` で代表天気、`isPlaceholder` 日は「—」、警報ガントバー、半日タップで時間別へジャンプ。 |
| `weather/HourlyTable.tsx` | 時間別予報表 | 固定列幅テーブル。気温〜UVの多指標行・ミニグラフ・降水体感ラベル・日の出/入り・夜間網掛け・警報ガントバー。過去時間フェード。 |
| `weather/WeatherIcon.tsx` | 天気アイコン | WMOコード→Meteocons ファイル名（昼夜・v2形式）と日本語ラベルへ変換して `<img>` 描画。 |
| `weather/JmaWarningSummary.tsx` | 警報サマリー | 発令中警報を一覧表示（発表/継続/更新のステータス・発表時刻）。 |
| `weather/WarningBar.tsx` | 警報バー | ガントバーの1本を描画（幅は割合%文字列でCSS委譲）。 |
| `weather/AiCommentCard.tsx` | AIカード | 有効AIセクションのタブUI。標準4種＋カスタムを切替表示。波打つローダー。 |
| `weather/AiComingSoonCard.tsx` | AI未許可カード | T2向けの「近日提供」カード。 |
| `weather/WeatherLoader.tsx` | 共有ローダー | 波打つアイコン＋点滅ドット。起動時とAIカードで共有。 |
| `weather/HistoricalWeatherTab.tsx` | 空しらべ | 過去期間の指定・`useHistoricalForecast` 呼出・日別/時間別表示・`availability` による項目非表示。 |

### 3.4 画面層 — 設定（settings）

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `settings/SettingsTab.tsx` | 設定統括 | 4サブタブ（地点設定/天気情報/空のアドバイス/空くらべ）の切替。モバイルはアカウント欄＋ログアウト。 |
| `settings/LocationSettings.tsx` | 地点設定 | 地点の一覧・追加（現在地/地図/手動）・編集・削除・デフォルト地点。上限制御。 |
| `settings/LocationMapModal.tsx` | 地図モーダル | vanilla Leaflet。クリックで座標選択、GSI逆ジオで地名候補。編集時は登録座標維持（`autoLocate`）。 |
| `settings/JmaWarningSettings.tsx` | 警報設定 | 表示する警報グループ（17種）のON/OFF、各グループの農業影響説明。 |
| `settings/AiCommentSettings.tsx` | AI設定 | 表示AIセクション選択・カスタムプロンプト入力（AI許可のみ操作可）。 |
| `settings/AnalysisSettings.tsx` | 分析設定 | 基準温度2種・累積開始日（4種）・Δ日ガード閾値。 |

### 3.5 フック層（hooks）
非同期データ取得の状態（data/loading/error）を管理し、キャッシュ・stale制御・多重発火防止を担う。

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `useForecast.ts` | 予報取得 | `fetchForecast(lat,lon)`。メモリキャッシュ（キー`lat,lon`・TTL30分）、`activeKey` で stale レスポンス破棄、`inflightRef` で多重発火中の loading 管理、`refresh` で強制再取得。 |
| `useWeather.ts` | 年比較取得 | 空くらべ用。複数 `CompareTarget`（地点×年）の `fetchWeatherData` を管理。 |
| `useHistoricalForecast.ts` | 過去取得 | 空しらべ用。`fetchHistoricalForecast(lat,lon,startDate)` の状態管理。 |
| `useJmaWarning.ts` | 警報取得 | `jmaAreaCode`→`prefCodeFromAreaCode`→`fetchJmaWarnings`。コードが無ければ無効。 |
| `useAiComment.ts` | 標準AI統括 | 入力/ハッシュを毎レンダー純粋計算し、effect依存を`(uid,hash)`プリミティブに限定して**無限ループ防止**。キャッシュ確認→ミスで Function 呼出→書き戻し。非ブロッキング（失敗で comment=null）。 |
| `useAiCustomComment.ts` | カスタムAI統括 | 上と同型で `c:`接頭辞キャッシュ・`fetchAiCustomComment` を使用。 |

### 3.6 API層（api）
外部気象APIのフェッチとドメインオブジェクトへの整形。

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `forecast.ts` | 予報取得整形 | Open-Meteo Forecast を1回叩き、hourly を整形、hourly から午前/午後/夜間別に weatherCode/降水確率/降水量/気温/風を集計、daily を整形（欠損は`isPlaceholder`）、今日基準で past/future に分割して返す。 |
| `weather.ts` | 年実績取得整形 | Archive を叩き、年モデル（jma_msm/era5_land）を選択、日別実績＋累積（降水/日射/日照）を計算、前年12月・翌年1月の月平均も補間用に取得。メモリキャッシュ。 |
| `historicalForecast.ts` | 過去10日取得整形 | 開始日で3段階（forecast/historical-forecast/archive+ecmwf_ifs）にAPIを切替、`availability` を判定、今日以降はプレースホルダー補完。 |
| `jmaWarning.ts` | 警報取得整形 | r8 JSON を取得し、対象エリアの `kinds` を走査、status/現象/レベルを判定して名称生成、重複排除、有効なもののみ返す。 |
| `aiComment.ts` | AI Function 呼出 | `/api/ai-comment`・`/api/ai-custom` への fetch。Bearer トークン付与、非JSON応答（dev）をエラー化。 |
| `me.ts` | 認可取得 | `/api/me` を Bearer 付きで叩き `aiAllowed` を返す。 |

### 3.7 ドメイン / ユーティリティ層（lib）

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `firebase.ts` | Firebase初期化 | `VITE_*` から app/auth/db/analytics を初期化・エクスポート。 |
| `store.ts`（再掲） | 状態 | 3.1 参照。 |
| `locationRepository.ts` | 地点CRUD | `/users/{uid}/locations` の fetch/add/update/delete。 |
| `userRepository.ts` | 設定CRUD | `ensureUserDocument`（存在チェック型）、`getUserSettings`（前方互換マイグレーション）、各設定の `setDoc merge` 更新。既定値を保持。 |
| `wmoSeverity.ts` | 天気コード判定 | 26段階深刻度スコア、`worstCode`、`modeCode`（最頻値）、`selectCode`（severity/frequency 統一選択）。 |
| `dateUtils.ts` | 日付計算 | `addDays`（UTC基準・TZズレ回避の単一実装）。 |
| `jmaAreaResolver.ts` | エリア解決 | 緯度経度→GSI逆ジオ→`muniCd`→`jmaAreaLookup`→class20sコード。`prefCodeFromAreaCode`（北海道/鹿児島/沖縄の特例）、`getAreaName`。 |
| `aiCommentInput.ts` | AI入力生成 | 予報＋警報から標準/カスタムの入力ペイロードを構築。飽差計算・風向ラベル・4時間バケット時刻丸め・djb2ハッシュ（キャッシュキー）。 |
| `aiCommentCache.ts` | AIキャッシュ | Firestore `/users/{uid}/aiComments/{hash}`（標準）・`c:{hash}`（カスタム）の read/write。TTL4時間判定。 |
| `weatherFetch.ts` | フェッチ＋エラー分類 | Open-Meteo フェッチを offline/upstream/data に分類し日本語メッセージ付き例外を投げる。 |
| `warningGantt.ts` | ガント配置 | 警報をグリーディ区間スケジューリングで非重複レーンに配置。レベル別配色。 |
| `geo.ts` | 位置情報定数 | `GEO_OPTIONS`、GPSエラーメッセージ、対応判定。 |
| `analytics.ts` | GA4計測 | measurementId未設定/非対応で no-op のイベント送信ラッパー（guest_start/login/weather_view）。 |

### 3.8 データ / 静的テーブル
| モジュール | 責務 |
|-----------|------|
| `data/jmaAreaLookup.json` | muniCd(5桁) → class20sコード(7桁) の対応表（`scripts/build-jma-area-map.mjs` 生成） |
| `data/jmaAreaNames.json` | class20sコード → エリア名（日本語） |

### 3.9 サーバー層（functions/api）
Cloudflare Pages Functions。クライアントとは別プロセス・別信頼境界。

| モジュール | 責務 | 処理概要 |
|-----------|------|----------|
| `_auth.ts` | 認可基盤 | Bearer トークン抽出、Google x509証明書取得（メモリキャッシュ）、`jose` でRS256/iss/aud検証、許可名簿判定、`requireAiAccess` ガード（401/403）。 |
| `me.ts` | 認可応答 | トークン検証し `{aiAllowed}` を返す。 |
| `ai-comment.ts` | 標準AIプロキシ | 認可→Gemini呼出（responseSchema 4フィールド）→最大3回リトライ→JSON返却。システムプロンプト内蔵。 |
| `ai-custom.ts` | カスタムAIプロキシ | 認可→Gemini呼出（プレーンテキスト・ガードレール）→返却。 |
| `archive.ts` | 予備プロキシ | archive-api への透過プロキシ（通常未使用・経路障害時の手動切替用）。 |

---

## 4. 横断的関心事の集約点（単一ソース）
変更時に「1箇所だけ直せばよい」設計上の集約点。

| 関心事 | 集約モジュール |
|--------|----------------|
| グローバル状態 | `store.ts` |
| 警報の有効性フィルタ | `jmaWarning.ts`（`fetchJmaWarnings`） |
| 日付の加減算 | `dateUtils.ts`（`addDays`） |
| 天気コードの深刻度・代表値選択 | `wmoSeverity.ts` |
| AIアクセス認可 | `functions/api/_auth.ts`（`requireAiAccess`） |
| AI入力の整形・ハッシュ | `aiCommentInput.ts` |
| 気象フェッチのエラー分類 | `weatherFetch.ts` |
| 設定の既定値 | `store.ts` ＋ `userRepository.ts`（`// SYNC:` で二重定義同期） |

---

## 更新履歴
| 日付 | リビジョン | 変更 |
|------|-----------|------|
| 2026-07-10 | `6512b83` | 初版（リバースエンジニアリング） |
