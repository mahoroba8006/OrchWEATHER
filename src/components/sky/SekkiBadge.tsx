// ヒーロー下部の空き領域にそっと添える、今日の二十四節気・七十二候（絵＋2行）。
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { hasIntroPlayed } from '../../lib/intro';
import { sekkiForDate } from '../../lib/sekki';
import { jstDateString } from '../../lib/sky';
import { SekkiArt } from './sekkiArt';

export function SekkiBadge({ date }: { date?: Date }) {
  const reduced = useReducedMotion();
  // 起動後初回（カウントアップと同時期）だけ、絵をゆっくりにじませる
  const [playIntro] = useState(() => !hasIntroPlayed());
  const day = jstDateString(date ?? new Date());
  // 日付文字列が変わった次の再描画で更新される
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const s = useMemo(() => sekkiForDate(date ?? new Date()), [day, date]);

  // 読みが1行に収まらない幅では省略する
  const readingRef = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const el = readingRef.current;
    if (!el) return;
    const check = () => setClipped(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [s.kouIndex]);

  const animate = playIntro && !reduced;
  return (
    <div
      className="sekki-badge"
      role="group"
      aria-label={`二十四節気 ${s.name}、七十二候 ${s.kou.name}（${s.kou.reading}）`}
    >
      <m.div
        className="sekki-badge__art"
        aria-hidden="true"
        initial={animate ? { opacity: 0, scale: 0.96 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <SekkiArt index={s.index} size={56} />
      </m.div>
      <div className="sekki-badge__text">
        <span className="sekki-badge__sekki">{s.name}</span>
        <span className="sekki-badge__kou">{s.kou.name}</span>
        <span
          ref={readingRef}
          className={`sekki-badge__reading${clipped ? ' sekki-badge__reading--clipped' : ''}`}
        >
          {s.kou.reading}
        </span>
      </div>
    </div>
  );
}
