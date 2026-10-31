import { describe, expect, it } from 'vitest';
import { modeCode, selectCode } from './wmoSeverity';

const rep = (code: number, n: number) => Array<number>(n).fill(code);

describe('modeCode（おおむね）', () => {
  it('降っていない時間（晴れ＋曇り）が長ければ、雨の時間がまとまっていても降っていない方（高山村 10/31: 晴れ18・霧雨弱6）', () => {
    expect(modeCode([...rep(1, 10), ...rep(0, 8), ...rep(51, 6)])).toBe(1);
  });

  it('晴れと曇りに分かれても合わせて数える（大阪 11/02: 晴れ8・曇り7・雨9 → 晴れ）', () => {
    expect(modeCode([...rep(0, 8), ...rep(3, 7), ...rep(61, 9)])).toBe(0);
  });

  it('降っている時間が長ければ、雨が強さ別のコードに分かれても雨。絵は雨の中で最多のコード', () => {
    expect(modeCode([...rep(1, 8), ...rep(2, 2), ...rep(61, 7), ...rep(53, 3), ...rep(55, 3), ...rep(51, 1)])).toBe(61);
  });

  it('降っている時間と降っていない時間が同じなら降っている方（大阪 10/25 午前: 晴れ4・雨4）', () => {
    expect(modeCode([...rep(0, 4), ...rep(63, 4)])).toBe(63);
  });

  it('降っていない方の中では最多の種類、同数なら曇り', () => {
    expect(modeCode([...rep(0, 3), ...rep(1, 3), ...rep(3, 5), ...rep(61, 1)])).toBe(1); // 晴れ6 > 曇り5
    expect(modeCode([...rep(0, 12), ...rep(3, 12)])).toBe(3);
  });

  it('降っている方の中では最多の種類、同数なら深刻な方（雪）', () => {
    expect(modeCode([...rep(0, 2), ...rep(61, 4), ...rep(71, 2)])).toBe(61);
    expect(modeCode([...rep(0, 2), ...rep(61, 3), ...rep(71, 3)])).toBe(71);
    expect(modeCode([...rep(61, 5), ...rep(95, 2), 0])).toBe(61);
  });

  it('同じ種類の中で同数なら深刻なコード', () => {
    expect(modeCode([...rep(51, 3), ...rep(61, 3), ...rep(0, 2)])).toBe(61);
  });

  it('空の配列は null・ねんのためは変わらず最も悪いコード', () => {
    expect(modeCode([])).toBeNull();
    expect(selectCode([0, 0, 61, 95, 0], 'severity')).toBe(95);
    expect(selectCode([0, 0, 61, 95, 0], 'frequency')).toBe(0);
  });
});
