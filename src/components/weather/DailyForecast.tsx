import { Fragment, type CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import type { DayRisk } from '../../lib/riskDetection';
import { RISK_BADGES } from '../../lib/riskDetection';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  daily: DailyForecastData[];
  dayRisks: DayRisk[];
  onHalfDayClick?: (date: string, ampm: 'am' | 'pm') => void;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const CARD_W = 96;   // px per day — mini chart geometry depends on this
const HALF_W = 72;   // px per AM / PM cell (split days = 2 × HALF_W)
const CHART_H = 60;
const SPLIT_DAYS = 3; // first N days get AM/PM split

function probColor(p: number): string {
  if (p >= 70) return '#2a6abf';
  if (p >= 40) return '#5a8fd4';
  return '#a8aebc';
}

function DailyMiniChart({ daily }: { daily: DailyForecastData[] }) {
  const N = daily.length;
  const dayWidths = daily.map((_, i) => (i < SPLIT_DAYS ? 2 * HALF_W : CARD_W));
  const W = dayWidths.reduce((a, b) => a + b, 0);
  const H = CHART_H;
  const padT = 6;
  const padB = 6;
  const innerH = H - padT - padB;

  const dayX: number[] = [];
  let acc = 0;
  for (let i = 0; i < N; i++) { dayX.push(acc); acc += dayWidths[i]; }

  const tempMaxes = daily.map(d => d.tempMax);
  const tempMins = daily.map(d => d.tempMin);
  const precips = daily.map(d => d.precipSum);

  const tMin = Math.min(...tempMins, ...tempMaxes);
  const tMax = Math.max(...tempMaxes, ...tempMins);
  const tRange = tMax - tMin || 1;
  const pMax = Math.max(...precips, 1);

  const cx = (i: number) => dayX[i] + dayWidths[i] / 2;
  const ty = (t: number) => padT + (1 - (t - tMin) / tRange) * innerH;
  const ph = (p: number) => p === 0 ? 0 : Math.max(1, (p / pMax) * innerH * 0.45);

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
          <line x1={0} y1={ty(v)} x2={W} y2={ty(v)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={3} y={ty(v) - 2} fontSize={8} fill="#c5c9d3">{v}</text>
        </g>
      ))}
      {precips.map((p, i) => {
        const bh = ph(p);
        if (bh === 0) return null;
        const dw = dayWidths[i];
        return (
          <g key={i}>
            <rect
              x={dayX[i] + dw * 0.325}
              y={H - padB - bh}
              width={dw * 0.35}
              height={bh}
              fill="#93c5fd"
              opacity={0.75}
            />
            <text
              x={cx(i)}
              y={H - padB - bh - 2}
              fontSize={8}
              fill="#60a5fa"
              textAnchor="middle"
              dominantBaseline="auto"
            >
              {p.toFixed(1)}
            </text>
          </g>
        );
      })}
      <path d={makePath(tempMins)} fill="none" stroke="#7da6d9" strokeWidth={1.5} strokeLinecap="round" />
      <path d={makePath(tempMaxes)} fill="none" stroke="#e08a7f" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function DailyForecast({ daily, dayRisks, onHalfDayClick }: Props) {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jstNow.toISOString().slice(0, 10);

  const cellBg = (day: DailyForecastData): string | undefined => {
    if (day.date === today) return '#f8fbff';
    if (dayRisks.some(r => r.date === day.date && r.risks.length > 0)) return '#fafaf6';
    return undefined;
  };

  const dayBorder = (i: number) =>
    i < daily.length - 1 ? '1px solid #f3f4f8' : undefined;

  // colSpan=2 per day (date / temp / risk rows for split days)
  const spanCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.25rem 0.25rem',
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
    padding: '0.25rem 0.25rem',
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
    padding: '0.2rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: '1px solid #eef0f6',
    ...extra,
  });

  // PM cell (right half of split day)
  const pmCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    width: HALF_W,
    minWidth: HALF_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.2rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  // mini chart colSpan: split days × 2 + single days × 1
  const chartColSpan = SPLIT_DAYS * 2 + (daily.length - SPLIT_DAYS);

  return (
    <div>
      <div style={{ padding: '0.9rem 1rem 0.4rem', fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em' }}>
        日別 ／ 今日〜10日後
      </div>
      <div style={{ overflowX: 'auto', background: '#fff', borderTop: '1px solid #ebeef5', borderBottom: '1px solid #ebeef5' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
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
                    style={{ ...(split ? spanCell(day, i) : singleCell(day, i)), paddingTop: '0.6rem' }}
                  >
                    <div style={{ fontSize: '0.72rem', color: isToday ? '#5e8ad1' : '#5b6478', fontWeight: isToday ? 600 : undefined }}>
                      {label}
                    </div>
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
                        <div style={{ fontSize: '0.6rem', color: '#b0b5c4', lineHeight: 1.4 }}>午前</div>
                        <div style={{ lineHeight: 1 }}>
                          {day.amWeatherCode !== null ? <WeatherIcon code={day.amWeatherCode} size={42} /> : '—'}
                        </div>
                      </td>
                      <td
                        style={{ ...pmCell(day, i), cursor: onHalfDayClick ? 'pointer' : undefined }}
                        onClick={() => onHalfDayClick?.(day.date, 'pm')}
                      >
                        <div style={{ fontSize: '0.6rem', color: '#b0b5c4', lineHeight: 1.4 }}>午後</div>
                        <div style={{ lineHeight: 1 }}>
                          {day.pmWeatherCode !== null ? <WeatherIcon code={day.pmWeatherCode} size={42} /> : '—'}
                        </div>
                      </td>
                    </Fragment>
                  );
                }
                return (
                  <td key={day.date} style={singleCell(day, i)}>
                    <div style={{ lineHeight: 1 }}><WeatherIcon code={day.weatherCode} size={42} /></div>
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
                          color: day.amPrecipProb !== null ? probColor(day.amPrecipProb) : '#c5c9d3',
                          fontWeight: day.amPrecipProb !== null && day.amPrecipProb >= 70 ? 600 : undefined,
                        }}>
                          {day.amPrecipProb !== null ? `${day.amPrecipProb}%` : '—'}
                        </div>
                      </td>
                      <td style={pmCell(day, i)}>
                        <div style={{
                          fontSize: '0.72rem',
                          color: day.pmPrecipProb !== null ? probColor(day.pmPrecipProb) : '#c5c9d3',
                          fontWeight: day.pmPrecipProb !== null && day.pmPrecipProb >= 70 ? 600 : undefined,
                        }}>
                          {day.pmPrecipProb !== null ? `${day.pmPrecipProb}%` : '—'}
                        </div>
                      </td>
                    </Fragment>
                  );
                }
                return (
                  <td key={day.date} style={singleCell(day, i)}>
                    <div style={{ fontSize: '0.72rem', color: '#a8aebc' }}>降水 {day.precipProbMax}%</div>
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
                      <span style={{ color: '#e08a7f', fontWeight: 600 }}>{Math.round(day.tempMax)}</span>
                      {' / '}
                      <span style={{ color: '#7da6d9' }}>{Math.round(day.tempMin)}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* ミニチャート */}
            <tr>
              <td colSpan={chartColSpan} style={{ padding: 0 }}>
                <DailyMiniChart daily={daily} />
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
                      <>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {riskDay.risks.map(r => {
                            const badge = RISK_BADGES[r];
                            return (
                              <span
                                key={r}
                                style={{
                                  fontSize: '0.6rem',
                                  background: badge.badgeBg,
                                  color: badge.badgeColor,
                                  borderRadius: 3,
                                  padding: '1px 4px',
                                  ...(r === 'heat' ? { filter: 'drop-shadow(0 0 3px #f87171)' } : {}),
                                }}
                              >
                                {badge.emoji}
                              </span>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#7a5d20', marginTop: '0.2rem' }}>
                          {riskDay.comment}
                        </div>
                      </>
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
