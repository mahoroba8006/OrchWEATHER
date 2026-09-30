# アプリ全面リニューアル 第3段階「空もよう」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 空もようのカード群（注意報・日別予報・時間別予報・AIコメント）と読み込み・エラー表示を新デザインシステムで作り直す。情報・機能・操作は一切変えない。

**Architecture:** 各コンポーネントの**データ計算・状態・イベント処理は触らず、描画（JSX構造の見た目部分とスタイル）だけ**を置き換える。インラインの色直書きはトークン（`var(--ink-1)` 等）に置換する。起動時の演出は `src/lib/intro.ts` に一元化し、ヒーローとカードで共有する。予算確保のため、Leaflet を地図モーダルを開いた時だけ読み込む。

**Tech Stack:** React 19 / TypeScript / motion 13（`m.*` のみ）/ Vitest + Testing Library / Playwright 撮影

**仕様書:** [docs/superpowers/specs/2026-09-30-app-visual-redesign-design.md](../specs/2026-09-30-app-visual-redesign-design.md) §3「空もよう」「共通の小さな動き」

---

## 前提知識（実装者向け）

- 検証コマンド: `npm run test`（現在140件）、`npx tsc -b`、`npm run build`、撮影は dev サーバー（`npm run dev -- --port 5180 --strictPort`）起動中に `npm run screenshots -- <名前>`。撮影画像は Read ツールで必ず目視する。終わったら dev サーバーを停止（`netstat -ano | findstr :5180` → `taskkill //PID <pid> //F`）。
- デザイントークン（`src/index.css` `:root`）: 面 `--surface-ground/#F4F3EF` `--surface-card/#FFF` `--surface-sunken/#ECEAE4`、文字 `--ink-1/2/3`、線 `--line` `--line-strong`、アクセント `--accent` `--accent-press` `--accent-soft` `--accent-rgb`、影 `--shadow-card` `--shadow-raised`、角丸 `--radius-sm/md/lg/xl/pill`。互換エイリアス（`--accent-color`, `--text-primary` 等）は残っているが**新規コードでは新トークンを使う**。
- ばね: `src/lib/motion.ts` の `springs.press / move / enter`、`pressScale`。`motion.div` は禁止、`m.div` を使う。
- 既存部品: `src/components/ui/{Button,SegmentedControl,Sheet}.tsx`、テスト補助 `src/components/ui/testUtils.tsx`。
- **意味色は残す**: 気温（最高=暖色・最低=寒色）、降水の青、警報・注意報の色、UV色、ミニアイコンタグの配色（ヘルプ本文 `src/components/HelpPage.tsx` が「ティール色のタグ」「ピンク色のタグ」と説明している）。配色を変える場合は HelpPage の記述と矛盾しないこと。
- **ヘルプとの整合**: 見た目を変えた要素をヘルプが説明している場合（`grep -n "<要素名>" src/components/HelpPage.tsx`）、記述が事実と食い違わないようにする。食い違う場合は HelpPage の文言を最小限修正する。
- 変えてはいけないもの: 取得・計算ロジック、props のインターフェース、`scrollToHour` 等のスクロール連携、横スクロール同期、`IntersectionObserver` による既存の挙動、ARIA上の既存ラベル。
- `prefers-reduced-motion: reduce` では新規の動きをすべて無効化する（Motion は `MotionConfig reducedMotion="user"` 済み。CSS アニメは `@media` で止める）。

## ファイル構成

