// src/components/lp/LpNav.tsx
// 上部の帯（ロゴ・ログイン）と、右端の二十四節気の目盛り（スマホは小さく）。
// 帯には演出の時刻や節気を出さない（最初の画面の「今日の節気」と食い違い、本当の時刻に見えるため）。
// 目盛りは背景から配られる p で DOM を直接書き換える（再描画なし）。
import { useEffect, useRef, useState } from 'react';
import { sekkiIndexAt } from '../../lib/lpScene';
import { SEKKI } from '../../lib/sekki';
import { useScrollFrame } from './hooks';
import { subscribeScene } from './sceneStore';

export function LpNav({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useScrollFrame(() => setScrolled(window.scrollY > 24));
  return (
    <header className={scrolled ? 'lp-nav is-scrolled' : 'lp-nav'}>
      <a className="lp-nav__brand" href="#top">
        <img src="/icons/yamamatsu-mark-white.svg" alt="" width={26} height={26} />
        <span>Orch.Weather</span>
      </a>
      <button type="button" className="lp-nav__login" onClick={onLogin} disabled={loading}>ログイン</button>
    </header>
  );
}

export function SekkiDial() {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => subscribeScene((p) => {
    const i = sekkiIndexAt(p);
    listRef.current?.querySelectorAll('li').forEach((li, k) => li.classList.toggle('is-on', k === i));
  }), []);
  return (
    <ol ref={listRef} className="lp-dial" aria-hidden="true">
      {SEKKI.map((s) => <li key={s.name}>{s.name}</li>)}
    </ol>
  );
}
