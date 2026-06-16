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
