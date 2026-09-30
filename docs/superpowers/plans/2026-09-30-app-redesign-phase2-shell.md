# アプリ全面リニューアル 第2段階「骨格」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 空もようの上部に「今の空」を描くヒーローを置き、ヘッダー・ボトムナビ・タブ遷移を空と Motion で作り直し、設定とヘルプを下から出るシートにする。機能は一切変えない。

**Architecture:** 空の見た目は純粋関数 `src/lib/sky.ts`（時間帯×天気→グラデーション、白文字コントラストを自動保証）で決める。WeatherTab が予報から「今の空」を算出して小さな zustand ストア `src/skyStore.ts` に発行し、App のヘッダー／他タブの空帯はそれを購読する。App.tsx の骨格部分（ヘッダー・ボトムナビ）は `src/components/shell/` に切り出す。設定・ヘルプは `topTab` から外し、第1段階の `Sheet` で表示する。

**Tech Stack:** React 19 / TypeScript / zustand 5 / motion 13（`m.*` のみ、`LazyMotion strict`）/ Vitest + Testing Library / Playwright（撮影）

**仕様書:** [docs/superpowers/specs/2026-09-30-app-visual-redesign-design.md](../specs/2026-09-30-app-visual-redesign-design.md) §2
**第1段階の成果物:** `src/lib/motion.ts`（`springs.press/move/enter`, `pressScale`）、`src/lib/contrast.ts`（`contrastRatio`）、`src/components/ui/{Button,SegmentedControl,Sheet,MotionProvider,testUtils}.tsx`、`src/components/ui/ui.css`、`scripts/screenshots.mjs`

---

## 前提知識（実装者向け）

- テスト `npm run test`（現在73件）、型 `npx tsc -b`、ビルド `npm run build`。
- `motion` は `import { m, ... } from 'motion/react'`。`motion.div` は使用禁止（strict でエラー）。
- UI部品テストは `src/components/ui/testUtils.tsx` の `setupMotionTestEnv()`（beforeAll）と `renderWithMotion()` を使う。
- **日付・時刻計算はローカル時刻の `Date` を作って `toISOString()` しない**（TZずれの教訓）。予報APIの時刻文字列（`"2026-05-21T04:43"`）は JST のローカル表記なので、文字列から時・分を取り出して「0時からの分」で比較する。現在時刻は `Date` の UTC 値に +9h して `getUTC*` で JST を得る。
- 予報データ型は `src/api/forecast.ts`：`HourlyForecast { time: "YYYY-MM-DDTHH:00", temperature, weatherCode, ... }`、`DailyForecastData { date, tempMax, tempMin, sunrise, sunset, ... }`。
- 天気コード→日本語は `codeToLabel(code)`、アイコンは `<WeatherIcon code isNight size />`（`src/components/weather/WeatherIcon.tsx`）。
- 画面幅判定は既存と同じ `useState(() => window.innerWidth < 768)`。
- 設定内の2つの全画面オーバーレイ（`LocationMapModal.tsx` の地図、`LocationSettings.tsx` の削除確認）は `position: fixed`。シートは transform を持つため、その内側の fixed は**シート基準に閉じ込められる**。これを避けるため Task 8 でポータル化する。
- 撮影: 別ターミナルで `npm run dev -- --port 5180 --strictPort`、`npm run screenshots -- <名前>`。

## ファイル構成

| ファイル | 種別 | 責務 |
|---|---|---|
| `src/lib/sky.ts` | 新規 | 時間帯判定・天気分類・空グラデーション（白文字4.5:1を自動保証）・現在時刻の予報行選択 |
| `src/lib/sky.test.ts` | 新規 | 上記＋36通りのコントラスト検証 |
| `src/skyStore.ts` | 新規 | 今の空（パレット・要約）とヒーロー可視状態を共有する zustand ストア |
| `src/skyStore.test.ts` | 新規 | ストアのテスト |
| `src/components/sky/SkyParticles.tsx` + `sky.css` | 新規 | 天気別の粒子演出（CSS アニメ、最大60個、停止制御） |
| `src/components/sky/SkyHero.tsx` | 新規 | 空もようのヒーロー（地点・気温・天気・最高最低・操作ボタン） |
| `src/components/sky/SkyBand.tsx` | 新規 | 空くらべ・空しらべ上部の低い空帯（画面タイトル） |
| `src/components/sky/*.test.tsx` | 新規 | 各コンポーネントのテスト |
| `src/components/shell/AppHeader.tsx` | 新規 | 空色ヘッダー（ロゴ・PCナビ・ヘルプ・ログイン/ログアウト・設定・縮小時の気温要約） |
| `src/components/shell/BottomNav.tsx` | 新規 | モバイルのボトムナビ（選択ハイライトが滑る） |
| `src/components/shell/shell.css` | 新規 | 上記のスタイル |
| `src/components/shell/*.test.tsx` | 新規 | 各コンポーネントのテスト |
| `src/components/weather/WeatherTab.tsx` | 変更 | 上部の操作パネルを SkyHero に置換、今の空をストアへ発行 |
| `src/App.tsx` | 変更 | ヘッダー/ボトムナビを shell に置換、`topTab` から settings/help を除去しシート化、タブ遷移、SkyBand |
| `src/components/HelpPage.tsx` | 変更 | `onBack` を任意にし、無いときは戻るボタンを出さない |
| `src/components/settings/SettingsTab.tsx` | 変更 | `settings-theme` クラス除去 |
| `src/components/settings/LocationMapModal.tsx` / `LocationSettings.tsx` | 変更 | 全画面オーバーレイを `createPortal(…, document.body)` 化 |
| `src/index.css` | 変更 | `--settings-*` トークン・`.settings-theme`・`.settings-subtab-btn` 以外の設定専用色を撤去、シート内 `.app-container` の余白調整 |
| `src/settingsTheme.test.ts` | 削除 | 設定の色区別をやめるため |
| `scripts/screenshots.mjs` | 変更 | 設定シート・ヘルプシート・スクロール後の撮影を追加 |

