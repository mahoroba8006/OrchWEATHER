import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeatherCalendar } from './WeatherCalendar';
import { addDays } from '../../lib/dateUtils';
import type { DailyForecastData } from '../../api/forecast';

afterEach(cleanup);

const day = (date: string): DailyForecastData => ({
  date, weatherCode: 0, tempMax: 20, tempMin: 10, precipProbMax: 10, precipSum: 0,
  humidMin: 40, humidMax: 80, sunrise: `${date}T05:00`, sunset: `${date}T18:00`,
  radiationSum: 10, snowfallSum: 0, windSpeedMax: 3, sunshineDuration: 8,
  amCodes: [0], pmCodes: [0], nightCodes: [0],
  amPrecipProb: 10, pmPrecipProb: 10, nightPrecipProb: 10,
  amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
  amTempMax: 20, amTempMin: 10, pmTempMax: 20, pmTempMin: 10, nightTempMax: 20, nightTempMin: 10,
  amWindMax: 2, pmWindMax: 2, nightWindMax: 2,
});

const today = '2026-10-28';
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => day(addDays(today, from + i)));
const view = (onPick = vi.fn()) => render(
  <WeatherCalendar pastDaily={days(-14, -1)} daily={days(0, 14)} weatherCodeMode="severity" today={today} onPick={onPick} />,
);
const dateChip = (c: HTMLElement, date: string) => c.querySelector<HTMLElement>(`[data-date="${date}"] span`)!;

describe('WeatherCalendar', () => {
  it('左上の期間に西暦を付ける', () => {
    expect(view().container.textContent).toContain('2026/10/14〜11/11');
  });

  it('今日だけ日付を緑の反転にし、日曜・祝日は赤系・土曜は青系', () => {
    const { container } = view();
    expect(dateChip(container, today).style.background).toBe('var(--accent)');
    expect(dateChip(container, '2026-10-29').style.background).toBe('');
    expect(dateChip(container, '2026-11-01').style.color).toBe('rgb(194, 73, 63)');   // 日曜
    expect(dateChip(container, '2026-11-03').style.color).toBe('rgb(194, 73, 63)');   // 文化の日（火）
    expect(dateChip(container, '2026-10-31').style.color).toBe('var(--accent-blue)'); // 土曜
    expect(dateChip(container, '2026-11-02').style.color).toBe('var(--ink-1)');
  });

  it('下の表にある日だけ押せて、押した日を知らせる', () => {
    const onPick = vi.fn();
    const { container } = view(onPick);
    expect(container.querySelector('[data-date="2026-10-27"]')!.tagName).toBe('DIV');
    fireEvent.click(container.querySelector('[data-date="2026-11-03"]')!);
    expect(onPick).toHaveBeenCalledWith('2026-11-03');
  });
});
