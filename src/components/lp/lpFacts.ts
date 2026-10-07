// LP に載せる数字。東京・2026年の実績（scripts/lp-shots.mjs で 2026-10-05 に撮影した画面と同じ値）。
// 画面写真を撮り直したら、ここも同じ値に更新する。
export const LP_FACTS_SOURCE = '東京・2026年の実績';
/** 最初の画面の札に添える撮影時点（撮影時点の数字を今日の実績と誤解させない） */
export const LP_FACTS_ASOF = '東京・2026年10月5日時点';

export interface Hunch {
  /** 農家のつぶやき */
  quote: string;
  /** 章の最後に振り返るときの見出し */
  topic: string;
  /** 数字の項目名（大きく目立たせる） */
  term: string;
  /** 項目名に添える期間・条件 */
  detail: string;
  /** 数字の前の言葉 */
  before: string;
  value: number;
  decimals: number;
  unit: string;
  note: string;
}

export const HUNCHES: readonly Hunch[] = [
  { quote: '今年は、遅い気がする。', topic: '積算温度', term: '積算温度', detail: '1月1日から・10℃基準', before: '去年より', value: 18, decimals: 0, unit: '日遅い', note: '5年平均より12日遅い' },
  { quote: '雨、多すぎないか。', topic: '白露の雨', term: '降水量', detail: '白露（9/7〜9/22）', before: '5年平均の', value: 5.9, decimals: 1, unit: '倍', note: '476mm（去年の10.6倍）' },
  { quote: 'お日さま、足りてない。', topic: '白露の日照', term: '日照時間', detail: '白露（9/7〜9/22）', before: '5年平均より', value: 64, decimals: 0, unit: '時間少ない', note: '39時間（去年より68時間少ない）' },
];

/** 章の最後に残す一行（例「積算温度：去年より18日遅い」） */
export function hunchSummary(h: Hunch): string {
  return `${h.topic}：${h.before}${h.value.toFixed(h.decimals)}${h.unit}`;
}

/** 積算温度の模式図で、今年が去年より遅れる日数（季節のあしどりの実績と同じ） */
export const GDD_LAG_DAYS = 18;

/** 積算温度の模式曲線（1月1日からの日数 → ℃・日）。lag 日だけ右へずらす */
export function gddCurve(day: number, lag = 0): number {
  return 3000 / (1 + Math.exp(-(day - lag - 200) / 40));
}

/** 「、」の直後で句に分ける（句の中では折り返さず、行頭に「。」「、」が来ないようにする）。
 *  古い iOS Safari（16.4 未満）は後読み (?<=) を読めず LP 全体が落ちるので、match で分ける */
export function splitPhrases(quote: string): string[] {
  return quote.match(/[^、]+、?/g) ?? [quote];
}
