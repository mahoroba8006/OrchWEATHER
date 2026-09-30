import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  TIMES_OF_DAY, SKY_WEATHERS, classifyWeather, currentHourIndex, ensureWhiteContrast,
  hhmmToMinutes, jstMinutesOfDay, jstDateString, mixHex, skyPalette, timeOfDay,
} from './sky';

describe('time helpers', () => {
  it('hhmmToMinutes reads HH:MM from API strings', () => {
    expect(hhmmToMinutes('2026-05-21T04:43')).toBe(4 * 60 + 43);
    expect(hhmmToMinutes('2026-05-21T18:52')).toBe(18 * 60 + 52);
  });

  it('jstMinutesOfDay / jstDateString convert UTC instants to JST', () => {
    const d = new Date(Date.UTC(2026, 8, 30, 15, 30)); // = 2026-10-01 00:30 JST
    expect(jstMinutesOfDay(d)).toBe(30);
    expect(jstDateString(d)).toBe('2026-10-01');
  });
});

describe('timeOfDay', () => {
  const sunrise = 5 * 60 + 30; // 05:30
  const sunset = 17 * 60 + 30; // 17:30
  it.each([
    [2 * 60, 'night'],
    [5 * 60, 'dawn'],          // sunrise-30
    [5 * 60 + 59, 'dawn'],     // sunrise+29
    [6 * 60, 'morning'],       // sunrise+30
    [9 * 60 + 29, 'morning'],  // sunrise+3h59
    [9 * 60 + 30, 'noon'],     // sunrise+4h
    [15 * 60 + 59, 'noon'],
    [16 * 60, 'evening'],      // sunset-90
    [17 * 60 + 44, 'evening'], // sunset+14
    [17 * 60 + 45, 'dusk'],    // sunset+15
    [18 * 60 + 29, 'dusk'],
    [18 * 60 + 30, 'night'],   // sunset+60
    [23 * 60, 'night'],
  ] as const)('%i min -> %s', (now, expected) => {
    expect(timeOfDay(now, sunrise, sunset)).toBe(expected);
  });
});

describe('classifyWeather', () => {
  it.each([
    [0, 'clear'], [1, 'clear'], [2, 'cloudy'], [3, 'cloudy'],
    [45, 'fog'], [48, 'fog'],
    [51, 'rain'], [61, 'rain'], [67, 'rain'], [80, 'rain'], [82, 'rain'],
    [71, 'snow'], [77, 'snow'], [85, 'snow'], [86, 'snow'],
    [95, 'thunder'], [99, 'thunder'],
    [999, 'cloudy'],
  ] as const)('code %i -> %s', (code, expected) => {
    expect(classifyWeather(code)).toBe(expected);
  });
});

describe('color helpers', () => {
  it('mixHex blends linearly', () => {
    expect(mixHex('#000000', '#ffffff', 0.5).toLowerCase()).toBe('#808080');
    expect(mixHex('#123456', '#000000', 0).toLowerCase()).toBe('#123456');
  });

  it('ensureWhiteContrast darkens only when needed', () => {
    expect(ensureWhiteContrast('#1f5fae').toLowerCase()).toBe('#1f5fae');
    const fixed = ensureWhiteContrast('#9ec5ee');
    expect(contrastRatio('#ffffff', fixed)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('skyPalette', () => {
  it('meets 4.5:1 for white text on both stops for all 36 combinations', () => {
    for (const tod of TIMES_OF_DAY) {
      for (const w of SKY_WEATHERS) {
        const p = skyPalette(tod, w);
        expect(contrastRatio('#ffffff', p.top), `${tod}/${w} top`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio('#ffffff', p.bottom), `${tod}/${w} bottom`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('makes overcast skies duller than clear skies', () => {
    const clear = skyPalette('noon', 'clear');
    const rain = skyPalette('noon', 'rain');
    expect(clear.bottom).not.toBe(rain.bottom);
  });

  it('marks night-like times as isNight', () => {
    expect(skyPalette('night', 'clear').isNight).toBe(true);
    expect(skyPalette('dusk', 'clear').isNight).toBe(true);
    expect(skyPalette('noon', 'clear').isNight).toBe(false);
  });
});

describe('currentHourIndex', () => {
  const hourly = ['2026-09-30T21:00', '2026-09-30T22:00', '2026-09-30T23:00', '2026-10-01T00:00'].map(time => ({ time }));
  it('picks the last hour at or before now (JST)', () => {
    const now = new Date(Date.UTC(2026, 8, 30, 13, 40)); // 22:40 JST
    expect(currentHourIndex(hourly, now)).toBe(1);
  });
  it('returns -1 when all hours are in the future', () => {
    const now = new Date(Date.UTC(2026, 8, 30, 11, 0)); // 20:00 JST
    expect(currentHourIndex(hourly, now)).toBe(-1);
  });
});
