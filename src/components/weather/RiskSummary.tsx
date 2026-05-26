// src/components/weather/RiskSummary.tsx
import type { DayRisk, RiskType } from '../../lib/riskDetection';
import { RISK_BADGES } from '../../lib/riskDetection';

interface Props {
  dayRisks: DayRisk[];
}

const ORDERED_TYPES: RiskType[] = ['frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow'];

function formatDate(dateStr: string): string {
  const mm = parseInt(dateStr.slice(5, 7), 10);
  const dd = parseInt(dateStr.slice(8, 10), 10);
  return `${mm}/${dd}`;
}

export function RiskSummary({ dayRisks }: Props) {
  // 日付順 × リスク優先順のフラットリスト（1エントリ = 1リスク × 1日）
  const rows: { date: string; riskType: RiskType; metric: string }[] = [];
  for (const day of dayRisks) {
    for (const riskType of ORDERED_TYPES) {
      if (day.risks.includes(riskType)) {
        rows.push({
          date: day.date,
          riskType,
          metric: day.metrics[riskType] ?? '',
        });
      }
    }
  }

  // 注意情報なし：ノイズにならないミニマル表示
  if (rows.length === 0) {
    return (
      <div style={{
        padding: '0.3rem 1rem',
        fontSize: '0.78rem',
        color: '#b8c0cf',
        letterSpacing: '0.02em',
      }}>
        🍃 現在、注意情報はありません
      </div>
    );
  }

  // 注意情報あり：glass-panel カードで明示
  return (
    <section className="glass-panel" style={{ padding: '1rem' }}>
      <div style={{
        padding: '0.6rem 1rem',
        borderTop: '1px solid #ebeef5',
        borderBottom: '1px solid #ebeef5',
        background: '#fff',
      }}>
        <div style={{ fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
          注意情報
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {rows.map(({ date, riskType, metric }, i) => {
            const badge = RISK_BADGES[riskType];
            return (
              <div
                key={`${date}-${riskType}-${i}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <img
                  src={`/icons/weather/${badge.iconFile}.svg`}
                  width={20}
                  height={20}
                  alt={badge.label}
                  style={{ display: 'block', flexShrink: 0 }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#37445e', minWidth: '2.5em' }}>
                  {badge.label}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#5b6478' }}>
                  {formatDate(date)}{metric ? `（${metric}）` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
