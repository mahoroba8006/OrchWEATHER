# LP「一日×一年の空」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LP をゼロから作り直す。スクロールに合わせて「夜明け・春 → 昼・夏 → 夕焼け・秋 → 夜・冬」と空と季節が進む背景の上で、7つの章がアプリの魅力（勘を数字で裏づける）を見せる。

**Architecture:** 背景は `SkyScene` 1つ（CSS 変数＋SVG の丘＋舞うものの canvas）で、画面の奥に固定する。各章の `<section data-scene="0.27">` の位置から、画面中央に対応する進み具合 p を計算する（`progressFromAnchors`）。色・時刻・太陽と月・節気は純粋関数 `sceneAt(p)` などで求める。各章は `src/components/lp/` の独立した部品で、背の高い章の中で画面を止める演出は `stickyProgress` で進み具合を取る。LP 全体は `React.lazy` で遅延読み込みにする。

**Tech Stack:** React 19 + TypeScript, Vite, `motion`（`useReducedMotion` のみ）, Vitest + Testing Library, Playwright（撮影・目視検証）, Python Pillow（webp 変換）, Firebase Analytics（GA4）

**仕様書:** [docs/superpowers/specs/2026-10-06-lp-sky-journey-design.md](../specs/2026-10-06-lp-sky-journey-design.md)
**試作（色と動きの出発点）:** `.superpowers/brainstorm/399-1791241800/content/day-season-v2.html`

**サブエージェントの使い分け（トークン節約・品質維持）:** タスク1〜4＝Haiku、タスク5・8〜10＝Sonnet、タスク6・7（背景と最大の見せ場）＝Opus。

---

## ファイル構成

| ファイル | 役割 | 新規/変更 |
|---|---|---|
| `src/lib/lpScene.ts` | 空・丘・舞うもの・時刻・太陽と月・節気を p から計算（純粋関数） | 新規 |
| `src/lib/lpScene.test.ts` | 上のテスト | 新規 |
| `src/components/lp/particles.ts` | 舞うもの（花びら・光・葉・雪）の生成・1コマ進める・描く | 新規 |
| `src/components/lp/particles.test.ts` | 上のテスト | 新規 |
| `src/components/lp/lpFacts.ts` | LP に載せる実際の数字と、積算温度の模式曲線 | 新規 |
| `src/components/lp/lpFacts.test.ts` | 上のテスト | 新規 |
| `src/lib/analytics.ts` | `logLpChapterView` を追加 | 変更 |
| `scripts/lp-shots.mjs` | 空もようの「リスク」「概況」の2枚を撮る（`ONLY=moyo`） | 変更 |
| `public/lp/moyo-risk.webp`, `public/lp/moyo-gaikyo.webp` | 新しい画面写真 | 新規 |
| `public/lp/moyo.webp` | 旧写真（使わなくなる） | 削除 |
| `src/components/lp/hooks.ts` | `useReduced`・`useScrollFrame`・`stickyProgress`・`useInViewOnce`・`useChapterView` | 新規 |
| `src/components/lp/sceneStore.ts` | 背景が計算した p を見出し帯・目盛りへ配る小さな仕組み | 新規 |
| `src/components/lp/primitives.tsx` | `LineReveal`・`CountUp`・`CtaPair`・`Shot` | 新規 |
| `src/components/lp/primitives.test.tsx` | 上のテスト | 新規 |
| `src/components/lp/lp.css` | 書体・色・共通部品・見出し帯・目盛り | 新規 |
| `src/components/lp/SkyScene.tsx` + `scene.css` | 背景（空・太陽と月・星・雲・丘・舞うもの） | 新規 |
| `src/components/lp/LpNav.tsx` | 上部の帯（ロゴ・時刻と節気・ログイン）と PC の節気の目盛り | 新規 |
| `src/components/lp/LpHero.tsx` + `hero.css` | 0. 最初の画面 | 新規 |
| `src/components/lp/HunchChapter.tsx` + `hunch.css` | 1. 勘の章 | 新規 |
| `src/components/lp/SekkiChapter.tsx` + `sekki.css` | 2. 節気のふりかえり | 新規 |
| `src/components/lp/KurabeChapter.tsx` + `kurabe.css` | 3. 空くらべ | 新規 |
| `src/components/lp/MoyoChapter.tsx` + `moyo.css` | 4. 空もよう | 新規 |
| `src/components/lp/LpDetails.tsx` | 詳しく読む層（現行の文章・表を移す） | 新規 |
| `src/components/lp/MakerChapter.tsx` + `maker.css` | 5. 作った人＋詳しく読む | 新規 |
| `src/components/lp/FinalChapter.tsx` + `final.css` | 6. 最後のボタン＋フッター | 新規 |
| `src/components/LandingPage.tsx` | 組み立てとログイン処理だけにする | 全面書き換え |
| `src/components/LandingPage.test.tsx` | 新しい LP のテスト | 全面書き換え |
| `src/landing.css` | 旧スタイル | 削除 |
| `src/App.tsx` | LP を `React.lazy` で読み込む | 変更 |

**共通の約束（全タスク）**
- `motion` は `m.*` しか使えない（`LazyMotion strict`）。今回は `useReducedMotion` だけを使い、動きは CSS と rAF で作る。
- 動きを減らす設定の判定は `useReduced()`（タスク5）で行う。CSS でも `@media (prefers-reduced-motion: reduce)` で同じ扱いにする。
- 文言の制約: 「平年」は使わず「5年平均」と言う。「AI」という語は出さない。予報を自ら行うと受け取れる表現は使わない。有料列は「※予定」を残す。
- アイコンの飾り（lucide-react）は LP では使わない。Google の G マークだけは機能として使う。
- テストは `npm test -- <パス>` で実行する（`vitest run src` に引数が渡る）。
- **コマンドはすべて Bash ツール（Git Bash）で実行する前提**で書いてある（`A=1 node …` の環境変数指定、`python - <<'EOF'` のヒアドキュメント、`rm`）。PowerShell では動かない。PowerShell で手動実行するときは、環境変数を `$env:ONLY='moyo'; $env:LAT='35.681'; $env:LON='139.767'; node scripts/lp-shots.mjs` のように置き換え、Python は一時ファイルに保存して `python <ファイル>` で実行する。

---

### Task 1: 背景の計算（`lpScene.ts`）

**Files:**
- Create: `src/lib/lpScene.ts`
- Test: `src/lib/lpScene.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/lpScene.test.ts
import { describe, expect, it } from 'vitest';
import { celestialAt, clockLabel, mixColor, progressFromAnchors, sceneAt, sekkiIndexAt, starsAt } from './lpScene';

describe('mixColor', () => {
  it('2色を割合で混ぜて rgb() で返す', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)');
    expect(mixColor('#3d4f86', '#000000', 0)).toBe('rgb(61, 79, 134)');
  });
});

describe('sceneAt', () => {
  it('p=0 は夜明けの色、p=1 は冬の夜の色', () => {
    expect(sceneAt(0).skyTop).toBe('rgb(61, 79, 134)');
    expect(sceneAt(1).near).toBe('rgb(177, 192, 207)');
  });
  it('範囲外は端に丸める', () => {
    expect(sceneAt(-1)).toEqual(sceneAt(0));
    expect(sceneAt(2)).toEqual(sceneAt(1));
  });
  it('キーの間は補間する（0 と 0.14 の中間で 6:45）', () => {
    expect(sceneAt(0.07).hour).toBeCloseTo(6.75, 5);
  });
  it('舞うものは 春=花びら・夏=光・秋=葉・冬=雪 が主になる', () => {
    const top = (p: number) => sceneAt(p).weights.indexOf(Math.max(...sceneAt(p).weights));
    expect(top(0.1)).toBe(0);
    expect(top(0.37)).toBe(1);
    expect(top(0.62)).toBe(2);
    expect(top(0.95)).toBe(3);
  });
});

describe('sekkiIndexAt', () => {
  it('p×24 で節気が進み、季節の区切りと一致する', () => {
    expect(sekkiIndexAt(0)).toBe(0); // 立春
    expect(sekkiIndexAt(0.37)).toBe(8); // 芒種（昼・夏）
    expect(sekkiIndexAt(0.62)).toBe(14); // 白露（夕焼け・秋）
    expect(sekkiIndexAt(1)).toBe(23); // 大寒
    expect(sekkiIndexAt(0.1)).toBeLessThan(6);
    expect(sekkiIndexAt(0.4)).toBeGreaterThanOrEqual(6);
    expect(sekkiIndexAt(0.4)).toBeLessThan(12);
    expect(sekkiIndexAt(0.6)).toBeGreaterThanOrEqual(12);
    expect(sekkiIndexAt(0.6)).toBeLessThan(18);
    expect(sekkiIndexAt(0.9)).toBeGreaterThanOrEqual(18);
  });
});

describe('clockLabel', () => {
  it('時（小数）を HH:MM にする', () => {
    expect(clockLabel(5.5)).toBe('05:30');
    expect(clockLabel(12.5)).toBe('12:30');
    expect(clockLabel(22)).toBe('22:00');
  });
});

describe('celestialAt / starsAt', () => {
  it('太陽は左下から昇り、昼に最も高く、夕方以降は月になる', () => {
    expect(celestialAt(0)).toEqual({ kind: 'sun', x: 8, y: 70, height: 0 });
    expect(celestialAt(0.35).height).toBeCloseTo(1, 5);
    expect(celestialAt(0.8).kind).toBe('moon');
  });
  it('星は夕方の終わりから出て、夜に出そろう', () => {
    expect(starsAt(0.5)).toBe(0);
    expect(starsAt(0.86)).toBeCloseTo(1, 5);
  });
});

describe('progressFromAnchors', () => {
  const anchors = [{ top: 0, p: 0 }, { top: 1000, p: 0.1 }, { top: 3000, p: 0.27 }];
  it('章と章の間を直線で補間し、最後の章からページ末尾までは 1 へ向かう', () => {
    expect(progressFromAnchors(anchors, -5, 5000)).toBe(0);
    expect(progressFromAnchors(anchors, 500, 5000)).toBeCloseTo(0.05, 5);
    expect(progressFromAnchors(anchors, 2000, 5000)).toBeCloseTo(0.185, 5);
    expect(progressFromAnchors(anchors, 4000, 5000)).toBeCloseTo(0.635, 5);
  });
  it('snap=true（動きを減らす設定）では今いる章の p で止める', () => {
    expect(progressFromAnchors(anchors, 2000, 5000, true)).toBe(0.1);
  });
  it('章が無ければ 0', () => {
    expect(progressFromAnchors([], 100, 1000)).toBe(0);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/lib/lpScene.test.ts`
Expected: FAIL（`Failed to resolve import "./lpScene"`）

- [ ] **Step 3: 実装する**

```ts
// src/lib/lpScene.ts
// LP 背景「一日×一年の空」の計算（純粋関数）。
// 進み具合 p（0→1）に応じて、空・丘・雲の色、舞うものの割合、時刻、太陽と月、節気を返す。
// 朝＝春、昼＝夏、夕焼け＝秋、夜＝冬。節気は p×24 で決め、季節の区切り（0.25 ごと）と一致させる。

/** 舞うものの割合 [花びら, 光の粒, 落ち葉, 雪] */
export type Weights = readonly [number, number, number, number];

interface SceneKey {
  p: number;
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  cloud: string;
  weights: Weights;
  /** 空の時刻（時。5.5 = 5:30） */
  hour: number;
}

// 試作 day-season-v2.html で合意した値
export const SCENE_KEYS: readonly SceneKey[] = [
  { p: 0.0, skyTop: '#3d4f86', skyBottom: '#f2c9a8', far: '#a9c48f', mid: '#8db474', near: '#6f9c5c', cloud: '#f7dccb', weights: [1, 0, 0, 0], hour: 5.5 },
  { p: 0.14, skyTop: '#5aa0dc', skyBottom: '#d3e8f5', far: '#c3e2a3', mid: '#a3d283', near: '#80c166', cloud: '#ffffff', weights: [1, 0, 0, 0], hour: 8 },
  { p: 0.25, skyTop: '#3f8bd6', skyBottom: '#b4dbf4', far: '#9fd07f', mid: '#7cbf63', near: '#5aa64b', cloud: '#ffffff', weights: [0.3, 0.7, 0, 0], hour: 10.5 },
  { p: 0.37, skyTop: '#2b79cc', skyBottom: '#9ccff3', far: '#72b558', mid: '#529d41', near: '#37822f', cloud: '#ffffff', weights: [0, 1, 0, 0], hour: 12.5 },
  { p: 0.48, skyTop: '#4189cf', skyBottom: '#c8e1f1', far: '#86ab4f', mid: '#699741', near: '#4d7d33', cloud: '#ffffff', weights: [0, 0.5, 0.5, 0], hour: 15 },
  { p: 0.62, skyTop: '#4c5f9e', skyBottom: '#f3a06c', far: '#d0a24a', mid: '#b8792f', near: '#8f5426', cloud: '#f6c3a0', weights: [0, 0, 1, 0], hour: 17.5 },
  { p: 0.74, skyTop: '#27355f', skyBottom: '#8a6f8a', far: '#a99a7c', mid: '#8f8064', near: '#6f6450', cloud: '#a08aa0', weights: [0, 0, 0.5, 0.5], hour: 18.6 },
  { p: 0.86, skyTop: '#11203f', skyBottom: '#2f4670', far: '#d6dfe9', mid: '#c1cddb', near: '#a6b6c8', cloud: '#6a7796', weights: [0, 0, 0, 1], hour: 20 },
  { p: 1.0, skyTop: '#0b1730', skyBottom: '#22385c', far: '#dfe7ef', mid: '#cad5e1', near: '#b1c0cf', cloud: '#5d6a88', weights: [0, 0, 0, 1], hour: 22 },
];

export interface SceneState {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  cloud: string;
  /** 遠くの山並み（空の下端と丘の中間色） */
  ridge: string;
  weights: [number, number, number, number];
  hour: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function sceneAt(p: number): SceneState {
  const q = clamp01(p);
  let i = 0;
  while (i < SCENE_KEYS.length - 2 && q > SCENE_KEYS[i + 1].p) i++;
  const a = SCENE_KEYS[i];
  const b = SCENE_KEYS[i + 1];
  const t = clamp01((q - a.p) / (b.p - a.p));
  const skyBottom = mixColor(a.skyBottom, b.skyBottom, t);
  const far = mixColor(a.far, b.far, t);
  return {
    skyTop: mixColor(a.skyTop, b.skyTop, t),
    skyBottom,
    far,
    mid: mixColor(a.mid, b.mid, t),
    near: mixColor(a.near, b.near, t),
    cloud: mixColor(a.cloud, b.cloud, t),
    ridge: mixColor(rgbToHex(skyBottom), rgbToHex(far), 0.45),
    weights: [0, 1, 2, 3].map((j) => a.weights[j] + (b.weights[j] - a.weights[j]) * t) as [number, number, number, number],
    hour: a.hour + (b.hour - a.hour) * t,
  };
}

/** 0=立春 … 23=大寒 */
export function sekkiIndexAt(p: number): number {
  return Math.min(23, Math.floor(clamp01(p) * 24));
}

export function clockLabel(hour: number): string {
  const total = Math.round(hour * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface Celestial {
  kind: 'sun' | 'moon';
  /** 画面幅に対する位置（vw） */
  x: number;
  /** 画面高さに対する位置（vh） */
  y: number;
  /** 太陽の高さ 0（地平）〜1（南中） */
  height: number;
}

const SUN_END = 0.7;
const MOON_FROM = 0.72;

export function celestialAt(p: number): Celestial {
  const q = clamp01(p);
  if (q >= MOON_FROM) return { kind: 'moon', x: 78, y: 18, height: 1 };
  const t = Math.min(q / SUN_END, 1);
  const height = Math.sin(t * Math.PI);
  return { kind: 'sun', x: 8 + t * 84, y: 70 - height * 58, height };
}

export function starsAt(p: number): number {
  return clamp01((clamp01(p) - 0.7) / 0.16);
}

export interface SceneAnchor {
  /** ページ上端からの距離（px） */
  top: number;
  p: number;
}

/** 章の位置と各章の p から、位置 y（画面中央のページ内座標）に対応する p を求める。
 *  最後の章からページ末尾 end までは 1 へ向かう。snap=true なら今いる章の p で止める。 */
export function progressFromAnchors(anchors: readonly SceneAnchor[], y: number, end: number, snap = false): number {
  if (anchors.length === 0) return 0;
  let i = -1;
  for (let k = 0; k < anchors.length; k++) if (anchors[k].top <= y) i = k;
  if (i < 0) return anchors[0].p;
  const a = anchors[i];
  if (snap) return a.p;
  const next = i + 1 < anchors.length ? anchors[i + 1] : { top: end, p: 1 };
  if (next.top <= a.top) return a.p;
  return a.p + (next.p - a.p) * clamp01((y - a.top) / (next.top - a.top));
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test -- src/lib/lpScene.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add src/lib/lpScene.ts src/lib/lpScene.test.ts
git commit -m "feat(lp): 一日×一年の空の計算（色・時刻・太陽と月・節気）"
```

