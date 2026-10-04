// 節気ふりかえりカード。帯の下（節気の変わり目3日間）とシート内で共用する。
// 閲覧の計測は「見出し部の半分以上が画面に入った」時点（マウント＝閲覧ではない。カード全体を基準にすると
// 背の低い画面のシートでは半分が入らず計測されないため、見出し部で判定する）。重複除去は analytics 側。
import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { SekkiArt } from '../sky/sekkiArt';
import { WeatherIcon } from '../weather/WeatherIcon';
import { springs } from '../../lib/motion';
import { logSeasonCardView } from '../../lib/analytics';
import { HEAVY_RAIN_MM, monthDay, type CompareCell, type SeasonReview } from '../../lib/seasonReview';
import './season.css';

// 気温の色（天気タブの日別グラフ DailyForecast と同じ）。平年より高い/低い部分だけ色を付け、残りは灰色
const TEMP_MAX_COLOR = '#fb7185';
const TEMP_MIN_COLOR = '#2f6fd6'; // 平年より低い（青）
const TEMP_BASE_COLOR = '#4f9d72'; // 平年の範囲に収まる部分（緑）
const BAND_COLOR = 'rgba(62, 155, 110, 0.16)'; // 5年平均の範囲（淡い緑）
const RAIN_COLOR = '#7cc8ee'; // 雨（水色）
const TEMP_H = 100; // 気温の段の viewBox の高さ（横は日数×10）
const RAIN_H = 100; // 雨の段の viewBox の高さ

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
  const n = daily.length;
  const maxRain = Math.max(1, ...daily.map(r => r.precip));
  // 気温目盛は今年・5年平均を合わせた期間の（最低−1）〜（最高+1）。右端ラベルもこの上端・下端の値
  const tHi = Math.ceil(Math.max(...daily.map(r => Math.max(r.tempMax, r.avgMax)))) + 1;
  const tLo = Math.floor(Math.min(...daily.map(r => Math.min(r.tempMin, r.avgMin)))) - 1;
  const ty = (t: number) => ((tHi - t) / (tHi - tLo)) * TEMP_H;
  const cx = (i: number) => i * 10 + 5;
  const band = [
    ...daily.map((r, i) => `${i === 0 ? 'M' : 'L'}${cx(i)} ${ty(r.avgMax).toFixed(2)}`),
    ...daily.map((r, i) => `L${cx(i)} ${ty(r.avgMin).toFixed(2)}`).reverse(),
    'Z',
  ].join(' ');
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
        <div className="season-card__chart" role="img" aria-label={`日ごとの最高・最低気温と5年平均（${range}）`}>
          <svg viewBox={`0 0 ${n * 10} ${TEMP_H}`} preserveAspectRatio="none" aria-hidden="true">
            <path data-testid="normal-band" d={band} fill={BAND_COLOR} />
            {daily.map((r, i) => {
              const y1 = ty(r.tempMax), y2 = ty(r.tempMin);
              const hotH = Math.max(0, ty(Math.max(r.avgMax, r.tempMin)) - y1); // 平年の最高より上の部分
              const coldTop = ty(Math.min(r.avgMin, r.tempMax));
              const coldH = Math.max(0, y2 - coldTop); // 平年の最低より下の部分
              return (
                <g key={r.date}>
                  <rect data-testid="temp-bar" x={i * 10 + 3} y={y1} width={4} height={y2 - y1} rx={2} fill={TEMP_BASE_COLOR} />
                  {hotH > 0 && <rect data-testid="temp-hot" x={i * 10 + 3} y={y1} width={4} height={hotH} rx={2} fill={TEMP_MAX_COLOR} />}
                  {coldH > 0 && <rect data-testid="temp-cold" x={i * 10 + 3} y={coldTop} width={4} height={coldH} rx={2} fill={TEMP_MIN_COLOR} />}
                </g>
              );
            })}
          </svg>
          <span className="season-card__tick season-card__tick--hi" aria-hidden="true">{`${tHi}°`}</span>
          <span className="season-card__tick season-card__tick--lo" aria-hidden="true">{`${tLo}°`}</span>
        </div>
        <div className="season-card__raincol" role="img" aria-label={`日ごとの雨（${range}）`}>
          <div className="season-card__rainbars">
            <svg viewBox={`0 0 ${n * 10} ${RAIN_H}`} preserveAspectRatio="none" aria-hidden="true">
              {daily.map((r, i) => {
                const h = (r.precip / maxRain) * RAIN_H;
                return <rect key={r.date} x={i * 10 + 2} y={RAIN_H - h} width={6} height={h} fill={RAIN_COLOR} />;
              })}
            </svg>
            {daily.map((r, i) => r.precip >= HEAVY_RAIN_MM && (
              <span key={r.date} className="season-card__rain-label" style={{ left: `${((i + 0.5) / n) * 100}%` }} aria-hidden="true">{Math.round(r.precip)}</span>
            ))}
          </div>
        </div>
        <div className="season-card__icons" aria-hidden="true">
          {daily.map(r => (
            <span key={r.date}><WeatherIcon code={r.code} size={18} animated={false} /></span>
          ))}
        </div>
        <div className="season-card__axis" aria-hidden="true">
          <span>{monthDay(review.range.start)}</span>
          <span>日ごとの気温・雨・天気</span>
          <span>{monthDay(review.range.end)}</span>
        </div>
        <p className="season-card__legend" aria-hidden="true">
          <span><i style={{ background: BAND_COLOR }} />5年平均の範囲</span>
          <span><i style={{ background: TEMP_MAX_COLOR }} />平年より高い</span>
          <span><i style={{ background: TEMP_MIN_COLOR }} />平年より低い</span>
          <span><i style={{ background: RAIN_COLOR }} />雨</span>
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