| ファイル | 種別 | 責務 |
|---|---|---|
| `src/components/settings/LocationSettings.tsx` | 変更 | `LocationMapModal` を `React.lazy` で遅延読み込み |
| `src/components/settings/LocationMapModal.tsx` | 変更 | `leaflet/dist/leaflet.css` をここで import |
| `src/main.tsx` | 変更 | `leaflet.css` の import を削除 |
| `src/lib/intro.ts` (+test) | 新規 | 「起動後初回の演出を再生済みか」の共有フラグ |
| `src/components/sky/SkyHero.tsx` | 変更 | モジュール内フラグを `intro.ts` に置換 |
| `src/components/ui/Skeleton.tsx` (+test) | 新規 | 淡く光る骨組み表示 |
| `src/components/ui/Reveal.tsx` (+test) | 新規 | 初回のみ順番に浮かび上がる包み |
| `src/components/ui/ui.css` | 変更 | Skeleton / shake のスタイル |
| `src/components/weather/WeatherTab.tsx` | 変更 | モード切替を SegmentedControl に、読み込み中を Skeleton に、エラーに揺れ、各セクションを Reveal で包む |
| `src/components/weather/HistoricalWeatherTab.tsx` | 変更 | モード切替を SegmentedControl に（同じ見た目） |
| `src/components/weather/JmaWarningSummary.tsx` | 変更 | 注意報の帯 |
| `src/components/weather/DailyForecast.tsx` | 変更 | 日別カード・気温レンジバー・選択印 |
| `src/components/weather/HourlyTable.tsx` | 変更 | 時間別の組版・現在時刻ハイライト・降水バー |
| `src/components/weather/AiCommentCard.tsx` / `AiComingSoonCard.tsx` | 変更 | AIコメントの見た目・ローディング・本文表示・スワイプ |

---

### Task 0: Leaflet の遅延読み込み（担当: Haiku）

**Files:** Modify `src/components/settings/LocationSettings.tsx`, `src/components/settings/LocationMapModal.tsx`, `src/main.tsx`

- [ ] **Step 1: ビルドして基準値を控える**

Run: `npm run build` → `dist/assets/index-*.js` の gzip 値（期待: 約 476KB）を控える。

- [ ] **Step 2: `src/main.tsx` から次の1行を削除**

```ts
import 'leaflet/dist/leaflet.css'
```

- [ ] **Step 3: `src/components/settings/LocationMapModal.tsx` の import 群の先頭付近（`import L from 'leaflet';` の直後）に追加**

```ts
import 'leaflet/dist/leaflet.css';
```

- [ ] **Step 4: `src/components/settings/LocationSettings.tsx` の import を置換**

変更前:
```ts
import { LocationMapModal } from './LocationMapModal';
```
変更後（React の import 行に `lazy, Suspense` を追加し、上記行を削除して以下を import 群の直後に置く）:
```ts
// 地図（Leaflet 約40KB gzip）は地図を開いた時だけ読み込む
const LocationMapModal = lazy(() =>
  import('./LocationMapModal').then(m => ({ default: m.LocationMapModal })),
);
```

- [ ] **Step 5: `LocationMapModal` を描画している箇所（2箇所以上ある場合は全て）を `Suspense` で包む**

```tsx
<Suspense fallback={null}>
  <LocationMapModal … />
</Suspense>
```

- [ ] **Step 6: 検証**

Run: `npx tsc -b` → エラーなし。`npm run test` → 140 passed。`npm run build` → `index-*.js` の gzip が Step 1 より **30KB 以上減る**こと、`LocationMapModal-*.js` が別チャンクとして出力されることを確認。

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/components/settings/LocationMapModal.tsx src/components/settings/LocationSettings.tsx
git commit -m "perf: 地図モーダル（Leaflet）を開いた時だけ読み込むよう遅延読み込み化"
```

---

### Task 1: 共通の演出部品（intro / Skeleton / Reveal / shake）（担当: Sonnet）

**Files:** Create `src/lib/intro.ts`, `src/lib/intro.test.ts`, `src/components/ui/Skeleton.tsx`, `src/components/ui/Skeleton.test.tsx`, `src/components/ui/Reveal.tsx`, `src/components/ui/Reveal.test.tsx`；Modify `src/components/ui/ui.css`, `src/components/sky/SkyHero.tsx`

**`src/lib/intro.ts`（完全なコード）:**

```ts
// 起動後初回だけ再生する演出（ヒーローのカウントアップ・カードの順次表示）の共有フラグ。
// タブ往復でアンマウント→再マウントしても再生しないよう、モジュールスコープで保持する。
let played = false;

