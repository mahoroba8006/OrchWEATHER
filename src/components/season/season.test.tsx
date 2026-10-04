import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import type { SeasonReview } from '../../lib/seasonReview';

vi.mock('../../lib/analytics', () => ({ logSeasonCardView: vi.fn(), logSeasonCardBrowse: vi.fn() }));
import { logSeasonCardView, logSeasonCardBrowse } from '../../lib/analytics';
import { SeasonPaceTicker } from './SeasonPaceTicker';
import type { PaceItem } from '../../lib/seasonReview';
import type { SeasonState } from '../../hooks/useSeasonReview';
import { SeasonInlineCard, SeasonReviewCard } from './SeasonReviewCard';
import { SeasonReviewCarousel } from './SeasonReviewCarousel';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const review: SeasonReview = {
  range: { index: 14, name: '白露', start: '2026-09-07', end: '2026-09-22', days: 16 },
  periodLabel: '白露 9/7〜9/22（16日間）',
  headline: '日差しが多く、雨の少ない半月でした',
  rows: [
    { label: '平均気温', value: '24.0℃', vsLastYear: { text: '+1.0℃', tone: 'more' }, vsAvg: { text: '+1.0℃', tone: 'more' } },
    { label: '雨の量', value: '38mm', vsLastYear: { text: '6割', tone: 'less' }, vsAvg: { text: '6割', tone: 'less' } },
    { label: '日照', value: '96h', vsLastYear: { text: '+16h', tone: 'more' }, vsAvg: { text: '+16h', tone: 'more' } },
  ],
  rain: [{ date: '2026-09-07', value: 0 }, { date: '2026-09-08', value: 22 }],
  records: {
    hottest: { date: '2026-09-09', value: 33.2 },
    coolestMorning: { date: '2026-09-21', value: 15.8 },
    heavyRain: null,
  },
  avgYears: '2021〜2025年',
};

const paceItems: PaceItem[] = [
  { kind: 'temp', name: '気温', period: 'この30日', text: '去年より+1.0℃・5年平均より+0.4℃' },
  { kind: 'gdd', name: '積算温度', period: '1月1日から・10℃基準', text: '去年より4日遅い・5年平均と同じペース' },
];
// 退場アニメーション中は旧項目が残りうるので、1つになる（切り替えが済む）まで待ってから読む
const shown = (el: Element) => {
  const nodes = el.querySelectorAll('.season-strip__text');
  expect(nodes).toHaveLength(1);
  return nodes[0].textContent;
};
const readyState = (items: PaceItem[]): SeasonState =>
  ({ status: 'ready', view: { paceItems: items, review: null, reviews: [], showCard: false } });

