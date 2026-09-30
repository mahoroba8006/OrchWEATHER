import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import { WeatherIcon, codeToLabel } from './WeatherIcon';
import type { JmaWarningItem } from '../../api/jmaWarning';
import { computeWarningLanes } from '../../lib/warningGantt';
import { WarningBar } from './WarningBar';
import { addDays } from '../../lib/dateUtils';
import { selectCode, type WeatherCodeMode } from '../../lib/wmoSeverity';
import { m } from 'motion/react';
import { pressScale, springs } from '../../lib/motion';

interface Props {
  daily: DailyForecastData[];
  weatherCodeMode: WeatherCodeMode;
  onHalfDayClick?: (date: string, period: 'am' | 'pm' | 'night') => void;
  jmaWarnings?: JmaWarningItem[];
  hourlyLastDate?: string; // この日付以降はタップ不可（時間別データなし）
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
type Period = 'am' | 'pm' | 'night';
const PERIOD_W = 50;  // px per AM / PM / Night cell
const CHART_H  = 80;

function probColor(p: number): string {
  if (p >= 70) return 'var(--accent-blue)';
  if (p >= 40) return '#38bdf8';
  return 'var(--ink-3)';
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
          <line x1={0} y1={ty(v)} x2={W} y2={ty(v)} style={{ stroke: 'var(--line)' }} strokeWidth={1} />
          <text x={3} y={ty(v) - 2} fontSize={8} style={{ fill: 'var(--ink-3)' }}>{v}</text>
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
      {/* 降水ラベル（底部固定） */}
      {daily.map((day, i) => {
        if (day.isPlaceholder) return null;
        if (day.amPrecipSum !== null) {
          return (
            <g key={`pl-${i}`}>
              {day.amPrecipSum > 0 && <text x={cxAm(i)} y={H - 2} fontSize={11} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">{day.amPrecipSum.toFixed(1)}mm</text>}
              {(day.pmPrecipSum ?? 0) > 0 && <text x={cxPm(i)} y={H - 2} fontSize={11} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">{(day.pmPrecipSum ?? 0).toFixed(1)}mm</text>}
              {(day.nightPrecipSum ?? 0) > 0 && <text x={cxNight(i)} y={H - 2} fontSize={11} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">{(day.nightPrecipSum ?? 0).toFixed(1)}mm</text>}
            </g>
          );
        }
        const p = day.precipSum;
        if (p === 0) return null;
        const cx = dayX[i] + dayWidths[i] / 2;
        return <text key={`pl-${i}`} x={cx} y={H - 2} fontSize={11} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">{p.toFixed(1)}mm</text>;
      })}
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

export function DailyForecast({ daily, weatherCodeMode, onHalfDayClick, jmaWarnings, hourlyLastDate }: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [dayX, setDayX] = useState<number[] | null>(null);
  const [dayWidths, setDayWidths] = useState<number[] | null>(null);

  const canTap = (date: string) => !!onHalfDayClick && (!hourlyLastDate || date <= hourlyLastDate);

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

  // 気温レンジバー用：表示期間全体の最低〜最高（placeholder 日は除く）
  const realDays = daily.filter(d => !d.isPlaceholder);
  const periodMin = realDays.length > 0 ? Math.min(...realDays.map(d => d.tempMin)) : 0;
  const periodMax = realDays.length > 0 ? Math.max(...realDays.map(d => d.tempMax)) : 1;
  const periodSpan = periodMax - periodMin || 1;

  const [selected, setSelected] = useState<{ date: string; period: Period } | null>(null);
  const pick = (date: string, period: Period) => {
    onHalfDayClick?.(date, period);
    setSelected({ date, period });
  };

  const daySep = (i: number) => (i < daily.length - 1 ? '1px solid var(--line)' : undefined);
  const todayBg = (day: DailyForecastData) => (day.date === today ? 'var(--accent-soft)' : undefined);

  const cellStyle = (day: DailyForecastData, period: Period, i: number, extra?: CSSProperties): CSSProperties => ({
    width: PERIOD_W,
    minWidth: PERIOD_W,
    background: todayBg(day),
    textAlign: 'center',
    padding: '0.15rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: period === 'night' ? daySep(i) : undefined,
    position: 'relative',
    ...extra,
  });

  const clickable = (day: DailyForecastData, period: Period) =>
    canTap(day.date)
      ? { onClick: () => pick(day.date, period), style: { cursor: 'pointer' } as CSSProperties }
      : { onClick: undefined, style: undefined };

  const selectionMark = (day: DailyForecastData, period: Period) =>
    selected?.date === day.date && selected.period === period ? (
      <m.span
        layoutId="daily-selected"
        data-testid="daily-selected"
        transition={springs.move}
        style={{
          position: 'absolute', inset: 2, borderRadius: 'var(--radius-sm)',
          boxShadow: 'inset 0 0 0 1.5px var(--accent)', background: 'var(--accent-soft)',
          pointerEvents: 'none',
        }}
      />
    ) : null;

  const chartColSpan = daily.length * 3;

  return (
    <div>
      <div style={{ overflowX: 'auto', background: 'var(--surface-card)', borderBottom: '1px solid var(--line)' }}>
        <table ref={tableRef} style={{ borderCollapse: 'collapse', tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}>
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
                const dateLabel = `${mm}/${dd}(${DAY_NAMES[dow]})`;
                const rangeLeft = ((day.tempMin - periodMin) / periodSpan) * 100;
                const rangeWidth = ((day.tempMax - day.tempMin) / periodSpan) * 100;
                return (
                  <td
                    key={day.date}
                    colSpan={3}
                    style={{
                      background: todayBg(day),
                      padding: '0.5rem 0.4rem 0.35rem',
                      verticalAlign: 'top',
                      borderRight: daySep(i),
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                      fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-1)', whiteSpace: 'nowrap',
                    }}>
                      <span>
                        {isToday && <span style={{ color: 'var(--accent)', marginRight: '0.3em' }}>今日</span>}
                        {dateLabel}
                      </span>
                      {!day.isPlaceholder && (
                        <span style={{ fontSize: '0.72rem' }}>
                          <span style={{ color: TEMP_MAX_COLOR }}>{Math.round(day.tempMax)}</span>
                          <span style={{ color: 'var(--ink-3)', margin: '0 0.08rem' }}>/</span>
                          <span style={{ color: TEMP_MIN_COLOR }}>{Math.round(day.tempMin)}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--surface-sunken)', margin: '0.4rem 0 0.35rem' }}>
                      {!day.isPlaceholder && (
                        <div
                          data-testid="temp-range"
                          style={{
                            position: 'absolute', top: 0, bottom: 0, minWidth: 4, borderRadius: 2,
                            left: `${rangeLeft}%`, width: `${rangeWidth}%`,
                            background: `linear-gradient(to right, ${TEMP_MIN_COLOR}, ${TEMP_MAX_COLOR})`,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ display: 'flex' }}>
                      {['午前', '午後', '夜間'].map(p => (
                        <div key={p} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'var(--ink-3)', fontWeight: 500 }}>
                          {p}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 天気アイコン（天気名テキストを同一セルに統合） */}
            <tr>
              {daily.map((day, i) => {
                const wStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--ink-3)', fontWeight: 500, lineHeight: 1, flexShrink: 0 };
                const dashCell: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--ink-3)', fontSize: '1rem' };
                if (day.isPlaceholder) {
                  return (
                    <Fragment key={day.date}>
                      <td style={cellStyle(day, 'am', i)}><div style={dashCell}>—</div></td>
                      <td style={cellStyle(day, 'pm', i)}><div style={dashCell}>—</div></td>
                      <td style={cellStyle(day, 'night', i)}><div style={dashCell}>—</div></td>
                    </Fragment>
                  );
                }
                const altMode         = weatherCodeMode === 'severity' ? 'frequency' : 'severity';
                const altModeLabel    = altMode === 'frequency' ? '概況' : 'リスク';
                const altModeTagStyle: CSSProperties = altMode === 'frequency'
                  ? { background: 'white', color: 'var(--accent)', border: '1px solid rgba(13,148,136,0.3)' }
                  : { background: 'white', color: '#7a2840',       border: '1px solid rgba(244,167,185,0.6)' };
                // height: 160 = text(12) + gap(2) + icon(84) + gap(2) + mini label(14) + gap(2) + mini icon(42) + 2
                const iconContainer: CSSProperties = {
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'flex-start', height: 160, gap: 0, position: 'relative',
                };
                const iconCell = (period: Period, codes: number[]) => {
                  const isNight = period === 'night';
                  const main = selectCode(codes, weatherCodeMode);
                  const alt  = selectCode(codes, altMode);
                  const click = clickable(day, period);
                  return (
                    <td
                      data-cell={`${day.date}-${period}`}
                      style={{ ...cellStyle(day, period, i, { paddingTop: '0.6rem', paddingBottom: 0 }), ...click.style }}
                      onClick={click.onClick}
                    >
                      {selectionMark(day, period)}
                      <m.div
                        style={iconContainer}
                        whileTap={canTap(day.date) ? { scale: pressScale } : undefined}
                        transition={springs.press}
                      >
                        <div style={wStyle}>{main !== null ? (codeToLabel(main) ?? '—') : '—'}</div>
                        {main !== null ? <WeatherIcon code={main} size={84} isNight={isNight} /> : '—'}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0, marginTop: 8 }}>
                          {alt !== null && alt !== main && (
                            <>
                              <span style={{ fontSize: '0.58rem', fontWeight: 600, borderRadius: '999px', padding: '0.05rem 0.35rem', lineHeight: 1.4, whiteSpace: 'nowrap', marginBottom: 2, ...altModeTagStyle }}>
                                {altModeLabel}
                              </span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1, whiteSpace: 'nowrap', marginBottom: -6, display: 'block' }}>
                                {codeToLabel(alt) ?? ''}
                              </span>
                              <WeatherIcon code={alt} size={42} isNight={isNight} />
                            </>
                          )}
                        </div>
                      </m.div>
                    </td>
                  );
                };
                return (
                  <Fragment key={day.date}>
                    {iconCell('am', day.amCodes)}
                    {iconCell('pm', day.pmCodes)}
                    {iconCell('night', day.nightCodes)}
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
                      <td style={cellStyle(day, 'am', i)}><div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>—</div></td>
                      <td style={cellStyle(day, 'pm', i)}><div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>—</div></td>
                      <td style={cellStyle(day, 'night', i)}><div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>—</div></td>
                    </Fragment>
                  );
                }
                const renderProb = (prob: number | null) => (
                  <div style={{
                    fontSize: '0.72rem',
                    color: prob !== null ? probColor(prob) : 'var(--ink-3)',
                    fontWeight: prob !== null && prob >= 70 ? 700 : undefined,
                  }}>
                    {prob !== null ? <><img src="https://cdn.meteocons.com/3.0.0-next.10/svg-static/flat/raindrop.svg" alt="" style={{ width: '1.8em', height: '1.8em', verticalAlign: 'middle', marginRight: '0.1em' }} />{prob}%</> : '—'}
                  </div>
                );
                return (
                  <Fragment key={day.date}>
                    <td style={{ ...cellStyle(day, 'am', i), cursor: canTap(day.date) ? 'pointer' : undefined }} onClick={canTap(day.date) ? () => pick(day.date, 'am') : undefined}>{renderProb(day.amPrecipProb)}</td>
                    <td style={{ ...cellStyle(day, 'pm', i), cursor: canTap(day.date) ? 'pointer' : undefined }} onClick={canTap(day.date) ? () => pick(day.date, 'pm') : undefined}>{renderProb(day.pmPrecipProb)}</td>
                    <td style={{ ...cellStyle(day, 'night', i), cursor: canTap(day.date) ? 'pointer' : undefined }} onClick={canTap(day.date) ? () => pick(day.date, 'night') : undefined}>{renderProb(day.nightPrecipProb)}</td>
                  </Fragment>
                );
              })}
            </tr>
            {/* 時間帯別最大風速 */}
            <tr>
              {daily.map((day, i) => {
                const fmt = (v: number | null) => (
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-2)' }}>
                    {v === null ? '—' : <><img src="https://cdn.meteocons.com/3.0.0-next.10/svg-static/fill/wind-dust.svg" alt="" style={{ width: '1.8em', height: '1.8em', verticalAlign: 'middle', marginRight: '0.1em' }} />{v.toFixed(1)}m/s</>}
                  </div>
                );
                if (day.isPlaceholder) {
                  return (
                    <Fragment key={day.date}>
                      <td style={cellStyle(day, 'am', i)}><div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>—</div></td>
                      <td style={cellStyle(day, 'pm', i)}><div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>—</div></td>
                      <td style={cellStyle(day, 'night', i)}><div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>—</div></td>
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={day.date}>
                    <td style={{ ...cellStyle(day, 'am', i), cursor: canTap(day.date) ? 'pointer' : undefined }} onClick={canTap(day.date) ? () => pick(day.date, 'am') : undefined}>{fmt(day.amWindMax)}</td>
                    <td style={{ ...cellStyle(day, 'pm', i), cursor: canTap(day.date) ? 'pointer' : undefined }} onClick={canTap(day.date) ? () => pick(day.date, 'pm') : undefined}>{fmt(day.pmWindMax)}</td>
                    <td style={{ ...cellStyle(day, 'night', i), cursor: canTap(day.date) ? 'pointer' : undefined }} onClick={canTap(day.date) ? () => pick(day.date, 'night') : undefined}>{fmt(day.nightWindMax)}</td>
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
