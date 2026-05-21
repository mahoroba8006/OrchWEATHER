// src/components/weather/RiskSummary.tsx
import type { DayRisk, RiskType } from '../../lib/riskDetection';
import { RISK_BADGES } from '../../lib/riskDetection';

interface Props {
  dayRisks: DayRisk[];
}

export function RiskSummary({ dayRisks }: Props) {
  const riskyDays = dayRisks.filter(d => d.risks.length > 0);
  if (riskyDays.length === 0) return null;

  // リスク種別ごとに発生日をまとめる
  const riskTypeMap = new Map<RiskType, string[]>();
  for (const day of riskyDays) {
    for (const r of day.risks) {
      if (!riskTypeMap.has(r)) riskTypeMap.set(r, []);
      riskTypeMap.get(r)!.push(day.date);
    }
  }

  // RISK_BADGES の定義順（frost→thunder→hail→wind→rain→heat→dry）で表示
  const orderedTypes: RiskType[] = ['frost', 'thunder', 'hail', 'wind', 'rain', 'heat', 'dry'];

  return (
    <div style={{ padding: '0.6rem 1rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
        注意喚起
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {orderedTypes.filter(t => riskTypeMap.has(t)).map(riskType => {
          const badge = RISK_BADGES[riskType];
          const dates = riskTypeMap.get(riskType)!;
          const dateLabels = dates.map(d => {
            const mm = parseInt(d.slice(5, 7), 10);
            const dd = parseInt(d.slice(8, 10), 10);
            return `${mm}/${dd}`;
          }).join(', ');

          return (
            <div
              key={riskType}
              style={{
                borderLeft: `4px solid ${badge.borderColor}`,
                background: badge.badgeBg,
                borderRadius: '0 6px 6px 0',
                padding: '0.45rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{
                fontSize: '1.2rem',
                ...(riskType === 'heat'
                  ? { color: '#c0392b', filter: 'drop-shadow(0 0 6px #f87171)' }
                  : {}),
              }}>
                {badge.emoji}
              </span>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: badge.badgeColor }}>
                  {badge.label}リスク
                </span>
                <span style={{ fontSize: '0.8rem', color: '#5b6478', marginLeft: '0.5rem' }}>
                  {dateLabels}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
