// 起動後初回だけ再生する演出（ヒーローのカウントアップ・カードの順次表示）の共有フラグ。
// タブ往復でアンマウント→再マウントしても再生しないよう、モジュールスコープで保持する。
let played = false;

export const hasIntroPlayed = (): boolean => played;
export const markIntroPlayed = (): void => { played = true; };
/** テスト専用 */
export const resetIntroForTest = (): void => { played = false; };
