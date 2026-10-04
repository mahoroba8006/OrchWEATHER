import { describe, expect, it } from 'vitest';
import {
  buildDayMap, buildSeasonReview, buildProgressForRange, computePaceItems, currentSekkiRange, estimateSkyCode, seasonWords, recentSekkiRanges, REVIEW_COUNT, computeSeasonView, currentSekkiStart, daysBetween, DEFAULT_PACE_OPTIONS, fromForecastPast, headline,
  isInCardWindow, previousSekkiRange, rainCell, requiredYears, shiftYear, tempCell,
  type DayMap, type DayRecord, type PaceOptions,
} from './seasonReview';
import { addDays } from './dateUtils';
import type { DailyForecastData } from '../api/forecast';

const rec = (date: string, r: Partial<DayRecord> = {}): DayRecord => ({
  date, tempMean: 10, tempMax: 15, tempMin: 5, precip: 0, sunshine: 5, ...r,
});
function fill(map: DayMap, start: string, end: string, r: Partial<DayRecord>) {
  for (let d = start; d <= end; d = addDays(d, 1)) map.set(d, rec(d, r));
}

describe('日付ユーティリティ', () => {
  it('shiftYear は年だけずらし、2/29 は平年で 2/28 にする', () => {
    expect(shiftYear('2026-09-07', -5)).toBe('2021-09-07');
    expect(shiftYear('2024-02-29', -1)).toBe('2023-02-28');
  });
  it('daysBetween は両端を含む日数', () => {
    expect(daysBetween('2026-09-07', '2026-09-22')).toBe(16);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(2);
  });
});

describe('節気範囲', () => {
  // 国立天文台 暦要項 2026: 白露 9/7、秋分 9/23、小寒 1/5
  it('今の節気の開始日', () => {
    expect(currentSekkiStart('2026-10-01')).toBe('2026-09-23');
  });
  it('直前に終わった節気の範囲', () => {
    expect(previousSekkiRange('2026-10-01')).toEqual({
      index: 14, name: '白露', start: '2026-09-07', end: '2026-09-22', days: 16,
    });
  });
  it('年をまたぐ節気（冬至）', () => {
    const r = previousSekkiRange('2026-01-06');
    expect(r.name).toBe('冬至');
    expect(r.start.startsWith('2025-12-2')).toBe(true);
    expect(r.end).toBe('2026-01-04');
  });
  it('カードは新しい節気の初日から3日間だけ', () => {
    expect(isInCardWindow('2026-09-23')).toBe(true);
    expect(isInCardWindow('2026-09-25')).toBe(true);
    expect(isInCardWindow('2026-09-26')).toBe(false);
  });
});

describe('requiredYears', () => {
  it('通常は昨日の年から5年前まで', () => {
    expect(requiredYears('2026-10-03')).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
  });
  it('年をまたぐ節気・30日範囲では前年起点で5年前まで', () => {
    expect(requiredYears('2026-01-06')).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });
  it('ふりかえりを6節気さかのぼる年初は、その5年前まで含める', () => {
    // 2026-02-10: 6節気前は前年の秋（霜降 2025-10-23 頃）→ 2020 年まで必要
    expect(requiredYears('2026-02-10')[0]).toBe(2020);
  });
  it('ふりかえりは12節気（約半年）さかのぼる。年の前半は前年の分の5年前まで含める', () => {
    expect(REVIEW_COUNT).toBe(12);
    const r = recentSekkiRanges('2026-10-01', REVIEW_COUNT);
    expect(r[0].name).toBe('春分'); // 白露を含めて12節気（3月下旬〜）
    // 2026-06-10: 12節気前は前年12月（大雪）→ 2020 年まで必要
    expect(requiredYears('2026-06-10')[0]).toBe(2020);
  });
  it('1/1 は今年のデータが無いので今年を含めない', () => {
    expect(requiredYears('2026-01-01')).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });
});

