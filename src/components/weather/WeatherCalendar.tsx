import type { CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import { WeatherIcon } from './WeatherIcon';
import { addDays } from '../../lib/dateUtils';
import { holidayName } from '../../lib/jpHolidays';
import { buildCalendar, CALENDAR_RANGE as RANGE, skyKind, type CalendarDay, type SkyKind } from '../../lib/weatherCalendar';
import type { WeatherCodeMode } from '../../lib/wmoSeverity';

// 今日の2週間前〜2週間後を、日曜始まりのカレンダーで見せる。マスの地の色はその日の天気
interface Props {
  pastDaily: DailyForecastData[];
  daily: DailyForecastData[];
  weatherCodeMode: WeatherCodeMode;
  today: string;
  /** 押せる日（下の日別の表にある日）を押したとき */
  onPick?: (date: string) => void;
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const SUN_COLOR = '#C2493F';
const TEMP_MAX_COLOR = '#E0555A';
const TEMP_MIN_COLOR = '#2E7DD7';

const fmtMm = (v: number | null) => (v === null || v < 0.5 ? '' : v >= 10 ? `${Math.round(v)}` : v.toFixed(1));

function probColor(p: number): string {
  if (p >= 70) return 'var(--accent-blue)';
  if (p >= 40) return '#2E8BC0';
  return 'var(--ink-3)';
}

// マスの地の色＝天気の系統（マークに太陽が描かれる「晴れ時々曇り」までは晴れ）。過ぎた日は同じ色を淡くする
const TINT: Record<SkyKind, readonly [string, string]> = {
  thunder: ['#E8DEF6', '#F1ECF8'],
  snow:    ['#F4F7FC', '#F8FAFD'],
  rain:    ['#D9E9FA', '#EAF2FB'],
  cloud:   ['#E6E9ED', '#F0F2F4'],
  clear:   ['#FCEBB0', '#FDF4D6'],
};

/** 日付の文字色: 日曜・祝日=赤系、土曜=青系 */
function dateColor(date: string): string {
  const w = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (w === 0 || holidayName(date)) return SUN_COLOR;
  return w === 6 ? 'var(--accent-blue)' : 'var(--ink-1)';
}

const md = (s: string) => `${parseInt(s.slice(5, 7), 10)}/${parseInt(s.slice(8, 10), 10)}`;
const ymdLabel = (s: string) => `${s.slice(0, 4)}/${md(s)}`;

function DayCell({ day, index, onPick }: { day: CalendarDay; index: number; onPick?: (date: string) => void }) {
  const dd = parseInt(day.date.slice(8, 10), 10);
  const label = dd === 1 || index === 0 ? md(day.date) : String(dd);
  const isToday = day.status === 'today';
  const holiday = holidayName(day.date);
  const mm = fmtMm(day.precipSum);
  const pick = day.pickable && onPick ? () => onPick(day.date) : undefined;
  const style: CSSProperties = {
    display: 'block', width: '100%', minWidth: 0, border: 'none', font: 'inherit', color: 'inherit',
    borderRadius: 12, padding: '5px 0 4px', minHeight: 96,
    background: day.code === null ? 'var(--surface-sunken)' : TINT[skyKind(day.code)][day.status === 'past' ? 1 : 0],
    boxShadow: isToday ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px rgba(23,25,28,0.04)',
    cursor: pick ? 'pointer' : 'default',
  };
  const body = (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
        <span style={{
          fontSize: '0.66rem', fontWeight: 700, lineHeight: 1.5, padding: '0 0.45em', borderRadius: 999,
          ...(isToday ? { background: 'var(--accent)', color: '#fff' } : { color: dateColor(day.date) }),
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, opacity: day.status === 'past' ? 0.75 : day.far ? 0.62 : undefined }}>
        {day.code !== null
          ? <WeatherIcon code={day.code} size={36} animated={false} style={{ margin: '-3px 0' }} />
          : <div style={{ height: 30, lineHeight: '30px', color: 'var(--ink-3)' }}>—</div>}
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
    </>
  );
  const name = `${ymdLabel(day.date)}${holiday ? ` ${holiday}` : ''}`;
  return pick
    ? <button type="button" data-date={day.date} onClick={pick} aria-label={`${name}の予報を下の表で見る`} title={holiday ?? undefined} style={style}>{body}</button>
    : <div data-date={day.date} title={holiday ?? undefined} style={style}>{body}</div>;
}

export function WeatherCalendar({ pastDaily, daily, weatherCodeMode, today, onPick }: Props) {
  const cells = buildCalendar(pastDaily, daily, today, weatherCodeMode);
  const first = addDays(today, -RANGE);
  const last = addDays(today, RANGE);
  const range = first.slice(0, 4) === last.slice(0, 4)
    ? `${ymdLabel(first)}〜${md(last)}`
    : `${ymdLabel(first)}〜${ymdLabel(last)}`;
  return (
    <div style={{ padding: '0 0.75rem 0.9rem' }} data-testid="weather-calendar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: 6 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-1)', whiteSpace: 'nowrap' }}>{range}</span>
        <span style={{ fontSize: '0.62rem', color: 'var(--ink-3)', textAlign: 'right' }}>過去は降った量・8日目以降は目安</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3, marginBottom: 4 }}>
        {DOW.map((w, i) => (
          <div key={w} style={{
            textAlign: 'center', fontSize: '0.68rem', fontWeight: 600,
            color: i === 0 ? SUN_COLOR : i === 6 ? 'var(--accent-blue)' : 'var(--ink-3)',
          }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
        {cells.map((day, i) => day
          ? <DayCell key={day.date} day={day} index={i - cells.findIndex(c => c)} onPick={onPick} />
          : <div key={`blank-${i}`} />)}
      </div>
    </div>
  );
}
