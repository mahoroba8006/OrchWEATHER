import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeatherCalendar } from './WeatherCalendar';
import { addDays } from '../../lib/dateUtils';
import type { DailyForecastData } from '../../api/forecast';

afterEach(cleanup);

const day = (date: string, extra: Partial<DailyForecastData> = {}): DailyForecastData => ({
  date, weatherCode: 0, tempMax: 20, tempMin: 10, precipProbMax: 10, precipSum: 0,
  humidMin: 40, humidMax: 80, sunrise: `${date}T05:00`, sunset: `${date}T18:00`,
  radiationSum: 10, snowfallSum: 0, windSpeedMax: 3, sunshineDuration: 8,
  amCodes: [0], pmCodes: [0], nightCodes: [0],
  amPrecipProb: 10, pmPrecipProb: 10, nightPrecipProb: 10,
  amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
  amTempMax: 20, amTempMin: 10, pmTempMax: 20, pmTempMin: 10, nightTempMax: 20, nightTempMin: 10,
  amWindMax: 2, pmWindMax: 2, nightWindMax: 2,
  ...extra,
});

const today = '2026-10-28';
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => day(addDays(today, from + i)));
const view = (onPick = vi.fn()) => render(
  <WeatherCalendar pastDaily={days(-10, -1)} daily={days(0, 14)} weatherCodeMode="severity" today={today} onPick={onPick} />,
);
const dateChip = (c: HTMLElement, date: string) => c.querySelector<HTMLElement>(`[data-date="${date}"] span`)!;

describe('WeatherCalendar', () => {
  it('左上の期間に西暦を付ける（1行目の日曜から）', () => {
    expect(view().container.textContent).toContain('2026/10/18〜11/11');
  });

  it('期間の横に注記は出さない', () => {
    expect(view().container.textContent).not.toContain('目安');
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

  it('過去の日は日付を淡くする（色は曜日・祝日のまま）', () => {
    const { container } = view();
    expect(dateChip(container, '2026-10-25').style.opacity).toBe('0.5');
    expect(dateChip(container, '2026-10-25').style.color).toBe('rgb(194, 73, 63)');
    expect(dateChip(container, today).style.opacity).toBe('');
    expect(dateChip(container, '2026-10-29').style.opacity).toBe('');
  });

  it('どの日も同じ天気の色で、べた塗りにせずふちをぼかした層に置く（今日は緑の枠）', () => {
    const { container } = view();
    const tint = (date: string) => container.querySelector<HTMLElement>(`[data-date="${date}"] [data-testid="calendar-tint"]`)!;
    for (const date of ['2026-10-27', today, '2026-10-29']) {
      expect(container.querySelector<HTMLElement>(`[data-date="${date}"]`)!.style.background).toBe('transparent');
      expect(tint(date).style.filter).toBe('blur(4px)');
    }
    expect(tint('2026-10-27').style.background).toBe(tint('2026-10-29').style.background);
    expect(container.querySelector<HTMLElement>(`[data-date="${today}"]`)!.style.boxShadow).toContain('var(--accent)');
  });

  it('下の表にある日と過ぎた日が押せて、押した日を知らせる（過ぎた日は空しらべで見る）', () => {
    const onPick = vi.fn();
    const { container } = view(onPick);
    fireEvent.click(container.querySelector('[data-date="2026-11-03"]')!);
    expect(onPick).toHaveBeenCalledWith('2026-11-03');
    const pastCell = container.querySelector('[data-date="2026-10-27"]')!;
    expect(pastCell.getAttribute('aria-label')).toBe('2026/10/27の天気を空しらべで見る');
    fireEvent.click(pastCell);
    expect(onPick).toHaveBeenCalledWith('2026-10-27');
  });
});

describe('WeatherCalendar の予報の外のマス', () => {
  it('日別の表の最終日より先は空白にせず日付だけ淡く出す。過去側は1行目（前週の日曜）から天気がある（先頭は月/日）', () => {
    const { container } = view();
    const outside = Array.from(container.querySelectorAll<HTMLElement>('[data-outside="true"]')).map(el => el.textContent);
    expect(outside).toEqual(['12', '13', '14']);
    expect(container.querySelector('[data-date="2026-11-12"] span')!.getAttribute('style')).toContain('opacity: 0.4');
    expect(dateChip(container, '2026-10-18').textContent).toBe('10/18');
    expect(container.querySelector('[data-date="2026-10-18"] img')).not.toBeNull();
    expect(container.querySelector('[data-date="2026-10-17"]')).toBeNull();
    expect(container.querySelector('[data-date="2026-11-12"]')!.textContent).toBe('12');
  });
});

describe('WeatherCalendar の雨量', () => {
  it('小数は出さず整数に切り上げる（0.5mm 未満は出さない・3桁もそのまま）', () => {
    const rain = (date: string, mm: number) => day(date, { amPrecipSum: mm, pmPrecipSum: 0, nightPrecipSum: 0 });
    const { container } = render(
      <WeatherCalendar
        pastDaily={[rain('2026-10-24', 1.1), rain('2026-10-25', 0.4), rain('2026-10-26', 0.5), rain('2026-10-27', 0.1 + 0.2 + 1.7)]}
        daily={[rain(today, 11), rain('2026-10-29', 10.06), rain('2026-10-30', 123.4), rain('2026-10-31', 10.01)]}
        weatherCodeMode="severity" today={today}
      />,
    );
    const mm = (date: string) =>
      [...container.querySelectorAll(`[data-date="${date}"] div`)].map(el => el.textContent!).find(t => /^\d+mm$/.test(t))?.slice(0, -2) ?? '';
    expect([mm('2026-10-24'), mm('2026-10-25'), mm('2026-10-26'), mm('2026-10-27')]).toEqual(['2', '', '1', '2']);
    expect([mm(today), mm('2026-10-29'), mm('2026-10-30'), mm('2026-10-31')]).toEqual(['11', '11', '124', '10']); // 10.01 は誤差として 10
  });
});