describe('buildDayMap', () => {
  it('archive を優先し、無い日だけ補完する', () => {
    const map = buildDayMap(
      [rec('2026-09-20', { precip: 1 })],
      [rec('2026-09-20', { precip: 9 }), rec('2026-09-21', { precip: 2 })],
    );
    expect(map.get('2026-09-20')?.precip).toBe(1);
    expect(map.get('2026-09-21')?.precip).toBe(2);
  });
  it('予報の pastDaily は (最高+最低)/2 を日平均にし、placeholder を除く', () => {
    const base = { tempMax: 30, tempMin: 20, precipSum: 3, sunshineDuration: 4 };
    const days = fromForecastPast([
      { ...base, date: '2026-09-21' } as DailyForecastData,
      { ...base, date: '2026-09-22', isPlaceholder: true } as DailyForecastData,
    ]);
    expect(days).toEqual([{ date: '2026-09-21', tempMean: 25, tempMax: 30, tempMin: 20, precip: 3, sunshine: 4 }]);
  });
});

describe('比較文言', () => {
  it('tempCell は小数1桁の符号付き', () => {
    expect(tempCell(24, 23)).toEqual({ text: '+1.0℃', tone: 'more' });
    expect(tempCell(22.96, 23)).toEqual({ text: '±0.0℃', tone: 'same' });
    expect(tempCell(21.5, 23)).toEqual({ text: '−1.5℃', tone: 'less' });
  });
  it('rainCell は基準5mm以上で割合、未満で mm 差', () => {
    expect(rainCell(38, 64)).toEqual({ text: '6割', tone: 'less' });
    expect(rainCell(100, 64)).toEqual({ text: '1.6倍', tone: 'more' });
    expect(rainCell(64, 64)).toEqual({ text: '同じくらい', tone: 'same' });
    expect(rainCell(3, 2)).toEqual({ text: '+1mm', tone: 'more' });
  });
});

describe('headline', () => {
  const avg = { meanTemp: 23, precip: 64, sunshine: 80 };
  it('ずれの大きい2項目を組み合わせる', () => {
    expect(headline({ meanTemp: 24, precip: 38, sunshine: 96 }, avg)).toBe('日差しが多く、雨が少ない');
  });
  it('1項目だけなら連体形で終える', () => {
    expect(headline({ meanTemp: 25, precip: 64, sunshine: 80 }, avg)).toBe('暑い');
  });
  it('該当なしは「大きく変わらぬ移ろい」（比べた相手は期間の横に出すので平年とは言わない）', () => {
    expect(headline({ meanTemp: 23.5, precip: 60, sunshine: 85 }, avg)).toBe('大きく変わらぬ移ろい');
  });
  it('5年平均の雨が5mm未満なら雨は判定しない', () => {
    expect(headline({ meanTemp: 23, precip: 20, sunshine: 80 }, { ...avg, precip: 2 })).toBe('大きく変わらぬ移ろい');
  });
});

