# アプリ全面リニューアル 第1段階「土台」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新デザインシステム（トークン・書体・モーション・共通部品）と、見た目を自動撮影する検証基盤を導入する。画面は「色と書体が変わる」程度の変化にとどめ、機能は一切変えない。

**Architecture:** `src/index.css` の `:root` に新トークンを定義し、既存の変数名（`--accent-color` 等）は新トークンへの**互換エイリアス**として残す（既存コンポーネントが無改修で新配色になる。エイリアスは第5段階で撤去）。モーションは `motion` ライブラリを `LazyMotion`（strict）＋`m` コンポーネントで使い、ばね定義は `src/lib/motion.ts` に一元化。共通部品は `src/components/ui/` に置く（第2段階で使用開始）。

**Tech Stack:** React 19 / Vite 8 / TypeScript / Vitest 3 + Testing Library / motion 13 / Playwright（開発依存・撮影専用）

**仕様書:** [docs/superpowers/specs/2026-09-30-app-visual-redesign-design.md](../specs/2026-09-30-app-visual-redesign-design.md)

---

## 前提知識（実装者向け）

- テストは `npm run test`（`vitest run src`、jsdom）。既存44件。
- ビルドは `npm run build`（`tsc -b && vite build`）。
- ゲストモードは `localStorage.guestMode = '1'` で有効化され、ログインなしでアプリ本体（空もよう／空くらべ／空しらべ）が表示される。撮影はこれを使う。
- Firebase 初期化に `.env` が必要。worktree には gitignore のため存在しないので、Task 1 でコピーする。
- **CSP（`public/_headers`）は `fonts.googleapis.com` / `fonts.gstatic.com` を許可済み**。フォント追加に CSP 変更は不要。
- LP（`src/components/LandingPage.tsx` + `src/landing.css`）は `font-family: 'Outfit', 'Inter'` を使っている。**LPは対象外**なので Outfit/Inter の読み込みは残す。
- 設定画面の `.settings-theme` と `--settings-*` トークン、その回帰テスト `src/settingsTheme.test.ts` は第2段階（シート化）で撤去する。**第1段階では触らない。**
- `motion` は `import { m, LazyMotion, ... } from 'motion/react'`。`LazyMotion strict` の配下で `motion.div` を使うとエラーになる。必ず `m.div` を使う。

## ファイル構成

| ファイル | 種別 | 責務 |
|---|---|---|
| `scripts/screenshots.mjs` | 新規 | ゲストモードで主要3タブを 375px/1280px で全画面撮影 |
| `src/lib/contrast.ts` | 新規 | WCAG コントラスト比計算（第2段階の空パレット検証でも使う） |
| `src/lib/contrast.test.ts` | 新規 | 上記のテスト |
| `src/index.css` | 変更 | 新トークン・互換エイリアス・書体・グローバル要素の平坦化 |
| `src/designTokens.test.ts` | 新規 | トークン存在とガラス/グラデーション撤去の回帰テスト、文字色コントラスト検証 |
| `src/lib/motion.ts` | 新規 | ばね3種・押下縮小率の定義 |
| `src/components/ui/MotionProvider.tsx` | 新規 | LazyMotion(strict, domMax) + MotionConfig(reducedMotion="user") |
| `src/main.tsx` | 変更 | App を MotionProvider で包む |
| `src/components/ui/ui.css` | 新規 | 共通部品のスタイル |
| `src/components/ui/Button.tsx` | 新規 | 押下で沈むボタン（primary/secondary/ghost） |
| `src/components/ui/SegmentedControl.tsx` | 新規 | 選択ハイライトが滑るタブ（pill/underline） |
| `src/components/ui/Sheet.tsx` | 新規 | 下から出るシート／右から出るパネル |
| `src/components/ui/testUtils.tsx` | 新規 | テスト用 render ラッパー（MotionProvider + アニメ無効化） |
| `src/components/ui/*.test.tsx` | 新規 | 各部品のテスト |
| `.gitignore` | 変更 | `screenshots/` を除外 |
| `package.json` | 変更 | `motion` / `playwright` 追加、`screenshots` スクリプト追加 |

> トグル・骨組み表示（スケルトン）は、使用箇所ができる第3・第5段階で作る（YAGNI）。

---

### Task 1: worktree 作成とベースライン記録

**Files:** なし（環境準備のみ）

- [ ] **Step 1: worktree を作成**

リポジトリ本体（`c:/dev/気象アプリ`）で実行:

```bash
git worktree add .worktrees/app-redesign -b feature/app-redesign develop
cp .env .worktrees/app-redesign/.env
cp .dev.vars .worktrees/app-redesign/.dev.vars 2>/dev/null || true
cd .worktrees/app-redesign && npm install
```

以降の Task はすべて `.worktrees/app-redesign` 内で実行する。

- [ ] **Step 2: ベースラインのテストとビルド**

```bash
npm run test
npm run build
```

