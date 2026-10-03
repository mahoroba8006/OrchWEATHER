// 節気ふりかえりカード。帯の下（節気の変わり目3日間）とシート内で共用する。
// 閲覧の計測は「本体の半分以上が画面に入った」時点（マウント＝閲覧ではない）。重複除去は analytics 側。
import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { SekkiArt } from '../sky/sekkiArt';
import { springs } from '../../lib/motion';
import { logSeasonCardView } from '../../lib/analytics';
import { monthDay, type CompareCell, type SeasonReview } from '../../lib/seasonReview';
import './season.css';

function Cell({ c }: { c: CompareCell }) {
  return <td className={`season-card__cmp season-card__cmp--${c.tone}`}>{c.text}</td>;
}

export function SeasonReviewCard({ review, source }: { review: SeasonReview; source: 'inline' | 'sheet' }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        logSeasonCardView(source);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [source]);

  const maxRain = Math.max(1, ...review.rain.map(r => r.value));
  const { hottest, coolestMorning, heavyRain } = review.records;
  return (
    <article ref={ref} className="season-card" aria-label={`${review.range.name}のふりかえり`}>
      <header className="season-card__head">
        <SekkiArt index={review.range.index} size={56} className="season-card__art" />
        <div className="season-card__heading">
          <p className="season-card__period">{`ふりかえり ─ ${review.periodLabel}`}</p>
          <h3 className="season-card__title">{review.headline}</h3>
        </div>
      </header>

      <table className="season-card__table">
        <thead>
          <tr>
            <td aria-hidden="true" />
            <th scope="col">今年</th>
            <th scope="col">去年比</th>
            <th scope="col">5年平均比</th>
          </tr>
        </thead>
        <tbody>
          {review.rows.map(r => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="season-card__value">{r.value}</td>
              <Cell c={r.vsLastYear} />
              <Cell c={r.vsAvg} />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="season-card__rain">
        <div className="season-card__bars" role="img" aria-label={`日ごとの雨（${monthDay(review.range.start)}〜${monthDay(review.range.end)}）`}>
          {review.rain.map(r => (
            <i key={r.date} style={{ height: `${(r.value / maxRain) * 100}%` }} />
          ))}
        </div>
        <div className="season-card__axis" aria-hidden="true">
          <span>{monthDay(review.range.start)}</span>
          <span>日ごとの雨</span>
          <span>{monthDay(review.range.end)}</span>
        </div>
      </div>

      <dl className="season-card__records">
        <div><dt>いちばん暑い日</dt><dd>{`${monthDay(hottest.date)} ${hottest.value.toFixed(1)}℃`}</dd></div>
        <div><dt>いちばん涼しい朝</dt><dd>{`${monthDay(coolestMorning.date)} ${coolestMorning.value.toFixed(1)}℃`}</dd></div>
        <div><dt>まとまった雨</dt><dd>{heavyRain ? `${monthDay(heavyRain.date)} ${Math.round(heavyRain.value)}mm` : 'なし'}</dd></div>
      </dl>

      <p className="season-card__note">{`比較は同じ月日の期間の実績。5年平均は${review.avgYears}の平均です。`}</p>
    </article>
  );
}

/** 帯の下に、高さを滑らかに広げて登場させる（reduced-motion は MotionProvider 側で即時化） */
export function SeasonInlineCard({ review }: { review: SeasonReview }) {
  return (
    <m.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      transition={springs.enter}
      style={{ overflow: 'hidden' }}
    >
      <SeasonReviewCard review={review} source="inline" />
    </m.div>
  );
}
