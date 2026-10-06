import { describe, expect, it } from 'vitest';
import { createParticles, kindFor, particleCount, stepParticle } from './particles';

describe('kindFor', () => {
  it('割合に従って種類を決める', () => {
    expect(kindFor(0.1, [1, 0, 0, 0])).toBe('petal');
    expect(kindFor(0.4, [0, 0.5, 0.5, 0])).toBe('light');
    expect(kindFor(0.6, [0, 0.5, 0.5, 0])).toBe('leaf');
    expect(kindFor(0.99, [0, 0, 0, 1])).toBe('snow');
  });
  it('割合が全部 0 なら描かない（null）', () => {
    expect(kindFor(0.5, [0, 0, 0, 0])).toBeNull();
  });
});

describe('createParticles', () => {
  it('ゆっくり（落下速度 0.18〜0.5）で画面内に置く', () => {
    const ps = createParticles(5, 400, 800, () => 0.5);
    expect(ps).toHaveLength(5);
    expect(ps[0]).toMatchObject({ x: 200, y: 400 });
    expect(ps[0].v).toBeCloseTo(0.34, 10);
  });
});

describe('stepParticle', () => {
  it('花びらは下へ落ち、画面の下に出たら上へ戻る', () => {
    const q = { x: 10, y: 100, v: 0.3, a: 0, s: 1, k: 0 };
    stepParticle(q, 'petal', 400, 800, () => 0.5);
    expect(q.y).toBeCloseTo(100.3, 5);
    q.y = 821;
    stepParticle(q, 'petal', 400, 800, () => 0.5);
    expect(q.y).toBe(-20);
    expect(q.x).toBe(200);
  });
  it('光の粒はゆっくり昇る', () => {
    const q = { x: 10, y: 100, v: 0.4, a: 0, s: 1, k: 0 };
    stepParticle(q, 'light', 400, 800);
    expect(q.y).toBeLessThan(100);
  });
});

describe('particleCount', () => {
  it('スマホは少なめ', () => {
    expect(particleCount(375)).toBe(16);
    expect(particleCount(1280)).toBe(26);
  });
});
