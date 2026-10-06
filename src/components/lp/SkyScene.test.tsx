// src/components/lp/SkyScene.test.tsx
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/analytics', () => ({ logLpChapterView: vi.fn() }));
import { SkyScene } from './SkyScene';
import { LpNav, SekkiDial } from './LpNav';
import { publishScene } from './sceneStore';

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('SkyScene', () => {
  it('飾りなので読み上げない。動きを減らす設定では舞うものを描かない', () => {
    const { container } = render(<SkyScene />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('lp-scene--still');
    expect(container.querySelector('canvas')).toBeNull();
  });
});

describe('LpNav / SekkiDial', () => {
  it('背景の進み具合に合わせて時刻と節気を出す', () => {
    const { container } = render(<><LpNav loading={false} onLogin={() => {}} /><SekkiDial /></>);
    act(() => publishScene(0.62));
    expect(container.querySelector('.lp-nav__clock')!.textContent).toBe('17:30　白露');
    expect(container.querySelector('.lp-dial .is-on')!.textContent).toBe('白露');
  });
});
