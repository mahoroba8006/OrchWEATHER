# アプリ全面リニューアル 第4段階「空くらべ・空しらべ」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 空くらべを App.tsx から独立ファイルへ純粋移動で切り出したうえで、空くらべのチャート・操作・表と、空しらべの操作パネルを新デザインシステムで作り直す。機能・データ・ジェスチャーは一切変えない。

**Architecture:** まず挙動を変えない切り出し（Task 1）で App.tsx を骨格だけにし、見た目の変更（Task 2〜4）を独立ファイル内に閉じ込める。ジェスチャー状態機械（`src/lib/chartViewport.ts`）とデータ計算は触らない。

**Tech Stack:** React 19 / TypeScript / Recharts 3 / motion 13（`m.*` のみ）/ Vitest / Playwright 撮影

**仕様書:** [docs/superpowers/specs/2026-09-30-app-visual-redesign-design.md](../specs/2026-09-30-app-visual-redesign-design.md) §3「空くらべ・空しらべ」、§4 リスク表「App.tsx 2,780行」

---

## 前提知識（実装者向け）

- 検証: `npm run test`（現在157件）、`npx tsc -b`、`npm run build`。撮影は dev サーバー（`npm run dev -- --port 5180 --strictPort`）起動中に `npm run screenshots -- <名前>`、画像は Read ツールで目視。終了時に dev サーバー停止（`netstat -ano | findstr :5180` → `taskkill //PID <pid> //F`）。
- トークン: 面 `--surface-ground/card/sunken`、文字 `--ink-1/2/3`、線 `--line` `--line-strong`、アクセント `--accent` `--accent-press` `--accent-soft`、影 `--shadow-card` `--shadow-raised`、角丸 `--radius-*`。新規コードは互換エイリアス（`--accent-color` 等）でなく新トークンを使う。
- 既存部品: `src/components/ui/{Button,SegmentedControl,Skeleton,Reveal,Sheet,ErrorBoundary}.tsx`、`SegmentedControl` は `variant: 'pill' | 'underline'`、`idPrefix`、`.ui-seg--compact` 修飾あり。横スクロールが必要な場合は `.ai-tab-bar`（スクロールバー非表示）を流用できる。
- ばね: `src/lib/motion.ts` の `springs.*`、`pressScale`。`m.*` のみ（LazyMotion strict）。
- **触ってはいけないもの**: `src/lib/chartViewport.ts` とそれを使うジェスチャー処理（pan / pinch / 縦スクロール判定 / Ctrl+ホイール / ツールチップ抑制）、データ取得・集計・キャッシュ、比較対象の追加・削除・確定の処理、CSV の有料制限表示、`logWeatherView` 等のアナリティクス呼び出し。
- ヘルプ（`src/components/HelpPage.tsx`）が空くらべの見た目（色・ボタン名等）を説明している場合、記述と矛盾させない。矛盾する場合は文言を最小修正。

---

### Task 1: 空くらべの純粋移動による切り出し（担当: Sonnet・慎重に）

**Files:**
- Create: `src/components/analysis/AnalysisTab.tsx`（＋必要なら `src/components/analysis/chartShapes.tsx`）
- Modify: `src/App.tsx`

**方針:**
- App.tsx の `AppContent` のうち、**空くらべ専用**の state・ref・effect・memo・ハンドラ・JSX（現在 `{topTab === 'analysis' && (…)}` で描画している範囲、約1700〜2527行）と、それらだけが使うファイル先頭のチャート補助部品（`CustomWideBar`, `CustomRangeBar`, `ForecastRangeBar` 等、約34〜156行）を `AnalysisTab` に移す。
- **骨格に残すもの**: `topTab`, `sheet`, `sinkOriginY`, `slideDir`, `isMobile`（空くらべでも必要なら props で渡すか、AnalysisTab 内で同じ初期化式 `useState(() => window.innerWidth < 768)` を持つ）、認証・ゲスト・ヘッダー・ボトムナビ・シート・タブ遷移。
- 共有されている値の見極め: 各 state / 関数について `grep -n "<名前>" src/App.tsx` で使用箇所を洗い出し、空くらべ範囲外でも使われているものは骨格に残して props で渡す。**推測で移さない。**
- `AnalysisTab` の props は最小限（例: `{ isMobile: boolean }` とストア由来は内部で `useAppStore()`）。
- **ロジックの書き換え・整理・命名変更・コメント削除はしない**（純粋移動）。import の付け替えと props 受け渡しだけを行う。eslint の既存警告も移動先でそのまま（新規に増やさない）。
- `topTab === 'analysis'` の描画箇所は `<AnalysisTab isMobile={isMobile} />` に置き換える。タブ切替で AnalysisTab はアンマウントされる（現行も条件描画でアンマウントされていたか確認し、**現行と同じマウント挙動**にする。現行で state が App に残っていてタブ往復でも保持されていたなら、その state は App 側に残して props で渡すこと。これが最重要の等価性ポイント）。

