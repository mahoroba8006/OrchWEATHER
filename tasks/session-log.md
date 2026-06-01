
## 2026-06-01 セッション（23回目）

### 作業内容

#### AIコメントを4タブ構成に刷新

**コミット:** `c73287c`（push済み）

**背景:**
天気概況と作業アドバイスの2ブロック構成から、農業現場のニーズに合わせた4タブ構成へ刷新。

**4タブ構成（フィールド名）:**
| タブ | フィールド | 内容 |
|------|----------|------|
| 天気概況 | `weatherOverview` | 今日・明日の気温・雨・風の状況 |
| 悪天候の備え | `disasterPrep` | 強風・大雨・霜・猛暑リスク。リスクなし時は「予報なし」旨を明記 |
| 防除・散布 | `sprayingAdvice` | 風穏やか・雨なしのタイミング提案。風速・降水確率の数値付き |
| 一般外作業 | `generalWorkAdvice` | 雨を避けた晴れ間・熱中症・体調管理の提案 |

**変更ファイル:**
- `functions/api/ai-comment.ts` — responseSchema を4フィールドに更新、プロンプト刷新
- `src/api/aiComment.ts` — `AiCommentData` インターフェース更新
- `src/lib/aiCommentCache.ts` — Firestore 読み書きを新フィールドに対応
- `src/lib/aiCommentInput.ts` — 未使用 `calcVPD` 関数を削除
- `src/components/weather/AiCommentCard.tsx` — アンダーライン式4タブUI（lucide-react アイコン使用）

**UIの特徴:**
- アンダーライン型タブバー（アクティブ: アクセントカラー）
- テキストの `\n` は `white-space: pre-line` で改行として描画
- スケルトンもタブバーを模したデザインに更新

### 決定事項
- タブ構成: 天気概況 / 悪天候の備え / 防除・散布 / 一般外作業（4タブ）
- `overviewAndRisk`（旧）→ `weatherOverview` + `disasterPrep`（新）に分割

### 未完了タスク
- なし

### 次回への引き継ぎ
- AIタブUI・プロンプト稼働中。出力品質は引き続きチューニング余地あり
- 次の着手候補：①2バージョン管理の実装 ②Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-01 セッション（22回目）

### 作業内容

#### AI入力データ修正・風速単位バグ修正

**コミット:** `6594951`（push済み）

**問題1 - 風速単位:**
- Open-Meteo は `wind_speed_unit` 未指定だとデフォルト **km/h** で返す
- `forecast.ts` の API URL に指定がなく、km/h の値を m/s として AI に渡していた
- 結果: AI が「風速60m/s」など物理的にありえない値を出力
- **修正:** `forecast.ts` の Open-Meteo URL に `&wind_speed_unit=ms` を追加

**問題2 - 解除未定注意報の長期引き渡し:**
- `buildAiCommentInput` で `endMs` なし（解除未定）の注意報が発令から何日経っても渡され続ける
- **修正:** `aiCommentInput.ts` に 24時間フィルタを追加。`startMs` から 24h 超の解除未定注意報は除外

**注記:** ユーザー設定フィルタ（グループ無効化）は WeatherTab.tsx の `filteredJmaWarning` で実施済み

---

#### AI プロンプト改善

**コミット:** `cdbd77e`, `5a4253b`, `52d230f`（push済み）

- ペルソナ: 「農業の現場監督者」→「農作業をサポートする親切なアドバイザー」
- 専門用語（VPD・飽差・露点）禁止、日常語への言い換えを指示
- 意味の区切り・日ごとの改行（`\n`）を指示
- 出力文字数: 200 → 150 文字程度に戻し（ユーザー要求）
- 重要ポイントに具体的な数値（気温・降水量・風速など）を添えるよう指示追加

---

#### 日別予報UIの調整

**コミット:** `52d230f`（push済み）

- 時間帯ラベル「午前(4-12)」→「午前」改行「(4-12)」に変更（午後・夜間も同様）
- 日付フォントサイズ 0.75rem → **0.975rem**（1.3倍）
- 天気予報ラベルフォントサイズ 0.62rem → **0.806rem**（1.3倍）

### 決定事項
- Open-Meteo の風速は `wind_speed_unit=ms` で取得（m/s 統一）
- 解除未定の注意報は AI に渡す期間を発令から最大24時間に制限

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②Firestore TTL ポリシー設定（優先度低）

---

## 2026-05-31 セッション（21回目）

### 作業内容

#### AI農作業コメント機能 実装（サブエージェント駆動、6タスク）

**最終コミット:** `adc97ff`（push済み）

**実装ファイル:**
- `functions/api/ai-comment.ts` — Cloudflare Pages Function（Gemini 2.5-flash プロキシ）
- `src/lib/workWindows.ts` — 作業好適ウィンドウ決定論的抽出（後に廃止）
- `src/lib/aiCommentInput.ts` — 入力ペイロード組立 + djb2 ハッシュ
- `src/api/aiComment.ts` — クライアント fetch
- `src/lib/aiCommentCache.ts` — Firestore ユーザー別キャッシュ（TTL 4時間）
- `src/hooks/useAiComment.ts` — オーケストレーション Hook
- `src/components/weather/AiCommentCard.tsx` — カード UI（スケルトン付き）
- `src/components/weather/WeatherTab.tsx` — 統合

**重要な設計決定:**
- Firebase Functions ではなく Cloudflare Pages Function を使用（既存パターン踏襲）
- `useAiComment` の effect 依存を `[uid, hash]`（プリミティブのみ）に限定し無限ループ防止
- キャッシュヒット経路でも `setLoading(false)` を明示（スケルトン永久表示バグ修正）
- Firestore aiComments ドキュメント蓄積は既知の制約として許容（TTL ポリシーで後日対応予定）

**本番動作確認での修正:**
- `gemini-2.0-flash` → `gemini-2.5-flash`（新規ユーザーに廃止）
- `maxOutputTokens` 600 → 2048（JSON 途中切れ対策）
- Google Cloud プロジェクトへの請求先アカウント紐付けが必要（クォータ 0 解消）

#### AI機能 プロンプト・入力データ刷新（20回目後半）

**最終コミット:** `d6a482f`（push済み）

**変更内容:**
- 入力データ: 今後3日分の時間別全項目（気温/露点/湿度/飽差/風速/風向/瞬間風速/降水/降水確率/日射/UV/降雪）＋その後4日分の日別データ
- 出力形式: `weatherPoint[]`/`workWindows[]` → `weatherOverview`/`workAdvice`（各文字列150字程度）
- プロンプト: 天気概況（農作物への影響言及）＋作業アドバイス（現場監督視点）
- `workWindows.ts`（決定論的抽出）廃止・削除
- 命令的表現（「〜してください」「〜すべきです」）を禁止し、提案表現（「〜をおすすめします」「〜するとよいでしょう」）に限定
- `.gitignore` に `.wrangler/` を追加

### 決定事項
- AI機能の実行環境: Cloudflare Pages Function（Firebase Functions は不採用）
- Gemini モデル: `gemini-2.5-flash`
- キャッシュ TTL: 4時間（ユーザー別 Firestore）
- Firestore TTL ポリシー設定は後日（開発ひと段落後）
- 入力: 72時間時間別 + 4日日別（全項目）
- 出力: 天気概況 / 作業アドバイス の2ブロック構成

