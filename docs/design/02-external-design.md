# 外部設計書 — Orch.Weather

| 項目 | 内容 |
|------|------|
| 文書種別 | 外部設計書（システム設計概要・詳細／外部IF・ASP設定／コード値定義） |
| 基準リビジョン | `6512b83`（2026-07-10） |
| 関連文書 | [要件定義書](01-requirements.md) / [内部設計書](03-internal-design.md) / [ADR](06-adr.md) |

---

## 1. システム設計概要

### 1.1 全体アーキテクチャ
静的 SPA（Cloudflare Pages 配信）＋ サーバーレス関数（Pages Functions）＋ BaaS（Firebase）＋ 外部気象API群の構成。

```
┌────────────────────────────────────────────────────────────┐
│ ブラウザ（React 19 SPA / PWA）                              │
│  ├ Zustand ストア（真実の源は Firestore）                    │
│  ├ 気象API直叩き（Open-Meteo / JMA / GSI / OSM）             │
│  ├ Firebase SDK（Auth: Google / Firestore: 本人データ）      │
│  └ GA4（利用状況計測）                                       │
└───────────┬───────────────────────────┬────────────────────┘
            │ 直接HTTPS                   │ Bearer(IDトークン)
            ▼                             ▼
  ┌──────────────────┐        ┌──────────────────────────────┐
  │ 外部気象API/タイル │        │ Cloudflare Pages Functions     │
  │ ・Open-Meteo ×3   │        │  /api/me       認可判定        │
  │ ・気象庁 r8 JSON  │        │  /api/ai-comment  Geminiプロキシ│
  │ ・GSI 逆ジオ      │        │  /api/ai-custom   Geminiプロキシ│
  │ ・OSM タイル      │        │  /api/archive     予備プロキシ  │
  └──────────────────┘        └───────────────┬───────────────┘
                                               │ サーバー側のみ
                                               ▼
                                    ┌────────────────────┐
                                    │ Google Gemini API   │
                                    └────────────────────┘
```

### 1.2 設計原則
- **秘匿の境界:** Gemini キーはサーバー（Functions env）のみ。クライアントには公開キー（Firebase）とリファラー制限のみ。
- **真実の源は1つ:** ユーザーデータは Firestore が正。クライアント state（Zustand）は写像。
- **気象データは原則クライアント直叩き:** Open-Meteo/JMA/GSI は認証不要のため、Functions を介さずブラウザから直接取得（レイテンシ・コスト最小）。archive のみ経路障害時のプロキシを予備配置。

### 1.3 主要データフロー
| # | フロー | 経路 |
|---|--------|------|
| DF-1 | 起動・認証 | Firebase Auth → onAuthStateChanged → ensureUserDocument → locations/settings ロード → `/api/me` で `aiAllowed` 取得 |
| DF-2 | 空もよう表示 | 地点座標 → Open-Meteo Forecast（直叩き）＋ 気象庁 r8（`jmaAreaCode`→`prefCode`）→ 描画 |
| DF-3 | AIコメント | 予報＋警報 → 入力ハッシュ生成 → Firestoreキャッシュ確認 → 無ければ `/api/ai-comment`（Bearer）→ Gemini → キャッシュ保存 |
| DF-4 | 空くらべ/空しらべ | 地点×年 → Archive / Historical Forecast API（直叩き）→ 累積計算 → 描画 |
| DF-5 | 地点登録 | GPS or 地図クリック → GSI 逆ジオ → `jmaAreaCode` 解決 → Firestore 保存 |

---

## 2. システム設計詳細

### 2.1 レイヤ構成
| レイヤ | ディレクトリ | 責務 |
|--------|-------------|------|
| エントリ | `src/main.tsx`, `App.tsx` | 起動・認証ライフサイクル・トップタブ・分析チャート統合 |
| 画面 | `src/components/**` | タブUI（weather/history/analysis/settings/help）・LP |
| フック | `src/hooks/**` | データ取得の非同期状態管理（forecast/weather/jmaWarning/aiComment） |
| API | `src/api/**` | 外部気象APIのフェッチ・整形 |
| ドメイン/ユーティリティ | `src/lib/**` | Firebase・リポジトリ・WMO・日付・エリア解決・AI入力生成・分析 |
| サーバー | `functions/api/**` | 認可・Geminiプロキシ・予備プロキシ |
| 状態 | `src/store.ts` | Zustand グローバルストア |

