import type { CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import { WeatherIcon } from './WeatherIcon';
import { addDays } from '../../lib/dateUtils';
import { selectCode, type WeatherCodeMode } from '../../lib/wmoSeverity';

// 今日の2週間前〜2週間後を、日曜始まりのカレンダーで見せる（試作: variant で見た目を切り替える）
export type CalendarVariant = 'a' | 'b' | 'c';

interface Props {
  pastDaily: DailyForecastData[];
  daily: DailyForecastData[];
  weatherCodeMode: WeatherCodeMode;
  variant: CalendarVariant;
  today: string;
}

type Status = 'past' | 'today' | 'future';

export interface CalendarDay {
  date: string;
  status: Status;
  far: boolean;            // 8日目以降（予報の当たりやすさが下がる）
  code: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipProb: number | null; // 過去の日は出さない
  precipSum: number | null;
}

const RANGE = 14;
const FAR_FROM = 8;
const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const TEMP_MAX_COLOR = '#E0555A';
const TEMP_MIN_COLOR = '#2E7DD7';

const sum3 = (d: DailyForecastData) =>
  d.amPrecipSum === null || d.pmPrecipSum === null || d.nightPrecipSum === null
    ? d.precipSum
    : d.amPrecipSum + d.pmPrecipSum + d.nightPrecipSum;

/** 1日=4時〜翌4時（午前・午後・夜間の合計）。時間別が無い日は日別の値で補う */
export function buildCalendar(pastDaily: DailyForecastData[], daily: DailyForecastData[], today: string, mode: WeatherCodeMode): (CalendarDay | null)[] {
  const byDate = new Map([...pastDaily, ...daily].map(d => [d.date, d]));
  const first = addDays(today, -RANGE);
  const last = addDays(today, RANGE);
  const dow = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -dow(first));
  const gridEnd = addDays(last, 6 - dow(last));
  const cells: (CalendarDay | null)[] = [];
  for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
    if (date < first || date > last) { cells.push(null); continue; }
    const d = byDate.get(date);
    const status: Status = date < today ? 'past' : date === today ? 'today' : 'future';
    const has = d && !d.isPlaceholder;
    const codes = d ? [...d.amCodes, ...d.pmCodes, ...d.nightCodes] : [];
    const probs = d ? [d.amPrecipProb, d.pmPrecipProb, d.nightPrecipProb].filter((p): p is number => p !== null) : [];
    cells.push({
      date,
      status,
      far: date >= addDays(today, FAR_FROM),
      code: !has ? null : codes.length > 0 ? selectCode(codes, mode) : d.weatherCode,
      tempMax: has ? d.tempMax : null,
      tempMin: has ? d.tempMin : null,
      precipProb: !has || status === 'past' ? null : probs.length > 0 ? Math.max(...probs) : d.precipProbMax,
      precipSum: has ? sum3(d) : null,
    });
  }
  return cells;
}

const dayLabel = (date: string, i: number) => {
  const dd = parseInt(date.slice(8, 10), 10);
  return dd === 1 || i === 0 ? `${parseInt(date.slice(5, 7), 10)}/${dd}` : String(dd);
};

const fmtMm = (v: number | null) => (v === null || v < 0.5 ? '' : v >= 10 ? `${Math.round(v)}` : v.toFixed(1));

function probColor(p: number): string {
  if (p >= 70) return 'var(--accent-blue)';
  if (p >= 40) return '#2E8BC0';
  return 'var(--ink-3)';
}

// ── 天気の系統（C案の地の色） ──
function skyTint(code: number | null): string {
  if (code === null) return 'var(--surface-card)';
  if (code >= 95) return '#ECE6F6';                         // 雷
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '#EEF2F8'; // 雪
  if (code >= 51) return '#E1EEFA';                         // 雨
  if (code >= 2) return '#F0F0EE';                          // くもり・霧
  return '#FBF3DC';                                         // 晴れ
}

function CellBody({ day, compact }: { day: CalendarDay; compact?: boolean }) {
  const mm = fmtMm(day.precipSum);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, opacity: day.far ? 0.62 : undefined }}>
      {day.code !== null
        ? <WeatherIcon code={day.code} size={compact ? 36 : 40} animated={false} style={{ margin: '-3px 0' }} />
        : <div style={{ height: compact ? 30 : 34, lineHeight: '30px', color: 'var(--ink-3)' }}>—</div>}
      <div style={{ fontSize: '0.68rem', lineHeight: 1.2, whiteSpace: 'nowrap', fontWeight: 600 }}>
        {day.tempMax !== null && day.tempMin !== null ? (
          <>
            <span style={{ color: TEMP_MAX_COLOR }}>{Math.round(day.tempMax)}</span>
            <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>/</span>
            <span style={{ color: TEMP_MIN_COLOR }}>{Math.round(day.tempMin)}</span>
          </>
        ) : <span style={{ color: 'var(--ink-3)' }}>—</span>}
      </div>
      <div style={{ fontSize: '0.6rem', lineHeight: 1.25, height: '1.25em', whiteSpace: 'nowrap', color: day.precipProb !== null ? probColor(day.precipProb) : undefined, fontWeight: day.precipProb !== null && day.precipProb >= 70 ? 700 : 500 }}>
        {day.precipProb !== null ? `${day.precipProb}%` : ''}
      </div>
      <div style={{ fontSize: '0.6rem', lineHeight: 1.25, height: '1.25em', whiteSpace: 'nowrap', color: 'var(--chart-precip)', fontWeight: 600 }}>
        {mm && <>{mm}<span style={{ fontSize: '0.85em', fontWeight: 400 }}>mm</span></>}
      </div>
    </div>
  );
}

