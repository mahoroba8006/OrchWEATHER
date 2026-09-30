import { describe, expect, it } from 'vitest';
import { pressScale, springs } from './motion';

describe('motion tokens', () => {
  it('defines exactly the three shared springs', () => {
    expect(Object.keys(springs).sort()).toEqual(['enter', 'move', 'press']);
    for (const s of Object.values(springs)) expect(s.type).toBe('spring');
  });

  it('orders stiffness press > move > enter (fast feedback, calm entrance)', () => {
    expect(springs.press.stiffness).toBeGreaterThan(springs.move.stiffness);
    expect(springs.move.stiffness).toBeGreaterThan(springs.enter.stiffness);
  });

  it('press scale is a subtle shrink', () => {
    expect(pressScale).toBeGreaterThanOrEqual(0.94);
    expect(pressScale).toBeLessThan(1);
  });
});
