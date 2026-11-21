// ビルド時の LP 描画用。計測は描画では呼ばれないので、呼ばれても何もしない差し替え（src/lib/analytics.ts と同じ名前）。
const noop = (): void => {};
export const logLogin = noop;
export const logGuestStart = noop;
export const logWeatherView = noop;
export const logSeasonCardView = noop;
export const logAppError = noop;
export const logSeasonCardDismiss = noop;
export const logSeasonCardDetail = noop;
export const logSeasonCardOpen = noop;
export const logSeasonCardBrowse = noop;
export const logLpDetailOpen = noop;
export const logLpChapterView = noop;
export const logLpMoyoToggle = noop;
