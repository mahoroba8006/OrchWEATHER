// ヒーロー下部の空き領域にそっと添える、今日の二十四節気・七十二候（文字のみ。絵はヒーロー背景）。
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sekkiForDate } from '../../lib/sekki';
import { jstDateString } from '../../lib/sky';

export function SekkiBadge({ date, onOpen }: { date?: Date; onOpen?: () => void }) {
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

  const label = `二十四節気 ${s.name}、七十二候 ${s.kou.name}（${s.kou.reading}）`;
  const text = (
    <div className="sekki-badge__text">
      <span className="sekki-badge__sekki">
        {s.name}
        {onOpen && <span className="sekki-badge__chev" aria-hidden="true">›</span>}
      </span>
      <span className="sekki-badge__kou">{s.kou.name}</span>
      <span
        ref={readingRef}
        className={`sekki-badge__reading${clipped ? ' sekki-badge__reading--clipped' : ''}`}
      >
        {s.kou.reading}
      </span>
    </div>
  );

  if (onOpen) {
    return (
      <button type="button" className="sekki-badge sekki-badge--button" aria-label={`${label}。節気のようすを開く`} onClick={onOpen}>
        {text}
      </button>
    );
  }
  return (
    <div className="sekki-badge" role="group" aria-label={label}>
      {text}
    </div>
  );
}