---

### Task 1: 空の計算ロジック `src/lib/sky.ts`（担当: Haiku）

**Files:**
- Create: `src/lib/sky.ts`
- Test: `src/lib/sky.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sky.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  TIMES_OF_DAY, SKY_WEATHERS, classifyWeather, currentHourIndex, ensureWhiteContrast,
  hhmmToMinutes, jstMinutesOfDay, jstDateString, mixHex, skyPalette, timeOfDay,
} from './sky';

describe('time helpers', () => {
  it('hhmmToMinutes reads HH:MM from API strings', () => {
    expect(hhmmToMinutes('2026-05-21T04:43')).toBe(4 * 60 + 43);
    expect(hhmmToMinutes('2026-05-21T18:52')).toBe(18 * 60 + 52);
  });

  it('jstMinutesOfDay / jstDateString convert UTC instants to JST', () => {
    const d = new Date(Date.UTC(2026, 8, 30, 15, 30)); // = 2026-10-01 00:30 JST
    expect(jstMinutesOfDay(d)).toBe(30);
    expect(jstDateString(d)).toBe('2026-10-01');
  });
});

describe('timeOfDay', () => {
  const sunrise = 5 * 60 + 30; // 05:30
  const sunset = 17 * 60 + 30; // 17:30
  it.each([
    [2 * 60, 'night'],
    [5 * 60, 'dawn'],          // sunrise-30
    [5 * 60 + 59, 'dawn'],     // sunrise+29
    [6 * 60, 'morning'],       // sunrise+30
    [9 * 60 + 29, 'morning'],  // sunrise+3h59
    [9 * 60 + 30, 'noon'],     // sunrise+4h
    [15 * 60 + 59, 'noon'],
    [16 * 60, 'evening'],      // sunset-90
    [17 * 60 + 44, 'evening'], // sunset+14
    [17 * 60 + 45, 'dusk'],    // sunset+15
    [18 * 60 + 29, 'dusk'],
    [18 * 60 + 30, 'night'],   // sunset+60
    [23 * 60, 'night'],
  ] as const)('%i min -> %s', (now, expected) => {
    expect(timeOfDay(now, sunrise, sunset)).toBe(expected);
  });
});

describe('classifyWeather', () => {
  it.each([
    [0, 'clear'], [1, 'clear'], [2, 'cloudy'], [3, 'cloudy'],
    [45, 'fog'], [48, 'fog'],
    [51, 'rain'], [61, 'rain'], [67, 'rain'], [80, 'rain'], [82, 'rain'],
    [71, 'snow'], [77, 'snow'], [85, 'snow'], [86, 'snow'],
    [95, 'thunder'], [99, 'thunder'],
    [999, 'cloudy'],
  ] as const)('code %i -> %s', (code, expected) => {
    expect(classifyWeather(code)).toBe(expected);
  });
});

describe('color helpers', () => {
  it('mixHex blends linearly', () => {
    expect(mixHex('#000000', '#ffffff', 0.5).toLowerCase()).toBe('#808080');
    expect(mixHex('#123456', '#000000', 0).toLowerCase()).toBe('#123456');
  });

  it('ensureWhiteContrast darkens only when needed', () => {
    expect(ensureWhiteContrast('#1f5fae').toLowerCase()).toBe('#1f5fae');
    const fixed = ensureWhiteContrast('#9ec5ee');
    expect(contrastRatio('#ffffff', fixed)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('skyPalette', () => {
  it('meets 4.5:1 for white text on both stops for all 36 combinations', () => {
    for (const tod of TIMES_OF_DAY) {
      for (const w of SKY_WEATHERS) {
        const p = skyPalette(tod, w);
        expect(contrastRatio('#ffffff', p.top), `${tod}/${w} top`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio('#ffffff', p.bottom), `${tod}/${w} bottom`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('makes overcast skies duller than clear skies', () => {
    const clear = skyPalette('noon', 'clear');
    const rain = skyPalette('noon', 'rain');
    expect(clear.bottom).not.toBe(rain.bottom);
  });

  it('marks night-like times as isNight', () => {
    expect(skyPalette('night', 'clear').isNight).toBe(true);
    expect(skyPalette('dusk', 'clear').isNight).toBe(true);
    expect(skyPalette('noon', 'clear').isNight).toBe(false);
  });
});

describe('currentHourIndex', () => {
  const hourly = ['2026-09-30T21:00', '2026-09-30T22:00', '2026-09-30T23:00', '2026-10-01T00:00'].map(time => ({ time }));
  it('picks the last hour at or before now (JST)', () => {
    const now = new Date(Date.UTC(2026, 8, 30, 13, 40)); // 22:40 JST
    expect(currentHourIndex(hourly, now)).toBe(1);
  });
  it('returns -1 when all hours are in the future', () => {
    const now = new Date(Date.UTC(2026, 8, 30, 11, 0)); // 20:00 JST
    expect(currentHourIndex(hourly, now)).toBe(-1);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sky.test.ts` → FAIL（`./sky` が解決できない）

