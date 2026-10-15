import { describe, expect, it } from 'vitest';
import { dailyGdd, excessAboveUpper, gddLabel, parseUpperTemp, parseUpperTemps } from './gdd';

describe('excessAboveUpper', () => {
  it('最高気温が上限以下なら 0', () => {
    expect(excessAboveUpper(33, 20, 33)).toBe(0);
    expect(excessAboveUpper(30, 20, 33)).toBe(0);
  });
  it('最高36・最低24・上限33 で約0.654', () => {
    expect(excessAboveUpper(36, 24, 33)).toBeCloseTo(0.654, 3);
    expect(dailyGdd({ tempMean: 30, tempMax: 36, tempMin: 24 }, 10, 33)).toBeCloseTo(19.346, 3);
  });
  it('最低気温が上限以上なら 日平均 − 上限', () => {
    expect(excessAboveUpper(38, 34, 33)).toBe(3);
  });
  it('上限なし・最高/最低が不正なら差し引かない', () => {
    expect(excessAboveUpper(36, 24, null)).toBe(0);
    expect(excessAboveUpper(NaN, 24, 33)).toBe(0);
    expect(excessAboveUpper(36, undefined as unknown as number, 33)).toBe(0);
    expect(dailyGdd({ tempMean: 30, tempMax: NaN, tempMin: NaN }, 10, 33)).toBe(20);
    expect(dailyGdd({ tempMean: 30, tempMax: undefined as unknown as number, tempMin: 24 }, 10, 33)).toBe(20);
  });
});

describe('dailyGdd', () => {
  it('上限なしなら旧式 max(0, 日平均 − 基準) と完全に一致', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 2000; i++) {
      const tempMin = rnd() * 50 - 15;
      const tempMax = tempMin + rnd() * 20;
      const tempMean = rnd() * 50 - 15;
      const base = rnd() * 20;
      expect(dailyGdd({ tempMean, tempMax, tempMin }, base, null)).toBe(Math.max(0, tempMean - base));
    }
  });
  it('上限ありでも負にならない', () => {
    expect(dailyGdd({ tempMean: 5, tempMax: 40, tempMin: 0 }, 10, 30)).toBe(0);
  });
});

describe('parseUpperTemp', () => {
  it('20〜50 は有効、範囲外・数値以外は null', () => {
    expect(parseUpperTemp(20)).toBe(20);
    expect(parseUpperTemp(50)).toBe(50);
    expect(parseUpperTemp(33.5)).toBe(33.5);
    expect(parseUpperTemp(19.9)).toBeNull();
    expect(parseUpperTemp(50.1)).toBeNull();
    expect(parseUpperTemp('33')).toBeNull();
    expect(parseUpperTemp(null)).toBeNull();
    expect(parseUpperTemp(undefined)).toBeNull();
    expect(parseUpperTemp(NaN)).toBeNull();
  });
  it('組で読む。配列でなければ両方 null', () => {
    expect(parseUpperTemps([33, null])).toEqual([33, null]);
    expect(parseUpperTemps([10, '40'])).toEqual([null, null]);
    expect(parseUpperTemps(undefined)).toEqual([null, null]);
    expect(parseUpperTemps('x')).toEqual([null, null]);
  });
});

describe('gddLabel', () => {
  it('上限なしは基準だけ、ありは上限も付ける', () => {
    expect(gddLabel(10, null)).toBe('10℃');
    expect(gddLabel(10, 33)).toBe('10℃・上限33℃');
  });
});