export const hasIntroPlayed = (): boolean => played;
export const markIntroPlayed = (): void => { played = true; };
/** テスト専用 */
export const resetIntroForTest = (): void => { played = false; };
```

テスト: 初期 false → `markIntroPlayed()` 後 true → `resetIntroForTest()` で false。

**SkyHero:** 既存のモジュールスコープ `introPlayed` を `hasIntroPlayed()` / `markIntroPlayed()` に置き換える（挙動は同一。StrictMode 対策の「アニメ完了時に立てる」タイミングも維持）。既存の SkyHero テストが通ること。

**Skeleton** `({ width?: string | number; height?: string | number; radius?: string; className?: string })`:
- `div.ui-skeleton`、`aria-hidden="true"`。背景 `var(--surface-sunken)` に、白の半透明帯が左→右へ1.6秒周期で流れる（`::after` の `transform: translateX` アニメ）。reduced-motion では帯なしの静止。
- テスト: 指定幅・高さが style に反映、aria-hidden。

**Reveal** `({ index: number; children: ReactNode; className?: string })`:
- 初回演出中（`hasIntroPlayed() === false` の時点でマウントされた場合）のみ `m.div` で `initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}`、`transition={{ ...springs.enter, delay: 0.25 + index * 0.08 }}`。
- 判定はマウント時に1度だけ（`useState(() => !hasIntroPlayed())`）。演出しない場合は `m.div` の `initial={false}` で即表示。
- テスト: `resetIntroForTest()` 後に描画 → 子が描画される。`markIntroPlayed()` 後に描画 → 子が描画される（どちらも内容が出ることを確認。アニメの有無は `data-reveal="animate" | "static"` 属性で検証できるようにする）。

**shake（CSS）:** `ui.css` に `.ui-shake { animation: ui-shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }`、キーフレームは translateX で ±6px→±3px→0。reduced-motion で無効。

- [ ] 各テストを先に書いて失敗確認 → 実装 → 通過 → Commit `feat: 初回演出フラグ・骨組み表示・順次表示・揺れの共通部品を追加`

---

### Task 2: モード切替を SegmentedControl に統一（担当: Sonnet）

**Files:** Modify `src/components/weather/WeatherTab.tsx`, `src/components/weather/HistoricalWeatherTab.tsx`

- 現在の「リスクでみる／概況でみる」の2ボタン（ピンク／ティールのインライン配色、第1段階で `whiteSpace/flexShrink` を追加済み）を `SegmentedControl`（`variant="pill"`）に置き換える。
  - `options = [{ value: 'severity', label: 'リスクでみる' }, { value: 'frequency', label: '概況でみる' }]`、`value={weatherCodeMode}`、`onChange={updateWeatherCodeMode}`（既存の関数をそのまま）、`ariaLabel="天気アイコンの表示基準"`、`layoutId` は画面ごとに一意（`"weather-code-mode"` / `"history-code-mode"`）。
  - 右側の説明文（「時間帯でいちばん悪い天気を表示」等）は残し、`color: var(--ink-3)`、0.75rem。
- HelpPage に「リスクでみる」「概況でみる」の配色（ピンク/ティールのボタン）に言及があれば、事実に合わせて文言を最小修正する（ミニアイコンタグの配色説明は DailyForecast 側なので触らない）。
- テスト: 既存テストが通ること。撮影で1行に収まっていることを確認（375px）。

- [ ] 実装 → `npm run test`・`npx tsc -b` → Commit `feat: 天気アイコンの表示基準切替を滑るセグメントに統一`

---

### Task 3: 注意報の帯（担当: Sonnet）

**Files:** Modify `src/components/weather/JmaWarningSummary.tsx`（必要なら `WarningBar.tsx` は**触らない**。ガントバーは日別予報側の別機能）

- 現行の構造・表示情報（種別・発表状況・期間・並び順・「注意情報はありません」等の空表示の有無）を**読み取ってから**、見た目だけ置き換える。表示件数や文言は変えない。
- デザイン:
  - 発表中の項目があるとき: カード面（`--surface-card`、`--radius-lg`、`--shadow-card`）の中に、各項目を1行の「帯」で表示。左端に 4px の意味色バー（警報=赤系、注意報=黄〜橙系：**既存の色値を流用**）、種別名は `--ink-1` 600、期間は `--ink-2` 等幅数字。
  - 登場時: 意味色バーが `scaleX` 0→1（`transform-origin: left`、`springs.move`）で一度だけ伸びる。
  - 警報（注意報ではない）項目のみ、意味色バーの opacity を 1→0.45→1 で**3回だけ**脈動（CSS `animation-iteration-count: 3`、1.2秒周期）。
  - 発表中の項目がないときの既存表示は、`--ink-3` の控えめな1行（アイコン＋文言）に。
  - 読み込み中表示がある場合は `Skeleton`（高さ 44px）に置換。
- reduced-motion: 伸び・脈動なし。
- テスト（新規 `JmaWarningSummary.test.tsx`）: 既存の型（`result` の形は `src/api/jmaWarning.ts` を参照）に沿ったフィクスチャで、①警報1件＋注意報1件 → 2行とも名前が表示、警報行に `data-level="warning"` が付く、②0件 → 既存の空表示文言が出る。

- [ ] テスト → 実装 → 撮影（`phase3-warn`。ゲスト東京で注意報が無い場合は空表示のみ確認で可）→ Commit `feat: 注意報を意味色バーの帯表示に刷新`

---

### Task 4: 日別予報（担当: Sonnet）

**Files:** Modify `src/components/weather/DailyForecast.tsx`

**現状（読んで把握すること）:** 横スクロールする日ごとの列（各日に午前/午後/夜間の3セル、`PERIOD_W=50`）、日ヘッダー（「今日 9/30(水) 21/18」）、各セルに天気ラベル・アイコン・ミニアイコンタグ・降水確率・風速、下部に `DailyMiniChart`（気温線・降水棒）、注意報ガントバー、セルタップで `onHalfDayClick(date, period)`。

**変えること（見た目のみ）:**
1. **日ヘッダー**: 日付を `--ink-1` 600、今日は「今日」を `--accent` で。最高/最低の数字（既存の暖色・寒色）に加え、ヘッダー下に**気温レンジバー**を追加: 表示期間全体の最低〜最高を横幅いっぱいとし、その日の最低〜最高の区間を、寒色→暖色のグラデーション（`TEMP_MIN_COLOR`→`TEMP_MAX_COLOR`）の丸い棒（高さ4px、`--surface-sunken` のレール上）で示す。期間全体の min/max は `daily` の非 placeholder 日から算出。placeholder 日はバーなし。
2. **区切り**: 日と日の間は 1px `--line` の縦線。ヘッダーの淡い色付き背景（青/緑の角丸ボックス）は廃止し、今日の列だけ `--accent-soft` の背景で区別。午前/午後/夜間ラベルは `--ink-3` 0.7rem の小見出し（色付きピル背景を廃止）。
3. **選択印**: セルをタップしたとき（`onHalfDayClick` を呼ぶ既存処理はそのまま）、タップされたセルに `m.span layoutId="daily-selected"` の角丸枠（`--accent` 1.5px の内側線、背景 `--accent-soft`）が滑って移動する。選択状態はこのコンポーネント内の `useState<{ date: string; period: 'am'|'pm'|'night' } | null>` で持つ（新たな props は追加しない）。
4. **押下感**: セルに `whileTap={{ scale: pressScale }}`（`springs.press`）。
5. **色のトークン化**: このファイル内の UI 用ハードコード色（枠線・背景・文字のグレー／ティール系）を新トークンへ。意味色（降水確率の `probColor`、気温色、ミニアイコンタグの配色、ガントバー）は維持。

**変えないこと:** 列幅・横スクロール・`IntersectionObserver` の挙動・ミニチャートの座標計算・ガントバー・`onHalfDayClick` の呼び出し。

**テスト（新規 `DailyForecast.test.tsx`）:** `daily` フィクスチャ3日分（1日は `isPlaceholder`）で ①非 placeholder 日のレンジバーが2本（`[data-testid="temp-range"]`）、②レンジバーの left/width が期間全体に対する比率（例: 全体 10〜30℃、ある日 15〜25℃ → left 25%, width 50%）、③セルクリックで `onHalfDayClick` が `(date, 'am')` で呼ばれ、選択印が1つ描画される。

- [ ] テスト → 実装 → 撮影（`phase3-daily`、モバイル・PC）で目視 → Commit `feat: 日別予報に気温レンジバーと滑る選択印を追加し、区切りと配色を刷新`

---

### Task 5: 時間別予報（担当: Sonnet）

**Files:** Modify `src/components/weather/HourlyTable.tsx`

**現状:** 左に固定のラベル列（`LABEL_W=76`）、右に横スクロールする時間列（`COL_W=42`）。行: 日付、時刻（日の出・日の入り挿入列あり）、天気、気温/降水ミニチャート、紫外線、数値行（気温・降水確率・降水量・風速・瞬間風速・風向き・気圧・湿度・飽差・露点・CAPE・0℃層高度）、過去時間は薄く表示（`disablePastOpacity`）、`hiddenRowKeys` で行の表示切替、`scrollTarget` でスクロール。

**変えること（見た目のみ）:**
1. **罫線**: セルの格子線を廃止し、行の間だけ 1px `--line`。ラベル列は背景 `--surface-card`、右端に 1px `--line-strong`（スクロール時に内容が下を通るのが分かるよう、右側に 8px の淡い影 `linear-gradient(to right, rgba(23,25,28,.06), transparent)` を疑似要素で）。
2. **文字**: ラベルは `--ink-2` 0.78rem 600、単位は `--ink-3` 0.65rem。数値は等幅数字、`--ink-1`。過去時間の薄さは現行の仕組みを維持。
3. **現在時刻の列**: 現在時刻（`currentHourIndex` 相当。`src/lib/sky.ts` の `currentHourIndex(hourly, new Date())` を利用可）の列全体に、上端から下端まで `--accent-soft` の縦帯を敷き、時刻セルは `--accent` 600 で「今」の小ラベルを添える。
4. **降水量**: 降水量行の各セルで、数値の下に `--chart-precip` 系の淡い青（opacity .35）の縦棒をセル下端から敷く。高さは `min(1, mm / 10)` × セル高さの 70%（10mm 以上は上限）。0mm は棒なし。
5. **日付行**: 日付の切り替わり列に `--ink-1` 600 の日付表記、その他は空。淡い色付き角丸ボックス背景は廃止。
6. **色のトークン化**: UI用の固定色をトークンへ。意味色（UV色・日の出/日の入りの橙・気温線色）は維持。

**変えないこと:** 列幅・行の順序と表示条件・スクロール同期・`scrollTarget`・ミニチャートの座標・`hiddenRowKeys`。

**テスト（新規 `HourlyTable.test.tsx`、既存の props 型に沿ったフィクスチャ）:** ①降水量 5mm のセルに高さ比 0.35（=5/10×0.7）の棒（`data-testid="precip-bar"` の style.height が `35%`）、0mm は棒なし、②現在時刻の列に `data-current="true"` が1列だけ付く（`vi.setSystemTime` で時刻固定）。

- [ ] テスト → 実装 → 撮影（`phase3-hourly`）で目視（375px で左ラベル列と数値が詰まりすぎていないか）→ Commit `feat: 時間別予報の組版を刷新し、現在時刻の縦帯と降水量バーを追加`

---

### Task 6: AIコメント（担当: Sonnet）

**Files:** Modify `src/components/weather/AiCommentCard.tsx`, `src/components/weather/AiComingSoonCard.tsx`（必要なら `src/index.css` の AI 関連キーフレーム）

**現状（読んで把握すること）:** セクションのタブバー（横スクロール、`.ai-tab-bar`）、スワイプでセクション切替（`slide-in-left/right` クラス）、生成中のローディング演出（`iconWaveBounce` / `dotPulse`）、脚注。ゲストや許可外ユーザーは `AiComingSoonCard`。

**変えること:**
1. **カード**: 見出し「空のアドバイス」系のタイトル行を `--ink-1` 600、アイコンは `--accent`。本文は 0.92rem、行間 1.9、`--ink-1`。
2. **タブバー**: 既存のタブを `SegmentedControl`（`variant="underline"`, `layoutId="ai-section"`）に置換。横スクロールが必要な幅では、コンテナで `overflow-x: auto`（スクロールバー非表示の既存 `.ai-tab-bar` を流用）。
3. **スワイプ**: 既存のスワイプ判定ロジックは維持し、切替時の CSS クラスアニメ（`slide-in-*`）を `AnimatePresence mode="popLayout"` + `m.div`（`custom` に方向、`initial={{ x: dir*40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -dir*40, opacity: 0 }}`、`springs.move`）に置き換える。**指に追従させる実装は既存ロジックとの競合リスクが高いため今回は行わない**（仕様の「指に追従」は将来課題として報告に記載）。
4. **本文の表示**: 生成完了で本文が現れる時、段落（または改行区切りの行）ごとに `opacity 0→1, y 6→0` を 0.05 秒ずつずらして表示（`springs.enter`）。キャッシュから即時表示の場合も同じでよい。
5. **ローディング**: 現行の演出を、空モチーフに置換: 3つの小さな雲（`WeatherIcon code={3}` など既存アイコンの流用、または CSS の丸の集合）が左右から中央に寄ってきて重なり、下に「空を読んでいます」＋ `dotPulse` の点。文言が現行にある場合は現行の文言を使う。reduced-motion では静止。
6. **ComingSoon カード**: 同じカード様式に揃える（`--surface-card`、見出し、本文 `--ink-2`）。文言は変えない。

**変えないこと:** データ取得・キャッシュ・セクション定義・スワイプ判定の閾値・脚注の文言。

**テスト:** 既存テストがあれば通すこと。新規に `AiCommentCard.test.tsx` で ①タブが `role="tab"` で並び選択中が `aria-selected="true"`、②別タブクリックで表示セクションが切り替わる（本文テキストの変化で確認）、③ローディング中にローディング文言が表示される。props はファイル内の型に従ってフィクスチャを作る。

- [ ] テスト → 実装 → 撮影（ゲストでは ComingSoon のみ表示されるため、その確認）→ Commit `feat: AIコメントのタブ・切替・本文表示・ローディングを刷新`

---

### Task 7: WeatherTab の読み込み・エラー・順次表示（担当: Sonnet）

**Files:** Modify `src/components/weather/WeatherTab.tsx`

- **読み込み中**（`loading && !data` の現行ブロック。`Loader2` の回転と `loadingStatus` の文言）: 回転アイコンをやめ、`Skeleton` で「日別カード（高さ 280px）」「時間別（高さ 360px）」の2枚の骨組みを `--radius-lg` で並べ、その上に `loadingStatus` の文言を `--ink-3` で残す。
- **エラー**（`error &&` のブロック）: カード様式（`--surface-card`、左に 4px の赤系バー、文字 `--ink-1`）にし、`key={error}` を付けた要素に `ui-shake` クラスを付けて、エラー文言が変わるたびに1回揺れる。色は既存の赤系の値を流用。
- **順次表示**: ヒーロー下の主要セクション（注意報、日別予報、時間別予報、AIコメント／ComingSoon）をそれぞれ `<Reveal index={0..3}>` で包む。既存の ref（`hourlySectionRef`, `aiSectionRef` 等）は Reveal の**内側**の既存要素に付いたままにする（ref の付け替えをしない）。
- 地点未登録・geo取得中の早期 return 表示の `Loader2` も `Skeleton`（幅 60%・高さ 20px を2本）に置換し、文言は残す。

- [ ] 実装 → `npm run test`・`npx tsc -b` → 撮影（`phase3-final`）で目視 → Commit `feat: 空もようの読み込みを骨組み表示に、エラーに揺れ、カードの順次表示を追加`

---

### Task 8: 総合検証と develop への取り込み（担当: コントローラー）

- [ ] `npm run test`・`npx tsc -b`・`npm run build`（gzip を 476.32KB と比較し記録。Task 0 の削減で基準 426.86KB からの累計増加が 50KB 未満であること）
- [ ] 撮影 `phase3-final` を `phase2-final` と比較（モバイル・PC、空もよう全体・スクロール後）
- [ ] 機能不変チェック（dev、ゲスト）: モード切替／日別セルタップ→時間別スクロール／時間別の横スクロール／更新・現在地
- [ ] 第3段階全差分を Sonnet レビュー → 指摘対応
- [ ] develop へ `--no-ff` マージ → test/build → push。main は指示待ち
- [ ] ユーザー実機確認依頼（ログイン時: AIコメントのタブ・スワイプ・ローディング、注意報が出ている地点での帯と脈動）
