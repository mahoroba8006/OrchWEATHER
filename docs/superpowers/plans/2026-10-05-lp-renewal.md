# LP 全面見直し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LP を「『今年は遅い』が、数字で見える。」を主役に作り直し、パッと見せる層（一行＋画面写真）と詳しく読む層（折りたたみ）に分ける。

**Architecture:** `src/components/LandingPage.tsx` の既存の土台（空の演出 `SkyBackdrop`・`Reveal`・`Nav`・ログイン処理・`LpFooter`）は残し、章の部品だけを入れ替える。画面写真は Playwright で撮り直して `public/lp/*.webp` に置く。暦（節気）は章を立てず、既存の `SekkiArt` を章の区切りと文言にちりばめる。折りたたみは `<details>` で作り、開いたことを GA4 に記録する。

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + Testing Library, Playwright（撮影）, Python Pillow（webp 変換）, Firebase Analytics

**仕様書:** `docs/superpowers/specs/2026-10-05-lp-renewal-design.md`

---

## ファイル構成

| ファイル | 役割 | 変更 |
|---|---|---|
| `scripts/lp-shots.mjs` | LP 用の画面写真を撮る（開発用） | 新規 |
| `public/lp/*.webp` | 新しい画面写真 5 枚 | 新規 |
| `public/lp/{hero-imanosora.png,hour.png,feature-kurabe.png,feature-ai.webp}` | 旧写真 | 削除 |
| `src/lib/analytics.ts` | `logLpDetailOpen` を追加 | 変更 |
| `src/components/LandingPage.tsx` | 章の入れ替え | 変更 |
| `src/landing.css` | 2 ボタン並び・節気の区切り・折りたたみ・FAQ の見た目 | 変更 |
| `src/components/LandingPage.test.tsx` | LP の文言・構成のテスト | 新規 |

---

### Task 1: 画面写真の撮影スクリプト

**Files:**
- Create: `scripts/lp-shots.mjs`

前提: 別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動しておく。ゲストモード（現在地）で撮る。Open-Meteo の上限を消費するので、1 回の実行で必要な写真をまとめて撮り、実行回数を絞る（目安 3 回以内）。

- [ ] **Step 1: スクリプトを書く**

```js
// LP 用の画面写真を撮る（開発用）。
// 使い方: 別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動し、
//         `LAT=35.681 LON=139.767 node scripts/lp-shots.mjs` を実行する。出力は screenshots/lp/（git 管理外）。
// Open-Meteo の利用上限を消費するので、実行回数は絞ること。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5180';
const lat = Number(process.env.LAT ?? 35.681);
const lon = Number(process.env.LON ?? 139.767);
const outDir = join('screenshots', 'lp');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true,
  locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
  permissions: ['geolocation'], geolocation: { latitude: lat, longitude: lon },
});
await context.addInitScript(() => { localStorage.setItem('guestMode', '1'); });
const page = await context.newPage();
const save = async (locator, name) => { await locator.screenshot({ path: join(outDir, `${name}.png`) }); console.log('saved', name); };

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(6000); // 季節のあしどりの集計待ち

  // 1) 空もよう: 空（節気・候が写る）＋リスク/概況の切り替え＋日別予報
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(outDir, 'moyo.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });
  console.log('saved moyo');

  // 2) 季節のあしどりの帯
  await save(page.locator('.season-strip').first(), 'season-band');

  // 3) 節気ふりかえりカード（直近で終わった節気＝一つ左）
  await page.locator('.sekki-badge--button').click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /前/ }).first().click();
  await page.waitForTimeout(1200);
  await save(page.locator('.season-carousel__slide [aria-current], .season-card').filter({ visible: true }).first(), 'review-card');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // 4) 空くらべ: 今年と去年を重ねる
  await page.getByRole('button', { name: '空くらべ' }).first().click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /比較対象を追加/ }).click();
  const yearSelects = page.locator('select').filter({ hasText: '年' });
  await yearSelects.nth(1).selectOption(String(new Date().getFullYear() - 1));
  await page.getByRole('button', { name: /表示/ }).last().click();
  await page.waitForTimeout(8000);
  const charts = page.locator('.recharts-responsive-container');
  // 気温（最初のグラフ）と有効積算温度（見出し「有効積算温度」の直後のグラフ）
  await save(page.locator('section, div').filter({ has: page.getByRole('heading', { name: /気温/ }) }).filter({ has: charts }).last(), 'kurabe-temp');
  await save(page.locator('section, div').filter({ has: page.getByRole('heading', { name: '有効積算温度' }) }).filter({ has: charts }).last(), 'kurabe-gdd');
} finally {
  await browser.close();
}
```

