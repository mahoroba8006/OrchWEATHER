// 節気ふりかえりカード。帯の下（節気の変わり目3日間）とシート内で共用する。
// 閲覧の計測は「見出し部の半分以上が画面に入った」時点（マウント＝閲覧ではない。カード全体を基準にすると
// 背の低い画面のシートでは半分が入らず計測されないため、見出し部で判定する）。重複除去は analytics 側。
import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { SekkiArt } from '../sky/sekkiArt';
import { WeatherIcon } from '../weather/WeatherIcon';
import { springs } from '../../lib/motion';
import { logSeasonCardView } from '../../lib/analytics';
import { monthDay, type CompareCell, type SeasonReview } from '../../lib/seasonReview';
import './season.css';

// 気温線の色（天気タブの日別グラフ DailyForecast と同じ）
const TEMP_MAX_COLOR = '#fb7185';
const TEMP_MIN_COLOR = '#7dd3fc';
const CHART_H = 100; // viewBox の高さ（横は日数×10）
const RAIN_AREA = 0.45; // 雨の棒が使う高さの上限（下側）。上側は気温線のために空ける

// 純関数でテストするため export（Fast refresh はこのファイルでは不要）
/** 点列を単調3次補間で滑らかにつないだ SVG パス（両端の点を必ず通り、値を行き過ぎない） */
// eslint-disable-next-line react-refresh/only-export-components
export function smoothPath(pts: [number, number][]): string {
  // 単調3次補間（Fritsch–Carlson）。山と谷を行き過ぎず、実際の値より高く/低く見せない
  const n = pts.length;
  if (n === 0) return '';
  const f = (v: number) => +v.toFixed(2);
  if (n === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const slope = pts.slice(0, -1).map((p, i) => (pts[i + 1][1] - p[1]) / (pts[i + 1][0] - p[0]));
  const tan = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue; }
    const a = tan[i] / slope[i], b = tan[i + 1] / slope[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); tan[i] = t * a * slope[i]; tan[i + 1] = t * b * slope[i]; }
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = (x1 - x0) / 3;
    d += ` C${f(x0 + h)} ${f(y0 + tan[i] * h)} ${f(x1 - h)} ${f(y1 - tan[i + 1] * h)} ${f(x1)} ${f(y1)}`;
  }
  return d;
}

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

  const { daily } = review;
  const maxRain = Math.max(1, ...daily.map(r => r.precip));
  // 気温目盛は期間の（最低−1）〜（最高+1）。右端ラベルもこの上端・下端の値
  const tHi = Math.max(...daily.map(r => r.tempMax)) + 1;
  const tLo = Math.min(...daily.map(r => r.tempMin)) - 1;
  const ty = (t: number) => ((tHi - t) / (tHi - tLo)) * CHART_H;
  const line = (pick: (r: (typeof daily)[number]) => number) => smoothPath(daily.map((r, i) => [i * 10 + 5, ty(pick(r))]));
  const range = `${monthDay(review.range.start)}〜${monthDay(review.range.end)}`;
  const { hottest, coolestMorning, heavyRain } = review.records;
  return (
    <article className="season-card" aria-label={`${review.range.name}のふりかえり`}>
      <header ref={ref} className="season-card__head">
        <SekkiArt index={review.range.index} size={56} className="season-card__art" />
        <div className="season-card__heading">
          <p className="season-card__period">{review.periodLabel}</p>
          <h3 className="season-card__title">{review.headline}</h3>
        </div>
      </header>

      <table className="season-card__table">
        <thead>
          <tr>
            <th scope="col"><span className="season-card__sr">項目</span></th>
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
        <div className="season-card__chart" role="img" aria-label={`日ごとの雨と気温（${range}）`}>
          <svg viewBox={`0 0 ${daily.length * 10} ${CHART_H}`} preserveAspectRatio="none" aria-hidden="true">
            {daily.map((r, i) => {
              const h = (r.precip / maxRain) * CHART_H * RAIN_AREA;
              return <rect key={r.date} x={i * 10 + 2} y={CHART_H - h} width={6} height={h} fill="rgba(var(--accent-rgb), 0.55)" />;
            })}
            <path d={line(r => r.tempMin)} fill="none" stroke={TEMP_MIN_COLOR} strokeWidth={1.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={line(r => r.tempMax)} fill="none" stroke={TEMP_MAX_COLOR} strokeWidth={1.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="season-card__tick season-card__tick--hi" aria-hidden="true">{`${Math.round(tHi)}°`}</span>
          <span className="season-card__tick season-card__tick--lo" aria-hidden="true">{`${Math.round(tLo)}°`}</span>
        </div>
        <div className="season-card__icons" aria-hidden="true">
          {daily.map(r => (
            <span key={r.date}><WeatherIcon code={r.code} size={18} animated={false} /></span>
          ))}
        </div>
        <div className="season-card__axis" aria-hidden="true">
          <span>{monthDay(review.range.start)}</span>
          <span>日ごとの雨・気温・天気</span>
          <span>{monthDay(review.range.end)}</span>
        </div>
        <p className="season-card__legend" aria-hidden="true">
          <span style={{ color: TEMP_MAX_COLOR }}>●</span> 最高気温{'　'}<span style={{ color: TEMP_MIN_COLOR }}>●</span> 最低気温{'　'}<span style={{ color: 'rgba(var(--accent-rgb), 0.8)' }}>▮</span> 雨
        </p>
      </div>

      <dl className="season-card__records">
        <div><dt>いちばん暑い日</dt><dd>{`${monthDay(hottest.date)} ${hottest.value.toFixed(1)}℃`}</dd></div>
        <div><dt>いちばん涼しい朝</dt><dd>{`${monthDay(coolestMorning.date)} ${coolestMorning.value.toFixed(1)}℃`}</dd></div>
        <div><dt>まとまった雨</dt><dd>{heavyRain ? `${monthDay(heavyRain.date)} ${Math.round(heavyRain.value)}mm` : 'なし'}</dd></div>
      </dl>

      <p className="season-card__note">{`比較は同じ月日の期間の実績。5年平均は${review.avgYears}の平均です。天気は雨量と日照からの目安です。`}</p>
    </article>
  );
}

/** 帯の下に、高さを滑らかに広げて登場させる（reduced-motion は MotionProvider 側で即時化） */
export function SeasonInlineCard({ review }: { review: SeasonReview }) {
  return (
    <m.div
      initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
      // 開き終えたら overflow を戻し、カードの影が切れないようにする
      animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
      transition={springs.enter}
    >
      <SeasonReviewCard review={review} source="inline" />
    </m.div>
  );
}