### 2.2 認証・認可の設計
- **認証:** Firebase Authentication（Google プロバイダ）。iOS Safari は `signInWithRedirect`、他は `signInWithPopup`。
- **認可（AI）:** クライアントは ID トークンを `Authorization: Bearer <token>` で Functions に送る。Functions は Admin SDK を使わず、`jose` で Google securetoken の x509 証明書を取得し RS256 署名・`iss`・`aud`・`exp` を検証。`email` が env `AI_ALLOWLIST` に含まれれば許可。
- **信頼境界:** Firestore の読み書き制御はルール（本人限定）で担保。AI の課金制御は Functions の許可判定で担保。

### 2.3 キャッシュ設計
| 対象 | 種別 | キー | 寿命 |
|------|------|------|------|
| Forecast（空もよう） | メモリ（`useForecast`） | `${lat},${lon}` | セッション（モード非依存＝[ADR-0013](06-adr.md)） |
| Archive（空くらべ） | メモリ（`weather.ts` Map） | `${lat},${lon},${year}` | セッション（リロードで消滅） |
| AIコメント | Firestore | 入力ハッシュ（JST4時間バケット） | TTL 4時間（[ADR-0015](06-adr.md)） |
| Functions 証明書 | メモリ（`_auth.ts`） | 固定 | レスポンスの `Cache-Control: max-age` 準拠 |

---

## 3. 外部インターフェース仕様

### 3.1 Open-Meteo Forecast API（空もよう）
| 項目 | 内容 |
|------|------|
| エンドポイント | `GET https://api.open-meteo.com/v1/forecast` |
| 認証 | なし |
| 主パラメータ | `latitude`, `longitude`, `timezone=Asia/Tokyo`, `models=best_match`, `wind_speed_unit=ms`, `past_hours=20`, `past_days=7`, `forecast_days=15`, `forecast_hours=384` |
| hourly（16項目） | `temperature_2m`, `precipitation`, `precipitation_probability`, `dew_point_2m`, `relative_humidity_2m`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `cape`, `freezinglevel_height`, `pressure_msl`, `weather_code`, `shortwave_radiation`, `snowfall`, `uv_index` |
| daily（13項目） | `weather_code`, `temperature_2m_max/min`, `precipitation_probability_max`, `precipitation_sum`, `relative_humidity_2m_max/min`, `sunrise`, `sunset`, `shortwave_radiation_sum`, `snowfall_sum`, `wind_speed_10m_max`, `sunshine_duration` |
| 実装 | `src/api/forecast.ts` |

### 3.2 Open-Meteo Archive API（空くらべ・年比較）
| 項目 | 内容 |
|------|------|
| エンドポイント | `GET https://archive-api.open-meteo.com/v1/archive` |
| 認証 | なし |
| モデル選択 | `year>=2016` → `models=jma_msm`（5km投影格子）／ `year<2016` → `models=era5_land`（0.1度規則格子） |
| パラメータ | `latitude`, `longitude`, `start_date`, `end_date`, `timezone=Asia/Tokyo`, `daily=temperature_2m_max/min/mean, precipitation_sum, relative_humidity_2m_max/min/mean, shortwave_radiation_sum, sunshine_duration` |
| 予備経路 | `functions/api/archive.ts`（`/api/archive`）— 日本網からの到達不能時のみ手動切替 |
| 実装 | `src/api/weather.ts` |

### 3.3 Open-Meteo Historical Forecast API（空しらべ・過去10日）
過去実績を3段階で使い分ける（`src/api/historicalForecast.ts`）。

| 段階 | 条件（startDate 基準） | エンドポイント／モデル | 備考 |
|------|------------------------|------------------------|------|
| 段階1 | `>= today-14` | `api.open-meteo.com/v1/forecast` | 完全データ |
| 段階2 | `2022-01-01 <= x < today-14` | `historical-forecast-api.open-meteo.com/v1/forecast` | 完全データ（2022年以降） |
| 段階3 | `< 2022-01-01` | `archive-api.open-meteo.com/v1/archive` ＋ `ecmwf_ifs` | CAPE取得可、0℃層高度は9999固定、降水確率・UV不在 |

