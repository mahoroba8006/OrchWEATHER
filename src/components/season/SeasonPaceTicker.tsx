// 空もようのヒーロー直下に常設する「季節のあしどり」の帯。
// 4項目（気温・降水量・積算温度・日照時間）を同じ枠の中で紙芝居のように切り替える。
// 何の項目かが一目で分かるよう、本文の先頭に項目名を置く。
// 取得中は同じ高さの骨組みで場所を確保し、予報が後から押し下げられないようにする。
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { SeasonState } from '../../hooks/useSeasonReview';
import './season.css';

/** 自動で次の項目へ進める間隔（ミリ秒）。読み終わる前に進まないよう長めに */
const ADVANCE_MS = 8000;
/** 切り替えの動き。操作への反応ではなく眺める紙芝居なので、ばね（lib/motion）ではなくゆっくりした一定の動きにする */
const SLIDE = { type: 'tween', duration: 0.8, ease: [0.4, 0, 0.2, 1] } as const;

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
      // 骨組みだけだと空白に見えるので、AIコメントの読み込みと同じ回転アイコンと文言で集計中を示す（高さは本体と同じ）
      <div role="status" aria-label="季節のあしどりを集計中" className="season-strip season-strip--loading">
        <Loader2 size={16} className="season-strip__spinner" aria-hidden="true" />
        <span className="season-strip__loading-text">
          <span>季節のあしどりを集計しています…</span>
          <span className="season-strip__loading-sub">はじめての地点は少し時間がかかります</span>
        </span>
      </div>
    );
  }
  if (count === 0) return null;

  const item = items[current];
  return (
    <section className="season-pace" aria-label="季節のあしどり">
      {/* 読み上げ用：切り替え中の文言を拾わず、全項目を一度に伝える（ボタンの中に置くと aria-label に隠れて読まれない） */}
      <ul className="season-sr">
        {items.map((it) => (
          <li key={it.kind}>{`${it.name}（${it.period}）：${it.text}`}</li>
        ))}
      </ul>
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
              transition={SLIDE}
            >
              <span className="season-strip__label">{`季節のあしどり（${item.period}）`}</span>
              <span className="season-strip__text">
                <span className="season-strip__name">{item.name}</span>
                {item.text}
              </span>
            </m.span>
          </AnimatePresence>
        </span>
        <span aria-hidden="true" className="season-strip__dots">
          {items.map((it, i) => (
            <i key={it.kind} className={i === current ? 'is-current' : undefined} />
          ))}
        </span>
      </button>
    </section>
  );
}
