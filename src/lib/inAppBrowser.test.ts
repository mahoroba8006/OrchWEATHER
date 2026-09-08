import { describe, expect, it } from 'vitest';
import { detectInAppBrowser } from './inAppBrowser';

describe('detectInAppBrowser', () => {
  it('detects LINE on Android', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Line/14.21.1'
      )
    ).toEqual({ app: 'LINE', platform: 'android' });
  });

  it('detects X on iOS', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Twitter for iPhone'
      )
    ).toEqual({ app: 'X', platform: 'ios' });
  });

  it('detects Instagram before its embedded Facebook identifier', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 320.0.0.0.0 FBAN/Instagram'
      )
    ).toEqual({ app: 'Instagram', platform: 'ios' });
  });

  it('detects Facebook on iOS', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) FBAN/FB4A FBAV/500.0'
      )
    ).toEqual({ app: 'Facebook', platform: 'ios' });
  });

  it('returns null for normal Android Chrome', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
      )
    ).toBeNull();
  });

  it('does not treat PowerLine as LINE', () => {
    expect(detectInAppBrowser('Mozilla/5.0 PowerLine/2.0')).toBeNull();
  });

  it('returns null for an empty user agent', () => {
    expect(detectInAppBrowser('')).toBeNull();
  });
});
