# ヒーローに二十四節気・七十二候を添える Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 空もようのヒーロー下部の空きスペースに、その日の二十四節気・七十二候（読み付き）と、節気ごとの淡い水墨・水彩風イラストを「そっと」添える。

**Architecture:** 節気・候は太陽の視黄経から天文計算で求める純粋関数（`src/lib/sekki.ts`、固定日付表なし）。イラストは 24 枚の SVG を共通の「筆・にじみ」フィルタで描く（`src/components/sky/sekkiArt.tsx`）。表示部品 `SekkiBadge` を `SkyHero` の下部に置く。ヒーローの高さは変えない。

**Tech Stack:** React 19 / TypeScript / SVG（feTurbulence・feDisplacementMap・feGaussianBlur）/ motion 13（`m.*` のみ）/ Vitest / Playwright 撮影

## 設計（ユーザー合意済み 2026-10-01）

- **配置**: ヒーローの「最高／最低」行の下、ヒーロー下部の空き領域に左寄せ。**ヒーローの高さ（min-height 40vh / PC 320px）は変えない**。メインの天気情報を押し下げない。
- **構成**: 左に絵（56px 角）、右に2行。
  - 1行目 二十四節気（例「秋分」）0.85rem、白 85%
  - 2行目 七十二候（例「蟄虫坏戸」）0.72rem、白 70% ＋ 読み（「むしかくれてとをふさぐ」）0.62rem、白 55%
  - 幅が足りない時は読みを省略（1行に収まらない場合は `display:none`。CSS コンテナクエリまたは幅判定で）。
- **主張しない**: 主役（気温）より明確に控えめ。文字の影なし、太字なし（節気のみ 500）。
- **絵**: 白〜生成り（胡粉）の淡い水彩・水墨風。筆の掠れ（輪郭の微小な揺らぎ）、にじみ（ぼかし＋低不透明度の重ね）。一色・余白多め。24 枚で線の太さ・構図の約束事を統一。
- **絵柄**: 春 立春=梅、雨水=雪解けの流れ、啓蟄=芽吹く土、春分=桜、清明=燕、穀雨=藤 ／ 夏 立夏=若葉、小満=麦の穂、芒種=早苗、夏至=紫陽花、小暑=蓮、大暑=入道雲 ／ 秋 立秋=桔梗、処暑=稲の穂、白露=露草と露、秋分=萩と月、寒露=菊、霜降=紅葉 ／ 冬 立冬=山茶花、小雪=初雪の枝、大雪=雪の松、冬至=柚子、小寒=寒椿、大寒=氷柱
- **動き**: 起動後初回のみ、絵がゆっくり（約1.2秒）にじみ出る（opacity＋わずかな scale）。以後は即表示。それ以外は静止。reduced-motion では即表示。
- **データ**: 七十二候は略本暦（現在日本で一般的なもの）。
- **予算**: 24 枚で gzip 10〜15KB 程度。

---

### Task 1: 節気・候の計算 `src/lib/sekki.ts`（担当: Haiku）

**Files:** Create `src/lib/sekki.ts`, `src/lib/sekki.test.ts`

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/sekki.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { SEKKI, sekkiForDate, solarLongitude } from './sekki';

/** JST の正午を表す Date */
const jstNoon = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 3, 0, 0));

describe('data', () => {
  it('has 24 sekki with 3 kou each (72 total), all with readings', () => {
    expect(SEKKI).toHaveLength(24);
    for (const s of SEKKI) {
      expect(s.kou).toHaveLength(3);
      expect(s.reading.length).toBeGreaterThan(0);
      for (const k of s.kou) {
        expect(k.name.length).toBeGreaterThan(0);
        expect(k.reading.length).toBeGreaterThan(0);
      }
    }
    expect(SEKKI[0].name).toBe('立春');
    expect(SEKKI[15].name).toBe('秋分');
    expect(SEKKI[15].kou[1].name).toBe('蟄虫坏戸');
  });
});

