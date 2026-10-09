// 節気ふりかえりカード。帯の下（節気の変わり目3日間・閉じたら出さない）とシート内で共用する。
// 閲覧の計測は「見出し部の半分以上が画面に入った」時点（マウント＝閲覧ではない。カード全体を基準にすると
// 背の低い画面のシートでは半分が入らず計測されないため、見出し部で判定する）。重複除去は analytics 側。
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { SekkiArt } from '../sky/sekkiArt';
import { WeatherIcon } from '../weather/WeatherIcon';
import { springs } from '../../lib/motion';
import { logSeasonCardDismiss, logSeasonCardView } from '../../lib/analytics';
import { dismissSeasonCard, isSeasonCardDismissed } from '../../lib/seasonCardDismiss';
import { HEAVY_RAIN_MM, monthDay, type CompareCell, type SeasonReview } from '../../lib/seasonReview';
import './season.css';

// 気温の色（天気タブの日別グラフ DailyForecast と同じ）。5年平均より高い/低い部分だけ色を付け、残りは灰色
const TEMP_MAX_COLOR = '#fb7185';
const TEMP_MIN_COLOR = '#2f6fd6'; // 5年平均より低い（青）
const TEMP_BASE_COLOR = '#4f9d72'; // 5年平均の範囲に収まる部分（緑）
const BAND_COLOR = 'rgba(62, 155, 110, 0.16)'; // 5年平均の範囲（淡い緑）
const RAIN_COLOR = '#7cc8ee'; // 雨（水色）
const TEMP_H = 100; // 気温の段の viewBox の高さ（横は日数×10）
const RAIN_H = 100; // 雨の段の viewBox の高さ

function Cell({ c }: { c: CompareCell | null }) {
  if (!c) return null;
  return <td className={`season-card__cmp season-card__cmp--${c.tone}`}>{c.text}</td>;
}

