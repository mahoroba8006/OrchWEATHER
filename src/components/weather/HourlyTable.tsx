import { useEffect, type CSSProperties, type RefObject } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import type { HourlyForecast, DailyForecastData } from '../../api/forecast';
import { WeatherIcon } from './WeatherIcon';
import type { JmaWarningItem } from '../../api/jmaWarning';
// ガントバー再表示時は以下2行のコメントを外す
// import { computeWarningLanes } from '../../lib/warningGantt';
// import { WarningBar } from './WarningBar';

interface Props {
  hourly: HourlyForecast[];
  daily: DailyForecastData[];
  scrollRef?: RefObject<HTMLDivElement | null>;
  scrollTarget?: string; // "YYYY-MM-DDTHH:00" — scroll this column to left edge
  disablePastOpacity?: boolean; // true: 過去時刻のグレーアウトを無効化（履歴タブ用）
  jmaWarnings?: JmaWarningItem[];
  // 非表示にするデータ行のキー集合（過去APIで欠落する項目用）。
  // DATA_ROWS の key および UV行の 'uv' を指定可。未指定は全行表示。
  hiddenRowKeys?: ReadonlySet<string>;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

// ミニグラフバー用：降水強度の感覚ラベル
// 0〜3mm は農作業のカッパ判断（迷う帯）に合わせた体感表現、3mm以上は気象庁「雨の強さ」区分に準拠
function precipToLabel(mm: number): string {
  if (mm < 0.5)  return 'ぽつぽつ'; // ぽつりと当たる程度
  if (mm < 1.0)  return 'カッパ？'; // 濡れ始める。カッパ判断の境
  if (mm < 3.0)  return 'カッパ！'; // しっかり濡れる。カッパ必須
  if (mm < 10.0) return '本降り';   // 並の雨
  if (mm < 20.0) return 'ザーザー';   // やや強い雨
  if (mm < 30.0) return '土砂降り';   // 強い雨
  if (mm < 50.0) return '激しい雨';   // 激しい雨
  if (mm < 80.0) return '滝のよう';   // 非常に激しい雨
  return '猛烈';                      // 猛烈な雨
}

// 飽差 (g/m³): e_s(T)[hPa] = 6.1078 × 10^(7.5T/(T+237.3))、飽和水蒸気量 = 216.67 × e_s / (T+273.15)
function calcVPD(tempC: number, humidPct: number): number {
  const e_s = 6.1078 * Math.pow(10, 7.5 * tempC / (tempC + 237.3));
  const a_max = 216.67 * e_s / (tempC + 273.15);
  return a_max * (1 - humidPct / 100);
}

// 各時間の固定列幅。table-layout:fixed + colgroup で全列をこの幅に統一する（太陽列も同じ）。
// 風向き「北北西」(0.7rem ≈ 34px) が収まる最小幅に合わせたコンパクト値。
// 全列が等幅になることで、ミニグラフの座標系（viewBox=列数×COL_W）が実レイアウトと一致する。
export const COL_W = 42;
// 左端ラベル列の固定幅（単位を2行目に分離したことで「瞬間風速」4文字が最長 → 76px）
const LABEL_W = 76;

const STICKY: CSSProperties = {
  position: 'sticky',
  left: 0,
  background: '#eff6f3', /* iOSや一部モバイルブラウザのWebKitにおけるsticky+backdrop-filterクラッシュバグを回避するため不透明なミント背景に変更 */
  padding: '0.35rem 0.6rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderRight: '1px solid var(--card-border-sub)',
  zIndex: 1,
  minWidth: LABEL_W,
  fontSize: '0.75rem',
  verticalAlign: 'middle',
};

// ── Timeline ──────────────────────────────────────────────
type HourlyEntry = { kind: 'hourly'; data: HourlyForecast };
type SunEntry    = { kind: 'sun';    sunType: 'rise' | 'set'; time: string };
type TLEntry     = HourlyEntry | SunEntry;

const tlTime = (e: TLEntry) => (e.kind === 'hourly' ? e.data.time : e.time);

// ── Sub-components ────────────────────────────────────────

function MiniChartRow({ tl, hourlyPos }: { tl: TLEntry[]; hourlyPos: number[] }) {
  const hourlyItems: HourlyEntry[] = tl.filter((e): e is HourlyEntry => e.kind === 'hourly');

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
        {/* SVG: バー・気温ライン。列が固定幅(COL_W)になったので td 幅 = 列数×COL_W = W と一致し、
            横伸縮（preserveAspectRatio="none"）は不要。実ピクセル座標でそのまま描画する。 */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
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
              width={36}
              height={36}
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
const DATA_ROWS: { key: string; label: string; unit?: string; fmt: (h: HourlyForecast) => string }[] = [
  { key: 'temperature',  label: '気温',     unit: '℃',     fmt: h => h.temperature.toFixed(1) },
  { key: 'precipProb',   label: '降水確率',  unit: '%',     fmt: h => String(h.precipProb) },
  { key: 'precip',       label: '降水量',    unit: 'mm',    fmt: h => h.precipitation === 0 ? '0.0' : (Math.ceil(h.precipitation * 10) / 10).toFixed(1) },
  { key: 'snowfall',     label: '降雪量',    unit: 'cm',    fmt: h => h.snowfall === 0 ? '0.0' : (Math.ceil(h.snowfall * 10) / 10).toFixed(1) },
  { key: 'windSpeed',    label: '風速',      unit: 'm/s',   fmt: h => h.windSpeed.toFixed(1) },
  { key: 'windGusts',    label: '瞬間風速',  unit: 'm/s',   fmt: h => h.windGusts.toFixed(1) },
  { key: 'windDir',      label: '風向き',                   fmt: h => degreesToCompass(h.windDirection) },
  { key: 'pressure',     label: '気圧',      unit: 'hPa',   fmt: h => Math.round(h.pressure).toString() },
  { key: 'humidity',     label: '湿度',      unit: '%',     fmt: h => String(h.humidity) },
  { key: 'vpd',          label: '飽差',      unit: 'g/m³',  fmt: h => calcVPD(h.temperature, h.humidity).toFixed(1) },
  { key: 'dewPoint',     label: '露点',      unit: '℃',     fmt: h => h.dewPoint.toFixed(1) },
  { key: 'cape',         label: 'CAPE',      unit: 'J/kg',  fmt: h => Math.round(h.cape).toString() },
  { key: 'freezing',     label: '0℃層高度',  unit: 'm',     fmt: h => Math.round(h.freezingLevel).toString() },
];

// ── Gantt helpers（ガントバー再表示時はこのセクション全体のコメントを外す）─────
// function toJSTHourStr(utcMs: number): string {
//   const jstMs = utcMs + 9 * 60 * 60 * 1000;
//   const d = new Date(jstMs);
//   const y  = d.getUTCFullYear();
//   const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
//   const dy = String(d.getUTCDate()).padStart(2, '0');
//   const h  = String(d.getUTCHours()).padStart(2, '0');
//   return `${y}-${mo}-${dy}T${h}:00`;
// }

// ガントバー再表示時はこの関数のコメントを外す
// function warningToHourlyBar(
//   warning: JmaWarningItem,
//   hourly: HourlyForecast[],
//   hourlyPos: number[],
//   totalCols: number,
// ): { left: string; width: string } | null {
//   if (!warning.startMs || hourly.length === 0) return null;
//   const startStr = toJSTHourStr(warning.startMs);
//   let startHIdx = 0;
//   for (let i = 0; i < hourly.length; i++) {
//     if (hourly[i].time <= startStr) startHIdx = i;
//     else break;
//   }
//   if (startStr > hourly[hourly.length - 1].time) return null;
//   const end12Str = toJSTHourStr(Date.now() + 12 * 60 * 60 * 1000);
//   const idx12 = hourly.findIndex(h => h.time >= end12Str);
//   const leftCol  = hourlyPos[startHIdx];
//   const rightCol = idx12 === -1
//     ? hourlyPos[hourly.length - 1] + 1
//     : hourlyPos[idx12];
//   if (rightCol <= leftCol) return null;
//   return {
//     left:  `${(leftCol / totalCols) * 100}%`,
//     width: `${((rightCol - leftCol) / totalCols) * 100}%`,
//   };
// }

// ── Main component ────────────────────────────────────────
export function HourlyTable({ hourly, daily, scrollRef, scrollTarget, disablePastOpacity, hiddenRowKeys }: Props) {
  const now    = new Date();
  const cutoff = new Date(now.getTime() - 3600 * 1000);

  // 履歴タブはすべての時刻が「過去」になるため、グレーアウトを無効化する
  const effectiveCutoff = disablePastOpacity ? new Date(0) : cutoff;

  // 降雪量行は、表示期間内に降雪(>0)があるときだけ出す（無雪期の 0.0 連続を抑制）
  const hasSnow = hourly.some(h => h.snowfall > 0);

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

  // hourly エントリの tl 列インデックス（MiniChartRow と gantt 行で共用）
  const hourlyPos: number[] = [];
  tl.forEach((e, i) => { if (e.kind === 'hourly') hourlyPos.push(i); });

  // Scroll to the 1-hour-before-now column on load.
  // 履歴タブ (disablePastOpacity=true) はすべてが過去なので末尾に飛ばず左端をそのまま表示。
  useEffect(() => {
    if (!scrollRef?.current || tl.length === 0) return;
    if (disablePastOpacity) return;
    const STICKY_W = LABEL_W;
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
    if (!scrollTarget || !scrollRef?.current) return;
    const container = scrollRef.current;
    const cell = container.querySelector(`[data-time="${scrollTarget}"]`) as HTMLElement | null;
    if (!cell) return;
    const STICKY_W = LABEL_W; // matches the sticky label column width
    container.scrollLeft += cell.getBoundingClientRect().left - container.getBoundingClientRect().left - STICKY_W;
  }, [scrollTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPast = (e: TLEntry) => new Date(tlTime(e)) < effectiveCutoff;
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
      <div ref={scrollRef ?? undefined} style={{ overflowX: 'auto', touchAction: 'pan-x pan-y', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--card-border-sub)' }}>
        {/* width を明示しないと table-layout:fixed が colgroup 幅を厳密適用せず、
            列がセル内容に合わせて COL_W より広くなる。すると固定ピクセルで描く
            ミニグラフSVG(W=列数×COL_W)が実列幅と食い違い、右へ行くほどバーがずれる。
            テーブル幅 = ラベル列 + 列数×COL_W に固定して各列を実寸 COL_W に揃える。 */}
        <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap', tableLayout: 'fixed', width: LABEL_W + tl.length * COL_W }}>
          <colgroup>
            <col style={{ width: LABEL_W }} />
            {tl.map((_, i) => <col key={i} style={{ width: COL_W }} />)}
          </colgroup>
          <tbody>
            {/* 日付 */}
            <tr style={{ borderBottom: '1px solid #f0f2f8' }}>
              <td style={STICKY}>日付</td>
              {(() => {
                const cells: React.ReactElement[] = [];
                let i = 0;
                while (i < tl.length) {
                  const entry = tl[i];
                  const date = tlTime(entry).slice(0, 10);
                  let span = 1;
                  while (i + span < tl.length && tlTime(tl[i + span]).slice(0, 10) === date) span++;
                  const isToday = date === todayStr;
                  const isPastDate = date < todayStr;
                  const mm = parseInt(date.slice(5, 7), 10);
                  const dd = parseInt(date.slice(8, 10), 10);
                  const dow = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
                  const label = `${mm}/${dd}(${dow})`;
                  cells.push(
                    <td key={`d-${i}`} colSpan={span} style={{ padding: '0.2rem 0.15rem', ...(i > 0 ? { borderLeft: '2px solid #ebeef5' } : {}) }}>
                      <div style={{
                        background: isPastDate ? 'rgba(180, 185, 200, 0.12)' : isToday ? 'rgba(59, 130, 246, 0.13)' : 'rgba(13, 148, 136, 0.11)',
                        borderRadius: '6px',
                        padding: '0.12rem 0.3rem',
                        fontSize: '0.68rem',
                        color: isPastDate ? '#c0c4cf' : isToday ? 'var(--accent-blue)' : 'var(--accent-color)',
                        fontWeight: 600,
                        textAlign: 'center',
                      }}>
                        {label}
                      </div>
                    </td>
                  );
                  i += span;
                }
                return cells;
              })()}
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
                    <WeatherIcon code={entry.data.weatherCode} isNight={isNighttime(entry.data.time)} size={36} animated={false} />
                  </td>
                );
              })}
            </tr>
            <MiniChartRow tl={tl} hourlyPos={hourlyPos} />
            {/* ガントバー行（非表示中・再表示する場合はコメントを外す） */}
            {/* {jmaWarnings && jmaWarnings.length > 0 && (() => {
              const lanes = computeWarningLanes(jmaWarnings);
              return lanes.map((lane, laneIdx) => (
                <tr key={`gantt-${laneIdx}`}>
                  <td style={{ ...STICKY, padding: 0, borderBottom: 'none' }} />
                  <td colSpan={tl.length} style={{ padding: 0, position: 'relative', height: 22 }}>
                    {lane.map(warning => {
                      const bar = warningToHourlyBar(warning, hourly, hourlyPos, tl.length);
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
            })()} */}
            {!hiddenRowKeys?.has('uv') && (
              <UVRow tl={tl} isNighttime={isNighttime} cutoff={effectiveCutoff} />
            )}
            {/* データ行 */}
            {DATA_ROWS
              .filter(row => row.key !== 'snowfall' || hasSnow)
              .filter(row => !hiddenRowKeys?.has(row.key))
              .map(row => (
              <tr key={row.key} style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td style={STICKY}>
                  <div>{row.label}</div>
                  {row.unit && <div style={{ fontSize: '0.6rem', fontWeight: 400, lineHeight: 1, marginTop: 1, color: 'var(--text-tertiary)' }}>{row.unit}</div>}
                </td>
                {tl.map((entry, i) => {
                  if (entry.kind === 'sun') return <td key={`${row.key}-${i}`} style={{ minWidth: COL_W }} />;
                  const h = entry.data;
                  return (
                    <td key={`${row.key}-${i}`} style={{ padding: '0.3rem 0.1rem', textAlign: 'center', minWidth: COL_W, color: isPast(entry) ? '#c0c4cf' : '#4b5563', ...(row.key === 'windDir' ? { fontSize: '0.7rem' } : {}) }}>
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
