
## 2026-06-18 セッション（87回目）

### 作業内容

#### 1. LP「リスクでみる/概況でみる」解説セクションを追加・改善
- 初版: `WeatherModeSection` を独立セクションとして追加（後に廃止）
- 精度指摘への対応: 「多くの天気アプリは雨マークをつける」は裏付けなしと判断し削除
- レイアウト改善: 独立セクションを `FieldFeaturesSection` 内の lp-zigzag--reverse 2段目に移行
- 最終統合: 2段 zigzag の重複（3時間帯の二重説明）を解消し、1段 zigzag に統合
  - ヘッドライン: 「午前は動ける、午後から雨」——その答えを、自分の基準で出す。
  - sub-items 4つ: リスクでみる / 概況でみる / UV / カッパ判断ラベル
- セクションリード文の「3つのこだわり」削除（「時間の刻み方と見方の選択が違います」に変更）

#### 2. 本番反映
- develop → main にマージ・プッシュ（コミット: `de37ccd`）

### 決定事項
- LP のコピーは裏付けのある事実ベースに限定する（誇張は指摘時に即崩れるため）
- 関連する機能説明は独立セクションより同一 zigzag 内 sub-items にまとめる方がスッキリする

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-18 セッション（86回目）

### 作業内容

#### 1. ボタンスタイル修正
- 「リスクでみる」ボタンの枠線をピンク系（`#e88ea8`）に変更（WeatherTab / HistoricalWeatherTab）
- 「概況でみる」はティール系（`#0d9488`）で統一

#### 2. 空くらべ モバイル表示改善
- グラフ背景を白化（`chartFrame` に `background: '#ffffff'`）
- チャートセクションに `background: rgba(255,255,255,0.97)` を追加
- CSVセクションをソリッドホワイト＋強めシャドウ＋ティールボーダーのカードに
- モバイルのセクション間ギャップを `1.75rem → 0.25rem` に縮小
- チャートセクションのパディングをモバイルで `0.75rem 1rem` に縮小

#### 3. AIコメント「天気の備え」(disasterPrep) 完全削除
- 削除対象: store.ts / api/aiComment.ts / aiCommentCache.ts / AiCommentCard.tsx / AiCommentSettings.tsx / userRepository.ts / functions/api/ai-comment.ts / HelpPage.tsx（8箇所）

#### 4. 設定タブ「AIコメント」→「空のアドバイス」にラベル変更

#### 5. AIステータスバーを空もように追加
- 注意報ボックスの上部に表示
- 分析中: Loader2スピナー＋「空もようを分析中…」
- 完了時: ✨アイコン（フェードパルスアニメーション）＋「空のアドバイスが届きました」
- タップでAIコメントセクションにスムーズスクロール（56pxオフセット）

#### 6. Git運用 develop/main 2ブランチ移行
- `develop` ブランチを作成・push
- **ルール確定: commit/pushはdevelopのみ、mainへの反映は明示的指示があったときのみ**

#### 7. 使い方ページ（HelpPage）更新
- 「天気アイコンの表示モード」セクション追加（リスクでみる/概況でみる説明）
- 「ミニアイコンタグ」セクション追加
- AIコメント→空のアドバイスのラベル修正
- じぶん好みタブのデータ説明文修正（時間別予報・日別実績表記）

#### 8. 各種テキスト修正
- 空のアドバイス各タブの説明文を修正（草取り→管理作業 等）
- 免責事項・プライバシーポリシーのAI提供元をAnthropic Claude→Google Geminiに修正
- 空くらべグラフ凡例「10日予報」→「予報値」に変更（7箇所）
- ai-customプロンプトにMarkdown記法禁止の制約を追加

### 決定事項
- developブランチをデフォルトの作業ブランチとする（mainへの反映は明示指示のみ）
- ✨アニメーションはフェードパルス（1.8秒周期）を採用

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-18 セッション（85回目）

### 作業内容

#### 1. 日別予報 スペーシング・レイアウト調整
**コミット:** `12bcbf6`（push済み）

- 天気名テキストをアイコン行のflexコンテナに統合（別`<tr>`を廃止）→ 天気名→アイコン間のスペースをgap:0で最小化
- 午前/午後/夜間ラベル→天気名の間隔: `paddingTop: 0.6rem`
- アイコン→ミニアイコンタグの間隔: `marginTop: 8px`
- ミニアイコンの「概況」「リスク」タグの背景色を白（`background: 'white'`）に変更
- トグルボタンラベルを「リスクをみる」→「リスクでみる」、「概況をみる」→「概況でみる」に変更
- 降水確率行・風速行セルにも `onClick` を追加しタップ可能範囲を列全体に拡大

#### 2. タップ時スムーズスクロール改善
**コミット:** `12bcbf6` → `d90eda6`（push済み）

- タップ時に時間別テーブルセクションへスムーズスクロール（空もよう・空しらべ両タブ）
- `scrollIntoView` → `window.scrollBy({ top: rect.top - 56 })` に変更
- stickyヘッダー56px分をオフセットして時間別日付行がヘッダー直下に表示されるよう修正

### 決定事項
- ヘッダーオフセット: 56px（stickyヘッダー高さと一致）

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-18 セッション（84回目）

### 作業内容

#### 1. タブ名「あの日の空」→「空しらべ」に変更
**コミット:** `487f8e1`（push済み）

- `App.tsx`（PCヘッダー・モバイルボトムナビ）、`HelpPage.tsx`（目次・セクション見出し）、`LandingPage.tsx`（本文参照）を更新

#### 2. 空しらべ 地点/日付セレクターのUI改善
- 「開始日」の前に flex ブレーク要素を挿入し、2行目から表示
- 「（昨日以前のみ）」コメントを削除

#### 3. 天気コードモードトグルのUI改善
- ボタンラベル: 「リスクを優先」→「リスクをみる」、「概況を優先」→「概況をみる」
- 「概況をみる」選択時のアクティブ色をグリーン系（`rgba(13,148,136,0.18)` / `#0f766e`）に変更
- ボタン横に現在モードの説明文を追加（モード連動で切替）
  - severity 選択時: 「時間帯でいちばん悪い天気を表示」
  - frequency 選択時: 「時間帯でいちばん多い天気を表示」

### 決定事項
- 説明文は「〜を前面に」ではなく「〜を表示」で統一
- 「概況をみる」はグリーン系・「リスクをみる」はピンク系で色を使い分け

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-18 セッション（82・83回目）

### 作業内容

#### 1. 日別天気アイコン インライン切替機能を実装
**コミット:** `8e1d8d1` / `bcc771b` / `c91fd8a` / `827490b`（push済み）

**アーキテクチャ変更（モード切替を即時化）:**
- `DailyForecastData` の `amWeatherCode/pmWeatherCode/nightWeatherCode: number | null` を廃止 → `amCodes/pmCodes/nightCodes: number[]` に変更
- `fetchForecast` / `fetchHistoricalForecast` から `mode` パラメーターを削除
- `useForecast` / `useHistoricalForecast` のキャッシュキーから mode を除去（`${lat},${lon}` に簡略化）
- `DailyForecast.tsx` がレンダー時に `selectCode(codes, weatherCodeMode)` を呼び出す方式に移行
- `store.ts` の `updateWeatherCodeMode` を楽観的更新に変更（Zustand 先行 → Firestore は fire-and-forget）
- **効果:** モード切替が API 再フェッチなし・React 再レンダーのみで即時反映（数秒の遅延を解消）

**UI 追加（「空もよう」「あの日の空」両タブ）:**
- 日別予報ブロック上部に `[リスクを優先] [概況を優先]` トグルボタン（左詰め）
- アクティブボタン: `rgba(244,167,185,0.45)` 背景 + `#7a2840` テキスト
- 両タブが同一の Zustand `weatherCodeMode` を共有（設定は永続化）

**ミニアイコン表示:**
- 選択中モードと異なるコードの場合のみ、メインアイコン下部にミニアイコンを表示
- サイズ: メインの 50%（42px）、opacity 削除（フル表示）
- モードラベルタグ（ピル型）: 「概況」= ティール / 「リスク」= ピンク（トグルボタンと配色統一）
- ラベル2行: 1行目=タグ、2行目=天気名（フォント 0.6rem）
- セル高さ: 148px 固定（横スクロール時の不揃い防止）

**設定タブ:**
- 「時間帯の天気アイコンの表示設定」セクションを**完全削除**（インライン化で不要）

### 決定事項
- モードタグ色はトグルボタンのアクティブ色と統一してコンテキストを明示
- ミニアイコンのラベルクランプ: `maxWidth` による人工制限は不要（td の 50px が自然に有効）
- 設定タブのセクションは削除（二重管理を避けシンプルに）

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-17 セッション（80・81回目）

### 作業内容

#### 1. 天気アイコン選択設定が「いまの空」タブに反映されないバグ修正
**コミット:** `e031de3`（push済み）

- `WeatherTab.tsx` の `useForecast` 呼び出しに `weatherCodeMode` を渡していなかった
- 設定変更（悪い天気を優先/多い天気を優先）が「いまの空」タブに反映されないバグを解消
- あわせて設定UI改善：
  - 「時間帯の天気アイコンの選び方」→「時間帯の天気アイコンの表示設定」に改称
  - 天気アイコン設定セクションに独立した保存ボタンを追加（即時反映→ローカル選択→保存で確定の形式に統一）

#### 2. Meteocons v2/v3形式の違いについて調査・説明（実装なし）
- clear-day.svg と cloudy.svg の SVG 構造を比較・取得
- **確定した差分:** clear-day はルート `<g>` に `clip-path` なし / cloudy はあり
- rain.svg も `clip-path` あり（cloudy と同構造）→ rain のモバイル動作は未検証

#### 3. 降水量ラベルのタグ風デザイン（試行→破棄）
- `HourlyTable.tsx`（時間別日本語ラベル）と `DailyForecast.tsx`（日別ミニグラフ mm 表示）を修正
- ユーザーの意図と実装箇所がズレていたため両コミットを revert
- **コミット:** `3c01589` / `d110ddb`（実装）→ `eb8bb91` / `63f014d`（revert済み）

### 決定事項
- Meteocons v3形式（128 viewBox + clip-path）はモバイルで使用しない方針を維持
- WMO コード3は `overcast` のまま

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-17 セッション（78・79回目）

### 作業内容

#### 1. モバイルで曇りアイコンが表示されない問題の調査・修正

**経緯:**
- セッション77（`5c17c86`）でWMOコード3を `overcast` → `cloudy` に変更
- `1754e3a` / `ccdd774` で `cloudy.svg`（アニメ版・静止版）を新規追加
- この変更後、モバイルで曇りアイコンが画像リンク切れ表示になる不具合が発生

**調査過程（複数回の仮説検証）:**
- 仮説①「`<defs>` 末尾配置による前方参照」→ 実機確認でも改善せず（否定）
- 仮説②「MIME / 404 / キャッシュ / エンコード問題」→ ライブ配信を UA別に実測: PC/モバイルとも HTTP 200 / image/svg+xml / バイト同一（否定）
- 仮説③「`clip-path` 参照」→ 静止版で clip-path 除去後に時間別が修正 ✓、日別は依然 NG
- 仮説④「`animateTransform`」→ 除去後に日別が修正したかどうかユーザーが未確認のまま CDN再取得へ
- CDN公式版（`cloudy.svg`）を再取得しても状況変わらず

**根本原因の特定:**
- `overcast.svg`（コード3の旧アイコン）= Meteocons v2形式（512 viewBox、`<symbol>/<use>`）→ モバイルで正常表示実績あり
- `cloudy.svg` = Meteocons v3形式（128 viewBox、`<path>`直書き＋`clip-path`）→ CDN公式版であってもモバイルのimg文脈で描画失敗

**最終修正（確実な解決策）:**
- コード3のマッピングを `cloudy` → `overcast` に差し戻す（WeatherIcon.tsx 1行変更）
- **コミット:** `508b432`（push済み）

**決定事項:**
- `cloudy.svg`はv3形式のためモバイルでは使用不可。コード3は引き続き `overcast.svg` を使用
- `public/icons/weather/cloudy.svg` / `public/icons/weather-static/cloudy.svg` はファイルとして残存するが参照されない状態

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-17 セッション（77回目）

### 作業内容

#### 1. 天気コード集計ロジック統一 + ユーザー設定対応（全8タスク完了）
**コミット:** `2fb7675` → `6699c1c` → `463f227` → `62c30c0` → `7f49bfe` → `327c63b` → `a24a525`（push済み）

- `src/lib/wmoSeverity.ts` に `WeatherCodeMode = 'severity' | 'frequency'`・`modeCode()`・`selectCode()` を追加
- `forecast.ts`: インライン `modeCode` を削除、`selectCode(codes, mode)` に統一
- `historicalForecast.ts`: `DayAmPmEntry` を配列方式（`amCodes/pmCodes/nightCodes`）に変更、`selectCode(mode)` を適用
- `store.ts` + `userRepository.ts`: `UserSettings.weatherCodeMode`・`updateWeatherCodeMode()` を追加
- `useForecast.ts` / `useHistoricalForecast.ts`: `mode` パラメーター追加、キャッシュキーに mode を含める
- `App.tsx` / `HistoricalWeatherTab.tsx`: `userSettings?.weatherCodeMode ?? 'severity'` をフックに渡す
- `AnalysisSettings.tsx`: トグルUI追加（後に天気情報タブへ移動）
- **デフォルト:** `'severity'`（最深刻度）

#### 2. 天気アイコン更新（WMO code 3 / 53 / 55）
**コミット:** `5c17c86` / `1754e3a` / `ccdd774`（push済み）

- WMO 3（曇り）: `overcast` → `cloudy`
- WMO 53（霧雨）: `drizzle` → `overcast-drizzle`
- WMO 55（霧雨強）: `drizzle` → `overcast-drizzle`
- アニメーション版・静止版それぞれ SVG を追加

#### 3. 設定UIのコピー改善＋タブ移動
**コミット:** `a47dd74` / `a58f644`（push済み）

- 設定タブ「注意報等」→「**天気情報**」に改名
- 天気コードモード設定を「空くらべ」タブ → 「天気情報」タブのトップに移動
- コピー改善:
  - タイトル: 「天気コードの集計方法」→「時間帯の天気アイコンの選び方」
  - ボタン1: 「最深刻度（推奨）」→「悪い天気を優先」
  - ボタン2: 「最頻値」→「多い天気を優先」
  - 説明文: 箇条書き形式（守り重視・実態重視）

### 決定事項
- 天気コード集計は「最深刻度（severity）」をデフォルトとし、ユーザーが設定で切替可能
- 設定は「天気情報」タブ（旧注意報等）のトップに配置

#### 4. キャッシュ動作の確認（Q&A・実装変更なし）
- 天気アイコン設定変更時のキャッシュ影響について確認
- キャッシュキーが `${lat},${lon},${mode}` なのでモード変更でキーが変わり自動再フェッチされる
- `useEffect` が `setData(null)` → `load(false)` を順に呼ぶため古いデータ混在もなし

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（前回持ち越し・優先度高）
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-16 セッション（76回目）

### 作業内容

#### 1. 有料化戦略の再検討（議論のみ・実装なし）
- **結論:** フリーミアム ＋ クレカ不要14日トライアル ＋ 年払い推奨（¥480/月 or ¥4,600/年）
- 前回案（最初から課金）を変更。LINEで送り合う農家ユーザーは口コミ主体のため無料入口が重要
- 14日トライアルはクレカ不要のオプトイン型（カード登録→自動課金ではない）
- AI・空くらべ・カスタムプロンプトが有料。基本7日予報は無料
- 損益分岐: ¥480/月プランで11人（Open-Meteo ¥5,000/月想定）

#### 2. 空くらべの日別データテーブルを廃止（DailyRawTable.tsx）
**コミット:** `d3dad90` / `7485b36` / `63d862a`（push済み）

- テーブル89行のコードを削除し、CSVダウンロードボタン＋説明文のみに簡素化
- 最終説明文: 「グラフに表示されているすべての項目（気温・降水・日射・日照・湿度・飽差・累積値など）を一括で取得できます。※予測値は含まれません」
- CSV生成ロジック（全17列）はそのまま維持

#### 3. 農業向け追加API項目の調査・提案（議論のみ・実装なし）
- **ET₀（蒸発散量）** `et0_fao_evapotranspiration`: 農業的意義が最も高い。灌水量計算に直結
- **地温** `soil_temperature_6cm`: 播種適期判断（地温10℃以上目安）
- **土壌水分** `soil_moisture_3_to_9cm`: 灌水タイミング判断（精度はローカル土壌依存）

