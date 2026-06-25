// src/lib/aiCommentInput.ts
//
// AI コメント用の入力ペイロードを組み立て、キャッシュキー用の安定ハッシュを計算する。
//
// AiCommentInput    … 標準4タブ用（軽量）: 2時間おき36エントリ（72時間分）、cape/frz/prs なし
// AiCustomInput     … カスタマイズ用（詳細）: 1時間おき72エントリ（72時間分）、cape/frz/prs あり

import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';

/** 飽差 (g/m³) を気温・湿度から計算 */
function calcVpd(tmp: number, hum: number): number {
  const es = 6.112 * Math.exp(17.67 * tmp / (tmp + 243.5)); // 飽和水蒸気圧 hPa
  const as = 217 * es / (tmp + 273.15);                      // 飽和絶対湿度 g/m³
  return Math.round(as * (1 - hum / 100) * 10) / 10;
}

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
  uv: number;       // 紫外線指数
  vpd: number;      // 飽差 g/m³
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
  hourly: AiHourlyEntry[];        // 2時間おき 36エントリ（72時間分）
  daily: AiDailyEntry[];          // 3日後〜7日後の日別予報
}

/** カスタマイズ用の入力ペイロード（詳細） */
export interface AiCustomInput {
  location: string;
  now: string;
  month: number;
  warnings: string[];
  past_daily: AiDailyEntry[];     // 過去7日分の日別実績
  hourly: AiHourlyEntryRich[];    // 1時間おき 72エントリ（72時間分）
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

// ─── キャッシュキー安定化（4時間バケット）─────────────────────────────────────
//
// 入力ペイロードは「現在時刻ラベル(now)」と「hourly 窓の開始位置」を Date.now() から
// 導出しているため、放置すると毎時ハッシュが変わり、4時間 TTL（aiCommentCache.ts）が
// 発火する前にキャッシュミスして AI を再生成してしまう。
// そこで時刻の基準点を JST 4時間バケット境界（0/4/8/12/16/20時）に切り下げ、
// 同一バケット内ではペイロード＝ハッシュを完全固定する。これにより「時計が進むだけ」の
// 再生成が消える（予報値そのものの更新はハッシュが変わるため従来どおり再生成される）。

const BUCKET_MS = 4 * 60 * 60 * 1000; // 4時間（aiCommentCache.ts の TTL と一致）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** nowMs を JST の4時間バケット境界（0/4/8/12/16/20時）に切り下げる */
function bucketStartMs(nowMs: number): number {
  return Math.floor((nowMs + JST_OFFSET_MS) / BUCKET_MS) * BUCKET_MS - JST_OFFSET_MS;
}

// ─── 標準4タブ用 ─────────────────────────────────────────────────────────────

/**
 * 標準4タブ用（軽量版）。2時間おき・36エントリ（72時間分）。cape/frz/prs なし。
 */
export function buildAiCommentInput(
  locationName: string,
  forecast: ForecastData,
  warnings: JmaWarningItem[],
): AiCommentInput {
  // 4時間バケット境界に固定し、同一バケット内でハッシュ＝キャッシュキーを安定させる
  const nowMs = bucketStartMs(Date.now());
  const { warningNames, nowLabel, month } = buildCommon(nowMs, warnings);

  const hourly: AiHourlyEntry[] = forecast.hourly
    .filter(h => Date.parse(`${h.time}:00+09:00`) >= nowMs)
    .filter((_, i) => i % 2 === 0)
    .slice(0, 36)
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
      uv:   Math.round(h.uvIndex * 10) / 10,
      vpd:  calcVpd(h.temperature, h.humidity),
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
 * カスタマイズ用（詳細版）。1時間おき・72エントリ（72時間分）。cape/frz/prs あり。
 */
export function buildAiCustomInput(
  locationName: string,
  forecast: ForecastData,
  warnings: JmaWarningItem[],
): AiCustomInput {
  // 4時間バケット境界に固定し、同一バケット内でハッシュ＝キャッシュキーを安定させる
  const nowMs = bucketStartMs(Date.now());
  const { warningNames, nowLabel, month } = buildCommon(nowMs, warnings);

  const hourly: AiHourlyEntryRich[] = forecast.hourly
    .filter(h => Date.parse(`${h.time}:00+09:00`) >= nowMs)
    .slice(0, 72)
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
      uv:   Math.round(h.uvIndex * 10) / 10,
      vpd:  calcVpd(h.temperature, h.humidity),
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