describe('solarLongitude', () => {
  it('is ~0° at the 2026 March equinox (2026-03-20 14:46 UTC)', () => {
    const lon = solarLongitude(new Date(Date.UTC(2026, 2, 20, 14, 46)));
    const diff = Math.min(lon, 360 - lon);
    expect(diff).toBeLessThan(0.05);
  });
  it('is ~180° at the 2026 September equinox (2026-09-23 00:05 UTC)', () => {
    expect(Math.abs(solarLongitude(new Date(Date.UTC(2026, 8, 23, 0, 5))) - 180)).toBeLessThan(0.05);
  });
});

describe('sekkiForDate (JST calendar day)', () => {
  it.each([
    [2026, 2, 3, '大寒'], [2026, 2, 4, '立春'],
    [2026, 3, 19, '啓蟄'], [2026, 3, 20, '春分'],
    [2026, 6, 20, '芒種'], [2026, 6, 21, '夏至'],
    [2026, 9, 22, '白露'], [2026, 9, 23, '秋分'],
    [2026, 12, 21, '大雪'], [2026, 12, 22, '冬至'],
  ] as const)('%i-%i-%i -> %s', (y, m, d, name) => {
    expect(sekkiForDate(jstNoon(y, m, d)).name).toBe(name);
  });

  it('2026-10-01 is 秋分 次候 蟄虫坏戸', () => {
    const s = sekkiForDate(jstNoon(2026, 10, 1));
    expect(s.name).toBe('秋分');
    expect(s.kouIndex).toBe(15 * 3 + 1);
    expect(s.kou.name).toBe('蟄虫坏戸');
    expect(s.kou.reading).toBe('むしかくれてとをふさぐ');
  });

  it('uses the JST date even late at night UTC-wise (2026-09-22 23:30 JST is still 白露)', () => {
    expect(sekkiForDate(new Date(Date.UTC(2026, 8, 22, 14, 30))).name).toBe('白露');
  });
});
```

Run: `npx vitest run src/lib/sekki.test.ts` → FAIL（`./sekki` 未解決）

- [ ] **Step 2: 実装** — `src/lib/sekki.ts`

```ts
// 二十四節気・七十二候（略本暦）。固定の日付表は持たず、太陽の視黄経から求める。
// 暦の慣例どおり「その節気・候に入る瞬間を含む JST の日」からその節気・候とする。
import { jstDateString } from './sky';

export interface Kou { name: string; reading: string }
export interface Sekki { name: string; reading: string; kou: readonly [Kou, Kou, Kou] }
export interface SekkiOfDay {
  /** 0=立春 … 23=大寒 */
  index: number;
  name: string;
  reading: string;
  /** 0〜71（立春初候=0） */
  kouIndex: number;
  kou: Kou;
}

const k = (name: string, reading: string): Kou => ({ name, reading });

