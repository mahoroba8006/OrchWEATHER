import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { fallbackSky } from '../../skyStore';
import { SkyHero } from './SkyHero';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const sky = fallbackSky(new Date('2026-09-30T03:00:00Z'));

function setup(over: Partial<React.ComponentProps<typeof SkyHero>> = {}) {
  const props: React.ComponentProps<typeof SkyHero> = {
    sky,
    temperature: 21.6,
    weatherCode: 0,
    tempMax: 23.2,
    tempMin: 17.8,
    lastUpdated: '23:15',
    loading: false,
    locationSlot: <span>テスト圃場</span>,
    onLocate: vi.fn(),
    locating: false,
    onRefresh: vi.fn(),
    ...over,
  };
  renderWithMotion(<SkyHero {...props} />);
  return props;
}

describe('SkyHero', () => {
  it('shows the rounded temperature', async () => {
    setup();
    expect(await screen.findByText('22°')).toBeTruthy();
  });
  it('shows a placeholder while temperature is null', () => {
    setup({ temperature: null, weatherCode: null });
    expect(screen.getByText('—°')).toBeTruthy();
  });
  it('shows label, high/low and last updated', () => {
    setup();
    expect(screen.getByText('快晴')).toBeTruthy();
    expect(screen.getByText(/最高 23°/)).toBeTruthy();
    expect(screen.getByText(/最低 18°/)).toBeTruthy();
    expect(screen.getByText('最終更新 23:15')).toBeTruthy();
  });
  it('marks the icon when the temperature has 4+ characters', () => {
    setup({ temperature: -12 });
    const container = document;
    expect(container.querySelector('.sky-hero__icon--wide-temp')).not.toBeNull();
  });
  it('does not mark the icon for short temperatures', () => {
    setup({ temperature: 23 });
    const container = document;
    expect(container.querySelector('.sky-hero__icon')).not.toBeNull();
    expect(container.querySelector('.sky-hero__icon--wide-temp')).toBeNull();
  });
  it('fires onLocate and onRefresh', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: '現在地を表示' }));
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    expect(p.onLocate).toHaveBeenCalledTimes(1);
    expect(p.onRefresh).toHaveBeenCalledTimes(1);
  });
  it('disables buttons while busy', () => {
    setup({ locating: true, loading: true });
    expect((screen.getByRole('button', { name: '現在地を表示' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '更新' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('renders locationSlot and children', () => {
    setup({ children: <p role="alert">エラー</p> });
    expect(screen.getByText('テスト圃場')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('エラー');
  });
});