今日以降の日は `isPlaceholder=true` で補完。取得可否は `availability`（`precipProb`/`freezingLevel`/`uvIndex`/`cape`）で表現し、UI は不在項目の行を非表示にする。

### 3.4 気象庁 防災情報 JSON（r8）
| 項目 | 内容 |
|------|------|
| エンドポイント | `GET https://www.jma.go.jp/bosai/warning/data/r8/{prefCode}.json` |
| 認証 | なし |
| `prefCode` 導出 | `jmaAreaCode`（class20s 7桁）→ `prefCodeFromAreaCode()`（→ 5.7） |
| 抽出 | `entry.warning.class20Items[].areaCode == jmaAreaCode` の `kinds[]` を走査 |
| 実装 | `src/api/jmaWarning.ts` |

レスポンス構造（要点）:
- `kinds[].status`: `発表` / `継続` / `更新`（表示対象）、`解除` / `発表警報・注意報はなし`（除外）。
- `kinds[].properties[].type`: `"風危険度"` 等（→ R8_PHENOMENON マップ 5.3）。
- `properties[].significancyPart.locals[0].code`: 先頭桁でレベル判定（→ 5.2）。

### 3.5 国土地理院 逆ジオコーディング（地名・エリア解決）
| 項目 | 内容 |
|------|------|
| エンドポイント | `GET https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat={lat}&lon={lon}` |
| 認証 | なし |
| 返却 | `results.muniCd`（5桁市区町村コード）、`results.lv01Nm`（町丁目名） |
| 後処理 | `muniCd` → `data/jmaAreaLookup.json` → `jmaAreaCode`（class20s 7桁） |
| 実装 | `src/lib/jmaAreaResolver.ts` |

