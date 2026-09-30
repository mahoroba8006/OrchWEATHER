import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';

/**
 * アプリ全体のモーション設定。
 * - LazyMotion strict: `motion.*` の使用を禁止し `m.*` に統一（バンドル削減）
 * - domMax: layoutId（選択印の移動）と drag（シートのスワイプ）に必要
 * - reducedMotion="user": OS の「視差効果を減らす」設定で transform アニメを無効化
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
