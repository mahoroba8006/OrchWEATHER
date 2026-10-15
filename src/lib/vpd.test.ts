import { describe, it, expect } from 'vitest';
import { calcVPD } from './vpd';

describe('calcVPD', () => {
  it('30℃・50% は約15.17 g/m³', () => {
    expect(calcVPD(30, 50)).toBeCloseTo(15.17, 1);
  });
  it('湿度100%なら0', () => {
    expect(calcVPD(20, 100)).toBeCloseTo(0, 10);
  });
  it('湿度が低いほど大きい', () => {
    expect(calcVPD(25, 30)).toBeGreaterThan(calcVPD(25, 60));
  });
});
