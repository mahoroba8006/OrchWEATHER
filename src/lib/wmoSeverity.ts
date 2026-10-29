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

// 天気の種類。並びは深刻度の順（同数のときは後ろを採用）
const KINDS = ['clear', 'cloudy', 'rain', 'snow', 'thunder'] as const;
type Kind = typeof KINDS[number];
const WET_KINDS: Kind[] = ['rain', 'snow', 'thunder'];
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

function codeKind(code: number): Kind {
  if (code <= 2) return 'clear';
  if (code <= 48) return 'cloudy';
  if (code >= 95) return 'thunder';
  return SNOW_CODES.has(code) ? 'snow' : 'rain';
}

/** 件数が最も多いキーを返す。同数は rank が大きい方 */
function mostFrequent<T>(counts: Map<T, number>, rank: (key: T) => number): T {
  let best: T | undefined, bestCount = 0;
  for (const [key, count] of counts) {
    if (best === undefined || count > bestCount || (count === bestCount && rank(key) > rank(best))) {
      best = key; bestCount = count;
    }
  }
  return best as T;
}

/**
 * frequency モードの代表コード。
 * 晴れ／くもり／雨／雪／雷の種類ごとに時間数を数え、雨・雪・雷のいずれかが
 * 全体の1/4以上で、かつ雨量（precipSum）の合計が1mm以上ならその種類（複数あれば多い方）、
 * なければ最も多い種類を選ぶ。雨量が分からない（undefined/null）ときは時間だけで決める。
 * 1mm 未満の霧雨が数時間あるだけで、晴れの時間帯が雨にならないようにする。
 * 同数は深刻な方。絵はその種類の中で最も多いコード（同数は深刻度が高い方）。
 * 雨は強さ別にコードが分かれるため、コード単位の最頻値だと晴れ・曇りに負ける。
 */
export function modeCode(codes: number[], precipSum?: number | null): number | null {
  if (codes.length === 0) return null;
  // 0.1mm に丸めてから比べる（足し算の誤差で 1mm 未満にしない）
  const enoughRain = precipSum == null || Math.round(precipSum * 10) / 10 >= 1;
  const kindCounts = new Map<Kind, number>();
  for (const c of codes) kindCounts.set(codeKind(c), (kindCounts.get(codeKind(c)) ?? 0) + 1);
  const wet = new Map([...kindCounts].filter(([k, n]) => enoughRain && WET_KINDS.includes(k) && n * 4 >= codes.length));
  const kindRank = (k: Kind) => KINDS.indexOf(k);
  const kind = mostFrequent(wet.size > 0 ? wet : kindCounts, kindRank);

  const freq = new Map<number, number>();
  for (const c of codes) if (codeKind(c) === kind) freq.set(c, (freq.get(c) ?? 0) + 1);
  return mostFrequent(freq, wmoSeverity);
}

/**
 * モードに応じてコード配列から代表値を選択する統一関数。
 * severity: 最深刻度（デフォルト）
 * frequency: 種類ごとの時間数で選ぶ（雨・雪・雷は1/4以上かつ1mm以上で優先。modeCode 参照）
 */
export function selectCode(codes: number[], mode: WeatherCodeMode, precipSum?: number | null): number | null {
  if (codes.length === 0) return null;
  if (mode === 'severity') {
    return codes.reduce((a, b) => wmoSeverity(a) >= wmoSeverity(b) ? a : b);
  }
  return modeCode(codes, precipSum);
}
