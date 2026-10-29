import { describe, expect, it } from 'vitest';
import { modeCode, selectCode } from './wmoSeverity';

const rep = (code: number, n: number) => Array<number>(n).fill(code);

describe('modeCode（概況でみる）', () => {
  it('雨が強さ別のコードに分かれても、雨の時間が1/4以上なら雨（長野 10/30: 晴れ13・曇り3・雨8）', () => {
    const codes = [...rep(0, 5), ...rep(1, 3), ...rep(2, 5), ...rep(3, 3), ...rep(51, 3), ...rep(61, 3), ...rep(63, 2)];
    expect(modeCode(codes)).toBe(61); // 雨の中で 51・61 が3ずつ → 深刻な 61
  });

  it('雨の種類の中で最多のコードを絵にする（長野 10/26: 主に晴れ8・晴れ時々曇り2・雨14）', () => {
    const codes = [...rep(1, 8), ...rep(2, 2), ...rep(61, 7), ...rep(53, 3), ...rep(55, 3), ...rep(51, 1)];
    expect(modeCode(codes)).toBe(61);
  });

  it('ちょうど1/4（1日24時間のうち6時間・時間帯8時間のうち2時間）は雨', () => {
    expect(modeCode([...rep(0, 18), ...rep(61, 6)])).toBe(61);
    expect(modeCode([...rep(0, 6), ...rep(61, 2)])).toBe(61);
  });

  it('1/4未満なら最多の種類（晴れ系・くもり系はそれぞれまとめて数える）', () => {
    expect(modeCode([...rep(0, 19), ...rep(61, 5)])).toBe(0);
    expect(modeCode([...rep(0, 3), ...rep(1, 3), ...rep(3, 5), ...rep(61, 1)])).toBe(1); // 晴れ6 > くもり5（今は3）
  });

  it('晴れとくもりが同数なら深刻な方（くもり）', () => {
    expect(modeCode([...rep(0, 12), ...rep(3, 12)])).toBe(3);
  });

  it('雨と雪が両方1/4以上なら時間の多い方、同数なら深刻な方（雪）', () => {
    expect(modeCode([...rep(0, 2), ...rep(61, 4), ...rep(71, 2)])).toBe(61);
    expect(modeCode([...rep(0, 4), ...rep(61, 2), ...rep(71, 2)])).toBe(71);
  });

  it('雷は1/4以上で雷、雨より少なければ雨', () => {
    expect(modeCode([...rep(0, 6), ...rep(95, 2)])).toBe(95);
    expect(modeCode([...rep(61, 5), ...rep(95, 2), 0])).toBe(61);
  });

  it('同じ種類の中で同数なら深刻なコード', () => {
    expect(modeCode([...rep(51, 3), ...rep(61, 3), ...rep(0, 2)])).toBe(61);
  });

  it('空の配列は null・リスクでみるは変わらず最も悪いコード', () => {
    expect(modeCode([])).toBeNull();
    expect(selectCode([0, 0, 61, 95, 0], 'severity')).toBe(95);
  });
});
