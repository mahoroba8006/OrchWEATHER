import { describe, expect, it } from 'vitest';
import { celestialAt, mixColor, progressFromAnchors, sceneAt, sekkiIndexAt, starsAt } from './lpScene';

describe('mixColor', () => {
  it('2色を割合で混ぜて rgb() で返す', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)');
    expect(mixColor('#3d4f86', '#000000', 0)).toBe('rgb(61, 79, 134)');
  });
});

describe('sceneAt', () => {
  it('p=0 は夜明けの色、p=1 は冬の夜の色', () => {
    expect(sceneAt(0).skyTop).toBe('rgb(61, 79, 134)');
    expect(sceneAt(1).near).toBe('rgb(177, 192, 207)');
  });
  it('範囲外は端に丸める', () => {
    expect(sceneAt(-1)).toEqual(sceneAt(0));
    expect(sceneAt(2)).toEqual(sceneAt(1));
  });
  it('キーの間は補間する（0 と 0.14 の中間で 6:45）', () => {
    expect(sceneAt(0.07).hour).toBeCloseTo(6.75, 5);
  });
  it('舞うものは 春=花びら・夏=光・秋=葉・冬=雪 が主になる', () => {
    const top = (p: number) => sceneAt(p).weights.indexOf(Math.max(...sceneAt(p).weights));
    expect(top(0.1)).toBe(0);
    expect(top(0.37)).toBe(1);
    expect(top(0.62)).toBe(2);
    expect(top(0.95)).toBe(3);
  });
});

describe('sekkiIndexAt', () => {
  it('p×24 で節気が進み、季節の区切りと一致する', () => {
    expect(sekkiIndexAt(0)).toBe(0); // 立春
    expect(sekkiIndexAt(0.37)).toBe(8); // 芒種（昼・夏）
    expect(sekkiIndexAt(0.62)).toBe(14); // 白露（夕焼け・秋）
    expect(sekkiIndexAt(1)).toBe(23); // 大寒
    expect(sekkiIndexAt(0.1)).toBeLessThan(6);
    expect(sekkiIndexAt(0.4)).toBeGreaterThanOrEqual(6);
    expect(sekkiIndexAt(0.4)).toBeLessThan(12);
    expect(sekkiIndexAt(0.6)).toBeGreaterThanOrEqual(12);
    expect(sekkiIndexAt(0.6)).toBeLessThan(18);
    expect(sekkiIndexAt(0.9)).toBeGreaterThanOrEqual(18);
  });
});

describe('celestialAt / starsAt', () => {
  it('太陽は左下から昇り、昼に最も高く、夕方以降は月になる', () => {
    // 夜明けと夕焼けは丘の向こう（画面の下 88% の高さ）にあり、最初の画面の文字の後ろに来ない
    expect(celestialAt(0)).toEqual({ kind: 'sun', x: 8, y: 88, height: 0 });
    expect(celestialAt(0.35).height).toBeCloseTo(1, 5);
    expect(celestialAt(0.35).y).toBeCloseTo(12, 5);
    expect(celestialAt(0.8).kind).toBe('moon');
  });
  it('星は夕方の終わりから出て、夜に出そろう', () => {
    expect(starsAt(0.5)).toBe(0);
    expect(starsAt(0.86)).toBeCloseTo(1, 5);
  });
});

describe('progressFromAnchors', () => {
  const anchors = [{ top: 0, p: 0 }, { top: 1000, p: 0.1 }, { top: 3000, p: 0.27 }];
  it('章と章の間を直線で補間し、最後の章からページ末尾までは 1 へ向かう', () => {
    expect(progressFromAnchors(anchors, -5, 5000)).toBe(0);
    expect(progressFromAnchors(anchors, 500, 5000)).toBeCloseTo(0.05, 5);
    expect(progressFromAnchors(anchors, 2000, 5000)).toBeCloseTo(0.185, 5);
    expect(progressFromAnchors(anchors, 4000, 5000)).toBeCloseTo(0.635, 5);
  });
  it('snap=true（動きを減らす設定）では今いる章の p で止める', () => {
    expect(progressFromAnchors(anchors, 2000, 5000, true)).toBe(0.1);
  });
  it('章が無ければ 0', () => {
    expect(progressFromAnchors([], 100, 1000)).toBe(0);
  });
});
