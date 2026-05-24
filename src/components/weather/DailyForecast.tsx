import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import type { DayRisk } from '../../lib/riskDetection';
import { RISK_BADGES } from '../../lib/riskDetection';
import { WeatherIcon, codeToLabel, dayTransitionLabel } from './WeatherIcon';

interface Props {
  daily: DailyForecastData[];
  dayRisks: DayRisk[];
  onHalfDayClick?: (date: string, ampm: 'am' | 'pm') => void;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const CARD_W = 86;   // px per day — mini chart geometry depends on this
const HALF_W = 65;   // px per AM / PM cell (split days = 2 × HALF_W)
const CHART_H = 60;
const SPLIT_DAYS = 3; // first N days get AM/PM split

function probColor(p: number): string {
  if (p >= 70) return 'var(--accent-blue)';
  if (p >= 40) return '#38bdf8';
  return 'var(--text-tertiary)';
}

interface DailyMiniChartProps {
  daily: DailyForecastData[];
  dayX: number[];        // 各日の左端 x 座標（測定済み）
  dayWidths: number[];   // 各日の幅 px（測定済み）
}

function DailyMiniChart({ daily, dayX, dayWidths }: DailyMiniChartProps) {
  const W = dayWidths.reduce((a, b) => a + b, 0);
  const H = CHART_H;
  const padT = 6;
  const padB = 6;
  const innerH = H - padT - padB;

  const tempMaxes = daily.map(d => d.tempMax);
  const tempMins  = daily.map(d => d.tempMin);
  const precips   = daily.map(d => d.precipSum);

  const tMin = Math.min(...tempMins, ...tempMaxes);
  const tMax = Math.max(...tempMaxes, ...tempMins);
  const tRange = tMax - tMin || 1;
  const pMax  = Math.max(...precips, 1);

  // 列幅は実測値ベース → AM/PM 中央も実測幅から算出
  const cx   = (i: number) => dayX[i] + dayWidths[i] / 2;
  const cxAm = (i: number) => dayX[i] + dayWidths[i] / 4;
  const cxPm = (i: number) => dayX[i] + dayWidths[i] * 0.75;
  const ty   = (t: number) => padT + (1 - (t - tMin) / tRange) * innerH;
  // バー高さ：気温線の下半分に収める（innerH の 45%）
  const ph  = (p: number) => p === 0 ? 0 : Math.max(1, (p / pMax) * innerH * 0.45);
  // バー幅：非分割日（CARD_W）と同じ固定幅で統一
  const barW = Math.round(CARD_W * 0.35);

  const makePath = (temps: number[]) => {
    const pts = temps.map((t, i) => [cx(i), ty(t)] as [number, number]);
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cpx = ((x0 + x1) / 2).toFixed(1);
      d += ` C ${cpx} ${y0.toFixed(1)} ${cpx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d;
  };

  const gridStep = 5;
  const gridMin = Math.ceil(tMin / gridStep) * gridStep;
  const gridMax = Math.floor(tMax / gridStep) * gridStep;
  const gridTemps: number[] = [];
  for (let v = gridMin; v <= gridMax; v += gridStep) gridTemps.push(v);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {gridTemps.map(v => (
        <g key={v}>
          <line x1={0} y1={ty(v)} x2={W} y2={ty(v)} style={{ stroke: 'var(--card-border-sub)' }} strokeWidth={1} />
          <text x={3} y={ty(v) - 2} fontSize={8} style={{ fill: 'var(--text-tertiary)' }}>{v}</text>
        </g>
      ))}
      {daily.map((day, i) => {
        const split = i < SPLIT_DAYS;
        if (split && day.amPrecipSum !== null) {
          // 分割日: AM 列・PM 列それぞれの中央にバーを配置（実測幅ベース）
          const cxA = cxAm(i);
          const cxP = cxPm(i);
          const amBh = ph(day.amPrecipSum);
          const pmBh = ph(day.pmPrecipSum ?? 0);
          return (
            <g key={i}>
              {amBh > 0 && (
                <>
                  <rect x={cxA - barW / 2} y={H - padB - amBh} width={barW} height={amBh} style={{ fill: 'var(--chart-precip)' }} opacity={0.6} rx={2} ry={2} />
                  <text x={cxA} y={H - padB - amBh - 2} fontSize={7} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">
                    {day.amPrecipSum.toFixed(1)}
                  </text>
                </>
              )}
              {pmBh > 0 && (
                <>
                  <rect x={cxP - barW / 2} y={H - padB - pmBh} width={barW} height={pmBh} style={{ fill: 'var(--chart-precip)' }} opacity={0.6} rx={2} ry={2} />
                  <text x={cxP} y={H - padB - pmBh - 2} fontSize={7} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">
                    {(day.pmPrecipSum ?? 0).toFixed(1)}
                  </text>
                </>
              )}
            </g>
          );
        }
        // 非分割日（または時間別データのない分割日）: 日合計1本バー
        const p = day.precipSum;
        const bh = ph(p);
        if (bh === 0) return null;
        return (
          <g key={i}>
            <rect x={cx(i) - barW / 2} y={H - padB - bh} width={barW} height={bh} style={{ fill: 'var(--chart-precip)' }} opacity={0.6} rx={2} ry={2} />
            <text x={cx(i)} y={H - padB - bh - 2} fontSize={8} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">
              {p.toFixed(1)}
            </text>
          </g>
        );
      })}
      <path d={makePath(tempMins)} fill="none" style={{ stroke: 'var(--accent-blue)' }} strokeWidth={2} strokeLinecap="round" />
      <path d={makePath(tempMaxes)} fill="none" style={{ stroke: 'var(--chart-temp)' }} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function DailyForecast({ daily, dayRisks, onHalfDayClick }: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [dayX, setDayX] = useState<number[] | null>(null);
  const [dayWidths, setDayWidths] = useState<number[] | null>(null);

  // テーブルレンダリング後に各 <col> の実描画幅を測定して、
  // SVG ミニチャートの座標系を実セル幅に合わせる
  useLayoutEffect(() => {
    const measure = () => {
      if (!tableRef.current) return;
      const cols = Array.from(tableRef.current.querySelectorAll('col'));
      const widths = cols.map(c => c.getBoundingClientRect().width);

      const newDayWidths: number[] = [];
      const newDayX: number[] = [];
      let colIdx = 0;
      let xAcc = 0;
      for (let i = 0; i < daily.length; i++) {
        newDayX.push(xAcc);
        if (i < SPLIT_DAYS) {
          const w = (widths[colIdx] ?? HALF_W) + (widths[colIdx + 1] ?? HALF_W);
          newDayWidths.push(w);
          xAcc += w;
          colIdx += 2;
        } else {
          const w = widths[colIdx] ?? CARD_W;
          newDayWidths.push(w);
          xAcc += w;
          colIdx += 1;
        }
      }
      setDayX(newDayX);
      setDayWidths(newDayWidths);
    };

    measure();
    // 列幅は基本的に変わらないが、リサイズで字体/レイアウトが変化する可能性に備える
    const observer = new ResizeObserver(measure);
    if (tableRef.current) observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [daily]);

  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jstNow.toISOString().slice(0, 10);

  const cellBg = (_day: DailyForecastData): string => 'rgba(255, 255, 255, 0.35)';

  const dayBorder = (i: number) =>
    i < daily.length - 1 ? '1px solid var(--card-border-sub)' : undefined;

  // colSpan=2 per day (date / temp / risk rows for split days)
  const spanCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.35rem 0.25rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  // single cell for days 3+ (original layout)
  const singleCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    width: CARD_W,
    minWidth: CARD_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.35rem 0.25rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  // AM cell (left half of split day)
  const amCell = (day: DailyForecastData, extra?: CSSProperties): CSSProperties => ({
    width: HALF_W,
    minWidth: HALF_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.3rem 0.15rem',
    verticalAlign: 'middle',
    borderRight: '1px solid var(--card-border-sub)',
    ...extra,
  });

  // PM cell (right half of split day)
  const pmCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    width: HALF_W,
    minWidth: HALF_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.3rem 0.15rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  // mini chart colSpan: split days × 2 + single days × 1
  const chartColSpan = SPLIT_DAYS * 2 + (daily.length - SPLIT_DAYS);

  return (
    <div>
      <div style={{ overflowX: 'auto', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--card-border-sub)', boxShadow: 'var(--shadow-sm)' }}>
        <table ref={tableRef} style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {daily.flatMap((day, i) =>
              i < SPLIT_DAYS
                ? [
                    <col key={`${day.date}-am`} style={{ width: HALF_W }} />,
                    <col key={`${day.date}-pm`} style={{ width: HALF_W }} />,
                  ]
                : [<col key={day.date} style={{ width: CARD_W }} />]
            )}
          </colgroup>
          <tbody>
            {/* 日付 */}
            <tr>
              {daily.map((day, i) => {
                const split = i < SPLIT_DAYS;
                const isToday = day.date === today;
                const dow = new Date(`${day.date}T00:00:00`).getDay();
                const mm = parseInt(day.date.slice(5, 7), 10);
                const dd = parseInt(day.date.slice(8, 10), 10);
                const label = isToday ? `今日 ${mm}/${dd}` : `${mm}/${dd}(${DAY_NAMES[dow]})`;
                return (
                  <td
                    key={day.date}
                    colSpan={split ? 2 : 1}
                    style={{ ...(split ? spanCell(day, i) : singleCell(day, i)), paddingTop: '0.75rem' }}
                  >
                    <div style={{ fontSize: '0.75rem', color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 500 }}>
                      {label}
                    </div>
                    {(() => {
                      const tl = split
                        ? dayTransitionLabel(day.amWeatherCode, day.pmWeatherCode)
                        : codeToLabel(day.weatherCode);
                      return tl ? (
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '0.15rem', fontWeight: 500 }}>{tl}</div>
                      ) : null;
                    })()}
                  </td>
                );
              })}
            </tr>
            {/* 天気アイコン（午前・午後ラベルをセル内に内包） */}
            <tr>
              {daily.map((day, i) => {
                if (i < SPLIT_DAYS) {
                  return (
                    <Fragment key={day.date}>
                      <td
                        style={{ ...amCell(day), cursor: onHalfDayClick ? 'pointer' : undefined }}
                        onClick={() => onHalfDayClick?.(day.date, 'am')}
                      >
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, lineHeight: 1.4 }}>午前</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                          {day.amWeatherCode !== null ? <WeatherIcon code={day.amWeatherCode} size={84} /> : '—'}
                        </div>
                      </td>
                      <td
                        style={{ ...pmCell(day, i), cursor: onHalfDayClick ? 'pointer' : undefined }}
                        onClick={() => onHalfDayClick?.(day.date, 'pm')}
                      >
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, lineHeight: 1.4 }}>午後</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                          {day.pmWeatherCode !== null ? <WeatherIcon code={day.pmWeatherCode} size={84} /> : '—'}
                        </div>
                      </td>
                    </Fragment>
                  );
                }
                return (
                  <td key={day.date} style={singleCell(day, i)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                      <WeatherIcon code={day.weatherCode} size={84} />
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 降水確率 */}
            <tr>
              {daily.map((day, i) => {
                if (i < SPLIT_DAYS) {
                  return (
                    <Fragment key={day.date}>
                      <td style={amCell(day)}>
                        <div style={{
                          fontSize: '0.72rem',
                          color: day.amPrecipProb !== null ? probColor(day.amPrecipProb) : 'var(--text-tertiary)',
                          fontWeight: day.amPrecipProb !== null && day.amPrecipProb >= 70 ? 700 : undefined,
                        }}>
                          {day.amPrecipProb !== null ? `${day.amPrecipProb}%` : '—'}
                        </div>
                      </td>
                      <td style={pmCell(day, i)}>
                        <div style={{
                          fontSize: '0.72rem',
                          color: day.pmPrecipProb !== null ? probColor(day.pmPrecipProb) : 'var(--text-tertiary)',
                          fontWeight: day.pmPrecipProb !== null && day.pmPrecipProb >= 70 ? 700 : undefined,
                        }}>
                          {day.pmPrecipProb !== null ? `${day.pmPrecipProb}%` : '—'}
                        </div>
                      </td>
                    </Fragment>
                  );
                }
                return (
                  <td key={day.date} style={singleCell(day, i)}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>降水 {day.precipProbMax}%</div>
                  </td>
                );
              })}
            </tr>
            {/* 最高・最低気温 */}
            <tr>
              {daily.map((day, i) => {
                const split = i < SPLIT_DAYS;
                return (
                  <td key={day.date} colSpan={split ? 2 : 1} style={split ? spanCell(day, i) : singleCell(day, i)}>
                    <div style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                      <span style={{ color: '#fb7185', fontWeight: 700 }}>{Math.round(day.tempMax)}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: '0 0.2rem', fontSize: '0.8rem' }}>/</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{Math.round(day.tempMin)}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* ミニチャート（実測列幅が揃ってから描画） */}
            <tr>
              <td colSpan={chartColSpan} style={{ padding: 0 }}>
                {dayX && dayWidths ? (
                  <DailyMiniChart daily={daily} dayX={dayX} dayWidths={dayWidths} />
                ) : (
                  <div style={{ height: CHART_H }} />
                )}
              </td>
            </tr>
            {/* リスク */}
            <tr>
              {daily.map((day, i) => {
                const split = i < SPLIT_DAYS;
                const riskDay = dayRisks.find(r => r.date === day.date);
                const hasRisk = riskDay !== undefined && riskDay.risks.length > 0;
                return (
                  <td
                    key={day.date}
                    colSpan={split ? 2 : 1}
                    style={{ ...(split ? spanCell(day, i) : singleCell(day, i)), paddingBottom: '0.6rem', verticalAlign: 'top' }}
                  >
                    {hasRisk && riskDay && (
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        {riskDay.risks.map(r => {
                          const badge = RISK_BADGES[r];
                          return (
                            <img
                              key={r}
                              src={`/icons/weather/${badge.iconFile}.svg`}
                              width={32}
                              height={32}
                              alt={badge.label}
                              style={{
                                display: 'inline-block',
                                verticalAlign: 'middle',
                                ...(r === 'heat' ? { filter: 'drop-shadow(0 0 3px #f87171)' } : {}),
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
