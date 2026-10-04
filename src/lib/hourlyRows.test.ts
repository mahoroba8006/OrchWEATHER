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
  it('選択肢は13項目で、おすすめの非表示は気圧・飽差・露点・CAPE・0℃層高度', () => {
    expect(HOURLY_ROW_OPTIONS).toHaveLength(13);
    expect(HOURLY_ROW_OPTIONS[0]).toEqual({ key: 'temperature', label: '気温' });
    expect(DEFAULT_HIDDEN_HOURLY_ROWS).toEqual(['pressure', 'vpd', 'dewPoint', 'cape', 'freezing']);
  });

  it('sanitize は未知のキー・重複・文字列以外を捨てる', () => {
    expect(sanitizeHiddenHourlyRows(['pressure', 'bogus', 'pressure', 3, 'uv'])).toEqual(['pressure']);
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
