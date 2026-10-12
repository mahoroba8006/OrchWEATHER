import type { CSSProperties } from 'react';
import { sekkiForDate } from './sekki';

// ── 時間別の表の後ろの景色（和風の淡い山並み）。色は節気に合わせて移ろう（季節の色）か、墨の灰色。色の帯を雲に見立てる ──
// 各層は横に継ぎ目なく繰り返す SVG。層ごとに幅を変えて繰り返しの周期をずらす。
// 横スクロールに対して遠い層ほどゆっくり動かす（--sx = scrollLeft。background は枠に固定されるので、
// 位置を -sx × 速さ だけずらすと、その速さで流れて見える）。

/** 稜線の波。cycles は1枚の幅に入る山の数（整数なので横に継ぎ目なく繰り返す） */
type Wave = { cycles: number; amp: number; phase: number };
type Layer = {
  w: number;
  h: number;
  /** 稜線の麓の高さ（上からの y） */
  base: number;
  waves: Wave[];
  /** 稜線の際の濃さと、麓（下端）の濃さ（0〜1）。麓を淡くして、層の間に霧が立つように見せる */
  tone: number;
  foot: number;
  /** 横スクロールに対する速さ（1 = 表と同じ） */
  speed: number;
};

type Ink = readonly [number, number, number];
/** 白地に濃さ a で ink を重ねたのと同じ、不透明な色（手前の層が奥の稜線を隠すように） */
const inkOnWhite = (ink: Ink, a: number) => `rgb(${ink.map(v => Math.round(255 + (v - 255) * a)).join(', ')})`;

