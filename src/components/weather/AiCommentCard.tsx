// src/components/weather/AiCommentCard.tsx
//
// AI 農作業コメントカード。
// enabledSections に基づいて表示タブを動的に構成する。
// カスタマイズタブはプロンプト未設定時にガイドメッセージを表示。

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, m, useIsPresent } from 'motion/react';
import { Cloud, CloudSun, Droplets, Shovel, Sprout, Pencil } from 'lucide-react';
import type { AiCommentData } from '../../api/aiComment';
import type { AiSection } from '../../store';
import { springs } from '../../lib/motion';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Skeleton } from '../ui/Skeleton';

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
  { key: 'custom',            Icon: Pencil,        label: 'じぶん好み' },
];

const FOOTNOTE = (
  <div style={{ fontSize: '0.68rem', color: 'var(--ink-3)', marginTop: '0.6rem' }}>
    ※気象庁・Open-Meteo の予報データに基づく解説です
  </div>
);

const BODY_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: '0.92rem',
  lineHeight: 1.9,
  color: 'var(--ink-1)',
};

/** 本文を行ごとに 0.05 秒ずつずらして浮かび上がらせる */
function RevealLines({ text }: { text: string }) {
  return (
    <div>
      {text.split('\n').map((line, i) => (
        <m.p
          key={i}
          style={{ ...BODY_STYLE, minHeight: line === '' ? '1.9em' : undefined }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.enter, delay: Math.min(i, 12) * 0.05 }}
        >
          {line}
        </m.p>
      ))}
    </div>
  );
}

// 切替方向 d(1/-1) に応じて、入る側・出る側を逆向きに動かす
const SLIDE = {
  enter: (d: number) => ({ x: d * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: -d * 40, opacity: 0 }),
};

/** 入ってくる側だけ tabpanel。退場中は支援技術から隠す */
function TabPanel({ tabKey, direction, children }: { tabKey: AiSection; direction: number; children: React.ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <m.div
      role={isPresent ? 'tabpanel' : undefined}
      aria-labelledby={isPresent ? `ai-tab-${tabKey}` : undefined}
      aria-hidden={isPresent ? undefined : true}
      custom={direction}
      variants={SLIDE}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springs.move}
    >
      {children}
    </m.div>
  );
}

const CLOUD_OFFSETS = [-1, 1, 0];

/** 生成中: 三つの雲が左右から中央に寄って重なる（reduced-motion では静止） */
function SkyLoader({ label = 'お天気を分析中' }: { label?: string }) {
  return (
    <div role="status">
      <div style={{ position: 'relative', height: 40, width: 96, margin: '0 auto 0.7rem' }}>
        {CLOUD_OFFSETS.map((dir, i) => (
          <m.span
            key={i}
            style={{
              position: 'absolute', left: '50%', top: 4, marginLeft: -16,
              display: 'inline-flex', color: 'var(--accent)',
            }}
            initial={{ x: dir * 30, opacity: 0.35 }}
            animate={{ x: dir * 4, opacity: 1 }}
            transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse', delay: i * 0.1 }}
          >
            <Cloud size={32} fill="var(--accent-soft)" strokeWidth={1.5} aria-hidden="true" />
          </m.span>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--ink-2)' }}>
        {label}<span className="dot-pulse">…</span>
      </div>
    </div>
  );
}

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

  // 1: 次のタブ（右へ進む）, -1: 前のタブ
  const [direction, setDirection] = useState<1 | -1>(1);
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
    setDirection(nextIdx > currentIdx ? 1 : -1);
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
      setDirection(1);
      setActiveTab(visibleTabs[currentIdx + 1].key);
    } else if (dx > 0 && currentIdx > 0) {
      setDirection(-1);
      setActiveTab(visibleTabs[currentIdx - 1].key);
    }
  };

  if (isStandardLoading) {
    return (
      <section className="glass-panel" style={{ padding: '1.4rem 1rem' }}>
        <SkyLoader />
      </section>
    );
  }

  if (!comment && !enabledSections.includes('custom')) return null;

  const standardContent = comment ? comment[activeTab as keyof AiCommentData] : undefined;

  const getContent = (): React.ReactNode => {
    if (isCustomActive) {
      if (!hasCustomPrompt) {
        return (
          <p style={{ ...BODY_STYLE, fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--ink-2)' }}>
            設定 → 気象コメント → じぶん好みのプロンプトを入力・保存してください。
          </p>
        );
      }
      // loading 中 または fetch 未完了・失敗（text=null）は同じスケルトンを表示
      if (customLoading || customText === null) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[90, 75, 80].map((w, i) => (
              <Skeleton key={i} height={12} radius="6px" width={`${w}%`} />
            ))}
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', marginTop: '0.2rem' }}>分析中…</div>
          </div>
        );
      }
      return <RevealLines text={customText} />;
    }

    return <RevealLines text={standardContent || '—'} />;
  };

  const content = getContent();

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      <TabBar tabs={visibleTabs} activeTab={activeTab} onSelect={handleTabSelect} />
      <div
        style={{ position: 'relative', minHeight: '4.5rem', overflow: 'hidden' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <TabPanel key={activeTab} tabKey={activeTab} direction={direction}>
            {content}
          </TabPanel>
        </AnimatePresence>
      </div>
      {FOOTNOTE}
    </section>
  );
}

interface TabBarProps {
  tabs: TabDef[];
  activeTab: AiSection;
  onSelect: (key: AiSection) => void;
}

function TabBar({ tabs, activeTab, onSelect }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[aria-selected="true"]') as HTMLElement | null;
    if (!activeBtn) return;
    // scrollIntoView はページ縦スクロールを引き起こすため使わず、
    // タブバーコンテナの scrollLeft のみ操作する
    const btnLeft = activeBtn.offsetLeft;
    const btnRight = btnLeft + activeBtn.offsetWidth;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.offsetWidth;
    if (btnRight > scrollLeft + containerWidth) {
      container.scrollLeft = btnRight - containerWidth;
    } else if (btnLeft < scrollLeft) {
      container.scrollLeft = btnLeft;
    }
  }, [activeTab]);

  return (
    <div ref={scrollRef} className="ai-tab-bar" style={{ marginBottom: '0.8rem' }}>
      <SegmentedControl
        variant="underline"
        className="ai-seg"
        ariaLabel="AIコメントのセクション"
        layoutId="ai-section"
        idPrefix="ai-tab"
        options={tabs.map(({ key, Icon, label }) => ({
          value: key,
          label: <><Icon size={15} />{label}</>,
        }))}
        value={activeTab}
        onChange={onSelect}
      />
    </div>
  );
}
