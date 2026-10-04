import { describe, expect, it } from 'vitest';
import { cssApplied } from './cssGuard';

describe('cssApplied', () => {
  it(':root のトークンが取れれば当たっている、取れなければ当たっていない', () => {
    document.documentElement.style.removeProperty('--accent');
    expect(cssApplied()).toBe(false);
    document.documentElement.style.setProperty('--accent', '#0E6B65');
    expect(cssApplied()).toBe(true);
    document.documentElement.style.removeProperty('--accent');
  });
});