describe('buildSeasonReview', () => {
  // 白露 2026-09-07〜09-22（16日）。過去5年は毎日 23℃・4mm・5h
  function sampleMap(): DayMap {
    const map: DayMap = new Map();
    for (let y = 2021; y <= 2025; y++) fill(map, `${y}-09-01`, `${y}-09-30`, { tempMean: 23, precip: 4, sunshine: 5 });
    fill(map, '2026-09-01', '2026-09-30', { tempMean: 24, tempMax: 30, tempMin: 18, precip: 0, sunshine: 6 });
    map.set('2026-09-09', rec('2026-09-09', { tempMean: 24, tempMax: 33.2, tempMin: 18, sunshine: 6 }));
    map.set('2026-09-11', rec('2026-09-11', { tempMean: 24, tempMax: 30, tempMin: 18, precip: 22, sunshine: 6 }));
    map.set('2026-09-12', rec('2026-09-12', { tempMean: 24, tempMax: 30, tempMin: 18, precip: 16, sunshine: 6 }));
    map.set('2026-09-21', rec('2026-09-21', { tempMean: 24, tempMax: 30, tempMin: 15.8, sunshine: 6 }));
    return map;
  }

  it('比べる相手を去年にすると、見出しは去年とのずれで作る（表は両方のまま）', () => {
    const map = sampleMap();
    fill(map, '2025-09-01', '2025-09-30', { tempMean: 26, precip: 4, sunshine: 5 });
    const r = buildSeasonReview(map, '2026-10-01', 'lastYear')!;
    expect(r.headlineBase).toBe('去年');
    // 去年(26℃)より2℃低い・日照は去年より2割多い。5年平均(23.6℃)とは1℃差未満
    expect(r.headline).toBe('涼しく、日差しが多い');
    expect(buildSeasonReview(map, '2026-10-01', 'avg')!.headline).toBe('日差しが多く、雨が少ない');
    expect(r.rows[0].vsAvg).not.toBeNull();
  });

  it('期間・見出し・3項目・雨の棒・記録を組み立てる', () => {
    const r = buildSeasonReview(sampleMap(), '2026-10-01')!;
    expect(r.periodLabel).toBe('9/7〜9/22（16日間）');
    expect(r.headline).toBe('日差しが多く、雨が少ない');
    expect(r.headlineBase).toBe('5年平均');
    expect(r.rows).toEqual([
      { label: '平均気温', value: '24.0℃', vsLastYear: { text: '+1.0℃', tone: 'more' }, vsAvg: { text: '+1.0℃', tone: 'more' } },
      { label: '雨の量', value: '38mm', vsLastYear: { text: '6割', tone: 'less' }, vsAvg: { text: '6割', tone: 'less' } },
      { label: '日照', value: '96h', vsLastYear: { text: '+16h', tone: 'more' }, vsAvg: { text: '+16h', tone: 'more' } },
    ]);
    expect(r.daily).toHaveLength(16);
    // 5年平均の最高・最低は同じ月日の過去5年の平均（sampleMap の過去年は rec の既定値 15 / 5）
    expect(r.daily[4]).toEqual({ date: '2026-09-11', precip: 22, tempMax: 30, tempMin: 18, code: 63, avgMax: 15, avgMin: 5 });
    expect(r.daily[0]).toEqual({ date: '2026-09-07', precip: 0, tempMax: 30, tempMin: 18, code: 2, avgMax: 15, avgMin: 5 });
    expect(r.records).toEqual({
      hottest: { date: '2026-09-09', value: 33.2 },
      coldest: { date: '2026-09-21', value: 15.8 },
      heavyRain: { date: '2026-09-11', value: 22 },
    });
    expect(r.avgYears).toBe('2021〜2025年');
  });

  it('期間内に欠けがあれば null', () => {
    const map = sampleMap();
    map.delete('2026-09-15');
    expect(buildSeasonReview(map, '2026-10-01')).toBeNull();
  });

  it('10mm 以上の雨が無ければ heavyRain は null', () => {
    const map = sampleMap();
    map.set('2026-09-11', rec('2026-09-11', { precip: 9 }));
    map.set('2026-09-12', rec('2026-09-12', { precip: 9 }));
    expect(buildSeasonReview(map, '2026-10-01')!.records.heavyRain).toBeNull();
  });
});

