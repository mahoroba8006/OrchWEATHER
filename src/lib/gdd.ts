// 有効積算温度の日別計算。上限温度（任意）を超えた分は数えない。
// 上限超過分は UC IPM の single sine＋水平カットオフで見積もる（最高・最低気温から一日の気温の波を仮定）

export const UPPER_TEMP_MIN = 20;
export const UPPER_TEMP_MAX = 50;

/** 一日の気温の波のうち、上限より上の分を日平均から差し引くための値（℃）。上限なし・値が不正なら 0 */
export function excessAboveUpper(max: number, min: number, upper: number | null): number {
  if (upper === null || !Number.isFinite(max) || !Number.isFinite(min)) return 0;
  if (max <= upper) return 0;
  if (min >= upper) return (max + min) / 2 - upper;
  const m = (max + min) / 2;
  const a = (max - min) / 2;
  const theta = Math.asin((upper - m) / a);
  return ((m - upper) * (Math.PI / 2 - theta) + a * Math.cos(theta)) / Math.PI;
}

/** 一日の有効積算温度。upper が null なら max(0, 日平均 − 基準) と同じ */
export function dailyGdd(
  day: { tempMean: number; tempMax: number; tempMin: number },
  base: number,
  upper: number | null,
): number {
  return Math.max(0, day.tempMean - base - excessAboveUpper(day.tempMax, day.tempMin, upper));
}

/** Firestore の値を上限温度として読む。数値でない・範囲外は null（上限なし） */
export function parseUpperTemp(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= UPPER_TEMP_MIN && v <= UPPER_TEMP_MAX ? v : null;
}

export function parseUpperTemps(v: unknown): [number | null, number | null] {
  const arr = Array.isArray(v) ? v : [];
  return [parseUpperTemp(arr[0]), parseUpperTemp(arr[1])];
}

/** 表示用ラベル: `10℃` / `10℃・上限33℃` */
export function gddLabel(base: number, upper: number | null): string {
  return upper === null ? `${base}℃` : `${base}℃・上限${upper}℃`;
}