### 未完了タスク
- なし

### 次回への引き継ぎ
- AI機能は稼働済み。プロンプト品質は引き続きチューニング余地あり
- 次の着手候補：①2バージョン管理の実装 ②Firestore TTL ポリシー設定（優先度低）

---

## 2026-05-31 セッション（20回目）

### 作業内容

#### バグ修正：警報期間表示と終了未定ガントバーの6時間制限

**コミット:** `63d3360`（push済み）

**問題1 - 警報ボックスの期間表示:**
- 終了時刻が確定している場合: `5/28 06:00〜09:00`（正常）
- 終了時刻が未定の場合: `5/28 06:00〜` のみで `（解除未定）` が付いていなかった

**問題2 - ガントバーの幅:**
- `endMs` が `undefined` の場合、バーが表示範囲全幅まで伸びていた
- 合意仕様: 発令時から6時間のバー + `→` マーカー

**修正:**
- `src/api/jmaWarning.ts:buildValidPeriodMap`: 終了未定時の period 文字列を `〜` → `〜（解除未定）` に変更
- `src/components/weather/DailyForecast.tsx:warningToBar`: `endMs ?? Infinity` → `endMs ?? (wStart + 6h)` に変更
- `WarningBar.tsx` の `→` マーカーは `warning.endMs === undefined` を直接参照しており変更不要

### 決定事項
- 終了未定の警報期間は `〜（解除未定）` と表示する
- ガントバーは終了未定の場合、発令時から6時間分の幅を描画し末尾に `→` を付ける

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②AI農作業コメント機能

---

## 2026-05-31 セッション（19回目・続き）

### 作業内容

#### UI改善：地点登録ボタンを3入口並列化

**コミット:** `c312384`（push済み）

- ヘッダーボタンを「現在地で登録」「マップから選ぶ」「手動で追加」の3並列に変更
- 「マップから選ぶ」→マップ確定→フォーム自動展開（地名セット済み）
- フォーム内のボタンは「地図で修正」に改名（小さく控えめなスタイル）
- `showHeaderMapModal` 状態 + `handleHeaderMapConfirm` ハンドラを追加

#### バグ修正：濃霧注意報が表示されない問題

**コミット:** `4cd1cba`（push済み）

**原因:** JMA API の `timeSeries.warnings[].levels` が雷危険度などでオブジェクト配列形式になる場合があり、`buildValidPeriodMap` が文字列配列として誤処理して過去の `endMs` を算出、フィルタで除外されていた

**調査結果:**
- 乾燥注意報（コード04）: JMA APIに存在しない → 発令されていなかった（ユーザー誤認）
- 濃霧注意報（コード14）: `発表`ステータスあり → バグで非表示になっていた

**修正:** `buildValidPeriodMap` で `levels[0]` が文字列でない場合はスキップ。エントリ未登録時はフィルタ側が「期限未設定＝除外しない」として扱い、正しく表示される

**修正ファイル:** `src/api/jmaWarning.ts`

### 決定事項
- timeSeries の levels はオブジェクト配列形式が混在することを確認。文字列配列のみ処理する防御的実装に変更

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②AI農作業コメント機能

---

## 2026-05-31 セッション（19回目）

### 作業内容

#### 地点登録拡充：Leaflet マップ選択モーダル実装（完了）

**実装計画:** `docs/superpowers/plans/2026-05-31-location-map-picker.md`

**コミット群（push済み）:**
- `15edbf3` — leaflet@1.9.4 インストール + CSS グローバルインポート
- `24c6d35` — LocationMapModal コンポーネント新規作成
- `fb7c8c4` — コードレビュー修正（`as any` → `as unknown as Record`、Escape フォーカス、aria-label）
- `2fef509` — LocationSettings に「マップから選ぶ」ボタン追加（フォーム内）
- `6522779` — showMapModal / originalLatLon リセットバグ修正
- `53c4a1d` — NaN ガード・Escape キー動作修正・GPS アンマウントガード
- `c312384` — 「マップから選ぶ」をヘッダーに昇格、フォーム内は「地図で修正」に変更

**最終UI構成:**
- ヘッダーに3ボタン並列：「現在地で登録」「マップから選ぶ」「手動で追加」
- 「マップから選ぶ」→ マップ確定 → フォーム自動展開・座標＆地名セット済み
- フォーム内に小さな「地図で修正」ボタン（既存地点の座標修正用）

**技術決定:**
- vanilla Leaflet（react-leaflet 不使用）— React 19 の peer dep 競合回避
- GPS 自動センタリング（失敗時は日本全体 zoom:5）
- 確定時に GSI 逆ジオコーディングで地名候補取得
- subagent-driven-development（タスク×レビュー2段階）で品質担保

### 決定事項
- 地点登録の3入口を対等に並列化（現在地・マップ・手動）
- フォーム内は「地図で修正」として補助的位置づけに変更

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②AI農作業コメント機能

---

## 2026-05-30 セッション（18回目）

### 作業内容

#### 警報ガントバー実装（日別・時間別予報）

**コミット群（push済み）:**
- `5f32e36` — JmaWarningItem に startMs/endMs 追加
- `5577a42` — warningGantt ユーティリティ（レーン計算・色定数）
- `fa24128` — WarningBar コンポーネント
- `1493a49` — DailyForecast にガントバー行追加
- `01e013f` — HourlyTable にガントバー行追加
- `041982e` — WeatherTab から jmaWarnings を両コンポーネントに流す

**実装内容:**
- 警報・注意報の有効期間を日別予報ミニグラフ直下・時間別予報テーブルにガントチャートとして表示
- グリーディ区間スケジューリングで複数警報が重なる場合はレーンを追加
- 色: 注意報=黄〜オレンジ / 警報=ピンク〜レッド / 特別警報=ラベンダー〜パープル
- 解除未定バーは右端フェード + `→` マーク

#### 北海道・鹿児島 警報API prefCode バグ修正

**コミット:** `4e8781e`（push済み）

- `010000`（北海道）・`460000`（鹿児島）が JMA Warning API で 404 を返すバグを修正
- 全47都道府県コードを Live API でプローブし、問題のある3道県（01・46・47）を特定
- `src/lib/jmaAreaResolver.ts` の `AREA_TO_PREF` に北海道177件・鹿児島奄美13件・沖縄7件の全エリアコードを追加
- 北海道: 8つの気象台ファイル（011000〜017000）に分割
- 鹿児島: 本土（460100）・奄美（460040）の2ファイル
- 沖縄: 既修正4ファイルを統合テーブルに移行

#### 地点登録拡充 ブレインストーミング（途中・継続中）

**決定事項:**
- 登録方式: マップ選択のみ（住所検索なし）
- 地図ライブラリ: Leaflet（react-leaflet）—無料・APIキー不要
- UI統合: 既存フォームに「マップから選ぶ」ボタンを追加（モーダル型）
- マップ初期中心: Geolocation API で現在地取得（失敗時は日本全体 zoom:5）
- ピン確定時: lat/lon を自動セット + `getAreaName(resolveJmaAreaCode())` で地点名を候補表示（名称入力済みなら上書きしない）

