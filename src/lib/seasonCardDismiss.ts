// 帯の下のふりかえりカードを閉じた記録（端末ごと）。節気の開始日で識別し、閉じた節気のカードは二度と出さない。
// 記録は最後に閉じた1件だけ持てば足りる（次の節気のカードは開始日が変わるので再び出る）。
const SEASON_CARD_DISMISSED_KEY = 'seasonCardDismissed';

export function isSeasonCardDismissed(rangeStart: string): boolean {
  try {
    return localStorage.getItem(SEASON_CARD_DISMISSED_KEY) === rangeStart;
  } catch {
    return false; // localStorage 不可環境では毎回出す（閉じればその場では消える）
  }
}

export function dismissSeasonCard(rangeStart: string): void {
  try {
    localStorage.setItem(SEASON_CARD_DISMISSED_KEY, rangeStart);
  } catch { /* localStorage 不可環境は無視 */ }
}
