// src/components/lp/HunchChapter.tsx
// 1. 勘の章（朝・春）＝最大の見せ場。画面を止めたまま、スクロールで3つの勘を順に見せ、
// 言葉が一文字ずつ溶けて数字が数え上がる。最後に「勘を、数字で裏づける。」と、3つの比較結果を小さく残す。
// 動きを減らす設定では、縦に並べた静止表示にする。
import { useRef, useState, type CSSProperties } from 'react';
import { HUNCHES, LP_FACTS_SOURCE, hunchSummary, splitPhrases, type Hunch } from './lpFacts';
import { stickyProgress, useChapterView, useReduced, useScrollFrame } from './hooks';
import { CountUp, LineReveal } from './primitives';
import './hunch.css';

function Fact({ h, start }: { h: Hunch; start: boolean }) {
  return (
    <div className="lp-fact">
      <p className="lp-fact__label">{h.label}</p>
      <p className="lp-fact__value">
        <span className="lp-fact__before">{h.before}</span>
        <CountUp to={h.value} decimals={h.decimals} start={start} duration={600} delay={100} />
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
  // 数字を早く出し、長く見せる（速めのスクロールでも出きった数字が目に入るよう、各段の 7 割を数字の場面に）。
  // 境目（0.3）付近の小さな揺れで言葉と数字が行き来しないよう、0.26〜0.34 では直前の状態を保つ
  const last = useRef<{ st: number; phase: 'quote' | 'fact' }>({ st: -1, phase: 'quote' });

  useScrollFrame(() => {
    if (reduced || !ref.current) return;
    const x = stickyProgress(ref.current) * 3.6; // 勘3つ（各1）＋結論（0.6）
    const st = Math.min(3, Math.floor(x));
    const f = x - st;
    const next: 'quote' | 'fact' =
      st >= 3 ? 'fact'
        : st === last.current.st && f >= 0.26 && f <= 0.34 ? last.current.phase
          : f < 0.3 ? 'quote' : 'fact';
    last.current = { st, phase: next };
    setStage(st);
    setPhase(next);
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
      {/* 見せ場は今の場面しか描かないので、読み上げには3つの勘と数字をまとめて渡し、見せ場は読ませない */}
      <div className="lp-sr">
        <h2>勘を、数字で裏づける。</h2>
        <ol>
          {HUNCHES.map((x) => <li key={x.quote}>{x.quote}{hunchSummary(x)}</li>)}
        </ol>
        <p>{LP_FACTS_SOURCE}</p>
      </div>
      <div className="lp-hunch__stage" data-sticky-stage aria-hidden="true">
        {stage < 3 ? (
          <div key={stage} className={`lp-hunch__item is-${phase}`}>
            <p className="lp-hunch__quote">
              {(() => {
                let n = 0; // 句をまたいで通しの番号（一文字ずつ溶ける順番）
                return splitPhrases(h.quote).map((ph, j) => (
                  <span key={j} className="lp-hunch__phrase">
                    {[...ph].map((c) => {
                      const i = n++;
                      return <span key={i} style={{ '--i': i } as CSSProperties}>{c}</span>;
                    })}
                  </span>
                ));
              })()}
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