export const SEKKI: readonly Sekki[] = [
  { name: '立春', reading: 'りっしゅん', kou: [k('東風解凍', 'はるかぜこおりをとく'), k('黄鶯睍睆', 'うぐいすなく'), k('魚上氷', 'うおこおりをいずる')] },
  { name: '雨水', reading: 'うすい', kou: [k('土脉潤起', 'つちのしょううるおいおこる'), k('霞始靆', 'かすみはじめてたなびく'), k('草木萌動', 'そうもくめばえいずる')] },
  { name: '啓蟄', reading: 'けいちつ', kou: [k('蟄虫啓戸', 'すごもりむしとをひらく'), k('桃始笑', 'ももはじめてさく'), k('菜虫化蝶', 'なむしちょうとなる')] },
  { name: '春分', reading: 'しゅんぶん', kou: [k('雀始巣', 'すずめはじめてすくう'), k('桜始開', 'さくらはじめてひらく'), k('雷乃発声', 'かみなりすなわちこえをはっす')] },
  { name: '清明', reading: 'せいめい', kou: [k('玄鳥至', 'つばめきたる'), k('鴻雁北', 'こうがんかえる'), k('虹始見', 'にじはじめてあらわる')] },
  { name: '穀雨', reading: 'こくう', kou: [k('葭始生', 'あしはじめてしょうず'), k('霜止出苗', 'しもやんでなえいずる'), k('牡丹華', 'ぼたんはなさく')] },
  { name: '立夏', reading: 'りっか', kou: [k('蛙始鳴', 'かわずはじめてなく'), k('蚯蚓出', 'みみずいずる'), k('竹笋生', 'たけのこしょうず')] },
  { name: '小満', reading: 'しょうまん', kou: [k('蚕起食桑', 'かいこおきてくわをはむ'), k('紅花栄', 'べにばなさかう'), k('麦秋至', 'むぎのときいたる')] },
  { name: '芒種', reading: 'ぼうしゅ', kou: [k('蟷螂生', 'かまきりしょうず'), k('腐草為螢', 'くされたるくさほたるとなる'), k('梅子黄', 'うめのみきばむ')] },
  { name: '夏至', reading: 'げし', kou: [k('乃東枯', 'なつかれくさかるる'), k('菖蒲華', 'あやめはなさく'), k('半夏生', 'はんげしょうず')] },
  { name: '小暑', reading: 'しょうしょ', kou: [k('温風至', 'あつかぜいたる'), k('蓮始開', 'はすはじめてひらく'), k('鷹乃学習', 'たかすなわちわざをならう')] },
  { name: '大暑', reading: 'たいしょ', kou: [k('桐始結花', 'きりはじめてはなをむすぶ'), k('土潤溽暑', 'つちうるおうてむしあつし'), k('大雨時行', 'たいうときどきふる')] },
  { name: '立秋', reading: 'りっしゅう', kou: [k('涼風至', 'すずかぜいたる'), k('寒蝉鳴', 'ひぐらしなく'), k('蒙霧升降', 'ふかききりまとう')] },
  { name: '処暑', reading: 'しょしょ', kou: [k('綿柎開', 'わたのはなしべひらく'), k('天地始粛', 'てんちはじめてさむし'), k('禾乃登', 'こくものすなわちみのる')] },
  { name: '白露', reading: 'はくろ', kou: [k('草露白', 'くさのつゆしろし'), k('鶺鴒鳴', 'せきれいなく'), k('玄鳥去', 'つばめさる')] },
  { name: '秋分', reading: 'しゅうぶん', kou: [k('雷乃収声', 'かみなりすなわちこえをおさむ'), k('蟄虫坏戸', 'むしかくれてとをふさぐ'), k('水始涸', 'みずはじめてかるる')] },
  { name: '寒露', reading: 'かんろ', kou: [k('鴻雁来', 'こうがんきたる'), k('菊花開', 'きくのはなひらく'), k('蟋蟀在戸', 'きりぎりすとにあり')] },
  { name: '霜降', reading: 'そうこう', kou: [k('霜始降', 'しもはじめてふる'), k('霎時施', 'こさめときどきふる'), k('楓蔦黄', 'もみじつたきばむ')] },
  { name: '立冬', reading: 'りっとう', kou: [k('山茶始開', 'つばきはじめてひらく'), k('地始凍', 'ちはじめてこおる'), k('金盞香', 'きんせんかさく')] },
  { name: '小雪', reading: 'しょうせつ', kou: [k('虹蔵不見', 'にじかくれてみえず'), k('朔風払葉', 'きたかぜこのはをはらう'), k('橘始黄', 'たちばなはじめてきばむ')] },
  { name: '大雪', reading: 'たいせつ', kou: [k('閉塞成冬', 'そらさむくふゆとなる'), k('熊蟄穴', 'くまあなにこもる'), k('鱖魚群', 'さけのうおむらがる')] },
  { name: '冬至', reading: 'とうじ', kou: [k('乃東生', 'なつかれくさしょうず'), k('麋角解', 'さわしかのつのおつる'), k('雪下出麦', 'ゆきわたりてむぎのびる')] },
  { name: '小寒', reading: 'しょうかん', kou: [k('芹乃栄', 'せりすなわちさかう'), k('水泉動', 'しみずあたたかをふくむ'), k('雉始雊', 'きじはじめてなく')] },
  { name: '大寒', reading: 'だいかん', kou: [k('款冬華', 'ふきのはなさく'), k('水沢腹堅', 'さわみずこおりつめる'), k('鶏始乳', 'にわとりはじめてとやにつく')] },
];