describe('季節のあしどり（computePaceItems）', () => {
  // 過去年（2020〜2025）は毎日 10℃・雨2mm・日照5h
  function pastYears(): DayMap {
    const map: DayMap = new Map();
    for (let y = 2020; y <= 2025; y++) fill(map, `${y}-01-01`, `${y}-12-31`, { tempMean: 10, precip: 2, sunshine: 5 });
    return map;
  }
  // 今年（〜10/2）は毎日 11℃・雨3mm・日照6h
  function warmYear(): DayMap {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-10-02', { tempMean: 11, precip: 3, sunshine: 6 });
    return map;
  }
  const opts = (o: Partial<PaceOptions> = {}): PaceOptions => ({ ...DEFAULT_PACE_OPTIONS, baseTemp: 0, ...o });

  it('空くらべに合わせる: 気温（30日）・降水量・積算温度・日照時間の順', () => {
    expect(computePaceItems(warmYear(), '2026-10-03', opts())).toEqual([
      { kind: 'temp', name: '気温', period: 'この30日', text: '去年より+1.0℃・5年平均より+1.0℃' },
      { kind: 'precip', name: '降水量', period: '1月1日から', text: '去年の1.5倍・5年平均の1.5倍' },
      { kind: 'gdd', name: '積算温度', period: '1月1日から・0℃基準', text: '去年より28日早い・5年平均より28日早い' },
      // 5年平均には閏年 2024 を含む（1/1〜10/2 が1日多い）ため 1376h → +274h
      { kind: 'sunshine', name: '日照時間', period: '1月1日から', text: '去年より+275h・5年平均より+274h' },
    ]);
  });

  it('積算温度は基準温度を引いた分だけ積み、比較年が届かなければ「早いペース」', () => {
    const gdd = computePaceItems(warmYear(), '2026-10-03', opts({ baseTemp: 10 })).find(i => i.kind === 'gdd')!;
    expect([gdd.name, gdd.period]).toEqual(['積算温度', '1月1日から・10℃基準']);
    expect(gdd.text).toBe('去年より早いペース・5年平均より早いペース');
  });

  it('累積の積算が日数差のしきい値未満の時期は、積算温度の項目を出さない', () => {
    // 基準10.5℃: 過去年は0、今年は0.5×275日=137.5 < 200
    const items = computePaceItems(warmYear(), '2026-10-03', opts({ baseTemp: 10.5, gddDaysMin: 200 }));
    expect(items.find(i => i.kind === 'gdd')).toBeUndefined();
    expect(items.map(i => i.kind)).toEqual(['temp', 'precip', 'sunshine']);
  });

  it('0℃未満の日は0として積算する', () => {
    const map = pastYears();
    fill(map, '2026-01-01', '2026-01-31', { tempMean: -5 });
    fill(map, '2026-02-01', '2026-10-02', { tempMean: 11 });
    const gdd = computePaceItems(map, '2026-10-03', opts()).find(i => i.kind === 'gdd')!;
    expect(gdd.text).toBe('去年より6日遅い・5年平均より6日遅い');
  });

  it('開始日は空くらべの設定に従い、まだ来ていない開始日の項目は出さない', () => {
    const items = computePaceItems(warmYear(), '2026-10-03', opts({ startDates: { precip: '04-01', sunshine: '11-01', gdd: '01-01' } }));
    expect(items.find(i => i.kind === 'precip')?.period).toBe('4月1日から');
    expect(items.find(i => i.kind === 'sunshine')).toBeUndefined();
  });

  it('直近30日: 降水量・積算温度・日照時間も30日で比べ、積算温度の差は℃で示す', () => {
    const items = computePaceItems(warmYear(), '2026-10-03', opts({ modes: { precip: 'recent', gdd: 'recent', sunshine: 'recent' } }));
    expect(items.map(i => [i.kind, i.name, i.period, i.text])).toEqual([
      ['temp', '気温', 'この30日', '去年より+1.0℃・5年平均より+1.0℃'],
      ['precip', '降水量', 'この30日', '去年の1.5倍・5年平均の1.5倍'],
      ['gdd', '積算温度', 'この30日・0℃基準', '去年より+30℃・5年平均より+30℃'],
      ['sunshine', '日照時間', 'この30日', '去年より+30h・5年平均より+30h'],
    ]);
  });

  it('項目ごとに累積か直近30日かを選べる', () => {
    const items = computePaceItems(warmYear(), '2026-10-03', opts({ modes: { precip: 'recent', gdd: 'analysis', sunshine: 'recent' } }));
    expect(items.map(i => [i.kind, i.period])).toEqual([
      ['temp', 'この30日'],
      ['precip', 'この30日'],
      ['gdd', '1月1日から・0℃基準'],
      ['sunshine', 'この30日'],
    ]);
    expect(items.find(i => i.kind === 'gdd')?.text).toBe('去年より28日早い・5年平均より28日早い');
  });

  it('1/1 は前年分を「今年」として数えず、気温（30日）だけになる', () => {
    expect(computePaceItems(pastYears(), '2026-01-01', opts()).map(i => i.kind)).toEqual(['temp']);
  });

  it('データが無ければ空', () => {
    expect(computePaceItems(new Map(), '2026-10-03', opts())).toEqual([]);
  });
});