---

### Task 2: 舞うもの（`particles.ts`）

**Files:**
- Create: `src/components/lp/particles.ts`
- Test: `src/components/lp/particles.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/components/lp/particles.test.ts
import { describe, expect, it } from 'vitest';
import { createParticles, kindFor, particleCount, stepParticle } from './particles';

describe('kindFor', () => {
  it('割合に従って種類を決める', () => {
    expect(kindFor(0.1, [1, 0, 0, 0])).toBe('petal');
    expect(kindFor(0.4, [0, 0.5, 0.5, 0])).toBe('light');
    expect(kindFor(0.6, [0, 0.5, 0.5, 0])).toBe('leaf');
    expect(kindFor(0.99, [0, 0, 0, 1])).toBe('snow');
  });
  it('割合が全部 0 なら描かない（null）', () => {
    expect(kindFor(0.5, [0, 0, 0, 0])).toBeNull();
  });
});

describe('createParticles', () => {
  it('ゆっくり（落下速度 0.18〜0.5）で画面内に置く', () => {
    const ps = createParticles(5, 400, 800, () => 0.5);
    expect(ps).toHaveLength(5);
    expect(ps[0]).toMatchObject({ x: 200, y: 400 });
    expect(ps[0].v).toBeCloseTo(0.34, 10);
  });
});

describe('stepParticle', () => {
  it('花びらは下へ落ち、画面の下に出たら上へ戻る', () => {
    const q = { x: 10, y: 100, v: 0.3, a: 0, s: 1, k: 0 };
    stepParticle(q, 'petal', 400, 800, () => 0.5);
    expect(q.y).toBeCloseTo(100.3, 5);
    q.y = 821;
    stepParticle(q, 'petal', 400, 800, () => 0.5);
    expect(q.y).toBe(-20);
    expect(q.x).toBe(200);
  });
  it('光の粒はゆっくり昇る', () => {
    const q = { x: 10, y: 100, v: 0.4, a: 0, s: 1, k: 0 };
    stepParticle(q, 'light', 400, 800);
    expect(q.y).toBeLessThan(100);
  });
});

describe('particleCount', () => {
  it('スマホは少なめ', () => {
    expect(particleCount(375)).toBe(16);
    expect(particleCount(1280)).toBe(26);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/lp/particles.test.ts`
Expected: FAIL（`Failed to resolve import "./particles"`）

- [ ] **Step 3: 実装する**

```ts
// src/components/lp/particles.ts
// LP 背景の舞うもの（花びら・光の粒・落ち葉・雪）。少なく、ゆっくり（試作 v2 の設定）。
import type { Weights } from '../../lib/lpScene';

export type ParticleKind = 'petal' | 'light' | 'leaf' | 'snow';
const KINDS: readonly ParticleKind[] = ['petal', 'light', 'leaf', 'snow'];

export interface Particle {
  x: number;
  y: number;
  /** 落下の速さ */
  v: number;
  /** 揺れと回転の角度 */
  a: number;
  /** 大きさの倍率 */
  s: number;
  /** 種類を決める粒ごとの固定の乱数 */
  k: number;
}

export function createParticles(n: number, w: number, h: number, rand: () => number = Math.random): Particle[] {
  return Array.from({ length: n }, () => ({
    x: rand() * w,
    y: rand() * h,
    v: 0.18 + rand() * 0.32,
    a: rand() * Math.PI * 2,
    s: 0.6 + rand() * 0.8,
    k: rand(),
  }));
}

/** 粒の乱数 k と季節の割合から種類を決める（割合が全部 0 なら null＝描かない） */
export function kindFor(k: number, w: Weights): ParticleKind | null {
  const sum = w[0] + w[1] + w[2] + w[3];
  if (sum <= 0) return null;
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    acc += w[i] / sum;
    if (k < acc) return KINDS[i];
  }
  return KINDS[3];
}

export function stepParticle(q: Particle, kind: ParticleKind, w: number, h: number, rand: () => number = Math.random): void {
  q.a += 0.008;
  if (kind === 'light') {
    q.y -= q.v * 0.25;
    q.x += Math.sin(q.a) * 0.3;
  } else {
    q.y += q.v * (kind === 'snow' ? 0.7 : 1);
    q.x += Math.sin(q.a) * 0.45 + (kind === 'leaf' ? 0.25 : 0.12);
  }
  if (q.y > h + 20) {
    q.y = -20;
    q.x = rand() * w;
  }
  if (q.y < -20) q.y = h + 10;
  if (q.x > w + 20) q.x = -20;
}

export function drawParticle(ctx: CanvasRenderingContext2D, q: Particle, kind: ParticleKind): void {
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.rotate(q.a);
  ctx.beginPath();
  if (kind === 'petal') {
    ctx.fillStyle = 'rgba(250, 205, 215, 0.9)';
    ctx.ellipse(0, 0, 5 * q.s, 3 * q.s, 0, 0, Math.PI * 2);
  } else if (kind === 'light') {
    ctx.fillStyle = `rgba(255, 255, 230, ${0.25 + 0.25 * Math.sin(q.a * 3)})`;
    ctx.arc(0, 0, 1.6 * q.s, 0, Math.PI * 2);
  } else if (kind === 'leaf') {
    ctx.fillStyle = q.k > 0.5 ? 'rgba(214, 110, 48, 0.9)' : 'rgba(232, 170, 60, 0.9)';
    ctx.ellipse(0, 0, 6 * q.s, 3 * q.s, 0, 0, Math.PI * 2);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.arc(0, 0, 2.2 * q.s, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

export const particleCount = (width: number) => (width < 600 ? 16 : 26);
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test -- src/components/lp/particles.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/lp/particles.ts src/components/lp/particles.test.ts
git commit -m "feat(lp): 背景の舞うもの（花びら・光・落ち葉・雪）"
```

---

### Task 3: LP の数字と章の計測（`lpFacts.ts`・`logLpChapterView`）

**Files:**
- Create: `src/components/lp/lpFacts.ts`
- Test: `src/components/lp/lpFacts.test.ts`
- Modify: `src/lib/analytics.ts`（末尾に関数を追加）

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/components/lp/lpFacts.test.ts
import { describe, expect, it } from 'vitest';
import { GDD_LAG_DAYS, HUNCHES, LP_FACTS_ASOF, LP_FACTS_SOURCE, gddCurve, hunchSummary } from './lpFacts';

