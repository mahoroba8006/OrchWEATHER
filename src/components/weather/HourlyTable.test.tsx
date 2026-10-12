import { cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HourlyTable } from './HourlyTable';
import { heatRibbon } from '../../lib/hourlyHeat';
import { HOURLY_ROW_OPTIONS } from '../../lib/hourlyRows';
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
  it('降水量は棒を付けず、0は白（塗らない）・多いほど濃く塗る（10mm を超えると水色からさらに濃い青へ）', () => {
    const { container } = renderWithMotion(<HourlyTable hourly={hourly} daily={daily} disablePastOpacity />);
    expect(container.querySelector('[data-testid="precip-bar"]')).toBeNull();
    const row = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith('降水量'))!;
    const tds = Array.from(row.querySelectorAll<HTMLElement>('td')).slice(1).filter(td => td.textContent !== '');
    expect(tds.map(td => td.textContent)).toEqual(['0.0', '5.0', '0.0', '12.0']);
    expect(tds[0].style.backgroundColor).toBe('');
    expect(tds[1].style.backgroundColor).not.toBe('');
    expect(tds[3].style.backgroundColor).toBe('rgb(145, 186, 234)');
    // 降水確率は降水量と取り違えないよう青灰色で淡く（30%）
    const prob = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith('降水確率'))!;
    expect(prob.querySelectorAll<HTMLElement>('td')[1].style.backgroundColor).toBe('rgb(240, 244, 249)');
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

  it('日照は分、日射は MJ/m²。夜で0は「–」、昼の0は灰色、最大は黄色（日射は橙寄り）', () => {
    const { container } = renderWithMotion(<HourlyTable hourly={sunHourly} daily={daily} disablePastOpacity />);
    const sun = cells(container, '日照時間');
    expect(sun.map(td => td.textContent)).toEqual(['–', '60', '0', '12']);
    expect(sun[0].style.backgroundColor).toBe('');
    expect(sun[1].style.backgroundColor).toBe('rgb(255, 213, 79)');
    expect(sun[2].style.backgroundColor).toBe('rgb(236, 239, 241)');
    const rad = cells(container, '日射量');
    expect(rad.map(td => td.textContent)).toEqual(['–', '3.20', '0.00', '0.18']);
    expect(rad[1].style.backgroundColor).toBe('rgb(255, 188, 102)'); // 日射は橙寄り（日照の黄と見分ける）
  });
});

describe('heatRibbon（境目のぼかし）', () => {
  const Y = [255, 213, 79] as const;
  const G = [236, 239, 241] as const;

  it('中央は値どおりの色、端は隣との中間色で、隣り合う列の境目の色が一致する', () => {
    const [a, b] = heatRibbon([Y, G]);
    expect(a!.color).toBe('rgb(255, 213, 79)');
    expect(a!.image).toContain('rgb(255, 213, 79) 30%');
    expect(a!.image).toContain('rgb(255, 213, 79) 70%');
    // a の右端 = b の左端
    const right = a!.image!.match(/(rgb\([^)]+\)) 100%/)![1];
    const left = b!.image!.match(/\((?:to right, )?(rgb\([^)]+\)) 0%/)![1];
    expect(right).toBe(left);
    expect(right).toBe('rgb(246, 226, 160)');
  });

  it('塗らない列（null）は白として隣とつなぎ、両隣も塗らなければ何もしない', () => {
    const r = heatRibbon([null, Y, null, null]);
    expect(r[0]!.color).toBeUndefined();
    expect(r[0]!.image).toContain('rgb(255, 234, 167) 100%');
    expect(r[3]).toBeUndefined();
  });

  it('日の出入りの列（bridge）は両隣の中間色でつなぐ', () => {
    const r = heatRibbon([G, 'bridge', Y]);
    expect(r[1]!.color).toBe('rgb(246, 226, 160)');
  });
});