describe('SeasonPaceTicker', () => {
  it('loading は骨組み', () => {
    renderWithMotion(<SeasonPaceTicker state={{ status: 'loading' }} />);
    expect(screen.getByRole('status', { name: '季節のあしどりを集計中' })).toBeTruthy();
  });
  it('hidden・項目なしは何も描かない', () => {
    const a = renderWithMotion(<SeasonPaceTicker state={{ status: 'hidden' }} />);
    expect(a.container.textContent).toBe('');
    cleanup();
    const b = renderWithMotion(<SeasonPaceTicker state={readyState([])} />);
    expect(b.container.textContent).toBe('');
  });
  it('ready は最初の項目を表示し、タップで次へ進んで一周する', async () => {
    renderWithMotion(<SeasonPaceTicker state={readyState(paceItems)} />);
    const btn = screen.getByRole('button', { name: '季節のあしどり 次の項目を表示' });
    const expectShown = (text: string) => waitFor(() => expect(shown(btn)).toBe(text));
    await expectShown('気温去年より+1.0℃・5年平均より+0.4℃');
    act(() => btn.click());
    await expectShown('積算温度去年より4日遅い・5年平均と同じペース');
    act(() => btn.click());
    await expectShown('気温去年より+1.0℃・5年平均より+0.4℃');
  });
  it('8秒ごとに自動で次へ進む（読み終える時間を確保）', () => {
    vi.useFakeTimers();
    try {
      renderWithMotion(<SeasonPaceTicker state={readyState(paceItems)} />);
      // フェイクタイマーでは退場の完了が進まないので、現在位置の点で判定する
      const dots = () => Array.from(document.querySelectorAll('.season-strip__dots i')).findIndex((d) => d.classList.contains('is-current'));
      expect(dots()).toBe(0);
      act(() => { vi.advanceTimersByTime(8000); });
      expect(dots()).toBe(1);
      act(() => { vi.advanceTimersByTime(8000); });
      expect(dots()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('1項目なら自動で進めない', () => {
    vi.useFakeTimers();
    try {
      renderWithMotion(<SeasonPaceTicker state={readyState(paceItems.slice(0, 1))} />);
      act(() => { vi.advanceTimersByTime(20000); });
      expect(shown(screen.getByRole('button'))).toBe('気温去年より+1.0℃・5年平均より+0.4℃');
    } finally {
      vi.useRealTimers();
    }
  });
  it('読み上げ用の一覧に全項目が入る', () => {
    renderWithMotion(<SeasonPaceTicker state={readyState(paceItems)} />);
    const items = screen.getAllByRole('listitem', { hidden: true }).map((li) => li.textContent);
    expect(items).toEqual([
      '気温（この30日）：去年より+1.0℃・5年平均より+0.4℃',
      '積算温度（1月1日から・10℃基準）：去年より4日遅い・5年平均と同じペース',
    ]);
  });
});

describe('SeasonReviewCard', () => {
  it('期間・見出し・表・記録を表示し、まとまった雨なしは「なし」', () => {
    renderWithMotion(<SeasonReviewCard review={review} source="sheet" />);
    expect(screen.getByText('白露 9/7〜9/22（16日間）')).toBeTruthy();
    expect(screen.getByText('日差しが多く、雨の少ない半月でした')).toBeTruthy();
    expect(screen.getByText('38mm')).toBeTruthy();
    expect(screen.getAllByText('6割')).toHaveLength(2);
    expect(screen.getByText('9/9 33.2℃')).toBeTruthy();
    expect(screen.getByText('9/21 15.8℃')).toBeTruthy();
    expect(screen.getByText('なし')).toBeTruthy();
    expect(screen.getByText(/5年平均は2021〜2025年/)).toBeTruthy();
  });
});

describe('カード閲覧の計測', () => {
  // jsdom には IntersectionObserver が無いので、コールバックを手で呼べる偽物を入れる
  let fire: (isIntersecting: boolean) => void = () => {};
  beforeEach(() => {
    vi.mocked(logSeasonCardView).mockClear();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        fire = (isIntersecting) => cb([{ isIntersecting }]);
      }
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('マウントだけでは計測せず、画面に入ったら場所つきで計測する', () => {
    renderWithMotion(<SeasonInlineCard review={review} />);
    expect(logSeasonCardView).not.toHaveBeenCalled();
    act(() => fire(true));
    expect(logSeasonCardView).toHaveBeenCalledWith('inline');
  });

  it('シート内のカードも計測する', () => {
    renderWithMotion(<SeasonReviewCard review={review} source="sheet" />);
    act(() => fire(true));
    expect(logSeasonCardView).toHaveBeenCalledWith('sheet');
  });

  it('IntersectionObserver が無い環境でも落ちない', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    renderWithMotion(<SeasonReviewCard review={review} source="sheet" />);
    expect(logSeasonCardView).not.toHaveBeenCalled();
  });
});

describe('SeasonPaceTicker の表示', () => {
  it('本文の先頭に項目名、見出しに期間を出す', () => {
    renderWithMotion(<SeasonPaceTicker state={{ status: 'ready', view: { paceItems: [{ kind: 'precip', name: '降水量', period: '1月1日から', text: '去年の1.8倍・5年平均の1.4倍' }], review: null, reviews: [], showCard: false } }} />);
    expect(document.querySelector('.season-strip__name')?.textContent).toBe('降水量');
    expect(document.querySelector('.season-strip__label')?.textContent).toBe('季節のあしどり（1月1日から）');
  });
});

describe('SeasonReviewCarousel', () => {
  const names = ['寒露', '秋分', '白露'];
  const reviews = names.map((name, i): SeasonReview => ({ ...review, range: { ...review.range, name, index: 12 + i } }));
  const setScroll = (track: Element, scrollLeft: number, clientWidth = 300) => {
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: clientWidth });
    Object.defineProperty(track, 'scrollLeft', { configurable: true, writable: true, value: scrollLeft });
  };
  beforeEach(() => {
    vi.mocked(logSeasonCardBrowse).mockClear();
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('スライドと点を数だけ描き、最新（最後）を初期表示する', () => {
    const onIndexChange = vi.fn();
    renderWithMotion(<SeasonReviewCarousel reviews={reviews} onIndexChange={onIndexChange} />);
    expect(screen.getAllByRole('group', { name: /^\d\/3 / })).toHaveLength(3);
    const dots = screen.getAllByRole('button', { name: /のふりかえり（\d\/3）/ });
    expect(dots).toHaveLength(3);
    expect(dots[2].getAttribute('aria-current')).toBe('true');
    expect(dots[0].getAttribute('aria-current')).toBeNull();
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it('点を押すとその位置へスクロールする', () => {
    const scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
    renderWithMotion(<SeasonReviewCarousel reviews={reviews} />);
    fireEvent.click(screen.getByRole('button', { name: '寒露のふりかえり（1/3）' }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 0 }));
  });

  it('スクロール位置から現在位置を求め、遡った分を計測する', () => {
    const onIndexChange = vi.fn();
    renderWithMotion(<SeasonReviewCarousel reviews={reviews} onIndexChange={onIndexChange} />);
    const track = screen.getByRole('region', { name: '節気のふりかえり' });
    setScroll(track, 300);
    fireEvent.scroll(track);
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('button', { name: '秋分のふりかえり（2/3）' }).getAttribute('aria-current')).toBe('true');
    expect(logSeasonCardBrowse).toHaveBeenCalledWith(1);
    setScroll(track, 0);
    fireEvent.scroll(track);
    expect(logSeasonCardBrowse).toHaveBeenCalledWith(2);
  });

  it('最新では「次の節気」が無効、「前の節気」は有効', () => {
    renderWithMotion(<SeasonReviewCarousel reviews={reviews} />);
    expect((screen.getByRole('button', { name: '次の節気' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '前の節気' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('1件ならカードだけ（点・矢印なし）', () => {
    renderWithMotion(<SeasonReviewCarousel reviews={reviews.slice(2)} />);
    expect(screen.getByText('日差しが多く、雨の少ない半月でした')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });
});
