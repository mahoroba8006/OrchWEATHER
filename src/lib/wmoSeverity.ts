// WMO Weather code → 深刻度スコア
// WMOコードは現象ブロック別に整理されており、数値の大小と深刻度は連動しない。
// このマップで正規化し、ブロックをまたぐ比較を正確に行う。
const WMO_SEVERITY: Record<number, number> = {
  0: 1, 1: 2, 2: 3, 3: 4,         // 快晴〜曇り
  45: 5, 48: 5,                     // 霧
  51: 6, 53: 7, 55: 8,              // 霧雨
  56: 9, 57: 10,                    // 着氷性の霧雨・雨
  80: 11, 85: 12,                   // にわか雨弱・にわか雪弱
  61: 13, 71: 14,                   // 小雨・小雪
  81: 15, 86: 16,                   // にわか雨・にわか雪
  82: 17,                           // 激しいにわか雨
  66: 18,                           // みぞれ
  63: 19, 73: 20, 77: 20,           // 雨・雪・雪粒（77は大雪より軽い）
  67: 21,                           // みぞれ強
  65: 22, 75: 23,                   // 大雨・大雪
  95: 24, 96: 25, 99: 26,           // 雷雨・雷雨ひょう・激しい雷雨ひょう
};

export function wmoSeverity(code: number): number {
  return WMO_SEVERITY[code] ?? 0;
}

/** 2つのWMOコードのうち深刻度が高い方を返す */
export function worstCode(a: number, b: number): number {
  return wmoSeverity(a) >= wmoSeverity(b) ? a : b;
}

/** 天気コード集計方式 */
export type WeatherCodeMode = 'severity' | 'frequency';

/**
 * コード配列から最頻値を返す。同頻度の場合は深刻度が高い方を採用。
 * frequency モードで使用。
 */
export function modeCode(codes: number[]): number | null {
  if (codes.length === 0) return null;
  const freq = new Map<number, number>();
  for (const c of codes) freq.set(c, (freq.get(c) ?? 0) + 1);
  let maxFreq = 0, result = 0;
  for (const [code, count] of freq) {
    if (count > maxFreq || (count === maxFreq && wmoSeverity(code) > wmoSeverity(result))) {
      maxFreq = count; result = code;
    }
  }
  return result;
}

/**
 * モードに応じてコード配列から代表値を選択する統一関数。
 * severity: 最深刻度（デフォルト）
 * frequency: 最頻値（同数タイは深刻度高い方）
 */
export function selectCode(codes: number[], mode: WeatherCodeMode): number | null {
  if (codes.length === 0) return null;
  if (mode === 'severity') {
    return codes.reduce((a, b) => wmoSeverity(a) >= wmoSeverity(b) ? a : b);
  }
  return modeCode(codes);
}
