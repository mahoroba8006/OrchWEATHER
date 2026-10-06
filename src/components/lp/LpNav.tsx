// src/components/lp/LpNav.tsx
// 上部の帯（ロゴ・空の時刻と節気・ログイン）と、PC の右端の二十四節気の目盛り。
// 時刻と節気は背景から配られる p で DOM を直接書き換える（再描画なし）。
import { useEffect, useRef, useState } from 'react';
import { clockLabel, sceneAt, sekkiIndexAt } from '../../lib/lpScene';
import { SEKKI } from '../../lib/sekki';
import { useScrollFrame } from './hooks';
import { subscribeScene } from './sceneStore';

export function LpNav({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  const clockRef = useRef<HTMLSpanElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => subscribeScene((p) => {
    if (clockRef.current) clockRef.current.textContent = `${clockLabel(sceneAt(p).hour)}\u3000${SEKKI[sekkiIndexAt(p)].name}`;
  }), []);
  useScrollFrame(() => setScrolled(window.scrollY > 24));
  return (
    <header className={scrolled ? 'lp-nav is-scrolled' : 'lp-nav'}>
      <a className="lp-nav__brand" href="#top">
        <img src="/icons/yamamatsu-mark-white.svg" alt="" width={26} height={26} />
        <span>Orch.Weather</span>
      </a>
      <span ref={clockRef} className="lp-nav__clock" aria-hidden="true">{'05:30\u3000立春'}</span>
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
