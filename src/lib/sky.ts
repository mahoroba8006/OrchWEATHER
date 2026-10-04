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

/**
 * 時間別の表で、今の時刻が何列目にあたるか（列の左端を0とした小数）。各列の中央をその列の時刻とみなし、
 * 前後の列の間を時刻で按分する。日の出・日の入りの列も時刻を持つので、その列をまたいでもずれない。範囲外は null
 */
export function nowColumnPos(times: string[], now: Date): number | null {
  const t = now.getTime();
  for (let i = 0; i < times.length - 1; i++) {
    const a = new Date(times[i]).getTime();
    const b = new Date(times[i + 1]).getTime();
    if (a <= t && t < b) return i + 0.5 + (t - a) / (b - a);
  }
  return null;
}