- [ ] **Step 3: 実装**

`src/lib/sky.ts`:

```ts
// 空の見た目を決める純粋関数群（仕様書 §1 空パレット / §2 ヒーロー）。
// 時刻は「0時からの分（JST）」で扱う。ローカル Date + toISOString は使わない（TZずれ防止）。
import { contrastRatio } from './contrast';

export const TIMES_OF_DAY = ['dawn', 'morning', 'noon', 'evening', 'dusk', 'night'] as const;
export type TimeOfDay = typeof TIMES_OF_DAY[number];

export const SKY_WEATHERS = ['clear', 'cloudy', 'rain', 'snow', 'thunder', 'fog'] as const;
export type SkyWeather = typeof SKY_WEATHERS[number];

export interface SkyPalette {
  top: string;
  bottom: string;
  isNight: boolean;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "2026-05-21T04:43" → 283 */
export function hhmmToMinutes(isoLocal: string): number {
  const hh = Number(isoLocal.slice(11, 13));
  const mm = Number(isoLocal.slice(14, 16));
  return hh * 60 + mm;
}

/** 現在時刻の JST「0時からの分」 */
export function jstMinutesOfDay(now: Date): number {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/** 現在時刻の JST 日付 "YYYY-MM-DD" */
export function jstDateString(now: Date): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 日の出・日の入り（分）から時間帯を決める */
export function timeOfDay(nowMin: number, sunriseMin: number, sunsetMin: number): TimeOfDay {
  if (nowMin >= sunriseMin - 45 && nowMin < sunriseMin + 30) return 'dawn';
  if (nowMin >= sunriseMin + 30 && nowMin < sunriseMin + 240) return 'morning';
  if (nowMin >= sunriseMin + 240 && nowMin < sunsetMin - 90) return 'noon';
  if (nowMin >= sunsetMin - 90 && nowMin < sunsetMin + 15) return 'evening';
  if (nowMin >= sunsetMin + 15 && nowMin < sunsetMin + 60) return 'dusk';
  return 'night';
}

/** WMO 天気コード → 空の天気分類 */
export function classifyWeather(code: number): SkyWeather {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  return 'cloudy';
}

const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const toHex = (rgb: number[]): string =>
  '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** a と b を t（0〜1）で線形補間 */
export function mixHex(a: string, b: string, t: number): string {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex(ra.map((v, i) => v + (rb[i] - v) * t));
}

/** 白文字が 4.5:1 を満たすまで 4% ずつ黒に寄せる */
export function ensureWhiteContrast(hex: string): string {
  let c = hex;
  for (let i = 0; i < 40 && contrastRatio('#ffffff', c) < 4.5; i++) c = mixHex(c, '#000000', 0.04);
  return c;
}

const BASE: Record<TimeOfDay, [string, string]> = {
  dawn:    ['#2B3A67', '#C0697A'],
  morning: ['#2F6DB5', '#6FA3D6'],
  noon:    ['#1F5FAE', '#4C8FD1'],
  evening: ['#3A3F7A', '#D9774B'],
  dusk:    ['#26305E', '#6A4C7E'],
  night:   ['#0F1A33', '#1E2F55'],
};

/** 天気ごとに寄せる色と割合（くもり・雨は彩度を落として重く） */
const WEATHER_TINT: Record<SkyWeather, [string, number]> = {
  clear:   ['#000000', 0],
  cloudy:  ['#6B7785', 0.45],
  rain:    ['#4A5663', 0.55],
  snow:    ['#8A9BB0', 0.40],
  fog:     ['#8C939B', 0.55],
  thunder: ['#2E3440', 0.60],
};

export function skyPalette(tod: TimeOfDay, weather: SkyWeather): SkyPalette {
  const [top, bottom] = BASE[tod];
  const [tint, amount] = WEATHER_TINT[weather];
  return {
    top: ensureWhiteContrast(mixHex(top, tint, amount)),
    bottom: ensureWhiteContrast(mixHex(bottom, tint, amount)),
    isNight: tod === 'night' || tod === 'dusk',
  };
}

/** 時間別予報のうち「現在時刻以前で最後の行」の添字。無ければ -1 */
export function currentHourIndex(hourly: readonly { time: string }[], now: Date): number {
  const today = jstDateString(now);
  const nowMin = jstMinutesOfDay(now);
  let idx = -1;
  hourly.forEach((h, i) => {
    const date = h.time.slice(0, 10);
    if (date < today || (date === today && hhmmToMinutes(h.time) <= nowMin)) idx = i;
  });
  return idx;
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run src/lib/sky.test.ts` → 全件 PASS。
`ensureWhiteContrast('#1f5fae')` が変化してしまう場合（= #1F5FAE が 4.5 未満）はテストの入力色を `#1a4f91` に替える（関数側は変えない）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/sky.ts src/lib/sky.test.ts
git commit -m "feat: 時間帯×天気から空のグラデーションを決めるsky計算ロジックを追加"
```

---

### Task 2: 空の共有ストア `src/skyStore.ts`（担当: Haiku）

**Files:**
- Create: `src/skyStore.ts`
- Test: `src/skyStore.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/skyStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fallbackSky, useSkyStore } from './skyStore';

