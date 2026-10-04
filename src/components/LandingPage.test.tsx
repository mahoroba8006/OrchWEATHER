import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ GoogleAuthProvider: class {}, signInWithPopup: vi.fn(), signInWithRedirect: vi.fn() }));
const logLpDetailOpen = vi.fn();
vi.mock('../lib/analytics', () => ({ logLogin: vi.fn(), logLpDetailOpen: (s: string) => logLpDetailOpen(s) }));

import { LandingPage } from './LandingPage';

beforeAll(() => {
  // jsdom に無い API（Reveal / 空の演出が使う）
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LandingPage', () => {
  it('最初の画面の見出しは「『今年は遅い』が、数字で見える。」', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('『今年は遅い』が、数字で見える。');
  });

  it('最初の画面のボタン2つは同じ見た目（どちらも lp-cta、ghost なし）', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    const guest = screen.getAllByRole('button', { name: /ログインせずに試す/ })[0];
    const google = screen.getAllByRole('button', { name: /Googleで始める/ })[0];
    expect(guest.className).toBe(google.className);
    expect(guest.className).not.toContain('ghost');
  });

  it('各章の見出しがある', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    for (const h of ['二十四節気ごとに、今年の半月を一枚に。', '去年と、あの場所と、並べて見える。', '今日の作業、やるかやめるかすぐ決まる。']) {
      expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    }
    expect(screen.getByText('暦は、農の時計だった。')).toBeTruthy();
  });

  it('AI の章と AI の行は出さない', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    expect(container.textContent).not.toMatch(/AI/);
  });

  it('「平年」と言わない', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    expect(container.textContent).not.toMatch(/平年/);
  });

  it('詳しく読む層は折りたたみで、開くと GA4 に記録する', () => {
    const { container } = render(<LandingPage onTryGuest={() => {}} />);
    const details = container.querySelectorAll('details.lp-details');
    expect(details.length).toBe(4);
    const faq = container.querySelector<HTMLDetailsElement>('details[data-section="faq"]')!;
    faq.open = true;
    fireEvent(faq, new Event('toggle'));
    expect(logLpDetailOpen).toHaveBeenCalledWith('faq');
  });

  it('料金表の有料列は「※予定」を残す', () => {
    render(<LandingPage onTryGuest={() => {}} />);
    expect(screen.getByText('※予定')).toBeTruthy();
  });

  it('「ログインせずに試す」で onTryGuest を呼ぶ', () => {
    const onTryGuest = vi.fn();
    render(<LandingPage onTryGuest={onTryGuest} />);
    fireEvent.click(screen.getAllByRole('button', { name: /ログインせずに試す/ })[0]);
    expect(onTryGuest).toHaveBeenCalled();
  });
});
