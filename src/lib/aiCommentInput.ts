// src/lib/aiCommentInput.ts
//
// AI コメント用の入力ペイロードを組み立て、キャッシュキー用の安定ハッシュを計算する。
// ペイロードは Gemini に渡すデータ。トークン節約のため必要最小限に絞る。

import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';
import { findCalmWindows, type CalmWindow } from './workWindows';

export interface AiCommentDailyBrief {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipProbMax: number;
  precipSum: number;
}

export interface AiCommentInput {
  locationName: string;
  month: number;                  // 1-12
  daily: AiCommentDailyBrief[];   // 先頭5日
  warnings: string[];             // 気象庁警報・注意報名（例: "濃霧注意報"）
  calmWindows: CalmWindow[];
}

const LEVEL_SUFFIX: Record<string, string> = {
  special: '特別警報',
  warning: '警報',
  advisory: '注意報',
  none: '',
};

/** 予報・警報データから AI 入力ペイロードを組み立てる */
export function buildAiCommentInput(
  locationName: string,
  forecast: ForecastData,
  warnings: JmaWarningItem[],
): AiCommentInput {
  const daily: AiCommentDailyBrief[] = forecast.daily
    .filter(d => !d.isPlaceholder)
    .slice(0, 5)
    .map(d => ({
      date: d.date,
      weatherCode: d.weatherCode,
      tempMax: Math.round(d.tempMax),
      tempMin: Math.round(d.tempMin),
      precipProbMax: d.precipProbMax,
      precipSum: Math.round(d.precipSum),
    }));

  const warningNames = warnings.map(
    w => `${w.name}${LEVEL_SUFFIX[w.level] ?? ''}`,
  );

  // 現在時刻以降の時間別のみを対象に好適ウィンドウを抽出
  const nowMs = Date.now();
  const futureHourly = forecast.hourly.filter(
    h => Date.parse(`${h.time}:00+09:00`) >= nowMs,
  );
  const calmWindows = findCalmWindows(futureHourly);

  return {
    locationName,
    month: new Date(nowMs + 9 * 60 * 60 * 1000).getUTCMonth() + 1,
    daily,
    warnings: warningNames,
    calmWindows,
  };
}

/**
 * 入力ペイロードから安定したキャッシュキーを計算する（djb2 ハッシュ）。
 * 同一地点・同一予報なら同じキーになり、Firestore キャッシュがヒットする。
 */
export function hashAiCommentInput(input: AiCommentInput): string {
  const str = JSON.stringify(input);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i); // hash * 33 ^ c
  }
  // 符号なし32bit → 16進数文字列
  return (hash >>> 0).toString(16);
}
