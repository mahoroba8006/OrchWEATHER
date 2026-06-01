// src/components/weather/AiCommentCard.tsx
//
// AI 農作業コメントカード（4タブ）。JmaWarningSummary の直下に配置。
// loading 中はスケルトン、データなし時は非表示。

import { useState } from 'react';
import { CloudSun, AlertTriangle, Droplets, Shovel } from 'lucide-react';
import type { AiCommentData } from '../../api/aiComment';

interface Props {
  comment: AiCommentData | null;
  loading: boolean;
}

const TABS = [
  { key: 'weatherOverview'   as const, Icon: CloudSun,      label: '空ごよみ' },
  { key: 'generalWorkAdvice' as const, Icon: Shovel,        label: '外しごと' },
  { key: 'sprayingAdvice'    as const, Icon: Droplets,      label: '散布どき' },
  { key: 'disasterPrep'      as const, Icon: AlertTriangle, label: '天気の備え' },
] as const;

type TabKey = typeof TABS[number]['key'];

const FOOTNOTE = (
  <div style={{ fontSize: '0.68rem', color: '#b8c0cf', marginTop: '0.6rem' }}>
    ※気象庁・Open-Meteo の予報データに基づく解説です
  </div>
);

export function AiCommentCard({ comment, loading }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('weatherOverview');

  if (loading) {
    return (
      <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
        {/* ローディング中もタブバーは実表示（クリック不可） */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {TABS.map(({ key, Icon, label }, idx) => (
            <div
              key={key}
              style={{
                flex: 1,
                borderBottom: idx === 0 ? '2px solid var(--accent-color)' : '2px solid transparent',
                padding: '0.25rem 0.1rem 0.5rem',
                fontSize: '0.72rem',
                fontWeight: idx === 0 ? 700 : 500,
                color: idx === 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.2rem',
                opacity: idx === 0 ? 1 : 0.5,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} />
              {label}
            </div>
          ))}
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

  if (!comment) return null;

  const content = comment[activeTab];

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      {/* タブバー */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {TABS.map(({ key, Icon, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                padding: '0.25rem 0.1rem 0.5rem',
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.2rem',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      {/* コンテンツ */}
      <div style={{ minHeight: '4.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
          {content || '—'}
        </p>
      </div>

      {FOOTNOTE}
    </section>
  );
}
