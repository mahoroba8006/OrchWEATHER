// src/components/lp/primitives.tsx
// LP の共通部品: 行ごとにせり上がる見出し・数え上がる数字・ボタン2つ・画面写真。
import { createElement, useEffect, useState, type CSSProperties } from 'react';
import { useInViewOnce, useReduced } from './hooks';

/** 見出しを行ごとに下からせり上げる（画面に入ったとき1回）。読み上げは行をつなげた文 */
export function LineReveal({ as = 'h2', lines, className }: { as?: 'h1' | 'h2' | 'p'; lines: readonly string[]; className?: string }) {
  const [ref, inView] = useInViewOnce<HTMLElement>(0.3);
  return createElement(
    as,
    {
      ref,
      className: ['lp-lines', inView ? 'is-in' : '', className ?? ''].filter(Boolean).join(' '),
      'aria-label': lines.join(''),
    },
    lines.map((line, i) => (
      <span key={i} className="lp-line" aria-hidden="true">
        <span className="lp-line__in" style={{ '--i': i } as CSSProperties}>{line}</span>
      </span>
    )),
  );
}

/** 0 から to まで数え上げる（start が true になってから delay ms 後）。動きを減らす設定では最終の値 */
export function CountUp({ to, decimals = 0, duration = 1400, delay = 0, start = true }: {
  to: number; decimals?: number; duration?: number; delay?: number; start?: boolean;
}) {
  const reduced = useReduced();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced || !start) return;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / duration));
      setV(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay, start, reduced]);
  const shown = reduced ? to : v;
  return (
    <span className="lp-num">
      <span aria-hidden="true">{shown.toFixed(decimals)}</span>
      <span className="lp-sr">{to.toFixed(decimals)}</span>
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

/** 「ログインせずに試す」「Googleで始める」を同じ強さで並べる */
export function CtaPair({ loading, onLogin, onTryGuest, tone = 'day' }: {
  loading: boolean; onLogin: () => void; onTryGuest: () => void; tone?: 'day' | 'night';
}) {
  return (
    <div className={`lp-cta-pair lp-cta-pair--${tone}`}>
      <button type="button" className="lp-cta" onClick={onTryGuest} disabled={loading}>
        ログインせずに試す
      </button>
      <button type="button" className="lp-cta" onClick={onLogin} disabled={loading}>
        <span className="lp-cta__g"><GoogleIcon /></span>
        {loading ? 'ログイン中...' : 'Googleで始める'}
      </button>
    </div>
  );
}

/** 画面写真。card=カード単体（角丸・影）／phone=スマホの枠つき／band=横長の帯 */
export function Shot({ src, alt, width, height, variant = 'card', eager = false, className }: {
  src: string; alt: string; width: number; height: number; variant?: 'card' | 'phone' | 'band'; eager?: boolean; className?: string;
}) {
  return (
    <figure className={['lp-shot', `lp-shot--${variant}`, className ?? ''].filter(Boolean).join(' ')}>
      <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </figure>
  );
}