**アーキテクチャ合意済み:**
- 新規: `src/components/settings/LocationMapModal.tsx`
- 変更: `src/components/settings/LocationSettings.tsx`（「マップから選ぶ」ボタン追加のみ）
- ノータッチ: store.ts / locationRepository.ts / jmaAreaResolver.ts

### 決定事項
- 警報APIコード解決: 3道県の例外マッピングをすべて統一テーブル `AREA_TO_PREF` に一本化
- 地点登録: Leaflet モーダル型マップ選択を追加（既存フォームは残す）

### 未完了タスク
- 地点登録拡充のブレインストーミング → 設計書作成・実装計画 が未完了（次回継続）

### 次回への引き継ぎ
- ブレインストーミングの続き: 設計書（spec）作成 → 実装計画 → subagent-driven-development
- Open-Meteo Historical API 復旧確認（status.open-meteo.com）

---

## 2026-05-30 セッション（17回目）

### 作業内容

#### 気象庁注意報・期限切れ警報バグの修正

**コミット `78752db`（push済み）**

**バグ内容:**
- 濃霧注意報「5/28 6:00〜9:00」が5/30 13:39時点でも表示され続けていた
- JMA APIが `解除` を発行しないまま `継続` ステータスを保持するケースがあり、コードがその状態に対処できていなかった

**修正内容 (`src/api/jmaWarning.ts`):**
- `buildValidPeriodMap` の返り値を `Map<string, string>` → `Map<string, { period: string; endMs?: number }>` に変更
- `endMs`: timeSeries の終了時刻を `Date.parse()` で UTC ms として保持（タイムゾーン込みで正確）
- `fetchJmaWarnings` で `endMs < now` の警報をフィルタアウト
- 予報期間終端まで続く警報（`endMs` 算出不可）は除外しない安全側設計

### 決定事項
- JMA APIの `解除` 未発行問題に対してクライアント側でフィルタリングする方針を採用
- `validPeriod` の終了時刻が現在時刻より過去なら非表示にする

### 未完了タスク
- なし（単独バグ修正）

### 次回への引き継ぎ（未着手の候補）
1. 2バージョン管理の実装（Vite フィーチャーフラグ + Cloudflare Pages 2プロジェクト）
2. AI 農作業コメント（Gemini 2.0 Flash + Firebase Functions プロキシ）
3. 地点登録の拡充（住所・マップからの登録）

---

## 2026-05-29 セッション（16回目）

### 作業内容

#### 気象庁注意報・警報システムの改善

**コミット `3820cac`（push済み）**

1. **JmaWarningSettings UI刷新**
   - チップ型（横並び）→ 縦リスト型に全面変更
   - カテゴリを4区分に再編（雨・洪水 / 雪・風 / 気温・大気 / 沿岸）
   - 各グループに発令基準の説明文とレベルバッジ（注意報のみ / 〜警報 / 〜特別警報）を追加
   - OFF時に行全体を半透明にして状態を視覚化

2. **JmaWarningSummary に有効期間表示を追加**
   - `timeSeries[].timeDefines` × `warnings[].levels` から有効時間帯を算出
   - 表示形式: `5/29 6:00〜9:00`（先頭ゼロなし）
   - timeSeries にデータがない場合は非表示（既存表示に影響なし）

3. **バグ修正2件**
   - 風雪グループにコード `24`（風雪警報）を追加（定義済みだが未収録だった）
   - `status === '継続'` の警報が表示されなかった問題を修正（`発表|更新|継続` にフィルタ拡張）

### 決定事項
- JMA注意報・警報の設定カテゴリは「雨・洪水 / 雪・風 / 気温・大気 / 沿岸」の4区分に確定

### 未完了タスク
- なし

---

## 2026-05-29 セッション（15回目）

### 作業内容

#### 現在地表示・デフォルト地点機能の実装（feature/current-location ブランチ → main マージ）

**機能概要:**
- 天気情報・あの時の天気・比較分析タブに「現在地を表示」ボタン追加
- GPS取得した仮想地点（`id = '__geo__'`）を Zustand store で全タブ共有
- 設定タブの地点設定に「デフォルトに設定」ボタン・「★ デフォルト」バッジ追加
- 起動時にデフォルト地点なければ自動で現在地を取得（`geoAttemptedRef` で重複防止）
- `UserSettings.defaultLocationId` を Firestore に保存（`setDoc merge: true`）

**主要コミット（feature/current-location）:**

| コミット | 内容 |
|---------|------|
| `e1c0c33` | refactor: extract geo utilities to `src/lib/geo.ts` |
| `3b31c49` | feat: add geoLocation/geoStatus to store and defaultLocationId to UserSettings |
| `5db5cc8` | feat: support `__geo__` locationId in useWeatherData（キャッシュ無効化含む） |
| `f8dabc4` | feat: add default location UI to LocationSettings |
| `7754eb9` | feat: startup geo fetch, getLocationName __geo__ support, analysis tab geo dropdown |
| `c15296e` | feat: add current location button and geo support to WeatherTab |
| `99164bd` | feat: add current location button and geo support to HistoricalWeatherTab |
| `a46c394` | fix: resolve __geo__ in forecastLoc for analysis tab forecast overlay |
| `5156ad6` | fix: remove unused geoStatus from App.tsx destructure |
| `1e1c0ea` | feat: add current location button to analysis tab |
| `d5a4e0c` | fix: auto-select __geo__ target on analysis tab geo button click |
| `5774b84` | feat: animated loading indicator with phase status in analysis tab |
| `2846178` | fix: remove invalid curly braces around chartLoading in ternary |
| `dd05db6` | feat: animated loading indicator with status in weather tabs |

**マージコミット:** `25f4d74` feat: merge current-location feature into main（push 済み）

**技術的ポイント:**
- `__geo__` は Firestore に保存しない仮想 locationId（store のみで管理）
- `prevGeoKeyRef` で座標変化を検知して `__geo__` キャッシュを無効化
- React hooks ルール遵守: useForecast/useHistoricalForecast は条件分岐より前に呼び出し

#### ローディングアニメーション改善

- `useWeatherData`: `loadingStatus` 追加（「気象データを取得中...」→「データを分析中...」）
- `useForecast`: `loadingStatus` 追加（「天気予報を取得中...」）
- `useHistoricalForecast`: `loadingStatus` 追加（「気象データを取得中...」）
- 全タブの「取得中...」テキストを `Loader2` スピナー + ステータス文字列に統一

### 決定事項
- `__geo__` 仮想地点方式で Firestore を汚染せずに現在地を共有する設計を採用
- ローディング UI は Loader2 アイコン（spin アニメーション）+ フェーズ別テキストで統一

### 未完了・次回への引き継ぎ
- 2バージョン管理の実装（Vite フィーチャーフラグ + Cloudflare Pages 2プロジェクト）
- AI 農作業コメント機能の設計・実装
- 地点登録方法の拡充（住所・マップ登録）

---

## 2026-05-28 セッション（14回目）

### 作業内容

#### コミット・push（前回未コミット分）

| コミット | 内容 |
|---------|------|
| `3c6d42b` | feat: 3-stage API strategy for historical weather data（forecast→historical-forecast→archive） |
| `c2f1936` | feat: connect user risk thresholds to HourlyTable display（detectSingleHourRisks導入・hourlyRiskMap事前計算） |

#### 気象業務法に関する法的リスク調査・相談

**調査結果サマリー：**

