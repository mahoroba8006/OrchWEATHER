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
  // 夜明け・夕焼けは丘の向こう（88vh）から昇り・沈む。最初の画面の文字の後ろに太陽が来ないように
  return { kind: 'sun', x: 8 + t * 84, y: 88 - height * 76, height };
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