const RAD = Math.PI / 180;

/** 太陽の視黄経（度, 0〜360）。Meeus の簡易式（誤差 約0.01°＝約15分）。 */
export function solarLongitude(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m * RAD)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * m * RAD)
    + 0.000289 * Math.sin(3 * m * RAD);
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  return ((lambda % 360) + 360) % 360;
}

/** その JST 暦日の節気・候（その日のうちに入るものを含む＝日の終わり時点で判定） */
export function sekkiForDate(now: Date): SekkiOfDay {
  const [y, mo, d] = jstDateString(now).split('-').map(Number);
  // JST 23:59:59.999 = 同日 UTC 14:59:59.999
  const endOfDay = new Date(Date.UTC(y, mo - 1, d, 15, 0, 0) - 1);
  const offset = (solarLongitude(endOfDay) - 315 + 360) % 360; // 立春(315°)起点
  const kouIndex = Math.floor(offset / 5);
  const index = Math.floor(kouIndex / 3);
  const s = SEKKI[index];
  return { index, name: s.name, reading: s.reading, kouIndex, kou: s.kou[kouIndex % 3] };
}
```

- [ ] **Step 3: 通過確認** — `npx vitest run src/lib/sekki.test.ts` 全 PASS。失敗した場合は**データ・式を勝手に変えず** BLOCKED で報告。
- [ ] **Step 4: Commit** — `feat: 太陽黄経から二十四節気・七十二候を求めるsekki計算を追加`

---

### Task 2: 24 枚の水墨・水彩風イラスト（担当: Opus）

**Files:** Create `src/components/sky/sekkiArt.tsx`, `src/components/sky/sekkiArt.test.tsx`

**インターフェース:**
```ts
export function SekkiArt(props: { index: number; size?: number; className?: string }): JSX.Element; // index 0〜23（SEKKI と同順）
export const SEKKI_ART_COUNT = 24;
```

**表現の約束事（全24枚共通・厳守）:**
- `viewBox="0 0 64 64"`、`aria-hidden="true"`、色は白（`#FFFFFF`）と生成り（`#F3EBDD`）のみ。空のグラデーション上に置かれる前提で、**黒・灰は使わない**。
- 共通フィルタ（各 SVG 内に `<defs>`。`useId()` で ID 衝突を防ぐ）:
  - 筆: `feTurbulence type="fractalNoise" baseFrequency≈0.9 numOctaves=2` → `feDisplacementMap scale≈1.2〜1.8`（線の縁の微かな揺らぎ・掠れ）
  - にじみ: `feGaussianBlur stdDeviation≈1.2〜2` を淡塗りレイヤーに
- レイヤー構成: ①にじみ淡塗り（不透明度 0.12〜0.25、ぼかし）②主線（筆フィルタ、stroke 1.2〜2.0、`stroke-linecap="round"`、不透明度 0.75〜0.9、線の入り抜きを感じさせるため太さの違うパスを重ねるか、細長い塗りの形で描く）③点景（花芯・露・雪など小さな点、0.6〜0.9）。
- 構図: 主題は中央やや下寄り、上と片側に余白（最低でも面積の 40% は空白）。描き込みすぎない（主線パスは 1 枚あたり概ね 3〜10 本）。写実より「一筆で描いた気配」。
- 1 枚あたりの SVG 文字数の目安 1.5KB 以内（24 枚合計 gzip 15KB 以内）。
- 絵柄は設計の表のとおり（index 0=立春=梅 … 23=大寒=氷柱）。

