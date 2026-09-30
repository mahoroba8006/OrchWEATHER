import { beforeEach, describe, expect, it } from 'vitest';
import { fallbackSky, useSkyStore } from './skyStore';

describe('skyStore', () => {
  beforeEach(() => useSkyStore.setState({ sky: null, summary: null, heroVisible: true }));

  it('starts empty with hero visible', () => {
    const s = useSkyStore.getState();
    expect(s.sky).toBeNull();
    expect(s.summary).toBeNull();
    expect(s.heroVisible).toBe(true);
  });

  it('publishes sky and summary together', () => {
    useSkyStore.getState().publish(
      { tod: 'noon', weather: 'rain', top: '#111111', bottom: '#222222', isNight: false },
      { temperature: 21.4, weatherCode: 61, locationName: '現在地' },
    );
    const s = useSkyStore.getState();
    expect(s.sky?.weather).toBe('rain');
    expect(s.summary?.temperature).toBe(21.4);
  });

  it('tracks hero visibility', () => {
    useSkyStore.getState().setHeroVisible(false);
    expect(useSkyStore.getState().heroVisible).toBe(false);
  });

  it('fallbackSky derives a clear sky from the clock only', () => {
    const noonJst = new Date(Date.UTC(2026, 8, 30, 3, 0)); // 12:00 JST
    const s = fallbackSky(noonJst);
    expect(s.tod).toBe('noon');
    expect(s.weather).toBe('clear');
  });
});
