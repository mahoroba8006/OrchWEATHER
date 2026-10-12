import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DailyForecast } from './DailyForecast';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import type { DailyForecastData } from '../../api/forecast';

beforeAll(() => {
  setupMotionTestEnv();
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
afterEach(cleanup);

const day = (date: string, tMin: number, tMax: number, extra: Partial<DailyForecastData> = {}): DailyForecastData => ({
  date, weatherCode: 1, tempMax: tMax, tempMin: tMin, precipProbMax: 10, precipSum: 0,
  humidMin: 40, humidMax: 80, sunrise: `${date}T05:00`, sunset: `${date}T18:00`,
  radiationSum: 10, snowfallSum: 0, windSpeedMax: 3, sunshineDuration: 8,
  amCodes: [1], pmCodes: [1], nightCodes: [1],
  amPrecipProb: 10, pmPrecipProb: 10, nightPrecipProb: 10,
  amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
  amTempMax: tMax, amTempMin: tMin, pmTempMax: tMax, pmTempMin: tMin, nightTempMax: tMax, nightTempMin: tMin,
  amWindMax: 2, pmWindMax: 2, nightWindMax: 2,
  ...extra,
});

const fixture = [
  day('2026-10-01', 10, 30),
  day('2026-10-02', 15, 25),
  day('2026-10-03', 0, 0, { isPlaceholder: true }),
];

describe('DailyForecast', () => {
  it('日付の下に気温の横バーを出さない（分かりにくいため廃止。最高/最低の数字は残す）', () => {
    const { container } = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" />);
    expect(container.querySelectorAll('[data-testid="temp-range"]')).toHaveLength(0);
    expect(screen.getAllByText('30').length).toBeGreaterThan(0);
  });

  it('calls onHalfDayClick with (date, am) and shows a single selection mark', () => {
    const onClick = vi.fn();
    const { container } = renderWithMotion(
      <DailyForecast daily={fixture} weatherCodeMode="severity" onHalfDayClick={onClick} />,
    );
    expect(container.querySelectorAll('[data-testid="daily-selected"]')).toHaveLength(0);
    const cell = container.querySelector('[data-cell="2026-10-02-am"]') as HTMLElement;
    fireEvent.click(cell);
    expect(onClick).toHaveBeenCalledWith('2026-10-02', 'am');
    expect(container.querySelectorAll('[data-testid="daily-selected"]')).toHaveLength(1);
    expect(screen.getAllByText('10/2(金)').length).toBeGreaterThan(0);
  });
});

describe('DailyForecast の開いた時点の枠', () => {
  const markedCell = (container: HTMLElement) =>
    container.querySelector('[data-testid="daily-selected"]')?.closest('[data-cell]')?.getAttribute('data-cell');
  afterEach(() => vi.useRealTimers());

  it('今の時間帯（午前4〜12時・午後12〜20時・夜間20〜翌4時）に枠を付ける', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00+09:00'));
    const a = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" onHalfDayClick={vi.fn()} />);
    expect(markedCell(a.container)).toBe('2026-10-01-am');
    cleanup();
    vi.setSystemTime(new Date('2026-10-01T21:00:00+09:00'));
    const b = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" onHalfDayClick={vi.fn()} />);
    expect(markedCell(b.container)).toBe('2026-10-01-night');
  });

  it('0〜4時は前日の夜間に枠を付け、その日が表に無ければ付けない', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T02:00:00+09:00'));
    const a = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" onHalfDayClick={vi.fn()} />);
    expect(markedCell(a.container)).toBe('2026-10-01-night');
    cleanup();
    vi.setSystemTime(new Date('2026-10-20T10:00:00+09:00'));
    const b = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" onHalfDayClick={vi.fn()} />);
    expect(b.container.querySelector('[data-testid="daily-selected"]')).toBeNull();
  });
});

describe('DailyForecast の「今日」の示し方', () => {
  it('今日の列は塗らず囲まず、日付と時間帯の間の線と「今日」の札で示す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00+09:00'));
    const { container } = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" />);
    const painted = Array.from(container.querySelectorAll<HTMLElement>('td')).filter(td => td.style.background.includes('accent-soft'));
    expect(painted).toHaveLength(0);
    expect(container.querySelector('[data-testid="today-frame"]')).toBeNull();
    // 線は今日の日付セルの中（日付の行と「午前・午後・夜間」の間）にある
    const line = container.querySelectorAll('[data-testid="today-bookmark"]');
    expect(line).toHaveLength(1);
    expect(line[0].previousElementSibling?.textContent).toContain('10/1');
    expect(line[0].nextElementSibling?.textContent).toBe('午前午後夜間');
    vi.useRealTimers();
  });

  it('今の時間帯の文字をアクセント色にし、今日の過ぎた時間帯は薄くする（13時は午後・午前が過ぎた）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T13:00:00+09:00'));
    const { container } = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" />);
    const now = container.querySelectorAll('[data-now-period="true"]');
    expect(now).toHaveLength(1);
    expect(now[0].textContent).toBe('午後');
    expect(container.querySelector<HTMLElement>('[data-cell="2026-10-01-am"]')!.style.opacity).toBe('0.5');
    expect(container.querySelector<HTMLElement>('[data-cell="2026-10-01-pm"]')!.style.opacity).toBe('');
    expect(container.querySelector<HTMLElement>('[data-cell="2026-10-02-am"]')!.style.opacity).toBe('');
    vi.useRealTimers();
  });

  it('0〜4時は前日の夜間なので、今日の列の時間帯に印を付けず薄くもしない', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T02:00:00+09:00'));
    const { container } = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" />);
    expect(container.querySelectorAll('[data-now-period="true"]')).toHaveLength(0);
    expect(container.querySelector<HTMLElement>('[data-cell="2026-10-01-am"]')!.style.opacity).toBe('');
    vi.useRealTimers();
  });
});
