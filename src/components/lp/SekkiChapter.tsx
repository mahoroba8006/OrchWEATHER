// src/components/lp/SekkiChapter.tsx
// 2. 節気のふりかえり（昼前・初夏）。縦スクロールで24枚の節気の水彩画が横へ流れ、
// 処暑で止まって本物のふりかえりカードがせり上がる。動きを減らす設定では横にスワイプできる静止表示。
import { useRef, useState, type CSSProperties } from 'react';
import { SEKKI } from '../../lib/sekki';
import { SekkiArt } from '../sky/sekkiArt';
import { stickyProgress, useChapterView, useReduced, useScrollFrame } from './hooks';
import { LineReveal, Shot } from './primitives';
import './sekki.css';

/** 季節ごとの台の色（白い絵が映える深さ）。春・夏・秋・冬 */
const TILE_BASE = ['#6f9cc4', '#2f6fae', '#a2643a', '#4b5d7a'];
/** 止める節気＝撮影したカードの節気（処暑） */
const FOCUS = 13;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function SekkiChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('sekki');
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(false);

  useScrollFrame(() => {
    const pin = pinRef.current;
    const track = trackRef.current;
    if (reduced || !pin || !track) return;
    const p = stickyProgress(pin);
    const focus = track.children[FOCUS] as HTMLElement | undefined;
    if (!focus) return;
    const target = focus.offsetLeft + focus.offsetWidth / 2 - window.innerWidth / 2;
    track.style.transform = `translate3d(${(-target * easeInOut(Math.min(1, p / 0.6))).toFixed(1)}px, 0, 0)`;
    setShown(p > 0.62);
  });

  const cls = ['lp-ch', 'lp-sekki', reduced ? 'lp-sekki--still' : '', shown || reduced ? 'is-shown' : ''].filter(Boolean).join(' ');
  return (
    <section ref={ref} className={cls} data-scene="0.27">
      <div ref={pinRef} className="lp-sekki__pin">
      <div className="lp-sekki__stage">
        <div className="lp-sekki__head">
          <LineReveal lines={['二十四節気ごとに、', '今年の半月を一枚に。']} />
          <p className="lp-vertical lp-sekki__aside">暦は、農の時計だった。</p>
        </div>
        <div className="lp-sekki__body">
        <div className="lp-sekki__rail">
          <ol ref={trackRef} className="lp-sekki__track">
            {SEKKI.map((s, i) => (
              <li
                key={s.name}
                className={i === FOCUS ? 'lp-sekki__tile is-focus' : 'lp-sekki__tile'}
                style={{ '--tile': TILE_BASE[Math.floor(i / 6)] } as CSSProperties}
              >
                <SekkiArt index={i} size={72} variant="backdrop" />
                <span className="lp-sekki__name">{s.name}</span>
                <span className="lp-sekki__reading">{s.reading}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="lp-sekki__card">
          <Shot src="/lp/review-card-2.webp" alt="節気のふりかえりカード（処暑）— 去年・5年平均と比べた気温・雨・日照" width={780} height={1114} />
        </div>
        </div>
      </div>
      </div>
      <div className="lp-sekki__band">
        <p className="lp-sekki__bandlead">毎日、トップに一行で。</p>
        <Shot variant="band" src="/lp/season-band.webp" alt="季節のあしどり — 積算温度 去年より18日遅い・5年平均より12日遅い" width={780} height={106} />
      </div>
    </section>
  );
}