| 機能 | リスク評価 |
|------|-----------|
| 気象データ表示・10日間予報・比較分析・あの時の天気 | 問題なし |
| **リスク検出・注意情報表示（機能③）** | **グレーゾーン（中〜高リスク）** |
| AI農作業コメント（将来） | グレーゾーン（実装次第） |

**重要な確認事項：**
- 無料でも有料でも「業務として継続的に予想を発表する」時点で許可が必要になる可能性がある
- 身内・知人限定・招待制であれば実務上のリスクは極めて低い（法文上の明示的免除はない）
- 予報業務許可：登録免許税9万円、気象予報士設置が最大の壁（合格率5%・1〜3年）、個人取得は費用対効果が低い
- 許可事業者APIを利用した「データ再表示」設計なら許可不要の可能性が高い

#### 2バージョン戦略の設計相談

**決定した方針：**
- **身内フル機能版**：リスク検出・AI機能フル搭載、招待制、orchweather-private.pages.dev
- **一般公開版**：法的にクリーンな機能のみ、収益化対象、orchweather.pages.dev
- **実装方法**：単一リポジトリ＋Vite環境変数フィーチャーフラグ（`.env.full` / `.env.public`）
- 機能の振り分けは変更時に「両方」「片方」「段階的昇格」を自由に選択可能
- 大幅変更の実験はGitブランチで行い、mainを常に安定状態に保つ

### 決定事項
- 2バージョン戦略を採用する方向で合意
- 実装はまだ未着手（次回以降に進める）
- 気象庁への事前照会を有料化前に行うことを推奨（決定はユーザー判断）

### 未完了・次回への引き継ぎ
- 2バージョン管理の実装（Viteフィーチャーフラグ + Cloudflare Pages 2プロジェクト設定）
- AI農作業コメント機能の設計・実装
- 地点登録方法の拡充（住所・マップ登録）

---

## 2026-05-28 セッション（13回目）

### 作業内容

#### 時間別テーブル・リスク表示の各種改善（コミットなし）

**概要:** HourlyTable のリスク関連 UI 改善、HistoricalWeatherTab の表示修正をまとめて実装。

**実装内容:**

| 変更 | 内容 |
|------|------|
| リスクアイコン背景色削除 | `RiskBadgesRow` の `background: '#fff0f5'` を削除（アイコンのみ残す） |
| データ行の背景色をユーザー設定連動に変更 | `DATA_ROWS` の `isRisk`（ハードコード）→ `riskTypes: RiskType[]` に変換。`hourlyRiskMap`（`Map<string, Set<RiskType>>`）を本体で事前計算し、`detectSingleHourRisks` 結果と照合 |
| 「あの時の天気」初期スクロール修正 | `disablePastOpacity=true` のとき「現在時刻スクロール」処理を早期 return でスキップ → 左端から表示 |
| 「あの時の天気」日別 placeholder 除去 | `DailyForecast` に渡す `daily` を `data.daily` → `nonPlaceholderDaily` に変更（指定日以降のみ表示） |

**変更ファイル:**
- `src/components/weather/HourlyTable.tsx`
- `src/components/weather/HistoricalWeatherTab.tsx`

**DATA_ROWS riskTypes マッピング（確定）:**
| 行 | riskTypes |
|---|---|
| 気温 | `['heat', 'cold', 'frost']` |
| 降水 | `['rain']` |
| 露点 | `['frost']` |
| 湿度 | `['dry']` |
| 風速 | `['wind']` |
| CAPE | `['thunder', 'hail']` |
| 0℃層高度 | `['hail']` |
| 飽差・風向き・気圧 | `[]`（常に背景なし） |

### 決定事項
- データ行の背景色は `detectSingleHourRisks`（ユーザー設定・enabledRisks 完全反映）と連動
- 「あの時の天気」の時間別テーブルは左端（開始日の00:00）から表示
- 最終 HEAD: `720776a`（コミット済み・push 未実施）

### 未完了・次回への引き継ぎ
- 本日実装分は未 push（必要に応じてコミット・push すること）
- 次のアクション候補：
  1. AI 農作業コメント（Gemini 2.0 Flash + Firebase Functions プロキシ）
  2. 地点登録方法の拡充（住所・マップ登録）

---

## 2026-05-27 セッション（12回目）

### 作業内容

#### 比較分析タブ リファクタリング（設計・実装・push 完了）

**概要:** 比較件数を最大2件に絞り、差の方向を「2件目基準で1件目の行に表示」へ反転。予報日でも差を表示できるよう `computeAccumDiff` を拡張。

**実装方針の決定:**
| 項目 | 決定内容 |
|------|---------|
| 最大件数 | 3件→2件（addTargetガード・ヘッダー・ボタン条件） |
| ラベル | 「基準」削除、2件目のみ「比較」表示 |
| 差の方向 | `refId = targets[1]`（2件目が基準）、差は1件目の行に表示 |
| 差の算出 | `delta = 1件目.value − 2件目.value` |
| 予報日対応 | `forecastPrefixMap` で forecast key も同様に差を表示 |
| 予報ラベル | 「予報累積○○」→「予想累積○○」（4チャート） |
| 差の対象チャート | 累積系のみ（GDD・日射量・降水量・日照時間）、気温・湿度・飽差は対象外 |

**成果物（コミット・push 済み）:**

| コミット | 内容 |
|---------|------|
| `accb8fa` | 設計スペック: `docs/superpowers/specs/2026-05-27-comparison-analysis-refactor-design.md` |
| `19d6be0` | 実装計画: `docs/superpowers/plans/2026-05-27-comparison-analysis-refactor.md` |
| `d09e1e3` | feat: 最大件数 3→2（addTarget ガード・ヘッダー・ボタン条件） |
| `e3a72b4` | feat: 「基準」ラベル削除・2件目のみ「比較」表示 |
| `d63786e` | feat: refId を targets[1] に変更（差の方向反転） |
| `c8ebb89` | feat: computeAccumDiff に forecastPrefixMap 追加（予報日も差を表示） |
| `d4ab7bb` | fix: 予報 series name を「予報」→「予想」に変更（値ボックス表示） |

**技術的ポイント:**
- `refId` 1行変更（`targets[0]→targets[1]`）で差の方向を完全反転できる設計
- `computeAccumDiff` は確定キー（`accum_${id}`）と予報キー（`forecast_accum_gdd_${id}`）の両方をマッチさせる
- Δ日逆引きは `seriesByTarget.get(t0id)`（targets[0] の確定系列）を使用（予報日でも同様）
- サブエージェント駆動開発（4タスク × 実装＋スペックレビュー＋品質レビュー）で実施

**予報日の値ボックス表示（確定後）:**
```
予想累積積算 ○○℃  (+XX℃ / X日早い)   ← 1件目（緑）
日別積算 ○○℃  累積積算 ○○℃           ← 2件目（紫）
```

### 決定事項
- 設計スペック: `docs/superpowers/specs/2026-05-27-comparison-analysis-refactor-design.md`
- 実装計画: `docs/superpowers/plans/2026-05-27-comparison-analysis-refactor.md`
- 最終 HEAD: `d4ab7bb`（リモート push 済み）

