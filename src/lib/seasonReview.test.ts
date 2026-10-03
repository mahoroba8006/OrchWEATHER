import { describe, expect, it } from 'vitest';
import {
  currentSekkiStart, daysBetween, isInCardWindow, previousSekkiRange, requiredYears, shiftYear,
} from './seasonReview';

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
