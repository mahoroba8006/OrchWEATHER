/**
 * src/components/weather/JmaWarningSummary.tsx
 *
 * 気象庁の注意報・警報を表示するサマリーコンポーネント。
 * WeatherTab で RiskSummary の上部に配置する。
 */

import type { JmaWarningResult, JmaWarningItem, WarningLevel } from '../../api/jmaWarning';

interface Props {
  result: JmaWarningResult | null;
  loading: boolean;
}

/** 警報レベルに応じた表示スタイル */
const LEVEL_STYLE: Record<WarningLevel, { color: string; bg: string; border: string; label: string }> = {
  special:  { color: '#6d1a3e', bg: 'rgba(220,38,127,0.1)',  border: 'rgba(220,38,127,0.4)', label: '特別警報' },
  warning:  { color: '#9b2226', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)',  label: '警報' },
  advisory: { color: '#7c4b00', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.4)', label: '注意報' },
  none:     { color: '#5b6478', bg: 'transparent',           border: 'transparent',          label: '' },
};

function WarningRow({ item }: { item: JmaWarningItem }) {
  const style = LEVEL_STYLE[item.level];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.45rem 0.6rem',
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 8,
    }}>
      <span style={{
        flexShrink: 0,
        fontSize: '0.68rem',
        fontWeight: 700,
        color: style.color,
        background: style.border,
        borderRadius: '999px',
        padding: '0.1rem 0.45rem',
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}>
        {style.label}
      </span>
      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: style.color, whiteSpace: 'nowrap' }}>
        {item.name}
      </span>
    </div>
  );
}

export function JmaWarningSummary({ result, loading }: Props) {
  // ロード中かつデータ未取得の場合は非表示（既存の RiskSummary を邪魔しない）
  if (loading && !result) return null;

  // データなし（エリアコード未設定 or API未到達）は非表示
  if (!result) return null;

  // 発表なし: 非表示
  if (result.items.length === 0) return null;

  // 警報レベル順でソート: special > warning > advisory
  const levelOrder: Record<WarningLevel, number> = { special: 0, warning: 1, advisory: 2, none: 3 };
  const sorted = [...result.items].sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  const reportTime = result.reportDatetime
    ? (() => {
        const d = new Date(result.reportDatetime);
        const jst = new Date(d.getTime() + 9 * 60 * 60000);
        return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')} 発表`;
      })()
    : null;

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em', fontWeight: 600 }}>
          気象庁 注意報・警報
        </span>
        {reportTime && (
          <span style={{ fontSize: '0.68rem', color: '#b8c0cf' }}>{reportTime}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {sorted.map((item) => (
          <WarningRow key={item.code} item={item} />
        ))}
      </div>
    </section>
  );
}