#### 4. ET₀の効果的な表示方法の検討（議論のみ・実装なし）
- 時間別追加は効果薄（時間値0.23mmは農家に意味が分かりにくい）
- **推奨1位:** AIコメントの入力データに追加（実装コスト最小・品質向上）
- **推奨2位:** 日別予報に「日合計ET₀」行を追加
- 次回実装予定

### 決定事項
- DailyRawTable はCSVボタンのみに簡素化（完了）
- ET₀はAIコメント入力追加から着手する方針（未実装）

### 未完了・次回候補
- ET₀をAIコメント入力データに追加（最優先）
- 日別予報にET₀日合計行を追加
- LP 残り2枚差し替え（hero-imanosora / feature-ai）
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-16 セッション（75回目）

### 作業内容

#### 1. AIタブバーのページ縦スクロールを修正（AiCommentCard.tsx）
**コミット:** `77a909e`（push済み）

- **問題:** AIコメント応答が返ってきた際、タブが切り替わると `scrollIntoView` がページ全体を縦スクロールさせていた
- **原因:** `scrollIntoView({ block: 'nearest' })` は overflow-x コンテナ内でも、ページが縦スクロールの祖先として使われる
- **修正:** `scrollIntoView` を廃止し、コンテナの `scrollLeft` を直接操作する方式に変更

#### 2. 地点編集フォームをカードインライン表示に変更（LocationSettings.tsx）
**コミット:** `a52a65c`（push済み）

- **問題:** 編集ボタンを押しても編集フォームがリスト最下部に表示され、地点数が多いと気づきにくかった
- **修正:** 編集対象のカード自体が編集フォームに変化するインライン方式に変更
- `renderEditForm()` を共有関数として抽出し、既存地点編集・新規追加の両方で再利用

#### 3. 予報取得日数を11日→16日に拡張（forecast.ts）
**コミット:** `84bfb11`（push済み）

- `forecast_days=11` → `forecast_days=16`
- `forecast_hours=264` → `forecast_hours=384`（16日×24h）
- HourlyTable 返却は引き続き `slice(0, 92)` で 72h 維持
- `dayAmPm` 集計は全384hで実行するため、16日分すべての午前・午後・夜間アイコン・降水確率・風速が表示される

#### 4. LINEブラウザ検出・外部ブラウザ誘導ガイドを実装（LoginScreen.tsx）
**コミット:** `881e895`（push済み）

- `Line/` UA でLINEブラウザを検出
- iOS・Androidそれぞれの外部ブラウザへの誘導手順を表示
- URLコピーボタン（クリップボード API）を追加

### 決定事項
- Open-Meteo の `forecast_days` 最大値は **16日**（APIドキュメント準拠）
- LINEブラウザ判定は `/Line\//i.test(navigator.userAgent)`

### 未完了・次回候補
- `/lp/feature-daily.webp` スクリーンショット撮影 → `public/lp/` に配置
- LP 残り2枚: `hero-imanosora.webp` / `feature-ai.webp` 差し替え
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-16 セッション（74回目）

### 作業内容

#### 1. 雷雨系アイコン修正（WMO 95/96/99）
**コミット:** `8e3a2a3`（push済み）

- **原因:** 前回（72回目）で 95/96/99 を存在しないファイル名にマッピングしており、`not-available.svg` が表示されていた
- **対応:** ユーザー提供の cdn.meteocons.com/3.0.0-next.10 から3ファイルをダウンロード
  - `thunderstorms-extreme-rain.svg`（95: 雷雨）
  - `thunderstorms-extreme-sleet.svg`（96: 雷雨＋弱ひょう）
  - `extreme-thunderstorms-extreme-sleet.svg`（99: 雷雨＋強ひょう）
- animated（`public/icons/weather/`）・static（`public/icons/weather-static/`）両フォルダに配置
- `WeatherIcon.tsx`: code 95 を `thunderstorms-overcast`→`thunderstorms-extreme-rain` に修正

### 決定事項
- Meteocons アイコンが jsdelivr CDN に存在しない場合は `cdn.meteocons.com/3.0.0-next.10/svg/fill/` を参照する
- 雷雨系は昼夜共通ファイル（`${d}` サフィックスなし）

### 未完了・次回候補
- `/lp/feature-daily.webp` スクリーンショット撮影 → `public/lp/` に配置
- LP 残り2枚: `hero-imanosora.webp` / `feature-ai.webp` 差し替え
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-16 セッション（73回目）

### 作業内容

#### 1. タブ名「いまの空」→「空もよう」に変更
**コミット:** `72bc2e1`（push済み）

- `src/App.tsx`（PC・モバイル各1箇所）
- `src/components/HelpPage.tsx`（目次・コメント・見出しの3箇所）
- `src/components/LandingPage.tsx`（alt属性）

#### 2. AIコメントカードの表示位置を変更（WeatherTab.tsx）
**コミット:** `72bc2e1`（同上）

- 移動前: 注意報サマリー直下（日別予報・時間別予報より上）
- 移動後: 時間別予報（HourlyTable）の下

### 決定事項
- タブ名は「空もよう」に統一（HelpPage の見出しも含む）
- AIコメントは天気データをすべて見た後に読む位置へ

### 未完了・次回候補
- `/lp/feature-daily.webp` スクリーンショット撮影 → `public/lp/` に配置
- LP 残り2枚: `hero-imanosora.webp` / `feature-ai.webp` 差し替え
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-16 セッション（72回目）

### 作業内容

#### 1. WMO深刻度マップ実装（src/lib/wmoSeverity.ts 新規作成）
**コミット:** `2b0d958`（push済み）

- `WMO_SEVERITY`（26段階）+ `wmoSeverity(code)` + `worstCode(a,b)` を新規ファイルに集約
- WMOコードは現象ブロック別に整理されており数値の大小と深刻度は一致しない問題を解消
  - 例: code 65（大雨）> code 80（にわか雨弱）だが WMO数値は 65 < 80
- **forecast.ts:** `modeCode()` のタイブレークを `code > result`（数値比較）→ `wmoSeverity(code) > wmoSeverity(result)` に変更
- **historicalForecast.ts:** `buildDayAmPmMap()` の am/pm/night 3箇所で `Math.max(d.xxxCode, h.weatherCode)` → `worstCode()` に変更

#### 2. 天気アイコン修正（WeatherIcon.tsx）

| コード | 変更前 | 変更後 |
|--------|--------|--------|
| 77（雪粒） | `extreme-snow` | `overcast-snow` |
| 82（激しいにわか雨） | `partly-cloudy-{d}-drizzle` | `partly-cloudy-{d}-rain` |
| 86（にわか雪） | `overcast-{d}-snow` | `partly-cloudy-{d}-snow` |
| 95（雷雨） | `thunderstorms-{d}-extreme-rain` | `thunderstorms-overcast` |
| 96（雷雨ひょう） | `extreme-thunderstorms-extreme-hail` | `thunderstorms-extreme-sleet` |
| 99（激しい雷雨ひょう） | `extreme-thunderstorms-extreme-hail` | `extreme-thunderstorms-extreme-sleet` |

### 決定事項
- WMO深刻度は専用ファイル `src/lib/wmoSeverity.ts` で一元管理（forecast.ts / historicalForecast.ts 両方から import）
- 77（雪粒）は `extreme-snow` でなく `overcast-snow`（大雪より軽いことを反映）
- 95（雷雨）は昼夜共通 `thunderstorms-overcast`、96/99（ひょう）は `*-extreme-sleet` 系に統一

### 未完了・次回候補
- `/lp/feature-daily.webp` スクリーンショット撮影 → `public/lp/` に配置
- LP 残り2枚: `hero-imanosora.webp` / `feature-ai.webp` 差し替え
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-16 セッション（71回目）

### 作業内容

#### 1. 削除確認ダイアログをカスタムモーダルに変更（LocationSettings.tsx）
**コミット:** `f3d9c53`（push済み）

- `window.confirm()` を廃止し、インラインモーダルに差し替え
- ブラウザが自動で付与する「weather.orch-app.comの内容」というヘッダーを排除
- 表示テキスト：タイトル「登録地点の削除」／本文「本当に削除しますか？」
- 背景クリックまたはキャンセルボタンで閉じる、削除ボタンで実行

#### 2. React error #310（hooks順序違反）の修正
**コミット:** `f3d9c53`（同上）

- **根本原因:** `WeatherTab.tsx` と `HistoricalWeatherTab.tsx` の両方で、`useCallback(scrollToHour)` が条件付き早期 `return` の**後ろ**に定義されていた
- **症状:** 初回ログイン時・地点未登録状態で「いまの空」を開くと、geoLocation 取得前後でフック数が変わり（10→11）React が error #310 を投げてアプリ全体がクラッシュ
- **修正:** `useCallback` を `if (locations.length === 0 && !geoLocation)` ブロックの**前**（全フック呼び出しの後）に移動

### 決定事項
- 削除確認ダイアログはカスタムモーダル方式（window.confirm は使わない）
- hooks はすべて条件分岐や早期 return より前に配置する（今後の実装でも同様）

### 未完了・次回候補
- `/lp/feature-daily.webp` スクリーンショット撮影 → `public/lp/` に配置
- LP 残り2枚: `hero-imanosora.webp` / `feature-ai.webp` 差し替え
- iOS Safari 実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-15 セッション（70回目）

### 作業内容

#### 1. 日別予報ミニグラフ大幅改善
**コミット:** 複数（push済み）

- **日照時間行を削除**（DailyForecast.tsx）
- **気温ドット+ラベル追加:** AM/PM/夜間各時間帯の最高・最低気温にドット(r=2.5)とラベルを追加。最高気温ラベルはドット上方、最低気温ラベルはドット下方
- **単位追加:** 気温ラベルに℃、降水ラベルにmmを付与
- **降水ラベルをバー底部固定:** y={H-2}・dominantBaseline="auto"で常にSVG底部に固定、気温ラインとの干渉を回避
- **グラフ高さ調整:** CHART_H=80、padT=14、padB=20、innerH=46でラベルゾーンを確保
- **降水バー色を統一:** var(--accent-blue)（opacity=0.6）
- **降水バー高さ拡張:** 係数廃止、最大高さ=innerH（グラフ全体まで伸びる）
- **気温ラインの色:** TEMP_MAX_COLOR='#fb7185'（rose-400）、TEMP_MIN_COLOR='#7dd3fc'（sky-300）

#### 2. 時間帯別最大風速行の追加
**コミット:** push済み（caf2e23 Cloudflareビルドエラー修正含む）

- `DailyForecastData` に `amWindMax / pmWindMax / nightWindMax: number|null` を追加（forecast.ts / historicalForecast.ts）
- `DailyForecast.tsx`：降水確率行の下に時間帯別最大風速行を追加
- `historicalForecast.ts`：DayAmPmEntry型・createPlaceholderDay・buildDayAmPmMap・expandDayAmPmの4箇所修正（Cloudflareビルドエラー対応）

#### 3. Meteocons SVGアイコンに変更
- 降水確率アイコン: `https://cdn.meteocons.com/3.0.0-next.10/svg-static/flat/raindrop.svg`
- 風速アイコン: `https://cdn.meteocons.com/3.0.0-next.10/svg-static/fill/wind-dust.svg`
- サイズ: `width='1.8em' height='1.8em'`

#### 4. セルパディング縮小・時間帯説明テキスト追加
- amCell/pmCell/nightCell の padding: 0.3rem → 0.15rem
- WeatherTab.tsx：DailyForecastとHourlyTableの間に時間帯説明テキストを右寄せで追加（「午前：4〜12時　午後：12〜20時　夜間：20〜翌4時」）

#### 5. LPに現場機能セクション追加（LandingPage.tsx）
- `FieldFeaturesSection` を追加（FeaturesSection後・ComparisonSection前）
- タイトル「農家の時間軸で、天気を読む。」
- zigzagレイアウト、Clock/Sun/CloudRainアイコン使用
- 3機能：時間帯別（AM/PM/夜間）/ UV指数 / カッパ判断ラベル
- 画像: `/lp/feature-daily.webp`（未撮影・プレースホルダー）

#### 6. 最高・最低気温行を削除し日付バナーに統合
**コミット:** `1e522a2`（push済み）

- 最高気温・最低気温の独立行を削除
- 日付バナーを `position: relative` + `textAlign: center` でセンタリング
- 気温を `position: absolute; right: 0.4rem` で右端配置（最高=#fb7185、最低=#7dd3fc、0.72rem）

#### 7. ミニグラフ気温・降水ラベルのフォントサイズ拡大
**コミット:** `07b75b7`（push済み）

- 気温ラベル・降水ラベルを fontSize=8 → 11 に変更（8→10→12→11と調整して確定）

### 決定事項
- ミニグラフの気温・降水ラベルは fontSize=11 で確定
- 降水ラベルはSVG底部固定（気温グラフとの干渉回避）
- 最高・最低気温は日付バナー右端に統合（専用行廃止）、日付はセンタリング
- 時間帯説明テキストは右寄せ（日別予報と時間別テーブルの間）

### 未完了・次回候補
- `/lp/feature-daily.webp` スクリーンショット撮影→ `public/lp/` に配置
- LP 残り2枚: `hero-imanosora.webp` / `feature-ai.webp` 差し替え
- iOS Safari 実機確認（NAV blur / HERO クリップなし / 比較表横スクロール / 画像 / ログイン動作）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-15 セッション（69回目）

### 作業内容

#### 1. 日別予報 全日を午前・午後・夜間の3列表示に統一
**コミット:** `a4c37bf`（push済み）

- `forecast_hours=72 → 264` に拡張し、4日目以降も hourly データを取得
- 全日（分割日・非分割日）を AM/PM/夜間の3列レイアウトに統一（`SPLIT_DAYS` 廃止）
- 夜間を 20:00〜翌4:00 に統一（最終分割日の "Short" 集計 20:00-0:00 を廃止）
- 天気コード算出を最悪値（Math.max）から **最頻値（modeCode）** に変更（同頻度は悪い方）
- HourlyTable 用 hourly は `slice(0, 92)` で 72h のまま維持
- `DailyForecastData` から Short 系フィールド 5 つを削除、`historicalForecast.ts` の参照も削除

### 決定事項
- 天気表示は最頻値（modeCode）、同頻度なら悪い方に統一（全時間帯共通）
- daily API の `weather_code`（最悪値）は分析・リスク検出用として保持

### 未完了・次回候補
- LP hero・feature-ai スクリーンショット差し替え
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-15 セッション（68回目）

### 作業内容

#### 1. じぶん好みプロンプト入力欄にplaceholder表示を追加
**コミット:** `dbcb7d5`（push済み）

- `DEFAULT_AI_CUSTOM_PROMPT` を `userRepository.ts` から export
- `AiCommentSettings.tsx` の textarea の placeholder を `DEFAULT_AI_CUSTOM_PROMPT` に変更
- 空欄時にデフォルト文が薄い字で表示されるようになった

#### 2. 空保存時にデフォルトプロンプトをフォールバックとして使用
**コミット:** `4a3840c` / `bb69bde`（push済み）

- **問題①:** `useAiCustomComment` で `customPrompt.trim().length > 0` が false になりAI呼び出しがスキップされていた
- **問題②:** `AiCommentCard` の `hasCustomPrompt` が false のまま「設定してください」メッセージを表示し続けていた
- **修正:** `WeatherTab.tsx` で `aiCustomPrompt || DEFAULT_AI_CUSTOM_PROMPT` にフォールバック（呼び出し側・hasCustomPrompt両方）
- ブラウザキャッシュが残っていたためハードリフレッシュ後に動作確認済み

#### 3. LP スクリーンショット3枚差し替え
**コミット:** `2bcb01b`（push済み）

- DevTools モバイルシミュレーションで撮影・切り抜き → sharp で WebP 変換
- `feature-kurabe.webp`（1178×1922）/ `feature-hourly.webp`（1165×1959）/ `feature-custom.webp`（1167×1830）
- `LandingPage.tsx` の width/height を実寸に更新

### 決定事項
- LP 残り2枚（hero-imanosora / feature-ai）は未差し替え

### 未完了・次回候補
- LP hero・feature-ai スクリーンショット差し替え
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-14 セッション（67回目）

### 作業内容

#### 1. AIコメント・カスタム システムプロンプトのキャラクター定義を強化
**コミット:** `67c7c4f`（ai-comment.ts）/ `3bcfed3`（ai-custom.ts）（push済み）

- SYSTEM_PROMPT冒頭の自己紹介を拡張
- 「農作業に豊富な知識をもち現場の実情を深く理解している」＋「プロのライター」の二面性を付与
- ai-custom.ts にはさらに「気象予報士の資格も保有」を追加
- ユーザーが直接IDE上で編集・保存した変更をそのままコミット

