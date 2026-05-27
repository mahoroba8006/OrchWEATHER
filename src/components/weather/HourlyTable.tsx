import { useEffect, type CSSProperties, type RefObject } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import type { HourlyForecast, DailyForecastData } from '../../api/forecast';
import { RISK_BADGES, type RiskType } from '../../lib/riskDetection';
import { WeatherIcon } from './WeatherIcon';

function detectHourRisks(h: HourlyForecast): RiskType[] {
  const risks: RiskType[] = [];
  if (h.dewPoint <= 0 && h.temperature <= 3)                         risks.push('frost');
  if (h.cape >= 500 || (h.weatherCode >= 95 && h.weatherCode <= 99)) risks.push('thunder');
  if (h.cape >= 1000 && h.freezingLevel <= 3500)                     risks.push('hail');
  if (h.windSpeed >= 15)                                              risks.push('wind');
  if (h.precipitation >= 30)                                          risks.push('rain');
  if (h.temperature >= 35)                                            risks.push('heat');
  if (h.humidity <= 30)                                               risks.push('dry');
  return risks;
}

interface Props {
  hourly: HourlyForecast[];
  daily: DailyForecastData[];
  scrollRef: RefObject<HTMLDivElement | null>;
  scrollTarget?: string; // "YYYY-MM-DDTHH:00" — scroll this column to left edge
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

// ミニグラフバー用：降水強度の感覚ラベル
function precipToLabel(mm: number): string {
  if (mm < 0.5)  return 'ぽつぽつ';
  if (mm < 1.0)  return 'しとしと';
  if (mm < 5.0)  return 'さーっ';
  if (mm < 10.0) return 'ザーザー';
  if (mm < 20.0) return '土砂降り';
  if (mm < 30.0) return 'ばしゃばしゃ';
  if (mm < 50.0) return 'バチバチ';
  if (mm < 80.0) return '滝のよう';
  return '猛烈';
}

// 飽差 (g/m³): e_s(T)[hPa] = 6.1078 × 10^(7.5T/(T+237.3))、飽和水蒸気量 = 216.67 × e_s / (T+273.15)
function calcVPD(tempC: number, humidPct: number): number {
  const e_s = 6.1078 * Math.pow(10, 7.5 * tempC / (tempC + 237.3));
  const a_max = 216.67 * e_s / (tempC + 273.15);
  return a_max * (1 - humidPct / 100);
}

// 各時間の列幅（元の値は 40。お試しで20%狭くして 32 に設定中）
export const COL_W = 32;

const STICKY: CSSProperties = {
  position: 'sticky',
  left: 0,
  background: '#eff6f3', /* iOSや一部モバイルブラウザのWebKitにおけるsticky+backdrop-filterクラッシュバグを回避するため不透明なミント背景に変更 */
  padding: '0.35rem 0.6rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderRight: '1px solid var(--card-border-sub)',
  zIndex: 1,
  minWidth: 90,
  fontSize: '0.75rem',
  verticalAlign: 'middle',
};

// ── Timeline ──────────────────────────────────────────────
type HourlyEntry = { kind: 'hourly'; data: HourlyForecast };
type SunEntry    = { kind: 'sun';    sunType: 'rise' | 'set'; time: string };
type TLEntry     = HourlyEntry | SunEntry;

const tlTime = (e: TLEntry) => (e.kind === 'hourly' ? e.data.time : e.time);

// ── Sub-components ────────────────────────────────────────
function RiskBadgesRow({ tl, cutoff }: { tl: TLEntry[]; cutoff: Date }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
      <td style={STICKY} />
      {tl.map((entry, i) => {
        if (entry.kind === 'sun') return <td key={`risk-sun-${i}`} style={{ minWidth: COL_W }} />;
        const h = entry.data;
        const risks = detectHourRisks(h);
        const isPast = new Date(h.time) < cutoff;
        return (
          <td key={`risk-${h.time}`} style={{ padding: '0.15rem 0.1rem', textAlign: 'center', background: risks.length > 0 ? '#fff0f5' : undefined, minWidth: COL_W, verticalAlign: 'middle', opacity: isPast ? 0.35 : undefined }}>
            {risks.map(r => <img key={r} src={`/icons/weather/${RISK_BADGES[r].iconFile}.svg`} width={16} height={16} alt={RISK_BADGES[r].label} style={{ display: 'inline-block', verticalAlign: 'middle' }} />)}
          </td>
        );
      })}
    </tr>
  );
}


