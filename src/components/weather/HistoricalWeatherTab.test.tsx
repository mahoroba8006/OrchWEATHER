import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';

const hook = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('../../hooks/useHistoricalForecast', () => ({
  useHistoricalForecast: (...args: unknown[]) => {
    hook.calls.push(args);
    return { data: null, loading: false, loadingStatus: '', error: null };
  },
}));
const { HistoricalWeatherTab } = await import('./HistoricalWeatherTab');

beforeAll(setupMotionTestEnv);
afterEach(() => { cleanup(); hook.calls = []; });

const locations = [
  { id: 'a', name: '畑A', lat: 35, lon: 139 },
  { id: 'b', name: '畑B', lat: 36, lon: 140 },
];

describe('HistoricalWeatherTab', () => {
  it('既定は昨日までの16日分（開始日は16日前）', () => {
    useAppStore.setState({ locations, userSettings: { defaultLocationId: 'a' }, geoLocation: null } as never);
    renderWithMotion(<HistoricalWeatherTab />);
    expect(screen.getByText('から16日分を表示')).toBeTruthy();
    const jst = new Date(Date.now() + 9 * 3600_000);
    jst.setUTCDate(jst.getUTCDate() - 16);
    expect((screen.getByDisplayValue(jst.toISOString().slice(0, 10)) as HTMLInputElement).type).toBe('date');
    expect(hook.calls.at(-1)).toEqual([35, 139, jst.toISOString().slice(0, 10)]);
  });

  it('「詳しく見る」からの指定があれば、その開始日と地点で開く（既定地点より優先）', () => {
    useAppStore.setState({ locations, userSettings: { defaultLocationId: 'a' }, geoLocation: null } as never);
    renderWithMotion(<HistoricalWeatherTab request={{ start: '2026-09-23', locationId: 'b' }} />);
    expect(screen.getByDisplayValue('2026-09-23')).toBeTruthy();
    expect(hook.calls.at(-1)).toEqual([36, 140, '2026-09-23']);
  });
});