- [ ] **Step 2: 撮影する**

Run: `LAT=35.681 LON=139.767 node scripts/lp-shots.mjs`
Expected: `saved moyo` `saved season-band` `saved review-card` `saved kurabe-temp` `saved kurabe-gdd` の 5 行。
セレクタが合わず失敗した場合は、その写真の locator だけを Playwright の `page.pause()` なしで `console.log(await page.locator(...).count())` で確かめて直す（撮影の再実行は上限を意識して最小限に）。

- [ ] **Step 3: 写真を目で確かめ、地点を選ぶ**

`screenshots/lp/*.png` を開いて確認する。基準:
- review-card: 去年比・5年平均比の差がはっきり出ている（例: 雨◯倍・日照−◯h）。差が小さければ `LAT/LON` を変えて撮り直す（候補: 長野 36.648/138.194、東京 35.681/139.767）
- season-band: 「去年より◯日遅い」等の数字が見えている
- kurabe-temp: 今年と去年の 2 本が重なっている
- moyo: 空に節気・七十二候、「リスクでみる／概況でみる」が写っている

- [ ] **Step 4: webp に変換して public/lp に置く（横 780px に縮小）**

```bash
python - <<'EOF'
from PIL import Image
for n in ['moyo', 'season-band', 'review-card', 'kurabe-temp', 'kurabe-gdd']:
    im = Image.open(f'screenshots/lp/{n}.png').convert('RGB')
    w = 780
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(f'public/lp/{n}.webp', 'WEBP', quality=82, method=6)
    print(n, im.size)
EOF
```

Expected: 5 行のサイズ表示。各サイズ（幅×高さ）を控え、Task 3〜5 の `<img width height>` に使う。

- [ ] **Step 5: Commit**

```bash
git add scripts/lp-shots.mjs public/lp/moyo.webp public/lp/season-band.webp public/lp/review-card.webp public/lp/kurabe-temp.webp public/lp/kurabe-gdd.webp
git commit -m "chore: LP 用の画面写真を撮り直す（撮影スクリプトと webp 5 枚）"
```

---

### Task 2: 折りたたみを開いたことの計測

**Files:**
- Modify: `src/lib/analytics.ts`（`logSeasonCardBrowse` の後ろに追加）

- [ ] **Step 1: 関数を追加する**

```ts
/** LP の「詳しく読む」折りたたみを開いた。どの詳細が読まれているかを見る（section: features / compare / maker / faq） */
export function logLpDetailOpen(section: string): void {
  track('lp_detail_open', { section });
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: 出力なし（成功）

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat: LP の折りたたみを開いたことを GA4 に記録する関数を追加"
```

---

### Task 3: LP のテストを先に書く（新しい構成の約束）

