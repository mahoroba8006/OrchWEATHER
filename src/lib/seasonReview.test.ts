import { describe, expect, it } from 'vitest';
import {
  buildDayMap, buildSeasonReview, computePaceItems, computeSeasonView, currentSekkiStart, daysBetween, DEFAULT_PACE_OPTIONS, fromForecastPast, headline,
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
    expect(headline({ meanTemp: 24, precip: 38, sunshine: 96 }, avg)).toBe('日差しが多く、雨の少ない半月でした');
  });
  it('1項目だけなら連体形で終える', () => {
    expect(headline({ meanTemp: 25, precip: 64, sunshine: 80 }, avg)).toBe('暑い半月でした');
  });
  it('該当なしは平年並み', () => {
    expect(headline({ meanTemp: 23.5, precip: 60, sunshine: 85 }, avg)).toBe('平年並みの穏やかな半月でした');
  });
  it('5年平均の雨が5mm未満なら雨は判定しない', () => {
    expect(headline({ meanTemp: 23, precip: 20, sunshine: 80 }, { ...avg, precip: 2 })).toBe('平年並みの穏やかな半月でした');
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

  it('期間・見出し・3項目・雨の棒・記録を組み立てる', () => {
    const r = buildSeasonReview(sampleMap(), '2026-10-01')!;
    expect(r.periodLabel).toBe('白露 9/7〜9/22（16日間）');
    expect(r.headline).toBe('日差しが多く、雨の少ない半月でした');
    expect(r.rows).toEqual([
      { label: '平均気温', value: '24.0℃', vsLastYear: { text: '+1.0℃', tone: 'more' }, vsAvg: { text: '+1.0℃', tone: 'more' } },
      { label: '雨の量', value: '38mm', vsLastYear: { text: '6割', tone: 'less' }, vsAvg: { text: '6割', tone: 'less' } },
      { label: '日照', value: '96h', vsLastYear: { text: '+16h', tone: 'more' }, vsAvg: { text: '+16h', tone: 'more' } },
    ]);
    expect(r.rain).toHaveLength(16);
    expect(r.records).toEqual({
      hottest: { date: '2026-09-09', value: 33.2 },
      coolestMorning: { date: '2026-09-21', value: 15.8 },
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