#### 2. ai-comment.ts 追加修正
**コミット:** `710ee21`（push済み）

- 「豊富な文章力で」を追加（ai-custom.tsと表現を統一）
- `thinkingBudget: 1500 → 1024`（コスト最適化）

### 決定事項
- なし

### 未完了・次回候補
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- LP スクリーンショット差し替え
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-14 セッション（66回目）

### 作業内容

#### 1. AIコメント プロンプト改行指示を具体化
**コミット:** `94eba19`（push済み）

- weatherOverview / disasterPrep / sprayingAdvice / generalWorkAdvice の4フィールドの改行指示を「今日、明日など文脈の区切りで `\n`」に変更

#### 2. 日別予報 日付バナータグ・時間帯ピルタグを追加
**コミット:** `1aea354`（push済み）

- 分割日（0〜2日目）の日付をバナータグ化（今日=ブルー、他=ティール）
- 午前/午後/夜間ラベルをピルタグ化（全部同色）

#### 3. バナータグ・ピルタグを拡充
**コミット:** `77e6fc9`（push済み）

- 非分割日（4日目以降）にも横長バナータグを適用
- 今日の分割日の午前/午後/夜間ピルをブルー系に変更
- HourlyTable（時間別テーブル）の日付行にバナータグを適用

#### 4. HourlyTable 日付バナータグを colSpan で1日全幅に拡張
**コミット:** `ef99454`（push済み）

- 同一日の全時間列を colSpan で結合し、0時〜23時まで横長タグが伸びるように変更
- 今日=ブルー / 未来=ティール / 過去=グレー で配色統一

### 決定事項
- 天気アイコン×日照時間の乖離（Open-Meteo の上流データ問題）は現時点では対応不要と確定
- AIコメントローディングアニメーションは前セッションで実装済み（確認済み）
- 午前/午後/夜間タグは全部同色（A案）で統一

### 未完了・次回候補
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- LP スクリーンショット差し替え
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-14 セッション（65回目）

### 作業内容

#### 1. 非分割日（4日目以降）の天気アイコンを最頻WMOコードに変更
**コミット:** `067f20a`（push済み）

- **問題:** Open-Meteo の `daily.weather_code` は「その日の最悪コード」を代表値とするため、深夜の一時雨が1日全体を雨アイコンにしてしまっていた
- **解決策:** `dayAmPm` マップに `amCodes: number[]` / `pmCodes: number[]` を追加し、昼間時間帯（4〜19時）の hourly `weather_code` を蓄積
- **`modeCode()` 関数を追加:** 最頻値を採用、同頻度なら悪い（大きい）コードを採用
- **`daily.weatherCode` の差し替え:** `modeCode([...amCodes, ...pmCodes])` を優先、hourly データがない場合のみ `daily.weather_code` にフォールバック
- 分割日（0〜2日目）は am/pm/night を個別表示するため変更なし
- 変更ファイル: `src/api/forecast.ts` のみ

### 決定事項
- 非分割日の天気アイコンは昼間（4〜19時）の最頻WMOコードで表示する
- 法的問題なし（同一APIデータを別集計窓で表示するだけ）
- 同頻度の場合は悪い方のコードを採用（過小評価しない）

### 未完了・次回候補
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- LP スクリーンショット差し替え
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-14 セッション（64回目）

### 作業内容

#### 1. AIプロンプト調整（散布/施肥/畑しごと 提案スタンス強化）
**コミット:** `cb1e0e7`（push済み）

- `sprayingAdvice`: 「少量の降雨などを含め」→「許容し」に表現修正、長期見通しを「それぞれをバランスよく」に統一
- `fertilizingAdvice`: 長期見通し表現を「それぞれをバランスよく提案する」に統一
- `generalWorkAdvice`: わずかなリスクは許容しリスク対応を明示したうえで作業推奨するスタンスを明確化
- `thinkingBudget`: 2048 → 1500（コスト最適化）

### 決定事項
- AIプロンプトの散布/施肥/畑しごとは「攻め」のスタンスをより明確に表現する
- thinkingBudget 1500 で運用

### 未完了・次回候補
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- LP スクリーンショット差し替え
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-13 セッション（63回目）

### 作業内容

#### 1. 日別予報 絵文字クロスプラットフォーム統一
**コミット:** `1a764af`（push済み）

- `☀`（U+2600 Miscellaneous Symbols）→ `☀️`（U+2600 + U+FE0F Variation Selector-16）に変更
  - U+FE0F を付加することでプラットフォーム問わずカラー絵文字表示を強制
  - `💧`（U+1F4A7 Emoji ブロック）は元々常時カラーのため変更不要
- ai-comment.ts（天気コード×日照時間乖離ルール追加）も同一コミットに同梱

### 決定事項
- 日照時間のサン絵文字は `☀️`（U+FE0F 付き）で統一。iOS/Android/Windows 全環境でカラー表示

### 未完了・次回候補
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- LP スクリーンショット差し替え（ユーザーが PC の DevTools でキャプチャ中）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-13 セッション（62回目）

### 作業内容

#### 1. HelpPage「戻る」ヘッダーのスクロール固定
**コミット:** `128bef9`（HelpPage.tsx は本コミットに同梱）

- `BACK_HEADER_STYLE`（`position: sticky; top: 0; background: var(--bg-color)`）を追加
- ボタンを sticky ラッパー div で包み、スクロール中も上端に固定
- `app-container` の `paddingTop` を sticky ヘッダー側に移動

#### 2. AI 時間別データを72時間分に拡張・UV指数・飽差を追加
**コミット:** `128bef9`（push済み）

- 標準4タブ: `.slice(0, 24)` → `.slice(0, 36)`（2時間おき × 36 = 72時間分）
- じぶん好みタブ: `.slice(0, 48)` → `.slice(0, 72)`（1時間おき × 72 = 72時間分）
- `AiHourlyEntry` / `AiHourlyEntryRich` に `uv: number`・`vpd: number` を追加
- `calcVpd()` ヘルパー追加（`6.112 × exp(17.67T/(T+243.5))` → 飽和絶対湿度 → VPD g/m³）
- `HelpPage.tsx`：データ一覧の項目・エントリ数・ハルシネーション警告文を更新

#### 3. ai-comment.ts プロンプト調整
**コミット:** `a962e59`（push済み）

- `thinkingBudget`: 1024 → 2048
- `weatherOverview`「今日・明日の天気に加え、3日目以降の長期的な天候の傾向にも」→「バランスよく解説する」
- `sprayingAdvice` / `fertilizingAdvice` / `generalWorkAdvice`「今日〜明後日中心＋先の天候変化」→「3日目以降の長期的な見通しも、バランスよく提案する」

#### 4. 設定タブ名変更
**コミット:** `deb0e60`（push済み）

- 気象情報 → 注意報等
- 気象コメント → AIコメント
- 比較分析 → 空くらべ

#### 5. 時間別テーブル ラベル列幅縮小（案A）
**コミット:** `8ba8dd1`（push済み）

- `LABEL_W`: 96 → 76px
- `DATA_ROWS` の `label` から単位括弧を除去、`unit?: string` フィールドに分離
- ラベルセルを「項目名 / 単位（0.6rem・`var(--text-tertiary)`）」の2行レイアウトに変更
- ユニット無し行（`風向き` 等）はそのまま1行表示

### 決定事項
- AI に渡す時間別データは72時間分に統一（API取得量と整合）
- 設定タブ名は画面名と統一（注意報等 / AIコメント / 空くらべ）
- HourlyTable ラベル列は単位2行分離で76pxに収める（案A採用）

### 未完了・次回候補
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- LP スクリーンショット差し替え（ユーザーが PC の DevTools でキャプチャ中）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-13 セッション（61回目）

### 作業内容

#### 1. ai-custom.ts コミット済み変更の確認・push
**コミット:** `7d143c6`（push済み）

- 「気象予想」→「気象予測」に統一
- デフォルト出力指示：200文字程度 → 400文字以内
- daily 期間説明：5日分(3日後〜7日後) → 7日分(2日後〜8日後)

#### 2. 初回ログイン GPS ローディング UX 修正
**コミット:** `cf8bea6`（push済み）

- WeatherTab.tsx：`geoStatus === 'idle'` を `'loading'` と同様にスピナー表示
- 「地点を登録してください」メッセージを削除
- error 時のみ設定タブへの誘導を表示

#### 3. iOS Safari ログインループ修正
**コミット:** `4bb30ae`（push済み）

- iOS PWAモード（`standalone===true`）判定を `isIOSStandalone()` に変更
- 通常の iOS Safari ブラウザは `signInWithPopup` を使用（ITP回避）
- iOS PWA（ホーム画面起動）は引き続き `signInWithRedirect`
- LandingPage.tsx / LoginScreen.tsx 両方に適用

#### 4. LP 全面リデザイン
**コミット:** `e192826`, `f8a1fea`, `07de053`, `9361808`, `5cace4d`, `9b11ba1`（push済み）

- 構成：13→9セクション（Nav / Hero / Pain / MakerNote / Features / Comparison / Steps / FinalCta / Footer）
- アプリ本体の teal カラーに統一
- `src/landing.css` 新規作成（LP専用スタイル）
- Safari 対応：`-webkit-backdrop-filter`, `100svh`, `-webkit-sticky`
- `public/lp/` に実スクリーンショット5枚追加（WebP 780px幅）
- 仕様書：`docs/superpowers/specs/2026-06-12-lp-redesign-design.md`

#### 5. AIカスタムプロンプト初期値設定
**コミット:** `6290117`（push済み）

- `userRepository.ts` に `DEFAULT_AI_CUSTOM_PROMPT` 定数を追加
- フィールド未設定ユーザー（新規ユーザー）にデフォルトプロンプトを表示
- ついでに `DEFAULT_AI_SECTIONS` の `fertilizingAdvice` 欠落バグを修正（store.ts との同期ズレ）

#### 6. AIプロンプト入力欄の高さ拡張
**コミット:** `5a39c34`（push済み）

- `AiCommentSettings.tsx`：textarea `rows={4}` → `rows={6}`

#### 7. 日別予報ミニグラフ：分割日を時間帯別気温でプロット
**コミット:** `fdd11d8`（push済み）

- `forecast.ts`：`DailyForecastData` に `amTempMax/Min`, `pmTempMax/Min`, `nightTempMax/Min`, `nightTempMaxShort/MinShort` を追加
- `dayAmPm` ループで時間帯別気温の max/min を集計
- `DailyForecast.tsx`：分割日（i<3）は AM/PM/Night の3点、非分割日は日中央の1点でプロット
- 3日目夜間は `nightTempMaxShort/MinShort`（20-0 のみ）を使用
- ミニグラフ先頭・末尾を左端・右端にアンカー（グラフが端から端まで描画されるよう修正）

#### 8. 日別予報 分割日の表示順変更 + ビルドエラー修正
**コミット:** `0e40278`（push済み）

- **表示順変更（ユーザー要望）：**
  - 旧：日付 → 天気概況 → 時間帯ラベル＋アイコン（同セル）
  - 新：日付 → 時間帯ラベル行 → 時間帯別天気テキスト行 → アイコン行
  - 天気概況（dayTransitionLabel）を削除
- **ビルドエラー修正（Cloudflare Pages）：**
  - `historicalForecast.ts` の `createPlaceholderDay` / `expandDayAmPm` に 8フィールドを null で追加

### 決定事項
- LP スクリーンショットはユーザー自身が撮影してプロジェクトに提供する方式
- LP 料金設定：当面「無料」のまま（有料化は別途）
- iOS Safari は popup / iOS PWA は redirect の分岐で ITP 問題を解消
- デフォルト AIプロンプト：「気象データをもとに、この先1週間の畑仕事の見通しを整理して教えてください。親しみやすい言葉で、モチベーションの上がる一言を添えてください。」

### 未完了・次回候補
- iOS Safari 実機確認（NAV blur・HERO クリップなし・比較表横スクロール・画像5枚・ログイン動作）
- LP スクリーンショット追加（5枚はあるが、ユーザーが撮影した差し替え用があれば更新）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-12 セッション（60回目）

### 作業内容

#### 1. ビルドエラー修正 + AIプロンプトレビュー
**コミット:** `3eca813`（push済み）

- **LandingPage.tsx:** `Thermometer` 未使用 import を削除（TS6133 ビルドエラー解消）
- **historicalForecast.ts:** `createPlaceholderDay` に `nightWeatherCodeShort` / `nightPrecipProbShort` / `nightPrecipSumShort` を追加（TS2739 型エラー解消）
- **ai-comment.ts:** `responseSchema.minLength` を 100/130 → 300 に統一（プロンプトの「最低300文字以上」と整合）
- **ai-comment.ts:** `daily` 説明を「5日分（3日後〜7日後）」→「7日分（2日後〜8日後）」に修正（slice(2,9) 実装と整合）

#### 2. AIコメント 出力文字数を250〜350文字に変更
**コミット:** `909c45c`（push済み）

- 共通制約・全フィールド説明の文字数指示を「250文字以上350文字以内」に統一
- `responseSchema.minLength` を 300 → 250 に変更

#### 3. AIプロンプト ユーザー調整（sprayingAdvice）
**コミット:** `3af5828` / `a297050`（push済み）

- 軽減策の記述順を調整（別日・別時間帯提案を耐雨性確認より前に移動）
- 残るリスクに「雨上がり直後の濡れによる効果減少」を追記

### 決定事項
- ビルドエラー `0314cab` 以降（`Thermometer` 未使用 import）は修正済み
- AIコメント出力目標文字数：250〜350文字（全フィールド統一）

### 未完了・次回候補
- AIコメント品質の実機確認（キャッシュTTL 4h切れ後）
- 日別予報 夜間スロット実機確認（3日目夜間が(20-0)になっているか）
- LP スクリーンショット追加
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-11 セッション（59回目）

### 作業内容

#### 1. 時間別予報 天気アイコン静止化
**コミット:** `430bed1`（push済み）

- 原因：`/icons/weather-static/` に `<animateTransform>` タグ付きのアニメーション版SVGが混入していた
- 対象7ファイル：mostly-clear-day/night、mostly-clear-day/night-drizzle、mostly-clear-day/night-snow、extreme-thunderstorms-extreme-hail
- 対応：SVGから `<animateTransform>` タグを直接除去して静止化
- 日別予報（`/icons/weather/`）は変更なし・引き続きアニメーション表示

### 決定事項
- 注意報サマリーの表示位置（最上段）は現状のままでOK
- AM/PM/夜間の3分割スロットアイコンはアニメーションのままでOK（変更なし）

### 未完了・次回候補
- AIコメント品質の実機確認（キャッシュTTL 4h切れ後）
- 日別予報 夜間スロット実機確認（3日目夜間が(20-0)になっているか）
- LP スクリーンショット追加
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-11 セッション（58回目）

### 作業内容

#### 1. LP 全面改訂
**コミット:** 複数（`5a96b28` / `0314cab` / `7d47a99`）（push済み）

- Pain セクション：3つの文章を農家の一人称スタイルに刷新（「何日進んでいるか」追加、表題「今日か明日か、頭の中で計算」新設、標高3℃ズレ引用）
- Solution 理由1：積算対象を積算温度→降水量・日射量・日照時間も含む内容に拡充、前年比較を前面に
- Solution 理由2：CSVの bullet を削除し「紫外線・カッパ要否」現場目線の内容に差し替え
- Features セクションを6カードに刷新（AI/積算比較統合/失敗原因追跡/CSV/深読みデータ/カッパ・UV）
- 「あの日の気象を振り返る」→「あの失敗の原因を、気象データで追う」に結果軸で変更（指摘2反映）
- Hero H1：「農業に必要な気象データが、ひとつに。」→「今日できるか、すぐわかる。去年と比べて、数字で見える。」
- Hero サブテキスト：機能列挙→判断時間・前年比較の価値訴求に変更
- Solution H2：「解決策・選ばれる3つの理由」→「判断に迷わず、いきあたりばったりを卒業する。」
- Solution サブ：「勘頼みをデータに変える」に変更

#### 2. 日別予報 夜間スロット重複修正
**コミット:** `afad353`（push済み）

- 問題：3日目の夜間（20-翌4）と4日目以降の日別サマリー（0:00〜）が0:00-4:00で重複
- 解決：最終分割日（SPLIT_DAYS-1）の夜間のみ20-0に変更（翌0-3:59を除外）
- `DailyForecastData` に `nightWeatherCodeShort` / `nightPrecipProbShort` / `nightPrecipSumShort` を追加
- `forecast.ts`：hr>=20 のときのみ Short フィールドに積算
- `historicalForecast.ts`：新フィールドを null で追加（型整合）
- `DailyForecast.tsx`：最終分割日の夜間列は Short フィールドを使用、ラベルを「(20-0)」に変更