describe('lpFacts', () => {
  it('3つの勘と、撮影した画面と同じ数字', () => {
    expect(HUNCHES.map((h) => h.quote)).toEqual(['今年は、遅い気がする。', '雨、多すぎないか。', 'お日さま、足りてない。']);
    expect(HUNCHES.map((h) => h.value)).toEqual([18, 5.9, 64]);
    expect(LP_FACTS_SOURCE).toBe('東京・2026年の実績');
    expect(LP_FACTS_ASOF).toBe('東京・2026年10月5日時点');
  });
  it('勘の章の最後に残す3行', () => {
    expect(HUNCHES.map(hunchSummary)).toEqual([
      '積算温度：去年より18日遅い',
      '白露の雨：5年平均の5.9倍',
      '白露の日照：5年平均より64時間少ない',
    ]);
  });
  it('「平年」と言わない', () => {
    expect(JSON.stringify(HUNCHES)).not.toMatch(/平年/);
  });
  it('模式曲線は今年が去年よりちょうど18日遅れる', () => {
    expect(GDD_LAG_DAYS).toBe(18);
    expect(gddCurve(278, GDD_LAG_DAYS)).toBeCloseTo(gddCurve(260), 6);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/lp/lpFacts.test.ts`
Expected: FAIL（`Failed to resolve import "./lpFacts"`）

- [ ] **Step 3: 実装する**

```ts
// src/components/lp/lpFacts.ts
// LP に載せる数字。東京・2026年の実績（scripts/lp-shots.mjs で 2026-10-05 に撮影した画面と同じ値）。
// 画面写真を撮り直したら、ここも同じ値に更新する。
export const LP_FACTS_SOURCE = '東京・2026年の実績';
/** 最初の画面の札に添える撮影時点（撮影時点の数字を今日の実績と誤解させない） */
export const LP_FACTS_ASOF = '東京・2026年10月5日時点';

export interface Hunch {
  /** 農家のつぶやき */
  quote: string;
  /** 章の最後に振り返るときの見出し */
  topic: string;
  /** 数字の見出し */
  label: string;
  /** 数字の前の言葉 */
  before: string;
  value: number;
  decimals: number;
  unit: string;
  note: string;
}

export const HUNCHES: readonly Hunch[] = [
  { quote: '今年は、遅い気がする。', topic: '積算温度', label: '積算温度（1月1日から・10℃基準）', before: '去年より', value: 18, decimals: 0, unit: '日遅い', note: '5年平均より12日遅い' },
  { quote: '雨、多すぎないか。', topic: '白露の雨', label: '白露（9/7〜9/22）の雨の量', before: '5年平均の', value: 5.9, decimals: 1, unit: '倍', note: '476mm（去年の10.6倍）' },
  { quote: 'お日さま、足りてない。', topic: '白露の日照', label: '白露（9/7〜9/22）の日照', before: '5年平均より', value: 64, decimals: 0, unit: '時間少ない', note: '39時間（去年より68時間少ない）' },
];

/** 章の最後に残す一行（例「積算温度：去年より18日遅い」） */
export function hunchSummary(h: Hunch): string {
  return `${h.topic}：${h.before}${h.value.toFixed(h.decimals)}${h.unit}`;
}

/** 積算温度の模式図で、今年が去年より遅れる日数（季節のあしどりの実績と同じ） */
export const GDD_LAG_DAYS = 18;

/** 積算温度の模式曲線（1月1日からの日数 → ℃・日）。lag 日だけ右へずらす */
export function gddCurve(day: number, lag = 0): number {
  return 3000 / (1 + Math.exp(-(day - lag - 200) / 40));
}
```

`src/lib/analytics.ts` の末尾（`logLpDetailOpen` の後）に追加する:

```ts
/** LP の各章が画面に入った（どこまで読まれたか）。章ごとに1回だけ送る */
export function logLpChapterView(chapter: string): void {
  track('lp_chapter_view', { chapter });
}

/** LP の空もようで「リスクでみる／概況でみる」が押された（触れる仕掛けが効いているか） */
export function logLpMoyoToggle(mode: string): void {
  track('lp_moyo_toggle', { mode });
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test -- src/components/lp/lpFacts.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/lp/lpFacts.ts src/components/lp/lpFacts.test.ts src/lib/analytics.ts
git commit -m "feat(lp): LP の数字（東京・2026年の実績）と章の閲覧・切替の計測"
```

---

### Task 4: 空もようの「リスク」「概況」の画面写真

**Files:**
- Modify: `scripts/lp-shots.mjs`
- Create: `public/lp/moyo-risk.webp`, `public/lp/moyo-gaikyo.webp`

Open-Meteo の利用上限を消費するので、撮影は**1回だけ**行う（`ONLY=moyo` で空もようだけ撮る）。

- [ ] **Step 1: 撮影スクリプトに空もようの2枚を足す**

`scripts/lp-shots.mjs` の `// 1) 空もよう` のブロック（`await page.evaluate(() => window.scrollTo(0, 0));` から `console.log('saved moyo');` まで）を次に置き換える:

```js
  // 1) 空もよう: 「リスクでみる」「概況でみる」の2枚（空に節気・候が写る）
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const [label, name] of [['リスクでみる', 'moyo-risk'], ['概況でみる', 'moyo-gaikyo']]) {
    await page.getByRole('tab', { name: label }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(outDir, `${name}.png`), clip: { x: 0, y: 0, width: 390, height: 844 } });
    console.log('saved', name);
  }
  if (process.env.ONLY === 'moyo') process.exit(0);
```

ファイル先頭の使い方コメントに1行足す:

```js
//         空もようの2枚だけ撮るときは ONLY=moyo を付ける。
```

- [ ] **Step 2: 撮影する**

別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動してから実行する:

Run（Bash）: `ONLY=moyo LAT=35.681 LON=139.767 node scripts/lp-shots.mjs`
（PowerShell の場合: `$env:ONLY='moyo'; $env:LAT='35.681'; $env:LON='139.767'; node scripts/lp-shots.mjs`）
Expected: `saved moyo-risk` と `saved moyo-gaikyo` が出て、`screenshots/lp/` に2枚できる

- [ ] **Step 3: webp に変換して public/lp に置き、旧写真を消す（Bash で実行）**

```bash
python - <<'EOF'
from PIL import Image
for n in ['moyo-risk', 'moyo-gaikyo']:
    im = Image.open(f'screenshots/lp/{n}.png').convert('RGB')
    w = 780
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(f'public/lp/{n}.webp', 'WEBP', quality=82, method=6)
    print(n, im.size)
EOF
git rm -q public/lp/moyo.webp
```

Expected: `moyo-risk (780, 1688)` と `moyo-gaikyo (780, 1688)`

- [ ] **Step 4: 2枚を目で確認する**

Read ツールで `public/lp/moyo-risk.webp` と `public/lp/moyo-gaikyo.webp` を開く。切り替えが「リスクでみる」と「概況でみる」になっていること、空に節気・候が写っていることを確かめる。

- [ ] **Step 5: コミット**

```bash
git add scripts/lp-shots.mjs public/lp/moyo-risk.webp public/lp/moyo-gaikyo.webp
git commit -m "chore(lp): 空もようの「リスク」「概況」の画面写真を撮る"
```

---

### Task 5: LP の土台（フック・共通部品・共通スタイル）

**Files:**
- Create: `src/components/lp/hooks.ts`
- Create: `src/components/lp/sceneStore.ts`
- Create: `src/components/lp/primitives.tsx`
- Create: `src/components/lp/lp.css`
- Test: `src/components/lp/primitives.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/lp/primitives.test.tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useVisibility } from './hooks';
import { CountUp, CtaPair, LineReveal } from './primitives';
import { publishScene, subscribeScene } from './sceneStore';

let reduce = true;
beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LineReveal', () => {
  it('行に分けて表示し、見出しの名前は行をつなげた文', () => {
    render(<LineReveal as="h1" lines={['「今年は遅い」が、', '数字で見える。']} />);
    expect(screen.getByRole('heading', { level: 1, name: '「今年は遅い」が、数字で見える。' })).toBeTruthy();
  });
});

describe('CountUp', () => {
  it('動きを減らす設定では最終の値をすぐ出す', () => {
    const { container } = render(<CountUp to={5.9} decimals={1} />);
    expect(container.textContent).toContain('5.9');
  });
});

describe('CtaPair', () => {
  it('2つのボタンは同じ見た目で、それぞれの処理を呼ぶ', () => {
    const onLogin = vi.fn();
    const onTryGuest = vi.fn();
    render(<CtaPair loading={false} onLogin={onLogin} onTryGuest={onTryGuest} />);
    const guest = screen.getByRole('button', { name: /ログインせずに試す/ });
    const google = screen.getByRole('button', { name: /Googleで始める/ });
    expect(guest.className).toBe(google.className);
    fireEvent.click(guest);
    fireEvent.click(google);
    expect(onTryGuest).toHaveBeenCalled();
    expect(onLogin).toHaveBeenCalled();
  });
});

describe('useVisibility', () => {
  it('画面外に出ると visible は false に戻り、seen は true のまま', () => {
    let fire: (v: boolean) => void = () => {};
    const Orig = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        fire = (v) => cb([{ isIntersecting: v } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    function Probe() {
      const [ref, visible, seen] = useVisibility<HTMLDivElement>();
      return <div ref={ref}>{`${visible}/${seen}`}</div>;
    }
    const { container } = render(<Probe />);
    act(() => fire(true));
    expect(container.textContent).toBe('true/true');
    act(() => fire(false));
    expect(container.textContent).toBe('false/true');
    globalThis.IntersectionObserver = Orig;
  });
});

describe('sceneStore', () => {
  it('登録した時点の値と、その後の値を受け取る', () => {
    publishScene(0.4);
    const got: number[] = [];
    const off = subscribeScene((p) => got.push(p));
    publishScene(0.6);
    off();
    publishScene(0.9);
    expect(got).toEqual([0.4, 0.6]);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/lp/primitives.test.tsx`
Expected: FAIL（`Failed to resolve import "./primitives"`）

- [ ] **Step 3: フックと配信の仕組みを書く**

```ts
// src/components/lp/hooks.ts
// LP 共通のフック。スクロールは rAF でまとめ、passive で購読する。
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';
import { logLpChapterView } from '../../lib/analytics';

/** 動きを減らす設定か（OS の設定に追従） */
export function useReduced(): boolean {
  return useReducedMotion() ?? false;
}

/** スクロール・リサイズのたびに（1コマに1回まで）cb を呼ぶ。最初にも1回呼ぶ */
export function useScrollFrame(cb: () => void): void {
  const cbRef = useRef(cb);
  useLayoutEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = 0;
      cbRef.current();
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

/** 背の高い章（中で画面を止める）の進み具合 0→1 */
export function stickyProgress(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
}

/** 一度画面に入ったら true（IntersectionObserver が無い環境では最初から true） */
export function useInViewOnce<T extends Element>(threshold = 0.25): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return [ref, inView];
}

/** 今見えているか（visible）と、一度でも見えたか（seen）。画面外に出ると visible は false に戻る。
 *  IntersectionObserver が無い環境では両方 true */
export function useVisibility<T extends Element>(threshold = 0.25): [RefObject<T | null>, boolean, boolean] {
  const ref = useRef<T>(null);
  const noObserver = typeof IntersectionObserver === 'undefined';
  const [visible, setVisible] = useState(noObserver);
  const [seen, setSeen] = useState(noObserver);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setSeen(true);
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible, seen];
}

/** 章が画面に入ったら1回だけ GA4 に記録する */
export function useChapterView<T extends Element>(chapter: string): RefObject<T | null> {
  const [ref, inView] = useInViewOnce<T>(0.35);
  useEffect(() => {
    if (inView) logLpChapterView(chapter);
  }, [inView, chapter]);
  return ref;
}
```

```ts
// src/components/lp/sceneStore.ts
// 背景（SkyScene）が計算した進み具合 p を、見出し帯の時刻・節気の目盛りへ配る。
// 再描画を起こさず、受け取り側が DOM を直接書き換える前提。
type Listener = (p: number) => void;
const listeners = new Set<Listener>();
let last = 0;

export function publishScene(p: number): void {
  last = p;
  listeners.forEach((l) => l(p));
}

/** 登録時に今の値を1回渡す。戻り値で登録を外す */
export function subscribeScene(l: Listener): () => void {
  listeners.add(l);
  l(last);
  return () => {
    listeners.delete(l);
  };
}
```

- [ ] **Step 4: 共通部品を書く**

```tsx
// src/components/lp/primitives.tsx
// LP の共通部品: 行ごとにせり上がる見出し・数え上がる数字・ボタン2つ・画面写真。
import { createElement, useEffect, useState, type CSSProperties } from 'react';
import { useInViewOnce, useReduced } from './hooks';

/** 見出しを行ごとに下からせり上げる（画面に入ったとき1回）。読み上げは行をつなげた文 */
export function LineReveal({ as = 'h2', lines, className }: { as?: 'h1' | 'h2' | 'p'; lines: readonly string[]; className?: string }) {
  const [ref, inView] = useInViewOnce<HTMLElement>(0.3);
  return createElement(
    as,
    {
      ref,
      className: ['lp-lines', inView ? 'is-in' : '', className ?? ''].filter(Boolean).join(' '),
      'aria-label': lines.join(''),
    },
    lines.map((line, i) => (
      <span key={i} className="lp-line" aria-hidden="true">
        <span className="lp-line__in" style={{ '--i': i } as CSSProperties}>{line}</span>
      </span>
    )),
  );
}

/** 0 から to まで数え上げる（start が true になってから delay ms 後）。動きを減らす設定では最終の値 */
export function CountUp({ to, decimals = 0, duration = 1400, delay = 0, start = true }: {
  to: number; decimals?: number; duration?: number; delay?: number; start?: boolean;
}) {
  const reduced = useReduced();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced || !start) return;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / duration));
      setV(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay, start, reduced]);
  const shown = reduced ? to : v;
  return (
    <span className="lp-num">
      <span aria-hidden="true">{shown.toFixed(decimals)}</span>
      <span className="lp-sr">{to.toFixed(decimals)}</span>
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

/** 「ログインせずに試す」「Googleで始める」を同じ強さで並べる */
export function CtaPair({ loading, onLogin, onTryGuest, tone = 'day' }: {
  loading: boolean; onLogin: () => void; onTryGuest: () => void; tone?: 'day' | 'night';
}) {
  return (
    <div className={`lp-cta-pair lp-cta-pair--${tone}`}>
      <button type="button" className="lp-cta" onClick={onTryGuest} disabled={loading}>
        ログインせずに試す
      </button>
      <button type="button" className="lp-cta" onClick={onLogin} disabled={loading}>
        <span className="lp-cta__g"><GoogleIcon /></span>
        {loading ? 'ログイン中...' : 'Googleで始める'}
      </button>
    </div>
  );
}

/** 画面写真。card=カード単体（角丸・影）／phone=スマホの枠つき／band=横長の帯 */
export function Shot({ src, alt, width, height, variant = 'card', eager = false, className }: {
  src: string; alt: string; width: number; height: number; variant?: 'card' | 'phone' | 'band'; eager?: boolean; className?: string;
}) {
  return (
    <figure className={['lp-shot', `lp-shot--${variant}`, className ?? ''].filter(Boolean).join(' ')}>
      <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </figure>
  );
}
```

- [ ] **Step 5: 共通スタイルを書く**

```css
/* src/components/lp/lp.css — LP 共通（書体・色・共通部品）。章ごとの見た目は各章の css に置く */
@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap');

.lp-root {
  --lp-ink: #16303a;
  --lp-paper: #fbf8f1;
  --lp-leaf: #3d7a4a;
  --lp-mincho: 'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  --lp-sans: 'Zen Kaku Gothic New', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
  --lp-mono: 'DM Mono', ui-monospace, monospace;
  --lp-ease: cubic-bezier(0.2, 0.7, 0.1, 1);
  --lp-gutter: clamp(20px, 6vw, 96px);
  position: relative;
  min-height: 100vh;
  color: #fff;
  font-family: var(--lp-sans);
  background: #3d4f86;
  overflow-x: hidden;
  overflow-x: clip; /* sticky を効かせるため hidden ではなく clip（非対応環境は hidden） */
  -webkit-font-smoothing: antialiased;
}
/* 高さの計算に余白を含める（アプリ全体の指定に頼らない。100svh の枠が余白ではみ出さないように） */
.lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }
.lp-main { position: relative; z-index: 2; }

/* 章の共通の余白。章ごとの高さは各章で変える（同じ高さの繰り返しにしない） */
.lp-ch { position: relative; padding: 0 var(--lp-gutter); }

/* 読み上げ専用 */
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* 見出し（明朝・行ごとにせり上がる） */
.lp-lines {
  margin: 0;
  font-family: var(--lp-mincho);
  font-weight: 800;
  font-feature-settings: 'palt';
  letter-spacing: -0.01em;
  line-height: 1.24;
  text-shadow: 0 2px 28px rgba(20, 50, 80, 0.28);
}
.lp-line { display: block; overflow: hidden; padding-bottom: 0.08em; margin-bottom: -0.08em; }
.lp-line__in {
  display: inline-block;
  transform: translateY(110%);
  transition: transform 1.15s var(--lp-ease) calc(var(--i) * 0.14s);
}
.lp-lines.is-in .lp-line__in { transform: none; }
h2.lp-lines { font-size: clamp(30px, 7.6vw, 64px); }

/* 縦書きの添え書き */
.lp-vertical {
  writing-mode: vertical-rl;
  font-family: var(--lp-mincho);
  font-weight: 600;
  letter-spacing: 0.32em;
  font-size: clamp(14px, 1.6vw, 18px);
  margin: 0;
  opacity: 0.92;
}

/* 等幅の数字 */
.lp-num { font-family: var(--lp-mono); font-variant-numeric: tabular-nums; font-weight: 500; }

/* 小さな札 */
.lp-chip {
  display: inline-flex; align-items: baseline; gap: 0.25em;
  margin: 0; padding: 0.55em 1em;
  border-radius: 999px;
  background: #fff; color: var(--lp-ink);
  font-size: 13px; font-weight: 700;
  box-shadow: 0 12px 28px -12px rgba(10, 30, 50, 0.45);
}
.lp-chip .lp-num { font-size: 1.35em; color: #2f6e9e; }

/* ボタン2つ（同じ強さ） */
.lp-cta-pair { display: flex; flex-wrap: wrap; gap: 12px; }
.lp-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-height: 52px; padding: 0 26px;
  border-radius: 999px;
  border: 1.5px solid #fff;
  background: #fff; color: #17384a;
  font: 700 15px/1 var(--lp-sans);
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 0.35s var(--lp-ease), box-shadow 0.35s var(--lp-ease), background 0.25s;
  box-shadow: 0 14px 30px -16px rgba(10, 30, 50, 0.55);
}
.lp-cta:hover { transform: translateY(-2px); box-shadow: 0 20px 36px -16px rgba(10, 30, 50, 0.6); }
.lp-cta:active { transform: translateY(0); }
.lp-cta:focus-visible { outline: 3px solid #ffe7a8; outline-offset: 3px; }
.lp-cta:disabled { opacity: 0.6; cursor: default; }
.lp-cta__g { display: inline-flex; }
@media (max-width: 480px) { .lp-cta-pair .lp-cta { flex: 1 1 100%; } }

/* 画面写真 */
.lp-shot { margin: 0; }
.lp-shot img { display: block; width: 100%; height: auto; }
.lp-shot--card img { border-radius: 18px; box-shadow: 0 40px 70px -30px rgba(10, 30, 50, 0.55); }
.lp-shot--band img { border-radius: 14px; box-shadow: 0 20px 40px -24px rgba(10, 30, 50, 0.5); }
.lp-shot--phone {
  padding: 9px; border-radius: 40px; background: #0f1d22;
  box-shadow: 0 50px 90px -30px rgba(10, 30, 50, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.lp-shot--phone img { border-radius: 32px; }

/* エラー */
.lp-error { margin: 12px 0 0; color: #ffe1e1; font-weight: 700; font-size: 14px; }

@media (prefers-reduced-motion: reduce) {
  .lp-line__in { transform: none; transition: none; }
  .lp-cta { transition: none; }
}
```

- [ ] **Step 5b: 通ることを確認する**

Run: `npm test -- src/components/lp/primitives.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/lp/hooks.ts src/components/lp/sceneStore.ts src/components/lp/primitives.tsx src/components/lp/primitives.test.tsx src/components/lp/lp.css
git commit -m "feat(lp): LP の土台（フック・見出し・数え上げ・ボタン・写真・共通スタイル）"
```

---

### Task 6: 背景 `SkyScene` と見出し帯 `LpNav`（Opus）

**Files:**
- Create: `src/components/lp/SkyScene.tsx`
- Create: `src/components/lp/scene.css`
- Create: `src/components/lp/LpNav.tsx`
- Test: `src/components/lp/SkyScene.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/lp/SkyScene.test.tsx
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/analytics', () => ({ logLpChapterView: vi.fn() }));
import { SkyScene } from './SkyScene';
import { LpNav, SekkiDial } from './LpNav';
import { publishScene } from './sceneStore';

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('SkyScene', () => {
  it('飾りなので読み上げない。動きを減らす設定では舞うものを描かない', () => {
    const { container } = render(<SkyScene />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('lp-scene--still');
    expect(container.querySelector('canvas')).toBeNull();
  });
});

describe('LpNav / SekkiDial', () => {
  it('背景の進み具合に合わせて時刻と節気を出す', () => {
    const { container } = render(<><LpNav loading={false} onLogin={() => {}} /><SekkiDial /></>);
    act(() => publishScene(0.62));
    expect(container.querySelector('.lp-nav__clock')!.textContent).toBe('17:30　白露');
    expect(container.querySelector('.lp-dial .is-on')!.textContent).toBe('白露');
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/lp/SkyScene.test.tsx`
Expected: FAIL（`Failed to resolve import "./SkyScene"`）

- [ ] **Step 3: 背景を書く**

```tsx
// src/components/lp/SkyScene.tsx
// LP の背景「一日×一年の空」。画面の奥に固定し、各章の data-scene から進み具合 p を求めて
// 空・太陽と月・星・雲・丘の色を CSS 変数で書き換える（再描画なし）。舞うものは canvas。
// 動きを減らす設定では、今いる章の色で止め（@property で静かに切り替え）、舞うものは出さない。
import { useEffect, useRef } from 'react';
import { celestialAt, progressFromAnchors, sceneAt, starsAt, type SceneAnchor } from '../../lib/lpScene';
import { useReduced, useScrollFrame } from './hooks';
import { createParticles, drawParticle, kindFor, particleCount, stepParticle } from './particles';
import { publishScene } from './sceneStore';
import './scene.css';

function readAnchors(): SceneAnchor[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'))
    .map((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, p: Number(el.dataset.scene) }))
    .sort((a, b) => a.top - b.top);
}

export function SkyScene() {
  const reduced = useReduced();
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const weightsRef = useRef<[number, number, number, number]>([1, 0, 0, 0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useScrollFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    const y = window.scrollY + window.innerHeight * 0.5;
    const end = document.documentElement.scrollHeight;
    const p = progressFromAnchors(readAnchors(), y, end, reduced);
    const s = sceneAt(p);
    const st = root.style;
    st.setProperty('--sky-top', s.skyTop);
    st.setProperty('--sky-bottom', s.skyBottom);
    st.setProperty('--ridge', s.ridge);
    st.setProperty('--far', s.far);
    st.setProperty('--mid', s.mid);
    st.setProperty('--near', s.near);
    st.setProperty('--cloud', s.cloud);
    st.setProperty('--stars', String(starsAt(p)));
    // 入道雲は夏だけ濃く、夜はすべての雲を薄く
    st.setProperty('--cumulus', String(p > 0.25 && p < 0.55 ? 1 : 0.35));
    st.setProperty('--cloud-night', String(p > 0.78 ? 0.4 : 1));
    st.setProperty('--cloud-shift', `${(p * 18).toFixed(2)}vw`);
    const c = celestialAt(p);
    const body = bodyRef.current;
    if (body) {
      body.dataset.kind = c.kind;
      body.style.left = `${c.x}vw`;
      body.style.top = `${c.y}vh`;
      // 地平線に近いほど赤みを帯びる
      body.style.setProperty('--warm', String(200 + Math.round(50 * c.height)));
    }
    weightsRef.current = s.weights;
    publishScene(p);
  });

  // 舞うもの（少なく、ゆっくり）。画面が隠れている間は止める
  useEffect(() => {
    if (reduced) return;
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let w = 0;
    let h = 0;
    let parts = createParticles(0, 0, 0);
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = createParticles(particleCount(w), w, h);
    };
    size();
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const q of parts) {
        const kind = kindFor(q.k, weightsRef.current);
        if (!kind) continue;
        stepParticle(q, kind, w, h);
        drawParticle(ctx, q, kind);
      }
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', size, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  return (
    <div ref={rootRef} className={reduced ? 'lp-scene lp-scene--still' : 'lp-scene'} aria-hidden="true">
      <div className="lp-scene__sky" />
      <div className="lp-scene__stars" />
      <div ref={bodyRef} className="lp-scene__body" data-kind="sun" />
      <div className="lp-scene__cloud lp-scene__cloud--1" />
      <div className="lp-scene__cloud lp-scene__cloud--2" />
      <div className="lp-scene__cloud lp-scene__cloud--3" />
      <svg className="lp-scene__land" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax slice">
        {/* 遠くの山並み */}
        <path fill="var(--ridge)" d="M0 262 Q60 236 120 244 T240 214 T360 236 T480 204 T600 232 T720 196 T840 228 T960 206 T1080 236 T1200 210 T1320 238 T1440 222 V520 H0Z" />
        {/* 奥の丘 */}
        <path fill="var(--far)" d="M0 304 C180 254 360 274 540 294 S900 254 1110 274 S1340 294 1440 280 V520 H0Z" />
        {/* 中の丘と木立 */}
        <path fill="var(--mid)" d="M0 364 C200 324 420 354 640 340 S1020 316 1240 344 S1400 354 1440 348 V520 H0Z" />
        <g fill="rgba(20, 45, 25, 0.16)">
          <circle cx="210" cy="342" r="15" /><circle cx="234" cy="335" r="19" /><circle cx="258" cy="344" r="12" />
          <circle cx="1052" cy="330" r="16" /><circle cx="1076" cy="323" r="21" /><circle cx="1100" cy="332" r="13" />
        </g>
        {/* 手前の田畑と畦 */}
        <path fill="var(--near)" d="M0 424 C260 394 520 414 760 408 S1080 396 1300 414 L1440 418 V520 H0Z" />
        <g fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="2">
          <path d="M0 456 C300 434 640 450 1000 444 S1300 450 1440 454" />
          <path d="M0 490 C320 470 700 484 1040 480 S1320 486 1440 490" />
          <path d="M380 520 C420 474 470 444 520 416" />
          <path d="M900 520 C880 474 860 444 840 410" />
        </g>
      </svg>
      {!reduced && <canvas ref={canvasRef} className="lp-scene__fx" />}
    </div>
  );
}
```

- [ ] **Step 4: 背景のスタイルを書く**

```css
/* src/components/lp/scene.css — 背景「一日×一年の空」 */
@property --sky-top { syntax: '<color>'; inherits: true; initial-value: #3d4f86; }
@property --sky-bottom { syntax: '<color>'; inherits: true; initial-value: #f2c9a8; }
@property --ridge { syntax: '<color>'; inherits: true; initial-value: #cdc59b; }
@property --far { syntax: '<color>'; inherits: true; initial-value: #a9c48f; }
@property --mid { syntax: '<color>'; inherits: true; initial-value: #8db474; }
@property --near { syntax: '<color>'; inherits: true; initial-value: #6f9c5c; }
@property --cloud { syntax: '<color>'; inherits: true; initial-value: #f7dccb; }

.lp-scene { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
/* 動きを減らす設定: 章ごとの色へ静かに切り替える */
.lp-scene--still { transition: --sky-top 0.9s ease, --sky-bottom 0.9s ease, --ridge 0.9s ease, --far 0.9s ease, --mid 0.9s ease, --near 0.9s ease, --cloud 0.9s ease; }

.lp-scene__sky { position: absolute; inset: 0; background: linear-gradient(180deg, var(--sky-top), var(--sky-bottom)); }
.lp-scene__stars {
  position: absolute; inset: 0 0 40% 0; opacity: var(--stars, 0);
  background-image:
    radial-gradient(1.2px 1.2px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 28% 8%, #fff, transparent),
    radial-gradient(1.6px 1.6px at 44% 22%, #fff, transparent), radial-gradient(1px 1px at 63% 12%, #fff, transparent),
    radial-gradient(1.4px 1.4px at 78% 30%, #fff, transparent), radial-gradient(1px 1px at 90% 9%, #fff, transparent),
    radial-gradient(1px 1px at 8% 44%, #fff, transparent), radial-gradient(1.3px 1.3px at 55% 40%, #fff, transparent),
    radial-gradient(1px 1px at 35% 54%, #fff, transparent), radial-gradient(1px 1px at 84% 50%, #fff, transparent);
  animation: lp-twinkle 4.5s ease-in-out infinite alternate;
}
@keyframes lp-twinkle { to { filter: brightness(0.55); } }

.lp-scene__body { position: absolute; width: 260px; height: 260px; border-radius: 50%; transform: translate(-50%, -50%); }
.lp-scene__body[data-kind='sun'] {
  background: radial-gradient(circle, rgba(255, 250, 225, 1) 0 18%, rgba(255, var(--warm, 220), 160, 0.45) 38%, transparent 70%);
}
.lp-scene__body[data-kind='moon'] {
  width: 200px; height: 200px;
  background: radial-gradient(circle, #f4f2e6 0 14%, rgba(220, 230, 255, 0.22) 30%, transparent 62%);
}

.lp-scene__cloud {
  position: absolute; border-radius: 50%; filter: blur(6px);
  background: radial-gradient(closest-side, var(--cloud), transparent);
  translate: var(--cloud-shift, 0) 0;
  animation: lp-drift 70s ease-in-out infinite alternate;
}
.lp-scene__cloud--1 { width: 460px; height: 140px; top: 12%; left: -6%; opacity: calc(0.85 * var(--cloud-night, 1)); }
.lp-scene__cloud--2 { width: 320px; height: 100px; top: 24%; left: 46%; opacity: calc(0.7 * var(--cloud-night, 1)); animation-duration: 90s; }
.lp-scene__cloud--3 { width: 620px; height: 260px; top: 30%; left: 30%; opacity: calc(var(--cumulus, 0.35) * var(--cloud-night, 1)); animation-duration: 110s; transition: opacity 1.2s ease; }
@keyframes lp-drift { from { transform: translateX(-40px); } to { transform: translateX(80px); } }

.lp-scene__land { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 44vh; }
@media (max-width: 600px) { .lp-scene__land { height: 34vh; } }
.lp-scene__fx { position: absolute; inset: 0; width: 100%; height: 100%; }

@media (prefers-reduced-motion: reduce) {
  .lp-scene__stars, .lp-scene__cloud { animation: none; }
}
```

- [ ] **Step 5: 見出し帯と節気の目盛りを書く**

```tsx
// src/components/lp/LpNav.tsx
// 上部の帯（ロゴ・空の時刻と節気・ログイン）と、PC の右端の二十四節気の目盛り。
// 時刻と節気は背景から配られる p で DOM を直接書き換える（再描画なし）。
import { useEffect, useRef, useState } from 'react';
import { clockLabel, sceneAt, sekkiIndexAt } from '../../lib/lpScene';
import { SEKKI } from '../../lib/sekki';
import { useScrollFrame } from './hooks';
import { subscribeScene } from './sceneStore';

export function LpNav({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  const clockRef = useRef<HTMLSpanElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => subscribeScene((p) => {
    if (clockRef.current) clockRef.current.textContent = `${clockLabel(sceneAt(p).hour)}　${SEKKI[sekkiIndexAt(p)].name}`;
  }), []);
  useScrollFrame(() => setScrolled(window.scrollY > 24));
  return (
    <header className={scrolled ? 'lp-nav is-scrolled' : 'lp-nav'}>
      <a className="lp-nav__brand" href="#top">
        <img src="/icons/yamamatsu-mark-white.svg" alt="" width={26} height={26} />
        <span>Orch.Weather</span>
      </a>
      <span ref={clockRef} className="lp-nav__clock" aria-hidden="true">05:30　立春</span>
      <button type="button" className="lp-nav__login" onClick={onLogin} disabled={loading}>ログイン</button>
    </header>
  );
}

export function SekkiDial() {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => subscribeScene((p) => {
    const i = sekkiIndexAt(p);
    listRef.current?.querySelectorAll('li').forEach((li, k) => li.classList.toggle('is-on', k === i));
  }), []);
  return (
    <ol ref={listRef} className="lp-dial" aria-hidden="true">
      {SEKKI.map((s) => <li key={s.name}>{s.name}</li>)}
    </ol>
  );
}
```

`src/components/lp/lp.css` の末尾に追加する:

```css
/* 上部の帯 */
.lp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 20;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 14px var(--lp-gutter);
  transition: background 0.5s ease, backdrop-filter 0.5s ease;
}
.lp-nav.is-scrolled { background: linear-gradient(180deg, rgba(10, 25, 45, 0.28), rgba(10, 25, 45, 0)); }
.lp-nav__brand { display: inline-flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; font-weight: 700; letter-spacing: 0.02em; }
.lp-nav__clock { font-family: var(--lp-mono); font-size: 12px; letter-spacing: 0.14em; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.25); white-space: nowrap; }
.lp-nav__login {
  justify-self: end;
  min-height: 36px; padding: 0 16px; border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.7); background: transparent; color: #fff;
  font: 700 13px/1 var(--lp-sans); cursor: pointer;
}
.lp-nav__login:focus-visible { outline: 3px solid #ffe7a8; outline-offset: 2px; }
@media (max-width: 480px) { .lp-nav__brand span { display: none; } }

/* PC の節気の目盛り */
.lp-dial {
  position: fixed; right: 20px; top: 50%; transform: translateY(-50%); z-index: 10;
  display: none; flex-direction: column; gap: 3px; margin: 0; padding: 0; list-style: none;
  font-family: var(--lp-mincho); font-size: 11px; letter-spacing: 0.1em; text-align: right;
}
.lp-dial li { opacity: 0.35; transition: opacity 0.4s, font-size 0.4s; }
.lp-dial li.is-on { opacity: 1; font-size: 15px; font-weight: 800; }
@media (min-width: 1024px) { .lp-dial { display: flex; } }
```

- [ ] **Step 6: 通ることを確認する**

Run: `npm test -- src/components/lp/SkyScene.test.tsx`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/components/lp/SkyScene.tsx src/components/lp/scene.css src/components/lp/LpNav.tsx src/components/lp/SkyScene.test.tsx src/components/lp/lp.css
git commit -m "feat(lp): 背景「一日×一年の空」と見出し帯・節気の目盛り"
```

---

### Task 7: 最初の画面と勘の章（Opus）

**Files:**
- Create: `src/components/lp/LpHero.tsx`, `src/components/lp/hero.css`
- Create: `src/components/lp/HunchChapter.tsx`, `src/components/lp/hunch.css`
- Test: `src/components/lp/chapters.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/lp/chapters.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
const logLpDetailOpen = vi.fn();
const logLpMoyoToggle = vi.fn();
vi.mock('../../lib/analytics', () => ({
  logLpChapterView: vi.fn(),
  logLpDetailOpen: (s: string) => logLpDetailOpen(s),
  logLpMoyoToggle: (m: string) => logLpMoyoToggle(m),
}));
import { LpHero } from './LpHero';
import { HunchChapter } from './HunchChapter';
import { sekkiForDate } from '../../lib/sekki';

beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LpHero', () => {
  it('見出し・添える言葉・今日の節気・ボタン下の一行', () => {
    render(<LpHero loading={false} error={null} onLogin={() => {}} onTryGuest={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: '「今年は遅い」が、数字で見える。' })).toBeTruthy();
    expect(screen.getByText('勘を、数字で裏づける。')).toBeTruthy();
    expect(screen.getByText(sekkiForDate(new Date()).name)).toBeTruthy();
    expect(screen.getByText('Googleアカウントですぐにログイン。無料で利用できます')).toBeTruthy();
    expect(screen.getByText('あなたの地域の気温・雨・日照を、去年・5年平均と比べる。')).toBeTruthy();
    expect(screen.getByText('東京・2026年10月5日時点')).toBeTruthy();
  });
  it('今日の節気は見出しより前に置く', () => {
    const { container } = render(<LpHero loading={false} error={null} onLogin={() => {}} onTryGuest={() => {}} />);
    const copy = container.querySelector('.lp-hero__copy')!;
    expect(copy.firstElementChild!.className).toBe('lp-hero__today');
  });
});

describe('HunchChapter（動きを減らす設定＝縦に並べた静止表示）', () => {
  it('3つの勘と数字、結論を出す', () => {
    const { container } = render(<HunchChapter />);
    expect(screen.getByText('今年は、遅い気がする。')).toBeTruthy();
    expect(screen.getByText('雨、多すぎないか。')).toBeTruthy();
    expect(screen.getByText('お日さま、足りてない。')).toBeTruthy();
    expect(container.textContent).toContain('5.9');
    expect(screen.getByRole('heading', { name: '勘を、数字で裏づける。' })).toBeTruthy();
    expect(screen.getByText('東京・2026年の実績')).toBeTruthy();
    // 静止表示では3つの勘をすでに並べているので、結論の下の3行は重ねて出さない
    expect(container.querySelector('.lp-hunch__summary')).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/lp/chapters.test.tsx`
Expected: FAIL（`Failed to resolve import "./LpHero"`）

- [ ] **Step 3: 最初の画面を書く**

```tsx
// src/components/lp/LpHero.tsx
// 0. 最初の画面（夜明け・立春）。見出しがせり上がり、丘の向こうからカードが昇り、札の数字が数え上がる。
import { sekkiForDate } from '../../lib/sekki';
import { useChapterView } from './hooks';
import { LP_FACTS_ASOF } from './lpFacts';
import { CountUp, CtaPair, LineReveal, Shot } from './primitives';
import './hero.css';

export function LpHero({ loading, error, onLogin, onTryGuest }: {
  loading: boolean; error: string | null; onLogin: () => void; onTryGuest: () => void;
}) {
  const ref = useChapterView<HTMLElement>('hero');
  const today = sekkiForDate(new Date());
  return (
    <section ref={ref} id="top" className="lp-ch lp-hero" data-scene="0">
      <div className="lp-hero__copy">
        {/* 今日の節気は見出しの上の小さな札に（縦に積む段数を増やさない） */}
        <p className="lp-hero__today">
          今日は<b>{today.name}</b>
          <span className="lp-hero__kou">{today.kou.name}（{today.kou.reading}）</span>
        </p>
        <LineReveal as="h1" className="lp-hero__title" lines={['「今年は遅い」が、', '数字で見える。']} />
        <p className="lp-hero__sub">勘を、数字で裏づける。</p>
        <p className="lp-hero__use">あなたの地域の気温・雨・日照を、去年・5年平均と比べる。</p>
        <CtaPair loading={loading} onLogin={onLogin} onTryGuest={onTryGuest} />
        <p className="lp-hero__note">Googleアカウントですぐにログイン。無料で利用できます</p>
        {error && <p className="lp-error" role="alert">{error}</p>}
      </div>
      <div className="lp-hero__device">
        <Shot src="/lp/review-card.webp" alt="節気のふりかえりカード（白露）— 去年・5年平均と比べた気温・雨・日照" width={780} height={1114} eager />
        <div className="lp-hero__badge">
          <p className="lp-chip">
            積算温度 去年より<CountUp to={18} delay={1100} />日遅い
          </p>
          <p className="lp-hero__asof">{LP_FACTS_ASOF}</p>
        </div>
      </div>
    </section>
  );
}
```

```css
/* src/components/lp/hero.css — 0. 最初の画面 */
.lp-hero {
  min-height: 100svh;
  display: grid;
  grid-template-columns: 1fr;
  align-content: start;
  gap: 40px;
  padding-top: clamp(96px, 16vh, 160px);
  padding-bottom: 12vh;
}
.lp-hero__title { font-size: clamp(34px, 9.4vw, 92px); line-height: 1.16; }
.lp-hero__sub {
  margin: 18px 0 0;
  font-family: var(--lp-mincho); font-weight: 600;
  font-size: clamp(17px, 2.2vw, 24px); letter-spacing: 0.08em;
  opacity: 0; animation: lp-fade-in 1s var(--lp-ease) 0.6s forwards;
}
.lp-hero__today {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px;
  margin: 0 0 18px; font-size: 12.5px; letter-spacing: 0.06em;
  opacity: 0; animation: lp-fade-in 1s var(--lp-ease) 0.1s forwards;
}
.lp-hero__use {
  margin: 10px 0 26px; max-width: 30em;
  font-size: clamp(14px, 1.6vw, 16px); line-height: 1.8; font-weight: 500;
  opacity: 0; animation: lp-fade-in 1s var(--lp-ease) 0.8s forwards;
}
.lp-hero__today b { font-family: var(--lp-mincho); font-size: 16px; margin-left: 0.3em; }
.lp-hero__kou { opacity: 0.85; }
.lp-hero__note { margin: 14px 0 0; font-size: 12.5px; letter-spacing: 0.04em; opacity: 0.9; }
.lp-hero .lp-cta-pair { opacity: 0; animation: lp-fade-in 1s var(--lp-ease) 1s forwards; }

.lp-hero__device { position: relative; justify-self: center; width: min(68vw, 330px); }
.lp-hero__device .lp-shot { transform: rotate(-3deg); animation: lp-rise 1.7s var(--lp-ease) 0.3s both; }
.lp-hero__badge { position: absolute; right: -10px; top: -22px; display: grid; justify-items: end; gap: 6px; animation: lp-fade-in 0.8s var(--lp-ease) 1.1s both; }
.lp-hero__asof { margin: 0; padding-right: 6px; font-family: var(--lp-mono); font-size: 10.5px; letter-spacing: 0.08em; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3); }

@keyframes lp-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes lp-rise { from { opacity: 0; transform: translateY(140px) rotate(-3deg); } to { opacity: 1; transform: rotate(-3deg); } }

@media (min-width: 960px) {
  .lp-hero { grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); align-items: center; align-content: center; padding-top: 110px; }
  .lp-hero__device { width: min(30vw, 380px); }
}

@media (prefers-reduced-motion: reduce) {
  .lp-hero__sub, .lp-hero__today, .lp-hero__use, .lp-hero .lp-cta-pair, .lp-hero__badge { animation: none; opacity: 1; }
  .lp-hero__device .lp-shot { animation: none; }
}
```

- [ ] **Step 4: 勘の章を書く**

```tsx
// src/components/lp/HunchChapter.tsx
// 1. 勘の章（朝・春）＝最大の見せ場。画面を止めたまま、スクロールで3つの勘を順に見せ、
// 言葉が一文字ずつ溶けて数字が数え上がる。最後に「勘を、数字で裏づける。」と、3つの比較結果を小さく残す。
// 動きを減らす設定では、縦に並べた静止表示にする。
import { useState, type CSSProperties } from 'react';
import { HUNCHES, LP_FACTS_SOURCE, hunchSummary, type Hunch } from './lpFacts';
import { stickyProgress, useChapterView, useReduced, useScrollFrame } from './hooks';
import { CountUp, LineReveal } from './primitives';
import './hunch.css';

function Fact({ h, start }: { h: Hunch; start: boolean }) {
  return (
    <div className="lp-fact">
      <p className="lp-fact__label">{h.label}</p>
      <p className="lp-fact__value">
        <span className="lp-fact__before">{h.before}</span>
        <CountUp to={h.value} decimals={h.decimals} start={start} duration={1200} />
        <span className="lp-fact__unit">{h.unit}</span>
      </p>
      <p className="lp-fact__note">{h.note}</p>
    </div>
  );
}

/** 結論。summary=true なら、その下に3つの比較結果を落ち着いた文字で残す（動きを減らす設定では、
 *  すでに3つの勘と数字を縦に並べているので重ねて出さない） */
function Conclusion({ summary = false }: { summary?: boolean }) {
  return (
    <div className="lp-hunch__end">
      <LineReveal lines={['勘を、', '数字で裏づける。']} />
      {summary && (
        <ul className="lp-hunch__summary">
          {HUNCHES.map((h, i) => (
            <li key={h.topic} style={{ '--i': i } as CSSProperties}>{hunchSummary(h)}</li>
          ))}
        </ul>
      )}
      <p className="lp-hunch__source">{LP_FACTS_SOURCE}</p>
    </div>
  );
}

export function HunchChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('hunch');
  const [stage, setStage] = useState(0); // 0〜2=勘、3=結論
  const [phase, setPhase] = useState<'quote' | 'fact'>('quote');

  useScrollFrame(() => {
    if (reduced || !ref.current) return;
    const x = stickyProgress(ref.current) * 3.6; // 勘3つ（各1）＋結論（0.6）
    const st = Math.min(3, Math.floor(x));
    setStage(st);
    setPhase(st < 3 && x - st < 0.42 ? 'quote' : 'fact');
  });

  if (reduced) {
    return (
      <section ref={ref} className="lp-ch lp-hunch lp-hunch--still" data-scene="0.1">
        <ol className="lp-hunch__list">
          {HUNCHES.map((h) => (
            <li key={h.quote}>
              <p className="lp-hunch__quote">{h.quote}</p>
              <Fact h={h} start />
            </li>
          ))}
        </ol>
        <Conclusion />
      </section>
    );
  }

  const h = HUNCHES[Math.min(stage, 2)];
  return (
    <section ref={ref} className="lp-ch lp-hunch" data-scene="0.1">
      <div className="lp-hunch__stage">
        {stage < 3 ? (
          <div key={stage} className={`lp-hunch__item is-${phase}`}>
            <p className="lp-hunch__quote" aria-label={h.quote}>
              {[...h.quote].map((c, i) => (
                <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>{c}</span>
              ))}
            </p>
            <Fact h={h} start={phase === 'fact'} />
          </div>
        ) : (
          <Conclusion summary />
        )}
        <div className="lp-hunch__meter" aria-hidden="true">
          {[0, 1, 2].map((i) => <i key={i} className={i <= stage ? 'is-on' : ''} />)}
        </div>
      </div>
    </section>
  );
}
```

```css
/* src/components/lp/hunch.css — 1. 勘の章 */
.lp-hunch { height: 420vh; padding: 0; }
.lp-hunch__stage {
  position: sticky; top: 0; height: 100svh;
  display: grid; place-items: center; padding: 0 var(--lp-gutter);
}
.lp-hunch__item { display: grid; width: min(100%, 880px); animation: lp-hunch-in 0.9s var(--lp-ease) both; }
.lp-hunch__item > * { grid-area: 1 / 1; }
@keyframes lp-hunch-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }

.lp-hunch__quote {
  margin: 0; align-self: center;
  font-family: var(--lp-mincho); font-weight: 800; font-feature-settings: 'palt';
  font-size: clamp(30px, 8.4vw, 76px); line-height: 1.3;
  text-shadow: 0 2px 28px rgba(20, 50, 80, 0.3);
}
.lp-hunch__quote span {
  display: inline-block;
  transition: opacity 0.7s ease, filter 0.7s ease, transform 0.7s var(--lp-ease);
  transition-delay: calc(var(--i) * 28ms);
}
.lp-hunch__item.is-fact .lp-hunch__quote span { opacity: 0; filter: blur(10px); transform: translateY(-0.35em); }

.lp-fact { align-self: center; opacity: 0; transform: translateY(18px); transition: opacity 0.9s ease 0.35s, transform 0.9s var(--lp-ease) 0.35s; }
.lp-hunch__item.is-fact .lp-fact { opacity: 1; transform: none; }
.lp-fact__label { margin: 0 0 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; opacity: 0.92; }
.lp-fact__value { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 12px; margin: 0; line-height: 1; }
.lp-fact__before { font-family: var(--lp-mincho); font-weight: 800; font-size: clamp(20px, 3vw, 30px); }
.lp-fact__value .lp-num { font-size: clamp(76px, 22vw, 180px); letter-spacing: -0.04em; }
.lp-fact__unit { font-family: var(--lp-mincho); font-weight: 800; font-size: clamp(22px, 3.4vw, 36px); }
.lp-fact__note { margin: 14px 0 0; font-size: 14px; opacity: 0.88; }

.lp-hunch__end { text-align: left; width: min(100%, 880px); }
.lp-hunch__end .lp-lines { font-size: clamp(40px, 10vw, 104px); }
.lp-hunch__summary { display: grid; gap: 0; max-width: 26em; margin: 30px 0 0; padding: 0; list-style: none; font-size: clamp(14px, 1.8vw, 17px); font-weight: 500; }
.lp-hunch__summary li {
  padding: 9px 0; border-top: 1px solid rgba(255, 255, 255, 0.3);
  opacity: 0; transform: translateY(8px);
  animation: lp-summary-in 0.7s var(--lp-ease) calc(0.9s + var(--i) * 0.22s) forwards;
}
.lp-hunch__summary li:last-child { border-bottom: 1px solid rgba(255, 255, 255, 0.3); }
@keyframes lp-summary-in { to { opacity: 1; transform: none; } }
.lp-hunch__source { margin: 18px 0 0; font-family: var(--lp-mono); font-size: 12px; letter-spacing: 0.14em; opacity: 0.85; }

.lp-hunch__meter { position: absolute; left: var(--lp-gutter); bottom: 9vh; display: flex; gap: 6px; }
.lp-hunch__meter i { display: block; width: 28px; height: 3px; border-radius: 2px; background: rgba(255, 255, 255, 0.35); transition: background 0.4s; }
.lp-hunch__meter i.is-on { background: #fff; }

/* 動きを減らす設定（縦に並べた静止表示） */
.lp-hunch--still { height: auto; padding: 18vh var(--lp-gutter); }
.lp-hunch__list { display: grid; gap: 64px; margin: 0 0 80px; padding: 0; list-style: none; }
.lp-hunch--still .lp-hunch__quote { font-size: clamp(26px, 6vw, 48px); margin-bottom: 18px; }
.lp-hunch--still .lp-fact { opacity: 1; transform: none; }
.lp-hunch--still .lp-fact__value .lp-num { font-size: clamp(56px, 14vw, 120px); }
```

- [ ] **Step 5: 通ることを確認する**

Run: `npm test -- src/components/lp/chapters.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/lp/LpHero.tsx src/components/lp/hero.css src/components/lp/HunchChapter.tsx src/components/lp/hunch.css src/components/lp/chapters.test.tsx
git commit -m "feat(lp): 最初の画面と勘の章（言葉が数字に組み変わる）"
```

---

### Task 8: 節気のふりかえりと空くらべ（Sonnet）

**Files:**
- Create: `src/components/lp/SekkiChapter.tsx`, `src/components/lp/sekki.css`
- Create: `src/components/lp/KurabeChapter.tsx`, `src/components/lp/kurabe.css`
- Modify: `src/components/lp/chapters.test.tsx`（テストを追加）

- [ ] **Step 1: 失敗するテストを足す**

`src/components/lp/chapters.test.tsx` の import に追加:

```tsx
import { SekkiChapter } from './SekkiChapter';
import { KurabeChapter } from './KurabeChapter';
```

末尾に追加:

```tsx
describe('SekkiChapter', () => {
  it('見出し・縦書きの添え書き・24の節気・ふりかえりカード', () => {
    const { container } = render(<SekkiChapter />);
    expect(screen.getByRole('heading', { name: '二十四節気ごとに、今年の半月を一枚に。' })).toBeTruthy();
    expect(screen.getByText('暦は、農の時計だった。')).toBeTruthy();
    expect(container.querySelectorAll('.lp-sekki__tile')).toHaveLength(24);
    expect(screen.getByAltText(/節気のふりかえりカード（処暑）/)).toBeTruthy();
  });
});

describe('KurabeChapter', () => {
  it('見出し・模式図・3つの要点・本物の画面2枚', () => {
    render(<KurabeChapter />);
    expect(screen.getByRole('heading', { name: '去年と、あの場所と、並べて見える。' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /今年の線は去年より18日遅れて伸びる/ })).toBeTruthy();
    expect(screen.getByText('図は模式です。数字は東京・2026年の実績（1月1日から・10℃基準）。')).toBeTruthy();
    for (const t of ['年をまたいで、重ねて比べる', '地点を並べて、違いを比べる', '積算温度を、自動で計算']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /空くらべ/ })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/lp/chapters.test.tsx`
Expected: FAIL（`Failed to resolve import "./SekkiChapter"`）

- [ ] **Step 3: 節気のふりかえりを書く**

```tsx
// src/components/lp/SekkiChapter.tsx
// 2. 節気のふりかえり（昼前・初夏）。縦スクロールで24枚の節気の水彩画が横へ流れ、
// 処暑で止まって本物のふりかえりカードがせり上がる。動きを減らす設定では横にスワイプできる静止表示。
import { useRef, useState, type CSSProperties } from 'react';
import { SEKKI } from '../../lib/sekki';
import { SekkiArt } from '../sky/sekkiArt';
import { stickyProgress, useChapterView, useReduced, useScrollFrame } from './hooks';
import { LineReveal, Shot } from './primitives';
import './sekki.css';

/** 季節ごとの台の色（白い絵が映える深さ）。春・夏・秋・冬 */
const TILE_BASE = ['#6f9cc4', '#2f6fae', '#a2643a', '#4b5d7a'];
/** 止める節気＝撮影したカードの節気（処暑） */
const FOCUS = 13;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function SekkiChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('sekki');
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(false);

  useScrollFrame(() => {
    const pin = pinRef.current;
    const track = trackRef.current;
    if (reduced || !pin || !track) return;
    const p = stickyProgress(pin);
    const focus = track.children[FOCUS] as HTMLElement | undefined;
    if (!focus) return;
    const target = focus.offsetLeft + focus.offsetWidth / 2 - window.innerWidth / 2;
    track.style.transform = `translate3d(${(-target * easeInOut(Math.min(1, p / 0.6))).toFixed(1)}px, 0, 0)`;
    setShown(p > 0.62);
  });

  const cls = ['lp-ch', 'lp-sekki', reduced ? 'lp-sekki--still' : '', shown || reduced ? 'is-shown' : ''].filter(Boolean).join(' ');
  return (
    <section ref={ref} className={cls} data-scene="0.27">
      <div ref={pinRef} className="lp-sekki__pin">
      <div className="lp-sekki__stage">
        <div className="lp-sekki__head">
          <LineReveal lines={['二十四節気ごとに、', '今年の半月を一枚に。']} />
          <p className="lp-vertical lp-sekki__aside">暦は、農の時計だった。</p>
        </div>
        <div className="lp-sekki__body">
        <div className="lp-sekki__rail">
          <ol ref={trackRef} className="lp-sekki__track">
            {SEKKI.map((s, i) => (
              <li
                key={s.name}
                className={i === FOCUS ? 'lp-sekki__tile is-focus' : 'lp-sekki__tile'}
                style={{ '--tile': TILE_BASE[Math.floor(i / 6)] } as CSSProperties}
              >
                <SekkiArt index={i} size={72} variant="backdrop" />
                <span className="lp-sekki__name">{s.name}</span>
                <span className="lp-sekki__reading">{s.reading}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="lp-sekki__card">
          <Shot src="/lp/review-card-2.webp" alt="節気のふりかえりカード（処暑）— 去年・5年平均と比べた気温・雨・日照" width={780} height={1114} />
        </div>
        </div>
      </div>
      </div>
      <div className="lp-sekki__band">
        <p className="lp-sekki__bandlead">毎日、トップに一行で。</p>
        <Shot variant="band" src="/lp/season-band.webp" alt="季節のあしどり — 積算温度 去年より18日遅い・5年平均より12日遅い" width={780} height={106} />
      </div>
    </section>
  );
}
```

```css
/* src/components/lp/sekki.css — 2. 節気のふりかえり */
.lp-sekki { padding: 0; }
/* 画面を止める区間（この中で stage が止まる）。帯はこの後に続く */
.lp-sekki__pin { height: 300vh; }
/* 見出し → 本体（節気の列＋カード）。本体は残りの高さをすべて使い、カードはその高さに収まる大きさにする */
.lp-sekki__stage { position: sticky; top: 0; height: 100svh; overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr); padding-top: clamp(84px, 13vh, 130px); }
.lp-sekki__head { position: relative; padding: 0 calc(var(--lp-gutter) + 40px) 0 var(--lp-gutter); }
/* 縦書きは見出しの行の高さを押し広げないよう、右端に浮かせる */
.lp-sekki__aside { position: absolute; top: 0; right: var(--lp-gutter); white-space: nowrap; }
/* スマホは縦書きを置く幅が無いので、見出しの下に横書きの一行で添える */
@media (max-width: 599px) {
  .lp-sekki__head { padding-right: var(--lp-gutter); }
  .lp-sekki__aside { position: static; writing-mode: horizontal-tb; margin-top: 10px; font-size: 13px; letter-spacing: 0.2em; }
}

.lp-sekki__body { position: relative; min-height: 0; margin-top: clamp(18px, 4vh, 40px); container-type: size; }
.lp-sekki__rail { transition: opacity 0.8s ease; }
.lp-sekki.is-shown .lp-sekki__rail { opacity: 0.22; }
.lp-sekki__track { display: flex; gap: 12px; margin: 0; padding: 12px 50vw 0 var(--lp-gutter); list-style: none; will-change: transform; }
.lp-sekki__tile {
  flex: none; width: 92px; height: 124px; border-radius: 14px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--tile) 82%, #fff), var(--tile));
  display: grid; justify-items: center; align-content: center; gap: 2px;
  box-shadow: 0 16px 30px -18px rgba(10, 30, 50, 0.55);
  transition: transform 0.6s var(--lp-ease), box-shadow 0.6s var(--lp-ease), outline-color 0.6s;
  outline: 2px solid transparent; outline-offset: 3px;
}
.lp-sekki__name { font-family: var(--lp-mincho); font-weight: 800; font-size: 15px; }
.lp-sekki__reading { font-size: 9.5px; letter-spacing: 0.06em; opacity: 0.85; }
.lp-sekki.is-shown .lp-sekki__tile.is-focus { transform: translateY(-10px) scale(1.08); outline-color: #fff; }

/* カードは本体の上に重ねて出す。幅は「残りの高さ（cqh）に全体が収まる幅」「画面幅」「380px」の小さい方 */
.lp-sekki__card {
  position: absolute; inset: 0 0 2.5vh; display: flex; justify-content: center; align-items: flex-start; pointer-events: none;
  opacity: 0; transform: translateY(80px); transition: opacity 0.9s ease, transform 1.1s var(--lp-ease);
}
.lp-sekki__card .lp-shot { width: min(86vw, 380px, calc(97cqh * 780 / 1114)); }
.lp-sekki.is-shown .lp-sekki__card { opacity: 1; transform: none; }

.lp-sekki__band { padding: 8vh var(--lp-gutter) 16vh; display: grid; justify-items: center; gap: 14px; }
.lp-sekki__band .lp-shot { width: min(88vw, 520px); }
.lp-sekki__bandlead { margin: 0; font-family: var(--lp-mincho); font-weight: 800; font-size: clamp(20px, 3.4vw, 30px); }

@media (min-width: 960px) {
  .lp-sekki__tile { width: 120px; height: 158px; }
}

/* 動きを減らす設定 */
.lp-sekki--still .lp-sekki__pin { height: auto; }
.lp-sekki--still .lp-sekki__stage { position: static; height: auto; overflow: visible; display: block; }
.lp-sekki--still .lp-sekki__body { container-type: normal; }
.lp-sekki--still .lp-sekki__rail { overflow-x: auto; -webkit-overflow-scrolling: touch; opacity: 1; }
.lp-sekki--still .lp-sekki__track { padding-right: var(--lp-gutter); }
.lp-sekki--still .lp-sekki__card { position: static; opacity: 1; transform: none; margin-top: 28px; }
.lp-sekki--still .lp-sekki__card .lp-shot { width: min(74vw, 340px); }
@media (prefers-reduced-motion: reduce) { .lp-sekki__tile, .lp-sekki__card, .lp-sekki__rail { transition: none; } }
```

- [ ] **Step 4: 空くらべを書く**

```tsx
// src/components/lp/KurabeChapter.tsx
// 3. 空くらべ（昼・夏）。画面を止めて、積算温度の模式図の線がスクロールで伸び、
// 今年と去年の間に「18日」の差が現れる。続けて3つの要点が順に灯り、本物の画面2枚を見せる。
import { useRef, useState } from 'react';
import { GDD_LAG_DAYS, LP_FACTS_SOURCE, gddCurve } from './lpFacts';
import { stickyProgress, useChapterView, useReduced, useScrollFrame } from './hooks';
import { LineReveal, Shot } from './primitives';
import './kurabe.css';

// 模式図の範囲: 3月1日（60日目）〜11月30日（334日目）。撮影日は 10/5（278日目）
const D0 = 60;
const D1 = 334;
const TODAY = 278;
const X = (d: number) => 40 + ((d - D0) / (D1 - D0)) * 560;
const Y = (v: number) => 280 - (v / 3000) * 250;

function curvePath(lag: number, until: number): string {
  const pts: string[] = [];
  for (let d = D0; d <= until; d += 3) pts.push(`${X(d).toFixed(1)} ${Y(gddCurve(d, lag)).toFixed(1)}`);
  return `M${pts.join(' L')}`;
}

const LAST_YEAR = curvePath(0, D1);
const THIS_YEAR = curvePath(GDD_LAG_DAYS, TODAY);
const GAP_Y = Y(gddCurve(TODAY, GDD_LAG_DAYS));
const GAP_X0 = X(TODAY - GDD_LAG_DAYS);
const GAP_X1 = X(TODAY);
const MONTHS: [string, number][] = [['4月', 91], ['6月', 152], ['8月', 213], ['10月', 274]];
const POINTS = ['年をまたいで、重ねて比べる', '地点を並べて、違いを比べる', '積算温度を、自動で計算'];

export function KurabeChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('kurabe');
  const pinRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useScrollFrame(() => {
    if (reduced || !pinRef.current) return;
    setP(stickyProgress(pinRef.current));
  });
  const q = reduced ? 1 : p;
  const draw = Math.min(1, q / 0.5);
  const gapOn = q > 0.56;
  const lit = reduced ? 3 : [0.64, 0.74, 0.84].filter((t) => q > t).length;

  return (
    <section ref={ref} className={reduced ? 'lp-ch lp-kurabe lp-kurabe--still' : 'lp-ch lp-kurabe'} data-scene="0.4">
      <div ref={pinRef} className="lp-kurabe__pin">
      <div className="lp-kurabe__stage">
        <LineReveal lines={['去年と、あの場所と、', '並べて見える。']} />
        <figure className="lp-kurabe__fig">
          <svg viewBox="0 0 640 320" role="img" aria-label="積算温度の模式図。今年の線は去年より18日遅れて伸びる">
            <line className="lp-kurabe__axis" x1="40" y1="280" x2="600" y2="280" />
            {MONTHS.map(([m, d]) => (
              <text key={m} className="lp-kurabe__tick" x={X(d)} y="304">{m}</text>
            ))}
            <path className="lp-kurabe__line lp-kurabe__line--last" d={LAST_YEAR} pathLength={1} style={{ strokeDashoffset: 1 - draw }} />
            <path className="lp-kurabe__line lp-kurabe__line--this" d={THIS_YEAR} pathLength={1} style={{ strokeDashoffset: 1 - draw }} />
            <text className="lp-kurabe__legend" x={X(318)} y={Y(gddCurve(318)) - 12}>去年</text>
            <text className="lp-kurabe__legend lp-kurabe__legend--this" x={X(TODAY) + 8} y={Y(gddCurve(TODAY, GDD_LAG_DAYS)) + 26}>今年</text>
            <g className={gapOn ? 'lp-kurabe__gap is-on' : 'lp-kurabe__gap'}>
              <line x1={GAP_X0} x2={GAP_X1} y1={GAP_Y} y2={GAP_Y} />
              <line x1={GAP_X0} x2={GAP_X0} y1={GAP_Y - 6} y2={GAP_Y + 6} />
              <line x1={GAP_X1} x2={GAP_X1} y1={GAP_Y - 6} y2={GAP_Y + 6} />
              <text x={(GAP_X0 + GAP_X1) / 2} y={GAP_Y - 14}>18日</text>
            </g>
          </svg>
          <figcaption>図は模式です。数字は{LP_FACTS_SOURCE}（1月1日から・10℃基準）。</figcaption>
        </figure>
        <ul className="lp-kurabe__points">
          {POINTS.map((t, i) => <li key={t} className={i < lit ? 'is-on' : ''}>{t}</li>)}
        </ul>
      </div>
      </div>
      <div className="lp-kurabe__shots">
        <Shot src="/lp/kurabe-temp.webp" alt="空くらべ — 今年と去年の気温を重ねたグラフ" width={780} height={1157} />
        <Shot src="/lp/kurabe-gdd.webp" alt="空くらべ — 有効積算温度のグラフ（今年と去年）" width={780} height={1253} />
      </div>
    </section>
  );
}
```

```css
/* src/components/lp/kurabe.css — 3. 空くらべ */
.lp-kurabe { padding: 0; }
/* 画面を止める区間（この中で stage が止まる）。写真2枚はこの後に続く */
.lp-kurabe__pin { height: 240vh; }
.lp-kurabe__stage { position: sticky; top: 0; height: 100svh; display: grid; align-content: center; gap: clamp(16px, 3vh, 28px); padding: 0 var(--lp-gutter); }

.lp-kurabe__fig { margin: 0; width: min(100%, 760px); }
.lp-kurabe__fig svg { display: block; width: 100%; height: auto; overflow: visible; }
.lp-kurabe__fig figcaption { margin-top: 8px; font-size: 11.5px; opacity: 0.85; }
.lp-kurabe__axis { stroke: rgba(255, 255, 255, 0.55); stroke-width: 1; }
.lp-kurabe__tick { fill: rgba(255, 255, 255, 0.85); font: 500 12px var(--lp-mono); text-anchor: middle; }
.lp-kurabe__line { fill: none; stroke-dasharray: 1; stroke-linecap: round; }
.lp-kurabe__line--last { stroke: rgba(255, 255, 255, 0.85); stroke-width: 2.2; }
.lp-kurabe__line--this { stroke: #e9ffd6; stroke-width: 3.6; filter: drop-shadow(0 2px 8px rgba(20, 60, 30, 0.35)); }
.lp-kurabe__legend { fill: #fff; font: 700 13px var(--lp-sans); }
.lp-kurabe__legend--this { fill: #e9ffd6; }
.lp-kurabe__gap { opacity: 0; transition: opacity 0.6s ease; }
.lp-kurabe__gap.is-on { opacity: 1; }
.lp-kurabe__gap line { stroke: #ffe7a8; stroke-width: 2; }
.lp-kurabe__gap text { fill: #ffe7a8; font: 500 22px var(--lp-mono); text-anchor: middle; }

.lp-kurabe__points { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; font-weight: 700; font-size: clamp(15px, 2vw, 19px); }
.lp-kurabe__points li { opacity: 0.3; transform: translateX(-8px); transition: opacity 0.5s ease, transform 0.6s var(--lp-ease); }
.lp-kurabe__points li.is-on { opacity: 1; transform: none; }

.lp-kurabe__shots { display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; padding: 0 var(--lp-gutter) 16vh; }
.lp-kurabe__shots .lp-shot { width: min(80vw, 330px); }
.lp-kurabe__shots .lp-shot:nth-child(2) { transform: translateY(48px); }

.lp-kurabe--still { padding: 14vh 0 0; }
.lp-kurabe--still .lp-kurabe__pin { height: auto; }
.lp-kurabe--still .lp-kurabe__stage { position: static; height: auto; margin-bottom: 64px; }
@media (prefers-reduced-motion: reduce) { .lp-kurabe__points li, .lp-kurabe__gap { transition: none; } }
```

**注意（実装者へ）:** 画面を止める演出は「背の高い入れ物（`__pin`）の中で `__stage` を sticky にする」形に統一する。進み具合は入れ物に対して取る（`stickyProgress(pinRef.current)`）。こうすると、止める区間が終わってから写真や帯が下から現れ、重ならない。

- [ ] **Step 5: 通ることを確認する**

Run: `npm test -- src/components/lp/chapters.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/lp/SekkiChapter.tsx src/components/lp/sekki.css src/components/lp/KurabeChapter.tsx src/components/lp/kurabe.css src/components/lp/chapters.test.tsx
git commit -m "feat(lp): 節気のふりかえり（横に流れる24節気）と空くらべ（描かれる線と18日の差）"
```

---

### Task 9: 空もよう・作った人＋詳しく読む・最後のボタン＋フッター（Sonnet）

**Files:**
- Create: `src/components/lp/MoyoChapter.tsx`, `src/components/lp/moyo.css`
- Create: `src/components/lp/LpDetails.tsx`
- Create: `src/components/lp/MakerChapter.tsx`, `src/components/lp/maker.css`
- Create: `src/components/lp/FinalChapter.tsx`, `src/components/lp/final.css`
- Modify: `src/components/lp/chapters.test.tsx`（テストを追加）

- [ ] **Step 1: 失敗するテストを足す**

`src/components/lp/chapters.test.tsx` の import に追加する（analytics の mock と `fireEvent` はタスク7で用意済み）:

```tsx
import { MoyoChapter } from './MoyoChapter';
import { MakerChapter } from './MakerChapter';
import { FinalChapter, LpFooter } from './FinalChapter';
```

末尾に追加:

```tsx
describe('MoyoChapter', () => {
  it('見出し・雨のことば。最初は「リスクでみる」', () => {
    const { container } = render(<MoyoChapter />);
    expect(screen.getByRole('heading', { name: '今日の作業、やるかやめるかすぐ決まる。' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'リスクでみる' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('その時間帯の、いちばん悪い天気')).toBeTruthy();
    expect(container.querySelector('.lp-moyo__phone img.is-on')!.getAttribute('src')).toBe('/lp/moyo-risk.webp');
    for (const w of ['ぽつぽつ', 'カッパ？', 'カッパ！']) expect(screen.getByText(w)).toBeTruthy();
  });
  it('押すと写真と説明が一緒に切り替わり、GA4 に記録する（動きを減らす設定でも押せる）', () => {
    const { container } = render(<MoyoChapter />);
    fireEvent.click(screen.getByRole('button', { name: '概況でみる' }));
    expect(screen.getByRole('button', { name: '概況でみる' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'リスクでみる' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('その時間帯の、いちばん多い天気')).toBeTruthy();
    expect(container.querySelector('.lp-moyo__phone img.is-on')!.getAttribute('src')).toBe('/lp/moyo-gaikyo.webp');
    expect(logLpMoyoToggle).toHaveBeenCalledWith('gaikyo');
  });
});

describe('MakerChapter', () => {
  it('作った人の一行と、詳しく読む層3つ（開くと GA4 に記録）', () => {
    const { container } = render(<MakerChapter />);
    expect(screen.getByRole('heading', { name: '現場で欲しかったものを、自分で作った。' })).toBeTruthy();
    expect(container.querySelectorAll('details.lp-details')).toHaveLength(3);
    const faq = container.querySelector<HTMLDetailsElement>('details[data-section="faq"]')!;
    faq.open = true;
    fireEvent(faq, new Event('toggle'));
    expect(logLpDetailOpen).toHaveBeenCalledWith('faq');
    expect(screen.getByText('※予定')).toBeTruthy();
  });
});

describe('FinalChapter / LpFooter', () => {
  it('今日の節気・見出し・ボタン2つ、フッターの注意書き', () => {
    const onTryGuest = vi.fn();
    render(<><FinalChapter loading={false} onLogin={() => {}} onTryGuest={onTryGuest} /><LpFooter /></>);
    expect(screen.getByText(`今日は${sekkiForDate(new Date()).name}。`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: '今年の季節を、数字で見てみる。' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ログインせずに試す/ }));
    expect(onTryGuest).toHaveBeenCalled();
    expect(screen.getByText('ご利用上の注意')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/lp/chapters.test.tsx`
Expected: FAIL（`Failed to resolve import "./MoyoChapter"`）

- [ ] **Step 3: 空もようを書く**

```tsx
// src/components/lp/MoyoChapter.tsx
// 4. 空もよう（午後・晩夏）。「リスクでみる／概況でみる」を押すと、写真と説明が一緒に切り替わる。
// 押されるまでは、見えている間だけ自動で切り替える（最初はリスク）。一度押したら自動切替は止める。
// 動きを減らす設定では、自動切替と切り替えの動きだけを止め、押して切り替える操作は同じにする。
import { useEffect, useState, type CSSProperties } from 'react';
import { logLpMoyoToggle } from '../../lib/analytics';
import { useChapterView, useReduced, useVisibility } from './hooks';
import { LineReveal } from './primitives';
import './moyo.css';

const MODES = [
  { key: 'risk', label: 'リスクでみる', caption: 'その時間帯の、いちばん悪い天気', src: '/lp/moyo-risk.webp' },
  { key: 'gaikyo', label: '概況でみる', caption: 'その時間帯の、いちばん多い天気', src: '/lp/moyo-gaikyo.webp' },
] as const;
const RAIN_WORDS = ['ぽつぽつ', 'カッパ？', 'カッパ！'];
const POINTS = ['1日を、午前・午後・夜間の3つに', '露点・飽差・0℃層高度も、時間別に', '毎日、今日の節気と七十二候'];

export function MoyoChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('moyo');
  const [deviceRef, visible, seen] = useVisibility<HTMLDivElement>(0.35);
  const [mode, setMode] = useState(0);
  const [touched, setTouched] = useState(false);
  // 押されるまで・見えている間だけ自動で切り替える（画面外ではタイマーを止める）
  useEffect(() => {
    if (reduced || touched || !visible) return;
    const id = window.setInterval(() => setMode((m) => 1 - m), 3200);
    return () => window.clearInterval(id);
  }, [reduced, touched, visible]);

  const choose = (i: number) => {
    setTouched(true);
    setMode(i);
    logLpMoyoToggle(MODES[i].key);
  };

  return (
    <section ref={ref} className={reduced ? 'lp-ch lp-moyo lp-moyo--still' : 'lp-ch lp-moyo'} data-scene="0.47">
      <div className="lp-moyo__copy">
        <LineReveal lines={['今日の作業、', 'やるかやめるか', 'すぐ決まる。']} />
        <div className="lp-moyo__modes" role="group" aria-label="空もようの見方">
          {MODES.map((m, i) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={i === mode}
              aria-controls="lp-moyo-screen"
              className={i === mode ? 'is-on' : ''}
              onClick={() => choose(i)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="lp-moyo__hint">タップで切り替え</p>
        {/* 自動で切り替わる間は読み上げない（3.2秒ごとの読み上げを避ける）。押した後だけ知らせる */}
        <p className="lp-moyo__caption" aria-live={touched ? 'polite' : 'off'}>{MODES[mode].caption}</p>
        <ul className="lp-moyo__points">
          {POINTS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
      <div ref={deviceRef} className={seen || reduced ? 'lp-moyo__device is-in' : 'lp-moyo__device'}>
        <figure id="lp-moyo-screen" className="lp-shot lp-shot--phone lp-moyo__phone">
          {MODES.map((m, i) => (
            <img
              key={m.key}
              src={m.src}
              alt={`空もよう — ${m.label}`}
              aria-hidden={i !== mode}
              width={780}
              height={1688}
              loading="lazy"
              decoding="async"
              className={i === mode ? 'is-on' : ''}
            />
          ))}
        </figure>
        <ul className="lp-moyo__rain" aria-label="3mmまでの雨の言い方">
          {RAIN_WORDS.map((w, i) => <li key={w} style={{ '--i': i } as CSSProperties}>{w}</li>)}
        </ul>
        <p className="lp-moyo__rainnote">3mmまでの雨は、3段階のことばで。</p>
      </div>
    </section>
  );
}
```

```css
/* src/components/lp/moyo.css — 4. 空もよう */
.lp-moyo { display: grid; gap: 56px; padding-top: 18vh; padding-bottom: 18vh; }
.lp-moyo__modes { display: inline-flex; margin-top: 28px; padding: 4px; border-radius: 999px; background: rgba(255, 255, 255, 0.22); backdrop-filter: blur(6px); }
.lp-moyo__modes button {
  min-height: 40px; padding: 0 18px; border: 0; border-radius: 999px;
  background: transparent; color: #fff; font: 700 13px/1 var(--lp-sans); cursor: pointer;
  transition: background 0.5s ease, color 0.5s ease;
}
.lp-moyo__modes button.is-on { background: #fff; color: var(--lp-ink); }
.lp-moyo__modes button:focus-visible { outline: 3px solid #ffe7a8; outline-offset: 2px; }
.lp-moyo__hint { margin: 8px 0 0 8px; font-size: 11.5px; letter-spacing: 0.08em; opacity: 0.85; }
.lp-moyo__caption { margin: 12px 0 0; min-height: 1.5em; font-family: var(--lp-mincho); font-weight: 800; font-size: clamp(18px, 2.6vw, 24px); }
.lp-moyo__points { margin: 26px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 14.5px; font-weight: 500; }
.lp-moyo__points li::before { content: '— '; opacity: 0.7; }

.lp-moyo__device { position: relative; justify-self: center; width: min(66vw, 300px); }
.lp-moyo__phone { position: relative; }
.lp-moyo__phone img { transition: opacity 0.9s ease; }
.lp-moyo__phone img + img { position: absolute; inset: 9px; width: calc(100% - 18px); }
.lp-moyo__phone img:not(.is-on) { opacity: 0; }

.lp-moyo__rain { position: absolute; inset: 0; margin: 0; padding: 0; list-style: none; pointer-events: none; }
.lp-moyo__rain li {
  position: absolute;
  padding: 7px 13px; border-radius: 999px;
  background: #fff; color: var(--lp-ink); font-weight: 700; font-size: 13px;
  box-shadow: 0 12px 24px -12px rgba(10, 30, 50, 0.5);
  opacity: 0; transform: translateY(-60px);
}
.lp-moyo__rain li:nth-child(1) { left: -18%; top: 30%; }
.lp-moyo__rain li:nth-child(2) { right: -16%; top: 44%; }
.lp-moyo__rain li:nth-child(3) { left: -10%; top: 60%; background: var(--lp-ink); color: #fff; }
.lp-moyo__device.is-in .lp-moyo__rain li { animation: lp-drop 1.1s cubic-bezier(0.3, 1.4, 0.5, 1) calc(0.6s + var(--i) * 0.45s) forwards; }
@keyframes lp-drop { to { opacity: 1; transform: none; } }
.lp-moyo__rainnote { margin: 18px 0 0; text-align: center; font-size: 12.5px; opacity: 0.9; }

@media (min-width: 960px) {
  .lp-moyo { grid-template-columns: 1.1fr 0.9fr; align-items: center; }
}
/* 動きを減らす設定: 切り替えは押したときだけ・動きなしで。雨のことばは最初から置く */
.lp-moyo--still .lp-moyo__phone img, .lp-moyo--still .lp-moyo__modes button { transition: none; }
.lp-moyo--still .lp-moyo__rain li { opacity: 1; transform: none; animation: none; }
@media (prefers-reduced-motion: reduce) {
  .lp-moyo__rain li { opacity: 1; transform: none; animation: none !important; }
  .lp-moyo__phone img, .lp-moyo__modes button { transition: none; }
}
```

- [ ] **Step 4: 詳しく読む層を移す（現行の文章・表を1文字も変えずに）**

現行 `src/components/LandingPage.tsx`（タスク10で書き換える前）から行番号で切り出して、`src/components/lp/LpDetails.tsx` を作る。行番号はコミット 4953887 の時点で確認済みで、スクリプトの `assert` で境界を検証する。

- 171〜211行: `CompMark`・`CompRow`・`compRows`
- 416〜540行: `Detail`・`MarkCell`・`CompareTable`・`tierGroups`・`TierTable`・`faqs`
- 549〜566行: 「機能をくわしく見る」の中身（3つの `h3` と3つの `ul`）

切り出すときに変えるのは次の4点だけ:
- `RevealTbody` → `tbody`
- `lp-glass` の `div` → `lp-table-wrap`
- `Detail` の `section` の型から `'maker'` を外す（「作った人のこと」は章の本文へ移すため）
- 色 `var(--accent)` → `var(--lp-leaf)`

一時ファイル `scripts/_make_lp_details.py` を次の内容で作る:

```python
import io
src = io.open('src/components/LandingPage.tsx', encoding='utf-8').read().split('\n')
L = lambda a, b: '\n'.join(src[a - 1:b])
assert src[170].startswith('type CompMark') and src[210] == '];'
assert src[416].startswith('function Detail(') and src[539] == '];'
assert 'section="features"' in src[547] and src[566].strip() == '</Detail>'
body = L(416, 540)
body = body.replace("section: 'features' | 'compare' | 'maker' | 'faq'", "section: 'features' | 'compare' | 'faq'")
body = body.replace('<RevealTbody>', '<tbody>').replace('</RevealTbody>', '</tbody>')
body = body.replace("className=\"lp-glass\" style={{ overflow: 'hidden' }}", 'className="lp-table-wrap"')
body = body.replace("var(--accent)", "var(--lp-leaf)")
features = '\n'.join(line[4:] for line in src[548:566])
head = (
    "// 詳しく読む層（読みたい人だけ開く）。中身はページ内に残る（検索に拾われる）。開いたら GA4 に記録。\n"
    "// 文章・表の中身は旧 LandingPage.tsx から移したもの（変更しない）。\n"
    "import type { ReactNode } from 'react';\n"
    "import { logLpDetailOpen } from '../../lib/analytics';\n\n"
)
tail = """
export function LpDetails() {
  return (
    <div className="lp-details-list">
      <Detail section="features" title="機能をくわしく見る">
FEATURES
      </Detail>
      <Detail section="compare" title="一般の天気アプリとの違い・料金">
        <CompareTable />
        <h3 className="lp-details__h3">ログインでひろがる、できること</h3>
        <TierTable />
      </Detail>
      <Detail section="faq" title="よくある質問">
        <dl className="lp-faq">
          {faqs.map((f) => (
            <div key={f.q} className="lp-faq__item">
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </Detail>
    </div>
  );
}
""".replace('FEATURES', features)
io.open('src/components/lp/LpDetails.tsx', 'w', encoding='utf-8').write(head + L(171, 211) + '\n\n' + body + '\n' + tail)
print('written')
```

Run: `python scripts/_make_lp_details.py && rm scripts/_make_lp_details.py && (grep -n "RevealTbody\|lp-glass\|var(--accent)\|'maker'" src/components/lp/LpDetails.tsx || echo OK)`
Expected: `written` のあとに `OK` と出る（旧部品・旧クラス・旧色・`'maker'` が残っていない）。

`MarkCell` の色の分岐に `var(--accent)` 以外の色（`#d97706`・`#b3bcc9`）が残るのは、そのままでよい。

- [ ] **Step 5: 作った人の章を書く**

```tsx
// src/components/lp/MakerChapter.tsx
// 5. 作った人＋詳しく読む（夕焼け・秋）。本文は現行の「作った人のこと」の文章を引き継ぐ。
import { useChapterView } from './hooks';
import { LpDetails } from './LpDetails';
import { LineReveal } from './primitives';
import './maker.css';

export function MakerChapter() {
  const ref = useChapterView<HTMLElement>('maker');
  return (
    <section ref={ref} className="lp-ch lp-maker" data-scene="0.64">
      <div className="lp-maker__story">
        <LineReveal lines={['現場で欲しかったものを、', '自分で作った。']} />
        <p>
          Orch.Weatherは、農作業の判断を助け、作物の生育を可視化したい。そう考えた一人の農家が、「現場で欲しかったもの」を詰め込んだアプリです。
        </p>
        <p>
          積算温度を自動で計算し、昨年と何日違うかを並べて表示。天気は「概況」と「リスク」を切り替えて確認でき、1日は畑に出る時間に合わせて午前・午後・夜間に分割。こうした機能は、机の上ではなく、現場で使いながら磨いてきたものばかりです。
        </p>
      </div>
      <LpDetails />
    </section>
  );
}
```

```css
/* src/components/lp/maker.css — 5. 作った人＋詳しく読む */
.lp-maker { padding-top: 22vh; padding-bottom: 20vh; display: grid; gap: 64px; }
.lp-maker__story { max-width: 720px; }
.lp-maker__story p { margin: 22px 0 0; font-size: 15.5px; line-height: 2; font-weight: 500; text-shadow: 0 1px 14px rgba(40, 30, 60, 0.35); }

/* 夕焼けに浮かぶ生成りの紙の帯 */
.lp-details-list { display: grid; gap: 12px; max-width: 860px; width: 100%; }
.lp-details { background: rgba(251, 248, 241, 0.94); color: var(--lp-ink); border-radius: 10px; box-shadow: 0 24px 40px -28px rgba(40, 20, 10, 0.6); }
.lp-details__summary { list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; font-weight: 700; font-size: 15.5px; }
.lp-details__summary::-webkit-details-marker { display: none; }
.lp-details__summary::after { content: '+'; font: 500 22px/1 var(--lp-mono); transition: transform 0.4s var(--lp-ease); }
.lp-details[open] .lp-details__summary::after { transform: rotate(45deg); }
.lp-details__summary:focus-visible { outline: 3px solid var(--lp-leaf); outline-offset: -3px; border-radius: 10px; }
.lp-details__body { padding: 0 22px 22px; font-size: 14px; line-height: 1.9; }
.lp-details[open] .lp-details__body { animation: lp-paper-open 0.6s var(--lp-ease); }
@keyframes lp-paper-open { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.lp-details__h3 { margin: 18px 0 8px; font-size: 15px; font-family: var(--lp-mincho); font-weight: 800; }
.lp-details__list { margin: 0; padding-left: 1.2em; }
.lp-details__p { margin: 0 0 12px; }

.lp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e3ddd0; border-radius: 8px; }
.lp-comp { width: 100%; border-collapse: collapse; font-size: 13px; }
.lp-comp th, .lp-comp td { padding: 10px 10px; border-bottom: 1px solid #ece6da; text-align: center; vertical-align: top; }
.lp-comp th { font-weight: 700; background: #f4efe4; white-space: nowrap; }
.lp-comp td:first-child { text-align: left; font-weight: 500; }
.lp-comp-ours { background: rgba(61, 122, 74, 0.06); }
.lp-comp-note { display: block; font-size: 11px; color: #5b6e73; margin-top: 2px; }

.lp-faq { margin: 0; display: grid; gap: 14px; }
.lp-faq dt { font-weight: 700; }
.lp-faq dd { margin: 4px 0 0; }

@media (prefers-reduced-motion: reduce) { .lp-details[open] .lp-details__body { animation: none; } }
```

- [ ] **Step 6: 最後のボタンとフッターを書く**

```tsx
// src/components/lp/FinalChapter.tsx
// 6. 最後のボタン（夜・冬）。一年を読み終えて「今日」に戻ってくる。フッターは現行の文章を引き継ぐ。
import { sekkiForDate } from '../../lib/sekki';
import { useChapterView } from './hooks';
import { CtaPair, LineReveal } from './primitives';
import './final.css';

export function FinalChapter(props: { loading: boolean; onLogin: () => void; onTryGuest: () => void }) {
  const ref = useChapterView<HTMLElement>('final');
  const today = sekkiForDate(new Date());
  return (
    <section ref={ref} className="lp-ch lp-final" data-scene="0.88">
      <p className="lp-final__today">今日は{today.name}。</p>
      <LineReveal lines={['今年の季節を、', '数字で見てみる。']} />
      <CtaPair {...props} tone="night" />
      <p className="lp-final__note">ログインなしでも、現在地ですぐに試せます。</p>
    </section>
  );
}

export function LpFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__notice">
        <p className="lp-footer__noticeh">ご利用上の注意</p>
        <p>
          本アプリは、気象庁が発表する注意報・警報や、Open-Meteoが提供する気象データ（実績・予報）を、農業で使いやすい形に整理してお見せするツールです。アプリが独自に天気を予測することはなく、気象予報業務許可を要する予報業務を行うものではありません。表示される数値やグラフは参考情報であり、データの誤差・欠損・遅延や、予報と実際の天候が異なることがあります。農薬散布・防霜対策などの実際の作業判断は、気象庁の最新の警報・注意報や現地の状況とあわせて、ご自身の責任のもとで行ってください。詳しくは下記の免責事項をご覧ください。
        </p>
      </div>
      <div className="lp-footer__brand">
        <img src="/icons/yamamatsu-mark-white.svg" alt="" width={20} height={20} />
        <span>Orch.Weather</span>
      </div>
      <p className="lp-footer__links">
        <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
        <a href="/disclaimer.html" target="_blank" rel="noopener noreferrer">免責事項</a>
        <a href="/contact.html" target="_blank" rel="noopener noreferrer">お問い合わせ</a>
      </p>
      <p className="lp-footer__links">
        <span>気象データ提供：<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a></span>
        <span>注意報・警報：<a href="https://www.jma.go.jp" target="_blank" rel="noopener noreferrer">気象庁</a></span>
      </p>
      <p className="lp-footer__copy">© 2025 Orch.Weather — Orchシリーズ農業専用ツール</p>
    </footer>
  );
}
```

```css
/* src/components/lp/final.css — 6. 最後のボタン＋フッター */
.lp-final { min-height: 100svh; display: grid; align-content: center; justify-items: start; gap: 22px; padding-top: 12vh; padding-bottom: 30vh; }
.lp-final__today { margin: 0; font-family: var(--lp-mincho); font-weight: 600; font-size: clamp(16px, 2vw, 20px); letter-spacing: 0.12em; }
.lp-final .lp-lines { font-size: clamp(34px, 8.6vw, 80px); }
.lp-final__note { margin: 0; font-size: 13px; opacity: 0.88; }
.lp-cta-pair--night .lp-cta { background: #fff; color: #0f2340; }

.lp-footer { position: relative; z-index: 2; padding: 48px var(--lp-gutter) 40px; color: rgba(22, 48, 58, 0.78); font-size: 12px; line-height: 1.8; text-align: center; }
.lp-footer__notice { max-width: 760px; margin: 0 auto 28px; text-align: left; padding: 16px 20px; border-radius: 10px; background: rgba(255, 255, 255, 0.55); }
.lp-footer__noticeh { margin: 0 0 6px; font-weight: 700; color: var(--lp-ink); }
.lp-footer__notice p:last-child { margin: 0; }
.lp-footer__brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: var(--lp-ink); }
.lp-footer__brand img { filter: invert(18%) sepia(20%) saturate(900%) hue-rotate(150deg); }
.lp-footer__links { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; margin: 10px 0 0; }
.lp-footer a { color: var(--lp-ink); }
.lp-footer__copy { margin: 10px 0 0; }
```

フッターは雪の丘（`--near`＝淡い灰青）の上に乗るので、文字は濃い色にする。

- [ ] **Step 7: 通ることを確認する**

Run: `npm test -- src/components/lp/chapters.test.tsx`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add src/components/lp/MoyoChapter.tsx src/components/lp/moyo.css src/components/lp/LpDetails.tsx src/components/lp/MakerChapter.tsx src/components/lp/maker.css src/components/lp/FinalChapter.tsx src/components/lp/final.css src/components/lp/chapters.test.tsx
git commit -m "feat(lp): 空もよう（押して切り替え）・作った人＋詳しく読む・最後のボタン＋フッター"
```

---

### Task 10: 組み立て・旧スタイル削除・遅延読み込み（Sonnet）

**Files:**
- Rewrite: `src/components/LandingPage.tsx`
- Rewrite: `src/components/LandingPage.test.tsx`
- Delete: `src/landing.css`
- Modify: `src/App.tsx:6`（import）と `src/App.tsx:121-123`（LP の表示）

- [ ] **Step 1: 新しい LP のテストに書き換える**

```tsx
// src/components/LandingPage.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ GoogleAuthProvider: class {}, signInWithPopup: vi.fn(), signInWithRedirect: vi.fn() }));
vi.mock('../lib/analytics', () => ({ logLogin: vi.fn(), logLpDetailOpen: vi.fn(), logLpChapterView: vi.fn(), logLpMoyoToggle: vi.fn() }));

import { LandingPage } from './LandingPage';

beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LandingPage', () => {
  it('最初の画面の見出しは「「今年は遅い」が、数字で見える。」', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label')).toBe('「今年は遅い」が、数字で見える。');
  });

  it('7つの章が、空の進み具合の順に並ぶ', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    const ps = Array.from(container.querySelectorAll<HTMLElement>('[data-scene]')).map((el) => Number(el.dataset.scene));
    expect(ps).toEqual([0, 0.1, 0.27, 0.4, 0.47, 0.64, 0.88]);
  });

  it('ボタンは最初と最後の2か所だけ', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getAllByRole('button', { name: /ログインせずに試す/ })).toHaveLength(2);
  });

  it('「AI」「平年」と言わない', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    expect(container.textContent).not.toMatch(/AI|平年/);
  });

  it('「ログインせずに試す」で onTryGuest を呼ぶ', () => {
    const onTryGuest = vi.fn();
    render(<LandingPage onTryGuest={onTryGuest} />);
    fireEvent.click(screen.getAllByRole('button', { name: /ログインせずに試す/ })[0]);
    expect(onTryGuest).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/components/LandingPage.test.tsx`
Expected: FAIL（見出しが『』のまま、章の数が違う、など）

- [ ] **Step 3: LandingPage を組み立てだけにする**

```tsx
// src/components/LandingPage.tsx
// LP「一日×一年の空」の組み立てとログイン処理。章の中身は src/components/lp/ にある。
import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { logLogin } from '../lib/analytics';
import { SkyScene } from './lp/SkyScene';
import { LpNav, SekkiDial } from './lp/LpNav';
import { LpHero } from './lp/LpHero';
import { HunchChapter } from './lp/HunchChapter';
import { SekkiChapter } from './lp/SekkiChapter';
import { KurabeChapter } from './lp/KurabeChapter';
import { MoyoChapter } from './lp/MoyoChapter';
import { MakerChapter } from './lp/MakerChapter';
import { FinalChapter, LpFooter } from './lp/FinalChapter';
import './lp/lp.css';

const isIOSStandalone = () =>
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

export function LandingPage({ onTryGuest }: { onTryGuest: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    logLogin();
    try {
      if (isIOSStandalone()) {
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch {
          // fall through to error display
        }
      }
      setError('ログインに失敗しました。もう一度お試しください。');
      setLoading(false);
    }
  };

  const cta = { loading, onLogin: handleLogin, onTryGuest };
  return (
    <div className="lp-root">
      <SkyScene />
      <LpNav loading={loading} onLogin={handleLogin} />
      <SekkiDial />
      <main className="lp-main">
        <LpHero {...cta} error={error} />
        <HunchChapter />
        <SekkiChapter />
        <KurabeChapter />
        <MoyoChapter />
        <MakerChapter />
        <FinalChapter {...cta} />
      </main>
      <LpFooter />
    </div>
  );
}
```

- [ ] **Step 4: 旧スタイルを消し、App で遅延読み込みにする**

```bash
git rm -q src/landing.css
```

`src/App.tsx` の6行目を置き換える:

```tsx
// 変更前
import { LandingPage } from './components/LandingPage';
// 変更後
const LandingPage = lazy(() => import('./components/LandingPage').then((m) => ({ default: m.LandingPage })));
```

`src/App.tsx` の先頭の `react` の import に `lazy` と `Suspense` を加える（既存の import 行に名前を足す。無ければ `import { lazy, Suspense } from 'react';` を足す）。`const LandingPage = …` の行は、すべての import の後に置く。

LP を返している箇所（`if (!user && !guestMode) {` の中）を置き換える:

```tsx
  if (!user && !guestMode) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#3d4f86' }} />}>
        <LandingPage onTryGuest={() => { logGuestStart(); setGuestMode(true); }} />
      </Suspense>
    );
  }
```

- [ ] **Step 5: 全テスト・型・lint・ビルドを通す**

Run: `npm test`
Expected: すべて PASS（`src/components/lp/*.test.*` と `LandingPage.test.tsx` を含む）

Run: `npx tsc -b`
Expected: エラーなし

Run: `npx eslint src/components/lp src/components/LandingPage.tsx src/lib/lpScene.ts src/App.tsx`
Expected: エラーなし

Run: `npm run build`
Expected: 成功。出力に LandingPage の別チャンク（`LandingPage-*.js`）ができ、メインのチャンクが前より小さいか同程度であること（数値を控える）

- [ ] **Step 6: コミット**

```bash
git add -A src/components/LandingPage.tsx src/components/LandingPage.test.tsx src/App.tsx src/landing.css
git commit -m "feat(lp): 新しい LP を組み立て、旧スタイルを削除し、遅延読み込みにする"
```

---

### Task 11: 実画面での検証と磨き込み（コントローラーが実施）

**Files:**
- Create（git 管理外）: `screenshots/lp-review/*.png`
- 必要に応じて Modify: `src/components/lp/*.css`

- [ ] **Step 1: dev サーバーを起動する**

Run（バックグラウンド）: `npm run dev -- --port 5180 --strictPort`

- [ ] **Step 2: 撮影スクリプトで全章を撮る**

一時スクリプト `scripts/_lp_review.mjs` を作って実行し、終わったら消す:

```js
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out = 'screenshots/lp-review';
await mkdir(out, { recursive: true });
const b = await chromium.launch();
for (const [name, vp, reduced] of [['375', { width: 375, height: 812 }, false], ['1280', { width: 1280, height: 800 }, false], ['375-reduced', { width: 375, height: 812 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  const page = await ctx.newPage();
  const errs = [];
  const meteo = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => { if (r.url().includes('open-meteo')) meteo.push(r.url()); });
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i <= 16; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((H * i) / 16));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${name}-${String(i).padStart(2, '0')}.png` });
  }
  console.log(name, 'errors', errs, 'open-meteo requests', meteo.length);
  await ctx.close();
}
await b.close();
```

Run: `node scripts/_lp_review.mjs && rm scripts/_lp_review.mjs`
Expected: 3通りとも `errors []`、`open-meteo requests 0`

- [ ] **Step 3: 撮影した画像を目で確認する（Read ツール）**

章ごとに次を確かめる:
1. 見出しの折り返しが、言葉のまとまりで切れている（375px で1文字だけの行が出ない）
2. 空の時刻・季節と章の内容が合っている（勘の章＝朝・春、空くらべ＝昼・夏、作った人＝夕焼け・秋、最後＝夜・冬）。見出し帯の節気が季節と一致する
3. 白い文字が明るい空（昼の下端・雪）の上で読める。読みにくい箇所は `text-shadow` を強めるか、文字の下に淡い影の帯を敷く
4. 勘の章で、言葉 → 数字 → 結論の3段階が順に出る（中間の撮影で確認）
5. 節気の章で、処暑で止まってカードがせり上がる。横の列が画面外へ消えない
6. 空くらべで、線を描き終える前に写真が出てこない
7. 動きを減らす設定で、すべての中身が静止状態で読める
8. PC で右端の節気の目盛りが出て、スマホでは出ない
9. 雪の丘の上でフッターの文字が読める

直したら Step 2 からやり直す（Open-Meteo は叩かないので、何度撮ってもよい）。

- [ ] **Step 3b: 「あるのに読めない」を自動で確かめる**

DOM にあるかだけを見るテストでは、画面からはみ出す・重なる・見えないといった問題を見逃す。実際の画面で位置と見え方を測る一時スクリプト `scripts/_lp_readable.mjs` を作って実行し、終わったら消す:

```js
import { chromium } from 'playwright';
const b = await chromium.launch();
const fails = [];
// (1) 節気カードが、画面を止めている間に全体が画面内に収まる（3つの画面サイズ）
for (const vp of [{ width: 375, height: 667 }, { width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  const page = await b.newPage({ viewport: vp });
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  const r = await page.evaluate(async () => {
    const pin = document.querySelector('.lp-sekki__pin');
    const top = pin.getBoundingClientRect().top + scrollY;
    scrollTo(0, top + (pin.offsetHeight - innerHeight) * 0.85); // カードが出ている位置
    await new Promise((res) => setTimeout(res, 1600));
    const img = document.querySelector('.lp-sekki__card img').getBoundingClientRect();
    return { top: img.top, bottom: img.bottom, width: img.width, vh: innerHeight };
  });
  if (r.top < 0 || r.bottom > r.vh) fails.push(`節気カード ${vp.width}x${vp.height}: top=${r.top} bottom=${r.bottom} vh=${r.vh}`);
  console.log('sekki card', vp, r);
  await page.close();
}
// (2) 動きを減らす設定でも、押して2つの見方を両方読める（写真と説明が一緒に切り替わる）
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  const read = () => page.evaluate(() => {
    const on = document.querySelector('.lp-moyo__phone img.is-on');
    return {
      caption: document.querySelector('.lp-moyo__caption').textContent,
      src: on?.getAttribute('src'),
      opacity: on ? getComputedStyle(on).opacity : null,
      h: on ? on.getBoundingClientRect().height : 0,
    };
  });
  const btn = page.getByRole('button', { name: '概況でみる' });
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const before = await read();
  await btn.click();
  await page.waitForTimeout(400);
  const after = await read();
  if (before.caption !== 'その時間帯の、いちばん悪い天気' || before.src !== '/lp/moyo-risk.webp') fails.push(`空もよう: 最初がリスクでない ${JSON.stringify(before)}`);
  if (after.caption !== 'その時間帯の、いちばん多い天気' || after.src !== '/lp/moyo-gaikyo.webp' || after.opacity !== '1' || after.h < 100) fails.push(`空もよう: 押しても概況が読めない ${JSON.stringify(after)}`);
  console.log('moyo reduced', before, after);
  await ctx.close();
}
// (3) 押した後は自動切替が止まる（動きのある設定）
{
  const page = await b.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: '概況でみる' });
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await btn.click();
  const c1 = await page.locator('.lp-moyo__caption').textContent();
  await page.waitForTimeout(7000);
  const c2 = await page.locator('.lp-moyo__caption').textContent();
  if (c1 !== c2) fails.push(`空もよう: 押した後も自動で切り替わっている (${c1} → ${c2})`);
  await page.close();
}
await b.close();
console.log(fails.length ? `FAIL\n${fails.join('\n')}` : 'ALL READABLE');
process.exit(fails.length ? 1 : 0);
```

Run（Bash）: `node scripts/_lp_readable.mjs; rm scripts/_lp_readable.mjs`
Expected: `ALL READABLE`。`FAIL` のときは、出力された数値をもとに CSS を直し、Step 2 からやり直す。

あわせて、押す前に空もようを通り過ぎた場合もタイマーが止まることを確かめる: 空もようの章を表示 → ページ末尾まで送る → 7秒の間をあけて `.lp-moyo__caption` の文字を2回読み、変わらないこと。

最初の画面は、375×667 でボタン2つが最初の画面の中（下端が 667px 以内）に入っているかも測る。入らない場合は、見出しの文字の大きさと上の余白を詰める（文字は削らない）。

- [ ] **Step 4: スクロールの重さを測る**

CPU を4倍に絞って、スクロール中のコマ落ちを測る一時スクリプトを実行する:

```js
import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 375, height: 812 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
const result = await page.evaluate(async () => {
  const H = document.documentElement.scrollHeight - innerHeight;
  const gaps = [];
  let last = performance.now();
  let run = true;
  const loop = (t) => { gaps.push(t - last); last = t; if (run) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  for (let y = 0; y < H; y += 40) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 16)); }
  run = false;
  gaps.sort((a, b) => a - b);
  return { frames: gaps.length, p50: gaps[Math.floor(gaps.length * 0.5)], p95: gaps[Math.floor(gaps.length * 0.95)] };
});
console.log(result);
await b.close();
```

Expected: p95 が 50ms 未満（CPU 4倍絞りで、おおむね20コマ/秒以上）。超える場合は、舞うものの数を減らす（`particleCount`）、雲の `filter: blur` を外して放射グラデーションだけにする、の順で軽くする。

- [ ] **Step 5: 修正をコミットする**

```bash
git add src/components/lp
git commit -m "fix(lp): 実画面の確認で見つけた見た目の調整"
```

（修正が無ければこの手順は飛ばす）

- [ ] **Step 6: develop に push し、ユーザーに実機確認を依頼する**

```bash
git push origin develop
```

ユーザーに develop のプレビューで確認してもらう。main への反映は、ユーザーの明示の指示を待つ。

---

## 仕様との対応（自己確認）

| 仕様の項目 | タスク |
|---|---|
| 一日×一年の空（色・太陽と月・星・節気・季節の一致） | 1, 6 |
| 舞うものは少なく・ゆっくり・画面外で停止 | 2, 6 |
| 上部の帯（時刻と節気）・PC の目盛り | 6 |
| 0. 最初の画面（今日の節気の札・用途の一文・札の撮影時点・数え上げ・せり上がり・ボタン下の一行） | 3, 7 |
| 1. 勘の章（3つの勘→数字→結論＋3行の振り返り・出典） | 3, 7 |
| 2. 節気のふりかえり（24枚が横へ・処暑で止まる・季節のあしどり） | 8 |
| 3. 空くらべ（描かれる線・18日の差・要点・本物の画面2枚・模式の注記） | 3, 8 |
| 4. 空もよう（押して切り替え・押すまで自動切替・2枚撮影・雨のことば・計測） | 3, 4, 9 |
| 5. 作った人＋詳しく読む（現行の文章・GA4） | 9 |
| 6. 最後のボタン＋フッター（今日の節気で輪を閉じる） | 9 |
| 見た目の方針（書体・色・避けるもの） | 5〜9 |
| 遅延読み込み・新しいライブラリなし | 10 |
| 動きを減らす設定 | 5〜9（各章）、11（確認） |
| 文言の制約（平年・AI・※予定・実績） | 3, 9, 10（テスト） |
| 章の閲覧計測 | 3, 5（`useChapterView`）、各章 |
| 検証（build・テスト・3通りの撮影・重さ・Open-Meteo 0件・カード全体と静止表示が読めること） | 10, 11 |