function MiniChartRow({ tl }: { tl: TLEntry[] }) {
  const hourlyPos: number[]   = [];
  const hourlyItems: HourlyEntry[] = [];
  tl.forEach((e, i) => { if (e.kind === 'hourly') { hourlyPos.push(i); hourlyItems.push(e); } });

  const W = tl.length * COL_W;
  const H = 64, padT = 6, padB = 6;
  const innerH = H - padT - padB;

  const temps   = hourlyItems.map(e => e.data.temperature);
  const precips = hourlyItems.map(e => e.data.precipitation);
  const tMin = Math.min(...temps), tMax = Math.max(...temps);
  const tRange = tMax - tMin || 1;
  const pMax   = Math.max(...precips, 1);

  const cx = (ti: number) => ti * COL_W + COL_W / 2;
  const ty = (t: number)  => padT + (1 - (t - tMin) / tRange) * innerH;
  const ph = (p: number)  => p === 0 ? 0 : Math.max(1, (p / pMax) * innerH * 0.45);

  // path connects only hourly positions — sun columns are just gaps in x-space
  const pts = hourlyPos.map((ti, i) => [cx(ti), ty(temps[i])] as [number, number]);
  let pathD = '';
  if (pts.length > 0) {
    pathD = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cpx = ((x0 + x1) / 2).toFixed(1);
      pathD += ` C ${cpx} ${y0.toFixed(1)} ${cpx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
  }

  const gridStep = 5;
  const gMin = Math.ceil(tMin / gridStep) * gridStep;
  const gMax = Math.floor(tMax / gridStep) * gridStep;
  const gridTemps: number[] = [];
  for (let v = gMin; v <= gMax; v += gridStep) gridTemps.push(v);

  return (
    <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
      <td style={STICKY}>気温/降水</td>
      <td colSpan={tl.length} style={{ padding: 0, position: 'relative' }}>
        {/* SVG: バー・気温ライン（preserveAspectRatio="none" で横幅100%に伸縮） */}
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {gridTemps.map(v => (
            <g key={v}>
              <line x1={0} y1={ty(v)} x2={W} y2={ty(v)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={3} y={ty(v) - 2} fontSize={7} fill="#c5c9d3">{v}</text>
            </g>
          ))}
          {hourlyPos.map((ti, i) => {
            const bh = ph(precips[i]);
            if (bh === 0) return null;
            return (
              <rect key={ti} x={ti * COL_W + COL_W * 0.325} y={H - padB - bh} width={COL_W * 0.35} height={bh} fill="#93c5fd" opacity={0.75} />
            );
          })}
          <path d={pathD} fill="none" stroke="#fb923c" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
        {/* 雨コメント: HTMLオーバーレイ（列幅で切り捨て、横伸びなし） */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: H, display: 'flex', pointerEvents: 'none' }}>
          {tl.map((entry, i) => {
            const colPct = `${(1 / tl.length) * 100}%`;
            if (entry.kind !== 'hourly') return <div key={i} style={{ flex: `0 0 ${colPct}` }} />;
            const bh = ph(entry.data.precipitation);
            if (bh === 0) return <div key={i} style={{ flex: `0 0 ${colPct}` }} />;
            return (
              <div key={i} style={{ flex: `0 0 ${colPct}`, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  bottom: padB + bh + 2,
                  left: 0,
                  right: 0,
                  fontSize: '0.6rem',
                  color: '#60a5fa',
                  textAlign: 'center',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {precipToLabel(entry.data.precipitation)}
                </div>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

// UV index → Meteocons filename
function uvToIconFile(uvIndex: number): string {
  const v = Math.round(uvIndex);
  if (v <= 1)  return 'uv-index-1';
  if (v >= 11) return 'uv-index-11-plus';
  return `uv-index-${v}`;
}

function UVRow({ tl, isNighttime, cutoff }: {
  tl: TLEntry[];
  isNighttime: (t: string) => boolean;
  cutoff: Date;
}) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
      <td style={STICKY}>紫外線指数</td>
      {tl.map((entry, i) => {
        if (entry.kind === 'sun') return <td key={`uv-sun-${i}`} style={{ minWidth: COL_W }} />;
        const h = entry.data;
        const isPast = new Date(h.time) < cutoff;
        if (isNighttime(h.time)) {
          return <td key={`uv-${h.time}`} style={{ minWidth: COL_W, opacity: isPast ? 0.35 : undefined }} />;
        }
        return (
          <td key={`uv-${h.time}`} style={{ padding: '0.1rem 0', textAlign: 'center', minWidth: COL_W, verticalAlign: 'middle', opacity: isPast ? 0.35 : undefined }}>
            <img
              src={`/icons/weather/${uvToIconFile(h.uvIndex)}.svg`}
              width={38}
              height={38}
              alt={`UV ${Math.round(h.uvIndex)}`}
              style={{ display: 'inline-block' }}
            />
          </td>
        );
      })}
    </tr>
  );
}

// 度数 → 16方位の日本語
function degreesToCompass(deg: number): string {
  const dirs = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return dirs[idx];
}

// ── Data rows (excluding date / time / weather handled inline) ──
const DATA_ROWS: { key: string; label: string; fmt: (h: HourlyForecast) => string; isRisk: (h: HourlyForecast) => boolean }[] = [
  { key: 'temperature',  label: '気温(℃)',     fmt: h => h.temperature.toFixed(1),            isRisk: h => h.temperature >= 35 || h.temperature <= 3 },
  { key: 'precip',       label: '降水(mm)',     fmt: h => h.precipitation.toFixed(1),          isRisk: h => h.precipitation >= 30 },
  { key: 'dewPoint',     label: '露点(℃)',     fmt: h => h.dewPoint.toFixed(1),                isRisk: h => h.dewPoint <= 0 },
  { key: 'humidity',     label: '湿度(%)',      fmt: h => String(h.humidity),                  isRisk: h => h.humidity <= 30 },
  { key: 'vpd',          label: '飽差(g/m³)',  fmt: h => calcVPD(h.temperature, h.humidity).toFixed(1), isRisk: () => false },
  { key: 'windDir',      label: '風向き',       fmt: h => degreesToCompass(h.windDirection),   isRisk: () => false },
  { key: 'windSpeed',    label: '風速(m/s)',    fmt: h => h.windSpeed.toFixed(1),              isRisk: h => h.windSpeed >= 15 },
  { key: 'cape',         label: 'CAPE(J/kg)',  fmt: h => Math.round(h.cape).toString(),        isRisk: h => h.cape >= 500 },
  { key: 'freezing',     label: '0℃層高度(m)', fmt: h => Math.round(h.freezingLevel).toString(), isRisk: h => h.freezingLevel <= 3500 && h.cape >= 1000 },
  { key: 'pressure',     label: '気圧(hPa)',    fmt: h => Math.round(h.pressure).toString(),   isRisk: () => false },
];

// ── Main component ────────────────────────────────────────
export function HourlyTable({ hourly, daily, scrollRef, scrollTarget }: Props) {
  const now    = new Date();
  const cutoff = new Date(now.getTime() - 3600 * 1000);

  // Build timeline: hourly entries interleaved with sun events inside the range
  const firstTime = hourly.length > 0 ? hourly[0].time : '';
  const lastTime  = hourly.length > 0 ? hourly[hourly.length - 1].time : '';
  const sunEntries: SunEntry[] = daily
    .flatMap(d => [
      { kind: 'sun' as const, sunType: 'rise' as const, time: d.sunrise },
      { kind: 'sun' as const, sunType: 'set'  as const, time: d.sunset  },
    ])
    .filter(e => e.time >= firstTime && e.time <= lastTime);

  const tl: TLEntry[] = [
    ...hourly.map(data => ({ kind: 'hourly' as const, data })),
    ...sunEntries,
  ].sort((a, b) => tlTime(a).localeCompare(tlTime(b)));

  // Scroll to the 1-hour-before-now column on load
  useEffect(() => {
    if (!scrollRef.current || tl.length === 0) return;
    const STICKY_W = 90;
    let targetIdx = 0;
    for (let i = 0; i < tl.length; i++) {
      if (new Date(tlTime(tl[i])) <= cutoff) targetIdx = i;
      else break;
    }
    const cell = scrollRef.current.querySelector(`[data-time="${tlTime(tl[targetIdx])}"]`) as HTMLElement | null;
    if (cell) {
      scrollRef.current.scrollLeft += cell.getBoundingClientRect().left - scrollRef.current.getBoundingClientRect().left - STICKY_W;
    }
  }, [hourly]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scrollTarget || !scrollRef.current) return;
    const container = scrollRef.current;
    const cell = container.querySelector(`[data-time="${scrollTarget}"]`) as HTMLElement | null;
    if (!cell) return;
    const STICKY_W = 90; // matches minWidth in STICKY style
    container.scrollLeft += cell.getBoundingClientRect().left - container.getBoundingClientRect().left - STICKY_W;
  }, [scrollTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPast = (e: TLEntry) => new Date(tlTime(e)) < cutoff;

  // 夜間判定: daily の sunrise/sunset を時刻順に並べ、直前のイベントが sunset なら夜
  const allSunEvents = daily
    .flatMap(d => [
      { sunType: 'rise' as const, time: d.sunrise },
      { sunType: 'set'  as const, time: d.sunset  },
    ])
    .sort((a, b) => a.time.localeCompare(b.time));

  const isNighttime = (hTime: string): boolean => {
    if (allSunEvents.length === 0) return false;
    // データ中の最初のイベントより前の時刻は、最初が sunrise なら夜
    if (hTime < allSunEvents[0].time) return allSunEvents[0].sunType === 'rise';
    let last = allSunEvents[0];
    for (const e of allSunEvents) {
      if (e.time <= hTime) last = e;
      else break;
    }
    return last.sunType === 'set';
  };

  return (
    <div>
      <div ref={scrollRef} style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--card-border-sub)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
          <tbody>
            {/* 日付 */}
            <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
              <td style={STICKY}>日付</td>
              {tl.map((entry, i) => {
                const t = tlTime(entry);
                const date = t.slice(0, 10);
                const sameDay = i > 0 && tlTime(tl[i - 1]).slice(0, 10) === date;
                const label = sameDay ? '' : (() => {
                  const mm = parseInt(date.slice(5, 7), 10);
                  const dd = parseInt(date.slice(8, 10), 10);
                  const dow = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
                  return `${mm}/${dd}(${dow})`;
                })();
                return (
                  <td key={`d-${i}`} style={{ padding: '0.3rem 0.4rem', textAlign: 'center', minWidth: COL_W, color: isPast(entry) ? '#c0c4cf' : '#5b6478', fontWeight: label ? 600 : undefined, fontSize: '0.7rem', ...(!sameDay && i > 0 ? { borderLeft: '2px solid #ebeef5' } : {}) }}>
                    {label}
                  </td>
                );
              })}
            </tr>
            {/* 時刻 */}
            <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
              <td style={STICKY}>時刻</td>
              {tl.map((entry, i) => {
                const t = tlTime(entry);
                const faded = isPast(entry);
                if (entry.kind === 'sun') {
                  return (
                    <td key={`t-${i}`} style={{ padding: '0.3rem 0.2rem', textAlign: 'center', minWidth: COL_W, color: faded ? '#c0c4cf' : '#f59e0b', fontWeight: 600, fontSize: '0.62rem' }}>
                      {t.slice(11, 16)}
                    </td>
                  );
                }
                return (
                  <td key={`t-${i}`} data-time={t} style={{ padding: '0.3rem 0.4rem', textAlign: 'center', minWidth: COL_W, color: faded ? '#c0c4cf' : '#4b5563' }}>
                    {String(parseInt(t.slice(11, 13), 10))}
                  </td>
                );
              })}
            </tr>
            {/* 天気 */}
            <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
              <td style={STICKY}>天気</td>
              {tl.map((entry, i) => {
                const faded = isPast(entry);
                if (entry.kind === 'sun') {
                  const Icon  = entry.sunType === 'rise' ? Sunrise : Sunset;
                  const color = entry.sunType === 'rise' ? '#f97316' : '#f59e0b';
                  const label = entry.sunType === 'rise' ? '日の出' : '日の入';
                  return (
                    <td key={`w-${i}`} style={{ padding: '0.2rem 0.1rem', textAlign: 'center', minWidth: COL_W, verticalAlign: 'middle', opacity: faded ? 0.4 : 1 }}>
                      <Icon size={18} color={color} strokeWidth={1.5} />
                      <div style={{ fontSize: '0.55rem', color: '#8a93a6', lineHeight: 1.2, marginTop: 2 }}>{label}</div>
                    </td>
                  );
                }
                return (
                  <td key={`w-${i}`} style={{ padding: '0.2rem 0.1rem', textAlign: 'center', minWidth: COL_W, verticalAlign: 'middle', opacity: faded ? 0.4 : 1 }}>
                    <WeatherIcon code={entry.data.weatherCode} isNight={isNighttime(entry.data.time)} size={43} animated={false} />
                  </td>
                );
              })}
            </tr>
            <RiskBadgesRow tl={tl} cutoff={cutoff} />
            <MiniChartRow tl={tl} />
            <UVRow tl={tl} isNighttime={isNighttime} cutoff={cutoff} />
            {/* データ行 */}
            {DATA_ROWS.map(row => (
              <tr key={row.key} style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td style={STICKY}>{row.label}</td>
                {tl.map((entry, i) => {
                  if (entry.kind === 'sun') return <td key={`${row.key}-${i}`} style={{ minWidth: COL_W }} />;
                  const h = entry.data;
                  const risk = row.isRisk(h);
                  return (
                    <td key={`${row.key}-${i}`} style={{ padding: '0.3rem 0.4rem', textAlign: 'center', background: risk ? '#fff0f5' : undefined, fontWeight: risk ? 700 : undefined, minWidth: COL_W, color: isPast(entry) ? '#c0c4cf' : '#4b5563' }}>
                      {row.fmt(h)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