### 決定事項
- LP ペルソナ：「毎日天気予報を確認して判断に時間をかける農業従事者」「前年比較がわからずいきあたりばったり」
- Features は 6カード構成で確定
- 夜間スロットの区切り：1〜2日目は (20-翌4)、3日目のみ (20-0) で重複解消

### 未完了・次回候補
- AIコメント品質の実機確認（各プロンプト修正後・キャッシュTTL 4h切れ後）
- LP スクリーンショット追加
- 日別予報の夜間スロット変更の実機確認
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-11 セッション（57回目）

### 作業内容

#### 1. AIプロンプト見直し × 3回
**コミット:** `c6c915a` / `3a03e2b` / `a78132a`（push済み）

- ai-comment: 少量降雨でも積極提案に強化・予見期間を「5日先程度」→「今日〜明後日を中心にその先も」に統一
- ai-comment: temperature 0.5 → 0.6 に再調整
- ai-custom: ロールに「気象予想の専門家」追加・空行禁止制約を削除
- generalWorkAdvice の句点重複（。。）を修正

#### 2. カスタムドメイン Google 認証設定
- `weather.orch-app.com` でGoogleログイン不可だった問題を解決
- Firebase Console → Authorized domains に追加
- Google Cloud Console → OAuth クライアント: JavaScript origins / redirect URI に追加
- ログイン動作確認 OK

#### 3. HelpPage テーブルモバイル折り返し修正
**コミット:** `d7d62d2`（push済み）

- `index.css` に `.glass-table.text-wrap td { white-space: normal; word-break: break-word }` を追加
- HelpPage 全6テーブルに `text-wrap` クラスを付与

### 決定事項
- カスタムドメイン追加時は Firebase + GCP OAuth の両方にドメインを追加する（メモリに記録済み）

### 未完了・次回候補
- AIコメント品質の実機確認（各プロンプト修正後・キャッシュTTL 4h切れ後）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- LP スクリーンショット追加
- Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-11 セッション（56回目）

### 作業内容

#### 1. AIコメント 改行指示の修正
**コミット:** `3a9b9c2`（push済み）

**問題:** プロンプトに改行指示があるにもかかわらず、AIが改行しない

**原因:** template literal内の `\n`（実改行文字）をGeminiに渡していたため、「JSON文字列値に `\n` エスケープを挿入する」という意図が伝わらなかった

**修正内容:**
- system prompt冒頭の改行指示: `\n` → `\\n`（リテラル `\n` テキスト）、「JSONの文字列値の中で」と明示
- 各フィールドの末尾に `文脈の区切りで \n を用いて改行すること` を追加

### 決定事項
- フロント側 `whiteSpace: 'pre-line'` は変更不要（JSONパーサーが変換した実改行文字を正しくレンダリング済み）

### 未完了・次回候補
- AIコメント品質の実機確認（改行修正後・キャッシュTTL 4h切れ後）
- dotfilesリポジトリの実際の構築（優先度：中）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Git develop/main 運用への移行（ユーザー後日実施）

---

## 2026-06-11 セッション（55回目）

### 作業内容

#### 1. 散布アドバイスのトーン変更
**コミット:** `2cf2bc4`（push済み）

- 【トーンの使い分け】を「全タスク共通で攻めの提案、散布はリスクを特に明確に示す」に変更
- 以前: 「散布は確実性を重視して慎重」→ 変更後: 「攻めつつ流亡・飛散リスクを明確に提示」
- 「偵察役」スタンス（最終判断を農家に委ねる）との整合性が向上
- `sprayingAdvice` フィールドの説明も同方向に修正

### 決定事項
- 散布も含め4タブ全て「積極的に窓を探す攻めの提案」で統一
- 散布の差別化はリスクを「特に明確に」示す点のみ（使用回数浪費リスクは引き続き提示）

### 未完了・次回候補
- AIコメント品質の実機確認（散布トーン変更後・キャッシュTTL 4h切れ後）
- dotfilesリポジトリの実際の構築（優先度：中）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Git develop/main 運用への移行（ユーザー後日実施）

---

## 2026-06-11 セッション（54回目）

### 作業内容

#### 1. 積み残しタスクの確認クローズ
- TOCアンカーリンクのモバイルスクロール動作 → ユーザー実機確認OK
- AIコメント スワイプ・ローディングアニメーション → ユーザー実機確認OK

#### 2. ai-comment.ts プロンプト改善
**コミット:** `7cba3f7`（push済み）

**問題点（ユーザー報告）:**
- 4タブすべての回答が同じフォーマットになりがち（「〜は〜。ただし〜。明日以降は〜。」パターン）
- たまに極端に短い回答が返ってくる

**原因分析:**
- 散布・施肥・畑しごとの3タブ全部に「作業できる時間帯→残るリスク→軽減策」を同順序で指示していたため、Gemini が共通テンプレートを流用
- `responseSchema` に `minLength` がなく、文量の下限が保証されていなかった
- `temperature: 0.3` が低すぎて表現が収束しやすかった

**修正内容:**
- 3タブの展開順序を柔軟化（「展開順序を意識的に変えること」の指示に変更）
- `responseSchema` に `minLength` 追加（散布・施肥・畑しごと: 130 / 概況・備え: 100）
- 「〜文字程度」→「最低〇〇文字以上、250文字以内」に変更（文量を明示化）
- `temperature: 0.3 → 0.6`（表現バリエーション向上）
- 各フィールドから段落指示を削除し共通制約セクションへ一元化（重複解消）

### 決定事項
- `minLength` で短文防止を schema レベルで担保する方針
- `temperature` は 0.6 で運用（要実機確認）

### 未完了・次回候補
- プロンプト改善後のAIコメント品質の実機確認（キャッシュTTL 4時間切れ後）
- dotfilesリポジトリの実際の構築（優先度：中）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Git develop/main 運用への移行（ユーザー後日実施）

---

## 2026-06-10 セッション（52回目）

### 作業内容

#### 1. PC環境バックアップ戦略の整理

PCの電源異常トラブルを受けて、別PCでも作業再開できる環境を整備するための方針を策定。

**現状確認:**
- GitHubリモート（OrchWEATHER）は設定済み・全コミット反映済み ✓
- `.gitignore`対象のシークレット類がバックアップされていない
- Google DriveでC:\devを同期しているが`.git`フォルダ破損リスクあり

