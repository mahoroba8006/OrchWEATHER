// src/components/lp/chapters.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { SekkiChapter } from './SekkiChapter';
import { KurabeChapter } from './KurabeChapter';
import { MoyoChapter } from './MoyoChapter';
import { MakerChapter } from './MakerChapter';
import { FinalChapter, LpFooter } from './FinalChapter';
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
    expect(document.querySelector('.lp-hero__note')!.textContent).toBe('Googleアカウントですぐにログイン。無料で利用できます');
    expect(document.querySelector('.lp-hero__use')!.textContent).toBe('あなたの農園の天気が見える。あの年・あの場所との違いが見える。');
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

describe('SekkiChapter', () => {
  it('見出し・縦書きの添え書き・24の節気・ふりかえりカード', () => {
    const { container } = render(<SekkiChapter />);
    expect(screen.getByRole('heading', { name: '二十四節気ごとに、今年の半月を一枚に。' })).toBeTruthy();
    expect(screen.getByText('暦をめくると、畑の季節が見えてくる。')).toBeTruthy();
    expect(container.querySelectorAll('.lp-sekki__tile')).toHaveLength(24);
    expect(screen.getByAltText(/節気のふりかえりカード（処暑）/)).toBeTruthy();
  });
  it('静止表示では、横に流れる帯をキーボードでもスクロールできる', () => {
    render(<SekkiChapter />);
    const rail = screen.getByRole('region', { name: '二十四節気（横にスクロールできます）' });
    expect(rail.getAttribute('tabindex')).toBe('0');
  });
});

describe('KurabeChapter', () => {
  it('見出し・模式図・3つの要点・本物の画面2枚', () => {
    render(<KurabeChapter />);
    expect(screen.getByRole('heading', { name: '去年と、あの場所と、並べて見える。' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /今年の線は去年より18日遅れて伸びる/ })).toBeTruthy();
    expect(screen.getByText('図は模式です。数字は東京・2026年の実績（1月1日から・10℃基準）。')).toBeTruthy();
    for (const t of ['年をまたいで、重ねて比べる', '地点を並べて、違いを比べる', '積算温度を、自動で計算']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /空くらべ/ })).toHaveLength(2);
    expect(document.querySelector('.lp-kurabe__shotlead')!.textContent).toBe('気温、降水量、積算温度、日射量、日照時間、湿度、飽差まで。知りたい値がグラフで、数値で見える。');
  });
});

describe('MoyoChapter', () => {
  it('見出し・雨のことば。最初は「リスクでみる」', () => {
    const { container } = render(<MoyoChapter />);
    expect(screen.getByRole('heading', { name: '今日の作業、やるかやめるかすぐ決まる。' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'リスクでみる' }).getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.lp-moyo__caption')!.textContent).toBe('その時間帯の、いちばん悪い天気');
    // 押されるまでは読み上げない
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe('');
    expect(container.querySelector('.lp-moyo__phone img.is-on')!.getAttribute('src')).toBe('/lp/moyo-risk.webp');
    for (const w of ['ぽつぽつ', 'カッパ？', 'カッパ！']) expect(screen.getByText(w)).toBeTruthy();
    // 雨のことばの札は時間別の表（左の画面）に、スマホの画面の下には「リスクと概況」の一行
    expect(container.querySelector('.lp-moyo__tablewrap .lp-moyo__rain')).toBeTruthy();
    expect(container.querySelector('.lp-moyo__device')!.textContent).toContain('リスクと概況で、作業を判断');
    expect(container.querySelector('.lp-moyo__device .lp-moyo__rain')).toBeNull();
    expect(container.querySelector('.lp-moyo__hourlylead')!.textContent).toBe('1時間ごとの空がわかる。作業が決まる。');
    expect(screen.getAllByRole('img', { name: /時間別の表/ })).toHaveLength(2);
    expect(screen.getByText('画面は東京・2026年9月20日（雨の日）の実績。')).toBeTruthy();
  });
  it('押すと写真と説明が一緒に切り替わり、GA4 に記録する（動きを減らす設定でも押せる）', () => {
    const { container } = render(<MoyoChapter />);
    fireEvent.click(screen.getByRole('button', { name: '概況でみる' }));
    expect(screen.getByRole('button', { name: '概況でみる' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'リスクでみる' }).getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.lp-moyo__caption')!.textContent).toBe('その時間帯の、いちばん多い天気');
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe('概況でみる：その時間帯の、いちばん多い天気');
    expect(container.querySelector('.lp-moyo__phone img.is-on')!.getAttribute('src')).toBe('/lp/moyo-gaikyo.webp');
    expect(logLpMoyoToggle).toHaveBeenCalledWith('gaikyo');
  });
});

describe('MakerChapter', () => {
  it('作った人の一行と、詳しく読む層3つ（開くと GA4 に記録）', () => {
    const { container } = render(<MakerChapter />);
    expect(screen.getByRole('heading', { name: '現場で欲しかったものを、農家が作りました。' })).toBeTruthy();
    expect(container.querySelectorAll('details.lp-details')).toHaveLength(3);
    const faq = container.querySelector<HTMLDetailsElement>('details[data-section="faq"]')!;
    faq.open = true;
    fireEvent(faq, new Event('toggle'));
    expect(logLpDetailOpen).toHaveBeenCalledWith('faq');
    expect(screen.getByText('※予定')).toBeTruthy();
  });
});

describe('FinalChapter / LpFooter', () => {
  it('今日の節気・見出し・ボタン2つ、フッターの注意書き', () => {
    const onTryGuest = vi.fn();
    render(<><FinalChapter loading={false} onLogin={() => {}} onTryGuest={onTryGuest} /><LpFooter /></>);
    expect(screen.getByText(`今日は${sekkiForDate(new Date()).name}。`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: '今年の季節を、数字で見てみる。' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ログインせずに試す/ }));
    expect(onTryGuest).toHaveBeenCalled();
    expect(screen.getByText('ご利用上の注意')).toBeTruthy();
  });
  it('ログインに失敗したら、最後のボタンの近くにも知らせる', () => {
    render(<FinalChapter loading={false} error="ログインに失敗しました。もう一度お試しください。" onLogin={() => {}} onTryGuest={() => {}} />);
    expect(screen.getByRole('alert').textContent).toBe('ログインに失敗しました。もう一度お試しください。');
  });
});
