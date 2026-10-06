// src/components/lp/hooks.ts
// LP 共通のフック。スクロールは rAF でまとめ、passive で購読する。
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';
import { logLpChapterView } from '../../lib/analytics';

/** 動きを減らす設定か（OS の設定に追従） */
export function useReduced(): boolean {
  return useReducedMotion() ?? false;
}

/** スクロール・リサイズのたびに（1コマに1回まで）cb を呼ぶ。最初にも1回呼ぶ */
export function useScrollFrame(cb: () => void): void {
  const cbRef = useRef(cb);
  useLayoutEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = 0;
      cbRef.current();
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

/** 背の高い章（中で画面を止める）の進み具合 0→1 */
export function stickyProgress(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
}

/** 一度画面に入ったら true（IntersectionObserver が無い環境では最初から true） */
export function useInViewOnce<T extends Element>(threshold = 0.25): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return [ref, inView];
}

/** 今見えているか（visible）と、一度でも見えたか（seen）。画面外に出ると visible は false に戻る。
 *  IntersectionObserver が無い環境では両方 true */
export function useVisibility<T extends Element>(threshold = 0.25): [RefObject<T | null>, boolean, boolean] {
  const ref = useRef<T>(null);
  const noObserver = typeof IntersectionObserver === 'undefined';
  const [visible, setVisible] = useState(noObserver);
  const [seen, setSeen] = useState(noObserver);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setSeen(true);
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible, seen];
}

/** 章が画面に入ったら1回だけ GA4 に記録する */
export function useChapterView<T extends Element>(chapter: string): RefObject<T | null> {
  const [ref, inView] = useInViewOnce<T>(0.35);
  useEffect(() => {
    if (inView) logLpChapterView(chapter);
  }, [inView, chapter]);
  return ref;
}
