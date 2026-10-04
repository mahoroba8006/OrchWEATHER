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
  it('renders one temperature range bar per non-placeholder day', () => {
    const { container } = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" />);
    expect(container.querySelectorAll('[data-testid="temp-range"]')).toHaveLength(2);
  });

  it('positions the range bar relative to the whole period', () => {
    const { container } = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" />);
    const bars = container.querySelectorAll<HTMLElement>('[data-testid="temp-range"]');
    expect(bars[1].style.left).toBe('25%');
    expect(bars[1].style.width).toBe('50%');
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

describe('DailyForecast の「今日」の示し方', () => {
  it('今日の列は塗らず、淡い太線の枠で囲む', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00+09:00'));
    const { container } = renderWithMotion(<DailyForecast daily={fixture} weatherCodeMode="severity" />);
    const painted = Array.from(container.querySelectorAll<HTMLElement>('td')).filter(td => td.style.background.includes('accent-soft'));
    expect(painted).toHaveLength(0);
    const frame = container.querySelector<HTMLElement>('[data-testid="today-frame"]')!;
    expect(frame).toBeTruthy();
    expect(frame.style.border).toContain('2px solid');
    vi.useRealTimers();
  });
});
