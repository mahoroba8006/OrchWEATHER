import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HourlyTable } from './HourlyTable';
import { nowColumnPos } from '../../lib/sky';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import type { HourlyForecast, DailyForecastData } from '../../api/forecast';

beforeAll(setupMotionTestEnv);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const hour = (time: string, precipitation: number): HourlyForecast => ({
  time, temperature: 20, precipitation, precipProb: 30, dewPoint: 10, humidity: 60,
  windSpeed: 2, windDirection: 90, windGusts: 4, cape: 0, freezingLevel: 3000,
  pressure: 1013, weatherCode: 1, radiation: 0, snowfall: 0, uvIndex: 3,
});

const hourly = [
  hour('2026-10-01T09:00', 0),
  hour('2026-10-01T10:00', 5),
  hour('2026-10-01T11:00', 0),
  hour('2026-10-01T12:00', 12),
];

const daily = [{
  date: '2026-10-01', sunrise: '2026-10-01T05:30', sunset: '2026-10-01T17:30',
} as DailyForecastData];

describe('HourlyTable', () => {
  it('draws a precip bar scaled to mm/10 x 70% only for non-zero cells', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:20:00+09:00'));
    const { container } = renderWithMotion(<HourlyTable hourly={hourly} daily={daily} />);
    const bars = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="precip-bar"]'));
    expect(bars).toHaveLength(2);
    expect(bars[0].style.height).toBe('35%');
    expect(bars[1].style.height).toBe('70%'); // 12mm は上限 10mm 扱い
  });

  it('marks exactly one column as current', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:20:00+09:00'));
    const { container } = renderWithMotion(<HourlyTable hourly={hourly} daily={daily} />);
    const cur = container.querySelectorAll('[data-current="true"]');
    expect(cur).toHaveLength(1);
    expect(cur[0].getAttribute('data-time')).toBe('2026-10-01T10:00');
  });
});

describe('HourlyTable の「今」の示し方', () => {
  it('列を囲まず、今の時刻の位置に細い縦線を引く', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:20:00+09:00'));
    const { container } = renderWithMotion(<HourlyTable hourly={hourly} daily={daily} />);
    expect(container.querySelector('[data-testid="now-frame"]')).toBeNull();
    const line = container.querySelector<HTMLElement>('[data-testid="now-line"]')!;
    expect(line).toBeTruthy();
    expect(line.style.width).toBe('1.5px');
    // 時刻の上の「今」の文字は出さない（線と色で示す）
    expect(container.querySelector('[data-current="true"]')!.textContent).toBe('10');
    vi.useRealTimers();
  });
});

describe('HourlyTable の表示項目', () => {
  it('hiddenRowKeys に入れた行は描かれず、それ以外は残る', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:20:00+09:00'));
    const { queryByText } = renderWithMotion(
      <HourlyTable hourly={hourly} daily={daily} hiddenRowKeys={new Set(['pressure', 'windSpeed'])} />,
    );
    expect(queryByText('気圧')).toBeNull();
    expect(queryByText('風速')).toBeNull();
    expect(queryByText('気温')).toBeTruthy();
  });
});

describe('nowColumnPos', () => {
  const times = ['2026-10-01T10:00', '2026-10-01T11:00', '2026-10-01T11:30', '2026-10-01T12:00'];
  it('列の中央をその時刻とし、次の列までを時刻で按分する（10:20 は10時の列の中央から1/3）', () => {
    expect(nowColumnPos(times, new Date('2026-10-01T10:20'))).toBeCloseTo(0.5 + 1 / 3);
  });
  it('日の出・日の入りの列をまたいでも、その列の時刻で按分する', () => {
    expect(nowColumnPos(times, new Date('2026-10-01T11:45'))).toBeCloseTo(2.5 + 0.5);
  });
  it('範囲外は null', () => {
    expect(nowColumnPos(times, new Date('2026-10-01T09:59'))).toBeNull();
    expect(nowColumnPos(times, new Date('2026-10-01T12:00'))).toBeNull();
  });
});
