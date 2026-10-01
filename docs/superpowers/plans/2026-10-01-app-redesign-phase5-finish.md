# アプリ全面リニューアル 第5段階「仕上げ」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定シートの中身・ログイン画面・ヘルプ・LP を新デザインに揃え、互換エイリアスと直書きの旧配色を撤去してデザインシステムを一本化する。機能は一切変えない。

**Architecture:** Task 1 で旧変数名を新トークンへ機械置換しエイリアスを削除（以後、旧名は使えない＝再発防止）。Task 2〜4 で残る画面を部品（Button / SegmentedControl / 新設 Toggle・SaveButton）で作り直す。

**Tech Stack:** React 19 / TypeScript / motion 13（`m.*` のみ）/ Vitest / Playwright 撮影

**仕様書:** [docs/superpowers/specs/2026-09-30-app-visual-redesign-design.md](../specs/2026-09-30-app-visual-redesign-design.md) §2「ログイン画面」、§3「設定（シート内）」「共通の小さな動き（トグル）」、§4 段階5

---

## 前提知識（実装者向け）

- 検証: `npm run test`（現在157件）、`npx tsc -b`、`npm run build`。撮影は dev サーバー（`npm run dev -- --port 5180 --strictPort`）起動中に `npm run screenshots -- <名前>`（`-5-settings` `-6-help` を含む）。画像は Read ツールで目視。終了時に停止（`netstat -ano | findstr :5180` → `taskkill //PID <pid> //F`）。
- トークン: 面 `--surface-ground/card/sunken`、文字 `--ink-1/2/3`、線 `--line/--line-strong`、アクセント `--accent/--accent-press/--accent-soft/--accent-rgb`、影 `--shadow-card/--shadow-raised`、角丸 `--radius-sm/md/lg/xl/pill`、書体 `--font-sans`。
- 部品: `src/components/ui/{Button,SegmentedControl,Skeleton,Reveal,Sheet,ErrorBoundary}.tsx`、空: `src/lib/sky.ts`（`skyPalette`）、`src/components/sky/SkyParticles.tsx`。ばね `src/lib/motion.ts`。
- **Firestore 書き込みの安全規約**: 保存処理は `await` + `try/catch` + UI フィードバック必須（fire-and-forget 禁止）。既存の保存処理の構造・エラー表示は維持する。
- ゲストは設定の中身（地点・天気情報・空のアドバイス・空くらべ）を見られない。ログイン時の画面は撮影できないため、**コンポーネント単体のテストと、テスト用の一時ハーネス（`scripts/_tmp_*` / 一時ページ。コミットしない）で目視**する。

---

### Task 1: 互換エイリアスの撤去と旧配色の一掃（担当: Haiku）

**Files:** Modify `src/**/*.{tsx,ts,css}`（`src/index.css` 含む）、`index.html`、`vite.config.ts`、`src/designTokens.test.ts`

- [ ] **Step 1: 失敗するテストを追加**（`src/designTokens.test.ts` の末尾に追加）

