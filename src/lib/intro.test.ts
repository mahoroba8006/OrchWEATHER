import { describe, expect, it } from 'vitest';
import { hasIntroPlayed, markIntroPlayed, resetIntroForTest } from './intro';

describe('intro', () => {
  it('starts false, becomes true after mark, and resets', () => {
    resetIntroForTest();
    expect(hasIntroPlayed()).toBe(false);
    markIntroPlayed();
    expect(hasIntroPlayed()).toBe(true);
    resetIntroForTest();
    expect(hasIntroPlayed()).toBe(false);
  });
});