describe('computeSeasonView', () => {
  it('どちらも作れなければ null', () => {
    expect(computeSeasonView(new Map(), '2026-10-03', DEFAULT_PACE_OPTIONS)).toBeNull();
  });
  it('カード表示は節気の変わり目3日間のみ', () => {
    const map: DayMap = new Map();
    for (let y = 2021; y <= 2026; y++) fill(map, `${y}-01-01`, `${y}-12-31`, { tempMean: 10 });
    expect(computeSeasonView(map, '2026-09-24', DEFAULT_PACE_OPTIONS)!.showCard).toBe(true);
    const v = computeSeasonView(map, '2026-10-03', DEFAULT_PACE_OPTIONS)!;
    expect(v.showCard).toBe(false);
    expect(v.review?.range.name).toBe('白露');
    expect(v.paceItems.length).toBeGreaterThan(0);
  });
});

describe('過去の節気のふりかえり（複数節気）', () => {
  it('recentSekkiRanges は直前の節気から6つ、古い順に連続して返す', () => {
    const r = recentSekkiRanges('2026-10-01', 6);
    expect(r.map(x => x.name)).toEqual(['夏至', '小暑', '大暑', '立秋', '処暑', '白露']);
    for (let i = 1; i < r.length; i++) expect(r[i].start).toBe(addDays(r[i - 1].end, 1));
  });

  it('computeSeasonView は計算できる節気のカードを古い順に並べ、最新は review と同じ', () => {
    const map: DayMap = new Map();
    for (let y = 2021; y <= 2026; y++) fill(map, `${y}-01-01`, `${y}-12-31`, { tempMean: 10 });
    map.delete('2026-08-01'); // 大暑（7/23〜8/6頃）の今年分に欠け → そのカードだけ除く
    const v = computeSeasonView(map, '2026-10-03', DEFAULT_PACE_OPTIONS)!;
    // 一番右は今の節気（秋分）の途中経過。終わった節気は大暑だけが抜ける
    expect(v.reviews.at(-1)?.progress).not.toBeNull();
    const names = v.reviews.filter(r => !r.progress).map(r => r.range.name);
    expect(names).toHaveLength(REVIEW_COUNT - 1);
    expect(names).not.toContain('大暑');
    expect(names.slice(-4)).toEqual(['小暑', '立秋', '処暑', '白露']); // 大暑だけが抜ける
    expect(v.reviews.at(-2)).toEqual(v.review);
  });
});

describe('estimateSkyCode（雨量と日照からの天気の目安）', () => {
  const d = (precip: number, sunshine: number, tempMax = 20) => ({ date: '2026-09-01', tempMean: 15, tempMax, tempMin: 10, precip, sunshine });
  it('雨1mm以上は雨、10mm以上は強い雨、最高気温3℃以下の降水は雪', () => {
    expect(estimateSkyCode(d(1, 8))).toBe(61);
    expect(estimateSkyCode(d(12, 0))).toBe(63);
    expect(estimateSkyCode(d(2, 0, 3))).toBe(71);
  });
  it('雨が無ければ日照で 晴れ（7h以上）・晴れ時々曇り（3h以上）・曇り', () => {
    expect(estimateSkyCode(d(0.5, 7))).toBe(1);
    expect(estimateSkyCode(d(0, 3))).toBe(2);
    expect(estimateSkyCode(d(0, 2.9))).toBe(3);
  });
});

