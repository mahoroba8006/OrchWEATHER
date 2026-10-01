// モバイルのボトムナビ。選択ハイライトが滑って移動する。
import { useMemo, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { contrastRatio } from '../../lib/contrast';
import { springs } from '../../lib/motion';
import { mixHex } from '../../lib/sky';
import { fallbackSky, useSkyStore } from '../../skyStore';
import { MAIN_TABS, type MainTab } from './tabs';
import './shell.css';

interface BottomNavProps {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
}

/**
 * 選択印を「今の空」に揃える: 背景は空の上端色をごく淡くした色、文字は空の上端色
 * （淡い背景に対して 4.5:1 を満たすまで黒へ寄せる）。
 */
export function bottomNavColors(skyTop: string): { soft: string; text: string } {
  const soft = mixHex(skyTop, '#ffffff', 0.88);
  let text = skyTop;
  for (let i = 0; i < 40 && contrastRatio(text, soft) < 4.5; i++) text = mixHex(text, '#000000', 0.04);
  return { soft, text };
}

export function BottomNav({ tab, onTabChange }: BottomNavProps) {
  const skyTop = useSkyStore(s => s.sky?.top) ?? fallbackSky().top;
  const style = useMemo(() => {
    const { soft, text } = bottomNavColors(skyTop);
    return { '--nav-sky-soft': soft, '--nav-sky-text': text } as CSSProperties;
  }, [skyTop]);
  return (
    <nav aria-label="画面" className="shell-bottomnav" style={style}>
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
