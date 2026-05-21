// src/components/weather/DailyForecast.tsx
import { type CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import type { DayRisk } from '../../lib/riskDetection';
import { RISK_BADGES, weatherCodeToEmoji } from '../../lib/riskDetection';

interface Props {
  daily: DailyForecastData[];
  dayRisks: DayRisk[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const CARD_W = 96;
const CHART_H = 60;

function DailyMiniChart({ daily }: { daily: DailyForecastData[] }) {
  const N = daily.length;
  const W = N * CARD_W;
  const H = CHART_H;
  const padT = 6;
  const padB = 6;
  const innerH = H - padT - padB;

  const tempMaxes = daily.map(d => d.tempMax);
  const tempMins = daily.map(d => d.tempMin);
  const precips = daily.map(d => d.precipSum);

  const tMin = Math.min(...tempMins, ...tempMaxes);
  const tMax = Math.max(...tempMaxes, ...tempMins);
  const tRange = tMax - tMin || 1;
  const pMax = Math.max(...precips, 1);

  const cx = (i: number) => i * CARD_W + CARD_W / 2;
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
        return (
          <g key={i}>
            <rect
              x={i * CARD_W + CARD_W * 0.325}
              y={H - padB - bh}
              width={CARD_W * 0.35}
              height={bh}
              fill="#93c5fd"
              opacity={0.75}
            />
            <text
              x={i * CARD_W + CARD_W / 2}
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

export function DailyForecast({ daily, dayRisks }: Props) {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jstNow.toISOString().slice(0, 10);

  const cellBg = (day: DailyForecastData): string | undefined => {
    if (day.date === today) return '#f8fbff';
    if (dayRisks.some(r => r.date === day.date && r.risks.length > 0)) return '#fafaf6';
    return undefined;
  };

  const cell = (day: DailyForecastData, i: number): CSSProperties => ({
    width: CARD_W,
    minWidth: CARD_W,
    borderRight: i < daily.length - 1 ? '1px solid #f3f4f8' : undefined,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.25rem 0.25rem',
    verticalAlign: 'middle',
  });

  return (
    <div>
      <div style={{ padding: '0.9rem 1rem 0.4rem', fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em' }}>
        日別 ／ 今日〜10日後
      </div>
      <div style={{ overflowX: 'auto', background: '#fff', borderTop: '1px solid #ebeef5', borderBottom: '1px solid #ebeef5' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              {daily.map((day, i) => {
                const isToday = day.date === today;
                const dow = new Date(`${day.date}T00:00:00`).getDay();
                const mm = parseInt(day.date.slice(5, 7), 10);
                const dd = parseInt(day.date.slice(8, 10), 10);
                const label = isToday ? `今日 ${mm}/${dd}` : `${mm}/${dd} (${DAY_NAMES[dow]})`;
                return (
                  <td key={day.date} style={{ ...cell(day, i), paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.72rem', color: isToday ? '#5e8ad1' : '#5b6478', fontWeight: isToday ? 600 : undefined }}>
                      {label}
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr>
              {daily.map((day, i) => (
                <td key={day.date} style={cell(day, i)}>
                  <div style={{ fontSize: '2rem', lineHeight: 1 }}>{weatherCodeToEmoji(day.weatherCode)}</div>
                </td>
              ))}
            </tr>
            <tr>
              {daily.map((day, i) => (
                <td key={day.date} style={cell(day, i)}>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                    <span style={{ color: '#e08a7f', fontWeight: 600 }}>{Math.round(day.tempMax)}</span>
                    {' / '}
                    <span style={{ color: '#7da6d9' }}>{Math.round(day.tempMin)}</span>
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              {daily.map((day, i) => (
                <td key={day.date} style={{ ...cell(day, i), paddingBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#a8aebc' }}>降水 {day.precipProbMax}%</div>
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={daily.length} style={{ padding: 0 }}>
                <DailyMiniChart daily={daily} />
              </td>
            </tr>
            <tr>
              {daily.map((day, i) => {
                const riskDay = dayRisks.find(r => r.date === day.date);
                const hasRisk = riskDay !== undefined && riskDay.risks.length > 0;
                return (
                  <td key={day.date} style={{ ...cell(day, i), paddingBottom: '0.6rem', verticalAlign: 'top' }}>
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
