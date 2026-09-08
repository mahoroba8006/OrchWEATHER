export type Platform = 'ios' | 'android' | 'other';

export type InAppBrowserApp = 'LINE' | 'X' | 'Instagram' | 'Facebook';

export type InAppBrowser = {
  app: InAppBrowserApp;
  platform: Platform;
};

const linePattern = /(?:^|\s)Line\/\d/;
const xPattern = /(?:^|\s)(?:Twitter for iPhone|Twitter for iPad|TwitterAndroid)/;
const instagramPattern = /(?:^|\s)Instagram[\s/]/;
const facebookPattern = /\bFB(?:AN|AV)\//;

function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  let app: InAppBrowserApp | null = null;

  if (linePattern.test(ua)) app = 'LINE';
  else if (xPattern.test(ua)) app = 'X';
  // Instagram UAs can contain FBAN/FBAV, so this must precede Facebook.
  else if (instagramPattern.test(ua)) app = 'Instagram';
  else if (facebookPattern.test(ua)) app = 'Facebook';

  return app ? { app, platform: detectPlatform(ua) } : null;
}
