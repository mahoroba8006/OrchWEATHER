import { describe, expect, it } from 'vitest';
import { GDD_LAG_DAYS, HUNCHES, LP_FACTS_ASOF, LP_FACTS_SOURCE, gddCurve, hunchSummary, splitPhrases } from './lpFacts';

describe('lpFacts', () => {
  it('3つの勘と、撮影した画面と同じ数字', () => {
    expect(HUNCHES.map((h) => h.quote)).toEqual(['今年は、遅い気がする。', '雨、多すぎないか。', 'お日さま、足りてない。']);
    expect(HUNCHES.map((h) => h.value)).toEqual([18, 5.9, 64]);
    expect(LP_FACTS_SOURCE).toBe('東京・2026年の実績');
    expect(LP_FACTS_ASOF).toBe('東京・2026年10月5日時点');
  });
  it('勘の章の最後に残す3行', () => {
    expect(HUNCHES.map(hunchSummary)).toEqual([
      '積算温度：去年より18日遅い',
      '白露の雨：5年平均の5.9倍',
      '白露の日照：5年平均より64時間少ない',
    ]);
  });
  it('勘の言葉を「、」の直後で句に分ける（後読みの正規表現を使わない）', () => {
    expect(splitPhrases('今年は、遅い気がする。')).toEqual(['今年は、', '遅い気がする。']);
    expect(splitPhrases('雨、多すぎないか。')).toEqual(['雨、', '多すぎないか。']);
    expect(splitPhrases('句点だけ。')).toEqual(['句点だけ。']);
    expect(splitPhrases('')).toEqual(['']);
    for (const h of HUNCHES) expect(splitPhrases(h.quote).join('')).toBe(h.quote);
  });
  it('「平年」と言わない', () => {
    expect(JSON.stringify(HUNCHES)).not.toMatch(/平年/);
  });
  it('模式曲線は今年が去年よりちょうど18日遅れる', () => {
    expect(GDD_LAG_DAYS).toBe(18);
    expect(gddCurve(278, GDD_LAG_DAYS)).toBeCloseTo(gddCurve(260), 6);
  });
});