### 未完了・次回への引き継ぎ
- 次のアクション候補：
  1. 過去気象再現（日付指定で 10 日間の実績気象を天気タブ同様 UI で表示）
  2. AI 農作業コメント（Gemini 2.0 Flash + Firebase Functions プロキシ）
  3. 地点登録方法の拡充（住所・マップ登録）

---

## 2026-05-27 セッション（11回目）

### 作業内容

#### リスク表示制御 + 冬リスク追加（実装・レビュー・push 完了）

**概要:** WeatherSettings のリスク行にアイコン追加・表示要否チェックボックス追加、降雪（snow）・低温（cold）の冬リスク2種を新規追加。app-wide フィルタリングを WeatherTab に実装。

**実装方針の決定:**
| 項目 | 決定内容 |
|------|---------|
| フィルタ範囲 | app-wide（WeatherTab 1箇所でフィルタ、全コンポーネントに自動適用） |
| 低温と霜の関係 | 独立（重複検知を許容） |
| 初期状態 | 全9種チェック ON |
| 表示順 | 春（霜）→ 夏秋（雷雨・雹・大雨・強風・高温・乾燥）→ 冬（低温・降雪） |
| enabledRisks の型 | `RiskType[]`（`RiskThresholds` に追加、Firestore 永続化） |

**成果物（コミット・push 済み）:**

| コミット | 内容 |
|---------|------|
| `b0e54bb` | store.ts: RiskType（snow/cold追加）・RiskThresholds（snow/cold/enabledRisks追加） |
| `9cc1ca2` | userRepository.ts: ローカル DEFAULT_RISK_THRESHOLDS コピー更新 |
| `ec8034b` | riskDetection.ts: RiskType を store へ移行・snow/cold 検知ロジック・RISK_BADGES 追加 |
| `442b4b6` | WeatherTab.tsx: enabledRisks フィルタリング追加 / RiskSummary.tsx: ORDERED_TYPES 更新 |
| `f5bb3b5` | WeatherSettings.tsx: アイコン・チェックボックス・低温/降雪行の完全実装 |
| `c9b67ff` | fix: cold アイコンを overcast-sleet に変更（frost と区別）・handleEnabledChange dedup ガード追加 |
| `060efd9` | fix: 積雪メトリクス単位 cm/h → cm・DEFAULT_RISK_THRESHOLDS 3ファイルに同期コメント追加・spec の cold アイコン記載更新 |

**技術的ポイント:**
- `RiskType` は `store.ts` で定義し `riskDetection.ts` が `import type` + `export type` で再エクスポート（循環 import 回避）
- `DEFAULT_RISK_THRESHOLDS` は store.ts / userRepository.ts / riskDetection.ts の3ファイルにローカルコピー（同期コメント付与済み）
- 既存 Firestore ユーザーは `enabledRisks` フィールドなし → `??` フォールバックで全9種 ON の安全なデフォルト
- 時間別・日別ともに snowfall/snowfallSum は API に既存（変更不要）

**レビューで発見・修正した問題:**
1. cold アイコンが frost と重複（thermometer-snow → overcast-sleet に変更）
2. handleEnabledChange に dedup ガードなし（追加）
3. 積雪の時間別 metrics 文字列が `cm/h`（正しくは `cm` に修正）
4. DEFAULT_RISK_THRESHOLDS の3コピーに sync コメントなし（追加）

### 決定事項
- 設計スペック: `docs/superpowers/specs/2026-05-27-risk-display-toggle-winter-risks-design.md`
- 実装計画: `docs/superpowers/plans/2026-05-27-risk-display-toggle-winter-risks.md`
- 最終 HEAD: `060efd9`（リモート push 済み）

### 未完了・次回への引き継ぎ
- 次のアクション候補：
  1. 過去気象再現（日付指定で 10 日間の実績気象を天気タブ同様 UI で表示）
  2. AI 農作業コメント（Gemini 2.0 Flash + Firebase Functions プロキシ）
  3. 地点登録方法の拡充（住所・マップ登録）

---

## 2026-05-26 セッション（10回目）

### 作業内容

#### リスク閾値カスタマイズ 設計（brainstorming → writing-plans 完了）

**概要:** 天気リスク検知の閾値をユーザーごとに Firestore へ永続化し、WeatherSettings.tsx（気象情報サブタブ）でカスタマイズできる機能の設計。実装は次回。

**設計フェーズ（brainstorming）での決定事項:**

| 項目 | 決定内容 |
|------|---------|
| 対象リスク | 全7種（霜・強風・大雨・高温・乾燥・雷雨・雹） |
| 霜の条件 | 気温 ≤ X ＆ 露点 ≤ Y（複合条件、両方をユーザー設定可） |
| 大雨の閾値 | 時間雨量（mm/h）と日雨量（mm）を別設定（夕立型 vs 長雨型の区別） |
| 雷雨・雹 | CAPE 感度スライダー（控えめ/標準/敏感）で内部マッピング |
| 雹の条件 | CAPE 感度 ＆ 0℃層高度 ≤ Z m（複合条件、両方をユーザー設定可） |
| 通知機能 | スコープ外（本フェーズは「通知条件の定義UI」のみ） |
| Firestore | `/users/{uid}` に `riskThresholds` フィールド追加（既存構造を拡張） |

**成果物（コミット済み）:**

| コミット | 内容 |
|---------|------|
| `aaf5afb` | スペック作成: `docs/superpowers/specs/2026-05-26-risk-threshold-customization-design.md` |
| `d1d924d` | 計画作成: `docs/superpowers/plans/2026-05-26-risk-threshold-customization.md` |
| `10c130b` | `frostDewPoint`・`hailFreezingLevel` を追加（仕様変更をスペック・計画に反映） |

**RiskThresholds の確定フィールド:**
```typescript
interface RiskThresholds {
  frost: number;              // 霜 気温 ≤ X ℃  (デフォルト: 3)
  frostDewPoint: number;      // 霜 露点 ≤ X ℃  (デフォルト: 0)  ※時間別のみ
  wind: number;               // 強風 ≥ X m/s   (デフォルト: 15)
  rainHourly: number;         // 大雨 ≥ X mm/h  (デフォルト: 30)
  rainDaily: number;          // 大雨 ≥ X mm    (デフォルト: 80)
  heat: number;               // 高温 ≥ X ℃    (デフォルト: 35)
  dry: number;                // 乾燥 ≤ X %    (デフォルト: 30)
  thunderSensitivity: 'low'|'medium'|'high';  // 雷雨CAPE感度 (デフォルト: 'medium')
  hailSensitivity: 'low'|'medium'|'high';     // 雹CAPE感度   (デフォルト: 'medium')
  hailFreezingLevel: number;  // 雹 0℃層高度 ≤ X m (デフォルト: 3500) ※時間別のみ
}
```

**変更予定ファイル（実装フェーズ）:**
- `src/store.ts`
- `src/lib/userRepository.ts`
- `src/lib/riskDetection.ts`
- `src/components/weather/WeatherTab.tsx`
- `src/components/settings/WeatherSettings.tsx`

### 決定事項
- ユーザーニーズ「あの時の状況に近い条件になったら通知」の実現に向け、まず閾値定義UIを先行実装
- 霜と雹は複合条件（＆）をUI上で「＆」テキストで視覚的に明示する

