// src/components/lp/HunchChapter.motion.test.tsx
// 動きのある表示（見せ場）でも、読み上げには3つの勘と数字がそろって届く
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/analytics', () => ({ logLpChapterView: vi.fn() }));
vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useReduced: () => false,
}));
import { HunchChapter } from './HunchChapter';

beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('HunchChapter（動きのある表示）', () => {
  it('見せ場は読み上げず、3つの勘と比較結果・出典を読み上げ用にまとめて出す', () => {
    const { container } = render(<HunchChapter />);
    expect(container.querySelector('.lp-hunch__stage')!.getAttribute('aria-hidden')).toBe('true');
    // 章の見出しは読み上げの木に1つだけ
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '勘を、数字で裏づける。' })).toBeTruthy();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      '今年は、遅い気がする。積算温度：去年より18日遅い',
      '雨、多すぎないか。白露の雨：5年平均の5.9倍',
      'お日さま、足りてない。白露の日照：5年平均より64時間少ない',
    ]);
    expect(screen.getByText('東京・2026年の実績')).toBeTruthy();
  });
});