### 3.6 OpenStreetMap タイル
| 項目 | 内容 |
|------|------|
| エンドポイント | `https://*.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| 用途 | Leaflet 地図（地点選択） |

### 3.7 Firebase（Auth / Firestore）
| 項目 | 内容 |
|------|------|
| Auth | Google プロバイダのみ。承認済みドメイン制御。 |
| Firestore | 本人ドキュメントのみ読み書き可（ルール）。データモデルは 5.6。 |
| 公開設定 | クライアント公開キーは HTTP リファラー制限あり。 |

### 3.8 内部API（Cloudflare Pages Functions）
| エンドポイント | メソッド | 認可 | 入力 | 出力 | HTTPステータス |
|----------------|----------|------|------|------|----------------|
| `/api/me` | GET | Bearer 検証 | ― | `{ aiAllowed: boolean }` | 200 / 401 |
| `/api/ai-comment` | POST | `requireAiAccess` | 気象入力JSON | `{ weatherOverview, sprayingAdvice, fertilizingAdvice, generalWorkAdvice }` | 200 / 400 / 401 / 403 / 405 / 500 / 502 |
| `/api/ai-custom` | POST | `requireAiAccess` | 気象入力JSON＋プロンプト | `{ text }`（プレーンテキスト最大400字） | 200 / 400 / 401 / 403 / 405 / 500 / 502 |
| `/api/archive` | GET | なし | archive クエリ透過 | Open-Meteo archive JSON | 200 / 502（予備・通常未使用） |

### 3.9 Google Gemini API（Functions 経由のみ）
| 項目 | 内容 |
|------|------|
| エンドポイント | `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}` |
| 生成設定 | `temperature=0.6`, `topP=0.8`, `maxOutputTokens=8192`, `thinkingConfig.thinkingBudget=1024` |
| ai-comment | `responseMimeType=application/json`＋`responseSchema`（4フィールド各 `minLength:200`）。失敗時 最大3回リトライ（4xx は即中断） |
| ai-custom | プレーンテキスト。プロンプトインジェクション・領域外・過剰長のガードレール（→ [ADR-0016](06-adr.md)） |

### 3.10 Google Analytics 4
| 項目 | 内容 |
|------|------|
| 実装 | `src/lib/analytics.ts`（measurementId 未設定・非対応ブラウザで no-op） |
| measurementId | `G-LNPJVTCFTC`（`VITE_FIREBASE_MEASUREMENT_ID`） |
| カスタムイベント | `guest_start` / `login` / `weather_view`（→ 5.8） |

---

## 4. ASP設定

### 4.1 Cloudflare Pages / Functions
| 設定 | 値 |
|------|-----|
| プロダクションブランチ | `main`（自動デプロイ）→ `weather.orch-app.com` |
| プレビュー | `develop` → `develop.orchweather.pages.dev`（常設ステージング） |
| `compatibility_date` | `2024-09-23` |
| Smart Placement | 無効（archive 経路対策・[ADR-0002](06-adr.md)） |
| Functions env | `GEMINI_API_KEY` / `AI_ALLOWLIST` / `FIREBASE_PROJECT_ID`（本番・プレビュー両方に設定） |
| ヘッダ | `public/_headers`（全ルートに CSP/HSTS 等） |

### 4.2 Firebase / GCP
| 設定 | 値 |
|------|-----|
| Firebase プロジェクト | `orchweather`（番号 419446595442） |
| Gemini プロジェクト | 別プロジェクト（番号 406509436712・SAバインド・Gemini APIのみ制限） |
| Auth 承認済みドメイン | localhost / firebaseapp.com / web.app / orchweather.pages.dev / weather.orch-app.com / develop.orchweather.pages.dev |
| 公開キー制限 | HTTPリファラー（本番/プレビュー/localhost）。API制限なし |
| OAuth（カスタムドメイン時） | GCP Credentials の JavaScript生成元＋リダイレクトURI `/__/auth/handler` を追加（→ [ADR-0021](06-adr.md)） |

### 4.3 環境変数一覧
要件定義書 6.5 を参照。クライアント `VITE_*`（7件・ビルド時焼き込み）＋ サーバー3件（`GEMINI_API_KEY` / `AI_ALLOWLIST` / `FIREBASE_PROJECT_ID`）。

---

## 5. コード値定義・マッピング

> 本章は「値＋意味」を明記する（記載ルール）。

### 5.1 WMO 天気コード（`weather_code`）
Open-Meteo が返す WMO 4677 準拠コード。深刻度スコアは `src/lib/wmoSeverity.ts`、アイコン・ラベルは `src/components/weather/WeatherIcon.tsx`。

| コード | 意味 | 深刻度 | アイコン（Meteocons） | 日本語ラベル |
|--------|------|--------|----------------------|--------------|
| 0 | 快晴 | 1 | `clear-day/night` | 快晴 |
| 1 | おおむね晴れ | 2 | `mostly-clear-day/night` | 晴れ |
| 2 | 一部曇り | 3 | `partly-cloudy-day/night` | 晴れ時々曇り |
| 3 | 曇り | 4 | `overcast`（昼夜共通） | 曇り |
| 45 / 48 | 霧 / 着氷霧 | 5 | `fog-day/night` | 霧 |
| 51 | 霧雨（弱） | 6 | `drizzle` | 霧雨（弱） |
| 53 | 霧雨（並） | 7 | `overcast-drizzle` | 霧雨 |
| 55 | 霧雨（強） | 8 | `overcast-drizzle` | 霧雨（強） |
| 56 | 着氷性霧雨（弱） | 9 | `sleet` | 氷雨 |
| 57 | 着氷性霧雨（強） | 10 | `sleet` | 氷雨 |
| 61 | 雨（弱） | 13 | `rain` | 小雨 |
| 63 | 雨（並） | 19 | `overcast-rain` | 雨 |
| 65 | 雨（強） | 22 | `extreme-rain` | 大雨 |
| 66 | 着氷性の雨（弱） | 18 | `sleet` | みぞれ |
| 67 | 着氷性の雨（強） | 21 | `extreme-sleet` | みぞれ |
| 71 | 雪（弱） | 14 | `snow` | 小雪 |
| 73 | 雪（並） | 20 | `overcast-snow` | 雪 |
| 75 | 雪（強） | 23 | `extreme-snow` | 大雪 |
| 77 | 雪粒 | 20 | `overcast-snow` | 大雪 |
| 80 | にわか雨（弱） | 11 | `mostly-clear-day/night-drizzle` | にわか雨（弱） |
| 81 | にわか雨（並） | 15 | `partly-cloudy-day/night-drizzle` | にわか雨 |
| 82 | にわか雨（激） | 17 | `partly-cloudy-day/night-rain` | 激しいにわか雨 |
| 85 | にわか雪（弱） | 12 | `mostly-clear-day/night-snow` | にわか雪（弱） |
| 86 | にわか雪（強） | 16 | `partly-cloudy-day/night-snow` | にわか雪 |
| 95 | 雷雨 | 24 | `thunderstorms-extreme-rain` | 雷雨 |
| 96 | 雷雨＋弱いひょう | 25 | `thunderstorms-extreme-sleet` | 雷雨（ひょう） |
| 99 | 雷雨＋強いひょう | 26 | `extreme-thunderstorms-extreme-sleet` | 雷雨（ひょう） |

- **深刻度スコア:** WMOコードは現象ブロック別で数値の大小と深刻度が連動しないため、26段階に正規化してブロック横断比較を可能にする。未定義コードは 0。
- **代表値選択:** `selectCode(codes, mode)`。`severity`＝最大深刻度、`frequency`＝最頻値（同数タイは深刻度が高い方）。

### 5.2 気象庁 警報レベル（r8 `significancyPart.locals[].code` 先頭桁）
`src/api/jmaWarning.ts` の `r8LevelFromCode()`。

| 先頭桁 | レベル | `level` 値 | 名称サフィックス |
|--------|--------|-----------|------------------|
| 5 | 特別警報 | `special` | 特別警報 |
| 4 | 危険警報 | `warning` | 危険警報 |
| 3 | 警報 | `warning` | 警報 |
| 2 | 注意報 | `advisory` | 注意報 |
| その他 | ― | （除外） | ― |

`level` 型: `'warning' | 'advisory' | 'special' | 'none'`。

### 5.3 気象庁 現象マップ（r8 `properties[].type` → 名称）
`R8_PHENOMENON`。`{注意報名 / 警報名 / 特別警報名}`。最終表示名 = 基底名 ＋ レベルサフィックス（例: 風危険度＋警報 → `暴風警報`）。

| type | 注意報 | 警報 | 特別警報 |
|------|--------|------|----------|
| 大雨浸水危険度 / 大雨土砂危険度 | 大雨 | 大雨 | 大雨 |
| 土砂災害危険度 | 土砂災害 | 土砂災害 | 土砂災害 |
| 洪水危険度 | 洪水 | 洪水 | 洪水 |
| 高潮危険度 | 高潮 | 高潮 | 高潮 |
| 風危険度 | 強風 | 暴風 | 暴風 |
| 風雪危険度 | 風雪 | 暴風雪 | 暴風雪 |
| 波危険度 | 波浪 | 波浪 | 波浪 |
| 大雪危険度 | 大雪 | 大雪 | 大雪 |
| 雷危険度 | 雷 | 雷 | 雷 |
| 乾燥危険度 | 乾燥 | 乾燥 | 乾燥 |
| 濃霧危険度 | 濃霧 | 濃霧 | 濃霧 |
| なだれ危険度 | なだれ | なだれ | なだれ |
| 低温危険度 | 低温 | 低温 | 低温 |
| 霜危険度 | 霜 | 霜 | 霜 |
| 着氷危険度 / 着雪危険度 / 融雪危険度 | 着氷 / 着雪 / 融雪 | 同 | 同 |

**発令ステータス（`status`）:** `発表` / `継続` / `更新`＝表示、`解除` / `発表警報・注意報はなし`＝除外。重複排除キー = `${type}:${先頭桁}`。

### 5.4 警報表示グループ（`JmaWarningGroup`）
設定で表示ON/OFFする17グループ。名前ベースで導出（`warningNameToGroup`・前方一致・順序依存: `暴風雪`→`風雪`を`暴風`→`強風`より先に判定）。未分類・特別警報は常時表示。

`大雨 / 土砂災害 / 洪水 / 大雪 / 強風 / 風雪 / 波浪 / 高潮 / 乾燥 / 霜 / 低温 / 雷 / 濃霧 / なだれ / 融雪 / 着氷 / 着雪`

### 5.5 AIセクション（`AiSection`）
| 値 | 意味（タブ名） | デフォルト |
|----|----------------|-----------|
| `weatherOverview` | 空ごよみ（天気概況） | 有効 |
| `generalWorkAdvice` | 畑しごと（一般外作業） | 有効 |
| `sprayingAdvice` | 散布どき（防除・散布） | 有効 |
| `fertilizingAdvice` | 施肥どき | 有効 |
| `custom` | じぶん好み（ユーザー入力プロンプト） | 無効（オプトイン） |

### 5.6 データベース設計（Cloud Firestore）
NoSQL ドキュメント指向。永続データはユーザー本人ドキュメント配下のみ。実装は `src/lib/*Repository.ts` と `src/lib/aiCommentCache.ts`。

#### 5.6.1 コレクション階層とキー（ドキュメントID）設計
| コレクション（パス） | ドキュメントID | ID生成元 | 用途 | 件数の目安 |
|----------------------|----------------|----------|------|-----------|
| `users/{uid}` | `uid` | Firebase Auth の UID | ユーザー設定の格納 | 1ユーザー1件 |
| `users/{uid}/locations/{locationId}` | 自動生成ID | Firestore `addDoc` | 登録地点 | 上限 10（T2）/ 50（T3） |
| `users/{uid}/aiComments/{docId}` | ハッシュ（下記） | アプリ生成 | AIコメントのキャッシュ | 蓄積（TTL対象） |

**`aiComments` のドキュメントID規則:**
- 標準AI: `{hash}` — `djb2(JSON.stringify(入力ペイロード))`。入力は JST 4時間バケットで丸めた予報＋警報（[ADR-0015](06-adr.md)）。
- カスタムAI: `c:{inputHash}-{promptHash}` — 先頭 `c:` で標準と分離、プロンプトのハッシュを付加して内容別にキャッシュ。

#### 5.6.2 `users/{uid}` ドキュメント（ユーザー設定）
| 項目 | 型 | 必須 | 既定値 | 用途・意味 | 制約・備考 |
|------|----|------|--------|-----------|-----------|
| `createdAt` | Timestamp | ○ | `serverTimestamp()` | 初回作成の記録（存在チェック用シード） | `ensureUserDocument` が新規時のみ書込。毎回上書き禁止（[ADR-0022](06-adr.md)） |
| `baseTempSettings` | number[2] | △ | `[10, 3.5]` | GDD（積算温度）の基準温度2種 | 未設定時は既定を適用 |
| `accumStartDates` | map | △ | 全て `"01-01"` | 累積の開始日。`{precip, sunshine, radiation, gdd}` 各 `"MM-DD"` | 新キーは読込時に既定で補完（前方互換） |
| `accumDeltaThresholds` | map | △ | `{gdd:30, radiation:100}` | Δ日逆引きの序盤抑制閾値。`{gdd, radiation}` | 単位: gdd=℃日、radiation=MJ/m² |
| `defaultLocationId` | string \| null | △ | `null` | 起動時の初期表示地点ID | 無効ID時は現在地(`__geo__`)へフォールバック |
| `enabledJmaGroups` | string[] | △ | 全17グループ | 表示する警報グループ（`JmaWarningGroup`・→5.4） | 新グループは読込時に差分追加（前方互換） |
| `enabledAiSections` | string[] | △ | 標準4種 | 表示するAIセクション（`AiSection`・→5.5） | `custom` は既定無効。新セクションは差分追加 |
| `aiCustomPrompt` | string | △ | `DEFAULT_AI_CUSTOM_PROMPT` | じぶん好みAIの入力プロンプト | UI上限200字。明示的な空文字は空のまま保持 |
| `weatherCodeMode` | string | △ | `"severity"` | 天気コード表示モード | `"frequency"` 以外は `"severity"` に正規化 |

> △=省略可（未設定時は `getUserSettings` が既定を適用）。更新は全て `setDoc(..., {merge:true})` で部分更新。

#### 5.6.3 `users/{uid}/locations/{locationId}` ドキュメント（登録地点）
| 項目 | 型 | 必須 | 用途・意味 | 制約・備考 |
|------|----|------|-----------|-----------|
| （ドキュメントID） | string | ○ | 地点の一意キー | `addDoc` 自動生成。アプリ内 `LocationInfo.id` に対応 |
| `name` | string | ○ | 地点表示名 | ユーザー入力 or 逆ジオコーディング候補 |
| `lat` | number | ○ | 緯度 | `toFixed(6)` 精度で保存 |
| `lon` | number | ○ | 経度 | 同上 |
| `jmaAreaCode` | string | △ | 気象庁 class20s エリアコード（7桁） | 注意報・警報取得に使用。未解決なら未設定（警報無効） |
| `createdAt` | Timestamp | ○ | 登録時刻 | `serverTimestamp()` |

> クエリは `getDocs`（コレクション全読み）のみ。`where`/`orderBy` 不使用のため複合インデックス不要。

#### 5.6.4 `users/{uid}/aiComments/{docId}` ドキュメント（AIキャッシュ）
**標準AI（ID=`{hash}`）:**
| 項目 | 型 | 必須 | 用途・意味 |
|------|----|------|-----------|
| `weatherOverview` | string | ○ | 空ごよみ（天気概況） |
| `sprayingAdvice` | string | ○ | 散布どき（防除・散布） |
| `fertilizingAdvice` | string | ○ | 施肥どき |
| `generalWorkAdvice` | string | ○ | 畑しごと（一般外作業） |
| `cachedAt` | Timestamp | ○ | TTL基準（生成時刻） |

**カスタムAI（ID=`c:{hash}`）:**
| 項目 | 型 | 必須 | 用途・意味 |
|------|----|------|-----------|
| `text` | string | ○ | 自由形式のAI回答（最大400字） |
| `cachedAt` | Timestamp | ○ | TTL基準（生成時刻） |

> **TTL:** 読込時に `Date.now() - cachedAt > 4時間` なら無効（再生成）。サーバー側の自動削除（Firestore TTLポリシー）は `cachedAt` オフセット4時間で設定可能だが**未設定・保留**（→ [リスク R-05](05-risk-register.md)）。1時間ごとにハッシュが変わる旧構造では蓄積したが、4時間バケット化（[ADR-0015](06-adr.md)）で増加は鈍化。

#### 5.6.5 セキュリティ・整合性
- **セキュリティルール（コンソール管理・リポジトリ外）:** `match /users/{userId}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == userId }`。他 match 無し＝デフォルト拒否。本人以外はサブコレクション含め一切アクセス不可。
- **書き込み規約:** 全書込は `await` ＋ 呼び出し側 `try/catch` ＋ UIフィードバック（[ADR-0022](06-adr.md)）。AIキャッシュ書込のみ失敗許容（`console.warn`）。
- **初期化順序:** `await ensureUserDocument`（存在チェック型）→ `Promise.all([loadLocations, loadUserSettings, loadAiAllowed])`。書込と並行 getDoc の部分スナップショット競合を回避。
- **未保存データ:** 現在地（`__geo__`）は Firestore に保存しない一時地点。ゲスト（T1）は uid が無いため一切永続化しない。
- **スキーマ進化:** サーバー側マイグレーションは無く、`getUserSettings` 読込時の前方互換補完（既定マージ・新要素差分追加）で吸収する。

### 5.7 都道府県コード導出（`prefCodeFromAreaCode`）
`jmaAreaCode`（class20s 7桁）→ 警報API用 `prefCode`（6桁）。
1. `AREA_TO_PREF` に個別マッピングがあればそれを返す（北海道・鹿児島・沖縄は「先頭2桁+0000」則が崩れるため）。
2. 先頭2桁が `46`（鹿児島）→ `460100`、`47`（沖縄）→ `471000`。
3. それ以外は `${先頭2桁}0000`。

例）北海道: 011000=宗谷 / 016000=石狩・空知等。鹿児島: 460040=奄美 / 460100=本土。沖縄: 471000=本島 / 473000=宮古島。

### 5.8 その他のコード値
| 種別 | 値 | 意味 |
|------|-----|------|
| `geoStatus` | `idle` / `loading` / `error` | 現在地取得の状態 |
| 仮想地点ID | `__geo__` | GPS現在地（Firestore非保存の一時地点） |
| `WeatherCodeMode` | `severity` / `frequency` | リスクでみる / 概況でみる |
| GAイベント | `guest_start` / `login` / `weather_view` | ゲスト開始 / ログインクリック / 天気参照（1ロード1回） |
| HTTPステータス（Functions） | 401 / 403 / 400 / 405 / 500 / 502 | 未認証 / 許可外 / 不正JSON / メソッド不許可 / キー未設定 / Gemini失敗 |
| 単位 | 風速=m/s（`wind_speed_unit=ms`）、飽差=g/m³、日射=MJ/m²、日照=h、積算温度=℃日 | ― |

---

## 更新履歴
| 日付 | リビジョン | 変更 |
|------|-----------|------|
| 2026-07-10 | `6512b83` | 初版（リバースエンジニアリング） |
