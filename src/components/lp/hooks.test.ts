import { describe, expect, it } from 'vitest';
import { stickyProgress } from './hooks';

function section(top: number, height: number, stageHeight?: number): HTMLElement {
  const el = document.createElement('section');
  el.getBoundingClientRect = () => ({ top, height } as DOMRect);
  if (stageHeight !== undefined) {
    const stage = document.createElement('div');
    stage.setAttribute('data-sticky-stage', '');
    Object.defineProperty(stage, 'offsetHeight', { value: stageHeight });
    el.appendChild(stage);
  }
  return el;
}

describe('stickyProgress', () => {
  it('止める区間の長さは「入れ物の高さ − 止まる枠（stage）の実測の高さ」で測る', () => {
    // 区間 1800px・枠 650px → 移動できるのは 1150px。870px 進んだら 870/1150
    expect(stickyProgress(section(-870, 1800, 650))).toBeCloseTo(870 / 1150, 6);
  });
  it('アドレスバーの出入りで innerHeight が変わっても、進み具合は変わらない', () => {
    const el = section(-870, 1800, 650);
    const a = stickyProgress(el);
    Object.defineProperty(window, 'innerHeight', { value: 750, configurable: true });
    expect(stickyProgress(el)).toBe(a);
    Object.defineProperty(window, 'innerHeight', { value: 650, configurable: true });
    expect(stickyProgress(el)).toBe(a);
  });
  it('枠が見つからなければ innerHeight で測る', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    expect(stickyProgress(section(-500, 1800))).toBeCloseTo(0.5, 6);
  });
});
