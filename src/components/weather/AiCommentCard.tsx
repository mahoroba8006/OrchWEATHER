// src/components/weather/AiCommentCard.tsx
//
// AI 農作業コメントカード。
// enabledSections に基づいて表示タブを動的に構成する。
// カスタマイズタブはプロンプト未設定時にガイドメッセージを表示。

import { useState, useEffect, useRef } from 'react';
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
  { key: 'custom',            Icon: Pencil,        label: 'じぶん好み' },
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

  const slideDirection = useRef<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

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

  const handleTabSelect = (key: AiSection) => {
    const currentIdx = visibleTabs.findIndex(t => t.key === activeTab);
    const nextIdx    = visibleTabs.findIndex(t => t.key === key);
    slideDirection.current = nextIdx > currentIdx ? 'right' : 'left';
    setActiveTab(key);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isStandardLoading) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    const currentIdx = visibleTabs.findIndex(t => t.key === activeTab);
    if (dx < 0 && currentIdx < visibleTabs.length - 1) {
      slideDirection.current = 'right';
      setActiveTab(visibleTabs[currentIdx + 1].key);
    } else if (dx > 0 && currentIdx > 0) {
      slideDirection.current = 'left';
      setActiveTab(visibleTabs[currentIdx - 1].key);
    }
  };

  if (isStandardLoading) {
    return (
      <section className="glass-panel" style={{ padding: '1.2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          {ALL_TABS.map(({ key, Icon }, i) => (
            <span
              key={key}
              style={{
                display: 'inline-flex',
                color: 'var(--accent-color)',
                animation: 'iconWaveBounce 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            >
              <Icon size={28} />
            </span>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--accent-color)' }}>
          お天気を分析中<span className="dot-pulse">…</span>
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
            設定 → 気象コメント → じぶん好みのプロンプトを入力・保存してください。
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

  const slideClass =
    slideDirection.current === 'right' ? 'slide-in-right' :
    slideDirection.current === 'left'  ? 'slide-in-left'  : '';

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      <TabBar tabs={visibleTabs} activeTab={activeTab} onSelect={handleTabSelect} disabled={false} />
      <div
        style={{ minHeight: '4.5rem', overflow: 'hidden' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div key={activeTab} className={slideClass}>
          {content}
        </div>
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[data-active="true"]') as HTMLElement | null;
    activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  return (
    <div
      ref={scrollRef}
      className="ai-tab-bar"
      style={{ display: 'flex', gap: '0', marginBottom: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.08)' }}
    >
      {tabs.map(({ key, Icon, label }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            data-active={isActive}
            onClick={() => !disabled && onSelect(key)}
            style={{
              width: '6rem',
              flexShrink: 0,
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
              padding: '0.25rem 0.75rem 0.5rem',
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
