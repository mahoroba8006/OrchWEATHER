import { describe, it, expect } from 'vitest';
import { accumulate, toAccumSeries } from './accum';

// 再現性のある乱数（mulberry32）
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Day { date: string; v: number }

function makeDays(rand: () => number, year: number, from: number, len: number): Day[] {
  const days: Day[] = [];
  const t0 = Date.UTC(year, 0, 1) + from * 86400000;
  for (let i = 0; i < len; i++) {
    const d = new Date(t0 + i * 86400000);
    if (d.getUTCFullYear() !== year) break;
    days.push({ date: d.toISOString().slice(0, 10), v: Math.round(rand() * 5000) / 100 + (rand() < 0.3 ? 0 : 0.1) });
  }
  return days;
}

// ── 旧式（置き換え前の実装を書き写したもの） ──
// baseChartData: 履歴ループ + 予報の継ぎ足し
function oldBase(daily: Day[], forecast: Day[] | null, start: string) {
  let running = 0;
  const hist: Array<number | null> = [];
  daily.forEach(day => {
    const mmdd = day.date.substring(5);
    if (mmdd >= start) { running += day.v; hist.push(running); } else hist.push(null);
  });
  const fc = new Map<string, number>();
  forecast?.forEach(f => {
    const mmdd = f.date.slice(5);
    if (mmdd >= start) { running += f.v; fc.set(mmdd, running); }
  });
  return { hist, fc };
}

// radiationData: series（開始日以降のみ）
function oldSeries(daily: Day[], forecast: Day[] | null, start: string) {
  const series: Array<{ mmdd: string; accum: number }> = [];
  let running = 0;
  daily.forEach(day => {
    const mmdd = day.date.substring(5);
    if (mmdd < start) return;
    running += day.v;
    series.push({ mmdd, accum: running });
  });
  forecast?.forEach(f => {
    const mmdd = f.date.slice(5);
    if (mmdd < start) return;
    running += f.v;
    series.push({ mmdd, accum: running });
  });
  return series;
}

// DailyRawTable: 累積マップ
function oldRaw(daily: Day[], start: string) {
  let run = 0;
  const out: Array<{ mmdd: string; accum: number | null; daily: number | null }> = [];
  daily.forEach(d => {
    const mmdd = d.date.substring(5);
    const inRange = mmdd >= start;
    if (inRange) run += d.v;
    out.push({ mmdd, accum: inRange ? run : null, daily: inRange ? d.v : null });
  });
  return out;
}

const STARTS = ['01-01', '03-15', '06-30', '12-31', '00-01', '02-29', '13-01'];

describe('accumulate が旧実装と厳密一致する', () => {
  const rand = rng(12345);
  for (let n = 0; n < 60; n++) {
    const year = 2020 + (n % 6);
    const start = STARTS[n % STARTS.length];
    const histLen = Math.floor(rand() * 366);
    const daily = makeDays(rand, year, 0, histLen);
    const withForecast = n % 3 !== 0;
    const forecast = withForecast ? makeDays(rand, year, histLen, Math.floor(rand() * 16)) : null;

    it(`ケース${n}: 開始日=${start} 履歴${daily.length}日 予報${forecast?.length ?? 'なし'}`, () => {
      const v = (d: Day) => d.v;
      // baseChartData 相当
      const o = oldBase(daily, forecast, start);
      const h = accumulate(daily, start, v);
      expect(h.points.map(p => p.accum)).toEqual(o.hist);
      const fc = new Map<string, number>();
      accumulate(forecast ?? [], start, v, h.total).points.forEach(p => { if (p.accum !== null) fc.set(p.mmdd, p.accum); });
      expect(fc).toEqual(o.fc);

      // radiationData / gddData の series 相当
      const f = accumulate(forecast ?? [], start, v, h.total);
      expect([...toAccumSeries(h.points), ...toAccumSeries(f.points)]).toEqual(oldSeries(daily, forecast, start));

      // DailyRawTable 相当（accum と daily の両方）
      expect(h.points).toEqual(oldRaw(daily, start));
    });
  }
});

describe('accumulate の境界', () => {
  it('空配列は total=from', () => {
    expect(accumulate([], '01-01', () => 1, 7)).toEqual({ points: [], total: 7 });
  });
  it('開始日が全日より後なら全て null・total は 0 のまま', () => {
    const days = [{ date: '2025-01-01' }, { date: '2025-01-02' }];
    const r = accumulate(days, '12-31', () => 1);
    expect(r.points.every(p => p.accum === null && p.daily === null)).toBe(true);
    expect(r.total).toBe(0);
  });
  it('開始日当日から含める', () => {
    const r = accumulate([{ date: '2025-03-14' }, { date: '2025-03-15' }, { date: '2025-03-16' }], '03-15', () => 2);
    expect(r.points.map(p => p.accum)).toEqual([null, 2, 4]);
  });
});
