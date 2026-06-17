import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import { WeatherIcon, codeToLabel } from './WeatherIcon';
import type { JmaWarningItem } from '../../api/jmaWarning';
import { computeWarningLanes } from '../../lib/warningGantt';
import { WarningBar } from './WarningBar';
import { addDays } from '../../lib/dateUtils';

interface Props {
  daily: DailyForecastData[];
  onHalfDayClick?: (date: string, period: 'am' | 'pm' | 'night') => void;
  jmaWarnings?: JmaWarningItem[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const PERIOD_W = 50;  // px per AM / PM / Night cell
const CHART_H  = 80;

function probColor(p: number): string {
  if (p >= 70) return 'var(--accent-blue)';
  if (p >= 40) return '#38bdf8';
  return 'var(--text-tertiary)';
}

interface DailyMiniChartProps {
  daily: DailyForecastData[];
  dayX: number[];
  dayWidths: number[];
}

const TEMP_MAX_COLOR = '#fb7185'; // rose-400
const TEMP_MIN_COLOR = '#7dd3fc'; // sky-300

function DailyMiniChart({ daily, dayX, dayWidths }: DailyMiniChartProps) {
  const W = dayWidths.reduce((a, b) => a + b, 0);
  const H = CHART_H;
  const padT = 14;
  const padB = 20;
  const innerH = H - padT - padB;

  const precips = daily.map(d => d.precipSum);

  const validTemps: number[] = [];
  daily.forEach(d => {
    if (d.isPlaceholder) return;
    [d.amTempMax, d.amTempMin, d.pmTempMax, d.pmTempMin, d.nightTempMax, d.nightTempMin]
      .forEach(t => { if (t !== null) validTemps.push(t); });
  });
  const tMin = validTemps.length > 0 ? Math.min(...validTemps) : 0;
  const tMax = validTemps.length > 0 ? Math.max(...validTemps) : 1;
  const tRange = tMax - tMin || 1;
  const pMax  = Math.max(...precips, 1);

  const cxAm    = (i: number) => dayX[i] + dayWidths[i] * (1 / 6);
  const cxPm    = (i: number) => dayX[i] + dayWidths[i] * (3 / 6);
  const cxNight = (i: number) => dayX[i] + dayWidths[i] * (5 / 6);
  const ty   = (t: number) => padT + (1 - (t - tMin) / tRange) * innerH;
  const ph  = (p: number) => p === 0 ? 0 : Math.max(1, (p / pMax) * innerH);
  const barW = Math.round(PERIOD_W * 0.6);

  const buildTempPts = (isMax: boolean): [number, number][] => {
    const pts: [number, number][] = [];
    daily.forEach((day, i) => {
      if (day.isPlaceholder) return;
      const at = isMax ? day.amTempMax  : day.amTempMin;
      const pt = isMax ? day.pmTempMax  : day.pmTempMin;
      const nt = isMax ? day.nightTempMax : day.nightTempMin;
      if (at !== null) pts.push([cxAm(i),    ty(at)]);
      if (pt !== null) pts.push([cxPm(i),    ty(pt)]);
      if (nt !== null) pts.push([cxNight(i), ty(nt)]);
    });
    return pts;
  };

  const makePath = (pts: [number, number][]): string => {
    if (pts.length === 0) return '';
    const anchored: [number, number][] = pts.map(([x, y], idx) => {
      if (idx === 0) return [dayX[0], y];
      if (idx === pts.length - 1) return [W, y];
      return [x, y];
    });
    let d = `M ${anchored[0][0].toFixed(1)} ${anchored[0][1].toFixed(1)}`;
    for (let i = 1; i < anchored.length; i++) {
      const [x0, y0] = anchored[i - 1];
      const [x1, y1] = anchored[i];
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
      {/* 降水バー */}
      {daily.map((day, i) => {
        if (day.isPlaceholder) return null;
        if (day.amPrecipSum !== null) {
          const cxA = cxAm(i);
          const cxP = cxPm(i);
          const cxN = cxNight(i);
          const amBh    = ph(day.amPrecipSum);
          const pmBh    = ph(day.pmPrecipSum ?? 0);
          const nightBh = ph(day.nightPrecipSum ?? 0);
          return (
            <g key={i}>
              {amBh > 0 && <rect x={cxA - barW / 2} y={H - padB - amBh} width={barW} height={amBh} style={{ fill: 'var(--accent-blue)' }} opacity={0.6} rx={2} ry={2} />}
              {pmBh > 0 && <rect x={cxP - barW / 2} y={H - padB - pmBh} width={barW} height={pmBh} style={{ fill: 'var(--accent-blue)' }} opacity={0.6} rx={2} ry={2} />}
              {nightBh > 0 && <rect x={cxN - barW / 2} y={H - padB - nightBh} width={barW} height={nightBh} style={{ fill: 'var(--accent-blue)' }} opacity={0.6} rx={2} ry={2} />}
            </g>
          );
        }
        const cx = dayX[i] + dayWidths[i] / 2;
        const p  = day.precipSum;
        const bh = ph(p);
        if (bh === 0) return null;
        return <rect key={i} x={cx - barW / 2} y={H - padB - bh} width={barW} height={bh} style={{ fill: 'var(--accent-blue)' }} opacity={0.6} rx={2} ry={2} />;
      })}
      {/* 気温ライン */}
      <path d={makePath(buildTempPts(false))} fill="none" stroke={TEMP_MIN_COLOR} strokeWidth={2} strokeLinecap="round" />
      <path d={makePath(buildTempPts(true))} fill="none" stroke={TEMP_MAX_COLOR} strokeWidth={2} strokeLinecap="round" />
      {/* 気温ドット + ラベル */}
      {daily.map((day, i) => {
        if (day.isPlaceholder) return null;
        const periods = [
          { cx: cxAm(i),    max: day.amTempMax,    min: day.amTempMin    },
          { cx: cxPm(i),    max: day.pmTempMax,    min: day.pmTempMin    },
          { cx: cxNight(i), max: day.nightTempMax, min: day.nightTempMin },
        ];
        return (
          <g key={`dot-${i}`}>
            {periods.map(({ cx, max, min }, pi) => (
              <g key={pi}>
                {max !== null && (
                  <>
                    <circle cx={cx} cy={ty(max)} r={2.5} fill={TEMP_MAX_COLOR} />
                    <text x={cx} y={ty(max) - 4} fontSize={11} fill={TEMP_MAX_COLOR} textAnchor="middle" dominantBaseline="auto">{Math.round(max)}℃</text>
                  </>
                )}
                {min !== null && (
                  <>
                    <circle cx={cx} cy={ty(min)} r={2.5} fill={TEMP_MIN_COLOR} />
                    <text x={cx} y={ty(min) + 4} fontSize={11} fill={TEMP_MIN_COLOR} textAnchor="middle" dominantBaseline="hanging">{Math.round(min)}℃</text>
                  </>
                )}
              </g>
            ))}
          </g>
        );
      })}
      {/* 降水ラベル（底部固定・タグ風） */}
      {(() => {
        const fs = 11, pH = 1, pX = 3, baseY = H - 2;
        const tag = (x: number, label: string, key: string) => {
          const rw = label.length * 6.5 + pX * 2;
          return (
            <g key={key}>
              <rect x={x - rw / 2} y={baseY - fs - pH} width={rw} height={fs + pH * 2} rx={3} fill="none" stroke="var(--accent-blue)" strokeWidth={0.8} />
              <text x={x} y={baseY} fontSize={fs} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">{label}</text>
            </g>
          );
        };
        return daily.map((day, i) => {
          if (day.isPlaceholder) return null;
          if (day.amPrecipSum !== null) {
            return (
              <g key={`pl-${i}`}>
                {day.amPrecipSum > 0 && tag(cxAm(i), `${day.amPrecipSum.toFixed(1)}mm`, 'am')}
                {(day.pmPrecipSum ?? 0) > 0 && tag(cxPm(i), `${(day.pmPrecipSum ?? 0).toFixed(1)}mm`, 'pm')}
                {(day.nightPrecipSum ?? 0) > 0 && tag(cxNight(i), `${(day.nightPrecipSum ?? 0).toFixed(1)}mm`, 'night')}
              </g>
            );
          }
          const p = day.precipSum;
          if (p === 0) return null;
          const cx = dayX[i] + dayWidths[i] / 2;
          return tag(cx, `${p.toFixed(1)}mm`, `pl-${i}`);
        });
      })()}
    </svg>
  );
}

interface DailyColumn {
  x: number;
  width: number;
  startMs: number;
  endMs: number;
}

function buildDailyColumns(
  daily: DailyForecastData[],
  dayX: number[],
  dayWidths: number[],
): DailyColumn[] {
  const cols: DailyColumn[] = [];
  for (let i = 0; i < daily.length; i++) {
    const dateStr = daily[i].date;
    const subW = dayWidths[i] / 3;
    const nextDate = i + 1 < daily.length ? daily[i + 1].date : addDays(dateStr, 1);
    cols.push({
      x: dayX[i],
      width: subW,
      startMs: Date.parse(`${dateStr}T04:00:00+09:00`),
      endMs:   Date.parse(`${dateStr}T12:00:00+09:00`),
    });
    cols.push({
      x: dayX[i] + subW,
      width: subW,
      startMs: Date.parse(`${dateStr}T12:00:00+09:00`),
      endMs:   Date.parse(`${dateStr}T20:00:00+09:00`),
    });
    cols.push({
      x: dayX[i] + 2 * subW,
      width: subW,
      startMs: Date.parse(`${dateStr}T20:00:00+09:00`),
      endMs:   Date.parse(`${nextDate}T04:00:00+09:00`),
    });
  }
  return cols;
}

function warningToBar(
  warning: JmaWarningItem,
  cols: DailyColumn[],
): { left: string; width: string } | null {
  if (!warning.startMs || cols.length === 0) return null;

  const wStart = warning.startMs;
  const wEnd   = warning.endMs ?? (Date.now() + 12 * 60 * 60 * 1000);

  let startColIdx = cols.findIndex(c => wStart >= c.startMs && wStart < c.endMs);
  if (startColIdx === -1) {
    if (wStart < cols[0].startMs && wEnd > cols[0].startMs) {
      startColIdx = 0;
    } else {
      return null;
    }
  }

  let endColIdx = startColIdx;
  for (let i = cols.length - 1; i >= startColIdx; i--) {
    if (cols[i].startMs < wEnd) {
      endColIdx = i;
      break;
    }
  }

  const left  = cols[startColIdx].x;
  const right = cols[endColIdx].x + cols[endColIdx].width;
  return { left: `${left}px`, width: `${right - left}px` };
}

export function DailyForecast({ daily, onHalfDayClick, jmaWarnings }: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [dayX, setDayX] = useState<number[] | null>(null);
  const [dayWidths, setDayWidths] = useState<number[] | null>(null);

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
        const w = (widths[colIdx] ?? PERIOD_W) + (widths[colIdx + 1] ?? PERIOD_W) + (widths[colIdx + 2] ?? PERIOD_W);
        newDayWidths.push(w);
        xAcc += w;
        colIdx += 3;
      }
      setDayX(newDayX);
      setDayWidths(newDayWidths);
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (tableRef.current) observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [daily]);

  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jstNow.toISOString().slice(0, 10);

  const cellBg = (_day: DailyForecastData): string => 'rgba(255, 255, 255, 0.35)';
  const dayBorder = (i: number) =>
    i < daily.length - 1 ? '1px solid var(--card-border-sub)' : undefined;

  const spanCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.35rem 0.25rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  const innerBorder = '1px solid var(--card-border-sub)';

  const amCell = (day: DailyForecastData, extra?: CSSProperties): CSSProperties => ({
    width: PERIOD_W,
    minWidth: PERIOD_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.15rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: innerBorder,
    ...extra,
  });

  const pmCell = (day: DailyForecastData, extra?: CSSProperties): CSSProperties => ({
    width: PERIOD_W,
    minWidth: PERIOD_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.15rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: innerBorder,
    ...extra,
  });

  const nightCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    width: PERIOD_W,
    minWidth: PERIOD_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.15rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  const chartColSpan = daily.length * 3;

  return (
    <div>
      <div style={{ overflowX: 'auto', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--card-border-sub)', boxShadow: 'var(--shadow-sm)' }}>
        <table ref={tableRef} style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {daily.flatMap(day => [
              <col key={`${day.date}-am`}    style={{ width: PERIOD_W }} />,
              <col key={`${day.date}-pm`}    style={{ width: PERIOD_W }} />,
              <col key={`${day.date}-night`} style={{ width: PERIOD_W }} />,
            ])}
          </colgroup>
          <tbody>
            {/* 日付 */}
            <tr>
              {daily.map((day, i) => {
                const isToday = day.date === today;
                const dow = new Date(`${day.date}T00:00:00`).getDay();
                const mm = parseInt(day.date.slice(5, 7), 10);
                const dd = parseInt(day.date.slice(8, 10), 10);
                const label = isToday
                  ? `今日 ${mm}/${dd}(${DAY_NAMES[dow]})`
                  : `${mm}/${dd}(${DAY_NAMES[dow]})`;
                return (
                  <td
                    key={day.date}
                    colSpan={3}
                    style={{ ...spanCell(day, i), padding: '0.4rem 0.3rem 0.25rem', verticalAlign: 'top' }}
                  >
                    <div style={{
                      background: isToday ? 'rgba(59, 130, 246, 0.13)' : 'rgba(13, 148, 136, 0.11)',
                      borderRadius: '6px',
                      padding: '0.18rem 0.4rem',
                      position: 'relative',
                      textAlign: 'center',
                      fontSize: '0.875rem',
                      color: isToday ? 'var(--accent-blue)' : 'var(--accent-color)',
                      fontWeight: isToday ? 700 : 600,
                      whiteSpace: 'nowrap',
                      marginBottom: '0.3rem',
                    }}>
                      {label}
                      {!day.isPlaceholder && (
                        <span style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 600 }}>
                          <span style={{ color: '#fb7185' }}>{Math.round(day.tempMax)}</span>
                          <span style={{ opacity: 0.5, margin: '0 0.08rem' }}>/</span>
                          <span style={{ color: '#7dd3fc' }}>{Math.round(day.tempMin)}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.15rem' }}>
                      {['午前', '午後', '夜間'].map(p => (
                        <div key={p} style={{
                          flex: 1,
                          textAlign: 'center',
                          background: isToday ? 'rgba(59, 130, 246, 0.13)' : 'rgba(13, 148, 136, 0.11)',
                          borderRadius: '999px',
                          padding: '0.1rem 0',
                          fontSize: '0.6rem',
                          color: isToday ? 'var(--accent-blue)' : 'var(--accent-color)',
                          fontWeight: 600,
                        }}>
                          {p}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 時間帯別天気テキスト */}
            <tr>
              {daily.map((day, i) => {
                const wStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 };
                return (
                  <Fragment key={day.date}>
                    <td style={amCell(day)}><div style={wStyle}>{day.amWeatherCode !== null ? (codeToLabel(day.amWeatherCode) ?? '—') : '—'}</div></td>
                    <td style={pmCell(day)}><div style={wStyle}>{day.pmWeatherCode !== null ? (codeToLabel(day.pmWeatherCode) ?? '—') : '—'}</div></td>
                    <td style={nightCell(day, i)}><div style={wStyle}>{day.nightWeatherCode !== null ? (codeToLabel(day.nightWeatherCode) ?? '—') : '—'}</div></td>
                  </Fragment>
                );
              })}
            </tr>
            {/* 天気アイコン */}
            <tr>
              {daily.map((day, i) => {
                const dashCell: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84, color: 'var(--text-tertiary)', fontSize: '1rem' };
                if (day.isPlaceholder) {
                  return (
                    <Fragment key={day.date}>
                      <td style={amCell(day)}><div style={dashCell}>—</div></td>
                      <td style={pmCell(day)}><div style={dashCell}>—</div></td>
                      <td style={nightCell(day, i)}><div style={dashCell}>—</div></td>
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={day.date}>
                    <td
                      style={{ ...amCell(day), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'am')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                        {day.amWeatherCode !== null ? <WeatherIcon code={day.amWeatherCode} size={84} /> : '—'}
                      </div>
                    </td>
                    <td
                      style={{ ...pmCell(day), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'pm')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                        {day.pmWeatherCode !== null ? <WeatherIcon code={day.pmWeatherCode} size={84} /> : '—'}
                      </div>
                    </td>
                    <td
                      style={{ ...nightCell(day, i), cursor: onHalfDayClick ? 'pointer' : undefined }}
                      onClick={() => onHalfDayClick?.(day.date, 'night')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                        {day.nightWeatherCode !== null ? <WeatherIcon code={day.nightWeatherCode} size={84} isNight /> : '—'}
                      </div>
                    </td>
                  </Fragment>
                );
              })}
            </tr>
            {/* 降水確率 */}
            <tr>
              {daily.map((day, i) => {
                if (day.isPlaceholder) {
                  return (
                    <Fragment key={day.date}>
                      <td style={amCell(day)}><div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</div></td>
                      <td style={pmCell(day)}><div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</div></td>
                      <td style={nightCell(day, i)}><div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</div></td>
                    </Fragment>
                  );
                }
                const renderProb = (prob: number | null) => (
                  <div style={{
                    fontSize: '0.72rem',
                    color: prob !== null ? probColor(prob) : 'var(--text-tertiary)',
                    fontWeight: prob !== null && prob >= 70 ? 700 : undefined,
                  }}>
                    {prob !== null ? <><img src="https://cdn.meteocons.com/3.0.0-next.10/svg-static/flat/raindrop.svg" alt="" style={{ width: '1.8em', height: '1.8em', verticalAlign: 'middle', marginRight: '0.1em' }} />{prob}%</> : '—'}
                  </div>
                );
                return (
                  <Fragment key={day.date}>
                    <td style={amCell(day)}>{renderProb(day.amPrecipProb)}</td>
                    <td style={pmCell(day)}>{renderProb(day.pmPrecipProb)}</td>
                    <td style={nightCell(day, i)}>{renderProb(day.nightPrecipProb)}</td>
                  </Fragment>
                );
              })}
            </tr>
            {/* 時間帯別最大風速 */}
            <tr>
              {daily.map((day, i) => {
                const fmt = (v: number | null) => (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {v === null ? '—' : <><img src="https://cdn.meteocons.com/3.0.0-next.10/svg-static/fill/wind-dust.svg" alt="" style={{ width: '1.8em', height: '1.8em', verticalAlign: 'middle', marginRight: '0.1em' }} />{v.toFixed(1)}m/s</>}
                  </div>
                );
                if (day.isPlaceholder) {
                  return (
                    <Fragment key={day.date}>
                      <td style={amCell(day)}><div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</div></td>
                      <td style={pmCell(day)}><div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</div></td>
                      <td style={nightCell(day, i)}><div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</div></td>
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={day.date}>
                    <td style={amCell(day)}>{fmt(day.amWindMax)}</td>
                    <td style={pmCell(day)}>{fmt(day.pmWindMax)}</td>
                    <td style={nightCell(day, i)}>{fmt(day.nightWindMax)}</td>
                  </Fragment>
                );
              })}
            </tr>
            {/* ミニチャート */}
            <tr>
              <td colSpan={chartColSpan} style={{ padding: 0 }}>
                {dayX && dayWidths ? (
                  <DailyMiniChart daily={daily} dayX={dayX} dayWidths={dayWidths} />
                ) : (
                  <div style={{ height: CHART_H }} />
                )}
              </td>
            </tr>
            {/* ガントバー行 */}
            {jmaWarnings && jmaWarnings.length > 0 && dayX && dayWidths && (() => {
              const cols = buildDailyColumns(daily, dayX, dayWidths);
              const lanes = computeWarningLanes(jmaWarnings);
              return lanes.map((lane, laneIdx) => (
                <tr key={`gantt-${laneIdx}`}>
                  <td colSpan={chartColSpan} style={{ padding: 0, position: 'relative', height: 22 }}>
                    {lane.map(warning => {
                      const bar = warningToBar(warning, cols);
                      if (!bar) return null;
                      return (
                        <WarningBar
                          key={warning.code}
                          warning={warning}
                          left={bar.left}
                          width={bar.width}
                        />
                      );
                    })}
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
