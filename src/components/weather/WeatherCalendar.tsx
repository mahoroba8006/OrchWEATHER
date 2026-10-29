import type { CSSProperties } from 'react';
import type { DailyForecastData } from '../../api/forecast';
import { WeatherIcon } from './WeatherIcon';
import { addDays } from '../../lib/dateUtils';
import { holidayName } from '../../lib/jpHolidays';
import { buildCalendar, calendarRange, skyKind, type CalendarDay, type SkyKind } from '../../lib/weatherCalendar';
import type { WeatherCodeMode } from '../../lib/wmoSeverity';

// 前週の日曜〜下の日別の表の最終日を、日曜始まりのカレンダーで見せる。マスの地の色はその日の天気
interface Props {
  pastDaily: DailyForecastData[];
  daily: DailyForecastData[];
  weatherCodeMode: WeatherCodeMode;
  today: string;
  /** 押せる日（下の日別の表にある日・過ぎた日）を押したとき */
  onPick?: (date: string) => void;
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const SUN_COLOR = '#C2493F';
const TEMP_MAX_COLOR = '#E0555A';
const TEMP_MIN_COLOR = '#2E7DD7';

// 雨量は整数に切り上げ（狭いマスで「1.1」と「11」を取り違えないよう小数を出さない）。
// 時間ごとの足し算の誤差（2.0000001 など）で1つ上がらないよう、0.1mm に丸めてから切り上げる
const fmtMm = (v: number | null) => (v === null || v < 0.5 ? '' : `${Math.ceil(Math.round(v * 10) / 10)}`);

function probColor(p: number): string {
  if (p >= 70) return 'var(--accent-blue)';
  if (p >= 40) return '#2E8BC0';
  return 'var(--ink-3)';
}

// マスの地の色＝天気の系統（マークに太陽が描かれる「晴れ時々曇り」までは晴れ）。過去もこれからも同じ色で、ふちをぼかす
const TINT: Record<SkyKind, string> = {
  thunder: '#E8DEF6',
  snow:    '#F4F7FC',
  rain:    '#D9E9FA',
  cloud:   '#E6E9ED',
  clear:   '#FDF4D6',
};

/** 日付の文字色: 日曜・祝日=赤系、土曜=青系 */
function dateColor(date: string): string {
  const w = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (w === 0 || holidayName(date)) return SUN_COLOR;
  return w === 6 ? 'var(--accent-blue)' : 'var(--ink-1)';
}

const md = (s: string) => `${parseInt(s.slice(5, 7), 10)}/${parseInt(s.slice(8, 10), 10)}`;
const ymdLabel = (s: string) => `${s.slice(0, 4)}/${md(s)}`;

/** 月の初日とカレンダーの先頭のマスだけ「月/日」 */
const dateLabel = (date: string, gridIndex: number) => {
  const dd = parseInt(date.slice(8, 10), 10);
  return dd === 1 || gridIndex === 0 ? md(date) : String(dd);
};

const dateChipBase: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, lineHeight: 1.5, padding: '0 0.45em', borderRadius: 999 };

/** 日別の表の最終日より先の日: 予報がまだ無いので日付だけ */
function OutsideCell({ date, label }: { date: string; label: string }) {
  return (
    <div data-date={date} data-outside="true" title={holidayName(date) ?? undefined} style={{ padding: '5px 0 4px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <span style={{ ...dateChipBase, color: dateColor(date), opacity: 0.4 }}>{label}</span>
    </div>
  );
}

function DayCell({ day, label, onPick }: { day: CalendarDay; label: string; onPick?: (date: string) => void }) {
  const isToday = day.status === 'today';
  const holiday = holidayName(day.date);
  const mm = fmtMm(day.precipSum);
  const pick = day.pickable && onPick ? () => onPick(day.date) : undefined;
  const tint = day.code === null ? 'var(--surface-sunken)' : TINT[skyKind(day.code)];
  const style: CSSProperties = {
    display: 'block', width: '100%', minWidth: 0, border: 'none', font: 'inherit', color: 'inherit',
    borderRadius: 12, padding: '5px 0 4px', minHeight: 96,
    // 塗りは後ろの層に置いてぼかす（時間別の表の色の帯と同じく、べた塗りにしない）。今日は緑の枠
    position: 'relative', isolation: 'isolate', background: 'transparent',
    boxShadow: isToday ? 'inset 0 0 0 2px var(--accent)' : undefined,
    cursor: pick ? 'pointer' : 'default',
  };
  const body = (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
        <span style={{
          ...dateChipBase,
          ...(isToday ? { background: 'var(--accent)', color: '#fff' } : { color: dateColor(day.date) }),
          opacity: day.status === 'past' ? 0.5 : undefined,
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
      <span
        aria-hidden
        data-testid="calendar-tint"
        style={{ position: 'absolute', inset: 3, zIndex: -1, borderRadius: 12, background: tint, filter: 'blur(4px)', pointerEvents: 'none' }}
      />
    </>
  );
  const name = `${ymdLabel(day.date)}${holiday ? ` ${holiday}` : ''}`;
  return pick
    ? <button type="button" data-date={day.date} onClick={pick} aria-label={day.status === 'past' ? `${name}の天気を空しらべで見る` : `${name}の予報を下の表で見る`} title={holiday ?? undefined} style={style}>{body}</button>
    : <div data-date={day.date} title={holiday ?? undefined} style={style}>{body}</div>;
}

export function WeatherCalendar({ pastDaily, daily, weatherCodeMode, today, onPick }: Props) {
  const cells = buildCalendar(pastDaily, daily, today, weatherCodeMode);
  const { first, last } = calendarRange(today, daily);
  const gridStart = first;
  const range = first.slice(0, 4) === last.slice(0, 4)
    ? `${ymdLabel(first)}〜${md(last)}`
    : `${ymdLabel(first)}〜${ymdLabel(last)}`;
  return (
    <div style={{ padding: '0 0.75rem' }} data-testid="weather-calendar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: 6 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-1)', whiteSpace: 'nowrap' }}>{range}</span>
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
        {cells.map((day, i) => {
          const date = addDays(gridStart, i);
          return day
            ? <DayCell key={date} day={day} label={dateLabel(date, i)} onPick={onPick} />
            : <OutsideCell key={date} date={date} label={dateLabel(date, i)} />;
        })}
      </div>
    </div>
  );
}