describe('skyStore', () => {
  beforeEach(() => useSkyStore.setState({ sky: null, summary: null, heroVisible: true }));

  it('starts empty with hero visible', () => {
    const s = useSkyStore.getState();
    expect(s.sky).toBeNull();
    expect(s.summary).toBeNull();
    expect(s.heroVisible).toBe(true);
  });

  it('publishes sky and summary together', () => {
    useSkyStore.getState().publish(
      { tod: 'noon', weather: 'rain', top: '#111111', bottom: '#222222', isNight: false },
      { temperature: 21.4, weatherCode: 61, locationName: '現在地' },
    );
    const s = useSkyStore.getState();
    expect(s.sky?.weather).toBe('rain');
    expect(s.summary?.temperature).toBe(21.4);
  });

  it('tracks hero visibility', () => {
    useSkyStore.getState().setHeroVisible(false);
    expect(useSkyStore.getState().heroVisible).toBe(false);
  });

  it('fallbackSky derives a clear sky from the clock only', () => {
    const noonJst = new Date(Date.UTC(2026, 8, 30, 3, 0)); // 12:00 JST
    const s = fallbackSky(noonJst);
    expect(s.tod).toBe('noon');
    expect(s.weather).toBe('clear');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/skyStore.test.ts` → FAIL（`./skyStore` が解決できない）

- [ ] **Step 3: 実装**

`src/skyStore.ts`:

```ts
// 「今の空」を WeatherTab（発行側）と ヘッダー・空帯（購読側）で共有する。
import { create } from 'zustand';
import { jstMinutesOfDay, skyPalette, timeOfDay, type SkyWeather, type TimeOfDay } from './lib/sky';

export interface SkyState {
  tod: TimeOfDay;
  weather: SkyWeather;
  top: string;
  bottom: string;
  isNight: boolean;
}

export interface SkySummary {
  temperature: number;
  weatherCode: number;
  locationName: string;
}

interface SkyStore {
  sky: SkyState | null;
  summary: SkySummary | null;
  /** 空もようのヒーローが画面内に見えているか（ヘッダーの縮小表示の切替に使う） */
  heroVisible: boolean;
  publish: (sky: SkyState, summary: SkySummary | null) => void;
  setHeroVisible: (visible: boolean) => void;
}

export const useSkyStore = create<SkyStore>(set => ({
  sky: null,
  summary: null,
  heroVisible: true,
  publish: (sky, summary) => set({ sky, summary }),
  setHeroVisible: heroVisible => set({ heroVisible }),
}));

/** 予報未取得時の空: 日の出6時・日の入り18時とみなした晴れ */
export function fallbackSky(now: Date = new Date()): SkyState {
  const tod = timeOfDay(jstMinutesOfDay(now), 6 * 60, 18 * 60);
  return { tod, weather: 'clear', ...skyPalette(tod, 'clear') };
}
```

- [ ] **Step 4: 通過を確認** → `npx vitest run src/skyStore.test.ts` 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/skyStore.ts src/skyStore.test.ts
git commit -m "feat: 今の空を画面間で共有するskyStoreを追加"
```

---

### Task 3: 天気の粒子演出 `SkyParticles`（担当: Sonnet）

**Files:**
- Create: `src/components/sky/SkyParticles.tsx`, `src/components/sky/sky.css`
- Test: `src/components/sky/SkyParticles.test.tsx`

**インターフェース:**

```ts
export function particleCount(weather: SkyWeather, isNight: boolean): number;
export function SkyParticles(props: { weather: SkyWeather; isNight: boolean; paused: boolean }): JSX.Element;
```

**振る舞い（受け入れ条件）:**
- 描画は**CSS アニメーションのみ**（JS の毎フレーム処理なし）。動かすのは `transform` と `opacity` だけ。要素は `aria-hidden="true"`、`pointer-events: none`、親を `position:absolute; inset:0; overflow:hidden` で覆う。
- 粒子数（`particleCount`）: clear 昼=0（代わりに太陽の光のにじみ1要素）／clear 夜=24（星のまたたき）／cloudy=4（大きな雲がゆっくり横に流れる、周期40〜70秒）／rain=40（斜めに落ちる細い線、周期0.6〜1.1秒）／snow=30（揺れながら落ちる点、周期6〜11秒）／fog=3（横長のもやが左右にたなびく）／thunder=rain と同じ40＋全体の閃光レイヤー1枚（12秒周期で一瞬だけ opacity 0→0.5→0）。**どの天気でも60以下**。
- 位置・遅延・周期は乱数でなく**添字から決まる決定的な値**（例: `(i * 37) % 100` を %、`(i * 0.173) % 1` 秒遅延）。再描画で動かない・テストで安定。
- `paused` が true のとき、ルート要素に `sky-particles--paused` クラスを付与し CSS で配下全要素の `animation-play-state: paused`。
- `@media (prefers-reduced-motion: reduce)` で配下の `animation: none`（静止画として表示される）。
- 背景の「呼吸」: 同コンポーネント内に `sky-breath` 要素1つ（白の放射グラデーション、opacity 0.06↔0.14 を10秒で往復）。これは粒子数に数えない。

**テスト（最低限これらを含める）:**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SKY_WEATHERS } from '../../lib/sky';
import { SkyParticles, particleCount } from './SkyParticles';

describe('SkyParticles', () => {
  it('never exceeds 60 particles', () => {
    for (const w of SKY_WEATHERS) for (const n of [true, false]) {
      expect(particleCount(w, n)).toBeLessThanOrEqual(60);
    }
  });
  it('renders exactly particleCount particles', () => {
    const { container } = render(<SkyParticles weather="rain" isNight={false} paused={false} />);
    expect(container.querySelectorAll('.sky-particle')).toHaveLength(particleCount('rain', false));
  });
  it('adds paused class when paused', () => {
    const { container } = render(<SkyParticles weather="snow" isNight={false} paused />);
    expect(container.firstElementChild?.className).toContain('sky-particles--paused');
  });
  it('is hidden from assistive tech', () => {
    const { container } = render(<SkyParticles weather="clear" isNight paused={false} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] Step 1: テストを書き失敗を確認 → Step 2: 実装 → Step 3: `npx vitest run src/components/sky/SkyParticles.test.tsx` 通過 → Step 4: Commit `feat: 天気別の空の粒子演出SkyParticlesを追加`

---

### Task 4: ヒーロー `SkyHero`（担当: Sonnet）

**Files:**
- Create: `src/components/sky/SkyHero.tsx`（スタイルは `sky.css` に追記）
- Test: `src/components/sky/SkyHero.test.tsx`

**インターフェース:**

```ts
interface SkyHeroProps {
  sky: SkyState;                       // src/skyStore.ts
  temperature: number | null;          // 現在気温（null=取得中 → "—°" 表示）
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  lastUpdated: string | null;          // "23:15"
  loading: boolean;
  /** 地点表示部。ログイン時は <select> を渡す（見た目は地点名テキスト、実体は透明に重ねた select） */
  locationSlot: ReactNode;
  onLocate: () => void;                // 現在地を表示
  locating: boolean;
  onRefresh: () => void;               // 更新
  children?: ReactNode;                // エラー文言等をヒーロー下部に出す
}
```

**レイアウト（モバイル基準、PC は内側を最大幅1200pxで中央寄せ）:**
- 背景: `linear-gradient(180deg, sky.top 0%, sky.bottom 100%)`。上端はヘッダー（Task 6、背景 `sky.top` 単色）と継ぎ目なくつながる。`min-height: 40vh`（PCは 320px）。下端は角丸なし、`padding-bottom: 40px`。
- 1行目: 左に `locationSlot`（白・0.95rem・600、▼の小アイコン付き）、右に丸い半透明白ボタン2つ（`MapPin`＝現在地、`RefreshCw`＝更新）。各ボタン `aria-label` を「現在地を表示」「更新」とし、44×44px 以上。更新中は `RefreshCw` を回転、現在地取得中は `locating` でスピナー。
- 2行目: 気温を特大（`font-size: clamp(72px, 22vw, 112px)`、`font-weight: 300`、`letter-spacing: -0.04em`、等幅数字）。右側に `<WeatherIcon code isNight={sky.isNight} size={88} />`。
- 3行目: `codeToLabel(weatherCode)`、その下に「最高 23° / 最低 18°」（最高は白、最低は白70%）、右端に「最終更新 23:15」（白70%、0.75rem）。
- 文字はすべて白（sky.ts が 4.5:1 を保証）。
- `SkyParticles` を背景に重ねる。`paused` は「ヒーローが画面外」または `document.visibilityState === 'hidden'`。
- 画面内判定は `IntersectionObserver`（しきい値 0）で行い、変化時に `useSkyStore.getState().setHeroVisible(visible)` を呼ぶ。アンマウント時は `setHeroVisible(true)` に戻す。`IntersectionObserver` が無い環境（jsdom）では常に可視扱い。
- **初回演出**: モジュールスコープの `let introPlayed = false`。初回マウントかつ `temperature` が初めて非 null になった時だけ、気温を `animate(0, temperature, { duration: 0.9, ease: [0.16, 1, 0.3, 1] })`（`motion/react` の `animate`）でカウントアップし、ヒーロー内要素を `m.div` で下から 12px フェードアップ（`springs.enter`、子要素ごとに 0.06 秒ずらし）。以後のマウント（タブ往復）では演出なしで即表示。`prefers-reduced-motion` ではカウントアップせず即表示（`useReducedMotion()`）。
- 気温表示は `Math.round`。

**テスト（最低限）:**
- `temperature=21.6` のとき「22°」が表示される（introPlayed を回避するため、テストではモジュールを `vi.resetModules()` せず、2回目以降のレンダーで確認するか、`MotionGlobalConfig.skipAnimations=true` 下で最終値が表示されることを `await findByText('22°')` で確認）。
- `temperature=null` のとき「—°」。
- 「現在地を表示」「更新」ボタンのクリックで `onLocate` / `onRefresh` が呼ばれる。
- `locationSlot` に渡した要素が描画される。

- [ ] Step 1: テスト → Step 2: 実装 → Step 3: 通過 → Step 4: Commit `feat: 今の空を描く空もようヒーローSkyHeroを追加`

---

### Task 5: WeatherTab への組み込み（担当: Sonnet）

**Files:** Modify `src/components/weather/WeatherTab.tsx`

- 既存の上部操作パネル（`className="glass-panel"` の「現在地を表示」ボタン・地点 `<select>`・最終更新・更新ボタンを含む div、現行の約161〜228行）を `SkyHero` に置き換える。**ハンドラ・state は既存のものをそのまま渡す**（`handleGetCurrentLocation`, `buttonGeoLoading`, `refresh`, `loading`, `timeStr`, `setSelectedLocationId`）。
- `locationSlot`:
  - ログイン時（`user` あり）: 地点名テキスト＋▼を表示し、その上に**同じ大きさの透明な `<select>`**（`opacity:0; position:absolute; inset:0`）を重ねる。選択肢・`value`・`onChange` は現行と同一。`aria-label="地点"`。
  - ゲスト時: 地点名テキストのみ（`location?.name ?? '現在地'`）。
- `buttonGeoError` はヒーローの `children` として白文字で表示（`role="alert"`）。
- 今の空の算出（`useMemo`、依存は `data`）:
  - `now = new Date()`、`idx = currentHourIndex(data.hourly, now)`、`hour = data.hourly[idx]`（-1 なら `data.hourly[0]`）
  - `today = data.daily.find(d => d.date === jstDateString(now))`
  - `tod = timeOfDay(jstMinutesOfDay(now), hhmmToMinutes(today.sunrise), hhmmToMinutes(today.sunset))`（`today` が無い／sunrise が空文字なら `fallbackSky(now)` を使う）
  - `weather = classifyWeather(hour.weatherCode)`、`sky = { tod, weather, ...skyPalette(tod, weather) }`
  - データ未取得時は `fallbackSky()`。
- `useEffect` で `useSkyStore.getState().publish(sky, summary)`（`summary = { temperature: hour.temperature, weatherCode: hour.weatherCode, locationName }`、未取得時は `summary=null`）。
- 地点未登録・geo 取得失敗時の早期 return（現行 118〜141行の空状態）はそのまま残す。ただし背景に `fallbackSky()` の空を使った SkyHero を出す必要は**ない**（YAGNI）。
- ヒーロー直後のコンテンツ（注意報・日別予報…）の親に `position: relative; margin-top: -24px` を与え、最初のカードがヒーローに少し重なるようにする（`.app-container` の上パディングと合わせて調整）。
- **既存の `scrollToHour`／`hourlySectionRef` 等のスクロール計算がヒーロー追加で狂わないこと**を確認（`getBoundingClientRect` ベースなら影響なし）。

**検証:** `npm run test`、`npx tsc -b`、撮影 `npm run screenshots -- phase2-hero` でモバイル空もようの上部にヒーローが出ていること。

- [ ] Step 1: 実装 → Step 2: 検証 → Step 3: Commit `feat: 空もようの上部操作パネルを空のヒーローへ置換`

---

### Task 6: ヘッダーとボトムナビの切り出し・刷新（担当: Sonnet）

**Files:**
- Create: `src/components/shell/AppHeader.tsx`, `src/components/shell/BottomNav.tsx`, `src/components/shell/shell.css`
- Test: `src/components/shell/AppHeader.test.tsx`, `src/components/shell/BottomNav.test.tsx`
- Modify: `src/App.tsx`（現行ヘッダー 約1620〜1840行、ボトムナビ 約2712〜2768行を置換）

**共通定義**（`src/components/shell/tabs.ts` に置く）:

```ts
import { BarChart2, Clock, Sun } from 'lucide-react';
export type MainTab = 'weather' | 'analysis' | 'history';
export const MAIN_TABS = [
  { id: 'weather',  label: '空もよう', Icon: Sun },
  { id: 'analysis', label: '空くらべ', Icon: BarChart2 },
  { id: 'history',  label: '空しらべ', Icon: Clock },
] as const;
export const tabIndex = (t: MainTab) => MAIN_TABS.findIndex(x => x.id === t);
```

**AppHeader** props:

```ts
interface AppHeaderProps {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
  isMobile: boolean;
  user: { photoURL: string | null; displayName: string | null } | null;
  onLogin: () => void;          // 現行: setGuestMode(false)
  onLogout: () => void;         // 現行: signOut(auth)
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}
```

- 背景は `useSkyStore` の `sky?.top ?? fallbackSky().top` の**単色**、`position: sticky; top: 0; z-index: 50; height: 56px`。文字・アイコンは白。背景色の変化は `transition: background-color 0.6s ease`。
- 左: `/icon.png`（24px、装飾）。
- **縮小時の気温要約**: `tab === 'weather'` かつ `heroVisible === false` かつ `summary` ありのとき、ロゴの右に「{地点名} {Math.round(temperature)}° {codeToLabel}」を白で表示。`AnimatePresence` + `m.div` で下から 8px フェードイン（`springs.move`）。ヒーロー内の気温が消えるのと入れ替わりに現れ、「空がヘッダーに縮んだ」印象を作る。
- PC（`!isMobile`）: 中央寄りに `MAIN_TABS` のナビ。選択中の背後に白の丸いハイライト（`m.span layoutId="header-tab"`, `springs.move`）、選択中の文字は `var(--ink-1)`、非選択は白。各ボタンは `role="tab"`/`aria-selected`、ナビは `role="tablist" aria-label="画面"`。押下は `whileTap={{ scale: pressScale }}`。※ 第1段階の `SegmentedControl` は地の色が異なるため流用せず、同じ作法で空用に実装する。
- 右側（PC・モバイル共通の並び）: ヘルプ（`HelpCircle`, `aria-label="使い方"`）、未ログインなら「ログイン」ボタン／ログイン時はアバター画像（PCのみ「ログアウト」ボタンも）、設定（`Settings`, `aria-label="設定"`）。アイコンボタンは 40×40、白 15% の円背景、hover で白 25%。
- ログアウトは現行どおり PC ヘッダーのみ（モバイルは設定シート内のアカウント欄にある）。

**BottomNav** props: `{ tab: MainTab; onTabChange: (t: MainTab) => void }`
- 現行と同じ固定配置（`height: calc(64px + env(safe-area-inset-bottom))`）、背景 `var(--surface-card)`、上境界 `1px var(--line)`。
- 3ボタン縦並び（アイコン22px＋ラベル0.68rem）。選択中は背後に `var(--accent-soft)` の丸いハイライト（`m.span layoutId="bottom-tab"`, `springs.move`）、アイコン・文字 `var(--accent)`・600。非選択は `var(--ink-3)`。
- 押下で `whileTap={{ scale: 0.9 }}`、離すと `springs.press` で戻る。
- `role="tablist" aria-label="画面"`、各ボタン `role="tab" aria-selected`。

**テスト（各コンポーネント）:** 選択中タブの `aria-selected="true"`、他タブのクリックで `onTabChange` が呼ばれる、ヘッダーの「設定」「使い方」ボタンで `onOpenSettings`/`onOpenHelp`、未ログインで「ログイン」ボタン→`onLogin`、`heroVisible=false` かつ `tab='weather'` かつ summary ありで気温要約が表示され、`tab='analysis'` では表示されない。

**App.tsx の置換:** 既存ヘッダー div とボトムナビ nav を `<AppHeader … />` と `{isMobile && <BottomNav … />}` に置き換える。App.tsx から不要になった import（`Sun`, `BarChart2`, `Clock`, `HelpCircle`, `Settings`, `LogOut` 等）は、他で使っていなければ削除する。この Task では `topTab` の型はまだ変えない（`onOpenHelp`/`onOpenSettings` は暫定で現行の `setTopTab('help')`/`setTopTab('settings')` を呼ぶ）。

- [ ] Step 1: tabs.ts とテスト → Step 2: 実装 → Step 3: App.tsx 置換 → Step 4: `npm run test`・`npx tsc -b`・撮影 `phase2-shell` → Step 5: Commit `feat: 空色ヘッダーと滑るハイライトのボトムナビへ刷新`

---

### Task 7: タブ遷移アニメーションと空帯 `SkyBand`（担当: Sonnet）

**Files:**
- Create: `src/components/sky/SkyBand.tsx`（スタイルは `sky.css`）
- Test: `src/components/sky/SkyBand.test.tsx`
- Modify: `src/App.tsx`

**SkyBand** props: `{ title: string }`。`useSkyStore` の `sky ?? fallbackSky()` を使い、`linear-gradient(180deg, top, bottom)` の帯（padding `12px 20px 36px`）に白い画面タイトル（1.25rem, 600）を表示。後続コンテンツは Task 5 と同じく `margin-top: -24px` で重ねる。`<h1>` で出す。テスト: タイトルが heading として出る、背景に sky の色が使われる（`style.background` に含まれる）。

**App.tsx:**
- 空くらべ・空しらべの本文の直前に `<SkyBand title="空くらべ" />` / `<SkyBand title="空しらべ" />`。
- メイン領域（`topTab` に応じて WeatherTab / HistoricalWeatherTab / 空くらべ を出す部分）を `m.div key={topTab}` で包み、`initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} transition={springs.move}`。`dir` は「前回タブの `tabIndex` より大きければ 1、小さければ -1」（`useRef` で前回値を保持）。**exit アニメーションは付けない**（重い画面を二重描画しないため）。初回表示は `initial={false}` 相当（`dir` 0 なら x 0 で opacity のみ）。
- 空くらべ画面内で `window.innerWidth` 依存の初期化や ResizeObserver 計測がある場合、x 方向 24px の移動で計測が狂わないことを実画面で確認。

- [ ] Step 1: SkyBand テスト→実装 → Step 2: App.tsx → Step 3: 検証（test・tsc・撮影 `phase2-tabs`）→ Step 4: Commit `feat: 空くらべ・空しらべに空帯を追加し、タブ切替を方向つきスライドに`

---

### Task 8: 設定・ヘルプのシート化（担当: Sonnet）

**Files:**
- Modify: `src/App.tsx`, `src/components/HelpPage.tsx`, `src/components/settings/SettingsTab.tsx`, `src/components/settings/LocationMapModal.tsx`, `src/components/settings/LocationSettings.tsx`, `src/index.css`, `scripts/screenshots.mjs`
- Delete: `src/settingsTheme.test.ts`

**App.tsx:**
- `topTab` の型を `MainTab`（`'weather' | 'analysis' | 'history'`）に縮める。`prevTopTab` とその参照をすべて削除。
- `const [sheet, setSheet] = useState<'settings' | 'help' | null>(null)`。`AppHeader` の `onOpenSettings={() => setSheet('settings')}`、`onOpenHelp={() => setSheet('help')}`。
- `<Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="設定" placement={isMobile ? 'bottom' : 'side'}>` の中身は、ゲスト時は現行の「ログインが必要です」カード（`settings-theme` クラスは外す）、ログイン時は `<SettingsTab />`。
- `<Sheet open={sheet === 'help'} … title="使い方">` の中身は `<HelpPage />`（`onBack` なし）。
- 設定画面用の全画面アイボリー背景レイヤー（`topTab === 'settings' && <div … var(--settings-bg-gradient) …/>`）を削除。
- **背景の沈み込み（モバイルのみ）**: ヘッダー＋メイン領域を `m.div` で包み、`animate={{ scale: sheet && isMobile ? 0.94 : 1, borderRadius: sheet && isMobile ? 16 : 0 }}`、`style={{ transformOrigin: '50% 0%', overflow: 'hidden' }}`、`transition={springs.move}`。ボトムナビはこの外に置く（fixed を transform 配下に入れない）。scale 1 のとき transform が残らないこと（Motion は既定値で `none` を出す）を DevTools で確認。
- 既存の「ゲスト→ログイン」導線（`setGuestMode(false)`）はシート内のボタンからも従来どおり動くこと。

**HelpPage.tsx:** `onBack` を任意 prop にし、未指定なら戻るボタンを描画しない。

**SettingsTab.tsx:** ルートの `className="app-container settings-theme"` → `"app-container"`。

**index.css:**
- `:root` の `--settings-bg-gradient` 〜 `--settings-shadow-lg`（8行）と、その直前のコメント行を削除。
- `.settings-theme { … }` ブロックとその直前コメントを削除。
- 追加: シート内では外側の余白を詰める
  ```css
  .ui-sheet__body .app-container { padding: 0; max-width: none; }
  ```
- `--settings-*` / `settings-theme` を参照している箇所が他に残っていないことを `grep -rn "settings-theme\|--settings-" src` で確認（0件にする。`App.tsx` の旧設定ボタン配色は Task 6 で消えている）。

**ポータル化:** `LocationMapModal.tsx` の最外 return と、`LocationSettings.tsx` の削除確認ダイアログ（`confirmDeleteId &&` の div）を `createPortal(<…/>, document.body)` で描画する（`import { createPortal } from 'react-dom'`）。z-index は現行値（1100 / 1000）のままでシート（901）より上に出る。

**settingsTheme.test.ts:** 削除（色による区別をやめたため）。

**撮影スクリプト:** 各ビューポートで3タブ撮影の後に、①空もようで `window.scrollTo(0, 600)` 後の画面（`-4-scrolled`）、②「設定」ボタン（`getByRole('button', { name: '設定' })`）を押して 800ms 後（`-5-settings`）、③Esc で閉じ「使い方」を押して 800ms 後（`-6-help`）を追加で撮る。全画面撮影（fullPage）はシートでは不要なので②③は `fullPage: false`。

**検証:** `npm run test`（settingsTheme の2件が減る）、`npx tsc -b`、`npm run build`、撮影 `phase2-sheets`。設定シート内で地図モーダルと削除確認がシートの外（画面全体）に出ることを dev サーバーで確認（ゲストでは地点設定が出ないため、確認はユーザー実機に委ねる旨を報告に書く）。

- [ ] Step 1: HelpPage/SettingsTab/ポータル → Step 2: App.tsx のシート化と沈み込み → Step 3: CSS・テスト削除 → Step 4: 撮影スクリプト → Step 5: 検証 → Step 6: Commit `feat: 設定とヘルプを下から出るシートに変更し、設定専用の配色を撤去`

---

### Task 9: 総合検証と develop への取り込み（担当: コントローラー）

- [ ] `npm run test`・`npx tsc -b`・`npm run build`（gzip サイズを第1段階の 465.29KB と比較し、増加量を記録）
- [ ] `npm run screenshots -- phase2-final` を before / phase1-final と比較（モバイル・PC、スクロール後、設定・ヘルプシート）
- [ ] 機能不変チェック（dev、ゲスト）: 3タブ切替／現在地ボタン／更新／日タップ→時間別スクロール／モード切替／空くらべのスワイプ・ピンチ・Ctrl+ホイール／設定・ヘルプの開閉（×・Esc・背景タップ・下スワイプ）／ログインボタン
- [ ] 第2段階全差分を Sonnet レビュー（仕様適合＋品質）→ 指摘対応
- [ ] develop へ `--no-ff` マージ → test/build → push。main は指示待ち
- [ ] ユーザー実機確認依頼（特に: 下スワイプで閉じる、地図モーダル・削除確認がシートの上に出る、粒子の滑らかさと発熱）