**検証（必須）:**
1. 着手前に撮影 `npm run screenshots -- p4-before`。
2. 切り出し後 `npx tsc -b`・`npm run test`（157件）・`npm run build`。
3. 撮影 `npm run screenshots -- p4-extracted`、`mobile-2-空くらべ.png` と `desktop-2-空くらべ.png` を before と Read で見比べ、差がないこと（データ取得時刻の差による数値差は可）。
4. dev サーバー上で Playwright の一時スクリプト（`scripts/_tmp_p4.mjs`、コミットしない）で次を確認し、結果をログ出力: 空くらべで「月次」→「日次」切替、チャート種別タブを全種クリックしてエラーが出ない（`page.on('pageerror')` を監視）、空くらべ→空もよう→空くらべの往復後も表示単位・選択チャートが現行と同じ振る舞い（保持 or 初期化）であること。
5. App.tsx の行数を報告（目安: 約900行以下）。

- [ ] Commit `refactor: 空くらべをApp.tsxからAnalysisTabへ純粋移動で切り出し`

---

### Task 2: 空くらべの操作部（担当: Sonnet）

**Files:** Modify `src/components/analysis/AnalysisTab.tsx`（スタイルは `src/components/analysis/analysis.css` を新設してよい）

1. **表示対象カード**（地点 select・年 select・「比較対象を追加」・「表示」ボタン）:
   - カードは `--surface-card`、`--radius-lg`、`--shadow-card`。見出し「表示対象」は `--ink-2` 0.8rem 600。
   - 各比較対象の行: 左の色バー（系列色、既存値）は 4px の丸い縦線として維持。select は既存グローバル select スタイル（第1段階で平坦化済み）に任せ、行間を 8px に。
   - 「比較対象を追加」は `Button variant="ghost"`、「表示」は `Button variant="primary"`（アイコンはそのまま）。行の削除ボタンがあればゴースト丸ボタン（32px）に。
   - 未確定の変更がある時に「表示」を促す既存の状態表示があれば維持し、色をトークンへ。
2. **表示単位**（日次／月次）: `SegmentedControl variant="pill"`（`.ui-seg--compact`、`layoutId="analysis-unit"`、`ariaLabel="表示単位"`）。右側のズーム操作（縮小・拡大・全体表示）は 32px のゴースト丸ボタン（`Button variant="ghost"` に丸形のクラス）に、案内文（「ドラッグで移動・Ctrl/⌘＋ホイールで拡大縮小」）は `--ink-3` 0.72rem。
3. **チャート種別タブ**（気温・降水量・積算温度・日射量・日照時間・湿度・飽差）: `SegmentedControl variant="underline"`（`layoutId="analysis-chart"`、`ariaLabel="グラフの種類"`）を `.ai-tab-bar` 相当の横スクロール容器に入れる。選択中タブが画面外なら `scrollIntoView({ inline: 'nearest' })`。
4. 3つのカードは1枚のカードにまとめない（現行の区切りを維持）が、カード間の余白を 12px（モバイル）/16px（PC）に統一。

**テスト:** 既存テストが通ること。新規 `AnalysisTab.controls.test.tsx` は不要（ロジック不変のため）。撮影 `p4-controls` で 375px の折り返し・はみ出しがないことを確認。

- [ ] Commit `feat: 空くらべの表示対象・表示単位・グラフ種別の操作部を刷新`

---

### Task 3: 空くらべのチャート（担当: Sonnet）

**Files:** Modify `src/components/analysis/AnalysisTab.tsx`（＋`chartShapes.tsx`）、`src/index.css`（`--chart-*` の再設計のみ）

1. **チャートカード**: `--surface-card`、`--radius-lg`、`--shadow-card`、内側余白 モバイル16px/PC 24px。チャート見出し（アイコン＋「気温」等）は `--ink-1` 1rem 600、アイコンは系列の意味色。
2. **軸・グリッド**: 軸線なし（`axisLine={false}`、`tickLine={false}`）、目盛り文字 `--ink-3` 11px 等幅数字。グリッドは横線のみ、`stroke: rgba(23,25,28,0.06)`、破線なし。単位ラベル（「(℃)」等）は `--ink-3`。
3. **系列の色（意味色）**: `src/index.css` の `--chart-*` を次に更新し、チャート内のハードコード色を変数参照に置換（比較対象ごとの系列色の配列がある場合は、その配列は識別用なので**維持**）。
   ```css
   --chart-temp: #E0555A;      /* 気温（暖色） */
   --chart-precip: #2E7DD7;    /* 降水 */
   --chart-accum: #3E9B6E;     /* 積算 */
   --chart-humid: #1F8A8A;     /* 湿度 */
   --chart-sunshine: #E09A1F;  /* 日照・日射 */
   ```
   ※ 比較対象の系列色と役割が重複・競合する場合は既存の割り当てを優先し、報告する。
