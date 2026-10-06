// src/components/lp/primitives.test.tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useVisibility } from './hooks';
import { CountUp, CtaPair, LineReveal } from './primitives';
import { publishScene, subscribeScene } from './sceneStore';

const reduce = true;
beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LineReveal', () => {
  it('行に分けて表示し、見出しの名前は行をつなげた文', () => {
    render(<LineReveal as="h1" lines={['「今年は遅い」が、', '数字で見える。']} />);
    expect(screen.getByRole('heading', { level: 1, name: '「今年は遅い」が、数字で見える。' })).toBeTruthy();
  });
});

describe('CountUp', () => {
  it('動きを減らす設定では最終の値をすぐ出す', () => {
    const { container } = render(<CountUp to={5.9} decimals={1} />);
    expect(container.textContent).toContain('5.9');
  });
});

describe('CtaPair', () => {
  it('2つのボタンは同じ見た目で、それぞれの処理を呼ぶ', () => {
    const onLogin = vi.fn();
    const onTryGuest = vi.fn();
    render(<CtaPair loading={false} onLogin={onLogin} onTryGuest={onTryGuest} />);
    const guest = screen.getByRole('button', { name: /ログインせずに試す/ });
    const google = screen.getByRole('button', { name: /Googleで始める/ });
    expect(guest.className).toBe(google.className);
    fireEvent.click(guest);
    fireEvent.click(google);
    expect(onTryGuest).toHaveBeenCalled();
    expect(onLogin).toHaveBeenCalled();
  });
});

describe('useVisibility', () => {
  it('画面外に出ると visible は false に戻り、seen は true のまま', () => {
    let fire: (v: boolean) => void = () => {};
    const Orig = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        fire = (v) => cb([{ isIntersecting: v } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    function Probe() {
      const [ref, visible, seen] = useVisibility<HTMLDivElement>();
      return <div ref={ref}>{`${visible}/${seen}`}</div>;
    }
    const { container } = render(<Probe />);
    act(() => fire(true));
    expect(container.textContent).toBe('true/true');
    act(() => fire(false));
    expect(container.textContent).toBe('false/true');
    globalThis.IntersectionObserver = Orig;
  });
});

describe('sceneStore', () => {
  it('登録した時点の値と、その後の値を受け取る', () => {
    publishScene(0.4);
    const got: number[] = [];
    const off = subscribeScene((p) => got.push(p));
    publishScene(0.6);
    off();
    publishScene(0.9);
    expect(got).toEqual([0.4, 0.6]);
  });
});