**バックアップが必要と特定したファイル（5種類）:**
1. `c:\dev\気象アプリ\.env`（Firebase設定等）
2. `.dev.vars`（Cloudflare Pages Functions用）
3. `C:\Users\kazma\.claude\CLAUDE.md`（グローバル思考OS設定）
4. `C:\Users\kazma\.claude\keybindings.json`
5. `C:\Users\kazma\.claude\projects\...\memory\`フォルダ全体

**方針決定:**
- GitHubにプライベートリポジトリ「dotfiles」を作成し一元管理
- Google Driveの`c:\dev\`同期は`.git`破損リスクがあるため解除推奨
- VS CodeはSettings Sync（GitHub連携）でバックアップ

#### 2. dotfiles整備タスクをtodo.mdに追加

`tasks/todo.md`に優先度「中」のタスクとして追記。
ブレインストーミング内容・実装ステップ5件・新PC復旧コマンドを記載。

#### 3. Gemini thinkingBudget を 0 に変更、ai-comment プロンプト調整
**コミット:** `6c3fd1d`（push済み）

- `ai-comment.ts` / `ai-custom.ts` の `thinkingBudget: 1024 → 0`
- `ai-comment.ts` のシステムプロンプト文言をユーザーが修正

#### 4. AIコメントタブ スワイプナビゲーション 設計
**コミット:** `0f5ef0c`（push未）

- ブレインストーミング実施：スライドアニメーション（A案）を採用
- 設計書を `docs/superpowers/specs/2026-06-10-ai-comment-swipe-design.md` に作成・コミット
- 変更対象：`AiCommentCard.tsx`（スワイプロジック）＋ `index.css`（keyframes）
- 実装は次回セッションから着手

### 決定事項
- バックアップの主軸はGitHub（コード）＋dotfilesリポジトリ（設定・シークレット）の2本立て
- Google DriveのC:\dev同期は解除する方向
- Gemini thinkingBudget は 0 で運用する
- AIコメントタブのスワイプ：スライドアニメーション方式で実装する

#### 5. AIコメントタブ スワイプナビゲーション実装
**コミット:** `7603bbd`（push未）

- `AiCommentCard.tsx`: touchStart/End ハンドラ追加、60px閾値・縦方向優先スワイプ検知
- `handleTabSelect` でタブ直接タップ時もインデックス差からスライド方向を自動判定
- `slideDirection`（useRef）+ `key={activeTab}` でCSSアニメーション制御（再レンダリング不要）
- `index.css`: `@keyframes slideInFromRight/Left` + `.slide-in-*` クラス追加（0.22s ease-out）
- コンテンツラッパーに `overflow: hidden` を付与してはみ出し防止

#### 6. AIコメント ローディングアニメーション実装
**コミット:** `e16e8f5`（CSS）+ `e8f32eb`（AiCommentCard）（push済み）

- `isStandardLoading` 時のスケルトンバー＋無効TabBarを廃止
- `ALL_TABS` 6アイコンが左→右へウェーブバウンス（各 0.2s ディレイ・1.2s周期）
- 「お天気を分析中…」の「…」が点滅（dotPulse 1.4s）
- ローディング中は全6タブのアイコンを常時表示（`visibleTabs` でなく `ALL_TABS` を使用、意図的仕様）

### 決定事項
- ローディングアニメーションは `ALL_TABS`（全6アイコン）で表示固定（設定反映しない）
- スワイプナビゲーションも含め push 済み

#### 7. Gemini thinkingBudget を 1024 に再変更
**コミット:** `99ea461`（push済み）

- `ai-comment.ts` / `ai-custom.ts` の `thinkingBudget: 0 → 1024` に戻す

#### 8. カスタムドメイン `weather.orch-app.com` 設定完了
- Cloudflare Pages → Custom domains → `weather.orch-app.com` を追加
- `orch-app.com` ゾーンに CNAME レコード（weather → orchweather.pages.dev・プロキシ済み）が自動作成済みを確認
- ステータス「アクティブ」に変わり本番アクセス可能

#### 9. LP 改善（キャッチコピー・Painセクション刷新）
**コミット:** `8cdf9c0`（push済み）

- トップ：「農業気象データ活用ツール」→「農家が現場で作った気象データ活用ツール」
- Pain ①：「前倒しの判断に迷う」→「去年との違いが見えない」
- Pain ②：「いつも頭の中で換算している」→「今日の作業、天気とにらめっこ」
- Pain ③：「情報収集と計算だけで疲弊」→「自分の農場に合わせた判断が欲しい」

#### 10. LP 施肥どき追加
**コミット:** `753ce90`（push済み）

- `aiSections` に「施肥どき」（Sproutアイコン）を追加（4→5セクション）
- AI スポットライト見出し・説明文・機能カード・料金セクションすべてに施肥どきを反映

### 決定事項
- ローディングアニメーションは `ALL_TABS`（全6アイコン）で表示固定（設定反映しない）
- Gemini thinkingBudget は 1024 で運用（0→1024に再変更）
- 本番URL：`weather.orch-app.com`（カスタムドメイン）

### 未完了・次回候補
- AIコメントタブ スワイプ・ローディングアニメーションの実機確認（モバイルで検証）
- dotfilesリポジトリの実際の構築（優先度：中）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Git develop/main 運用への移行（ユーザー後日実施）
- カスタムタブ（じぶん好み）ローディング中のスケルトンも同様に刷新するか検討

---

## 2026-06-10 セッション（53回目）

### 作業内容

#### 1. アプリの使い方ページ（HelpPage）実装
**コミット:** `a7a8cfb`（push済み）

- `src/components/HelpPage.tsx` 新規作成（~334行）
  - 4セクション：地点登録の方法 / いまの空 / 空くらべ / あの日の空
  - 目次（アンカーリンク）付き縦スクロールページ
  - `glass-panel` / `glass-table` / `app-container` の既存クラスを使用
  - CSSProperties 定数9種（`BACK_BTN_STYLE`, `H1_STYLE`, `H2_STYLE`, `H3_STYLE`, `P_STYLE`, `WARNING_BOX`, `NOTE_BOX`, `TOC_STYLE`, `TOC_ITEM_STYLE`, `TOC_LABEL_STYLE`）
  - じぶん好みタブのみ AIに渡すデータ一覧を明記（標準タブは非掲載）
  - ⚠ハルシネーション警告ボックス・⚠2021年以前データ注意ボックスを配置

- `src/App.tsx` 変更点
  - `topTab` 型に `'help'` を追加
  - `prevTopTab = useRef<...>('weather')` 追加（戻る先を保存）
  - モバイルヘッダー：spacer右・アバター左に HelpCircle アイコンのみボタン追加
  - PCヘッダー：設定ギア左に HelpCircle + 「使い方」テキストボタン追加
  - ボトムナビ：helpタブ中の active 判定を `prevTopTab.current === id` に変更
  - ボトムナビ onClick に `prevTopTab.current = id` を追加（戻り先の正確な追跡）
  - `{topTab === 'help' && <HelpPage onBack={() => setTopTab(prevTopTab.current)} />}` を追加

- バグ修正（実装中に発見・即修正）
  - `React.CSSProperties` → `import type { CSSProperties } from 'react'` に修正（verbatimModuleSyntax対応）
  - TOC ラベルスタイルをインライン → 名前付き定数 `TOC_LABEL_STYLE` に抽出（一貫性）
  - ボトムナビ onClick で prevTopTab を更新しない問題を修正（戻るボタン先がズレるバグ）
  - モバイルでテーブルが右にはみ出す問題を修正（`whiteSpace: 'nowrap'` を全11箇所から除去）

- 設計書・実装計画
  - `docs/superpowers/specs/2026-06-10-help-page-design.md` 作成
  - `docs/superpowers/plans/2026-06-10-help-page.md` 作成

### 決定事項
- HelpPage のナビゲーション方式：`topTab` に `'help'` を追加する state ベース方式（React Router 不使用）
- `prevTopTab` は useRef（useState 不使用）で再レンダリング抑制
- モバイルボタン：HelpCircle アイコンのみ（テキストなし）
- PCボタン：HelpCircle + 「使い方」テキスト
- ページ構造：縦スクロール＋目次アンカーリンク
- じぶん好みタブのみ詳細データ一覧を掲載（標準タブは非掲載）

### 未完了・次回候補
- TOCアンカーリンクのモバイルスクロール動作確認（`app-container` の overflow 設定によっては効かない可能性）
- AIコメントタブ スワイプ・ローディングアニメーションの実機確認（モバイルで検証）
- dotfilesリポジトリの実際の構築（優先度：中）
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Git develop/main 運用への移行（ユーザー後日実施）

---

## 2026-06-09 セッション（51回目）

### 作業内容

#### 1. AIコメント品質・ガントバー実機確認
- 両項目ともOK確認済み。積み残しタスクからクローズ

#### 2. WMOコード→天気アイコンマッピングを全面刷新
**コミット:** `ce4243d`（push済み）

- 不足SVGアイコン15種を新CDN（cdn.meteocons.com/3.0.0-next.10）と旧CDN（jsdelivr）からダウンロード
  - 新規: `mostly-clear-day/night`・`mostly-clear-day/night-drizzle`・`mostly-clear-day/night-snow`・`extreme-thunderstorms-extreme-hail`（meteocons.com）
  - 新規: `sleet`・`rain`・`extreme-rain`・`extreme-sleet`・`snow`・`extreme-snow`・`thunderstorms-day/night-extreme-rain`（jsdelivr）
  - 両フォルダ（`weather/`・`weather-static/`）に保存
- **変更内容（`WeatherIcon.tsx` `codeToIconFile`）:**
  - code 1（おおむね晴れ）: `partly-cloudy-${d}` → `mostly-clear-${d}`
  - code 2（一部曇り）: `overcast-${d}` → `partly-cloudy-${d}`
  - code 3（曇り）: 変更なし（`overcast`）
  - code 51/53/55（霧雨）: 各種 → `drizzle`（昼夜共通）
  - code 56/57（着氷性霧雨）: → `sleet`（昼夜共通）
  - code 61（雨弱）: → `rain`（昼夜共通）
  - code 63（雨並）: → `overcast-rain`（昼夜共通）
  - code 65（雨強）: → `extreme-rain`（昼夜共通）
  - code 66（着氷性雨弱）: → `sleet`（昼夜共通）
  - code 67（着氷性雨強）: → `extreme-sleet`（昼夜共通）
  - code 71（雪弱）: → `snow`（昼夜共通）
  - code 73（雪並）: → `overcast-snow`（昼夜共通）
  - code 75/77（雪強・雪粒）: → `extreme-snow`（昼夜共通）
  - code 80（にわか雨弱）: → `mostly-clear-${d}-drizzle`
  - code 81/82（にわか雨並・激）: → `partly-cloudy-${d}-drizzle`
  - code 85（にわか雪弱）: → `mostly-clear-${d}-snow`
  - code 95（雷雨）: → `thunderstorms-${d}-extreme-rain`
  - code 96/99（雷雨+ひょう）: → `extreme-thunderstorms-extreme-hail`（昼夜共通）

#### 3. 時間別テーブル列幅を拡張
**コミット:** `63bf1a8`（push済み）

- `COL_W = 38 → 42`（+4px）。文字クリップ解消
- 全列等幅設計のため SVGミニグラフ座標系・ガントバー幅計算も自動追従

### 決定事項
- 天気アイコンは Meteocons のより精細な分類に揃えた（雲量段階・降水強度ともに正確に表現）
- `COL_W=42` を新基準値とする

### 未完了・次回候補
- 有料化実装（Stripe・機能フラグ・14日トライアル）
- Git develop/main 運用への移行（ユーザー後日実施）
- LP スクリーンショット追加（低優先度）
- Firestore TTL ポリシー設定（aiComments・低優先度）

---

## 2026-06-09 セッション（50回目）

### 作業内容

#### ミニグラフのバー位置ずれ修正（前回の続き・根本原因解消）
**コミット:** `d92d179`（push済み）

- 前回（`200c2e8`）の修正で `table-layout:fixed` と `<colgroup>` を導入したが、テーブルに明示幅がなかった → ブラウザが colgroup 指定を厳密適用せず列が COL_W より少し広くなっていた
- ミニグラフSVGは固定ピクセル (`ti * COL_W`) で描くため、実列幅との差が右へ行くほど累積してバーがずれる
- 修正: `<table>` に `width: LABEL_W + tl.length * COL_W` を付与 → `table-layout:fixed` が実際に効き全列が COL_W=38px に揃う

### 決定事項
- `table-layout:fixed` は明示 `width` がないと colgroup 幅を保証しない（ブラウザ依存で膨張する）。固定グリッドをSVGと合わせるには「`width` 指定が必須」と確定

### 未完了・次回候補
- AIコメント品質の実機確認（thinking有効化・プロンプト「偵察役」改修後）
- ガントバー実機確認（now+12h まで正しく伸びるか）
- Git develop/main 運用への移行（ユーザー後日実施）
- 有料化実装（Stripe・機能フラグ・トライアル）
- LP スクリーンショット追加（低優先度）
- Firestore TTL ポリシー設定（aiComments・低優先度）

---

## 2026-06-09 セッション（49回目）

### 作業内容

#### 1. AIプロンプト改修（前セッションの続き・確定）
**コミット:** `8746010`（push済み・前セッションで実施分の整理）
- ai-comment を「偵察役」スタンスに再設計、ai-custom は line22 の事実ガードレールのみ統一（詳細は48回目参照）

#### 2. 時間別の降水ラベルを気象庁「雨の強さ」区分に準拠
**コミット:** `cf9fb0e`（push済み）
- `precipToLabel`（[HourlyTable.tsx](src/components/weather/HourlyTable.tsx)）を見直し
- **`ザーザー` を 5〜10mm/h → 10〜20mm/h（やや強い雨）へ補正**（旧実装は気象庁基準と約2倍ズレていた）
- 非標準オノマトペ（さーっ/ばしゃばしゃ/バチバチ）を廃止、高強度域を公式表現に統一
- 新区分: ぽつぽつ(〜1)/しとしと(1〜3)/本降り(3〜10)/ザーザー(10〜20)/土砂降り(20〜30)/激しい雨(30〜50)/滝のよう(50〜80)/猛烈(80〜)。全ラベル4文字以内で列クリップ回避

#### 3. 時間別テーブルに項目追加＋過去タブの欠落項目を条件表示
**コミット:** `5adb518`（push済み）
- **瞬間風速(m/s)** を風速と風向きの間に追加（`windGusts`）
- **降雪量(cm)** を降水量の下に追加（`snowfall`、期間内に降雪>0のときだけ行表示＝`hasSnow`）
- **あの日の空（過去タブ）で実データのある項目だけ表示**:
  - 設計判断: 値0からの推測は誤検知する（CAPEは0が正当値）→ **APIレスポンスにフィールドが実在するか**を取得層で判定する方式に
  - `ForecastData.availability?: FieldAvailability`（[forecast.ts](src/api/forecast.ts)）を新設。未指定＝全項目あり
  - [historicalForecast.ts](src/api/historicalForecast.ts) の `hasValues()` で段階1/2/3すべて availability を算出・伝播
  - [HourlyTable.tsx](src/components/weather/HourlyTable.tsx) に `hiddenRowKeys?` prop追加 → DATA_ROWS と UV行に適用
  - [HistoricalWeatherTab.tsx](src/components/weather/HistoricalWeatherTab.tsx) が availability から非表示行集合を渡す
  - 結果: 段階3（2022年より前）で降水確率・0℃層高度・紫外線を非表示、CAPEは実データありで表示。いまの空は availability 未指定で全行表示（従来どおり）

#### 4. 降水ラベル 0〜3mm帯を農作業のカッパ判断に再区分
**コミット:** `4831def` → `2fccf97`（最終形・push済み）
- 背景: ユーザーの現場体感「1mmを超えるとザーッと濡れる」。気象庁の強度区分（しとしと=1〜3mm）は屋外連続作業の濡れ感と乖離。低降水域は"強度"より"濡れ／カッパ"に寄せる方針
- 設計原則: **カッパ判断が非自明な1〜3mmの"迷う帯"にだけ行動指示を置く**（3mm以上=本降り以降は誰が見てもカッパ前提なので語を広げない＝冗長回避）
- 最終区分（[HourlyTable.tsx](src/components/weather/HourlyTable.tsx)）:
  - 〜0.5「ぽつぽつ」/ 0.5〜1.5「カッパ？」/ 1.5〜3「カッパ！」/ 3〜10「本降り」/ 10〜20「ザーザー」/ 20〜30「土砂降り」/ 30〜50「激しい雨」/ 50〜80「滝のよう」/ 80〜「猛烈」
  - 全ラベル4文字以内（列クリップ回避）。3mm以上は気象庁準拠を維持

#### 4.5 時間別テーブルの周辺調整（同日中の小改修）
- 降水ラベルの最終調整: 〜0.5「ぽつぽつ」/ 0.5〜1.5「カッパ？」/ 1.5〜3「カッパ！」（コミット `2fccf97`、項目4参照）
- 風向き行のフォントを約10%縮小（0.78→0.7rem、「北北西」対策）
- ミニグラフ降水バーの左右ズレを調査 → 原因は「列が等幅でない」こと（`table-layout` 未指定＝内容で列幅が変動＋天気アイコン43pxが実幅を支配＋太陽列の差異）。SVGは元々「全列＝COL_W」の均等グリッド前提で描いていたため実列とズレていた

#### 4.6 時間別テーブルを固定列幅化（ミニグラフのズレ解消）
**コミット:** `200c2e8`（push済み・ビルド成功確認）
- `table-layout:fixed` ＋ `<colgroup>` で全列（データ列・太陽列）を **COL_W=38px**、ラベル列 **96px** に固定
- 38pxの根拠＝風向き「北北西」(0.7rem≈34px)が収まる最小幅。コンパクト最適値
- 天気アイコン43→36／UVアイコン38→36、データ行パディング0.4→0.1rem、日付ラベル左寄せ＋はみ出し許容
- **ロジック簡素化**: 列が実寸でCOL_Wと一致 → ミニグラフSVGの横伸縮（`preserveAspectRatio="none"`+`width="100%"`）を廃止し1:1座標に。`COL_W`を実態へ(32→38)、`STICKY_W`をラベル列幅に同期、旧コメント整理
- **重要な学び**: ズレの原因は「複雑な補正ロジック」ではなく「全列等幅という前提が現実と食い違っていた」こと。コードは元々シンプルだが間違っていただけ → 削れる複雑さは無く、本質は simplification ではなく correctness
- 要実機確認: 北北西の欠け／アイコン36pxの視認性／日付左寄せはみ出し／バーの整列

#### 5. 注意報・警報に発令ステータスを表示
**コミット:** `8f1d9db`（push済み）
- r8 API の `status`（発表/継続/更新）は従来フィルタ用に消費するだけだった → `JmaWarningItem.status?` に保持（[jmaWarning.ts](src/api/jmaWarning.ts)）
- [JmaWarningSummary.tsx](src/components/weather/JmaWarningSummary.tsx) の表示制御:
  - 発表: バッジ「発表」＋発表時刻（末尾`〜`除去）→ 例 `[注意報] 濃霧注意報 [発表] 6/6 12:36`
  - 継続・更新: バッジ「継続中」のみ、時刻は非表示 → `[継続中]`（更新も継続中に集約）
  - 右上の電文時刻ラベルを「発表」→「時点」に変更
- 副次効果: 前に指摘した「継続時に時刻の意味がズレる（reportDatetimeは継続確認時刻で原発令時刻ではない）」問題を、継続では時刻を出さないことで回避
- `validPeriod` の定義は他箇所でも使うため変更せず、表示側のみで制御

#### 6. 天気アイコン/ラベルの精査（変更なし・結論のみ）
- 日別予報の「日付下テキスト」は、分割日＝`dayTransitionLabel`（午前/午後の遷移・短縮形）、非分割日＝`codeToLabel`（正式名）の2系統
- 分割日のアイコンは `am/pm/nightWeatherCode` から**直接**生成。テキスト→アイコンの依存はなく、二重管理ではない（テキストとアイコンは同じコードの別表現）
- 日中の変化の向きをテキストで見せたいので**遷移テキストは現状維持**（ユーザー判断）。`codeToShortLabel`/`codeToLabel` の変換表二重化は残るが対応不要

### 調査・知見
- **Open-Meteo Historical Forecast API のデータ範囲**（公式ドキュメント＋ブログで確認）:
  - 開始は2022年ごろで**固定**（下限は前進しない）。新しい側へ毎日アーカイブ蓄積され範囲が広がる。古いデータは落とさないアーカイブ型
  - よって `HISTORICAL_FORECAST_START='2022-01-01'` は**固定でよく、動的化は不要かつ有害**（2027年でも2023へずらす必要なし）。移動窓は `today-14`（段階1/2境界）が既に自動追従
  - 注意: 「モデルバージョンが時期で変わるため長期時系列分析には不向き」と公式明言。空くらべで数年スパン比較に使う場合は留意
- ユーザー指摘で **CAPE は archive(段階3) でも8ヶ月より前まで値が入る**ことを確認。stage固定の前提でなくデータ実在で判定する方針の根拠に

### 決定事項
- 降水ラベルは気象庁「雨の強さ」区分に準拠（社内基準化）
- 過去タブの項目欠落はデータ駆動（API実在性）で判定。値ベースの推測は使わない
- いまの空とあの日の空は同一 `HourlyTable` を共有。表示項目・並び順は単一ソース（`DATA_ROWS`）で一致

### 未完了・次回候補
- **実機確認**: ①あの日の空で2022年より前の日付 → 降水確率・0℃層高度・紫外線が消えCAPE行が残るか ②AIコメント品質（キャッシュTTL4h切れ後） ③注意報・警報の発令ステータス表示（発表＝時刻つき／継続中＝時刻なし／右上「時点」）
- **Git develop/main 運用への移行**（ユーザーが後日実施）
- ガントバー修正の実機確認（now+12h まで伸びるか）
- 有料化実装（Stripe・機能フラグ・トライアル）
- LP スクリーンショット追加（低優先度）
- Firestore TTL ポリシー設定（aiComments・低優先度）

---

## 2026-06-08 セッション（48回目）

### 作業内容

#### AIコメントのプロンプトを「偵察役」スタンスに再設計
**コミット:** `8746010`（push済み）

- 背景: 現場の本音は「雨でも適期を逃したくない。進める上での注意点を知りたい」。従来は守り（安全な時間提案）寄りだった
- ユーザーが一旦5カード全部を一律「攻め」に改修 → レビューで2つの落とし穴を指摘
  1. **農薬散布だけは一律攻めにすると危険**: 流亡→撒き直しで「使用回数（総使用回数・PHI）」を1回浪費する重い代償。施肥・畑仕事とは失敗コストの次元が違う → タスク別トーンに分離
  2. **数値アンカーを捨てて曖昧化したのは逆効果**: 攻めは数値があるほど信用される → デッドライン＋数値根拠を復活
- マージ可否を分けた核心: **反捏造ルールと「乾き時間1〜2時間」の衝突**を「データと一般知識の線引き」で解消
  - 気象予報値＝データ厳守／農学的一般知識（乾き時間・飛散の風速目安）＝一般論として可

**ai-comment.ts の変更:**
- 冒頭制約を統合（3連【重要】の重複解消）：①偵察役の立ち位置 ②タスク別トーン ③データと一般知識の区別
- 散布/施肥/畑しごとの3カードを「作業できる窓（デッドライン）＋残るリスク（数値根拠）＋軽減策」の3点構造／150→180字
- 散布の判断軸を「乾き時間が雨までに確保できるか」へ。耐雨性ラベル確認の示唆を追加
- 施肥の飛散リスクは「粉状・強風時」に限定（粒状に風速3m/sは過剰）
- ①②③ラベルは出力に書かず自然文に織り込む指示を追加

**ai-custom.ts の変更:**
- スタンス系（攻め/守り・3点構造）は**あえて入れない**（custom欄はユーザー入力でスタンスが決まるため）
- line 22 のみ ai-comment と線引きを統一 → custom欄でも「乾き時間」等の農学知識を答えられるように（標準/カスタムの事実回答能力の逆転を解消）

### 決定事項
- AIコメントのスタンス＝「審判（可否決定）」ではなく「偵察役（判断材料を渡す）」。決定権は農家
- 攻め/守りはタスク別。畑仕事・施肥は攻め、農薬散布は確実性重視で慎重
- 事実ガードレール（データvs一般知識の線引き）は両エンドポイントで統一。スタンス系は ai-comment のみ
- IDE同時編集でファイル競合が頻発 → クリーンなベースラインに戻ってから一括編集する運用に

### 未完了・次回候補
- **thinking＋プロンプト改修後のAIコメント品質を実機確認**（キャッシュTTL 4h切れ後。特に散布カードの乾き時間表現、custom欄での農学知識回答）
- **Git develop/main 運用への移行**（ユーザーが後日実施）
- ガントバー修正の実機確認（now+12h まで正しく伸びるか）
- 有料化実装（Stripe・機能フラグ・トライアル）
- LP スクリーンショット追加（低優先度）
- Firestore TTL ポリシー設定（aiComments・低優先度）

---

## 2026-06-08 セッション（47回目）

### 作業内容

#### 1. AIコメント生成に thinking を有効化
**コミット:** `cadba7f`（push済み）

- `ai-comment.ts` / `ai-custom.ts` 両方を変更
- `thinkingBudget: 0`→`1024`（Gemini 2.5 Flash の思考トークンを有効化）
- `temperature: 0.4/0.5`→`0.3` + `topP: 0.8`（出力安定性向上）
- レスポンス解析を `parts.find(p => !p.thought)?.text` に変更（thought:true パートをスキップ）
- トレードオフ: 回答品質向上の一方、レイテンシ・トークンコスト増（キャッシュTTL 4hで緩和）

#### 2. commit/push 運用ルール変更
- **tasks/ 配下（session-log.md・lessons.md 等）を commit/push 対象外に**
- 今後コミット対象はソース・AIプロンプト等の実装ファイルのみ
- メモリ `session_management.md` に記録済み

#### 3. AIコメントの maxOutputTokens を増量
**コミット:** `ddb618e`（push済み）

- thinking有効化で思考トークンが出力枠を消費し本文が途切れるのを防ぐ対策
- ai-comment: 4096→8192 / ai-custom: 1024→2048

### 決定事項
- AIコメントは thinking 有効化で品質優先（コスト増は許容）
- tasks/ 配下はローカル記録専用、gitには含めない

### 未完了・次回候補
- **Git develop/main 運用への移行**（ユーザーが後日実施）
- thinking 有効化後のAIコメント品質・応答速度の実機確認（キャッシュ切れ後）
- ガントバー修正の実機確認（now+12h まで正しく伸びるか検証）
- 有料化実装（Stripe導入・機能フラグ制御・フリートライアルロジック）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-07 セッション（46回目）

### 作業内容

#### 1. AIに渡す時間別データの時刻処理を検証（コード変更なし）
- 標準タブ・カスタマイズの hourly フィルタは時刻処理が同一であることを確認
  - 両者とも `Date.parse(`${h.time}:00+09:00`) >= nowMs` でJST基準フィルタ
  - 違いは粒度のみ（標準=2hおき24件 / カスタム=1hおき48件）
- タイムゾーンずれなし。全経路JST統一を確認
  - Open-Meteo: `&timezone=Asia/Tokyo`（`h.time` は最初からJST）
  - `now` ラベル: `Date.now()+9h` → `getUTC*` で正しくJST取得
- ユーザー報告の「ずれ」の正体: Firestoreキャッシュ（TTL 4h）で古い「今」基準のコメントが残るため

#### 2. 散布どきプロンプトを降水量優先の判断に改善
**コミット:** `88860e3`（push済み）

- 降水量0mmなら降水確率が残っていても（漸減傾向なら）雨上がりとみなし散布可能と判断
- 「確率0%の昼」より「降水量0mmの早朝」を高く評価する基準を追加
- AIが好条件の早朝を逃して昼を提案する問題（実データで確認）への対策
- 優先順を ①降雨リスク ②気温・時間帯 ③風 に再整理

#### 3. カスタマイズAIプロンプトに数値捏造禁止のガードレール追加
**コミット:** `4d90cba`（push済み）

- データにない気象予想・架空数値の生成を明示的に禁止
- 具体的数値はJSONデータ内の値をそのまま引用するよう指示

### 決定事項
- AIコメントのデータ・時刻処理は正常。体感ずれはキャッシュTTL由来であり仕様
- 散布判断は降水確率より降水量を優先する方針

### 未完了・次回候補
- **Git develop/main 運用への移行**（ユーザーが後日実施）
- ガントバー修正の実機確認（now+12h まで正しく伸びるか検証）
- 有料化実装（Stripe導入・機能フラグ制御・フリートライアルロジック）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-07 セッション（45回目）

### 作業内容

#### 1. 空くらべグラフのタップ値表示・小数点桁数統一
**コミット:** `4bd3193`（push済み）

- 気温・湿度のレンジ値: `toFixed(2)`→`toFixed(1)`（過剰精度を削減）
- 降水量の実績日別値: `Math.round`→`toFixed(1)`（予測と統一・少量降水の精度確保）
- 予測日別値（積算温度・日射量・日照時間）: `toFixed(1)`→`Math.round`（実績と統一）
- 予測日別値（降水量）: `toFixed(1)` 維持
- 修正箇所: `App.tsx` の `formatHoverEntry` 関数（レンジ値・単一値）と予報日別値処理（行1321〜）

### 決定事項
- 各グラフの小数点方針:
  - 気温・湿度レンジ: 小数第1位
  - 降水量（実績・予測とも）: 小数第1位
  - 日照時間・日射量・積算温度（実績・予測とも）: 整数
  - 飽差: 小数第1位（変更なし）

### 未完了・次回候補
- **Git develop/main 運用への移行**（ユーザーが後日実施）
- ガントバー修正の実機確認（now+12h まで正しく伸びるか検証）
- 有料化実装（Stripe導入・機能フラグ制御・フリートライアルロジック）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-07 セッション（44回目）

### 作業内容

#### 1. AIコメントタブバーを横スクロール対応
**コミット:** `41207be`（push済み）

- `AiCommentCard.tsx`: `flex:1`→`minWidth:4.5rem`+`flexShrink:0`に変更
- `index.css`: `.ai-tab-bar` クラス追加（`overflow-x:auto` + scrollbar非表示）
- `useRef`+`useEffect`でアクティブタブ切り替え時に`scrollIntoView`を自動実行
- 6タブ（計36rem）がモバイルで左右スワイプで切り替え可能に

#### 2. AIコメントタブ「カスタマイズ」→「じぶん好み」に改名
**コミット:** `da2ae74`（push済み）

- `AiCommentCard.tsx`: タブラベル変更 + ガイドメッセージ「じぶん好みのプロンプトを…」
- `AiCommentSettings.tsx`: 設定画面ラベル変更
- 命名検討の経緯: きがかり→なんでも→じぶん好みの方向性→最終決定

#### 3. AIコメントタブ幅を均一化・padding拡張
**コミット:** `3c5ba1f`（push済み）

- `minWidth:'4.5rem'`→`width:'6rem'`（固定値・全タブ均一幅）
- 横padding: `0.4rem`→`0.75rem`（文字前後に余裕）

#### 4. 日別予報の分割日・日付行をセル結合に変更
**コミット:** `3a9b42f`（push済み）

- 「午前セル（内容）+ 午後・夜間セル（空）」3セル構成 → `colSpan={3}` 単一セルに変更
- Excelのセル結合＋左揃えと同じ見た目。内側縦線が消え視覚的まとまりが改善

#### 5. AIプロンプトの改行指示を強化
**コミット:** `e40c620`（push済み）

- 全体指示: 「適度に改行」→「必ず2〜3段落に分けて改行を挿入」と明確化（【重要】付与）
- 各フィールド末尾: 「文脈の区切りで適切に改行」→「2〜3段落で構成し段落間に改行を入れること」

### 決定事項
- AIコメントタブ名「カスタマイズ」→「じぶん好み」に確定
- 横スクロールタブバーをデフォルト運用とする（タブ数を削減しない方針）
- Git運用を今後 `main`（本番）+ `develop`（検証）の2ブランチに移行予定（後日着手）
  - Cloudflare Pages のプレビューデプロイを活用（追加設定不要）
  - 環境変数の Preview 設定確認のみ必要

### 未完了・次回候補
- **Git develop/main 運用への移行**（ユーザーが後日実施）
- ガントバー修正の実機確認（deプロイ後に now+12h まで正しく伸びるか検証）
- 有料化実装（Stripe導入・機能フラグ制御・フリートライアルロジック）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-07 セッション（43回目）

### 作業内容

#### 1. AIプロンプト 優先順位ベースに改善
**コミット:** `5deba2c`（push済み）

- **散布どき:** 降雨リスク（最低3h/理想4〜6h・1mm以上）→風→気温・時間帯の優先順に明示、150→200文字に拡張
- **畑しごと:** 機械作業と肥料まきを分離、肥料まきに最適枠（弱雨前）・晴天継続時の代替案を追加、150→200文字に拡張

#### 2. 施肥どきタブを新規追加・畑しごとを再構成
**コミット:** `22d4347`（push済み）

- `AiSection` に `fertilizingAdvice` を追加（store/userRepository/cache/API 全層対応）
- `userRepository`: `enabledAiSections` に前方互換マイグレーション追加（既存ユーザーに自動追加）
- 畑しごと: 一般外作業の概況を先に述べる構成に変更、施肥条件を分離
- 施肥どき: 弱雨前を最優先・晴天継続時の代替・大雨/強風直前の排除条件を明示
- `AiCommentCard`: Sprout アイコンで施肥どきタブを追加
- `AiCommentSettings`: 施肥どき設定行を追加

#### 3. 施肥どきプロンプト・設定説明をユーザーが修正
**コミット:** `1d5d48d`（push済み）

- 対象を「粒状・粉状の肥料」に限定（液肥は散布どきタブで対応）
- 排除条件の表現を調整

#### 4. 畑しごとプロンプトの対象説明を簡略化
**コミット:** `5e174e9`（push済み）

- 「外での作業全般（草取り・収穫・定植・支柱立てなど）」→「外での作業全般」に簡略化

### 決定事項
- AIプロンプトは数値閾値ではなく「考慮要素の優先順位」を指定する方針で改善
- 施肥どきは散布どきと分離（粒状・粉状肥料専用）
- 既存ユーザーへの自動マイグレーションは enabledJmaGroups と同方式で実装

#### 5. 全AIコメントフィールドの文字数統一・改行指示改訂
**コミット:** `af0852f`（push済み）

- sprayingAdvice / fertilizingAdvice / generalWorkAdvice: 200→150文字に変更
- 全フィールド: 「適宜改行を含む」→「文脈の区切りで適切に改行」に統一

### 未完了・次回候補
- ガントバー修正の実機確認（デプロイ後に now+12h まで正しく伸びるか検証）
- 有料化実装（Stripe導入・機能フラグ制御・フリートライアルロジック）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-06 セッション（42回目）

### 作業内容

#### 1. DailyForecast.tsx ビルドエラー修正（2回目）
**コミット:** `4a9d25f`（push済み）

- **エラー:** `warningToBar` の戻り値型注釈が `{ left: number; width: number }` のまま残っており、前回セッションの return 文 string 化と矛盾
- **修正:** 型注釈を `{ left: string; width: string }` に変更（1行のみ）
- **教訓:** 共有コンポーネントの型変更時は return 文と型注釈の両方を同時に変更すること

#### 2. ホバーツールチップの表示順修正
**コミット:** `a7dee49`（push済み）

- **修正前:** `{metric} {value} （差分/○日遅い） ※予報値`
- **修正後:** `{metric} {value} ※予報値 （差分/○日遅い）`
- `App.tsx` の `isForecastItem` span と `diffNote` span を入れ替えるだけ（全グラフ共通）

#### 3. 有料化戦略の検討（実装なし・方針決定）
→ 別メモリファイル `project_monetization.md` に詳細保存

### 決定事項
- ホバー表示順: ※予報値はΔ値の前（metric→value→※予報値→差分）
- 有料化: 最初から課金。14日間無料トライアルで体験させる方式を採用予定
- 現時点では有料化着手前にUI不整合ゼロ・AIコメント品質検証が必要

### 未完了・次回候補
- ガントバー修正の実機確認（デプロイ後に now+12h まで正しく伸びるか検証）
- 有料化実装（Stripe導入・機能フラグ制御・フリートライアルロジック）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-06 セッション（41回目）

### 作業内容

#### 1. 時間別ガントバー「12hより短く切れる」根本原因調査・修正
**コミット:** `17ec58c`（push済み）

- **調査経緯:** 2つの仮説（SunEntryインデックスズレ / TZズレ）を精査
  - Hypothesis 1（SunEntry）: 誤り。コードは `hourly.findIndex` の時刻ベース検索 + `hourlyPos` マッピングで正確に処理しており、SunEntryはバーを短くしない
  - Hypothesis 2（TZズレ）: 誤り。`toJSTHourStr` は UTC ms → JST 文字列変換として正確
  - `startMs > Date.now()` 仮説: 誤り。`startMs = Date.parse(reportDatetime)` は常に過去
- **真の根本原因:** `COL_W = 32px` が実際の列幅（~46px）と不一致
  - WeatherIcon `size={43}` + padding = 実列幅 ~46px に対し、バー計算は 32px/列 を仮定
  - MiniChartRow は `preserveAspectRatio="none"` で td 全幅に伸縮する別座標系
  - ガントバーだけが伸縮しない固定 32px 空間にあり、12時間が約8時間分に圧縮
- **修正:** 割合（%）ベースの座標計算に変更
  - `warningToHourlyBar(totalCols)`: 戻り値を px数値 → `"X%"` 文字列（`leftCol / totalCols * 100`）
  - MiniChartRow と同じ座標系に統一（設計思想の統一）
  - `WarningBar`: prop型 `number` → `string`、`width >= 32` 判定を撤廃し CSS (flex) に委譲
  - 死にコード `Math.max(Date.now(), warning.startMs)` を `Date.now()` に簡素化

#### 2. PCヘッダー redesign・予報×予報Δ表示（前回セッションの未コミット分）
**コミット:** `54aa3f6`（push済み）

- PCヘッダーをモバイルボトムナビ準拠のグラデーションピルボタン×3に変更
- 予報日付での比較分析Δ値表示（refForecastPrefixMap フォールバック）

### 決定事項
- ガントバーはパーセント座標系に統一（MiniChartRowと同じ設計）
- `showText = width >= 32` 判定は廃止（CSS flex + ellipsis に委譲）

### 未完了・次回候補
- ガントバー修正の実機確認（デプロイ後に now+12h まで正しく伸びるか検証）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-06 セッション（40回目）

### 作業内容

#### 1. 予報値同士の比較にもΔ値・Δ日差を表示
**コミット:** 未コミット（App.tsx修正済み）

- **問題:** 予報日付（未来）では historical キー（`accum_${t1id}` 等）のペイロード値が null になり `v0=undefined` でΔ表示がスキップされた
- **修正:** `refForecastPrefixMap` を定義し、`refKey` で値が取れない場合に `forecast_accum_*` キーへフォールバック
- 対象プレフィックス: `accum_` / `accumRadiation_` / `accumPrecip_` / `accumSunshine_`

#### 2. PCヘッダーをモバイルボトムナビ準拠に redesign
**コミット:** 未コミット（App.tsx修正済み）

- 旧: `premium-segmented-tab` + "天気情報/あの時の天気/比較分析/設定"（アイコンなし）
- 新: グラデーションピルボタン × 3（いまの空/空くらべ/あの日の空）＋設定ギア
- アクティブ: `linear-gradient(135deg, #0d9488 0%, #0f766e 100%)` 白テキスト
- 非アクティブ: 同グラデーション 15% 透明 + `#0d9488` テキスト
- モバイルボトムナビと同一のアイコン（Sun / BarChart2 / Clock）を使用

#### 3. 「いまの空」注意報表示の仕様確認（コード変更なし）
- WarningBox（`JmaWarningSummary`）: 気象庁 R8 API → `warningsByPref` を `PrefWarningCard` でリスト表示
- ガントバー（`HourlyTable`）: `warningToHourlyBar` で `startMs` → JSTインデックスに変換、`now+12h` が右端
- 終了時刻不明のため右端は `now+12h` のバーを描画

#### 4. 時間別ガントバーのバグ修正
**コミット:** 未コミット（HourlyTable.tsx修正済み）

- **問題:** バーが23時で切れて見えた（`Date.now()+12h` が expected より早い）
- **修正:** `Math.max(Date.now(), warning.startMs) + 12h` に変更して発表時刻を基準に最低12h保証

### 未回答・調査継続
- ユーザー質問「発表時刻より前に画面を見る＝キャッシュ？」への回答途中で中断
- 後日調査: `idx12=-1` になるケースの有無（hourly データが23時で終わっている原因の特定）
- バグ修正の有効性検証（`Math.max` が本当にこの症状を解消するか）

### 決定事項
- PCヘッダーはモバイルボトムナビのデザイン・名称・アイコンに統一
- 予報×予報比較でも ΔT・Δ日差を表示する（forecast key フォールバックで対応）

### 未完了・次回候補
- ガントバー「23時で切れる」根本原因の追加調査（`idx12` と hourly データ範囲の確認）
- LP スクリーンショット追加（低優先度・持ち越し）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度・持ち越し）

---

## 2026-06-06 セッション（38回目）

### 作業内容

#### 1. HourlyTable 改善
**コミット:** 前セッション分（context compaction前）

- 降水確率（%）行を追加
- 行順変更: 気温→降水確率→降水量→風速→風向き→気圧→湿度→飽差→露点→CAPE→0℃層高度
- 「降水」→「降水量」リネーム
- 飽差と露点の表示順を入れ替え（飽差→露点）

#### 2. モバイルボトムナビゲーション実装
**コミット:** `e3fc248`〜`b978c43`（push済み）

- モバイルヘッダーをシンプル化（設定ギアのみ）
- ボトムナビ追加: いまの空 / 空くらべ / あの日の空（Sun/BarChart2/Clock アイコン）
- コンテンツエリアに paddingBottom（56px + safe-area）付与
- アクティブ色: グラデーション塗り（#0d9488→#0f766e）白テキスト
- 非アクティブ色: 同グラデーション18%透明 + #0d9488テキスト

#### 3. 空くらべ モバイル表示改善
**コミット:** `a609834`（push済み）

- モバイル初期表示期間: 前々月〜翌月（Math.max(1, m-2)〜Math.min(12, m+1)）
- モバイル: viewport=null（画面幅いっぱいに全期間表示、パンなし）
- PC初期表示: 年間（1〜12月）
- `calcInitialDisplayRange()` 関数で分岐管理

#### 4. グラフホバー表示の改善
**コミット:** `8f36844`、`515f05b`、`3576746`、`0c3d672`（push済み）

- ホバー表示フォントサイズ調整（×1.5→現状比20%縮小: 0.92rem）
- 予報タップ時の表示順を「日別→累積 ※予報値」に統一（非予報と同じ順序）
- ラベル統一（`metricShortLabel`マップ）:
  - 日別積算/日別日射/日別日照/日別降水 → **日別**
  - 累積積算/累積日射/累積日照/累積降水 → **累積**
  - 月合計XX → **月合計**
- 予報タップ時に日別値を表示（積算温度・日射量・日照時間・降水量）
  - `forecastDailyMap` に `precip: fDay.precipSum` を追加

#### 5. プルリフレッシュ無効化
**コミット:** `e2e71e6`（push済み）

- `body { overscroll-behavior-y: contain; }` を index.css に追加
- 誤操作によるReact state全消去を防止

#### 6. プライバシーポリシー・免責事項ページ作成
**コミット:** `24ac337`、`74096fb`、`4de5fd3`（push済み）

- `public/privacy-policy.html`（静的HTML・9セクション）
- `public/disclaimer.html`（静的HTML・6セクション）
- Footer.tsx に免責事項リンク追加
- 第三者サービス記載: Firebase / Gemini API / Open-Meteo / 気象庁（防災情報JSON直接取得）/ Cloudflare
- Anthropicは開発ツールのため記載なし（アプリ動作中にユーザーデータを送信しない）

### 決定事項
- プルリフレッシュは無効（誤操作コスト > 手動更新の価値）
- 各タブの更新手段: いまの空=「更新」ボタン / 空くらべ=「表示」ボタン / あの日の空=日付選択時自動取得
- プライバシーポリシーに記載するのは「アプリ動作中にユーザーデータが経由するサービス」のみ

### 未完了・次回候補
- LP スクリーンショット追加（プレースホルダーに実際の画面キャプチャを埋め込む）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度）

---

## 2026-06-04 セッション（36回目）

### 作業内容

#### 1. AIコメント 曜日ズレ修正
**コミット:** `d1d35bb`（push済み）

- **問題:** カスタマイズタブのAIコメントで日付と曜日がずれていた（例：6/5を「水」と表示→実際は「金」）
- **原因:** `buildCommon()` の `nowLabel` が `"6/4 14時"` 形式（曜日なし）で、Geminiが曜日を自力計算して2日ズレ
- **修正:** `aiCommentInput.ts` の `nowLabel` を `"6/4(木) 14時"` 形式に変更（`DOW` 配列で曜日を付加）
- 標準4タブ・カスタマイズタブ共通の `buildCommon` 1箇所の修正で両方対応

#### 2. AIコメント データ範囲を過去7日〜7日後に拡張（A案）
**コミット:** `14ecfeb`（push済み）

- **変更ファイル:** `forecast.ts`, `aiCommentInput.ts`, `ai-comment.ts`, `ai-custom.ts`
- `forecast.ts`: APIに `&past_days=7` を追加、`ForecastData` に `pastDaily` フィールド追加、今日のJST日付で `daily` を `pastDaily`（過去7日）と `daily`（今日以降）に分割
- `aiCommentInput.ts`: `past_daily` フィールド追加、`buildPastDaily` 実装、`daily` の slice を `(2,9)` に拡張（7日後まで）
- `ai-comment.ts`/`ai-custom.ts`: システムプロンプトの入力データ説明を `past_daily` 追記・`daily` 説明を更新

#### 3. archive API 400バグ修正（比較分析タブ）
**コミット:** `8b98a93`（push済み）

- **問題:** 分析タブで今年（2026）を選択すると `start_date=2027-01-01`（未来）がアーカイブAPIに送られて400エラー
- **原因:** `weather.ts` の `nextJanMeans` フェッチが `year+1` を無条件に送信。`year=2026` のとき `2027-01-01` になる
- **修正:** `year + 1 <= currentYear` のときのみフェッチ、それ以外は `Promise.resolve(null)` でスキップ
- `nextJanMeans` は月別チャートの12/31補間値用。未来のため取得できない場合は `undefined` のままで問題なし

### 決定事項
- AIへの `now` フィールドには曜日を含める（`M/D(曜日) H時` 形式）
- AI入力データ範囲: 過去7日（日別実績）＋今後2日（時間別）＋3〜7日後（日別予報）
- `nextJanMeans` は今年以前のデータのみ取得（未来年はスキップ）

### 未完了・次回候補
- LP スクリーンショット追加（プレースホルダーに実際の画面キャプチャを埋め込む）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度）

---

## 2026-06-03 セッション（35回目）

### 作業内容

#### 1. LandingPage ビルドエラー修正
**コミット:** `d984461`（push済み）

- Cloudflare Pages ビルドが失敗していることをスクリーンショットで確認
- 原因: `LandingPage.tsx` に未使用の `Wind` import（TS6133）
- `Wind` を import リストから削除して修正

#### 2. AIプロンプト改善（散布どき・畑しごと）
**コミット:** `f89ad85`（push済み）

- **散布どき**: 農薬の防除散布だけでなく、液肥など肥料の散布も対象に追加
- **畑しごと**: 外での作業全般と、肥料まき・土壌管理など土に関わる作業を対象に追加
- 変更ファイル: `functions/api/ai-comment.ts`（プロンプト本文）、`AiCommentSettings.tsx`（設定UI説明）、`LandingPage.tsx`（LP説明文）

#### 3. 比較分析 Δ日「未到達」表示バグ修正
**コミット:** `daf2f70`（push済み）

- **問題:** 予報末端（6/13）ホバー時に「-8℃ / 未到達」と表示される
- **原因:** 従来は「2026が2024の現在値に達するか」を2026の series で逆引きしていた。予報末端では series が尽きて null → 「未到達」
- **修正:** 「2024が2026の現在値に達した日」を2024（比較年）の通年データで逆引みする方式に変更
  - `seriesByTarget.get(t0id)` → `seriesByTarget.get(refId)`
  - `findDateByAccum(series, v0)` → `findDateByAccum(series, p.value)`
  - `deltaDays = hoverDoy - crossDoy` → `crossDoy - hoverDoy`（符号反転）
  - 「早い/遅い」ラベルも反転して意味を維持
- 日射量チャートは同じ `computeAccumDiff` 関数を使用するため自動対応済み

#### 4. LP改善（Pain刷新・Solutionセクション新規追加）
**コミット:** `6fefd6b`（push済み）

- **Painセクション刷新:** 抽象的な課題説明 → 農家の一人称引用スタイル（Quote アイコン + ラベル + イタリック体）
  - 「今年は暖かい気がする…」「うちの畑は予報より風が強いから…」「情報を集めと計算だけで疲れてしまう」
- **Solutionセクション新規追加:** PAIN と FEATURES の間に挿入
  - 緑番号バッジ（1・2・3） + タイトル + チェックリスト詳細の構成
  - 理由1: もう計算ツールはいらない（前年比較・積算温度の自動見える化）
  - 理由2: 農業のプロが欲しい専門気象データを網羅（飽差・CAPE・CSV等）
  - 理由3: AIが「あなたの畑の専属アドバイザー」になる

### 決定事項
- Δ日逆引きは「比較年の通年データで上段グラフの現在値を検索」する方式に統一
- LP Pain は一人称引用スタイルに統一（「私のことだ」と思わせる設計）
- LP Solution は Pain の直後に配置（課題→解決策の流れを強化）

### 未完了・次回候補
- LP スクリーンショット追加（プレースホルダーに実際の画面キャプチャを埋め込む）
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度）

---

## 2026-06-03 セッション（34回目）

### 作業内容

#### 1. ランディングページ（LandingPage）新規作成
**コミット:** `bdb5599`（push済み）

- 未ログイン時に `LoginScreen` の代わりに `LandingPage` を表示
- 姉妹アプリ（Orch.RECIT / Orch.TREE）と統一したデザイン言語（FadeIn アニメーション・緑系カラーパレット・inline styles）
- **構成セクション（8セクション）:**
  1. Hero「農業に必要な気象データが、ひとつに。」
  2. Pain（農家の3つの課題）
  3. Features（農業特化6機能カード）
  4. AI Spotlight（散布どき・AIアドバイス）
  5. Custom Prompt Spotlight（あなた専用プロンプト）
  6. Warning Spotlight（気象庁注意報・警報）
  7. Comparison Table（他ツールとの比較）
  8. How it works（3ステップ）+ Pricing + Final CTA + Footer

- **カスタムプロンプト訴求:**
  - キャッチ「天気の「生データ」を、あなた専用の右腕に。」
  - 3つの吹き出し例文（霜アラート・箇条書き・方言）
  - セクション内インライン小注記（参考情報の旨）

- **法的免責文をフッターに明示:**
  - 「シミュレーション・サポートツール」として位置づけを宣言
  - 「アプリ自体が独自の気象予測を行うものではない」と明記
  - コソコソ隠さず、信頼性向上のための積極的な開示として掲載

### 決定事項
- 「天気予報」「気象予測」という表現は LP 全体で使用しない
- 「Open-Meteo・気象庁の公開データを表示・活用」という表現に統一
- 免責文は小さく・読みやすく、フッターの目立つブロックに掲載

### 未完了・次回候補
- 各スクリーンショットプレースホルダーに実際の画面キャプチャを埋め込む
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度）
- デプロイ後に Cloudflare Pages で LP が正しく表示されるか確認

---

## 2026-06-03 セッション（33回目）

### 作業内容

#### 1. 積み残しタスクの整理
- 比較分析タブのローカル動作確認 → OK済みとして完了
- 2バージョン管理の実装（Viteフィーチャーフラグ）→ 不要と判断・キャンセル
- `project_deferred_tasks.md` を更新

#### 2. 土砂災害注意報を設定の表示・非表示に連動させる
**コミット:** `e12e99f`（push済み）

- **問題:** `warningNameToGroup` に `土砂災害` のマッチングがなく `null` を返すため、設定に関係なく常時表示されていた
- `JmaWarningGroup` 型に `'土砂災害'` を追加
- `warningNameToGroup` に `土砂災害` の分岐を追加
- `ALL_JMA_GROUPS` / `DEFAULT_JMA_GROUPS` に追加
- 設定UI（JmaWarningSettings）の「雨・洪水」セクションに「土砂災害（注意報〜警報）」を追加
- `getUserSettings` に前方互換マイグレーション処理を追加（既存ユーザーの保存済みリストに自動追加）

#### 3. JMA 2026/06 APIフォーマット変化の調査
- ライブAPI（長野・東京）をWebFetchで確認
- フォーマットが辞書型→配列に変わったが、`Object.keys(array)` の挙動により既存コードが偶然対応していた
- 現在出現する危険度タイプは全て `R8_PHENOMENON` に含まれており、未対応タイプなし
- `jmaWarning.ts` のコメントを配列フォーマットに更新

#### 4. 注意報ガントバーの仕様見直し
**コミット:** `bd10a4b`（push済み）

- **旧仕様:**
  - 時間別: テーブル末尾（72h先）まで固定
  - 日別: 発表時刻+6時間固定
- **新仕様（日別・時間別共通）:** 発令中は now+12h まで、テーブル外はクリップ＋`→`アロー
- r8 API は終了時刻を提供しない（`status` 変化で解除を検知する設計）を確認

#### 5. endMs 依存 dead code の削除（リファクタリング）
**コミット:** `0ce73eb`（push済み）

- r8 API では `endMs` が常に `undefined` のため、参照するブランチが全て死に枝だったことを確認
- `HourlyTable.tsx`: `endMs` あり想定の `else` ブランチを削除
- `WarningBar.tsx`: `indefinite` フラグ廃止、`→` アローを無条件表示
- `warningGantt.ts`: `w.endMs ?? Infinity` → `Infinity` に直書き
- `jmaWarning.ts`: `endMs` フィールドは将来拡張用として型定義に保持

### 決定事項
- 2バージョン管理の実装はキャンセル
- 土砂災害は設定の表示・非表示に連動させる（デフォルト有効）
- 注意報ガントバーは「now+12h まで＋アロー」で日別・時間別統一
- r8 API に終了時刻はなく、`status: '解除'` のポーリング検知で解除を把握する設計を確認

### 未完了・次回候補
- Firestore TTL ポリシー設定（aiComments コレクション・低優先度）
- デプロイ後の注意報ガントバー表示確認

---

## 2026-06-02 セッション（32回目）

### 作業内容

#### 1. AIコメント速度改善 Case 1 効果確認・Case 2 不要決定
- Case 1（thinkingBudget: 0）で十分な速度改善を確認
- Case 2（4並列リクエスト化）は不要と判断。設計メモのみ残してクローズ
- メモリ（project_deferred_tasks.md）を更新

#### 2. 比較分析タブ改善（大規模）
**コミット:** `93c45ba`・`35dc656`（push済み）

##### 表示ボタン追加（手動トリガー化）
- `targets`（UIペンディング）/ `committedTargets`（データ取得・チャート描画）の2ステート分離
- 選択パネル下部に「表示」ボタンを追加。ボタン押下時のみデータ取得が走る
- `initialTargetIdRef`（useRef）で両ステートの初期IDを共有し StrictMode 対応
- `committedTargets[0]?.year` ベースで `currentTargetHasForecast` と viewport 計算

##### 初期ロード・現在地対応
- `analysisInitializedRef` + useEffect でタブ初回表示時にデフォルト地点（または `__geo__`）を自動設定
- 「現在地を表示」ボタン削除 → ドロップダウンに「📍 現在地」を常時表示
- 表示ボタンで現在地選択時、`geoLocation` が未取得なら GPS を取得してからコミット（`isCommitting` ローディング）

##### スプレッドシート刷新（DailyRawTable 新規コンポーネント）
- MonthsTable（月次集計×7チャート）を廃止
- DailyRawTable（全指標×最大365日×全ターゲット1テーブル）を新設（`src/components/DailyRawTable.tsx`）
- 指標10列: 最高/最低/平均気温・降水量・日射量・日照時間・最高/最低湿度・最高/最低飽差
- 2ターゲット時: 指標グループごとにA/B隣接の2行ヘッダー
- sticky ヘッダー（2行目は top: 32px でオフセット）+ maxHeight 420px スクロール

##### CSVダウンロード
- UTF-8 BOM付き（Excel対応）
- `setTimeout(() => URL.revokeObjectURL(url), 100)` で Safari/Firefox の競合回避
- ファイル名: `weather_地点名_年.csv`

### 決定事項
- Case 2 不要（Case 1 で十分）
- 「現在地を表示」ボタン廃止 → ドロップダウン + 表示ボタンで代替
- スプレッドシートは全指標1テーブル・365日・最高最低ベース

### 未完了・次回候補
- 比較分析タブ ローカル動作確認（デプロイ後も確認推奨）
- 2バージョン管理の実装（Viteフィーチャーフラグ + CF Pages 2プロジェクト）
- Firestore TTL ポリシー設定（低優先度）

---

## 2026-06-02 セッション（31回目）

### 作業内容

#### 1. AIコメント タブ名変更・プロンプト改善
**コミット:** `ef0d3fe`（push済み）

- タブ名「外しごと」→「畑しごと」に変更（AiCommentCard / AiCommentSettings / store.ts）
- `generalWorkAdvice` プロンプトを改訂：晴れ間の作業タイミング提案に加え、荒天・猛暑・強風でも外作業が必要な場合の注意点（安全確保・体調管理・服装・作業の優先度）もアドバイスできるよう指示を追加

#### 2. AIコメント 速度改善 Case 1 実施
**コミット:** `789f864`（push済み）

- `functions/api/ai-comment.ts` に `thinkingConfig: { thinkingBudget: 0 }` を追加
- 背景：JSON schema mode が thinking を抑制しているかどうか仕様上不明確なため、ai-custom.ts と同様に明示的に無効化
- thinking が実際に動いていた場合、初回取得レイテンシが改善される

#### 3. AIコメント 速度改善 Case 2 記録
- 4並列リクエスト化の設計をメモリ（`project_deferred_tasks.md`）に記録
- Case 1実施後に体感まだ遅ければ着手する中優先タスクとして保存

### 決定事項
- タブ名「畑しごと」で確定
- AI速度改善はまず Case 1（thinkingBudget: 0）で様子を見る
- Case 2（4並列化）は後日対応タスクとして保存

### 未完了・次回候補
- Case 1 の効果検証（デプロイ後にAIコメントタブの初回取得速度を確認）
- Case 2（4並列リクエスト化）— Case 1 でも不満なら実施
- iOS Safari の表示確認（前セッションのエラーハンドラ追加後の動作確認）
- 2バージョン管理の実装（Viteフィーチャーフラグ + Cloudflare Pages 2プロジェクト）
- Firestore TTL ポリシー設定（aiComments コレクション・優先度低）

---

## 2026-06-02 セッション（30回目）

### 作業内容

#### 1. AIカスタムコメント — locationInfo 送信漏れ修正
**コミット:** 前セッションから継続（コンテキスト引き継ぎ）

- `src/api/aiComment.ts`: `fetchAiCustomComment` の POST body に `locationInfo: input.location` を追加
- バックエンド（`ai-custom.ts`）は `locationInfo` を受け取ってプロンプト冒頭に `対象地域:\n{name}\n\n` として埋め込む設計が既に完成していたが、フロントが `locationInfo` を送っていなかった

#### 2. AIカスタムコメント — 思考トークン漏れ修正
**コミット:** `7ad3cc7`（push済み）

**問題:** カスタムコメントに「」(そうですね)」「めやぐだ」などの方言語彙リストが出力されていた。

**根本原因:** Gemini 2.5 Flash はデフォルトで thinking（内部推論）が有効。プレーンテキスト出力では `parts[0]` が `thought: true` の思考トークン、`parts[1]` が本文になる。コードが `parts[0]` のテキストをそのまま返していた。

**修正（二重防護）:**
- `thinkingConfig: { thinkingBudget: 0 }` でAPI側からthinkingを無効化
- `parts.find(p => !p.thought)?.text` で本文パートのみ取得（標準タブと一致させる）

#### 3. iOS Safari 表示不具合・Google認証修正
**コミット:** `60ad79d`（push済み）

**問題:** iPhoneのSafariで開くと背景色のみ表示、コンテンツが一切描画されない。

**対応:**
- `index.html`: `window.onerror` / `window.onunhandledrejection` ハンドラを追加。JSクラッシュ時に真っ白にならず、エラーメッセージを `#root` に表示して原因特定を可能にする
- `index.html`: `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style` meta タグを追加（iOS PWA安定化）
- `vite.config.ts`: `build.target: 'es2020'` を明示（Vite 8のデフォルト未設定を解消）
- `LoginScreen.tsx`: iOS検出（`/iPad|iPhone|iPod/` + `maxTouchPoints > 1`）→ `signInWithRedirect` に切り替え。PWAモード（ホーム画面追加）では `signInWithPopup` が機能しない既知の問題を修正
- `App.tsx`: `getRedirectResult(auth)` をonAuthStateChangedのuseEffectで呼び出し、リダイレクト後のエラーをサイレント処理

### 決定事項
- iOS Safari は `signInWithRedirect`、その他は `signInWithPopup` を使い分ける
- エラー表示ハンドラはデバッグ用途だが恒久実装（ユーザーへの可視性向上）

### 未完了・次回候補
- iOS Safariで実際にエラーメッセージが表示されるか確認（Cloudflare Pages デプロイ後）
- 2バージョン管理の実装（Viteフィーチャーフラグ + Cloudflare Pages 2プロジェクト）
- Firestore TTL ポリシー設定（aiCommentsコレクション・優先度低）

---

## 2026-06-02 セッション（29回目）

### 作業内容

#### 1. AIコメント カスタマイズ機能実装
**コミット:** `0d53a57`（push済み）

- `AiSection` 型追加（store.ts）・`enabledAiSections` / `aiCustomPrompt` を UserSettings に追加
- Firestore CRUD 追加（userRepository.ts）
- カスタムコメント用キャッシュ（aiCommentCache.ts）：`"c:"` プレフィックスで分離
- `/api/ai-custom` Cloudflare Pages Function 新規作成
- `useAiCustomComment` フック新規作成
- `AiCommentSettings` 設定コンポーネント新規作成
- 設定タブに「気象コメント」サブタブ追加
- `AiCommentCard` をカスタマイズタブ対応・動的タブ構成に更新
- カスタマイズはデフォルト無効（オプトイン）

#### 2. バグ修正（カスタマイズタブ・502エラー）
**コミット:** `eec4327`（push済み）

- カスタマイズタブ選択でカード全体が消えるバグ修正（`customText===null` 時 return null → スケルトン表示）
- `/api/ai-custom` 502 修正：`responseMimeType: application/json` を廃止→プレーンテキスト取得に変更（日本語長文がJSONとして途中切断されparse errorになるのを防ぐ）

#### 3. カスタムAIプロンプト改善
**コミット:** `7f3c943`（push済み）

- 農業・気象以外トピックへの回答拒否ガードレール追加
- プロンプトインジェクション対策
- 過剰出力制限（400文字以内）・デフォルト200文字指定
- 入力データ構造説明をプロンプトに追加

#### 4. AIへの入力データ追加（cape/frz/prs）
**コミット:** `12cd845`（push済み）

- `AiHourlyEntry` に cape / frz / prs フィールドを追加
- `buildAiCommentInput` で各フィールドを hourly エントリに含める
- ai-comment.ts のシステムプロンプトの入力データ説明を更新

#### 5. 警報ガントバー配色変更・細くする
**コミット:** `b54920c`（push済み）

- `GANTT_GRADIENT`（鮮やかグラデーション＋白テキスト）廃止
- `GANTT_COLOR` 追加：注意報=薄橙+茶テキスト/警報=薄赤+濃赤テキスト/特別警報=薄ピンク（JmaWarningSettings と同系色）
- バー高さ 20px → 14px・font 10px → 9px

#### 6. AIコメント並列処理の試行と差し戻し
**コミット:** `31dfb13`（並列化）→ `a1af99a`（差し戻し）

- PROMPT_1/PROMPT_2 分割・Promise.all 並列実行を実装するも差し戻し
- 「思考過程を出力しない」制約は維持

#### 7. AI入力データを軽量版・詳細版に分離
**コミット:** `7a6db3f`（push済み）

- 標準4タブ用 `buildAiCommentInput`（軽量）: cape/frz/prs を削除、2時間おき24エントリ
- カスタマイズ用 `buildAiCustomInput`（詳細）: cape/frz/prs 含む、1時間おき48エントリ
- `AiHourlyEntryRich` 型追加（cape/frz/prs 付き）
- `AiCustomInput` 型・`hashAiCustomInput` 追加
- 各プロンプトのデータ説明を対応する仕様に更新

### 決定事項
- AIコメント並列処理は差し戻し（単一リクエスト維持）
- カスタマイズタブはデフォルト無効（設定タブからオプトイン）
- 標準タブとカスタマイズタブで別エンドポイント・別入力データを使用

### 未完了・次回候補
- 2バージョン管理の実装（Viteフィーチャーフラグ + Cloudflare Pages 2プロジェクト）
- Firestore TTL ポリシー設定（aiCommentsコレクション）

---

## 2026-06-01 セッション（28回目）

### 作業内容

#### 1. JMA警報API r8フォーマット完全移行
**コミット:** `3649381`（push済み）

**問題:** 奄美市に暴風警報・波浪警報・雷注意報が発令中なのに表示されない。

**根本原因:**
- JMAが `warning/data/warning/{prefCode}.json`（旧API）の更新を2026-05-28で停止
- `warning/data/r8/{prefCode}.json`（新API）に完全移行済みだったが、アプリは旧APIを参照
- 旧APIは全警報が「解除」状態のまま凍結（reportDatetime: 2026-05-28）
- 新r8フォーマットは構造・コード体系ともに完全に別物

**r8フォーマットの構造:**
- `{"0": {...}, "1": {...}, ...}` 電文別オブジェクト
- 各エントリに `warning.class20Items[].kinds[].{code, status, properties}`
- status: `発表/継続/解除/発表警報・注意報はなし`
- `properties[].type`（風危険度/波危険度/雷危険度等）+ `significancyPart.locals[].code`（20=注意報/30=警報/50=特別警報）から警報名・レベルを導出

**修正:**
- APIエンドポイントを `warning/data/r8/{prefCode}.json` に変更
- `jmaWarning.ts` を全面書き直し（r8パーサー実装）
- `R8_PHENOMENON` テーブル: 危険度type → {adv, warn, special} 名称マッピング
- `r8LevelFromCode()`: レベルコード先頭桁 → WarningLevel
- 検証: 奄美市(4622200)で暴風警報・波浪警報・雷注意報がJMAページと一致確認

#### 2. 警報フィルタをコードベースから名前ベースに変更
**コミット:** `f3ac894`（push済み）

**問題:** 設定タブで「波浪」チェックを外しても警報表示が消えない。

**根本原因:**
- `JMA_GROUP_CODES` が旧APIコード体系（波浪: `['17','25','37']`）のまま
- r8の新コード（`07`=波浪警報, `16`=波浪注意報）は集合に存在しない
- `enabledJmaCodeSet.has(item.code)` が常に `false` → フィルタ無効化

**修正:**
- `JMA_GROUP_CODES`（コードベース）を廃止
- `warningNameToGroup(name: string): JmaWarningGroup | null` を新設（名前の前方一致）
- '暴風雪'/'風雪' → '風雪' グループ、'暴風'/'強風' → '強風' グループ（順序重要）
- 特別警報の常時表示判定: `code >= 33` → `item.level === 'special'`
- `WeatherTab.tsx` のフィルタを `enabledGroupSet.has(group)` に更新

### 決定事項
- JMAのr8 APIフォーマットが正式移行先（旧APIは廃止状態）
- 警報フィルタは名前ベースマッチングで統一（コード体系に依存しない）
- 土砂災害など未分類（groupがnull）の警報は常に表示

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-01 セッション（27回目）

### 作業内容

#### 1. Google Cloud OAuth テストユーザー追加サポート（コンソール操作ガイド）
- Firebase Authentication に kaz.matsumoto 以外のアカウントを追加したい要望
- Google Cloud プロジェクトが2つある状況を整理（`orchweather` = Firebase用 / `gen-lang-client-0331075600` = Gemini API自動生成用）
- 正しいプロジェクト（orchweather）に切り替えると OAuth クライアントは設定済みであることを確認
- テストユーザー追加: Google Auth Platform → 「対象」→「テストユーザー」を案内
- OAuth 同意画面「本番環境」vs「テスト」モードの違いと推奨を説明

#### 2. AI コメント「今日」誤認バグ修正
**コミット:** `a8a7558`（push済み）

**問題:** 21:00時点で「今日6/2は～」という誤った表現が出ていた。

**原因:** `AiCommentInput` に現在日時を渡しておらず、AIがデータの多数派（夜間は翌日エントリが大半）から「今日=翌日」と誤判断。

**修正:**
- `AiCommentInput` に `now: string`（JST "M/D H時"形式）フィールドを追加
- `buildAiCommentInput` で `Date.UTC` ベースの安全な JST 時刻から `nowLabel` を生成
- `ai-comment.ts` プロンプトに「`now` を基準に今日・明日を判断せよ」を追記

### 決定事項
- なし（既存方針を維持）

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-01 セッション（26回目）

### 作業内容（コンテキスト圧縮前の内容を復元）

#### 1. AI コメント機能 各種改善
**コミット群:** `f551dc3` まで（push済み）

- **Gemini 応答トークン不足 → エラー修正:** `maxOutputTokens` を 2048 → 4096 に増加 + 最大3回リトライ実装
- **AI 改行ルール再調整:** 禁止寄り → 推奨寄り（2〜3文ごと、1項目あたり2〜3箇所の改行）
- **天気概況に農作物への影響追加:** 日照不足・低温・高温・乾燥・長雨・強風・霜の影響に一言ふれる
- **「天気の備え」プロンプト拡充:** 荒天だけでなく晴天続きの乾燥・熱ストレス、曇天続きの日照不足・湿気病リスクも対象

#### 2. AI タブ 名称・順序変更 + ローディング中タブ表示
- タブ順序・名称: 天気概況→**空ごよみ** / 一般外作業→**外しごと** / 防除・散布→**散布どき** / 悪天候への備え→**天気の備え**
- ローディング中もタブバーを実表示（最初のタブアクティブ・他は opacity 0.5、コンテンツ部分のみスケルトン）

### 決定事項
- `maxOutputTokens` は 4096 に固定（余裕を持たせる方針）
- タブ名は上記4種に確定

### 未完了タスク
- なし

---

## 2026-06-01 セッション（25回目）

### 作業内容

#### 1. 注意報の期間表示・自動非表示バグ修正
**コミット:** `5300398`（push済み）

**問題:**
- 発表期間が表示されない（「注意報 濃霧」のみで時刻なし）
- 期限のない注意報（濃霧等）がいつまでも表示・AI に渡され続ける

**根本原因（実データ検証で特定）:**
- 濃霧(コード14)等は `timeSeries` に時系列(levels)を持たず、`areaTypes` に `status:発表` のみ存在
- 当該地域の `timeSeries` は「雷危険度」の複合オブジェクト形式（`levels[0]` がオブジェクト）→ `buildValidPeriodMap` がスキップ → `validPeriodMap` 空 → `startMs/endMs/validPeriod` 全て undefined
- 結果、期限ベース除外もAI側の24hフィルタ（`startMs` 基準）も発動しなかった

**修正:**
- `fetchJmaWarnings` に「終了時刻なし注意報は**発表時刻から6時間**で除外」を追加
- 期間表示: 終了時刻なし注意報は発表時刻を表示（例 `5/28 6:51〜`）
- AI側の冗長な重複フィルタ（`aiCommentInput.ts`）を削除 → 単一ソース化
- `tasks/lessons.md` に教訓記録

#### 2. AI プロンプト改善
**コミット:** `6d21d42`（push済み）

**①改行が出なくなった問題の修正:**
- 前回「同じ日の続きでは改行しない」と禁止寄りに振りすぎたためAIが改行をほぼ止めた
- 「意味のまとまりごとに改行」「2〜3文ごとが目安」「長い塊にしない」と推奨寄りに転換
- 一文の途中の改行禁止は維持

**②天気概況に農作物への影響を追加:**
- 日照不足・低温による生育の遅れ、高温・乾燥による水分不足、長雨による過湿・病気、強風・霜の物理ダメージ等に一言ふれる指示を追加
- 「作物の種類は特定しない」制約は維持

### 決定事項
- 注意報フィルタの判定は `fetchJmaWarnings` の1箇所のみ（UI・AI・ガント単一ソース）
- 期限情報のない注意報の非表示閾値: **発表時刻から6時間**

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②Firestore TTL ポリシー設定（優先度低）

---

## 2026-06-01 セッション（24回目）

### 作業内容

#### 1. AI改行ルール修正
**コミット:** `ec39f63`（push済み）
- AIコメントが文の途中で頻繁に改行され読みにくかった
- プロンプトの改行ルールを「日付の変わり目・話題の大きな転換時のみ。一文の途中や同じ日の続きでは改行しない」に限定
- 反映は Firestore キャッシュ（4時間TTL）切れ後の次回リクエストから

#### 2. 降水量表示を切り上げに変更
**コミット:** `066e34b`（push済み）
- 雨アイコンが出ているのに時間別の降水量が `0.0mm` と表示される矛盾
- 原因: `HourlyTable.tsx` の `toFixed(1)` が `0.03mm` 等を四捨五入で `0.0` にしていた（こちらの処理。Open-Meteo は生float）
- 修正: `h.precipitation === 0 ? '0.0' : (Math.ceil(h.precipitation * 10) / 10).toFixed(1)`（非ゼロは最低0.1mm表示）

#### 3. 【重要バグ】夜間降水量の日付集計ズレ修正
**コミット:** `7a87f67`（push済み）
- 日別チャートの夜間降水量(4.9mm)が時間別の合計と一致しない
- **真の原因:** `forecast.ts` で 0-3時を前日夜間に集計する際、`new Date(date+'T00:00:00')`（ローカル=JST解釈）→ `setDate(-1)` → `toISOString()`（UTC変換で-9h）の組み合わせにより **計2日ズレ**。6/3未明の雨が6/1夜間に誤合算されていた
- **修正方針（方針B採用）:** 日付計算をUTC基準に統一。`src/lib/dateUtils.ts` を新規作成し `addDays()` を共有化。`forecast.ts` と `DailyForecast.tsx`（重複定義削除）の両方から import
- 副次効果: 同じ集計ロジックを使う夜間の天気アイコン・降水確率のズレも同時に解消
- `tasks/lessons.md` にTZズレ再発防止ルールを記録
- 検証: `npx tsc --noEmit` パス、`6/3 0-3時 → 6/2夜間` に是正確認

### 決定事項
- **日付計算は必ずUTC基準（`dateUtils.addDays`）で行う**。ローカルDate生成+`toISOString`は禁止（lessons.md記録済み）

### 未完了タスク
- なし

### 次回への引き継ぎ
- 次の着手候補：①2バージョン管理の実装 ②Firestore TTL ポリシー設定（優先度低）

---

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
