// src/components/lp/SkyScene.tsx
// LP の背景「一日×一年の空」。画面の奥に固定し、各章の data-scene から進み具合 p を求めて
// 空・太陽と月・星・雲・丘の色を CSS 変数で書き換える（再描画なし）。舞うものは canvas。
// 動きを減らす設定では、今いる章の色で止め（@property で静かに切り替え）、舞うものは出さない。
import { useEffect, useRef } from 'react';
import { celestialAt, progressFromAnchors, sceneAt, starsAt, type SceneAnchor } from '../../lib/lpScene';
import { useReduced, useScrollFrame } from './hooks';
import { createParticles, drawParticle, kindFor, particleCount, stepParticle } from './particles';
import { publishScene } from './sceneStore';
import './scene.css';

function readAnchors(): SceneAnchor[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'))
    .map((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, p: Number(el.dataset.scene) }))
    .sort((a, b) => a.top - b.top);
}

export function SkyScene() {
  const reduced = useReduced();
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const weightsRef = useRef<[number, number, number, number]>([1, 0, 0, 0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useScrollFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    const y = window.scrollY + window.innerHeight * 0.5;
    const end = document.documentElement.scrollHeight;
    const p = progressFromAnchors(readAnchors(), y, end, reduced);
    const s = sceneAt(p);
    const st = root.style;
    st.setProperty('--sky-top', s.skyTop);
    st.setProperty('--sky-bottom', s.skyBottom);
    st.setProperty('--ridge', s.ridge);
    st.setProperty('--far', s.far);
    st.setProperty('--mid', s.mid);
    st.setProperty('--near', s.near);
    st.setProperty('--cloud', s.cloud);
    st.setProperty('--stars', String(starsAt(p)));
    // 入道雲は夏だけ濃く、夜はすべての雲を薄く
    st.setProperty('--cumulus', String(p > 0.25 && p < 0.55 ? 1 : 0.35));
    st.setProperty('--cloud-night', String(p > 0.78 ? 0.4 : 1));
    st.setProperty('--cloud-shift', `${(p * 18).toFixed(2)}vw`);
    const c = celestialAt(p);
    const body = bodyRef.current;
    if (body) {
      body.dataset.kind = c.kind;
      body.style.transform = `translate(calc(${c.x}vw - 50%), calc(${c.y}vh - 50%))`;
      // 地平線に近いほど赤みを帯びる
      body.style.setProperty('--warm', String(200 + Math.round(50 * c.height)));
    }
    weightsRef.current = s.weights;
    publishScene(p);
  });

  // 設定の切り替え・画像や書体の読み込みによる位置のずれでも、スクロールを待たずに計算し直す
  useEffect(() => {
    const recompute = () => window.dispatchEvent(new Event('scroll'));
    recompute();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(recompute);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [reduced]);

  // 舞うもの（少なく、ゆっくり）。画面が隠れている間は止める
  useEffect(() => {
    if (reduced) return;
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let w = 0;
    let h = 0;
    let parts = createParticles(0, 0, 0);
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const prevW = w;
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // スマホのアドレスバーの出入り（高さだけの変化）では舞うものを作り直さない
      if (w !== prevW) parts = createParticles(particleCount(w), w, h);
    };
    size();
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const q of parts) {
        const kind = kindFor(q.k, weightsRef.current);
        if (!kind) continue;
        stepParticle(q, kind, w, h);
        drawParticle(ctx, q, kind);
      }
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', size, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  return (
    <div ref={rootRef} className={reduced ? 'lp-scene lp-scene--still' : 'lp-scene'} aria-hidden="true">
      <div className="lp-scene__sky" />
      <div className="lp-scene__stars" />
      <div ref={bodyRef} className="lp-scene__body" data-kind="sun" />
      <div className="lp-scene__cloud lp-scene__cloud--1" />
      <div className="lp-scene__cloud lp-scene__cloud--2" />
      <div className="lp-scene__cloud lp-scene__cloud--3" />
      <svg className="lp-scene__land" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax slice">
        {/* 遠くの山並み */}
        <path fill="var(--ridge)" d="M0 262 Q60 236 120 244 T240 214 T360 236 T480 204 T600 232 T720 196 T840 228 T960 206 T1080 236 T1200 210 T1320 238 T1440 222 V520 H0Z" />
        {/* 奥の丘 */}
        <path fill="var(--far)" d="M0 304 C180 254 360 274 540 294 S900 254 1110 274 S1340 294 1440 280 V520 H0Z" />
        {/* 中の丘と木立 */}
        <path fill="var(--mid)" d="M0 364 C200 324 420 354 640 340 S1020 316 1240 344 S1400 354 1440 348 V520 H0Z" />
        <g fill="rgba(20, 45, 25, 0.16)">
          <circle cx="210" cy="342" r="15" /><circle cx="234" cy="335" r="19" /><circle cx="258" cy="344" r="12" />
          <circle cx="1052" cy="330" r="16" /><circle cx="1076" cy="323" r="21" /><circle cx="1100" cy="332" r="13" />
        </g>
        {/* 手前の田畑と畦 */}
        <path fill="var(--near)" d="M0 424 C260 394 520 414 760 408 S1080 396 1300 414 L1440 418 V520 H0Z" />
        <g fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="2">
          <path d="M0 456 C300 434 640 450 1000 444 S1300 450 1440 454" />
          <path d="M0 490 C320 470 700 484 1040 480 S1320 486 1440 490" />
          <path d="M380 520 C420 474 470 444 520 416" />
          <path d="M900 520 C880 474 860 444 840 410" />
        </g>
      </svg>
      {!reduced && <canvas ref={canvasRef} className="lp-scene__fx" />}
    </div>
  );
}