### 未完了・次回への引き継ぎ
- **次のアクション:** リスク閾値カスタマイズの実装（計画ファイルに従ってサブエージェント駆動 or インライン実行）
- 実装後: 過去気象再現 or AI機能プロトタイプに移行

---

## 2026-05-26 セッション（9回目）

### 作業内容

#### 設定UI再設計・実装（完了）

**概要:** SettingsModal（モーダル形式）を廃止し、設定専用タブ（ネストタブ3段）に全面再設計。現在地登録機能も同時追加。

**設計フェーズ（brainstorming → writing-plans）:**
- ヘッダー廃止 → タブバー1層（sticky top:0, 56px）に統合
- タブバー左端にアプリアイコン（装飾のみ）
- タブ構成: 天気情報 | 比較分析 | ⚙設定
- Desktop: タブバー右端にアバター＋ログアウト
- Mobile: アバター＋ログアウトは設定タブ内のアカウントエリアに移動
- 設定タブ内サブタブ（下線型）: 地点設定 / 気象情報 / 比較分析
- スペック: `docs/superpowers/specs/2026-05-26-settings-ui-redesign-design.md`
- 実装計画: `docs/superpowers/plans/2026-05-26-settings-ui-redesign.md`

**実装フェーズ（subagent-driven-development）:**

| コミット | 内容 |
|---------|------|
| `1c8c427` | AnalysisSettings.tsx 作成（SettingsModal から分析設定を移植） |
| `04bd56e` | NaN ガード修正（基準温度の空入力対策） |
| `b8ec5bc` | WeatherSettings.tsx 作成（プレースホルダー） |
| `0d0a053` | LocationSettings.tsx 作成（地点管理＋現在地登録） |
| `e361416` | Firestore fire-and-forget 禁止ルール適用・stale エラー修正 |
| `adb5b34` | SettingsTab.tsx 作成（ネストタブルート） |
| `c86c5b3` | isMobile を useState lazy init に修正 |
| `90e22cd` | App.tsx: ヘッダー廃止・タブバー統合・設定タブ接続 |
| `8ffe898` | SettingsTab の配置バグ修正（analysis ブロック外に移動） |
| `291452a` | Footer.tsx: ロゴテキスト追加 |
| `d05e592` | SettingsModal.tsx 削除・ビルド確認 |

**レビューで発見・修正した主な問題:**
1. NaN が Firestore に書き込まれる可能性（基準温度の空入力）
2. Firestore fire-and-forget 違反（LocationSettings の保存処理）
3. stale エラー表示（handleEdit 時に geo エラーが残る）
4. `window.innerWidth` をレンダー毎に読む問題
5. SettingsTab が analysis ブロック内にネスト（設定タブ未表示の致命的バグ）

**新規ファイル:**
- `src/components/settings/AnalysisSettings.tsx`
- `src/components/settings/WeatherSettings.tsx`
- `src/components/settings/LocationSettings.tsx`
- `src/components/settings/SettingsTab.tsx`

**削除ファイル:**
- `src/SettingsModal.tsx`

### 決定事項
- SettingsModal は完全廃止、設定タブに格上げ
- 現在地登録は Geolocation API（enableHighAccuracy: false, timeout: 10s）で実装
- 気象情報サブタブは将来のリスク閾値カスタマイズの受け皿として先行作成

### 未完了・次回への引き継ぎ
- 次のアクション候補（前回策定を更新）：
  1. 機能②リスク閾値カスタマイズの仕様確定・実装（気象情報サブタブに配置）
  2. AI 機能のプロトタイプ用プロンプト設計（アイデア 1・2 を先行）
  3. 機能①過去気象再現の実装

---

## 2026-05-25 セッション（8回目）

### 作業内容

#### 新機能の企画・設計検討（コード変更なし）

**議題①：Open-Meteo Historical API 復旧確認**
- 前セッションから様子見中だった Historical API が正常復旧したことをユーザーが確認

**議題②：新機能 4 案の整理・評価**
検討した機能：
1. **過去気象再現**：日付指定で 10 日間の気象情報を現在の天気タブと同じ UI で表示
2. **リスク閾値カスタマイズ**：ユーザーが自分好みのリスク判定設定を変更可能にする
3. **地点登録方法の拡充**：現在地・住所・マップからの登録を追加
4. **AIによる農作業解説**：天気情報に AI コメントを追加

主要な設計決定：
- 機能③「現在地で登録」ボタンは実装コスト最小で価値最大 → 最優先候補
- 機能②は Firestore のデータ構造変更を伴うため、機能④の前に設計を確定させる必要あり
- 機能①（過去気象再現）は Historical API が復旧したため着手可能

**議題③：AI 機能の設計方針決定**
- AIエンジン：**Gemini 2.0 Flash**（Firebase Functions 経由プロキシ必須）
- 設計原則：**ユーザーへの追加入力を一切求めない**（既存データだけで AI に情報を渡す）
- キャッシュ：地点 + 日付 + 入力ハッシュをキーに Firestore にキャッシュ（TTL 3〜6時間）

**AI 機能アイデア 4 案を策定・保存（`tasks/ai-feature-ideas.md`）：**
| アイデア | 概要 | 配置 |
|---------|------|------|
| 1. 気象翻訳 | 数値→農業的意味に変換（蒸れ・霜リスクの文脈説明） | 天気タブ |
| 2. 作業ウィンドウ | 農薬散布・圃場作業の最適タイミング自動検出 | 天気タブ |
| 3. 地域の旬 | 緯度経度×季節でローカル農業アドバイス推測 | 天気タブ |
| 4. 去年との違い | GDD・降水量の差分を一言要約 | 分析タブ |

### 決定事項
- Open-Meteo Historical API 復旧済み → 機能①（過去気象再現）の着手が可能
- AI 機能の設計原則：ユーザー入力ゼロ、既存データのみで動作させる
- AI エンジン：Gemini 2.0 Flash（Firebase Functions 経由）
- AI アイデアは `tasks/ai-feature-ideas.md` に詳細仕様として保存済み

### 未完了・次回への引き継ぎ
- 次のアクション候補（優先順）：
  1. 機能③「現在地で登録」ボタンの実装（最小コスト・即効性あり）
  2. 機能②リスク閾値カスタマイズの仕様確定（Firestore データ構造含む）
  3. AI 機能のプロトタイプ用プロンプト設計（アイデア 1・2 を先行）
  4. 機能①過去気象再現の実装

---

## 2026-05-25 セッション（7回目）

### 作業内容

#### 雨コメント表示の改善

**変更内容:**
- **`src/components/weather/HourlyTable.tsx`:**
  - `precipToLabel` フォントサイズを `10.5` → `8.4`（20%縮小）
  - 雨コメントの描画をSVG `<text>` → HTMLオーバーレイ `<div>` に変更
    - `preserveAspectRatio="none"` によるSVG横方向スケールの影響で文字が横長になる問題を根本解消
    - 各列幅（`flex: 0 0 N%`）に収め、`overflow:hidden` + `textOverflow:ellipsis` で隣列との重複を防止
    - CSSフォントを使用するため横伸び・歪みが発生しない
  - SVG内はバー（`rect`）と気温パス（`path`）のみを残す

**変更ファイル:**
- `src/components/weather/HourlyTable.tsx`

**コミット:**
- `0de8512`：フォントサイズ縮小 + todo.md ステップ8・9クローズ
- `fe601ad`：SVG → HTML オーバーレイ変更（main へ push 済み）

