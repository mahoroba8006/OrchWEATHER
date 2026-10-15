// 累積計算の共通処理。「開始日（MM-DD）以降を足し上げる」。
// 開始日より前は daily / accum とも null（折線・バーを描かない）。

export interface AccumPoint {
  mmdd: string;
  daily: number | null;
  accum: number | null;
}

/**
 * days を順に見て、開始日以降の valueOf を累積する。
 * from は累積の初期値（予報を履歴の最終値から継ぎ足すときに使う）。
 * total は最終累積値（開始日以降の日が無ければ from のまま）。
 */
export function accumulate<T extends { date: string }>(
  days: T[],
  startMMDD: string,
  valueOf: (d: T) => number,
  from = 0,
): { points: AccumPoint[]; total: number } {
  let running = from;
  const points = days.map((d): AccumPoint => {
    const mmdd = d.date.substring(5);
    if (mmdd < startMMDD) return { mmdd, daily: null, accum: null };
    const daily = valueOf(d);
    running += daily;
    return { mmdd, daily, accum: running };
  });
  return { points, total: running };
}

/** 開始日以降の点だけを Δ日逆引き用の系列にする */
export function toAccumSeries(points: AccumPoint[]): Array<{ mmdd: string; accum: number }> {
  const series: Array<{ mmdd: string; accum: number }> = [];
  for (const p of points) if (p.accum !== null) series.push({ mmdd: p.mmdd, accum: p.accum });
  return series;
}
