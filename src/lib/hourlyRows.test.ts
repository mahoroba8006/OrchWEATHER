import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_HIDDEN_HOURLY_ROWS,
  HOURLY_ROW_OPTIONS,
  loadGuestHiddenHourlyRows,
  parseHiddenHourlyRows,
  sanitizeHiddenHourlyRows,
} from './hourlyRows';

afterEach(() => localStorage.clear());

describe('hourlyRows', () => {
  it('選択肢は紫外線指数を含む14項目で、おすすめの非表示は7項目', () => {
    expect(HOURLY_ROW_OPTIONS).toHaveLength(14);
    expect(HOURLY_ROW_OPTIONS[1]).toEqual({ key: 'temperature', label: '気温' });
    expect(DEFAULT_HIDDEN_HOURLY_ROWS).toEqual(['windGusts', 'pressure', 'humidity', 'vpd', 'dewPoint', 'cape', 'freezing']);
  });

  it('sanitize は未知のキー・重複・文字列以外を捨てる', () => {
    expect(sanitizeHiddenHourlyRows(['pressure', 'bogus', 'pressure', 3, 'uv'])).toEqual(['pressure', 'uv']);
  });

  it('parse は配列なら整形し、配列でなければおすすめに戻す', () => {
    expect(parseHiddenHourlyRows(['windDir', 'x'])).toEqual(['windDir']);
    expect(parseHiddenHourlyRows([])).toEqual([]);
    expect(parseHiddenHourlyRows(undefined)).toEqual(DEFAULT_HIDDEN_HOURLY_ROWS);
    expect(parseHiddenHourlyRows('pressure')).toEqual(DEFAULT_HIDDEN_HOURLY_ROWS);
  });

  it('ゲスト用の読み込みは、未保存・壊れた値ならおすすめになる', () => {
    expect(loadGuestHiddenHourlyRows()).toEqual(DEFAULT_HIDDEN_HOURLY_ROWS);
    localStorage.setItem('hiddenHourlyRows', '{bad');
    expect(loadGuestHiddenHourlyRows()).toEqual(DEFAULT_HIDDEN_HOURLY_ROWS);
    localStorage.setItem('hiddenHourlyRows', JSON.stringify(['cape', 'zzz']));
    expect(loadGuestHiddenHourlyRows()).toEqual(['cape']);
  });
});

describe('紫外線指数', () => {
  it('表示可否を選べる項目に含まれ、先頭（表の並び順）にあり、初期状態は表示', () => {
    expect(HOURLY_ROW_OPTIONS[0]).toEqual({ key: 'uv', label: '紫外線指数' });
    expect(sanitizeHiddenHourlyRows(['uv'])).toEqual(['uv']);
    expect(DEFAULT_HIDDEN_HOURLY_ROWS).not.toContain('uv');
  });
});