```ts
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LEGACY = [
  '--accent-color', '--accent-hover', '--accent-light', '--text-primary', '--text-secondary',
  '--text-tertiary', '--card-bg', '--card-bg-solid', '--card-border', '--card-border-hover',
  '--card-border-sub', '--bg-gradient', '--bg-color', '--shadow-sm', '--shadow-md', '--shadow-lg',
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(name) ? [p] : [];
  });

describe('legacy token aliases are gone', () => {
  it('no source file references a legacy variable name', () => {
    const offenders: string[] = [];
    for (const file of walk(resolve(process.cwd(), 'src'))) {
      if (file.endsWith('designTokens.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const name of LEGACY) {
        if (new RegExp(`${name}(?![-\\w])`).test(text)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

（`readFileSync` と `resolve` は同ファイル冒頭で import 済み。重複 import にならないよう既存の import 行に追記する。）

既存テスト `keeps legacy variable names as aliases to the new tokens` は**削除**する。

Run: `npx vitest run src/designTokens.test.ts` → 新テストが FAIL（多数の offenders）

- [ ] **Step 2: 一時スクリプトで機械置換**（`scripts/_tmp_migrate.mjs`、実行後に削除）

対象: `src` 配下の全 `.ts/.tsx/.css`（`designTokens.test.ts` を除く）。各ファイルに次の置換を**この順で**適用（`(?![-\w])` で後続がハイフン・英数字でないことを保証）:

| 旧 | 新 |
|---|---|
| `--card-bg-solid` | `--surface-card` |
| `--card-bg` | `--surface-card` |
| `--card-border-hover` | `--line-strong` |
| `--card-border-sub` | `--line` |
| `--card-border` | `--line` |
| `--bg-gradient` | `--surface-ground` |
| `--bg-color` | `--surface-ground` |
| `--accent-color` | `--accent` |
| `--accent-hover` | `--accent-press` |
| `--accent-light` | `--accent-soft` |
| `--text-primary` | `--ink-1` |
| `--text-secondary` | `--ink-2` |
| `--text-tertiary` | `--ink-3` |
| `--shadow-sm` | `--shadow-card` |
| `--shadow-md` | `--shadow-card` |
| `--shadow-lg` | `--shadow-raised` |

**注意**: `var(--accent-color, #xxx)` のようなフォールバック付きも同様に置換される（値は変えない）。改行コード（CRLF/LF）はファイルごとに保持すること（読み込んだ文字列をそのまま置換して書き戻す）。

- [ ] **Step 3: `src/index.css` の `:root` から互換エイリアス定義を削除**

`/* ── 互換エイリアス（既存コンポーネント用・第5段階で撤去） ── */` のブロックのうち、上表の旧名の**定義行**（Step 2 の置換で `--surface-card: var(--surface-card);` のような自己参照行に変わっているはず）をすべて削除する。`--accent-blue` / `--accent-blue-hover` / `--accent-blue-light` / `--grid-color` は**実体のあるトークンとして残し**、コメントを `/* ── 補助色（情報・グリッド） ── */` に変更する。

- [ ] **Step 4: 直書きの旧ティール色を置換**（LP を除く）

`grep -rn "13, *148, *136\|#0d9488\|#0f766e" src --include=*.tsx | grep -v LandingPage` の各箇所:
- `#0d9488` → `var(--accent)`、`#0f766e` → `var(--accent-press)`
- `rgba(13,148,136,X)` / `rgba(13, 148, 136, X)` → `rgba(var(--accent-rgb), X)`

ただし `LoginScreen.tsx` は Task 3 で作り直すので、ここで置換してよい（Task 3 で上書きされても問題ない）。

- [ ] **Step 5: テーマ色の更新**

- `index.html` の `<meta name="theme-color" content="#51c49f" />` → `content="#0E6B65"`
- `vite.config.ts` の manifest: `background_color: '#f0f4f8'` → `'#F4F3EF'`、`theme_color: '#51c49f'` → `'#0E6B65'`

- [ ] **Step 6: 検証**

`npx vitest run src/designTokens.test.ts` → PASS。`npm run test` → 全件 PASS（旧エイリアステスト1件削除・新テスト1件追加で件数は157のまま）。`npx tsc -b`、`npm run build` 成功。撮影 `p5-tokens` を `p4-final`（なければ最新）と比較し、**見た目が変わっていないこと**（同値の置換のため）を確認。

- [ ] **Step 7: Commit**

```bash
git add -A src index.html vite.config.ts
git commit -m "refactor: 互換エイリアスを撤去して新トークンへ一本化し、旧ティール色とテーマ色を更新"
```

---

### Task 2: 設定シートの中身（担当: Sonnet）

**Files:** Modify `src/components/settings/{SettingsTab,LocationSettings,JmaWarningSettings,AiCommentSettings,AnalysisSettings}.tsx`、`src/index.css`（`.settings-subtab-btn` 削除）；Create `src/components/ui/Toggle.tsx`, `src/components/ui/SaveButton.tsx` と各テスト

**新設部品:**

`Toggle` `({ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; describedBy?: string })`
- `button role="switch" aria-checked`、44×28 のトラック（off: `--surface-sunken` + `--line-strong` 枠 / on: `--accent`）、つまみ 22px 白丸が `m.span layout`（`springs.press`）で左右に移動。`label` は視覚的に隣接表示（`<label>` 相当）し、クリックでも切替。
- テスト: クリックで `onChange(!checked)`、`aria-checked` 反映、disabled で呼ばれない、Space/Enter で切替。

`SaveButton` `({ onClick: () => void | Promise<void>; saving: boolean; saved: boolean; disabled?: boolean; children?: ReactNode })`
- **状態は親が持つ**（既存の保存 state をそのまま渡す）。表示: 通常「保存」（children）／`saving` 中はボタン内に小さな Skeleton 風の脈動＋「保存中…」／`saved` が true の間は、チェックマーク（`m.path` の `pathLength` 0→1、`springs.enter`）＋「保存しました」。
- 見た目は `Button variant="primary"` を内部で使用。
- 既存画面に「保存しました」状態が無い場合は、親側に `saved` を立てる最小の state（成功時 true → 2秒後 false の `setTimeout`、アンマウントでクリア）を追加してよい。**エラー時の既存表示・処理は変えない**。
- テスト: saving / saved / 通常 の各表示文言、クリックで onClick。

**各画面:**
1. `SettingsTab`: サブタブ（地点設定／天気情報／空のアドバイス／空くらべ）を `SegmentedControl variant="underline"`（`layoutId="settings-subtab"`、`ariaLabel="設定の項目"`、横スクロール容器 `.ai-tab-bar`）に。`.settings-subtab-btn` クラスとその CSS ルールを削除。モバイルのアカウント欄（アバター・ログアウト）は行の様式を整える（アバター 36px、名前 `--ink-1`、ログアウトは `Button variant="ghost"`）。
2. 4つの設定画面共通:
   - セクション見出し `--ink-1` 0.95rem 600、説明 `--ink-3` 0.8rem。カード（`--surface-card`、`--radius-lg`、`--shadow-card`）でセクションを区切る。
   - ピンク系の「保存」「手動で追加」「現在地で登録」「マップから選ぶ」等のボタン（第109回でピンク統一した経緯あり）→ 主操作は `Button variant="primary"`、副操作は `variant="secondary"`。保存は `SaveButton`。
   - on/off のチェックボックス（例: 注意報の種別、AIのセクション）→ `Toggle`。複数選択の意味が変わらないこと（同じ state を同じ値で更新する）。
   - 入力欄・select はグローバルスタイル（第1段階で平坦化済み）に任せ、インラインの旧色を削除。
3. `LocationSettings` の地点リスト: 各行を `m.li layout`（`springs.move`）にし、`AnimatePresence` で追加時 `opacity 0→1, y -6→0`、削除時 `opacity→0, height→0`。並べ替え機能がある場合は、並べ替え時に行が滑って移動する（`layout` で自動）。削除確認ダイアログ（ポータル化済み）は `.modal-content` 様式に揃え、「削除」ボタンは危険色（既存の赤系）で `Button` の className 上書き。

**検証:** 新規部品のテスト、`npm run test`・`npx tsc -b`・`npm run build`。ゲストでは中身が見えないため、一時ハーネス（`src/_tmp_harness.tsx` + 一時の dev ルート、または Playwright で `localStorage` を操作しても見えない場合は、Vitest + `@testing-library/react` の render 結果を `screen.debug` ではなく **Playwright で一時 HTML を開く**方法）で4画面の見た目を 375px で撮影し目視。ハーネスは削除してからコミット。

- [ ] Commit（部品と画面で2コミット推奨）`feat: トグルと保存ボタンの共通部品を追加` / `feat: 設定シートの中身を新デザインに刷新（下線タブ・トグル・保存のチェック演出・地点リストの滑らかな増減）`

---

### Task 3: ログイン画面とヘルプ（担当: Sonnet）

**Files:** Modify `src/components/LoginScreen.tsx`, `src/components/HelpPage.tsx`

1. **ログイン画面**: 背景はフルスクリーンの夜明けの空（`skyPalette('dawn', 'clear')` の上→下グラデーション）＋ `SkyParticles weather="clear" isNight={false}`（太陽の光のにじみ）。中央に白いカード（`--surface-card`、`--radius-xl`、`--shadow-raised`、幅 min(400px, 100% - 32px)）。アプリアイコン・アプリ名・既存の説明文・Google ログインボタン・その他既存要素を同じ順で配置。ボタンは `Button`（Google ボタンは白地＋枠の `secondary` で既存のロゴ・文言を維持）。エラー表示は既存の文言・条件のまま、カード内で `ui-shake`。登場時、カードを `springs.enter` で下から 16px フェードアップ。**認証処理・リダイレクト処理・ゲスト導線には触れない。**
2. **ヘルプ**（シート内表示）: 見出し階層を `h2 --ink-1 1.05rem 700` / `h3 --ink-1 0.92rem 600`、本文 `--ink-2` 0.88rem 行間 1.8、セクション間 24px。表（`.glass-table`）は現行のまま。残る旧ティール直書きは Task 1 で置換済みか確認。**文言は変えない**（ただし本リニューアルで事実と異なった記述があれば最小修正し、報告に列挙）。ヘルプ本文で UI の色や形を説明している箇所を全て確認し、現在の見た目と食い違う記述を列挙・修正する（例: ボタンの色名、タブの形）。

**検証:** ログイン画面はゲストモードを解除した状態（`localStorage` に guestMode なし）で LP の「ログイン」導線から表示されるか確認し、撮影（一時スクリプト）。ヘルプは `-6-help` の撮影で確認。

- [ ] Commit `feat: ログイン画面を夜明けの空に、ヘルプの組版を刷新`

---

### Task 4: LP との統一（担当: Sonnet）

**Files:** Modify `src/landing.css`, `src/components/LandingPage.tsx`（最小限）, `src/index.css`（フォント import）

- LP は 2026-07-21 に「スクロールで晴れていく空」として刷新済み。**構成・文言・演出は変えない。** 統一するのは次の2点のみ:
  1. 書体: `landing.css` の `font-family: 'Outfit', 'Inter', …` を `var(--font-sans)` に。`src/index.css` の Google Fonts import から `Outfit` と `Inter` を削除（`IBM Plex Sans JP` のみ）。
  2. アクセント: LP 内のティール直書き（`#0d9488` / `#0f766e` / `rgba(13,148,136,…)` 等、`landing.css` と `LandingPage.tsx`）を `var(--accent)` / `var(--accent-press)` / `rgba(var(--accent-rgb), …)` に置換。LP 独自のグラデーション背景（空の色）はそのまま。
- 書体変更で見出しの折り返しや幅が変わるため、撮影で全セクションを確認し、崩れ（不自然な改行・はみ出し・重なり）があれば `letter-spacing` / `font-size` / `max-width` の微調整で直す。
- 撮影: ゲスト解除状態で LP をフルページ撮影（一時スクリプト、375px と 1280px）。変更前（着手前に撮る）と比較。

- [ ] Commit `feat: LPの書体とアクセント色をアプリ本体と統一`

---

### Task 5: 総合検証・全体レビュー・取り込み（担当: コントローラー）

- [ ] `npm run test`・`npx tsc -b`・`npm run build`（メイン gzip を 429.27KB と比較）
- [ ] 撮影 `p5-final`（全タブ・スクロール・設定・ヘルプ）＋ LP・ログイン画面
- [ ] 第5段階の差分レビュー（Sonnet）→ 指摘対応
- [ ] リニューアル全体（`6e1c22f..HEAD`）の最終レビュー（機能不変の観点で横断的に。Sonnet）
- [ ] develop へ `--no-ff` マージ → test/build → push
- [ ] ユーザー実機確認（ログイン時の設定4画面: トグル・保存演出・地点の追加削除・地図、ログイン画面、LP）→ OK なら main 反映の指示を仰ぐ