### 決定事項
- Bitgo風モバイルチャートUXの実機確認完了（todo.md ステップ8・9クローズ）
- 雨コメントはSVG内テキストではなくHTMLオーバーレイで描画する（歪み防止・列幅クリップの標準）

### 未完了・次回への引き継ぎ
- Open-Meteo Historical API 障害は様子見継続（復旧後に分析タブで動作テスト）

---

## 2026-05-24 セッション（6回目）

### 作業内容

#### 天気タブ UI改善：RiskSummary の配置変更とミニマル化

**変更内容:**
- **`src/components/weather/WeatherTab.tsx`:**
  - `<RiskSummary>` を `<DailyForecast>` の前（最上部）に移動
  - `<section className="glass-panel">` ラッパーを削除（`RiskSummary` が自前で管理するため）

- **`src/components/weather/RiskSummary.tsx`:**
  - `rows.length === 0`（注意情報なし）時：早期 return でミニマル表示
    - 背景・ボーダーなし、`padding: '0.3rem 1rem'`、フォント `0.78rem`、色 `#b8c0cf`
    - テキスト: `🍃 現在、注意情報はありません`
  - `rows.length > 0`（注意情報あり）時：`glass-panel` カード表示（既存デザイン維持）
    - `<section className="glass-panel">` を自前で持つ構造に変更

**変更ファイル:**
- `src/components/weather/WeatherTab.tsx`
- `src/components/weather/RiskSummary.tsx`

**コミット:** `a05c8f3`（main へ push 済み）

### 決定事項
- 視線の動き（マクロ→ミクロ）に合わせ、注意情報は日別予報より前に表示
- 「引き算のデザイン」方針：情報がない時は glass-panel カードを出さず、極小テキストのみ
- `RiskSummary` はコンテナスタイルを自前管理（`WeatherTab` からラッパーを排除）

### 未完了・次回への引き継ぎ
- Open-Meteo Historical API 障害は様子見継続
- 復旧確認後: 分析タブで動作テスト

---

## 2026-05-24 セッション（5回目）

### 作業内容

#### 気温・湿度・飽差チャートの10日予報を破線縦バーに変更

**変更内容:**
- **`src/api/forecast.ts`:**
  - `DailyForecastData` インターフェースに `humidMax: number` を追加
  - APIリクエストのdailyParamsに `relative_humidity_2m_max` を追加
  - daily マッピングに `humidMax` フィールドを追加

- **`src/App.tsx`:**
  - `ForecastRangeBar` コンポーネントを追加（`CustomRangeBar` の破線版）
    - 縦中央線: `strokeDasharray="5 4"` の破線、上下キャップは実線、`opacity: 0.7`
  - `baseChartData` の予報ループを `[min, max]` 配列形式に変更
    - `forecast_tempRange_{id}`: `[tempMin, tempMax]`
    - `forecast_humidRange_{id}`: `[humidMin, humidMax]`
    - `forecast_vpdRange_{id}`: `[calcVPD(tempMin, humidMax), calcVPD(tempMax, humidMin)]`
  - 気温・湿度・飽差チャート: `Line` → `Bar + ForecastRangeBar` に置換
  - `renderCustomLegend` に `dashed-range-bar` 型を追加（SVGアイコン）
  - 凡例ラベル: `'10日予報最低湿度'` / `'10日予報最高飽差'` → `'10日予報'` に統一

**変更ファイル:**
- `src/api/forecast.ts`
- `src/App.tsx`

**コミット:** `d26216d`（main へ push 済み）

### 決定事項
- 分析チャートの予報オーバーレイは「破線縦バー（`ForecastRangeBar`）」を標準とする
  - 折れ線より視覚的に「範囲」を示し、且つ履歴データ（実線縦バー）と明確に区別できる
- 湿度と飽差の予報は最高・最低の両方を表示（最低のみから拡張）

### 未完了・次回への引き継ぎ
- Open-Meteo Historical API 障害は様子見継続
- 復旧確認後: 分析タブで予報オーバーレイを含む動作テスト

---

## 2026-05-24 セッション（4回目）

### 作業内容

#### 分析チャート全7本に10日予報破線オーバーレイを追加（`d6bcb95`〜`d604549`、計9コミット）

**変更内容:**
- `src/api/forecast.ts`: `DailyForecastData` に `sunshineDuration` を追加
- `src/App.tsx`:
  - `useForecast` フックの配線（`forecastLoc` useMemo + `useForecast` 呼び出し）
  - `baseChartData` に予報ループ追加（気温・湿度・飽差・累積降水・日照・日射）
  - `gddData` に予報GDDループ追加
  - 気温（最高・最低 2本）、降水（累積）、日照（累積）、日射（累積）、積算温度（累積）、湿度（最低）、飽差（最高）に `<Line strokeDasharray="5 4">` を追加
- `currentTargetHasForecast`: `!isMonthly && !!forecastData && targets[0]?.year === currentYear`

**コミット範囲:** `027d3ae` 〜 `c551341`

### 決定事項
- 今後 `ResponsiveContainer` は常に `minWidth={0}` を含めること（プロジェクト標準）
- 予報オーバーレイは targets[0]（第1ターゲット）+ 今年のみに表示
- Historical API が日次モードのみ対象（`!isMonthly` ガード）

---

## 2026-05-24 セッション（3回目）

### 作業内容

#### 「自然と水」をテーマにしたプレミアムUIデザインへの刷新とフリーズバグ根本解消

**変更内容:**
- **デザインシステム刷新 & ガラスマージズム化:**
  - `src/index.css` の全面書き換え（Outfitフォントの導入、ガラスマージズム・陰影・なめらかなアニメーションの定義）。
  - `src/App.tsx` のヘッダー、タブコントロール、地点選択パネルを半透明ガラスマージズムデザインへ移行。
  - `src/components/weather/WeatherTab.tsx` 内の天気パーツを角丸ガラスパネルでラップし、ボックス間の隙間を従来の 5分の1 (`0.35rem`) にぎゅっと圧縮して洗練。
  - `src/components/weather/DailyForecast.tsx` と `HourlyTable.tsx` の不要な見出し行を削除し、テーブル列幅を 20% 縮小、アイコンサイズを 10% 縮小して極小化。
  
- **起動時フリーズ（背景色一色）問題の解消:**
  - `App.tsx` の `onAuthStateChanged` 内の Firestore 取得処理を `try-catch` で保護し、通信エラー（オフライン等）発生時にも確実に `setAuthLoading(false)` が呼び出されるように修正してフリーズを完全排除。
  - `calcMobileDefaultViewport` にて、初期ロード中のプロパティ未定義による TypeError クラッシュを防ぐため、オプショナルチェイニング `d?.dateStr` やヌルガードを追加して完全堅牢化。

- **数値スプレッドシート（テーブル）の角丸プレミアム化:**
  - 比較分析スプレッドシートの `.table-container` を角丸 `var(--radius-lg)` に拡張し、`overflow-y: hidden` および `transform: translateZ(0)` マジックを適用。これにより、`border-collapse: collapse` されたテーブル要素の背景が親の角丸を突き抜けてはみ出るブラウザ描画バグを完全解消。

**変更ファイル:**
- `src/App.tsx`
- `src/index.css`

