// src/lib/aiCommentInput.ts
//
// AI コメント用の入力ペイロードを組み立て、キャッシュキー用の安定ハッシュを計算する。
// 今後3日分の時間別データ（HourlyTable 表示項目すべて）+
// その後4日分の日別データを Gemini に渡す。

import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';

/** 角度(°)を16方位文字列に変換 */
function windDirLabel(deg: number): string {
  const dirs = ['北','北北東','北東','東北東','東','東南東','南東','南南東',
                '南','南南西','南西','西南西','西','西北西','北西','北北西'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export interface AiHourlyEntry {
  t: string;        // 時刻 "MM/DD HH時"
  tmp: number;      // 気温 ℃
  hum: number;      // 湿度 %
  ws: number;       // 風速 m/s
  wd: string;       // 風向
  wg: number;       // 瞬間風速 m/s
  pr: number;       // 降水量 mm
  pp: number;       // 降水確率 %
  snow: number;     // 降雪量 cm
  cape: number;     // CAPE J/kg
  frz: number;      // 0℃層高度 m
  prs: number;      // 海面気圧 hPa
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
  now: string;               // 現在日時 "M/D H時" (JST)
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

  // 時間別: 現在時刻以降を2時間おきにサンプリング、24エントリまで（約2日分をカバー）
  const hourly: AiHourlyEntry[] = forecast.hourly
    .filter(h => Date.parse(`${h.time}:00+09:00`) >= nowMs)
    .filter((_, i) => i % 2 === 0)
    .slice(0, 24)
    .map(h => ({
      t: fmtTime(h.time),
      tmp: Math.round(h.temperature * 10) / 10,
      hum: h.humidity,
      ws: Math.round(h.windSpeed * 10) / 10,
      wd: windDirLabel(h.windDirection),
      wg: Math.round(h.windGusts * 10) / 10,
      pr: h.precipitation,
      pp: h.precipProb,
      snow: h.snowfall,
      cape: Math.round(h.cape),
      frz: Math.round(h.freezingLevel),
      prs: Math.round(h.pressure * 10) / 10,
    }));

  // 日別: 3日目以降（時間別でカバーされる2日をスキップ）
  const daily: AiDailyEntry[] = forecast.daily
    .filter(d => !d.isPlaceholder)
    .slice(2, 7)
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

  // 注意報・警報は fetchJmaWarnings の時点で「期限切れ・発表から6時間超の解除未定」を
  // 既に除外済み（単一の判定箇所）。ここでは名前整形のみ行う。
  const warningNames = warnings.map(w => `${w.name}${LEVEL_SUFFIX[w.level] ?? ''}`);

  const jstNow = new Date(nowMs + 9 * 60 * 60 * 1000);
  const nowLabel = `${jstNow.getUTCMonth() + 1}/${jstNow.getUTCDate()} ${jstNow.getUTCHours()}時`;

  return {
    location: locationName,
    now: nowLabel,
    month: jstNow.getUTCMonth() + 1,
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
