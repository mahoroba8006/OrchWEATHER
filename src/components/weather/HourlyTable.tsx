import { useEffect, type CSSProperties, type RefObject } from 'react';
import type { HourlyForecast } from '../../api/forecast';
import { weatherCodeToEmoji, RISK_BADGES, type RiskType } from '../../lib/riskDetection';

function detectHourRisks(h: HourlyForecast): RiskType[] {
  const risks: RiskType[] = [];
  if (h.dewPoint <= 0 && h.temperature <= 3)                      risks.push('frost');
  if (h.cape >= 500 || (h.weatherCode >= 95 && h.weatherCode <= 99)) risks.push('thunder');
  if (h.cape >= 1000 && h.freezingLevel <= 3500)                  risks.push('hail');
  if (h.windSpeed >= 15)                                           risks.push('wind');
  if (h.precipitation >= 30)                                       risks.push('rain');
  if (h.temperature >= 35)                                         risks.push('heat');
  if (h.humidity <= 30)                                            risks.push('dry');
  return risks;
}

interface Props {
  hourly: HourlyForecast[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
export const COL_W = 40;

const STICKY_LABEL_STYLE: CSSProperties = {
  position: 'sticky',
  left: 0,
  background: '#f8f9fc',
  padding: '0.3rem 0.6rem',
  fontWeight: 500,
  color: '#5b6478',
  borderRight: '1px solid #ebeef5',
  zIndex: 1,
  minWidth: 90,
  fontSize: '0.72rem',
  verticalAlign: 'middle',
};

function RiskBadgesRow({ hourly, cutoff }: { hourly: HourlyForecast[]; cutoff: Date }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
      <td style={STICKY_LABEL_STYLE}>リスク</td>
      {hourly.map(h => {
        const risks = detectHourRisks(h);
        const isPast = new Date(h.time) < cutoff;
        return (
          <td
            key={h.time}
            style={{
              padding: '0.15rem 0.1rem',
              textAlign: 'center',
              background: risks.length > 0 ? '#fff0f5' : undefined,
              minWidth: COL_W,
              verticalAlign: 'middle',
              opacity: isPast ? 0.35 : undefined,
            }}
          >
            {risks.map(r => (
              <span key={r} style={{ fontSize: '0.8rem', display: 'inline-block' }}>
                {RISK_BADGES[r].emoji}
              </span>
            ))}
          </td>
        );
      })}
    </tr>
  );
}

function MiniChartRow({ hourly }: { hourly: HourlyForecast[] }) {
  const W = hourly.length * COL_W;
  const H = 64;
  const padT = 6;
  const padB = 6;
  const innerH = H - padT - padB;

  const temps = hourly.map(h => h.temperature);
  const precips = hourly.map(h => h.precipitation);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const tRange = tMax - tMin || 1;
  const pMax = Math.max(...precips, 1);

  const cx = (i: number) => i * COL_W + COL_W / 2;
  const ty = (t: number) => padT + (1 - (t - tMin) / tRange) * innerH;
  const ph = (p: number) => p === 0 ? 0 : Math.max(1, (p / pMax) * innerH * 0.45);

  const pts = temps.map((t, i) => [cx(i), ty(t)] as [number, number]);
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cpx = ((x0 + x1) / 2).toFixed(1);
    d += ` C ${cpx} ${y0.toFixed(1)} ${cpx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  // 5℃刻みのグリッドライン値
  const gridStep = 5;
  const gridMin = Math.ceil(tMin / gridStep) * gridStep;
  const gridMax = Math.floor(tMax / gridStep) * gridStep;
  const gridTemps: number[] = [];
  for (let v = gridMin; v <= gridMax; v += gridStep) gridTemps.push(v);

  return (
    <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
      <td style={STICKY_LABEL_STYLE}>気温/降水</td>
      <td colSpan={hourly.length} style={{ padding: 0 }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {/* 5℃グリッドライン */}
          {gridTemps.map(v => (
            <g key={v}>
              <line x1={0} y1={ty(v)} x2={W} y2={ty(v)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={3} y={ty(v) - 2} fontSize={7} fill="#c5c9d3">{v}</text>
            </g>
          ))}
          {/* 降水量バー（半幅・中央揃え） */}
          {precips.map((p, i) => {
            const bh = ph(p);
            if (bh === 0) return null;
            return (
              <g key={i}>
                <rect
                  x={i * COL_W + COL_W * 0.325}
                  y={H - padB - bh}
                  width={COL_W * 0.35}
                  height={bh}
                  fill="#93c5fd"
                  opacity={0.75}
                />
                <text
                  x={i * COL_W + COL_W / 2}
                  y={H - padB - bh - 2}
                  fontSize={7}
                  fill="#60a5fa"
                  textAnchor="middle"
                  dominantBaseline="auto"
                >
                  {p.toFixed(1)}
                </text>
              </g>
            );
          })}
          {/* 気温折れ線 */}
          <path d={d} fill="none" stroke="#fb923c" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </td>
    </tr>
  );
}

const ROWS: {
  key: string;
  label: string;
  fmt: (h: HourlyForecast, i: number, all: HourlyForecast[]) => string;
  isRisk: (h: HourlyForecast) => boolean;
}[] = [
  {
    key: 'date',
    label: '日付',
    fmt: (h, i, all) => {
      const date = h.time.slice(0, 10);
      if (i > 0 && all[i - 1].time.slice(0, 10) === date) return '';
      const mm = parseInt(date.slice(5, 7), 10);
      const dd = parseInt(date.slice(8, 10), 10);
      const dow = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
      return `${mm}/${dd}(${dow})`;
    },
    isRisk: () => false,
  },
  {
    key: 'time',
    label: '時刻',
    fmt: h => String(parseInt(h.time.slice(11, 13), 10)),
    isRisk: () => false,
  },
  {
    key: 'weather',
    label: '天気',
    fmt: h => weatherCodeToEmoji(h.weatherCode),
    isRisk: () => false,
  },
  {
    key: 'temperature',
    label: '気温(℃)',
    fmt: h => h.temperature.toFixed(1),
    isRisk: h => h.temperature >= 35 || h.temperature <= 3,
  },
  {
    key: 'precip',
    label: '降水(mm)',
    fmt: h => h.precipitation.toFixed(1),
    isRisk: h => h.precipitation >= 30,
  },
  {
    key: 'dewPoint',
    label: '露点(℃)',
    fmt: h => h.dewPoint.toFixed(1),
    isRisk: h => h.dewPoint <= 0,
  },
  {
    key: 'humidity',
    label: '湿度(%)',
    fmt: h => String(h.humidity),
    isRisk: h => h.humidity <= 30,
  },
  {
    key: 'windSpeed',
    label: '風速(m/s)',
    fmt: h => h.windSpeed.toFixed(1),
    isRisk: h => h.windSpeed >= 15,
  },
  {
    key: 'cape',
    label: 'CAPE(J/kg)',
    fmt: h => Math.round(h.cape).toString(),
    isRisk: h => h.cape >= 500,
  },
  {
    key: 'freezing',
    label: '0℃層高度(m)',
    fmt: h => Math.round(h.freezingLevel).toString(),
    isRisk: h => h.freezingLevel <= 3500 && h.cape >= 1000,
  },
  {
    key: 'pressure',
    label: '気圧(hPa)',
    fmt: h => Math.round(h.pressure).toString(),
    isRisk: () => false,
  },
];

export function HourlyTable({ hourly, scrollRef }: Props) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 3600 * 1000); // 1時間前より古い列をグレーアウト

  useEffect(() => {
    if (!scrollRef.current || hourly.length === 0) return;
    // cutoff 以下の最後の列（= 1時間前の列）を先頭に合わせる
    let targetIdx = 0;
    for (let i = 0; i < hourly.length; i++) {
      if (new Date(hourly[i].time) <= cutoff) targetIdx = i;
      else break;
    }
    scrollRef.current.scrollLeft = targetIdx * COL_W;
  }, [hourly]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ padding: '0.9rem 1rem 0.4rem', fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em' }}>
        時間別 ／ 72時間
      </div>
      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          touchAction: 'pan-x',
          background: '#fff',
          borderTop: '1px solid #ebeef5',
          borderBottom: '1px solid #ebeef5',
        }}
      >
        <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
          <tbody>
            {ROWS.flatMap(row => {
              const tr = (
                <tr key={row.key} style={{ borderBottom: '1px solid #f0f2f8' }}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: '#f8f9fc',
                      padding: '0.3rem 0.6rem',
                      fontWeight: 500,
                      color: '#5b6478',
                      borderRight: '1px solid #ebeef5',
                      zIndex: 1,
                      minWidth: 90,
                    }}
                  >
                    {row.label}
                  </td>
                  {hourly.map((h, i) => {
                    const risk = row.isRisk(h);
                    const isPast = new Date(h.time) < cutoff;
                    const isNewDay = row.key === 'date' && i > 0 && hourly[i - 1].time.slice(0, 10) !== h.time.slice(0, 10);
                    const baseColor = row.key === 'date' ? '#5b6478' : '#4b5563';
                    return (
                      <td
                        key={h.time}
                        style={{
                          padding: '0.3rem 0.4rem',
                          textAlign: 'center',
                          background: risk ? '#fff0f5' : undefined,
                          fontWeight: risk ? 700 : row.key === 'date' ? 600 : undefined,
                          fontSize: row.key === 'date' ? '0.7rem' : row.key === 'weather' ? '1.5em' : undefined,
                          lineHeight: row.key === 'weather' ? 1 : undefined,
                          minWidth: COL_W,
                          color: isPast ? '#c0c4cf' : baseColor,
                          ...(isNewDay ? { borderLeft: '2px solid #ebeef5' } : {}),
                        }}
                      >
                        {row.fmt(h, i, hourly)}
                      </td>
                    );
                  })}
                </tr>
              );
              if (row.key === 'weather') {
                return [tr, <RiskBadgesRow key="risk-badges" hourly={hourly} cutoff={cutoff} />, <MiniChartRow key="mini-chart" hourly={hourly} />];
              }
              return [tr];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
