import type { HourlyForecast } from '../api/forecast';

// ── セルの濃淡（ヒートマップ）。物差しは固定で、日や季節が違っても同じ色は同じ量 ──
export type RGB = readonly [number, number, number];
// 背景は淡い色（文字は --ink-1 のまま読める）、量の行は下端の細い線に鮮やかな色を寄せる
const HEAT_WHITE: RGB = [255, 255, 255];
const HEAT_GRAY: RGB = [236, 239, 241];
const HEAT_YELLOW: RGB = [255, 213, 79];
const HEAT_AMBER: RGB = [255, 188, 102];     // 日射: 日照の黄と並べて見分けられる橙寄り
const HEAT_PROB: RGB = [205, 218, 234];      // 降水確率: 降水量と取り違えないよう青灰色で淡く
const HEAT_RAIN: RGB = [151, 190, 235];      // 降水の色（--chart-precip #2E7DD7）を白に半分混ぜた水色
const HEAT_RAIN_DEEP: RGB = [90, 150, 222];  // 降水量の上限の色（--ink-1 の文字とのコントラスト約5.7:1）
const mixRgb = (from: RGB, to: RGB, t: number): RGB => {
  const k = Math.max(0, Math.min(1, t));
  return from.map((f, j) => Math.round(f + (to[j] - f) * k)) as unknown as RGB;
};
export const rgbCss = (c: RGB) => `rgb(${c.join(', ')})`;
/** 位置 0〜1 に色を置いた物差し。間は直線で混ぜる */
export type Ramp = readonly (readonly [number, RGB])[];
const rampColor = (ramp: Ramp, t: number): RGB => {
  const k = Math.max(0, Math.min(1, t));
  for (let j = 1; j < ramp.length; j++) {
    const [p0, c0] = ramp[j - 1];
    const [p1, c1] = ramp[j];
    if (k <= p1) return mixRgb(c0, c1, (k - p0) / (p1 - p0));
  }
  return ramp[ramp.length - 1][1];
};
/** 降水量: 平方根で小雨も見えるように。50mm で頭打ち、0〜10mm は上限10mmの頃と同じ色 */
const PRECIP_MAX = 50;
const PRECIP_MID = Math.sqrt(10 / PRECIP_MAX);

/**
 * t: 値 → 物差し上の位置 0〜1（undefined は塗らない）。bg: 背景の物差し。accent: 下端の線の物差し（量の行だけ）。
 * legend: 凡例に並べる値（物差しの上限を最後に置く）
 */
export type Heat = {
  value: (h: HourlyForecast) => number;
  t: (v: number) => number | undefined;
  bg: Ramp;
  accent?: Ramp;
  nightDash?: boolean;
  legend: number[];
  /** 上限を超える値がありうる（凡例の最後に「以上」） */
  legendOver?: boolean;
};
export const heatColor = (heat: Heat, v: number, ramp: Ramp): RGB | undefined => {
  const t = heat.t(v);
  return t === undefined ? undefined : rampColor(ramp, t);
};

export const PROB_HEAT: Omit<Heat, 'value'> = {
  t: v => (v > 0 ? v / 100 : undefined),
  bg: [[0, HEAT_WHITE], [1, HEAT_PROB]],
  legend: [0, 20, 40, 60, 80, 100],
};
export const PRECIP_HEAT: Omit<Heat, 'value'> = {
  t: v => (v > 0 ? Math.sqrt(Math.min(v, PRECIP_MAX) / PRECIP_MAX) : undefined),
  bg: [[0, HEAT_WHITE], [PRECIP_MID, HEAT_RAIN], [1, HEAT_RAIN_DEEP]],
  accent: [[0, HEAT_WHITE], [PRECIP_MID, [46, 125, 215]], [1, [22, 78, 168]]],
  legend: [0, 0.5, 1, 5, 10, 20, 50],
  legendOver: true,
};
export const SUN_HEAT: Omit<Heat, 'value'> = {
  t: v => v / 60,
  bg: [[0, HEAT_GRAY], [1, HEAT_YELLOW]],
  accent: [[0, HEAT_GRAY], [1, [234, 168, 0]]],
  nightDash: true,
  legend: [0, 15, 30, 45, 60],
};
export const RADIATION_HEAT: Omit<Heat, 'value'> = {
  t: v => v / 3.2,
  bg: [[0, HEAT_GRAY], [1, HEAT_AMBER]],
  accent: [[0, HEAT_GRAY], [1, [222, 118, 20]]],
  nightDash: true,
  legend: [0, 0.8, 1.6, 2.4, 3.2],
  legendOver: true,
};

/**
 * 隣の時刻との境目をぼかす。各列の中央（30〜70%）は値どおりの色のまま数字の下に残し、
 * 左右の端は隣の列との中間色にする（両側から同じ色になるので継ぎ目が出ない）。
 * null は塗らない列（雨0・夜の「–」）＝白として扱う。'bridge' は日の出・日の入りの列で、両隣の色をつなぐ。
 * 返り値: 列ごとの { color: 中央の色, image: 境目のグラデーション }。両隣も含めて塗らない列は undefined。
 */
export function heatRibbon(cells: (RGB | null | 'bridge')[]): ({ color?: string; image?: string } | undefined)[] {
  const solid = (k: number): RGB | null => {
    const c = cells[k];
    return c === 'bridge' ? null : c ?? null;
  };
  // 'bridge' の列は、日の出入りの列を飛ばした両隣の中間色
  const nearest = (from: number, step: number): RGB | null => {
    for (let k = from; k >= 0 && k < cells.length; k += step) if (cells[k] !== 'bridge') return solid(k);
    return null;
  };
  const resolved: (RGB | null)[] = cells.map((c, i) => {
    if (c !== 'bridge') return c;
    const l = nearest(i - 1, -1);
    const r = nearest(i + 1, 1);
    if (!l && !r) return null;
    return mixRgb(l ?? HEAT_WHITE, r ?? HEAT_WHITE, 0.5);
  });
  return resolved.map((c, i) => {
    const l = i > 0 ? resolved[i - 1] : c;
    const r = i < resolved.length - 1 ? resolved[i + 1] : c;
    if (!c && !l && !r) return undefined;
    const self = c ?? HEAT_WHITE;
    const left = rgbCss(mixRgb(self, l ?? HEAT_WHITE, 0.5));
    const right = rgbCss(mixRgb(self, r ?? HEAT_WHITE, 0.5));
    const mid = rgbCss(self);
    return {
      color: c ? mid : undefined,
      image: `linear-gradient(to right, ${left} 0%, ${mid} 30%, ${mid} 70%, ${right} 100%)`,
    };
  });
}