**Files:**
- Create: `src/components/LandingPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ GoogleAuthProvider: class {}, signInWithPopup: vi.fn(), signInWithRedirect: vi.fn() }));
const logLpDetailOpen = vi.fn();
vi.mock('../lib/analytics', () => ({ logLogin: vi.fn(), logLpDetailOpen: (s: string) => logLpDetailOpen(s) }));

import { LandingPage } from './LandingPage';

beforeAll(() => {
  // jsdom に無い API（Reveal / 空の演出が使う）
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LandingPage', () => {
  it('最初の画面の見出しは「『今年は遅い』が、数字で見える。」', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('『今年は遅い』が、数字で見える。');
  });

  it('最初の画面のボタン2つは同じ見た目（どちらも lp-cta、ghost なし）', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    const guest = screen.getAllByRole('button', { name: /ログインせずに試す/ })[0];
    const google = screen.getAllByRole('button', { name: /Googleで始める/ })[0];
    expect(guest.className).toBe(google.className);
    expect(guest.className).not.toContain('ghost');
  });

  it('各章の見出しがある', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    for (const h of ['二十四節気ごとに、今年の半月を一枚に。', '去年と、あの場所と、並べて見える。', '今日の作業、やるかやめるかすぐ決まる。']) {
      expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    }
    expect(screen.getByText('暦は、農の時計だった。')).toBeTruthy();
  });

  it('AI の章と AI の行は出さない', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    expect(container.textContent).not.toMatch(/AI/);
  });

  it('「平年」と言わない', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    expect(container.textContent).not.toMatch(/平年/);
  });

  it('詳しく読む層は折りたたみで、開くと GA4 に記録する', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    const details = container.querySelectorAll('details.lp-details');
    expect(details.length).toBe(4);
    const faq = container.querySelector<HTMLDetailsElement>('details[data-section="faq"]')!;
    faq.open = true;
    fireEvent(faq, new Event('toggle'));
    expect(logLpDetailOpen).toHaveBeenCalledWith('faq');
  });

  it('料金表の有料列は「※予定」を残す', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getByText('※予定')).toBeTruthy();
  });

  it('「ログインせずに試す」で onTryGuest を呼ぶ', () => {
    const onTryGuest = vi.fn();
    render(<LandingPage onTryGuest={onTryGuest} />);
    fireEvent.click(screen.getAllByRole('button', { name: /ログインせずに試す/ })[0]);
    expect(onTryGuest).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/components/LandingPage.test.tsx`
Expected: FAIL（見出しが旧文言・details が無い・AI の文字がある など）。`IntersectionObserver` などの環境エラーで落ちる場合は beforeAll の差し替えを直してから先へ進む（失敗理由が「中身の違い」になっていること）。

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingPage.test.tsx
git commit -m "test: LP 全面見直しの構成をテストで先に決める（現時点では失敗）"
```

---

### Task 4: パッと見せる層（最初の画面・ふりかえり・空くらべ・空もよう・途中のボタン）

**Files:**
- Modify: `src/components/LandingPage.tsx`
- Modify: `src/landing.css`（末尾に追加）

`<img>` の `width`/`height` は Task 1 Step 4 で控えた実寸に置き換える（下のコードの数値は 780 幅の想定値）。

- [ ] **Step 1: import を整える**

`LandingPage.tsx` 冒頭の lucide の import を次に置き換え、節気の絵と計測を足す:

```tsx
import {
  Leaf, ArrowRight, BarChart2, CloudSun, Sprout, MapPin, CalendarRange, Thermometer,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { logLogin, logLpDetailOpen } from '../lib/analytics';
import { SekkiArt } from './sky/sekkiArt';
import '../landing.css';
```

- [ ] **Step 2: 共通部品を追加する（`GoogleIcon` の直後）**

```tsx
/** 「ログインせずに試す」「Googleで始める」を同じ強さで並べる */
function CtaPair({ loading, onLogin, onTryGuest, onDark = false }: { loading: boolean; onLogin: () => void; onTryGuest: () => void; onDark?: boolean }) {
  const cls = onDark ? 'lp-cta lp-cta--pair lp-cta--on-dark' : 'lp-cta lp-cta--pair';
  return (
    <div className="lp-cta-pair">
      <button className={cls} onClick={onTryGuest}>
        <CloudSun size={18} /> ログインせずに試す
      </button>
      <button className={cls} onClick={onLogin} disabled={loading}>
        <span className="lp-cta__google"><GoogleIcon /></span>
        {loading ? 'ログイン中...' : 'Googleで始める'}
      </button>
    </div>
  );
}

/** 画面写真（角丸・影つき） */
function Shot({ src, alt, width, height, eager = false }: { src: string; alt: string; width: number; height: number; eager?: boolean }) {
  return <img className="lp-shot" src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} />;
}

/** 章の区切りの節気の絵（白い絵なので青い台に載せる）。立春から順に使う */
function SekkiDivider({ index }: { index: number }) {
  return (
    <div className="lp-sekki-divider" aria-hidden="true">
      <span className="lp-sekki-divider__tile"><SekkiArt index={index} size={40} /></span>
    </div>
  );
}

