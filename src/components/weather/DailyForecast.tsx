// src/components/weather/DailyForecast.tsx
import type { DailyForecastData } from '../../api/forecast';
import type { DayRisk } from '../../lib/riskDetection';
import { RISK_BADGES, weatherCodeToEmoji } from '../../lib/riskDetection';

interface Props {
  daily: DailyForecastData[];
  dayRisks: DayRisk[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function DailyForecast({ daily, dayRisks }: Props) {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jstNow.toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ padding: '0.9rem 1rem 0.4rem', fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em' }}>
        日別 ／ 今日〜10日後
      </div>
      <div style={{ overflowX: 'auto', background: '#fff', borderTop: '1px solid #ebeef5', borderBottom: '1px solid #ebeef5' }}>
        <div style={{ display: 'inline-flex' }}>
          {daily.map((day, i) => {
            const riskDay = dayRisks.find(r => r.date === day.date);
            const hasRisk = riskDay !== undefined && riskDay.risks.length > 0;
            const isToday = day.date === today;
            const dow = new Date(`${day.date}T00:00:00`).getDay();
            const mm = parseInt(day.date.slice(5, 7), 10);
            const dd = parseInt(day.date.slice(8, 10), 10);
            const dayLabel = isToday
              ? `今日 ${mm}/${dd}`
              : `${mm}/${dd} (${DAY_NAMES[dow]})`;

            return (
              <div
                key={day.date}
                style={{
                  width: 96,
                  borderRight: i < daily.length - 1 ? '1px solid #f3f4f8' : undefined,
                  padding: '0.6rem 0.25rem',
                  textAlign: 'center',
                  background: isToday ? '#f8fbff' : hasRisk ? '#fafaf6' : undefined,
                  flexShrink: 0,
                }}
              >
                <div style={{
                  fontSize: '0.72rem',
                  color: isToday ? '#5e8ad1' : '#5b6478',
                  ...(isToday ? { fontWeight: 600 } : {}),
                }}>
                  {dayLabel}
                </div>
                <div style={{ fontSize: '2rem', margin: '0.3rem 0', lineHeight: 1 }}>
                  {weatherCodeToEmoji(day.weatherCode)}
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                  <span style={{ color: '#e08a7f', fontWeight: 600 }}>{Math.round(day.tempMax)}</span>
                  {' / '}
                  <span style={{ color: '#7da6d9' }}>{Math.round(day.tempMin)}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a8aebc', marginTop: '0.25rem' }}>
                  降水 {day.precipProbMax}%
                </div>
                {hasRisk && riskDay && (
                  <>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: '0.35rem', flexWrap: 'wrap' }}>
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
