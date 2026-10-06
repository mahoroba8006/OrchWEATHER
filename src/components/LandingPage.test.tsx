import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ GoogleAuthProvider: class {}, signInWithPopup: vi.fn(), signInWithRedirect: vi.fn() }));
vi.mock('../lib/analytics', () => ({ logLogin: vi.fn(), logLpDetailOpen: vi.fn(), logLpChapterView: vi.fn(), logLpMoyoToggle: vi.fn() }));

import { LandingPage } from './LandingPage';

beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LandingPage', () => {
  it('最初の画面の見出しは「「今年は遅い」が、数字で見える。」', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label')).toBe('「今年は遅い」が、数字で見える。');
  });

  it('7つの章が、空の進み具合の順に並ぶ', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    const ps = Array.from(container.querySelectorAll<HTMLElement>('[data-scene]')).map((el) => Number(el.dataset.scene));
    expect(ps).toEqual([0, 0.1, 0.27, 0.4, 0.47, 0.64, 0.88]);
  });

  it('ボタンは最初と最後の2か所だけ', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getAllByRole('button', { name: /ログインせずに試す/ })).toHaveLength(2);
  });

  it('「AI」「平年」と言わない', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    expect(container.textContent).not.toMatch(/AI|平年/);
  });

  it('「ログインせずに試す」で onTryGuest を呼ぶ', () => {
    const onTryGuest = vi.fn();
    render(<LandingPage onTryGuest={onTryGuest} />);
    fireEvent.click(screen.getAllByRole('button', { name: /ログインせずに試す/ })[0]);
    expect(onTryGuest).toHaveBeenCalled();
  });
});