/** パッと見せる層の章（見出し一行＋添える一行＋写真） */
function GlanceSection({ eyebrow, title, note, lead, children, reverse = false }: {
  eyebrow: ReactNode; title: string; note?: string; lead: ReactNode; children: ReactNode; reverse?: boolean;
}) {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <div className={reverse ? 'lp-glance lp-glance--reverse' : 'lp-glance'}>
          <Reveal variant={reverse ? 'fade-right' : 'fade-left'}>
            <p className="lp-eyebrow">{eyebrow}</p>
            <h2 className="lp-h2 lp-glance__title">{title}</h2>
            {note && <p className="lp-glance__note">{note}</p>}
            <div className="lp-glance__lead">{lead}</div>
          </Reveal>
          <Reveal variant={reverse ? 'fade-left' : 'fade-right'}>{children}</Reveal>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `Hero` を置き換える**

既存の `function Hero(...) { ... }` 全体を次に置き換える:

```tsx
function Hero({ loading, error, onLogin, onTryGuest }: { loading: boolean; error: string | null; onLogin: () => void; onTryGuest: () => void }) {
  const phoneParallaxRef = useParallax<HTMLDivElement>(0.06);
  return (
    <section className="lp-hero lp-section" style={{ paddingTop: 'clamp(2.5rem, 6vw, 4rem)' }}>
      <HeroSky />
      <div className="lp-container lp-hero__grid">
        <Reveal style={{ flex: '1 1 400px', minWidth: 0 }}>
          <p className="lp-hero__badge"><Sprout size={14} /> 農家が現場で作った天気アプリ</p>
          <h1 className="lp-hero__title">『今年は遅い』が、数字で見える。</h1>
          <p className="lp-lead lp-hero__lead">二十四節気ごとに、去年・5年平均と比べてふりかえる、農家のための天気アプリ。</p>
          <CtaPair loading={loading} onLogin={onLogin} onTryGuest={onTryGuest} />
          <p className="lp-cta-note">ログインなしでも現在地で試せます。Googleアカウントなら登録30秒・いまは無料。</p>
          {error && <p className="lp-error">{error}</p>}
        </Reveal>
        <Reveal variant="scale" delay={0.15} style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div ref={phoneParallaxRef} className="lp-phone-parallax">
            <div className="lp-hero__shot lp-phone--float">
              <Shot src="/lp/review-card.webp" alt="節気のふりかえりカード — 去年・5年平均と比べた気温・雨・日照" width={780} height={1200} eager />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 3 つの章と途中のボタンを追加する（`Hero` の直後）**

```tsx
function SeasonSection() {
  return (
    <GlanceSection
      eyebrow={<><CalendarRange size={16} /> 季節のふりかえり</>}
      title="二十四節気ごとに、今年の半月を一枚に。"
      note="暦は、農の時計だった。"
      lead={<p className="lp-glance__big">積算温度、去年より◯日遅い。<br />数字で、季節の進み具合がわかる。</p>}
    >
      <div className="lp-shot-stack">
        <Shot src="/lp/season-band.webp" alt="季節のあしどり — 気温・降水量・積算温度・日照を去年と比べる帯" width={780} height={180} />
        <Shot src="/lp/review-card.webp" alt="節気のふりかえりカード" width={780} height={1200} />
      </div>
    </GlanceSection>
  );
}

function KurabeSection() {
  return (
    <GlanceSection
      reverse
      eyebrow={<><BarChart2 size={16} /> 空くらべ</>}
      title="去年と、あの場所と、並べて見える。"
      lead={
        <ul className="lp-points">
          <li><CalendarRange size={18} /> 年をまたいで、重ねて比べる</li>
          <li><MapPin size={18} /> 地点を並べて、違いを比べる</li>
          <li><Thermometer size={18} /> 積算温度を、自動で計算</li>
        </ul>
      }
    >
      <div className="lp-shot-stack">
        <Shot src="/lp/kurabe-temp.webp" alt="空くらべ — 今年と去年の気温を重ねたグラフ" width={780} height={600} />
        <Shot src="/lp/kurabe-gdd.webp" alt="空くらべ — 有効積算温度のグラフ" width={780} height={600} />
      </div>
    </GlanceSection>
  );
}

function MoyoSection() {
  return (
    <GlanceSection
      eyebrow={<><CloudSun size={16} /> 空もよう</>}
      title="今日の作業、やるかやめるかすぐ決まる。"
      lead={
        <ul className="lp-points">
          <li>「リスクでみる」— その時間帯のいちばん悪い天気</li>
          <li>「概況でみる」— その時間帯のいちばん長い天気</li>
          <li>毎日、今日の節気と七十二候を表示</li>
        </ul>
      }
    >
      <Shot src="/lp/moyo.webp" alt="空もよう — 午前・午後・夜間の天気と、リスク／概況の切り替え" width={780} height={1688} />
    </GlanceSection>
  );
}

function MidCta(props: { loading: boolean; onLogin: () => void; onTryGuest: () => void }) {
  return (
    <section className="lp-section lp-section--tight">
      <div className="lp-container-narrow" style={{ textAlign: 'center' }}>
        <Reveal><CtaPair {...props} /></Reveal>
      </div>
    </section>
  );
}
```

注意: `SeasonSection` の「◯日」は写真の数字と合わせて Task 1 で撮った実数に置き換える（例: 「積算温度、去年より9日遅い。」）。写真と文言の数字が違うと不信感になるため、必ず一致させる。

- [ ] **Step 5: CSS を追加する（`src/landing.css` 末尾）**

```css
/* ── LP 全面見直し（2026-10-05） ── */
.lp-hero__grid { display: flex; flex-wrap: wrap; align-items: center; gap: clamp(2rem, 5vw, 3.5rem); }
.lp-hero__badge {
  display: inline-flex; align-items: center; gap: 0.4rem; margin: 0 0 1.1rem; padding: 0.35rem 0.9rem;
  border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 0.8rem;
}
.lp-hero__title { font-size: clamp(1.6rem, 6vw, 2.5rem); font-weight: 800; line-height: 1.38; letter-spacing: 0.01em; margin: 0 0 1rem; }
.lp-hero__lead { margin-bottom: 1.5rem; }
.lp-hero__shot { max-width: 360px; margin: 0 auto; }

/* 2 つのボタンを同じ強さで並べる（狭い画面は縦に同じ幅） */
.lp-cta-pair { display: flex; flex-wrap: wrap; gap: 0.7rem; }
.lp-cta--pair { flex: 1 1 200px; justify-content: center; }
.lp-cta__google { display: inline-flex; padding: 3px; border-radius: 6px; background: #fff; }
.lp-cta--on-dark { background: #fff; color: var(--accent); box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18); }
.lp-cta-note { margin: 0.7rem 0 0; font-size: 0.78rem; color: var(--ink-3); }
.lp-error { margin: 0.6rem 0 0; font-size: 0.85rem; color: #dc2626; }

/* パッと見せる層の章 */
.lp-glance { display: grid; gap: clamp(1.5rem, 4vw, 3rem); align-items: center; }
@media (min-width: 860px) {
  .lp-glance { grid-template-columns: 1fr 1fr; }
  .lp-glance--reverse > :first-child { order: 2; }
}
.lp-eyebrow { display: inline-flex; align-items: center; gap: 0.4rem; margin: 0 0 0.6rem; color: var(--accent); font-weight: 700; font-size: 0.85rem; }
.lp-glance__title { margin-bottom: 0.4rem; }
.lp-glance__note { margin: 0 0 1rem; color: var(--ink-3); font-size: 0.85rem; letter-spacing: 0.08em; }
.lp-glance__big { margin: 0; font-size: clamp(1.05rem, 3.2vw, 1.25rem); font-weight: 700; line-height: 1.7; }
.lp-points { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.6rem; }
.lp-points li { display: flex; align-items: center; gap: 0.55rem; font-weight: 600; font-size: 0.98rem; }
.lp-points svg { flex-shrink: 0; color: var(--accent); }
.lp-shot-stack { display: grid; gap: 1rem; max-width: 420px; margin: 0 auto; }
.lp-section--tight { padding-top: 0; padding-bottom: clamp(1rem, 3vw, 2rem); }

/* 章の区切りの節気の絵（白い絵なので青い台に載せる） */
.lp-sekki-divider { display: flex; justify-content: center; padding: clamp(0.5rem, 2vw, 1rem) 0; opacity: 0.85; }
.lp-sekki-divider__tile { display: inline-flex; padding: 4px; border-radius: 12px; background: linear-gradient(180deg, #4f86c0, #2d5f96); }
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: 旧章の部品（`BridgeSection` など）が残っていても型エラーは出ない。エラーが出たら新しい部品の props を直す。

- [ ] **Step 7: Commit**

```bash
git add src/components/LandingPage.tsx src/landing.css
git commit -m "feat: LP のパッと見せる層（最初の画面・ふりかえり・空くらべ・空もよう・途中のボタン）"
```

---

### Task 5: 詳しく読む層（折りたたみ 4 つ）と最後のボタン

**Files:**
- Modify: `src/components/LandingPage.tsx`
- Modify: `src/landing.css`（末尾に追加）

- [ ] **Step 1: 比較表のデータから AI を外す**

`compRows` から `label: 'AIの作業提案'` の要素を削除する。`tierGroups` の空もようの `rows` から `{ label: 'AIアドバイス', ... }` の行を削除する（空もようは `天気情報` の 1 行になる）。

- [ ] **Step 2: 折りたたみの部品を追加する（`MarkCell` の直前）**

```tsx
/** 詳しく読む層の折りたたみ。中身はページ内に残る（検索に拾われる）。開いたら GA4 に記録 */
function Detail({ section, title, children }: { section: 'features' | 'compare' | 'maker' | 'faq'; title: string; children: ReactNode }) {
  return (
    <details
      className="lp-details"
      data-section={section}
      onToggle={(e) => { if (e.currentTarget.open) logLpDetailOpen(section); }}
    >
      <summary className="lp-details__summary">{title}</summary>
      <div className="lp-details__body">{children}</div>
    </details>
  );
}
```

- [ ] **Step 3: 既存の表の章を「表だけ」の部品に変える**

`function ComparisonSection()` を `function CompareTable()` に改名し、外側の `<section>`・`<div className="lp-container-narrow">`・見出しの `<Reveal><h2>一般の天気アプリとの違い</h2></Reveal>` を外して、`<div className="lp-glass" style={{ overflow: 'hidden' }}>…</div>` だけを返すようにする。
`function TierComparisonSection()` も同様に `function TierTable()` に改名し、`<section>`・コンテナ・見出し `<h2>ログインでひろがる、できること</h2>` を外す。表の下の「いまはお試し期間として…」の `<p>` は残す（`<Reveal delay={0.15}>` は外して `<p>` だけにする）。返す要素は `<>…表…<p>…</p></>`。

- [ ] **Step 4: 詳しく読む層の中身を追加する（`TierTable` の後ろ）**

```tsx
const faqs: { q: string; a: string }[] = [
  { q: '無料で使えますか？', a: 'いまはお試し期間として、多くの機能を無料でお使いいただけます。有料プランは予定段階です。ご利用いただける機能の範囲は、今後変更となる場合があります。' },
  { q: 'ログインしないと使えませんか？', a: 'ログインなしでも、現在地の天気・ふりかえり・去年との比較を試せます。畑の場所を登録して使うには、Googleアカウントでのログインが必要です。' },
  { q: '「5年平均」とは何ですか？', a: '去年から5年前までの、同じ月日の期間の実績の平均です。ふりかえりや季節のあしどりは、過去の実績の集計と比較です。' },
  { q: 'データはどこから来ていますか？', a: '気象データ（実績・予報）は Open-Meteo、注意報・警報は気象庁の発表を使っています。アプリが独自に天気を予測することはありません。' },
];

function DetailsSection() {
  return (
    <section className="lp-section">
      <div className="lp-container-narrow">
        <Reveal><h2 className="lp-h2">もっと詳しく</h2></Reveal>
        <div className="lp-details-list">
          <Detail section="features" title="機能をくわしく見る">
            <h3 className="lp-details__h3">空くらべ — 積算を、自分の畑に合わせて</h3>
            <ul className="lp-details__list">
              <li>降水量・日照時間・日射量・積算温度の4つを、毎日の値から自動で積み上げてグラフにします。</li>
              <li>積算の開始日は、萌芽や定植など生育に合わせて自由に設定できます。</li>
              <li>積算温度の基準温度は2種類まで登録でき、ねらいの異なる積算を並べて確認できます。</li>
              <li>比較したい年や登録地点をグラフに重ねると、「去年より何日進んでいるか」「あの場所とどれくらい違うか」がわかります。</li>
            </ul>
            <h3 className="lp-details__h3">空もよう — 畑の時間で、1日を3つに</h3>
            <ul className="lp-details__list">
              <li>1日を午前4〜12時・午後12〜20時・夜間20〜翌4時に分けて、天気が変わるタイミングをつかめます。</li>
              <li>3mmまでの雨を「ぽつぽつ」「カッパ？」「カッパ！」の3段階で表示します。</li>
              <li>露点温度（霜）・飽差（水分管理）・0℃層高度（雹）・大気安定度（落雷）・紫外線指数を、時間別に一覧できます。</li>
            </ul>
            <h3 className="lp-details__h3">空しらべ — あの日の天気を、今日と同じ画面で</h3>
            <ul className="lp-details__list">
              <li>過去の日付を選ぶと、時間別のすべてのデータをそのまま表示します。作業の原因追跡や、翌年の計画に。</li>
              <li>ログイン（有料・予定）では、気温・降水量・日射量など過去1年分をCSVでまとめて保存できます。</li>
            </ul>
          </Detail>
          <Detail section="compare" title="一般の天気アプリとの違い・料金">
            <CompareTable />
            <h3 className="lp-details__h3">ログインでひろがる、できること</h3>
            <TierTable />
          </Detail>
          <Detail section="maker" title="作った人のこと">
            <p className="lp-details__p">
              Orch.Weatherは、農作業の判断を助け、作物の生育を可視化したい。そう考えた一人の農家が、「現場で欲しかったもの」を詰め込んだアプリです。
            </p>
            <p className="lp-details__p">
              積算温度を自動で計算し、昨年と何日違うかを並べて表示。天気は「概況」と「リスク」を切り替えて確認でき、1日は畑に出る時間に合わせて午前・午後・夜間に分割。こうした機能は、机の上ではなく、現場で使いながら磨いてきたものばかりです。
            </p>
          </Detail>
          <Detail section="faq" title="よくある質問">
            <dl className="lp-faq">
              {faqs.map(f => (
                <div key={f.q} className="lp-faq__item">
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </Detail>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: 最後のボタンを 2 つに**

`function FinalCta(...)` を次に置き換える:

```tsx
function FinalCta(props: { loading: boolean; onLogin: () => void; onTryGuest: () => void }) {
  return (
    <section className="lp-section lp-final">
      <div className="lp-final-glow" aria-hidden="true" />
      <div className="lp-container-narrow">
        <Reveal>
          <h2 className="lp-h2" style={{ color: '#fff' }}>今年の季節を、数字で見てみる。</h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.9, margin: '0 0 1.6rem', fontSize: '0.95rem' }}>
            ログインなしでも、現在地ですぐに試せます。
          </p>
          <CtaPair {...props} onDark />
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: CSS を追加する（`src/landing.css` 末尾）**

```css
/* 詳しく読む層（折りたたみ） */
.lp-details-list { display: grid; gap: 0.8rem; margin-top: 1.4rem; }
.lp-details { border-radius: var(--radius-lg, 16px); background: rgba(255, 255, 255, 0.72); border: 1px solid var(--line); overflow: hidden; }
.lp-details__summary {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1rem 1.2rem; cursor: pointer; list-style: none; font-weight: 700; font-size: 0.98rem;
}
.lp-details__summary::-webkit-details-marker { display: none; }
.lp-details__summary::after { content: '＋'; color: var(--accent); font-weight: 700; }
.lp-details[open] .lp-details__summary::after { content: '−'; }
.lp-details__body { padding: 0 1.2rem 1.2rem; }
.lp-details__h3 { margin: 1.2rem 0 0.5rem; font-size: 0.95rem; font-weight: 800; }
.lp-details__h3:first-child { margin-top: 0.2rem; }
.lp-details__list { margin: 0; padding-left: 1.2em; display: grid; gap: 0.45rem; font-size: 0.88rem; line-height: 1.8; color: var(--ink-2); }
.lp-details__p { margin: 0 0 0.8rem; font-size: 0.9rem; line-height: 1.9; color: var(--ink-2); }
.lp-faq { margin: 0; display: grid; gap: 1rem; }
.lp-faq__item dt { font-weight: 700; font-size: 0.92rem; margin-bottom: 0.3rem; }
.lp-faq__item dd { margin: 0; font-size: 0.88rem; line-height: 1.85; color: var(--ink-2); }
```

- [ ] **Step 7: Commit**

```bash
git add src/components/LandingPage.tsx src/landing.css
git commit -m "feat: LP の詳しく読む層（機能・比較と料金・作った人・よくある質問）と最後のボタン"
```

---

### Task 6: 並べ替えと旧章の削除

**Files:**
- Modify: `src/components/LandingPage.tsx`
- Delete: `public/lp/hero-imanosora.png`, `public/lp/hour.png`, `public/lp/feature-kurabe.png`, `public/lp/feature-ai.webp`

- [ ] **Step 1: 本体の並びを置き換える**

`LandingPage` の `<div className="lp-content">` の中身を次にする。区切りの節気の絵は立春(0)から順:

```tsx
        <Hero loading={loading} error={error} onLogin={handleLogin} onTryGuest={onTryGuest} />
        <SekkiDivider index={0} />
        <SeasonSection />
        <SekkiDivider index={1} />
        <KurabeSection />
        <SekkiDivider index={2} />
        <MoyoSection />
        <MidCta loading={loading} onLogin={handleLogin} onTryGuest={onTryGuest} />
        <SekkiDivider index={3} />
        <DetailsSection />
        <FinalCta loading={loading} onLogin={handleLogin} onTryGuest={onTryGuest} />
        <LpFooter />
```

- [ ] **Step 2: 使わなくなった部品を消す**

次の定義を削除する: `tabOverview`, `steps`, `TabBadge`, `BridgeSection`, `SoraMoyoSection`, `SoraKurabeSection`, `SoraShirabeSection`, `AiAdviceSection`, `MakerNote`, `StepsSection`。その結果使われなくなった `ParallaxCloud`・`useCallback` 以外の不要 import（`CSSProperties` 等）は、`npx tsc -b --noEmit` の未使用エラーに従って外す（`SkyBackdrop`・`Nav` が使う `useCallback`・`useScrollProgress` は残る）。

- [ ] **Step 3: 旧写真の参照が無いことを確かめて削除する**

Run: `grep -rn "hero-imanosora\|/lp/hour\|feature-kurabe\|feature-ai" src public index.html`
Expected: 出力なし
Run: `git rm public/lp/hero-imanosora.png public/lp/hour.png public/lp/feature-kurabe.png public/lp/feature-ai.webp`

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/components/LandingPage.test.tsx`
Expected: 8 passed。落ちたら文言・クラス名をテストに合わせて直す（テストは仕様の約束なので、テスト側は変えない）。

- [ ] **Step 5: 全体の確認**

Run: `npx tsc -b --noEmit && npx vitest run && npx eslint src/components/LandingPage.tsx src/lib/analytics.ts && npm run build`
Expected: 型エラーなし・全テスト成功・LandingPage.tsx の lint エラーが変更前より増えていない・ビルド成功

- [ ] **Step 6: Commit**

```bash
git add -A src/components/LandingPage.tsx public/lp
git commit -m "refactor: LP の旧章（機能一覧・AI・3ステップ等）と旧写真を削除し、新しい並びにする"
```

---

### Task 7: 実画面の検証

- [ ] **Step 1: 撮影する**

dev サーバー起動中に、LP（ゲストモードでない状態の `/`）を 375px・1280px・reduced-motion（`page.emulateMedia({ reducedMotion: 'reduce' })`）で全体撮影する。折りたたみを1つ開いた状態も撮る。

- [ ] **Step 2: 目で確かめる観点**

- 最初の画面（375px）で見出し・2 つのボタン・写真の上端が見える
- 2 つのボタンが同じ見た目・同じ幅（375px は縦並び）
- 写真の数字と「積算温度、去年より◯日遅い。」の数字が一致
- 節気の区切りの絵が青い台の上で見える
- 1280px で各章が左右 2 段、空くらべは写真が左
- reduced-motion で全要素が最初から見えている
- 折りたたみの開閉で中身が出る

- [ ] **Step 3: tasks/todo.md に結果を記録し、develop へ push**

```bash
git add tasks/todo.md
git commit -m "docs: LP 全面見直しの検証結果を記録"
git push origin develop
```

main への反映はユーザーの指示を待つ。
