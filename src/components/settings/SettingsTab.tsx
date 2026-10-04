import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAppStore } from '../../store';
import { LocationSettings } from './LocationSettings';
import { AnalysisSettings } from './AnalysisSettings';
import { AiCommentSettings } from './AiCommentSettings';
import { HourlyRowsEditor } from '../weather/HourlyRowsEditor';
import { SeasonPaceSettings } from './SeasonPaceSettings';
import { SeasonReviewBaseSettings } from './SeasonReviewBaseSettings';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import './settings.css';

type SettingsSubTab = 'location' | 'weather' | 'ai' | 'analysis';

const SUB_TAB_LABELS: Record<SettingsSubTab, string> = {
  location: '地点設定',
  weather: '空もよう',
  ai: '空のアドバイス',
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
        <div className="settings-account">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ''}
              width={36}
              height={36}
              className="settings-account__avatar"
            />
          )}
          <div className="settings-account__text">
            <div className="settings-account__name">{user.displayName}</div>
            <div className="settings-account__email">{user.email}</div>
          </div>
          <Button variant="ghost" className="settings-account__logout" onClick={() => signOut(auth)}>
            <LogOut size={14} /> ログアウト
          </Button>
        </div>
      )}

      {/* サブタブナビゲーション（下線型） */}
      <div className="ai-tab-bar settings-subtabs">
        <SegmentedControl
          variant="underline"
          layoutId="settings-subtab"
          ariaLabel="設定の項目"
          className="ai-seg"
          options={SUB_TABS.map(tab => ({ value: tab, label: SUB_TAB_LABELS[tab] }))}
          value={subTab}
          onChange={setSubTab}
        />
      </div>

      {/* サブタブコンテンツ */}
      {subTab === 'location'  && <LocationSettings />}
      {subTab === 'weather' && (
        <div className="set-stack">
          <SeasonPaceSettings />
          <SeasonReviewBaseSettings />
          <div className="set-card">
            <h3 className="set-title">時間別の表示項目</h3>
            <HourlyRowsEditor />
          </div>
        </div>
      )}
      {subTab === 'ai'        && <AiCommentSettings />}
      {subTab === 'analysis'  && <AnalysisSettings />}
    </div>
  );
}
