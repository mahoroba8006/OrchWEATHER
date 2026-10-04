// 空もようのヒーロー直下に常設する「季節のあしどり」の帯。
// 4項目（気温・降水量・積算温度・日照時間）を同じ枠の中で紙芝居のように切り替える。
// 取得中は同じ高さの骨組みで場所を確保し、予報が後から押し下げられないようにする。
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Skeleton } from '../ui/Skeleton';
import { springs } from '../../lib/motion';
import type { SeasonState } from '../../hooks/useSeasonReview';
import './season.css';

/** 自動で次の項目へ進める間隔（ミリ秒） */
const ADVANCE_MS = 4000;

export function SeasonPaceTicker({ state }: { state: SeasonState }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  const ref = useRef<HTMLButtonElement>(null);

  const items = state.status === 'ready' ? state.view.paceItems : [];
  const count = items.length;
  // 設定変更などで項目数が減っても範囲外を指さない
  const current = index < count ? index : 0;
  const active = count > 1 && !reduce && onScreen && pageVisible;

  // 画面外・タブが裏に回っている間は自動送りを止める
  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  const mounted = count > 0;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      setOnScreen(entries[entries.length - 1].isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  // 項目が変わるたび（タップ含む）に4秒を数え直す
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setIndex((current + 1) % count), ADVANCE_MS);
    return () => clearTimeout(id);
  }, [active, current, count]);

  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="季節のあしどりを集計中">
        <Skeleton height={52} radius="var(--radius-md)" />
      </div>
    );
  }
  if (count === 0) return null;

  const item = items[current];
  return (
    <button
      ref={ref}
      type="button"
      className="season-strip season-strip--ticker"
      aria-label="季節のあしどり 次の項目を表示"
      onClick={() => setIndex((current + 1) % count)}
    >
      <span aria-hidden="true" className="season-strip__stage">
        <AnimatePresence initial={false}>
          <m.span
            key={`${item.kind}-${current}`}
            className="season-strip__item"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={springs.move}
          >
            <span className="season-strip__label">{item.label}</span>
            <span className="season-strip__text">{item.text}</span>
          </m.span>
        </AnimatePresence>
      </span>
      <span aria-hidden="true" className="season-strip__dots">
        {items.map((it, i) => (
          <i key={it.kind} className={i === current ? 'is-current' : undefined} />
        ))}
      </span>
      {/* 読み上げ用：切り替え中の文言を拾わず、全項目を一度に伝える */}
      <ul className="season-sr">
        {items.map((it) => (
          <li key={it.kind}>{`${it.label}：${it.text}`}</li>
        ))}
      </ul>
    </button>
  );
}
