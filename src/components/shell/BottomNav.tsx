// モバイルのボトムナビ。選択ハイライトが滑って移動する。
import { m } from 'motion/react';
import { springs } from '../../lib/motion';
import { MAIN_TABS, type MainTab } from './tabs';
import './shell.css';

interface BottomNavProps {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
}

export function BottomNav({ tab, onTabChange }: BottomNavProps) {
  return (
    <nav aria-label="画面" className="shell-bottomnav">
      <div className="shell-bottomnav__list">
        {MAIN_TABS.map(({ id, label, Icon }) => {
          const selected = tab === id;
          return (
            <m.button
              key={id}
              type="button"
              aria-current={selected ? 'page' : undefined}
              className={`shell-bottomnav__item${selected ? ' is-selected' : ''}`}
              whileTap={{ scale: 0.9 }}
              transition={springs.press}
              onClick={() => { if (!selected) onTabChange(id); }}
            >
              {selected && <m.span layoutId="bottom-tab" className="shell-bottomnav__thumb" transition={springs.move} />}
              <span className="shell-bottomnav__content">
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                <span className="shell-bottomnav__label">{label}</span>
              </span>
            </m.button>
          );
        })}
      </div>
    </nav>
  );
}