/** なだらかな稜線を 4px ごとに折れ線で描く（波を重ねて形に不規則さを出す） */
const ridgePath = ({ w, base, waves }: Layer) => {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 4) {
    const lift = waves.reduce((sum, { cycles, amp, phase }) => sum + amp * (0.5 + 0.5 * Math.sin(2 * Math.PI * (cycles * x / w + phase))), 0);
    pts.push(`${x} ${(base - lift).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
};

/** 線を引かず、塗りだけの層（稜線の際がいちばん濃く、麓へ淡くなる）。不透明なので奥の層は透けない */
const svgUri = (layer: Layer, ink: Ink) => {
  const { w, h, tone, foot } = layer;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${inkOnWhite(ink, tone)}"/><stop offset="1" stop-color="${inkOnWhite(ink, foot)}"/>`
    + `</linearGradient></defs>`
    + `<path d="${ridgePath(layer)} L${w} ${h} L0 ${h}Z" fill="url(#m)"/>`
    + `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/** 重なり合うなだらかな山並み（奥から手前へ4層）。奥ほど高く淡く、手前ほど低く濃い */
const MOUNTAINS: Layer[] = [
  {
    w: 1180, h: 300, base: 300, tone: 0.07, foot: 0.015, speed: 1 / 20,
    waves: [{ cycles: 2, amp: 80, phase: 0.1 }, { cycles: 5, amp: 28, phase: 0.6 }, { cycles: 11, amp: 6, phase: 0.3 }],
  },
  {
    w: 1040, h: 225, base: 225, tone: 0.09, foot: 0.02, speed: 1 / 12,
    waves: [{ cycles: 3, amp: 60, phase: 0.45 }, { cycles: 7, amp: 16, phase: 0.2 }, { cycles: 13, amp: 4, phase: 0.8 }],
  },
  {
    w: 1300, h: 150, base: 150, tone: 0.11, foot: 0.03, speed: 1 / 8,
    waves: [{ cycles: 2, amp: 40, phase: 0.75 }, { cycles: 5, amp: 18, phase: 0.05 }, { cycles: 9, amp: 5, phase: 0.5 }],
  },
  {
    w: 1420, h: 80, base: 80, tone: 0.13, foot: 0.06, speed: 1 / 5,
    waves: [{ cycles: 3, amp: 30, phase: 0.3 }, { cycles: 7, amp: 9, phase: 0.65 }],
  },
];

/** 麓より下（色のない行の後ろ）は、いちばん手前の層の麓の色から始めて谷の霧のように消していく */
const GROUND_FADE = 160;
const groundUri = (near: Layer, ink: Ink) =>
  `linear-gradient(rgba(${ink.join(', ')}, ${near.foot}), rgba(${ink.join(', ')}, 0))`;
/**
 * 山の麓は --foot（枠の上端からの px。色のある行のうち一番下の行の下端）に置く。
 * 行の表示・非表示や凡例の開閉で表の高さが変わっても、山頂が色の帯の高さに来る
 */
const layered = (scene: Layer[], ink: Ink): CSSProperties => {
  const layers = [...scene].reverse(); // 手前の層を先に書く（CSS は先頭が上）
  return {
    backgroundImage: [...layers.map(l => svgUri(l, ink)), groundUri(layers[0], ink)].join(', '),
    backgroundRepeat: [...layers.map(() => 'repeat-x'), 'no-repeat'].join(', '),
    backgroundSize: [...layers.map(l => `${l.w}px ${l.h}px`), `100% ${GROUND_FADE}px`].join(', '),
    backgroundPosition: [
      ...layers.map(l => `calc(var(--sx, 0) * ${-l.speed}px) calc(var(--foot, 0) * 1px - ${l.h}px)`),
      '0 calc(var(--foot, 0) * 1px)',
    ].join(', '),
    backgroundColor: 'var(--surface-card)',
  };
};

/** 景色の選択肢（設定の並び順） */
export const SCENERY_OPTIONS = [
  { value: 'seasonal', label: '季節の色' },
  { value: 'ink', label: '墨' },
  { value: 'none', label: 'なし' },
] as const;
export type HourlyScenery = (typeof SCENERY_OPTIONS)[number]['value'];
export const DEFAULT_HOURLY_SCENERY: HourlyScenery = 'seasonal';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** 立春〜穀雨=春、立夏〜大暑=夏、立秋〜霜降=秋、立冬〜大寒=冬 */
export const seasonOf = (now: Date): Season => (['spring', 'summer', 'autumn', 'winter'] as const)[Math.floor(sekkiForDate(now).index / 6)];

/**
 * 山の色（濃さ 1 のときの色。実際は白に 7〜13% 重ねるだけなので、ごく淡い「〇〇鼠」になる）。
 * 帯は半透明で後ろの色を拾うので、色味は弱く: 夏の青緑は風速の緑、秋の暖色は日射の橙に寄せすぎない
 */
const INKS: Record<Season | 'ink', Ink> = {
  spring: [150, 92, 112],  // 桜鼠: 春霞
  summer: [64, 122, 118],  // 青磁鼠: 青い山
  autumn: [138, 104, 72],  // 枯色・利休鼠: 色づいた山
  winter: [86, 108, 140],  // 銀鼠: 雪をいただく山
  ink: [98, 102, 106],     // 墨
};
const BACKGROUNDS = Object.fromEntries(
  Object.entries(INKS).map(([k, ink]) => [k, layered(MOUNTAINS, ink)]),
) as Record<Season | 'ink', CSSProperties>;
const NONE: CSSProperties = { backgroundColor: 'var(--surface-card)' };

/** 枠（横スクロールする要素）に付ける背景。後ろに白地を敷く。季節の色は now の節気で決める */
export function sceneryBackground(kind: HourlyScenery, now: Date): CSSProperties {
  if (kind === 'none') return NONE;
  return BACKGROUNDS[kind === 'ink' ? 'ink' : seasonOf(now)];
}

/** 保存値の読み取り。知らない値は既定（季節の色） */
export function parseHourlyScenery(raw: unknown): HourlyScenery {
  return SCENERY_OPTIONS.some(o => o.value === raw) ? raw as HourlyScenery : DEFAULT_HOURLY_SCENERY;
}

export const GUEST_HOURLY_SCENERY_KEY = 'hourlyScenery';

export function loadGuestHourlyScenery(): HourlyScenery {
  try {
    return parseHourlyScenery(localStorage.getItem(GUEST_HOURLY_SCENERY_KEY));
  } catch {
    return DEFAULT_HOURLY_SCENERY;
  }
}

export function saveGuestHourlyScenery(kind: HourlyScenery): void {
  try {
    localStorage.setItem(GUEST_HOURLY_SCENERY_KEY, kind);
  } catch { /* localStorage 不可環境は無視 */ }
}
