// src/components/weather/AiCommentCard.tsx
//
// AI 農作業コメントカード。JmaWarningSummary の直下に配置。
// loading 中はスケルトン、データなし/エラー時は何も表示しない（非ブロッキング）。

import { CloudSun, Tractor } from 'lucide-react';
import type { AiCommentData } from '../../api/aiComment';

interface Props {
  comment: AiCommentData | null;
  loading: boolean;
}

const FOOTNOTE = (
  <div style={{ fontSize: '0.68rem', color: '#b8c0cf', marginTop: '0.6rem' }}>
    ※気象庁・Open-Meteo の予報データに基づく解説です
  </div>
);

export function AiCommentCard({ comment, loading }: Props) {
  if (loading) {
    return (
      <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>
          🌱 AI 農作業コメント
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: '90%' }} />
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: '75%' }} />
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: '80%' }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#b8c0cf', marginTop: '0.5rem' }}>
          今日のポイントを分析中…
        </div>
      </section>
    );
  }

  if (!comment || (!comment.weatherOverview && !comment.workAdvice)) return null;

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      {comment.weatherOverview && (
        <div style={{ marginBottom: comment.workAdvice ? '0.8rem' : 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-color)',
            marginBottom: '0.35rem',
          }}>
            <CloudSun size={16} />
            天気概況
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {comment.weatherOverview}
          </p>
        </div>
      )}

      {comment.workAdvice && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-color)',
            marginBottom: '0.35rem',
          }}>
            <Tractor size={16} />
            作業アドバイス
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {comment.workAdvice}
          </p>
        </div>
      )}

      {FOOTNOTE}
    </section>
  );
}
