// src/components/lp/chapters.test.tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
const logLpDetailOpen = vi.fn();
const logLpMoyoToggle = vi.fn();
vi.mock('../../lib/analytics', () => ({
  logLpChapterView: vi.fn(),
  logLpDetailOpen: (s: string) => logLpDetailOpen(s),
  logLpMoyoToggle: (m: string) => logLpMoyoToggle(m),
}));
import { LpHero } from './LpHero';
import { HunchChapter } from './HunchChapter';
import { sekkiForDate } from '../../lib/sekki';

beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('LpHero', () => {
  it('見出し・添える言葉・今日の節気・ボタン下の一行', () => {
    render(<LpHero loading={false} error={null} onLogin={() => {}} onTryGuest={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: '「今年は遅い」が、数字で見える。' })).toBeTruthy();
    expect(screen.getByText('勘を、数字で裏づける。')).toBeTruthy();
    expect(screen.getByText(sekkiForDate(new Date()).name)).toBeTruthy();
    expect(screen.getByText('Googleアカウントですぐにログイン。無料で利用できます')).toBeTruthy();
    expect(screen.getByText('あなたの地域の気温・雨・日照を、去年・5年平均と比べる。')).toBeTruthy();
    expect(screen.getByText('東京・2026年10月5日時点')).toBeTruthy();
  });
  it('今日の節気は見出しより前に置く', () => {
    const { container } = render(<LpHero loading={false} error={null} onLogin={() => {}} onTryGuest={() => {}} />);
    const copy = container.querySelector('.lp-hero__copy')!;
    expect(copy.firstElementChild!.className).toBe('lp-hero__today');
  });
});

describe('HunchChapter（動きを減らす設定＝縦に並べた静止表示）', () => {
  it('3つの勘と数字、結論を出す', () => {
    const { container } = render(<HunchChapter />);
    expect(screen.getByText('今年は、遅い気がする。')).toBeTruthy();
    expect(screen.getByText('雨、多すぎないか。')).toBeTruthy();
    expect(screen.getByText('お日さま、足りてない。')).toBeTruthy();
    expect(container.textContent).toContain('5.9');
    expect(screen.getByRole('heading', { name: '勘を、数字で裏づける。' })).toBeTruthy();
    expect(screen.getByText('東京・2026年の実績')).toBeTruthy();
    // 静止表示では3つの勘をすでに並べているので、結論の下の3行は重ねて出さない
    expect(container.querySelector('.lp-hunch__summary')).toBeNull();
  });
});
