import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAppStore } from '../../store';
import { LocationSettings } from './LocationSettings';
import { JmaWarningSettings } from './JmaWarningSettings';
import { AnalysisSettings } from './AnalysisSettings';
import { AiCommentSettings } from './AiCommentSettings';

type SettingsSubTab = 'location' | 'weather' | 'ai' | 'analysis';

const SUB_TAB_LABELS: Record<SettingsSubTab, string> = {
  location: '地点設定',
  weather: '注意報等',
  ai: 'AIコメント',
  analysis: '空くらべ',
};

const SUB_TABS: SettingsSubTab[] = ['location', 'weather', 'ai', 'analysis'];

export function SettingsTab() {
  const [subTab, setSubTab] = useState<SettingsSubTab>('location');
  const { user } = useAppStore();
  const [isMobile] = useState(() => window.innerWidth < 768);

  return (
    <div className="app-container">
      {/* アカウントエリア（Mobile のみ） */}
      {isMobile && user && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.9rem 1rem',
          borderBottom: '1px solid var(--card-border)',
          marginBottom: '0.5rem',
        }}>
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ''}
              width={36}
              height={36}
              style={{ borderRadius: '50%', border: '1.5px solid var(--accent-color)', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          </div>
          <button
            className="secondary"
            onClick={() => signOut(auth)}
            style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}
          >
            <LogOut size={13} /> ログアウト
          </button>
        </div>
      )}

      {/* サブタブナビゲーション（下線型） */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--card-border)',
        marginBottom: '1.25rem',
      }}>
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              padding: '0.65rem 1.2rem',
              fontSize: '0.88rem',
              fontWeight: subTab === tab ? 700 : 500,
              color: subTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: subTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            {SUB_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* サブタブコンテンツ */}
      {subTab === 'location'  && <LocationSettings />}
      {subTab === 'weather'   && <JmaWarningSettings />}
      {subTab === 'ai'        && <AiCommentSettings />}
      {subTab === 'analysis'  && <AnalysisSettings />}
    </div>
  );
}