describe('HourlyTable の降水量の色', () => {
  const bg = (container: HTMLElement) => {
    const row = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith('降水量'))!;
    return Array.from(row.querySelectorAll<HTMLElement>('td')).slice(1).map(td => td.style.backgroundColor);
  };

  it('0 は塗らず、10mm は水色、50mm 以上は濃い青（上限）', () => {
    const rain = [hour('2026-10-01T09:00', 0), hour('2026-10-01T10:00', 10), hour('2026-10-01T11:00', 50), hour('2026-10-01T12:00', 80)];
    const { container } = renderWithMotion(<HourlyTable hourly={rain} daily={daily} disablePastOpacity />);
    expect(bg(container)).toEqual(['', 'rgb(151, 190, 235)', 'rgb(70, 135, 215)', 'rgb(70, 135, 215)']);
  });
});
describe('HourlyTable の凡例', () => {
  it('色のある行の項目名をタップすると、値と色の対応が行の下に開き、もう一度で閉じる', () => {
    const { getByRole, queryByRole, getByText } = renderWithMotion(<HourlyTable hourly={hourly} daily={daily} disablePastOpacity />);
    const btn = getByRole('button', { name: '降水量の色の見かた' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('note').textContent).toContain('30');
    expect(getByRole('note').textContent).toContain('50以上');
    expect(getByText('0.5')).toBeTruthy();
    fireEvent.click(btn);
    expect(queryByRole('note')).toBeNull();
    // 色のない行（気温）はボタンにしない
    expect(queryByRole('button', { name: '気温の色の見かた' })).toBeNull();
  });
});
describe('HourlyTable の風速の色', () => {
  it('0 は塗らず、15m/s で淡い緑、20m/s 以上で最も濃い緑', () => {
    const wind = [0, 7.5, 15, 20, 25].map((w, k) => ({ ...hour(`2026-10-01T1${k}:00`, 0), windSpeed: w }));
    const { container } = renderWithMotion(<HourlyTable hourly={wind} daily={daily} disablePastOpacity />);
    const row = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith('風速'))!;
    const bg = Array.from(row.querySelectorAll<HTMLElement>('td')).slice(1).map(td => td.style.backgroundColor);
    expect(bg).toEqual(['', 'rgb(212, 235, 214)', 'rgb(168, 214, 172)', 'rgb(100, 172, 108)', 'rgb(100, 172, 108)']);
  });
});
describe('HourlyTable の紫外線指数', () => {
  it('アイコンでなく数字＋淡い紫。夜で0は「–」、11 以上で最も濃い', () => {
    const uv = [
      { ...hour('2026-10-01T04:00', 0), uvIndex: 0 },
      { ...hour('2026-10-01T10:00', 0), uvIndex: 5.6 },
      { ...hour('2026-10-01T12:00', 0), uvIndex: 12 },
    ];
    const { container, getByRole } = renderWithMotion(<HourlyTable hourly={uv} daily={daily} disablePastOpacity />);
    expect(container.querySelector('img[alt^="UV"]')).toBeNull();
    const row = Array.from(container.querySelectorAll('tr')).find(tr => tr.querySelector('.hourly-label')?.textContent?.startsWith('紫外線指数'))!;
    const tds = Array.from(row.querySelectorAll<HTMLElement>('td')).slice(1).filter(td => td.textContent !== '');
    expect(tds.map(td => td.textContent)).toEqual(['–', '6', '12']);
    expect(tds[0].style.backgroundColor).toBe('');
    expect(tds[2].style.backgroundColor).toBe('rgb(184, 164, 230)');
    expect(getByRole('button', { name: '紫外線指数の色の見かた' })).toBeTruthy();
  });
});
describe('HourlyTable の行の並び', () => {
  it('表の行は設定の項目一覧（HOURLY_ROW_OPTIONS）と同じ順。紫外線指数は日射量と風速の間', () => {
    const { container } = renderWithMotion(<HourlyTable hourly={[{ ...hour('2026-10-01T10:00', 0), snowfall: 1 }]} daily={daily} disablePastOpacity />);
    const labels = Array.from(container.querySelectorAll('.hourly-label'))
      .map(td => td.querySelector('div')?.textContent ?? td.textContent)
      .filter(l => HOURLY_ROW_OPTIONS.some(o => o.label === l));
    expect(labels).toEqual(HOURLY_ROW_OPTIONS.map(o => o.label));
    expect(labels.slice(labels.indexOf('日射量'), labels.indexOf('日射量') + 3)).toEqual(['日射量', '紫外線指数', '風速']);
  });
});