// src/components/weather/AiCommentCard.tsx
//
// AI 農作業コメントカード。
// enabledSections に基づいて表示タブを動的に構成する。
// カスタマイズタブはプロンプト未設定時にガイドメッセージを表示。

import { useState, useEffect } from 'react';
import { CloudSun, AlertTriangle, Droplets, Shovel, Sprout, Pencil } from 'lucide-react';
import type { AiCommentData } from '../../api/aiComment';
import type { AiSection } from '../../store';

interface Props {
  comment: AiCommentData | null;
  loading: boolean;
  enabledSections: AiSection[];
  customText: string | null;
  customLoading: boolean;
  hasCustomPrompt: boolean;
}

interface TabDef {
  key: AiSection;
  Icon: React.ComponentType<{ size?: number }>;
  label: string;
}

const ALL_TABS: TabDef[] = [
  { key: 'weatherOverview',   Icon: CloudSun,      label: '空ごよみ'   },
  { key: 'generalWorkAdvice', Icon: Shovel,        label: '畑しごと'   },
  { key: 'sprayingAdvice',    Icon: Droplets,      label: '散布どき'   },
  { key: 'fertilizingAdvice', Icon: Sprout,        label: '施肥どき'   },
  { key: 'disasterPrep',      Icon: AlertTriangle, label: '天気の備え' },
  { key: 'custom',            Icon: Pencil,        label: 'カスタマイズ' },
];

const FOOTNOTE = (
  <div style={{ fontSize: '0.68rem', color: '#b8c0cf', marginTop: '0.6rem' }}>
    ※気象庁・Open-Meteo の予報データに基づく解説です
  </div>
);

export function AiCommentCard({
  comment,
  loading,
  enabledSections,
  customText,
  customLoading,
  hasCustomPrompt,
}: Props) {
  const visibleTabs = ALL_TABS.filter(t => enabledSections.includes(t.key));

  const [activeTab, setActiveTab] = useState<AiSection>(
    visibleTabs[0]?.key ?? 'weatherOverview'
  );

  // enabledSections が変わり activeTab が非表示になった場合はリセット
  useEffect(() => {
    if (!enabledSections.includes(activeTab)) {
      const first = visibleTabs[0]?.key;
      if (first) setActiveTab(first);
    }
  }, [enabledSections, activeTab, visibleTabs]);

  if (visibleTabs.length === 0) return null;

  const isStandardLoading = loading && !comment;
  const isCustomActive = activeTab === 'custom';

  if (isStandardLoading) {
    return (
      <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
        <TabBar tabs={visibleTabs} activeTab={visibleTabs[0].key} onSelect={() => {}} disabled />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {[90, 75, 80].map((w, i) => (
            <div key={i} style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: `${w}%` }} />
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#b8c0cf', marginTop: '0.5rem' }}>
          今日のポイントを分析中…
        </div>
      </section>
    );
  }

  if (!comment && !enabledSections.includes('custom')) return null;

  const standardContent = comment ? comment[activeTab as keyof AiCommentData] : undefined;

  const getContent = (): React.ReactNode => {
    if (isCustomActive) {
      if (!hasCustomPrompt) {
        return (
          <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            設定 → 気象コメント → カスタマイズプロンプトを入力・保存してください。
          </p>
        );
      }
      // loading 中 または fetch 未完了・失敗（text=null）は同じスケルトンを表示
      if (customLoading || customText === null) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[90, 75, 80].map((w, i) => (
              <div key={i} style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: `${w}%` }} />
            ))}
            <div style={{ fontSize: '0.72rem', color: '#b8c0cf', marginTop: '0.2rem' }}>分析中…</div>
          </div>
        );
      }
      return (
        <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
          {customText}
        </p>
      );
    }

    return (
      <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
        {standardContent || '—'}
      </p>
    );
  };

  const content = getContent();

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      <TabBar tabs={visibleTabs} activeTab={activeTab} onSelect={setActiveTab} disabled={false} />
      <div style={{ minHeight: '4.5rem' }}>
        {content}
      </div>
      {FOOTNOTE}
    </section>
  );
}

interface TabBarProps {
  tabs: TabDef[];
  activeTab: AiSection;
  onSelect: (key: AiSection) => void;
  disabled: boolean;
}

function TabBar({ tabs, activeTab, onSelect, disabled }: TabBarProps) {
  return (
    <div style={{ display: 'flex', gap: '0', marginBottom: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      {tabs.map(({ key, Icon, label }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => !disabled && onSelect(key)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
              padding: '0.25rem 0.1rem 0.5rem',
              fontSize: '0.72rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.2rem',
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
              opacity: disabled && !isActive ? 0.5 : 1,
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