function Weekdays({ gap }: { gap: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap, marginBottom: 4 }}>
      {DOW.map((w, i) => (
        <div key={w} style={{
          textAlign: 'center', fontSize: '0.68rem', fontWeight: 600,
          color: i === 0 ? '#C2493F' : i === 6 ? 'var(--accent-blue)' : 'var(--ink-3)',
        }}>{w}</div>
      ))}
    </div>
  );
}

const dateColor = (date: string) => {
  const w = new Date(`${date}T00:00:00Z`).getUTCDay();
  return w === 0 ? '#C2493F' : w === 6 ? 'var(--accent-blue)' : 'var(--ink-1)';
};

// ── A: 紙のカレンダー（細い罫線・マスを塗り分け） ──
function VariantA({ cells }: { cells: (CalendarDay | null)[] }) {
  const bg: Record<Status, string> = { past: 'var(--surface-sunken)', today: 'rgba(var(--accent-rgb), 0.08)', future: 'rgba(3, 105, 161, 0.035)' };
  return (
    <div>
      <Weekdays gap={0} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: '1px solid var(--line-strong)', borderLeft: '1px solid var(--line)' }}>
        {cells.map((day, i) => (
          <div key={i} style={{
            borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
            background: day ? bg[day.status] : undefined, padding: '4px 0 3px', minHeight: 96,
            boxShadow: day?.status === 'today' ? 'inset 0 0 0 1.5px var(--accent)' : undefined,
          }}>
            {day && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 1 }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.5, padding: '0 0.4em', borderRadius: 999,
                    ...(day.status === 'today' ? { background: 'var(--accent)', color: '#fff' }
                      : { color: day.status === 'past' ? 'var(--ink-3)' : dateColor(day.date) }),
                  }}>{dayLabel(day.date, i)}</span>
                </div>
                <div style={{ opacity: day.status === 'past' ? 0.7 : undefined }}><CellBody day={day} /></div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── B: タイル（1日ずつ角丸の札・下端に降水確率の細い帯） ──
function VariantB({ cells }: { cells: (CalendarDay | null)[] }) {
  const tile: Record<Status, CSSProperties> = {
    past:   { background: 'var(--surface-sunken)' },
    today:  { background: 'var(--surface-card)', boxShadow: 'inset 0 0 0 2px var(--accent), var(--shadow-card)' },
    future: { background: 'rgba(3, 105, 161, 0.07)' },
  };
  const chip: Record<Status, CSSProperties> = {
    past:   { color: 'var(--ink-3)' },
    today:  { background: 'var(--accent)', color: '#fff' },
    future: { color: 'var(--accent-blue)' },
  };
  return (
    <div>
      <Weekdays gap={4} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {cells.map((day, i) => day ? (
          <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: 10, padding: '4px 0 6px', minHeight: 96, ...tile[day.status] }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 1 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.5, padding: '0 0.45em', borderRadius: 999, ...chip[day.status] }}>{dayLabel(day.date, i)}</span>
            </div>
            <div style={{ opacity: day.status === 'past' ? 0.72 : undefined }}><CellBody day={day} compact /></div>
            {day.precipProb !== null && (
              <div aria-hidden style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${day.precipProb}%`, background: probColor(day.precipProb), opacity: 0.75 }} />
            )}
          </div>
        ) : <div key={i} />)}
      </div>
    </div>
  );
}

// ── C: 空の色（地の色＝その日の天気・日付の札＝過去/今日/これから） ──
function VariantC({ cells }: { cells: (CalendarDay | null)[] }) {
  const chip: Record<Status, CSSProperties> = {
    past:   { background: 'rgba(23,25,28,0.08)', color: 'var(--ink-3)' },
    today:  { background: 'var(--accent)', color: '#fff' },
    future: { background: 'rgba(3, 105, 161, 0.12)', color: 'var(--accent-blue)' },
  };
  return (
    <div>
      <Weekdays gap={3} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
        {cells.map((day, i) => day ? (
          <div key={i} style={{
            borderRadius: 12, padding: '5px 0 4px', minHeight: 96, background: skyTint(day.code),
            boxShadow: day.status === 'today' ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px rgba(23,25,28,0.04)',
            filter: day.status === 'past' ? 'saturate(0.35)' : undefined,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: '0.64rem', fontWeight: 700, lineHeight: 1.5, padding: '0 0.45em', borderRadius: 999, ...chip[day.status] }}>{dayLabel(day.date, i)}</span>
            </div>
            <div style={{ opacity: day.status === 'past' ? 0.75 : undefined }}><CellBody day={day} compact /></div>
          </div>
        ) : <div key={i} />)}
      </div>
    </div>
  );
}

export function WeatherCalendar({ pastDaily, daily, weatherCodeMode, variant, today }: Props) {
  const cells = buildCalendar(pastDaily, daily, today, weatherCodeMode);
  const first = cells.find(c => c)!.date;
  const last = [...cells].reverse().find(c => c)!.date;
  const md = (s: string) => `${parseInt(s.slice(5, 7), 10)}/${parseInt(s.slice(8, 10), 10)}`;
  return (
    <div style={{ padding: '0 0.75rem 0.9rem' }} data-testid="weather-calendar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-1)' }}>{md(first)}〜{md(last)}</span>
        <span style={{ fontSize: '0.62rem', color: 'var(--ink-3)' }}>過去は降った量・8日目以降は目安</span>
      </div>
      {variant === 'a' ? <VariantA cells={cells} /> : variant === 'b' ? <VariantB cells={cells} /> : <VariantC cells={cells} />}
    </div>
  );
}
