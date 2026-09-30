// アプリ全体で共有するモーション定義。ばねはこの3種だけを使う（仕様書 §1 モーション原則）。
// 値は実機の手触りで微調整してよいが、種類を増やさないこと。

export const springs = {
  /** 押下の沈み込み・戻り（速い反応） */
  press: { type: 'spring', stiffness: 600, damping: 30 },
  /** 選択印の移動・レイアウト変化・シート */
  move: { type: 'spring', stiffness: 380, damping: 34 },
  /** 登場・フェードアップ（ゆっくり） */
  enter: { type: 'spring', stiffness: 180, damping: 26 },
} as const;

/** 押下時の縮小率 */
export const pressScale = 0.96;
