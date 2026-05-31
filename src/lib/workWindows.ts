// src/lib/workWindows.ts
//
// 時間別予報から「作業好適時間帯（calm window）」を決定論的に抽出する。
// AI には抽出済みの候補を渡して言い回しのみさせる（幻覚防止・法的安全）。
//
// 好適条件（1時間ごと）:
//   - 風速 <= WIND_MAX（散布・ドローン等の風リスク回避）
//   - 降水確率 <= PRECIP_PROB_MAX かつ 降水量 == 0
//   - 日中（DAY_START〜DAY_END 時）
// これらを満たす連続時間帯を MIN_HOURS 以上のものだけ採用する。

import type { HourlyForecast } from '../api/forecast';

export interface CalmWindow {
  startISO: string;      // 例: "2026-05-31T06:00"
  endISO: string;        // 例: "2026-05-31T09:00"（最後の好適時刻 + 1h）
  maxWind: number;       // m/s（区間内最大）
  maxPrecipProb: number; // %（区間内最大）
  minTemp: number;       // ℃
  maxTemp: number;       // ℃
}

const WIND_MAX = 3;          // m/s
const PRECIP_PROB_MAX = 20;  // %
const MIN_HOURS = 3;         // 連続好適時間の最小数
const DAY_START = 5;         // 5時
const DAY_END = 18;          // 18時（この時刻は含まない）
const MAX_WINDOWS = 4;       // 返す最大件数

function hourOf(timeISO: string): number {
  // "2026-05-31T06:00" → 6
  const m = timeISO.match(/T(\d{2}):/);
  return m ? parseInt(m[1], 10) : -1;
}

function isCalmHour(h: HourlyForecast): boolean {
  const hr = hourOf(h.time);
  return (
    hr >= DAY_START &&
    hr < DAY_END &&
    h.windSpeed <= WIND_MAX &&
    h.precipProb <= PRECIP_PROB_MAX &&
    h.precipitation === 0
  );
}

/** 1時間先の ISO 文字列を返す（JST 前提・"YYYY-MM-DDTHH:00" 形式） */
function plusOneHourISO(timeISO: string): string {
  const t = Date.parse(`${timeISO}:00+09:00`);
  const d = new Date(t + 60 * 60 * 1000);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const da = String(jst.getUTCDate()).padStart(2, '0');
  const ho = String(jst.getUTCHours()).padStart(2, '0');
  return `${y}-${mo}-${da}T${ho}:00`;
}

export function findCalmWindows(hourly: HourlyForecast[]): CalmWindow[] {
  const windows: CalmWindow[] = [];
  let run: HourlyForecast[] = [];

  const flush = () => {
    if (run.length >= MIN_HOURS) {
      const winds = run.map(h => h.windSpeed);
      const probs = run.map(h => h.precipProb);
      const temps = run.map(h => h.temperature);
      windows.push({
        startISO: run[0].time,
        endISO: plusOneHourISO(run[run.length - 1].time),
        maxWind: Math.max(...winds),
        maxPrecipProb: Math.max(...probs),
        minTemp: Math.round(Math.min(...temps)),
        maxTemp: Math.round(Math.max(...temps)),
      });
    }
    run = [];
  };

  for (const h of hourly) {
    if (isCalmHour(h)) {
      run.push(h);
    } else {
      flush();
    }
  }
  flush();

  return windows.slice(0, MAX_WINDOWS);
}