4. **線の太さ**: 平均線 2px、範囲バー（最低〜最高の縦棒）1.5px・不透明度 .55、予報部分の破線は `4 3`。
5. **十字線と値表示**: 既存の縦線・横線・X軸ラベル（Customized で描画）は色を `--ink-2`（線は opacity .35、1px）に、X軸下の日付ラベルは `--ink-1` 背景・白文字・角丸 6px。ヘッダー右側の値表示は、値が変わるたびに `m.span key={値}` で `opacity 0→1, y 4→0`（`springs.press`）で差し替える。**表示／非表示の判定ロジック、ジェスチャー判定には触れない。**
6. **凡例**（「最低〜最高」「月間平均」「予報値」）: `--ink-2` 0.75rem、記号は系列色。
7. 「タップして値を表示」の案内は `--ink-3` 0.8rem。
8. **CSVカード**（有料予定）: カード様式に揃え、鍵アイコン＋ボタンは `Button variant="secondary"`（無効状態の現行挙動を維持）、説明文 `--ink-3`。

**テスト:** 既存テスト（`chartViewport.test.ts` 含む）が通ること。撮影 `p4-charts` で全7種のチャートを確認するため、撮影スクリプトの一時拡張（`scripts/_tmp_charts.mjs`、コミットしない）で各チャートタブをクリックして desktop/mobile を撮り、Read で目視（線が太すぎ・細すぎない、ラベルの重なりなし、予報部分の区別がつく）。

- [ ] Commit `feat: 空くらべのチャートを細線・意味色・淡いグリッドに刷新し、値表示を滑らかに`

---

### Task 4: 表と空しらべの操作パネル（担当: Sonnet）

**Files:** Modify `src/components/DailyRawTable.tsx`, `src/components/MonthsTable.tsx`（使用されている場合）, `src/components/weather/HistoricalWeatherTab.tsx`, `src/index.css`（`.glass-table` 系のみ）

1. **表（日別データスプレッドシート等）**:
   - 見出し行を `position: sticky; top: 0`（表コンテナがスクロール容器の場合はその中で固定。ページスクロールで固定する場合はヘッダー56px分 `top: 56px`）。見出しは `--surface-sunken`、`--ink-2` 0.75rem 600。
   - 本体は等幅数字、偶数行に `rgba(23,25,28,0.025)` の縞。ホバーは `--accent-soft`。罫線は横線のみ `--line`。
   - 左端の日付列が横スクロールで固定されている場合は維持し、右端に Task 5（第3段階）と同じ淡い影。
2. **空しらべの操作パネル**（現在地ボタン・地点 select・開始日 input・「から10日分を表示」）:
   - カード様式（`--surface-card`、`--radius-lg`、`--shadow-card`）。
   - 「現在地を表示」は `Button variant="secondary"`（MapPin アイコン）、地点 select と開始日 input は1行に並べ（375px では2行に折り返し可）、ラベル「開始日」は `--ink-2` 0.8rem 600、補足「から10日分を表示」は `--ink-3`。
   - ハンドラ・state・値の扱いは現行のまま。
3. 空しらべで流用している `DailyForecast` / `HourlyTable` は第3段階で刷新済みのため触らない。

**テスト:** 既存テストが通ること。撮影 `p4-tables` で 空しらべ（mobile/desktop）と空くらべ下部の表を目視。

- [ ] Commit `feat: データ表を見出し固定・縞模様に刷新し、空しらべの操作パネルを整える`

---

### Task 5: 総合検証と develop への取り込み（担当: コントローラー）

- [ ] `npm run test`・`npx tsc -b`・`npm run build`（メイン gzip を 428.29KB と比較）
- [ ] 撮影 `p4-final` を `p4-before` と比較
- [ ] 機能不変チェック（dev、ゲスト、Playwright 一時スクリプト可）: 比較対象の追加・削除・表示、日次⇔月次、全チャート種別、ズームボタン、空しらべの地点・開始日変更、pageerror なし
- [ ] 第4段階全差分を Sonnet レビュー → 指摘対応
- [ ] develop へ `--no-ff` マージ → test/build → push。main は指示待ち
- [ ] ユーザー実機確認依頼（空くらべのピンチ・スワイプ・タップ表示、比較対象の複数表示）