export function SeasonReviewCard({ review, source, onClose }: { review: SeasonReview; source: 'inline' | 'sheet'; onClose?: () => void }) {
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
  const { progress } = review;
  // 途中経過は節気の全日数ぶんの横幅を取り、昨日までを左から描く（残りは空き）
  const n = progress ? progress.total : daily.length;
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
  const { hottest, coldest, heavyRain } = review.records;
  return (
    <article className="season-card" aria-label={`${review.range.name}のふりかえり`}>
      <header ref={ref} className="season-card__head">
        <SekkiArt index={review.range.index} size={56} className="season-card__art" />
        <div className="season-card__heading">
          {/* シートでは見出しに節気名があるので、帯の下のカードだけ札で何のカードかを示す */}
          {source === 'inline' && <p className="season-card__tag">{`${review.range.name}のふりかえり`}</p>}
          <p className="season-card__period">
            {review.periodLabel}
            {review.headlineBase && <span className="season-card__base">{`${review.headlineBase}に比べて`}</span>}
          </p>
          {!progress && <h3 className="season-card__title">{review.headline}</h3>}
        </div>
        {onClose && (
          <button type="button" className="season-card__close" aria-label={`${review.range.name}のふりかえりを閉じる`} onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        )}
      </header>

      <table className="season-card__table">
        <thead>
          <tr>
            <th scope="col"><span className="season-card__sr">項目</span></th>
            <th scope="col">今年</th>
            {!progress && <th scope="col">去年比</th>}
            {!progress && <th scope="col">5年平均比</th>}
          </tr>
        </thead>
        <tbody>
          {review.rows.map(r => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="season-card__value">{r.value}</td>
              {!progress && <Cell c={r.vsLastYear} />}
              {!progress && <Cell c={r.vsAvg} />}
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
              const hotH = Math.max(0, ty(Math.max(r.avgMax, r.tempMin)) - y1); // 5年平均の最高より上の部分
              const coldTop = ty(Math.min(r.avgMin, r.tempMax));
              const coldH = Math.max(0, y2 - coldTop); // 5年平均の最低より下の部分
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
          </div>
          {/* まとまった雨の日の数値は、棒の下（天気アイコンの上）の段に。単位は右端の余白に */}
          <div className="season-card__rainvals" aria-hidden="true">
            {daily.map((r, i) => r.precip >= HEAVY_RAIN_MM && (
              <span key={r.date} className="season-card__rain-label" style={{ left: `${((i + 0.5) / n) * 100}%` }}>{Math.round(r.precip)}</span>
            ))}
          </div>
          <span className="season-card__rain-unit" aria-hidden="true">mm</span>
        </div>
        <div className="season-card__icons" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => {
            const r = daily[i];
            return <span key={i}>{r && <WeatherIcon code={r.code} size={18} animated={false} />}</span>;
          })}
        </div>
        <div className="season-card__axis" aria-hidden="true">
          <span>{monthDay(review.range.start)}</span>
          <span>日ごとの気温・雨・天気</span>
          <span>{monthDay(review.range.end)}</span>
        </div>
        <p className="season-card__legend" aria-hidden="true">
          <span><i style={{ background: BAND_COLOR }} />5年平均の範囲</span>
          <span><i style={{ background: TEMP_MAX_COLOR }} />5年平均より高い</span>
          <span><i style={{ background: TEMP_MIN_COLOR }} />5年平均より低い</span>
          <span><i style={{ background: RAIN_COLOR }} />雨</span>
        </p>
      </div>

      <dl className="season-card__records">
        {/* 言葉は季節に合わせる（夏は暑い/涼しい、冬は暖かい/寒い）。比べているのは最高・最低気温なので値に添える */}
        <div><dt>{review.recordLabels.warm}</dt><dd>{`${monthDay(hottest.date)} 最高 ${hottest.value.toFixed(1)}℃`}</dd></div>
        <div><dt>{review.recordLabels.cold}</dt><dd>{`${monthDay(coldest.date)} 最低 ${coldest.value.toFixed(1)}℃`}</dd></div>
        <div><dt>まとまった雨</dt><dd>{heavyRain ? `${monthDay(heavyRain.date)} ${Math.round(heavyRain.value)}mm` : 'なし'}</dd></div>
      </dl>

      <p className="season-card__note">
        {progress
          ? '昨日までの実績です。天気は雨量と日照からの目安です。'
          : `比較は同じ月日の期間の実績。5年平均は${review.avgYears}の平均です。天気は雨量と日照からの目安です。`}
      </p>
    </article>
  );
}

/** 帯の下に、高さを滑らかに広げて登場させる（reduced-motion は MotionProvider 側で即時化）。
 *  閉じたらその節気のカードは端末では二度と出さず、節気名から見られることを数秒だけ知らせる */
export function SeasonInlineCard({ review }: { review: SeasonReview }) {
  const start = review.range.start;
  const [closed, setClosed] = useState(() => isSeasonCardDismissed(start));
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(t);
  }, [hint]);
  const close = () => {
    dismissSeasonCard(start);
    logSeasonCardDismiss();
    setClosed(true);
    setHint(true);
  };
  return (
    <>
      <AnimatePresence initial={false}>
        {!closed && (
          <m.div
            key={start}
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            // 開き終えたら overflow を戻し、カードの影が切れないようにする
            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            transition={springs.enter}
          >
            <SeasonReviewCard review={review} source="inline" onClose={close} />
          </m.div>
        )}
      </AnimatePresence>
      {/* 閉じた後の知らせ。中身が無い間は CSS（:empty）で消し、並びの余白を取らない */}
      {closed && (
        <p className="season-card__hint" role="status">
          <AnimatePresence>
            {hint && (
              <m.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {`${review.range.name}のふりかえりは、上の節気名をタップするといつでも見られます`}
              </m.span>
            )}
          </AnimatePresence>
        </p>
      )}
    </>
  );
}

/** 閉じた後の知らせを出しておく時間 */
const HINT_MS = 5000;
