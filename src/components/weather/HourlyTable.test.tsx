import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HourlyTable } from './HourlyTable';
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
  pressure: 1013, weatherCode: 1, radiation: 0, sunshine: 0, snowfall: 0, uvIndex: 3,
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
  it('降水量は棒を付けず、0は白（塗らない）・多いほど水色に塗る（10mm 以上は最も濃い）', () => {
    const { container } = renderWithMotion(<HourlyTable hourly={hourly} daily={daily} disablePastOpacity />);
    expect(container.querySelector('[data-testid="precip-bar"]')).toBeNull();
    const row = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith('降水量'))!;
    const tds = Array.from(row.querySelectorAll<HTMLElement>('td')).slice(1).filter(td => td.textContent !== '');
    expect(tds.map(td => td.textContent)).toEqual(['0.0', '5.0', '0.0', '12.0']);
    expect(tds[0].style.background).toBe('');
    expect(tds[1].style.background).not.toBe('');
    expect(tds[3].style.background).toBe('rgb(151, 190, 235)');
    // 降水確率も同じ水色で塗る（30% は薄い水色）
    const prob = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith('降水確率'))!;
    expect(prob.querySelectorAll<HTMLElement>('td')[1].style.background).toBe('rgb(224, 236, 249)');
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
  it('列を囲まず線も引かず、今の時刻の下に栞を付ける', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:20:00+09:00'));
    const { container } = renderWithMotion(<HourlyTable hourly={hourly} daily={daily} />);
    expect(container.querySelector('[data-testid="now-frame"]')).toBeNull();
    expect(container.querySelector('[data-testid="now-line"]')).toBeNull();
    const cur = container.querySelector('[data-current="true"]')!;
    expect(cur.querySelector('[data-testid="now-bookmark"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="now-bookmark"]')).toHaveLength(1);
    // 時刻の上の「今」の文字は出さない（栞と色で示す）
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


describe('HourlyTable の日照時間・日射量', () => {
  const sunHourly = [
    { ...hour('2026-10-01T04:00', 0) },                                  // 夜・0 → 「–」で塗らない
    { ...hour('2026-10-01T09:00', 0), sunshine: 60, radiation: 889 },   // 3.20 MJ → 黄色
    { ...hour('2026-10-01T10:00', 0), sunshine: 0, radiation: 0 },       // 昼・0 → 灰色で「0」
    { ...hour('2026-10-01T18:00', 0), sunshine: 12, radiation: 50 },     // 日の入り後でも値があれば出す
  ];
  const cells = (container: HTMLElement, label: string) => {
    const row = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith(label))!;
    return Array.from(row.querySelectorAll<HTMLElement>('td')).slice(1).filter(td => td.textContent !== '');
  };

  it('日照は分、日射は MJ/m²。夜で0は「–」、昼の0は灰色、最大は黄色', () => {
    const { container } = renderWithMotion(<HourlyTable hourly={sunHourly} daily={daily} disablePastOpacity />);
    const sun = cells(container, '日照時間');
    expect(sun.map(td => td.textContent)).toEqual(['–', '60', '0', '12']);
    expect(sun[0].style.background).toBe('');
    expect(sun[1].style.background).toBe('rgb(255, 213, 79)');
    expect(sun[2].style.background).toBe('rgb(236, 239, 241)');
    const rad = cells(container, '日射量');
    expect(rad.map(td => td.textContent)).toEqual(['–', '3.20', '0.00', '0.18']);
    expect(rad[1].style.background).toBe('rgb(255, 213, 79)');
  });
});