describe('季節に合った言葉（seasonWords）', () => {
  it('期間の最高気温の平均で 夏（25℃以上）・春秋・冬（15℃未満）を切り替える', () => {
    expect(seasonWords(25)).toEqual({ warm: '暑い', cold: '涼しい', warmRecord: 'いちばん暑い日', coldRecord: 'いちばん涼しい日' });
    expect(seasonWords(20)).toEqual({ warm: '暖かい', cold: '肌寒い', warmRecord: 'いちばん暖かい日', coldRecord: 'いちばん肌寒い日' });
    expect(seasonWords(14.9)).toEqual({ warm: '暖かい', cold: '寒い', warmRecord: 'いちばん暖かい日', coldRecord: 'いちばん寒い日' });
  });
  it('見出しも季節の言葉を使う（冬に平年より低ければ「寒い」）', () => {
    const avg = { meanTemp: 5, precip: 64, sunshine: 80 };
    expect(headline({ meanTemp: 3, precip: 64, sunshine: 80 }, avg, seasonWords(10))).toBe('寒い');
    expect(headline({ meanTemp: 7, precip: 64, sunshine: 80 }, avg, seasonWords(10))).toBe('暖かい');
    expect(headline({ meanTemp: 7, precip: 30, sunshine: 80 }, avg, seasonWords(20))).toBe('暖かく、雨が少ない');
  });
  it('カードの記録ラベルは期間の最高気温に合わせる', () => {
    const map: DayMap = new Map();
    for (let y = 2021; y <= 2026; y++) fill(map, `${y}-01-01`, `${y}-12-31`, { tempMean: 5, tempMax: 10, tempMin: 0 });
    const r = buildSeasonReview(map, '2026-02-10')!; // 大寒（最高 10℃）
    expect(r.recordLabels).toEqual({ warm: 'いちばん暖かい日', cold: 'いちばん寒い日' });
  });
});

describe('去年分だけ届いた段階（5年平均はまだ）', () => {
  // 去年（2025）だけ毎日 10℃・雨2mm・日照5h、今年は 11℃・3mm・6h
  function lastYearOnly(): DayMap {
    const map: DayMap = new Map();
    fill(map, '2025-01-01', '2025-12-31', { tempMean: 10, precip: 2, sunshine: 5 });
    fill(map, '2026-01-01', '2026-10-02', { tempMean: 11, precip: 3, sunshine: 6 });
    return map;
  }
  const opts0 = { ...DEFAULT_PACE_OPTIONS, baseTemp: 0 };

  it('季節のあしどりは「去年より」だけで出す', () => {
    expect(computePaceItems(lastYearOnly(), '2026-10-03', opts0).map(i => [i.kind, i.text])).toEqual([
      ['temp', '去年より+1.0℃'],
      ['precip', '去年の1.5倍'],
      ['gdd', '去年より28日早い'],
      ['sunshine', '去年より+275h'],
    ]);
  });

  it('直近30日の積算温度も「去年より」だけ', () => {
    const items = computePaceItems(lastYearOnly(), '2026-10-03', { ...opts0, modes: { precip: 'recent', gdd: 'recent', sunshine: 'recent' } });
    expect(items.find(i => i.kind === 'gdd')?.text).toBe('去年より+30℃');
  });

  it('ふりかえりカードは5年平均が揃うまで出さない', () => {
    const v = computeSeasonView(lastYearOnly(), '2026-10-03', opts0)!;
    expect(v.review).toBeNull();
    expect(v.reviews).toEqual([]);
    expect(v.paceItems.length).toBe(4);
  });

  it('requiredYears に何年さかのぼるかを渡せる（去年分だけの段階用）', () => {
    expect(requiredYears('2026-10-03', 1)).toEqual([2025, 2026]);
    expect(requiredYears('2026-06-10', 1)).toEqual([2024, 2025, 2026]);
  });
});