Expected: テスト 44 passed。ビルド成功。ビルド出力の `dist/assets/index-*.js` の **gzip サイズを控える**（例: `index-xxxx.js  1,234.56 kB │ gzip: 345.67 kB`）。Task 10 で増加量を比較する。

---

### Task 2: Playwright による撮影スクリプト

**Files:**
- Create: `scripts/screenshots.mjs`
- Modify: `package.json`（devDependencies と scripts）
- Modify: `.gitignore`

- [ ] **Step 1: Playwright を導入**

```bash
npm install -D playwright
npx playwright install chromium
```

- [ ] **Step 2: `.gitignore` の末尾に追記**

```gitignore

# デザイン検証用スクリーンショット（scripts/screenshots.mjs の出力）
screenshots/
```

- [ ] **Step 3: `scripts/screenshots.mjs` を作成**

```js
// デザイン検証用: ゲストモードで主要タブを撮影する。
// 使い方: 別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動しておき、
//         `npm run screenshots -- <出力ディレクトリ名>` を実行する。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5180';
const outDir = join('screenshots', process.argv[2] ?? 'current');

const viewports = [
  { name: 'mobile', viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true },
  { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: false },
];
const tabs = ['空もよう', '空くらべ', '空しらべ'];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: vp.viewport,
      deviceScaleFactor: vp.deviceScaleFactor,
      hasTouch: vp.hasTouch,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });
    await context.addInitScript(() => {
      window.localStorage.setItem('guestMode', '1');
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    for (const [i, label] of tabs.entries()) {
      await page.getByRole('button', { name: label }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500); // 描画・アニメーション完了待ち
      const file = join(outDir, `${vp.name}-${i + 1}-${label}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`saved ${file}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
```

- [ ] **Step 4: `package.json` の `scripts` に追加**

```json
"screenshots": "node scripts/screenshots.mjs"
```

- [ ] **Step 5: ベースラインを撮影して動作確認**

ターミナル1（バックグラウンド）: `npm run dev -- --port 5180 --strictPort`
ターミナル2: `npm run screenshots -- before`

Expected: `screenshots/before/` に `mobile-1-空もよう.png` 〜 `desktop-3-空しらべ.png` の6枚。Read ツールで1枚以上開き、ゲストモードのアプリ本体（LPではない）が写っていることを確認する。

- [ ] **Step 6: Commit**

```bash
git add scripts/screenshots.mjs package.json package-lock.json .gitignore
git commit -m "chore: デザイン検証用のPlaywright撮影スクリプトを追加"
```

---

### Task 3: コントラスト比ユーティリティ

**Files:**
- Create: `src/lib/contrast.ts`
- Test: `src/lib/contrast.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('computes relative luminance of black and white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('computes 21:1 for black on white regardless of order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('matches the known WCAG value for #777777 on white (4.48)', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('accepts 3-digit hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 1);
  });

  it('throws on invalid color', () => {
    expect(() => relativeLuminance('teal')).toThrow();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: FAIL（`Failed to resolve import "./contrast"`）

- [ ] **Step 3: 実装**

`src/lib/contrast.ts`:

```ts
// WCAG 2.x のコントラスト比計算。デザイントークンと空パレットの可読性検証に使う。

const parseHex = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

const channel = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/contrast.ts src/lib/contrast.test.ts
git commit -m "feat: WCAGコントラスト比ユーティリティを追加"
```

---

### Task 4: デザイントークンと互換エイリアス

**Files:**
- Modify: `src/index.css:1-57`（`@import` と `:root`）
- Test: `src/designTokens.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/designTokens.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './lib/contrast';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** `:root { ... }` の最初のブロックから `--name: value;` を取り出す */
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const token = (name: string): string => {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(rootBlock);
  if (!m) throw new Error(`token ${name} not found in :root`);
  return m[1].trim();
};

/** セレクタ直後の `{ ... }` ブロック本文を返す（完全一致セレクタ） */
const ruleBody = (selector: string): string => {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`rule ${selector} not found`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
};

