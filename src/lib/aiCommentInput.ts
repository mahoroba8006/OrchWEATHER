// src/lib/aiCommentInput.ts
//
// AI コメント用の入力ペイロードを組み立て、キャッシュキー用の安定ハッシュを計算する。
// 今後3日分の時間別データ（HourlyTable 表示項目すべて）+
// その後4日分の日別データを Gemini に渡す。

import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';

/** 飽差 (kPa) = 飽和水蒸気圧 × (1 - 相対湿度/100) */
function calcVPD(temp: number, humidity: number): number {
  const es = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
  return Math.round(es * (1 - humidity / 100) * 100) / 100;
}

/** 角度(°)を16方位文字列に変換 */
function windDirLabel(deg: number): string {
  const dirs = ['北','北北東','北東','東北東','東','東南東','南東','南南東',
                '南','南南西','南西','西南西','西','西北西','北西','北北西'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export interface AiHourlyEntry {
  t: string;        // 時刻 "MM/DD HH時"
  tmp: number;      // 気温 ℃
  dew: number;      // 露点温度 ℃
  hum: number;      // 湿度 %
  vpd: number;      // 飽差 kPa
  ws: number;       // 風速 m/s
  wd: string;       // 風向
  wg: number;       // 瞬間風速 m/s
  pr: number;       // 降水量 mm
  pp: number;       // 降水確率 %
  rad: number;      // 日射量 W/m²
  uv: number;       // UV指数
  snow: number;     // 降雪量 cm
}

export interface AiDailyEntry {
  date: string;         // "MM/DD"
  tmpMax: number;       // 最高気温 ℃
  tmpMin: number;       // 最低気温 ℃
  ppMax: number;        // 降水確率最大 %
  precip: number;       // 降水量 mm
  radSum: number;       // 日射量合計 MJ/m²
  sun: number;          // 日照時間 h
  wsMax: number;        // 最大風速 m/s
}

export interface AiCommentInput {
  location: string;
  month: number;
  warnings: string[];
  hourly: AiHourlyEntry[];   // 今後3日分の時間別
  daily: AiDailyEntry[];     // その後4日分の日別
}

const LEVEL_SUFFIX: Record<string, string> = {
  special: '特別警報',
  warning: '警報',
  advisory: '注意報',
  none: '',
};

/** "YYYY-MM-DDTHH:00" → "M/D H時" */
function fmtTime(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/);
  if (!m) return iso;
  return `${parseInt(m[2])}/${parseInt(m[3])} ${parseInt(m[4])}時`;
}

/** "YYYY-MM-DD" → "M/D" */
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}`;
}

export function buildAiCommentInput(
  locationName: string,
  forecast: ForecastData,
  warnings: JmaWarningItem[],
): AiCommentInput {
  const nowMs = Date.now();

  // 時間別: 現在時刻以降72エントリまで（約3日分）
  const hourly: AiHourlyEntry[] = forecast.hourly
    .filter(h => Date.parse(`${h.time}:00+09:00`) >= nowMs)
    .slice(0, 72)
    .map(h => ({
      t: fmtTime(h.time),
      tmp: Math.round(h.temperature * 10) / 10,
      dew: Math.round(h.dewPoint * 10) / 10,
      hum: h.humidity,
      vpd: calcVPD(h.temperature, h.humidity),
      ws: Math.round(h.windSpeed * 10) / 10,
      wd: windDirLabel(h.windDirection),
      wg: Math.round(h.windGusts * 10) / 10,
      pr: h.precipitation,
      pp: h.precipProb,
      rad: Math.round(h.radiation),
      uv: Math.round(h.uvIndex * 10) / 10,
      snow: h.snowfall,
    }));

  // 日別: 4日目以降（今日=index0、時間別でカバーされる3日をスキップ）
  const daily: AiDailyEntry[] = forecast.daily
    .filter(d => !d.isPlaceholder)
    .slice(3, 7)
    .map(d => ({
      date: fmtDate(d.date),
      tmpMax: Math.round(d.tempMax),
      tmpMin: Math.round(d.tempMin),
      ppMax: d.precipProbMax,
      precip: Math.round(d.precipSum),
      radSum: Math.round(d.radiationSum * 10) / 10,
      sun: Math.round(d.sunshineDuration * 10) / 10,
      wsMax: Math.round(d.windSpeedMax * 10) / 10,
    }));

  const warningNames = warnings.map(w => `${w.name}${LEVEL_SUFFIX[w.level] ?? ''}`);

  return {
    location: locationName,
    month: new Date(nowMs + 9 * 60 * 60 * 1000).getUTCMonth() + 1,
    warnings: warningNames,
    hourly,
    daily,
  };
}

/**
 * 入力ペイロードから安定したキャッシュキーを計算する（djb2 ハッシュ）。
 * 時間別データは現在時刻以降でフィルタするため、1時間ごとにハッシュが変わる。
 */
export function hashAiCommentInput(input: AiCommentInput): string {
  const str = JSON.stringify(input);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