describe('見出しの言い切り（「半月でした」を付けない）', () => {
  const avg = { meanTemp: 20, precip: 64, sunshine: 80 };
  it('ずれの大きい順に「〜く、〜い」でつなぐ', () => {
    expect(headline({ meanTemp: 18, precip: 64, sunshine: 60 }, avg, seasonWords(20))).toBe('肌寒く、日差しが少ない');
    expect(headline({ meanTemp: 19.5, precip: 64, sunshine: 40 }, avg, seasonWords(20))).toBe('日差しが少ない');
    expect(headline({ meanTemp: 18.8, precip: 64, sunshine: 50 }, avg, seasonWords(20))).toBe('日差しが少なく、肌寒い');
    expect(headline({ meanTemp: 22, precip: 64, sunshine: 60 }, avg, seasonWords(20))).toBe('暖かく、日差しが少ない');
    expect(headline({ meanTemp: 20, precip: 120, sunshine: 80 }, avg, seasonWords(20))).toBe('雨が多い');
  });
});

describe('今の節気の途中経過カード', () => {
  function yearsMap(): DayMap {
    const map: DayMap = new Map();
    for (let y = 2021; y <= 2026; y++) fill(map, `${y}-01-01`, `${y}-12-31`, { tempMean: 20, tempMax: 25, tempMin: 15, precip: 1, sunshine: 5 });
    return map;
  }

  it('currentSekkiRange は今の節気の初日〜最終日（秋分 9/23〜10/7）', () => {
    expect(currentSekkiRange('2026-10-01')).toEqual({ index: 15, name: '秋分', start: '2026-09-23', end: '2026-10-07', days: 15 });
  });

  it('初日は集計がまだ0日なので出さない', () => {
    expect(buildProgressForRange(yearsMap(), currentSekkiRange('2026-09-23'), '2026-09-23')).toBeNull();
  });

  it('昨日までの値で、比較なし・コメントなし', () => {
    const p = buildProgressForRange(yearsMap(), currentSekkiRange('2026-10-01'), '2026-10-01')!;
    expect(p.progress).toEqual({ day: 9, total: 15 });
    expect(p.periodLabel).toBe('9/23〜10/7（9日目／15日間）');
    expect(p.headline).toBe('');
    expect(p.daily).toHaveLength(8); // 9/23〜9/30
    expect(p.rows.map(r => [r.label, r.value, r.vsLastYear, r.vsAvg])).toEqual([
      ['平均気温', '20.0℃', null, null],
      ['雨の量', '8mm', null, null],
      ['日照', '40h', null, null],
    ]);
  });

  it('最終日も昨日まで、翌日（次の節気の初日）に完成したふりかえりになる', () => {
    const last = buildProgressForRange(yearsMap(), currentSekkiRange('2026-10-07'), '2026-10-07')!;
    expect(last.progress).toEqual({ day: 15, total: 15 });
    expect(last.daily).toHaveLength(14);
    const next = computeSeasonView(yearsMap(), '2026-10-08', DEFAULT_PACE_OPTIONS)!;
    expect(next.reviews.at(-1)?.range.name).toBe('秋分');
    expect(next.reviews.at(-1)?.progress).toBeNull();
    expect(next.reviews.at(-1)?.daily).toHaveLength(15);
  });

  it('computeSeasonView は途中経過を一番右に加え、帯の下のカード（review）は終わった節気のまま', () => {
    const v = computeSeasonView(yearsMap(), '2026-10-01', DEFAULT_PACE_OPTIONS)!;
    expect(v.reviews.at(-1)?.range.name).toBe('秋分');
    expect(v.reviews.at(-1)?.progress).not.toBeNull();
    expect(v.reviews.at(-2)?.range.name).toBe('白露');
    expect(v.review?.range.name).toBe('白露');
  });
});
