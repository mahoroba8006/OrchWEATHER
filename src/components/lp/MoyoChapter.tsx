// src/components/lp/MoyoChapter.tsx
// 4. 空もよう（午後・晩夏）。「リスクでみる／概況でみる」を押すと、写真と説明が一緒に切り替わる。
// 押されるまでは、見えている間だけ自動で切り替える（最初はリスク）。一度押したら自動切替は止める。
// 動きを減らす設定では、自動切替と切り替えの動きだけを止め、押して切り替える操作は同じにする。
import { useEffect, useState, type CSSProperties } from 'react';
import { logLpMoyoToggle } from '../../lib/analytics';
import { useChapterView, useReduced, useVisibility } from './hooks';
import { LineReveal } from './primitives';
import './moyo.css';

const MODES = [
  { key: 'risk', label: 'リスクでみる', caption: 'その時間帯の、いちばん悪い天気', src: '/lp/moyo-risk.webp' },
  { key: 'gaikyo', label: '概況でみる', caption: 'その時間帯の、いちばん多い天気', src: '/lp/moyo-gaikyo.webp' },
] as const;
const RAIN_WORDS = ['ぽつぽつ', 'カッパ？', 'カッパ！'];
const POINTS = ['1日を、午前・午後・夜間の3つに', '露点・飽差・0℃層高度も、時間別に', '毎日、今日の節気と七十二候'];

export function MoyoChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('moyo');
  const [deviceRef, visible, seen] = useVisibility<HTMLDivElement>(0.35);
  const [mode, setMode] = useState(0);
  const [touched, setTouched] = useState(false);
  // 読み上げる文。押したときだけ書き換える（自動切替では変えない＝3.2秒ごとに読み上げない）
  const [announce, setAnnounce] = useState('');
  // 押されるまで・見えている間だけ自動で切り替える（画面外ではタイマーを止める）
  useEffect(() => {
    if (reduced || touched || !visible) return;
    const id = window.setInterval(() => setMode((m) => 1 - m), 3200);
    return () => window.clearInterval(id);
  }, [reduced, touched, visible]);

  const choose = (i: number) => {
    setTouched(true);
    setMode(i);
    setAnnounce(`${MODES[i].label}：${MODES[i].caption}`);
    logLpMoyoToggle(MODES[i].key);
  };

  return (
    <section ref={ref} className={reduced ? 'lp-ch lp-moyo lp-moyo--still' : 'lp-ch lp-moyo'} data-scene="0.47">
      <div className="lp-moyo__copy">
        <LineReveal lines={['今日の作業、', 'やるかやめるか', 'すぐ決まる。']} />
        <div className="lp-moyo__modes" role="group" aria-label="空もようの見方">
          {MODES.map((m, i) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={i === mode}
              aria-controls="lp-moyo-screen"
              className={i === mode ? 'is-on' : ''}
              onClick={() => choose(i)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="lp-moyo__hint">タップで切り替え</p>
        {/* 見える説明は読み上げない（自動切替のたびに読まれないように）。押したときだけ下の読み上げ用の行で知らせる。
            aria-live の領域は最初から置いておかないと、最初の一回が読まれないことがある */}
        <p className="lp-moyo__caption" aria-hidden="true">{MODES[mode].caption}</p>
        <p className="lp-sr" aria-live="polite">{announce}</p>
        <ul className="lp-moyo__points">
          {POINTS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
      <div ref={deviceRef} className={seen || reduced ? 'lp-moyo__device is-in' : 'lp-moyo__device'}>
        <figure id="lp-moyo-screen" className="lp-shot lp-shot--phone lp-moyo__phone">
          {MODES.map((m, i) => (
            <img
              key={m.key}
              src={m.src}
              alt={`空もよう — ${m.label}`}
              aria-hidden={i !== mode}
              width={780}
              height={1688}
              loading="lazy"
              decoding="async"
              className={i === mode ? 'is-on' : ''}
            />
          ))}
        </figure>
        <ul className="lp-moyo__rain" aria-label="3mmまでの雨の言い方">
          {RAIN_WORDS.map((w, i) => <li key={w} style={{ '--i': i } as CSSProperties}>{w}</li>)}
        </ul>
        <p className="lp-moyo__rainnote">3mmまでの雨は、3段階のことばで。</p>
      </div>
    </section>
  );
}
