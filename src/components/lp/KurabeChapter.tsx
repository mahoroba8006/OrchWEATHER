// src/components/lp/KurabeChapter.tsx
// 3. 空くらべ（昼・夏）。画面を止めて、積算温度の模式図の線がスクロールで伸び、
// 今年と去年の間に「18日」の差が現れる。続けて3つの要点が順に灯り、本物の画面2枚を見せる。
import { useRef, useState } from 'react';
import { GDD_LAG_DAYS, LP_FACTS_SOURCE, gddCurve } from './lpFacts';
import { stickyProgress, useChapterView, useReduced, useScrollFrame } from './hooks';
import { LineReveal, Shot } from './primitives';
import './kurabe.css';

// 模式図の範囲: 3月1日（60日目）〜11月30日（334日目）。撮影日は 10/5（278日目）
const D0 = 60;
const D1 = 334;
const TODAY = 278;
const X = (d: number) => 40 + ((d - D0) / (D1 - D0)) * 560;
const Y = (v: number) => 280 - (v / 3000) * 250;

function curvePath(lag: number, until: number): string {
  const pts: string[] = [];
  for (let d = D0; d <= until; d += 3) pts.push(`${X(d).toFixed(1)} ${Y(gddCurve(d, lag)).toFixed(1)}`);
  return `M${pts.join(' L')}`;
}

const LAST_YEAR = curvePath(0, D1);
const THIS_YEAR = curvePath(GDD_LAG_DAYS, TODAY);
const GAP_Y = Y(gddCurve(TODAY, GDD_LAG_DAYS));
const GAP_X0 = X(TODAY - GDD_LAG_DAYS);
const GAP_X1 = X(TODAY);
const MONTHS: [string, number][] = [['4月', 91], ['6月', 152], ['8月', 213], ['10月', 274]];
const POINTS = ['年をまたいで、重ねて比べる', '地点を並べて、違いを比べる', '積算温度を、自動で計算'];

export function KurabeChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('kurabe');
  const pinRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useScrollFrame(() => {
    if (reduced || !pinRef.current) return;
    setP(stickyProgress(pinRef.current));
  });
  const q = reduced ? 1 : p;
  const draw = Math.min(1, q / 0.5);
  const gapOn = q > 0.56;
  const lit = reduced ? 3 : [0.64, 0.74, 0.84].filter((t) => q > t).length;

  return (
    <section ref={ref} className={reduced ? 'lp-ch lp-kurabe lp-kurabe--still' : 'lp-ch lp-kurabe'} data-scene="0.4">
      <div ref={pinRef} className="lp-kurabe__pin">
      <div className="lp-kurabe__stage" data-sticky-stage>
        <LineReveal lines={['去年と、あの場所と、', '並べて見える。']} />
        <figure className="lp-kurabe__fig">
          <svg viewBox="0 0 640 320" role="img" aria-label={`積算温度の模式図。今年の線は去年より${GDD_LAG_DAYS}日遅れて伸びる`}>
            <line className="lp-kurabe__axis" x1="40" y1="280" x2="600" y2="280" />
            {MONTHS.map(([m, d]) => (
              <text key={m} className="lp-kurabe__tick" x={X(d)} y="304">{m}</text>
            ))}
            <path className="lp-kurabe__line lp-kurabe__line--last" d={LAST_YEAR} pathLength={1} style={{ strokeDashoffset: 1 - draw }} />
            <path className="lp-kurabe__line lp-kurabe__line--this" d={THIS_YEAR} pathLength={1} style={{ strokeDashoffset: 1 - draw }} />
            <text className="lp-kurabe__legend" x={X(318)} y={Y(gddCurve(318)) - 12}>去年</text>
            <text className="lp-kurabe__legend lp-kurabe__legend--this" x={X(TODAY) + 8} y={Y(gddCurve(TODAY, GDD_LAG_DAYS)) + 26}>今年</text>
            <g className={gapOn ? 'lp-kurabe__gap is-on' : 'lp-kurabe__gap'}>
              <line x1={GAP_X0} x2={GAP_X1} y1={GAP_Y} y2={GAP_Y} />
              <line x1={GAP_X0} x2={GAP_X0} y1={GAP_Y - 6} y2={GAP_Y + 6} />
              <line x1={GAP_X1} x2={GAP_X1} y1={GAP_Y - 6} y2={GAP_Y + 6} />
              <text x={(GAP_X0 + GAP_X1) / 2} y={GAP_Y - 14}>{GDD_LAG_DAYS}日</text>
            </g>
          </svg>
          <figcaption>図は模式です。数字は{LP_FACTS_SOURCE}（1月1日から・10℃基準）。</figcaption>
        </figure>
        <ul className="lp-kurabe__points">
          {POINTS.map((t, i) => <li key={t} className={i < lit ? 'is-on' : ''}>{t}</li>)}
        </ul>
      </div>
      </div>
      <p className="lp-kurabe__shotlead"><span className="lp-phrase">気温、降水量、積算温度、</span><span className="lp-phrase">日射量、日照時間、湿度、飽差まで。</span><br /><span className="lp-phrase">知りたい値がグラフで、</span><span className="lp-phrase">数値で見える。</span></p>
      <div className="lp-kurabe__shots">
        <Shot src="/lp/kurabe-temp.webp" alt="空くらべ — 今年と去年の気温を重ねたグラフ。9/20 をタップして、両年の最低・最高気温を表示" width={780} height={1262} />
        <Shot src="/lp/kurabe-gdd.webp" alt="空くらべ — 有効積算温度のグラフ。10/4 をタップして、累積の差（−252℃・18日遅い）を表示" width={780} height={1357} />
      </div>
    </section>
  );
}
