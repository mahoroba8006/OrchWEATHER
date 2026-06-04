// src/lib/aiCommentInput.ts
//
// AI コメント用の入力ペイロードを組み立て、キャッシュキー用の安定ハッシュを計算する。
//
// AiCommentInput    … 標準4タブ用（軽量）: 2時間おき24エントリ、cape/frz/prs なし
// AiCustomInput     … カスタマイズ用（詳細）: 1時間おき48エントリ、cape/frz/prs あり

import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';

/** 角度(°)を16方位文字列に変換 */
function windDirLabel(deg: number): string {
  const dirs = ['北','北北東','北東','東北東','東','東南東','南東','南南東',
                '南','南南西','南西','西南西','西','西北西','北西','北北西'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** 標準4タブ用の時間別エントリ（軽量） */
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
}

/** カスタマイズ用の時間別エントリ（詳細: cape/frz/prs を追加） */
export interface AiHourlyEntryRich extends AiHourlyEntry {
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

/** 標準4タブ用の入力ペイロード（軽量） */
export interface AiCommentInput {
  location: string;
  now: string;                    // 現在日時 "M/D(曜日) H時" (JST)
  month: number;
  warnings: string[];
  past_daily: AiDailyEntry[];     // 過去7日分の日別実績
  hourly: AiHourlyEntry[];        // 2時間おき 24エントリ（今日〜2日後）
  daily: AiDailyEntry[];          // 3日後〜7日後の日別予報
}

/** カスタマイズ用の入力ペイロード（詳細） */
export interface AiCustomInput {
  location: string;
  now: string;
  month: number;
  warnings: string[];
  past_daily: AiDailyEntry[];     // 過去7日分の日別実績
  hourly: AiHourlyEntryRich[];    // 1時間おき 48エントリ（今日〜2日後）
  daily: AiDailyEntry[];          // 3日後〜7日後の日別予報
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

/** 警報名リストと現在時刻ラベルを共通生成 */
function buildCommon(nowMs: number, warnings: JmaWarningItem[]) {
  const warningNames = warnings.map(w => `${w.name}${LEVEL_SUFFIX[w.level] ?? ''}`);
  const jstNow = new Date(nowMs + 9 * 60 * 60 * 1000);
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const nowLabel = `${jstNow.getUTCMonth() + 1}/${jstNow.getUTCDate()}(${DOW[jstNow.getUTCDay()]}) ${jstNow.getUTCHours()}時`;
  const month = jstNow.getUTCMonth() + 1;
  return { warningNames, nowLabel, month };
}

/** 過去7日の日別実績を生成 */
function buildPastDaily(forecast: ForecastData): AiDailyEntry[] {
  return forecast.pastDaily
    .filter(d => !d.isPlaceholder)
    .slice(-7)
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
}

/** 今後7日の日別予報を生成（hourly の2日後〜7日後） */
function buildDaily(forecast: ForecastData): AiDailyEntry[] {
  return forecast.daily
    .filter(d => !d.isPlaceholder)
    .slice(2, 9)
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
}

/** djb2 ハッシュ */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ─── 標準4タブ用 ─────────────────────────────────────────────────────────────

/**
 * 標準4タブ用（軽量版）。2時間おき・24エントリ。cape/frz/prs なし。
 */
export function buildAiCommentInput(
  locationName: string,
  forecast: ForecastData,
  warnings: JmaWarningItem[],
): AiCommentInput {
  const nowMs = Date.now();
  const { warningNames, nowLabel, month } = buildCommon(nowMs, warnings);

  const hourly: AiHourlyEntry[] = forecast.hourly
    .filter(h => Date.parse(`${h.time}:00+09:00`) >= nowMs)
    .filter((_, i) => i % 2 === 0)
    .slice(0, 24)
    .map(h => ({
      t:    fmtTime(h.time),
      tmp:  Math.round(h.temperature * 10) / 10,
      hum:  h.humidity,
      ws:   Math.round(h.windSpeed * 10) / 10,
      wd:   windDirLabel(h.windDirection),
      wg:   Math.round(h.windGusts * 10) / 10,
      pr:   h.precipitation,
      pp:   h.precipProb,
      snow: h.snowfall,
    }));

  return {
    location: locationName,
    now: nowLabel,
    month,
    warnings: warningNames,
    past_daily: buildPastDaily(forecast),
    hourly,
    daily: buildDaily(forecast),
  };
}

/** 標準4タブ用キャッシュキー */
export function hashAiCommentInput(input: AiCommentInput): string {
  return djb2(JSON.stringify(input));
}

// ─── カスタマイズ用 ────────────────────────────────────────────────────────────

/**
 * カスタマイズ用（詳細版）。1時間おき・48エントリ。cape/frz/prs あり。
 */
export function buildAiCustomInput(
  locationName: string,
  forecast: ForecastData,
  warnings: JmaWarningItem[],
): AiCustomInput {
  const nowMs = Date.now();
  const { warningNames, nowLabel, month } = buildCommon(nowMs, warnings);

  const hourly: AiHourlyEntryRich[] = forecast.hourly
    .filter(h => Date.parse(`${h.time}:00+09:00`) >= nowMs)
    .slice(0, 48)
    .map(h => ({
      t:    fmtTime(h.time),
      tmp:  Math.round(h.temperature * 10) / 10,
      hum:  h.humidity,
      ws:   Math.round(h.windSpeed * 10) / 10,
      wd:   windDirLabel(h.windDirection),
      wg:   Math.round(h.windGusts * 10) / 10,
      pr:   h.precipitation,
      pp:   h.precipProb,
      snow: h.snowfall,
      cape: Math.round(h.cape),
      frz:  Math.round(h.freezingLevel),
      prs:  Math.round(h.pressure * 10) / 10,
    }));

  return {
    location: locationName,
    now: nowLabel,
    month,
    warnings: warningNames,
    past_daily: buildPastDaily(forecast),
    hourly,
    daily: buildDaily(forecast),
  };
}

/** カスタマイズ用キャッシュキー */
export function hashAiCustomInput(input: AiCustomInput): string {
  return djb2(JSON.stringify(input));
}
