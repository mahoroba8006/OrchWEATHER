import { describe, expect, it } from 'vitest';
import { SEKKI, sekkiForDate, solarLongitude } from './sekki';

/** JST の正午を表す Date */
const jstNoon = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 3, 0, 0));

describe('data', () => {
  it('has 24 sekki with 3 kou each (72 total), all with readings', () => {
    expect(SEKKI).toHaveLength(24);
    for (const s of SEKKI) {
      expect(s.kou).toHaveLength(3);
      expect(s.reading.length).toBeGreaterThan(0);
      for (const k of s.kou) {
        expect(k.name.length).toBeGreaterThan(0);
        expect(k.reading.length).toBeGreaterThan(0);
      }
    }
    expect(SEKKI[0].name).toBe('立春');
    expect(SEKKI[15].name).toBe('秋分');
    expect(SEKKI[15].kou[1].name).toBe('蟄虫坏戸');
  });
});

describe('solarLongitude', () => {
  it('is ~0° at the 2026 March equinox (2026-03-20 14:46 UTC)', () => {
    const lon = solarLongitude(new Date(Date.UTC(2026, 2, 20, 14, 46)));
    const diff = Math.min(lon, 360 - lon);
    expect(diff).toBeLessThan(0.05);
  });
  it('is ~180° at the 2026 September equinox (2026-09-23 00:05 UTC)', () => {
    expect(Math.abs(solarLongitude(new Date(Date.UTC(2026, 8, 23, 0, 5))) - 180)).toBeLessThan(0.05);
  });
});

describe('sekkiForDate (JST calendar day)', () => {
  it.each([
    [2026, 2, 3, '大寒'], [2026, 2, 4, '立春'],
    [2026, 3, 19, '啓蟄'], [2026, 3, 20, '春分'],
    [2026, 6, 20, '芒種'], [2026, 6, 21, '夏至'],
    [2026, 9, 22, '白露'], [2026, 9, 23, '秋分'],
    [2026, 12, 21, '大雪'], [2026, 12, 22, '冬至'],
  ] as const)('%i-%i-%i -> %s', (y, m, d, name) => {
    expect(sekkiForDate(jstNoon(y, m, d)).name).toBe(name);
  });

  it('2026-10-01 is 秋分 次候 蟄虫坏戸', () => {
    const s = sekkiForDate(jstNoon(2026, 10, 1));
    expect(s.name).toBe('秋分');
    expect(s.kouIndex).toBe(15 * 3 + 1);
    expect(s.kou.name).toBe('蟄虫坏戸');
    expect(s.kou.reading).toBe('むしかくれてとをふさぐ');
  });

  it('uses the JST date even late at night UTC-wise (2026-09-22 23:30 JST is still 白露)', () => {
    expect(sekkiForDate(new Date(Date.UTC(2026, 8, 22, 14, 30))).name).toBe('白露');
  });
});
