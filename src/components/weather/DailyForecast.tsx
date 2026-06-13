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
const CARD_W   = 86;  // px per day (non-split)
const PERIOD_W = 50;  // px per AM / PM / Night cell (split days = 3 × PERIOD_W)
const CHART_H  = 60;
const SPLIT_DAYS = 3; // first N days get AM/PM/Night split

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

  const precips   = daily.map(d => d.precipSum);

  // 分割日は時間帯別気温、非分割日は日別気温でスケール計算
  const validTemps: number[] = [];
  daily.forEach((d, i) => {
    if (d.isPlaceholder) return;
    if (i < SPLIT_DAYS) {
      const isLast = i === SPLIT_DAYS - 1;
      [d.amTempMax, d.amTempMin, d.pmTempMax, d.pmTempMin,
        isLast ? d.nightTempMaxShort : d.nightTempMax,
        isLast ? d.nightTempMinShort : d.nightTempMin,
      ].forEach(t => { if (t !== null) validTemps.push(t); });
    } else {
      validTemps.push(d.tempMax, d.tempMin);
    }
  });
  const tMin = validTemps.length > 0 ? Math.min(...validTemps) : 0;
  const tMax = validTemps.length > 0 ? Math.max(...validTemps) : 1;
  const tRange = tMax - tMin || 1;
  const pMax  = Math.max(...precips, 1);

  // 列幅は実測値ベース → 各時間帯の中央も実測幅から算出
  const cx      = (i: number) => dayX[i] + dayWidths[i] / 2;
  const cxAm    = (i: number) => dayX[i] + dayWidths[i] * (1 / 6);
  const cxPm    = (i: number) => dayX[i] + dayWidths[i] * (3 / 6);
  const cxNight = (i: number) => dayX[i] + dayWidths[i] * (5 / 6);
  const ty   = (t: number) => padT + (1 - (t - tMin) / tRange) * innerH;
  // バー高さ：気温線の下半分に収める（innerH の 45%）
  const ph  = (p: number) => p === 0 ? 0 : Math.max(1, (p / pMax) * innerH * 0.45);
  // バー幅：非分割日（CARD_W）と同じ固定幅で統一
  const barW = Math.round(CARD_W * 0.35);

  // 分割日は時間帯別気温の[x,y]点列、非分割日は日中央の1点
  const buildTempPts = (isMax: boolean): [number, number][] => {
    const pts: [number, number][] = [];
    daily.forEach((day, i) => {
      if (day.isPlaceholder) return;
      const isLastSplit = i === SPLIT_DAYS - 1;
      if (i < SPLIT_DAYS) {
        const at = isMax ? day.amTempMax  : day.amTempMin;
        const pt = isMax ? day.pmTempMax  : day.pmTempMin;
        const nt = isMax
          ? (isLastSplit ? day.nightTempMaxShort : day.nightTempMax)
          : (isLastSplit ? day.nightTempMinShort : day.nightTempMin);
        if (at !== null) pts.push([cxAm(i),    ty(at)]);
        if (pt !== null) pts.push([cxPm(i),    ty(pt)]);
        if (nt !== null) pts.push([cxNight(i), ty(nt)]);
      } else {
        pts.push([cx(i), ty(isMax ? day.tempMax : day.tempMin)]);
      }
    });
    return pts;
  };

  const makePath = (pts: [number, number][]): string => {
    if (pts.length === 0) return '';
    // 先頭は左端、末尾は右端にアンカー
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
      {daily.map((day, i) => {
        if (day.isPlaceholder) return null;
        const split = i < SPLIT_DAYS;
        if (split && day.amPrecipSum !== null) {
          // 分割日: 午前・午後・夜間 それぞれの中央にバーを配置（実測幅ベース）
          const cxA = cxAm(i);
          const cxP = cxPm(i);
          const cxN = cxNight(i);
          const amBh    = ph(day.amPrecipSum);
          const pmBh    = ph(day.pmPrecipSum ?? 0);
          const nightBh = ph((i === SPLIT_DAYS - 1 ? day.nightPrecipSumShort : day.nightPrecipSum) ?? 0);
          return (
            <g key={i}>
              {amBh > 0 && (
                <>
                  <rect x={cxA - barW / 2} y={H - padB - amBh} width={barW} height={amBh} style={{ fill: 'var(--chart-precip)' }} opacity={0.6} rx={2} ry={2} />
                  <text x={cxA} y={H - padB - amBh - 2} fontSize={10} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">
                    {day.amPrecipSum.toFixed(1)}
                  </text>
                </>
              )}
              {pmBh > 0 && (
                <>
                  <rect x={cxP - barW / 2} y={H - padB - pmBh} width={barW} height={pmBh} style={{ fill: 'var(--chart-precip)' }} opacity={0.6} rx={2} ry={2} />
                  <text x={cxP} y={H - padB - pmBh - 2} fontSize={10} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">
                    {(day.pmPrecipSum ?? 0).toFixed(1)}
                  </text>
                </>
              )}
              {nightBh > 0 && (
                <>
                  <rect x={cxN - barW / 2} y={H - padB - nightBh} width={barW} height={nightBh} style={{ fill: 'var(--chart-precip)' }} opacity={0.6} rx={2} ry={2} />
                  <text x={cxN} y={H - padB - nightBh - 2} fontSize={10} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">
                    {((i === SPLIT_DAYS - 1 ? day.nightPrecipSumShort : day.nightPrecipSum) ?? 0).toFixed(1)}
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
            <text x={cx(i)} y={H - padB - bh - 2} fontSize={12} style={{ fill: 'var(--accent-blue)' }} textAnchor="middle" dominantBaseline="auto">
              {p.toFixed(1)}
            </text>
          </g>
        );
      })}
      <path d={makePath(buildTempPts(false))} fill="none" style={{ stroke: 'var(--accent-blue)' }} strokeWidth={2} strokeLinecap="round" />
      <path d={makePath(buildTempPts(true))} fill="none" style={{ stroke: 'var(--chart-temp)' }} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

interface DailyColumn {
  x: number;
  width: number;
  startMs: number;
  endMs: number; // exclusive
}

function buildDailyColumns(
  daily: DailyForecastData[],
  dayX: number[],
  dayWidths: number[],
): DailyColumn[] {
  const cols: DailyColumn[] = [];
  for (let i = 0; i < daily.length; i++) {
    const dateStr = daily[i].date;
    if (i < SPLIT_DAYS) {
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
    } else {
      const nextDate = i + 1 < daily.length ? daily[i + 1].date : addDays(dateStr, 1);
      cols.push({
        x: dayX[i],
        width: dayWidths[i],
        startMs: Date.parse(`${dateStr}T00:00:00+09:00`),
        endMs:   Date.parse(`${nextDate}T00:00:00+09:00`),
      });
    }
  }
  return cols;
}

function warningToBar(
  warning: JmaWarningItem,
  cols: DailyColumn[],
): { left: string; width: string } | null {
  if (!warning.startMs || cols.length === 0) return null;

  const wStart = warning.startMs;
  // 終了時刻不明（発令中）→ now+12h まで（→ アローは WarningBar 側で表示）
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
          // 3 列（午前・午後・夜間）
          const w = (widths[colIdx] ?? PERIOD_W) + (widths[colIdx + 1] ?? PERIOD_W) + (widths[colIdx + 2] ?? PERIOD_W);
          newDayWidths.push(w);
          xAcc += w;
          colIdx += 3;
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

  // colSpan=3 per split day (date / temp / risk rows)
  const spanCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.35rem 0.25rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  // single cell for days SPLIT_DAYS+ (original layout)
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

  const innerBorder = '1px solid var(--card-border-sub)';

  // AM cell (left of 3-column split day)
  const amCell = (day: DailyForecastData, extra?: CSSProperties): CSSProperties => ({
    width: PERIOD_W,
    minWidth: PERIOD_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.3rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: innerBorder,
    ...extra,
  });

  // PM cell (middle of 3-column split day)
  const pmCell = (day: DailyForecastData, extra?: CSSProperties): CSSProperties => ({
    width: PERIOD_W,
    minWidth: PERIOD_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.3rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: innerBorder,
    ...extra,
  });

  // Night cell (right of 3-column split day)
  const nightCell = (day: DailyForecastData, i: number, extra?: CSSProperties): CSSProperties => ({
    width: PERIOD_W,
    minWidth: PERIOD_W,
    background: cellBg(day),
    textAlign: 'center',
    padding: '0.3rem 0.1rem',
    verticalAlign: 'middle',
    borderRight: dayBorder(i),
    ...extra,
  });

  // mini chart colSpan: split days × 3 + single days × 1
  const chartColSpan = SPLIT_DAYS * 3 + (daily.length - SPLIT_DAYS);

  return (
    <div>
      <div style={{ overflowX: 'auto', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--card-border-sub)', boxShadow: 'var(--shadow-sm)' }}>
        <table ref={tableRef} style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {daily.flatMap((day, i) =>
              i < SPLIT_DAYS
                ? [
                    <col key={`${day.date}-am`}    style={{ width: PERIOD_W }} />,
                    <col key={`${day.date}-pm`}    style={{ width: PERIOD_W }} />,
                    <col key={`${day.date}-night`} style={{ width: PERIOD_W }} />,
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
                const label = isToday
                  ? `今日 ${mm}/${dd}(${DAY_NAMES[dow]})`
                  : `${mm}/${dd}(${DAY_NAMES[dow]})`;
                if (split) {
                  return (
                    <td
                      key={day.date}
                      colSpan={3}
                      style={{ ...spanCell(day, i), textAlign: 'left', paddingTop: '0.75rem', paddingLeft: '0.5rem', verticalAlign: 'top' }}
                    >
                      <div style={{ fontSize: '0.975rem', color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 500, whiteSpace: 'nowrap' }}>
                        {label}
                      </div>
                      <div style={{ display: 'flex', marginTop: '0.35rem' }}>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>午前</div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, borderLeft: '1px solid var(--card-border-sub)' }}>午後</div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, borderLeft: '1px solid var(--card-border-sub)' }}>夜間</div>
                      </div>
                    </td>
                  );
                }
                return (
                  <td
                    key={day.date}
                    style={{ ...singleCell(day, i), paddingTop: '0.75rem', verticalAlign: 'top' }}
                  >
                    <div style={{ fontSize: '0.975rem', color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 500 }}>
                      {label}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 時間帯別天気 */}
            <tr>
              {daily.map((day, i) => {
                if (i < SPLIT_DAYS) {
                  const wStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 };
                  const nightCode = i === SPLIT_DAYS - 1 ? day.nightWeatherCodeShort : day.nightWeatherCode;
                  return (
                    <Fragment key={day.date}>
                      <td style={amCell(day)}><div style={wStyle}>{day.amWeatherCode !== null ? (codeToLabel(day.amWeatherCode) ?? '—') : '—'}</div></td>
                      <td style={pmCell(day)}><div style={wStyle}>{day.pmWeatherCode !== null ? (codeToLabel(day.pmWeatherCode) ?? '—') : '—'}</div></td>
                      <td style={nightCell(day, i)}><div style={wStyle}>{nightCode !== null ? (codeToLabel(nightCode) ?? '—') : '—'}</div></td>
                    </Fragment>
                  );
                }
                return (
                  <td key={day.date} style={singleCell(day, i)}>
                    <div style={{ fontSize: '0.806rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                      {day.isPlaceholder ? '—' : (codeToLabel(day.weatherCode) ?? '—')}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 天気アイコン */}
            <tr>
              {daily.map((day, i) => {
                if (i < SPLIT_DAYS) {
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
                          {(() => {
                            const code = i === SPLIT_DAYS - 1 ? day.nightWeatherCodeShort : day.nightWeatherCode;
                            return code !== null ? <WeatherIcon code={code} size={84} isNight /> : '—';
                          })()}
                        </div>
                      </td>
                    </Fragment>
                  );
                }
                return (
                  <td key={day.date} style={singleCell(day, i)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
                      {day.isPlaceholder
                        ? <span style={{ color: 'var(--text-tertiary)', fontSize: '1rem' }}>—</span>
                        : <WeatherIcon code={day.weatherCode} size={84} />}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 降水確率 */}
            <tr>
              {daily.map((day, i) => {
                if (i < SPLIT_DAYS) {
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
                      <td style={amCell(day)}>
                        <div style={{
                          fontSize: '0.72rem',
                          color: day.amPrecipProb !== null ? probColor(day.amPrecipProb) : 'var(--text-tertiary)',
                          fontWeight: day.amPrecipProb !== null && day.amPrecipProb >= 70 ? 700 : undefined,
                        }}>
                          {day.amPrecipProb !== null ? `${day.amPrecipProb}%` : '—'}
                        </div>
                      </td>
                      <td style={pmCell(day)}>
                        <div style={{
                          fontSize: '0.72rem',
                          color: day.pmPrecipProb !== null ? probColor(day.pmPrecipProb) : 'var(--text-tertiary)',
                          fontWeight: day.pmPrecipProb !== null && day.pmPrecipProb >= 70 ? 700 : undefined,
                        }}>
                          {day.pmPrecipProb !== null ? `${day.pmPrecipProb}%` : '—'}
                        </div>
                      </td>
                      <td style={nightCell(day, i)}>
                        {(() => {
                          const prob = i === SPLIT_DAYS - 1 ? day.nightPrecipProbShort : day.nightPrecipProb;
                          return (
                            <div style={{
                              fontSize: '0.72rem',
                              color: prob !== null ? probColor(prob) : 'var(--text-tertiary)',
                              fontWeight: prob !== null && prob >= 70 ? 700 : undefined,
                            }}>
                              {prob !== null ? `${prob}%` : '—'}
                            </div>
                          );
                        })()}
                      </td>
                    </Fragment>
                  );
                }
                return (
                  <td key={day.date} style={singleCell(day, i)}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                      {day.isPlaceholder ? '—' : `降水 ${day.precipProbMax}%`}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 最高・最低気温 */}
            <tr>
              {daily.map((day, i) => {
                const split = i < SPLIT_DAYS;
                return (
                  <td key={day.date} colSpan={split ? 3 : 1} style={split ? spanCell(day, i) : singleCell(day, i)}>
                    {day.isPlaceholder ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>—</div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                        <span style={{ color: '#fb7185', fontWeight: 700 }}>{Math.round(day.tempMax)}</span>
                        <span style={{ color: 'var(--text-tertiary)', margin: '0 0.2rem', fontSize: '0.8rem' }}>/</span>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>{Math.round(day.tempMin)}</span>
                      </div>
                    )}
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
            {/* ガントバー行（jmaWarnings があり dayX が確定してから描画） */}
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