**コミット:** `d6bcb95`（main へ push 済み）

### 決定事項
- 起動フリーズ防止のため、認証処理内での Firestore ロードは必ず `try-catch` すること。
- モバイル・リサイズ幅計算では、オプショナルチェイニングによる厳密な型ガードを徹底すること。
- テーブルに角丸を適用する際は、`transform: translateZ(0)` 等のはみ出し防止策をセットで適用すること。

### 未完了・次回への引き継ぎ
- Open-Meteo Historical API 障害は様子見継続
- 復旧確認後: 分析タブで動作テスト

---

## 2026-05-24 セッション（2回目）

### 作業内容

#### 日別予報デザイン修正（`5552e0e`）

**変更内容:**
- 注意情報のある日の琥珀色網掛け（`rgba(245,158,11,0.06)`）を削除
- 今日の水色網掛け（`rgba(2,132,199,0.08)`）を削除 → 全セル `rgba(255,255,255,0.35)` に統一
- 最高気温テキスト色: `#f43f5e`（rose-500）→ `#fb7185`（rose-400）
- 最低気温テキスト色: `#0284c7`（sky-600）→ `#38bdf8`（sky-400）
- ミニチャート最高気温線: `#f43f5e` → `#fda4af`（rose-300）
- ミニチャート最低気温線: `#0284c7` → `#7dd3fc`（sky-300）

**変更ファイル:** `src/components/weather/DailyForecast.tsx`

**コミット:** `5552e0e`（main へ push 済み）

### 決定事項
- セル網掛けは「今日」「リスク日」問わず全廃止、テキスト色で今日を識別
- 気温色はテキスト1段・グラフ線2段 それぞれ淡化（強度差を保持）

### 未完了・次回への引き継ぎ
- Open-Meteo Historical API 障害は様子見継続
- 復旧確認後: 分析タブで動作テスト

---

## 2026-05-24 セッション

### 作業内容

#### 分析タブ Recharts ResponsiveContainer 修正（`d3cab0e`）

**問題:**
- モバイル表示で `ResponsiveContainer` が幅0になりグラフが消える現象

**対応:**
- 全7箇所の `ResponsiveContainer` に `minWidth={0}` を追加
- 対象ファイル: `src/components/analysis/` 配下の各チャートコンポーネント

---

#### archive-api 直接アクセスへ戻す（`f0180ca`）

**判断:**
- CF Pages Function プロキシは Open-Meteo 障害中の回避策として試みたが、API 自体がダウン中のため意味なし
- プロキシコードは残置（復旧後の再利用オプションとして）、archive-api エンドポイントは直接アクセスに戻す

---

#### 分析タブのデフォルト期間をモバイル向けに最適化（`2bd3498`）

**変更:**
- 分析チャートの初期表示期間を「月境界に揃えた直近3ヶ月」に変更（モバイル向け）
- データ過多によるパフォーマンス問題を軽減

### 決定事項
- Open-Meteo Historical API 障害は様子見継続
- ResponsiveContainer の `minWidth={0}` はプロジェクト標準として全箇所に適用済み

### 未完了・次回への引き継ぎ
- Open-Meteo Historical API 復旧待ち（[status.open-meteo.com](https://status.open-meteo.com) で確認）
- 復旧確認後: 分析タブで動作テスト → 完了
- 長期未復旧の場合: NASA POWER API への切り替えを検討（`src/api/weather.ts` 書き換え）

---

## 2026-05-23 セッション（2回目）

### 作業内容

#### 注意情報（RiskSummary）UI リファクタリング

**変更仕様：**
- 日別予報と時間別テーブルの間に常にボックスを表示（注意情報なし時も表示）
- 注意情報なし →「注意情報はありません」をグレー文字で表示
- リスク別の背景色コーディングを削除（colored background / left border を除去）
- 行の単位を「リスク種別ごとに複数日まとめ」→「1リスク × 1日 = 1行」に変更
- ソート順：日付順 → 同日内はリスク優先順（霜・雷雨・雹・強風・大雨・高温・乾燥）
- 行間の区切り線なし、コンテナ上下に `#ebeef5` の水平線のみ

**変更ファイル：**
- `src/components/weather/RiskSummary.tsx`（全面書き換え）

**コミット：** `d1d8618`（main へ push 済み）

### 決定事項
- RiskSummary は常時表示（データ取得後）

### 未完了・次回への引き継ぎ
- Open-Meteo Historical API 障害の様子見継続（status.open-meteo.com で確認）
- 復旧後：分析タブで動作確認

---

## 2026-05-23 セッション

### 作業内容

#### 分析タブAPIエラーの調査（継続）

**別AIエージェントの分析レビュー:**
- 別AIが「jma_msmの処理時間が6秒かかるためCFタイムアウト」と診断 → 反論・修正
- 正しい根本原因: 日本→Hetzner特定セグメント(5.9.98.184)への経路断絶 + Historical API自体のダウン
- era5_land切り替え（処理0.05秒）は有効な改善策だが、ルーティング問題と切り離す必要があると指摘

**Cloudflare Smart Placement の手動設定:**
- ダッシュボード: Pages > Settings > ランタイム > プレースメント を「スマート」に変更
- 結果: `cf-placement: local-NRT`（日本PoPのまま）→ Smart Placementは「ユーザーに近いPoP」を選択するため、日本ユーザーには日本PoPを選ぶ。根本的に用途不一致と確認

**val.town プロキシの試行:**
- [dash.deno.com](https://dash.deno.com) のPlaygroundでは Playground も日本/アジアPoPから実行 → 504
- [val.town](https://val.town) でHTTPプロキシを作成（mahoroba8006/open-meteo-proxy）
  - HTTPトリガーを追加しないと `Invalid version provided` エラーが返る（val.town仕様）
  - HTTPトリガー追加後、正しいURL: `https://mahoroba8006--1be48d1056aa11f1a408ee650bb23af1.web.val.run`
  - era5_land指定・パラメータあり でも **504** → archive-api自体に到達不能

**公式ステータスで根本原因が判明 (status.open-meteo.com):**
- Forecast API (free): 正常（99〜100%）
- **Historical API (free): 2026-05-22に94.63%、2026-05-23に0%（完全ダウン）**
- → 全てのプロキシ試行が失敗していたのはサーバー自体が落ちていたため

### 決定事項
- Open-Meteo Historical API は公式に障害中（2026-05-23時点で稼働率0%）
- 復旧後は既存のCF Pages Functionプロキシ（`/api/archive`）でそのまま動く見込み
- 長期的代替案として **NASA POWER API** を特定（無料・商用利用可・日本から直接アクセス可能・ERA5ベース）

### 未完了・次回への引き継ぎ
- **しばらく様子見**（Open-Meteo Historical API の復旧を待つ）
- 復旧確認方法: [status.open-meteo.com](https://status.open-meteo.com) でHistorical API (free)の稼働率を確認
- 復旧したら: 分析タブで動作確認 → 問題なければ対応完了
- 長期的に復旧しない場合: NASA POWER APIへの切り替え（`src/api/weather.ts`の書き換え）
- val.town の `mahoroba8006/open-meteo-proxy` は削除してよい（不要）
- 現在の分析タブのコードは CF Pages Function プロキシ構成のまま（変更不要）
