// src/components/lp/HunchChapter.tsx
// 1. 勘の章（朝・春）＝最大の見せ場。画面を止めたまま、スクロールで3つの勘を順に見せ、
// 言葉が一文字ずつ溶けて数字が数え上がる。最後に「勘を、数字で裏づける。」と、3つの比較結果を小さく残す。
// 動きを減らす設定では、縦に並べた静止表示にする。
import { useState, type CSSProperties } from 'react';
import { HUNCHES, LP_FACTS_SOURCE, hunchSummary, type Hunch } from './lpFacts';
import { stickyProgress, useChapterView, useReduced, useScrollFrame } from './hooks';
import { CountUp, LineReveal } from './primitives';
import './hunch.css';

function Fact({ h, start }: { h: Hunch; start: boolean }) {
  return (
    <div className="lp-fact">
      <p className="lp-fact__label">{h.label}</p>
      <p className="lp-fact__value">
        <span className="lp-fact__before">{h.before}</span>
        <CountUp to={h.value} decimals={h.decimals} start={start} duration={1200} />
        <span className="lp-fact__unit">{h.unit}</span>
      </p>
      <p className="lp-fact__note">{h.note}</p>
    </div>
  );
}

/** 結論。summary=true なら、その下に3つの比較結果を落ち着いた文字で残す（動きを減らす設定では、
 *  すでに3つの勘と数字を縦に並べているので重ねて出さない） */
function Conclusion({ summary = false }: { summary?: boolean }) {
  return (
    <div className="lp-hunch__end">
      <LineReveal lines={['勘を、', '数字で裏づける。']} />
      {summary && (
        <ul className="lp-hunch__summary">
          {HUNCHES.map((h, i) => (
            <li key={h.topic} style={{ '--i': i } as CSSProperties}>{hunchSummary(h)}</li>
          ))}
        </ul>
      )}
      <p className="lp-hunch__source">{LP_FACTS_SOURCE}</p>
    </div>
  );
}

export function HunchChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('hunch');
  const [stage, setStage] = useState(0); // 0〜2=勘、3=結論
  const [phase, setPhase] = useState<'quote' | 'fact'>('quote');

  useScrollFrame(() => {
    if (reduced || !ref.current) return;
    const x = stickyProgress(ref.current) * 3.6; // 勘3つ（各1）＋結論（0.6）
    const st = Math.min(3, Math.floor(x));
    setStage(st);
    setPhase(st < 3 && x - st < 0.42 ? 'quote' : 'fact');
  });

  if (reduced) {
    return (
      <section ref={ref} className="lp-ch lp-hunch lp-hunch--still" data-scene="0.1">
        <ol className="lp-hunch__list">
          {HUNCHES.map((h) => (
            <li key={h.quote}>
              <p className="lp-hunch__quote">{h.quote}</p>
              <Fact h={h} start />
            </li>
          ))}
        </ol>
        <Conclusion />
      </section>
    );
  }

  const h = HUNCHES[Math.min(stage, 2)];
  return (
    <section ref={ref} className="lp-ch lp-hunch" data-scene="0.1">
      <div className="lp-hunch__stage">
        {stage < 3 ? (
          <div key={stage} className={`lp-hunch__item is-${phase}`}>
            <p className="lp-hunch__quote" aria-label={h.quote}>
              {[...h.quote].map((c, i) => (
                <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>{c}</span>
              ))}
            </p>
            <Fact h={h} start={phase === 'fact'} />
          </div>
        ) : (
          <Conclusion summary />
        )}
        <div className="lp-hunch__meter" aria-hidden="true">
          {[0, 1, 2].map((i) => <i key={i} className={i <= stage ? 'is-on' : ''} />)}
        </div>
      </div>
    </section>
  );
}