describe('design tokens', () => {
  it('defines the opaque surface, ink and single accent palette', () => {
    expect(token('--surface-ground')).toBe('#F4F3EF');
    expect(token('--surface-card')).toBe('#FFFFFF');
    expect(token('--surface-sunken')).toBe('#ECEAE4');
    expect(token('--ink-1')).toBe('#17191C');
    expect(token('--ink-2')).toBe('#4A4F57');
    expect(token('--ink-3')).toBe('#666B73');
    expect(token('--accent')).toBe('#0E6B65');
    expect(token('--accent-press')).toBe('#0A5550');
  });

  it('keeps legacy variable names as aliases to the new tokens', () => {
    expect(token('--accent-color')).toBe('var(--accent)');
    expect(token('--text-primary')).toBe('var(--ink-1)');
    expect(token('--text-secondary')).toBe('var(--ink-2)');
    expect(token('--text-tertiary')).toBe('var(--ink-3)');
    expect(token('--card-bg')).toBe('var(--surface-card)');
    expect(token('--bg-gradient')).toBe('var(--surface-ground)');
  });

  it('uses IBM Plex Sans JP as the app font', () => {
    expect(css).toContain('family=IBM+Plex+Sans+JP');
    expect(token('--font-sans')).toContain("'IBM Plex Sans JP'");
  });

  it('meets WCAG AA (4.5:1) for every ink on every surface', () => {
    for (const ink of ['--ink-1', '--ink-2', '--ink-3']) {
      for (const surface of ['--surface-ground', '--surface-card', '--surface-sunken']) {
        expect(contrastRatio(token(ink), token(surface)), `${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('meets WCAG AA for white text on the accent', () => {
    expect(contrastRatio('#FFFFFF', token('--accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', token('--accent-press'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('AI-look removal', () => {
  it('panels are opaque (no backdrop blur)', () => {
    expect(ruleBody('.glass-panel')).not.toContain('backdrop-filter');
    expect(ruleBody('.glass-card')).not.toContain('backdrop-filter');
    expect(ruleBody('.modal-content')).not.toContain('backdrop-filter');
  });

  it('buttons are flat (no gradient, no colored shadow)', () => {
    const body = ruleBody('button');
    expect(body).not.toContain('linear-gradient');
    expect(body).toContain('box-shadow: none');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/designTokens.test.ts`
Expected: FAIL（`token --surface-ground not found in :root`）

- [ ] **Step 3: `src/index.css` の1行目（`@import`）を置換**

```css
/* アプリ本体: IBM Plex Sans JP ／ LP（landing.css）: Outfit + Inter（LPは第5段階で統一するまで据え置き） */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
```

- [ ] **Step 4: `:root { ... }` ブロック全体（3〜57行目）を置換**

```css
:root {
  /* ── 面（不透明3段） ── */
  --surface-ground: #F4F3EF;
  --surface-card: #FFFFFF;
  --surface-sunken: #ECEAE4;

  /* ── 文字（墨3段） ── */
  --ink-1: #17191C;
  --ink-2: #4A4F57;
  --ink-3: #666B73;

  /* ── 境界線 ── */
  --line: rgba(23, 25, 28, 0.08);
  --line-strong: rgba(23, 25, 28, 0.14);

  /* ── アクセント（1色のみ・フラット） ── */
  --accent: #0E6B65;
  --accent-press: #0A5550;
  --accent-rgb: 14, 107, 101;
  --accent-soft: rgba(14, 107, 101, 0.08);

  /* ── 影（無彩色1種） ── */
  --shadow-card: 0 1px 2px rgba(23, 25, 28, 0.04), 0 4px 16px rgba(23, 25, 28, 0.05);
  --shadow-raised: 0 2px 4px rgba(23, 25, 28, 0.05), 0 12px 32px rgba(23, 25, 28, 0.08);

  /* ── 書体 ── */
  --font-sans: 'IBM Plex Sans JP', system-ui, -apple-system, 'Hiragino Sans', 'Yu Gothic UI', sans-serif;

  /* ── 角丸 ── */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 999px;

  /* ── 互換エイリアス（既存コンポーネント用・第5段階で撤去） ── */
  --bg-gradient: var(--surface-ground);
  --bg-color: var(--surface-ground);
  --card-bg: var(--surface-card);
  --card-bg-solid: var(--surface-card);
  --card-border: var(--line);
  --card-border-hover: var(--line-strong);
  --card-border-sub: var(--line);
  --text-primary: var(--ink-1);
  --text-secondary: var(--ink-2);
  --text-tertiary: var(--ink-3);
  --accent-color: var(--accent);
  --accent-hover: var(--accent-press);
  --accent-light: var(--accent-soft);
  --accent-blue: #0369A1;
  --accent-blue-hover: #075985;
  --accent-blue-light: rgba(3, 105, 161, 0.06);
  --shadow-sm: var(--shadow-card);
  --shadow-md: var(--shadow-card);
  --shadow-lg: var(--shadow-raised);
  --grid-color: rgba(23, 25, 28, 0.06);

  /* 設定画面の識別色（第2段階のシート化で撤去） */
  --settings-bg-gradient: linear-gradient(135deg, #f7f8fc 0%, #eef2ff 100%);
  --settings-accent: #4f46e5;
  --settings-accent-hover: #4338ca;
  --settings-accent-light: rgba(79, 70, 229, 0.10);
  --settings-accent-text: #4338ca;
  --settings-shadow-sm: 0 2px 8px rgba(67, 56, 202, 0.04);
  --settings-shadow-md: 0 8px 24px rgba(67, 56, 202, 0.07), 0 4px 12px rgba(79, 70, 229, 0.04);
  --settings-shadow-lg: 0 16px 40px rgba(67, 56, 202, 0.09), 0 8px 20px rgba(79, 70, 229, 0.06);

  /* チャート用（第4段階で意味色へ再設計） */
  --chart-temp: #f43f5e;
  --chart-precip: #0ea5e9;
  --chart-accum: #10b981;
  --chart-humid: #0d9488;
  --chart-sunshine: #f59e0b;

  font-family: var(--font-sans);
  font-feature-settings: 'palt';
}
```

> `settingsTheme.test.ts` が参照する `--settings-*` の値と `.settings-theme` ブロックは変更しないこと（既存テストが通り続けることを確認する）。

- [ ] **Step 5: テストの一部通過を確認**

Run: `npx vitest run src/designTokens.test.ts`
Expected: `design tokens` の5件は PASS、`AI-look removal` の2件は FAIL（Task 5 で直す）。コントラストの件が FAIL した場合は、`--ink-3` を暗くする方向（例 `#62676F`）でのみ調整し、テストの期待値も合わせる。

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/designTokens.test.ts
git commit -m "feat: 新デザイントークン（面・墨・単色アクセント）とIBM Plex Sans JPを導入"
```

---

### Task 5: グローバル要素の平坦化（ガラス・グラデーション撤去）

**Files:**
- Modify: `src/index.css`（`body` 〜 `.premium-pill.active` の各ルール）

- [ ] **Step 1: 以下のルールをそれぞれ置換する**

`body`:

```css
body {
  margin: 0;
  padding: 0;
  background: var(--surface-ground);
  color: var(--ink-1);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overscroll-behavior-y: contain;
}
```

`.glass-panel` と `.glass-panel:hover`（クラス名は既存コンポーネント32箇所が参照するため据え置き）:

```css
/* カード面（旧ガラスパネル。クラス名は互換のため据え置き） */
.glass-panel {
  background: var(--surface-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.3s ease;
}

.glass-panel:hover {
  box-shadow: var(--shadow-raised);
}
```

`.glass-card` と `.glass-card:hover`:

```css
.glass-card {
  background: var(--surface-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
}

.glass-card:hover {
  box-shadow: var(--shadow-raised);
}
```

`.title`:

```css
.title {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0;
  color: var(--ink-1);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
```

`select, input` と `select:focus, input:focus`:

```css
select, input {
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  background: var(--surface-card);
  border: 1px solid var(--line-strong);
  color: var(--ink-1);
  padding: 0.55rem 1rem;
  border-radius: var(--radius-md);
  outline: none;
  box-shadow: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

select:focus, input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.18);
}
```

`button` / `button:hover` / `button:active` / `button.secondary` / `button.secondary:hover`:

```css
button {
  font-family: inherit;
  font-size: 0.9rem;
  background: var(--accent);
  color: #ffffff;
  border: none;
  font-weight: 600;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  box-shadow: none;
  transition: background-color 0.2s ease, transform 0.15s ease;
}

button:hover {
  background-color: var(--accent-press);
}

button:active {
  transform: scale(0.97);
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button.secondary {
  background: var(--surface-card);
  border: 1px solid var(--line-strong);
  color: var(--ink-2);
}

button.secondary:hover {
  background: var(--surface-sunken);
  color: var(--ink-1);
}
```

> 注: 旧 `button:hover` は `transform: translateY(-1px)` と色付き影を付けていた。インライン `background` を持つボタンは `button:hover` の `background-color` よりインラインが優先されるため、既存のインライン配色ボタンの見た目は hover で崩れない。

`.modal-content`:

```css
.modal-content {
  width: 100%;
  max-width: 500px;
  padding: 2.25rem;
  background: var(--surface-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-raised);
  animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

`.glass-table` 関連（`.glass-table` / `th` / `td` / `tr:hover td`）:

```css
.glass-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88em;
  text-align: left;
  background: var(--surface-card);
}

.glass-table th, .glass-table td {
  padding: 0.75rem 1rem;
  border: 1px solid var(--line);
  white-space: nowrap;
}

.glass-table th {
  background: var(--surface-sunken);
  color: var(--ink-2);
  font-weight: 600;
  font-size: 0.8rem;
  text-align: center;
  letter-spacing: 0.02em;
}

.glass-table td {
  background: var(--surface-card);
  font-variant-numeric: tabular-nums;
  color: var(--ink-1);
}

.glass-table tr:hover td {
  background: var(--accent-soft);
}
```

`.premium-segmented-tab` と `.premium-pill` / `:hover` / `.active`:

```css
.premium-segmented-tab {
  display: inline-flex;
  padding: 0.25rem;
  background: var(--surface-sunken);
  border-radius: var(--radius-pill);
  border: none;
}

.premium-pill {
  flex-shrink: 0;
  padding: 0.4rem 1.1rem;
  border-radius: var(--radius-pill);
  font-size: 0.85rem;
  border: 1px solid var(--line-strong);
  background: var(--surface-card);
  color: var(--ink-2);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.premium-pill:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.premium-pill.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
  font-weight: 600;
}
```

`.premium-segmented-tab button` の `border-radius` 行を `border-radius: var(--radius-pill) !important;` に変更（他の行はそのまま）。

- [ ] **Step 2: テスト全件**

Run: `npm run test`
Expected: 既存44件＋contrast 5件＋designTokens 7件＝**56 passed**

- [ ] **Step 3: ビルド**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 撮影して目視確認**

dev サーバー起動中に `npm run screenshots -- phase1-tokens`。`screenshots/before/` と `screenshots/phase1-tokens/` の同名ファイルを Read ツールで見比べ、次を確認:
- 背景が淡いグラデーションからフラットなオフホワイトになっている
- カードが半透明ではなく白い不透明面になっている
- 文字が IBM Plex Sans JP（Outfit より字幅が広く、日本語と欧文の太さがそろう）になっている
- レイアウト崩れ（はみ出し・重なり・消えた要素）がない

崩れがあれば原因のルールを特定して直し、再撮影する。

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: ガラス効果とグラデーションを撤去しフラットな不透明面へ移行"
```

---

### Task 6: Motion 導入とばね定義

**Files:**
- Modify: `package.json`
- Create: `src/lib/motion.ts`
- Create: `src/components/ui/MotionProvider.tsx`
- Modify: `src/main.tsx`
- Test: `src/lib/motion.test.ts`

- [ ] **Step 1: 導入**

```bash
npm install motion
```

- [ ] **Step 2: 失敗するテストを書く**

`src/lib/motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pressScale, springs } from './motion';

describe('motion tokens', () => {
  it('defines exactly the three shared springs', () => {
    expect(Object.keys(springs).sort()).toEqual(['enter', 'move', 'press']);
    for (const s of Object.values(springs)) expect(s.type).toBe('spring');
  });

  it('orders stiffness press > move > enter (fast feedback, calm entrance)', () => {
    expect(springs.press.stiffness).toBeGreaterThan(springs.move.stiffness);
    expect(springs.move.stiffness).toBeGreaterThan(springs.enter.stiffness);
  });

  it('press scale is a subtle shrink', () => {
    expect(pressScale).toBeGreaterThanOrEqual(0.94);
    expect(pressScale).toBeLessThan(1);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run src/lib/motion.test.ts`
Expected: FAIL（`Failed to resolve import "./motion"`）

- [ ] **Step 4: 実装**

`src/lib/motion.ts`:

```ts
// アプリ全体で共有するモーション定義。ばねはこの3種だけを使う（仕様書 §1 モーション原則）。
// 値は実機の手触りで微調整してよいが、種類を増やさないこと。

export const springs = {
  /** 押下の沈み込み・戻り（速い反応） */
  press: { type: 'spring', stiffness: 600, damping: 30 },
  /** 選択印の移動・レイアウト変化・シート */
  move: { type: 'spring', stiffness: 380, damping: 34 },
  /** 登場・フェードアップ（ゆっくり） */
  enter: { type: 'spring', stiffness: 180, damping: 26 },
} as const;

/** 押下時の縮小率 */
export const pressScale = 0.96;
```

`src/components/ui/MotionProvider.tsx`:

```tsx
import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';

/**
 * アプリ全体のモーション設定。
 * - LazyMotion strict: `motion.*` の使用を禁止し `m.*` に統一（バンドル削減）
 * - domMax: layoutId（選択印の移動）と drag（シートのスワイプ）に必要
 * - reducedMotion="user": OS の「視差効果を減らす」設定で transform アニメを無効化
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
```

`src/main.tsx` の render 部分を変更:

```tsx
import { MotionProvider } from './components/ui/MotionProvider'
```

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: テストとビルド**

Run: `npx vitest run src/lib/motion.test.ts` → 3 passed
Run: `npm run build` → 成功

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/motion.ts src/lib/motion.test.ts src/components/ui/MotionProvider.tsx src/main.tsx
git commit -m "feat: Motionを導入し共有ばね定義とMotionProviderを追加"
```

---

### Task 7: 共通部品のテスト基盤とスタイル

**Files:**
- Create: `src/components/ui/testUtils.tsx`
- Create: `src/components/ui/ui.css`

- [ ] **Step 1: `src/components/ui/testUtils.tsx`**

```tsx
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { vi } from 'vitest';
import { MotionProvider } from './MotionProvider';

/** jsdom ではアニメーションを即時完了させ、matchMedia を用意する */
export function setupMotionTestEnv(): void {
  MotionGlobalConfig.skipAnimations = true;
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }
}

export function renderWithMotion(ui: ReactElement) {
  return render(<MotionProvider>{ui}</MotionProvider>);
}
```

> `MotionGlobalConfig` が `motion/react` から import できない場合は `import { MotionGlobalConfig } from 'motion'` に変更する（どちらも同一オブジェクト）。

- [ ] **Step 2: `src/components/ui/ui.css`**

```css
/* ── 共通部品（src/components/ui/）── */

/* Button */
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0 1.25rem;
  border-radius: var(--radius-pill);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  border: 1px solid transparent;
  box-shadow: none;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.ui-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ui-btn--primary { background: var(--accent); color: #fff; }
.ui-btn--primary:hover:not(:disabled) { background: var(--accent-press); }
.ui-btn--secondary { background: var(--surface-card); color: var(--ink-1); border-color: var(--line-strong); }
.ui-btn--secondary:hover:not(:disabled) { background: var(--surface-sunken); }
.ui-btn--ghost { background: transparent; color: var(--ink-2); }
.ui-btn--ghost:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent); }

/* SegmentedControl */
.ui-seg {
  position: relative;
  display: inline-flex;
  gap: 2px;
}
.ui-seg--pill {
  padding: 3px;
  background: var(--surface-sunken);
  border-radius: var(--radius-pill);
}
.ui-seg--underline {
  border-bottom: 1px solid var(--line);
}
.ui-seg__item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0 1rem;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: var(--radius-pill);
  color: var(--ink-2);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.ui-seg__item:hover { background: transparent; color: var(--ink-1); }
.ui-seg__item[aria-selected='true'] { color: var(--ink-1); font-weight: 600; }
.ui-seg--underline .ui-seg__item[aria-selected='true'] { color: var(--accent); }
.ui-seg__label { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 0.35rem; }
.ui-seg__thumb {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: var(--radius-pill);
  background: var(--surface-card);
  box-shadow: 0 1px 2px rgba(23, 25, 28, 0.06), 0 2px 8px rgba(23, 25, 28, 0.06);
}
.ui-seg--underline .ui-seg__thumb {
  inset: auto 0 -1px 0;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: none;
}

/* Sheet */
.ui-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(23, 25, 28, 0.36);
}
.ui-sheet {
  position: fixed;
  z-index: 901;
  display: flex;
  flex-direction: column;
  background: var(--surface-ground);
  box-shadow: var(--shadow-raised);
  outline: none;
}
.ui-sheet--bottom {
  left: 0;
  right: 0;
  bottom: 0;
  max-height: calc(100dvh - 48px - env(safe-area-inset-top));
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.ui-sheet--side {
  top: 0;
  right: 0;
  bottom: 0;
  width: min(480px, 100vw);
  border-radius: 20px 0 0 20px;
}
.ui-sheet__grabber {
  flex-shrink: 0;
  width: 36px;
  height: 5px;
  margin: 8px auto 0;
  border-radius: 3px;
  background: var(--line-strong);
  touch-action: none;
}
.ui-sheet__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px 20px;
  touch-action: none;
}
.ui-sheet__title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--ink-1); }
.ui-sheet__close {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  color: var(--ink-2);
  box-shadow: none;
}
.ui-sheet__close:hover { background: var(--line-strong); color: var(--ink-1); }
.ui-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 16px 24px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/testUtils.tsx src/components/ui/ui.css
git commit -m "chore: 共通UI部品のスタイルとテスト用ユーティリティを追加"
```

---

### Task 8: Button

**Files:**
- Create: `src/components/ui/Button.tsx`
- Test: `src/components/ui/Button.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/Button.test.tsx`:

```tsx
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('Button', () => {
  it('renders primary variant by default and fires onClick', () => {
    const onClick = vi.fn();
    renderWithMotion(<Button onClick={onClick}>保存</Button>);
    const btn = screen.getByRole('button', { name: '保存' });
    expect(btn.className).toContain('ui-btn--primary');
    expect(btn.getAttribute('type')).toBe('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the requested variant and extra className', () => {
    renderWithMotion(<Button variant="ghost" className="extra">戻る</Button>);
    const btn = screen.getByRole('button', { name: '戻る' });
    expect(btn.className).toContain('ui-btn--ghost');
    expect(btn.className).toContain('extra');
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    renderWithMotion(<Button disabled onClick={onClick}>保存</Button>);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: FAIL（`Failed to resolve import "./Button"`）

- [ ] **Step 3: 実装**

`src/components/ui/Button.tsx`:

```tsx
import type { ReactNode } from 'react';
import { m, type HTMLMotionProps } from 'motion/react';
import { pressScale, springs } from '../../lib/motion';
import './ui.css';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant;
  children: ReactNode;
};

/** 押すと沈み、離すと弾むボタン */
export function Button({ variant = 'primary', className, type = 'button', disabled, children, ...rest }: ButtonProps) {
  return (
    <m.button
      type={type}
      disabled={disabled}
      className={['ui-btn', `ui-btn--${variant}`, className].filter(Boolean).join(' ')}
      whileTap={disabled ? undefined : { scale: pressScale }}
      transition={springs.press}
      {...rest}
    >
      {children}
    </m.button>
  );
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Button.test.tsx
git commit -m "feat: 押下で沈むButton部品を追加"
```

---

### Task 9: SegmentedControl

**Files:**
- Create: `src/components/ui/SegmentedControl.tsx`
- Test: `src/components/ui/SegmentedControl.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/SegmentedControl.test.tsx`:

```tsx
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const options = [
  { value: 'daily', label: '日' },
  { value: 'monthly', label: '月' },
] as const;

describe('SegmentedControl', () => {
  it('exposes a tablist with the selected tab marked', () => {
    renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="daily" onChange={() => {}} />,
    );
    expect(screen.getByRole('tablist', { name: '表示単位' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '日' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '月' }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange with the clicked value, but not for the current one', () => {
    const onChange = vi.fn();
    renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="daily" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '日' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: '月' }));
    expect(onChange).toHaveBeenCalledWith('monthly');
  });

  it('renders exactly one sliding thumb', () => {
    const { container } = renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="monthly" onChange={() => {}} />,
    );
    expect(container.querySelectorAll('.ui-seg__thumb')).toHaveLength(1);
  });

  it('supports the underline variant', () => {
    renderWithMotion(
      <SegmentedControl ariaLabel="設定" layoutId="sub" variant="underline" options={options} value="daily" onChange={() => {}} />,
    );
    expect(screen.getByRole('tablist').className).toContain('ui-seg--underline');
  });

  it('moves selection with arrow keys', () => {
    const onChange = vi.fn();
    renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="daily" onChange={onChange} />,
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: '日' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('monthly');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/ui/SegmentedControl.test.tsx`
Expected: FAIL（`Failed to resolve import "./SegmentedControl"`）

- [ ] **Step 3: 実装**

`src/components/ui/SegmentedControl.tsx`:

```tsx
import type { KeyboardEvent, ReactNode } from 'react';
import { m } from 'motion/react';
import { pressScale, springs } from '../../lib/motion';
import './ui.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** label が要素（アイコン等）の場合のアクセシブル名 */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** 同一画面内で一意な文字列。選択印の滑る移動（layout アニメーション）の識別子 */
  layoutId: string;
  variant?: 'pill' | 'underline';
  className?: string;
}

/** 選択印が滑って移動するタブ／セグメント */
export function SegmentedControl<T extends string>({
  options, value, onChange, ariaLabel, layoutId, variant = 'pill', className,
}: SegmentedControlProps<T>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = options[(index + delta + options.length) % options.length];
    onChange(next.value);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={['ui-seg', `ui-seg--${variant}`, className].filter(Boolean).join(' ')}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <m.button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={opt.ariaLabel}
            tabIndex={selected ? 0 : -1}
            className="ui-seg__item"
            whileTap={{ scale: pressScale }}
            transition={springs.press}
            onClick={() => { if (!selected) onChange(opt.value); }}
            onKeyDown={e => handleKeyDown(e, i)}
          >
            {selected && <m.span layoutId={layoutId} className="ui-seg__thumb" transition={springs.move} />}
            <span className="ui-seg__label">{opt.label}</span>
          </m.button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run src/components/ui/SegmentedControl.test.tsx`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SegmentedControl.tsx src/components/ui/SegmentedControl.test.tsx
git commit -m "feat: 選択印が滑るSegmentedControl部品を追加"
```

---

### Task 10: Sheet

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Test: `src/components/ui/Sheet.test.tsx`

仕様: `open` の間だけ描画。`placement="bottom"`（モバイル: 下からせり上がり、つまみ／ヘッダーを下へドラッグで閉じる）と `placement="side"`（PC: 右から出る480pxパネル）。Esc・背景クリック・×ボタンで `onClose`。フォーカスは既存の `useGuidanceModalFocus` で閉じ込め・復帰する。背景画面を縮める演出は第2段階で App 側が担当する（Sheet は関与しない）。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/Sheet.test.tsx`:

```tsx
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from './MotionProvider';
import { Sheet } from './Sheet';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    renderWithMotion(<Sheet open={false} onClose={() => {}} title="設定">中身</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a labelled modal dialog when open', () => {
    renderWithMotion(<Sheet open onClose={() => {}} title="設定">中身</Sheet>);
    const dialog = screen.getByRole('dialog', { name: '設定' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('中身')).toBeTruthy();
  });

  it('closes on Escape, close button, and backdrop click', () => {
    const onClose = vi.fn();
    renderWithMotion(<Sheet open onClose={onClose} title="設定">中身</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('uses the side placement class', () => {
    renderWithMotion(<Sheet open onClose={() => {}} title="ヘルプ" placement="side">中身</Sheet>);
    expect(screen.getByRole('dialog').className).toContain('ui-sheet--side');
  });

  it('moves focus into the sheet and restores it after closing', async () => {
    const launcher = document.createElement('button');
    launcher.textContent = '開く';
    document.body.appendChild(launcher);
    launcher.focus();

    const { rerender } = renderWithMotion(<Sheet open onClose={() => {}} title="設定">中身</Sheet>);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    rerender(<MotionProvider><Sheet open={false} onClose={() => {}} title="設定">中身</Sheet></MotionProvider>);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(launcher);
    launcher.remove();
  });
});
```

> 注: `rerender` は Provider ごと渡す（Provider を外すとツリーが丸ごと再マウントされ、閉じるアニメーションの経路を検証できないため）。

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/ui/Sheet.test.tsx`
Expected: FAIL（`Failed to resolve import "./Sheet"`）

- [ ] **Step 3: 実装**

`src/components/ui/Sheet.tsx`:

```tsx
import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, m, useDragControls, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { springs } from '../../lib/motion';
import { useGuidanceModalFocus } from '../useGuidanceModalFocus';
import './ui.css';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** bottom: モバイルの下から出るシート / side: PCの右から出るパネル */
  placement?: 'bottom' | 'side';
  children: ReactNode;
}

/** 下スワイプで閉じると判定する距離(px)と速度(px/s) */
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 500;

function SheetPanel({ onClose, title, placement, children }: Omit<SheetProps, 'open'> & { placement: 'bottom' | 'side' }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const dragControls = useDragControls();
  useGuidanceModalFocus(panelRef, initialFocusRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const isBottom = placement === 'bottom';
  const hidden = isBottom ? { y: '100%' } : { x: '100%' };
  const shown = isBottom ? { y: 0 } : { x: 0 };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  };

  // ドラッグ開始はつまみ／ヘッダーからのみ（本文のスクロールと競合させない）
  const startDrag = isBottom ? (e: PointerEvent) => dragControls.start(e) : undefined;

  return (
    <>
      <m.div
        data-testid="sheet-backdrop"
        className="ui-sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`ui-sheet ui-sheet--${placement}`}
        initial={hidden}
        animate={shown}
        exit={hidden}
        transition={springs.move}
        drag={isBottom ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={isBottom ? handleDragEnd : undefined}
      >
        {isBottom && <div className="ui-sheet__grabber" aria-hidden="true" onPointerDown={startDrag} />}
        <div className="ui-sheet__header" onPointerDown={startDrag}>
          <h2 id={titleId} className="ui-sheet__title">{title}</h2>
          <button ref={initialFocusRef} type="button" className="ui-sheet__close" aria-label="閉じる" onClick={onClose}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="ui-sheet__body">{children}</div>
      </m.div>
    </>
  );
}

/** 下から出るシート（モバイル）／右から出るパネル（PC） */
export function Sheet({ open, placement = 'bottom', ...rest }: SheetProps) {
  return <AnimatePresence>{open && <SheetPanel key="sheet" placement={placement} {...rest} />}</AnimatePresence>;
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run src/components/ui/Sheet.test.tsx`
Expected: 5 passed

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Sheet.tsx src/components/ui/Sheet.test.tsx
git commit -m "feat: 下スワイプで閉じるSheet部品を追加"
```

---

### Task 11: 第1段階の総合検証と develop への取り込み

**Files:** なし（検証・統合のみ）

- [ ] **Step 1: 全テスト**

Run: `npm run test`
Expected: 既存44 + contrast 5 + designTokens 7 + motion 3 + Button 3 + SegmentedControl 5 + Sheet 5 = **72 passed**

- [ ] **Step 2: ビルドとバンドル増加量**

Run: `npm run build`
Expected: 成功。`dist/assets/index-*.js` の gzip サイズを Task 1 の値と比較し、**増加が 50KB 未満**であること（第1段階では共通部品が未使用のため Motion はツリーシェイクで大半が落ちる可能性がある。増加が小さくても正常）。

- [ ] **Step 3: 最終撮影と目視確認**

`npm run screenshots -- phase1-final` を実行し、`before` と6枚すべて見比べる。確認項目は Task 5 Step 4 と同じ。加えて、フォントが Plex に置き換わったことで折り返しが変わり、はみ出している箇所がないことを確認する。

- [ ] **Step 4: 機能不変の手動確認リスト（dev サーバー、ゲストモード）**

- 空もよう: 地点切替、日別の日タップ→時間別スクロール、天気コードモード切替、注意報表示
- 空くらべ: 日次のスワイプ・ピンチ（DevTools のタッチエミュレーション）、Ctrl＋ホイールズーム、月次切替
- 空しらべ: 表示・切替
- 設定・ヘルプ: 開閉、各サブタブ表示

- [ ] **Step 5: develop へ取り込み（リポジトリ本体で実行）**

```bash
cd c:/dev/気象アプリ
git merge --no-ff feature/app-redesign -m "Merge branch 'feature/app-redesign' (第1段階: デザイン土台)"
npm install
npm run test
npm run build
git push origin develop
```

main への反映は**ユーザーの明示指示があるまで行わない**。

- [ ] **Step 6: ユーザーに実機確認を依頼**

develop のプレビューURLで、色と書体の変化、既存機能の動作をスマホ実機で確認してもらう。
