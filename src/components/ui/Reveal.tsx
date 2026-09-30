import { useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { springs } from '../../lib/motion';
import { hasIntroPlayed } from '../../lib/intro';

interface RevealProps {
  /** 上から何番目か（表示の遅延に使う） */
  index: number;
  children: ReactNode;
  className?: string;
}

/** 起動後の初回だけ、順番に浮かび上がる包み。2回目以降のマウントは即表示 */
export function Reveal({ index, children, className }: RevealProps) {
  // 判定はマウント時に1度だけ
  const [animate] = useState(() => !hasIntroPlayed());
  return (
    <m.div
      className={className}
      data-reveal={animate ? 'animate' : 'static'}
      initial={animate ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.enter, delay: 0.25 + index * 0.08 }}
    >
      {children}
    </m.div>
  );
}
