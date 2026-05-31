// src/components/weather/AiCommentCard.tsx
//
// AI 農作業コメントカード。JmaWarningSummary の直下に配置。
// loading 中はスケルトン、データなし/エラー時は何も表示しない（非ブロッキング）。

import { Sprout, Tractor } from 'lucide-react';
import type { AiCommentData } from '../../api/aiComment';

interface Props {
  comment: AiCommentData | null;
  loading: boolean;
}

export function AiCommentCard({ comment, loading }: Props) {
  if (loading) {
    return (
      <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>
          🌱 AI 農作業コメント
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: '90%' }} />
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: '70%' }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#b8c0cf', marginTop: '0.5rem' }}>
          今日のポイントを分析中…
        </div>
      </section>
    );
  }

  if (!comment) return null;

  const hasWeather = comment.weatherPoint.length > 0;
  const hasWindows = comment.workWindows.length > 0;
  if (!hasWeather && !hasWindows) return null;

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      {hasWeather && (
        <div style={{ marginBottom: hasWindows ? '0.7rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '0.35rem' }}>
            <Sprout size={16} />
            今日の気象ポイント
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {comment.weatherPoint.map((line, i) => (
              <li key={i} style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {hasWindows && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '0.35rem' }}>
            <Tractor size={16} />
            おすすめ作業タイミング
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {comment.workWindows.map((line, i) => (
              <li key={i} style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{line}</li>
            ))}
          </ul>
        </div>
      )}

    </section>
  );
}
