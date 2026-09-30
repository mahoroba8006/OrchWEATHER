// 空色ヘッダー。背景は「今の空」の上端色（ヒーロー上端と継ぎ目なくつながる）。
import { AnimatePresence, m } from 'motion/react';
import { HelpCircle, LogOut, Settings } from 'lucide-react';
import { pressScale, springs } from '../../lib/motion';
import { fallbackSky, useSkyStore } from '../../skyStore';
import { codeToLabel } from '../weather/WeatherIcon';
import { MAIN_TABS, type MainTab } from './tabs';
import './shell.css';

export interface AppHeaderProps {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
  isMobile: boolean;
  user: { photoURL: string | null; displayName: string | null } | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({
  tab, onTabChange, isMobile, user, onLogin, onLogout, onOpenHelp, onOpenSettings,
}: AppHeaderProps) {
  const sky = useSkyStore(s => s.sky);
  const summary = useSkyStore(s => s.summary);
  const heroVisible = useSkyStore(s => s.heroVisible);
  const top = sky?.top ?? fallbackSky().top;
  const showSummary = tab === 'weather' && !heroVisible && summary !== null;

  return (
    <header className="shell-header" style={{ backgroundColor: top }}>
      <div className={`shell-header__inner${isMobile ? '' : ' shell-header__inner--wide'}`}>
        <div className={`shell-header__left${showSummary ? ' shell-header__left--summary' : ''}`}>
          <img src="/icon.png" alt="" aria-hidden="true" className="shell-header__logo" />
          <AnimatePresence>
            {showSummary && summary && (
              <m.div
                key="summary"
                className="shell-header__summary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={springs.move}
              >
                {`${summary.locationName} ${Math.round(summary.temperature)}° ${codeToLabel(summary.weatherCode)}`}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {!isMobile && (
          <div role="tablist" aria-label="画面" className="shell-header__tabs">
            {MAIN_TABS.map(({ id, label, Icon }) => {
              const selected = tab === id;
              return (
                <m.button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`shell-header__tab${selected ? ' is-selected' : ''}`}
                  whileTap={{ scale: pressScale }}
                  transition={springs.press}
                  onClick={() => { if (!selected) onTabChange(id); }}
                >
                  {selected && <m.span layoutId="header-tab" className="shell-header__thumb" transition={springs.move} />}
                  <span className="shell-header__tab-label">
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                    {label}
                  </span>
                </m.button>
              );
            })}
          </div>
        )}

        <div className="shell-header__right">
          <button type="button" className="shell-header__icon-btn" aria-label="使い方" onClick={onOpenHelp}>
            <HelpCircle size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {user ? (
            <>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? ''}
                  width={32}
                  height={32}
                  className="shell-header__avatar"
                />
              )}
              {!isMobile && (
                <button type="button" className="shell-header__text-btn" onClick={onLogout}>
                  <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
                  ログアウト
                </button>
              )}
            </>
          ) : (
            <button type="button" className="shell-header__text-btn" onClick={onLogin}>ログイン</button>
          )}
          <button type="button" className="shell-header__icon-btn" aria-label="設定" onClick={onOpenSettings}>
            <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