**検証（必須・反復）:**
1. テスト: 24 枚すべてが描画でき、`aria-hidden` で、`fill`/`stroke` に `#FFFFFF` と `#F3EBDD`（と `none`/`url(#…)`）以外の色を使っていない。
2. **見本帳で目視**: 一時ハーネス（例 `sekki-sheet.html` + `src/_tmp_sekkiSheet.tsx`、コミットしない）で、実際のヒーローと同じ空のグラデーション（`skyPalette` の `noon/clear`、`night/clear`、`noon/rain`、`dawn/clear` の4種）を背景に、24 枚を 56px と 160px で並べた画面を Playwright で撮影し、Read で確認。基準: 何が描かれているか一目で分かる／24 枚の描き方がそろっている／どの空でも淡く見えるが消えない／主張しすぎない。満たすまで描き直す。撮影画像は `screenshots/sekki-sheet/` に残してよい（gitignore 済み）。ハーネスは削除してからコミット。
3. `npm run build` の gzip 増加を報告。

- [ ] Commit `feat: 二十四節気の水墨・水彩風イラスト24枚を追加`

---

### Task 3: 表示部品 `SekkiBadge` とヒーローへの組み込み（担当: Sonnet）

**Files:** Create `src/components/sky/SekkiBadge.tsx`, `src/components/sky/SekkiBadge.test.tsx`；Modify `src/components/sky/SkyHero.tsx`, `src/components/sky/sky.css`

- `SekkiBadge({ date?: Date })`: `sekkiForDate(date ?? new Date())` で求め、左に `SekkiArt index size=56`、右に2行（設計のとおりのサイズ・白の濃さ）。`aria-label` は「二十四節気 秋分、七十二候 蟄虫坏戸（むしかくれてとをふさぐ）」の形。絵と読みは装飾として視覚表示、文字は読み上げ対象。
- 日付は WeatherTab で既に1分ごとに再計算される仕組みとは独立に、`SekkiBadge` 内で `useMemo` + 日付文字列（`jstDateString(new Date())`）依存で十分（日付が変わる瞬間に開いていても次の再描画で更新されればよい）。
- 初回演出: `hasIntroPlayed()` が false の時にマウントされた場合のみ、`m.div` で opacity 0→1・scale .96→1 を 1.2 秒（`ease: [0.16, 1, 0.3, 1]`、delay 0.4s）。それ以外は即表示。
- **配置**: `SkyHero` の内側レイアウトで、「最高／最低・最終更新」の行の下に置き、ヒーローの空き領域（下端の 40px パディングとカード重なり 24px を考慮）に収める。**ヒーローの min-height を変えないこと**。内容がヒーロー高を超える小さい画面（高さ 640px 未満等）では、読み→候の行の順に省略して収める。撮影で 375×812 と 375×667、1280×800 を確認。
- 幅が狭く読みが1行に収まらない場合は読みを非表示（`ResizeObserver` かコンテナクエリ `@container`）。
- テスト: 2026-10-01 を渡すと「秋分」「蟄虫坏戸」「むしかくれてとをふさぐ」が出る、aria-label の形式、絵が1つ描画される。

**検証:** `npm run test`・`npx tsc -b`・`npm run build`。dev サーバーで `npm run screenshots -- sekki`、さらに一時スクリプトで 375×667 も撮影し、Read で「そっと添えられているか（主張しすぎない）」「気温など主役の位置が以前と同じか」を確認。

- [ ] Commit `feat: 空もようのヒーローに二十四節気・七十二候をそっと添える`

---

### Task 4: 検証・レビュー・取り込み（担当: コントローラー）

- [ ] test / tsc / build（gzip 比較: 428.82KB 基準）
- [ ] 見本帳と実画面の撮影を目視
- [ ] Sonnet レビュー → 指摘対応
- [ ] develop へマージ・push。main は指示待ち
