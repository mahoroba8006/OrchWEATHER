import { m } from 'motion/react';
import { springs } from '../../lib/motion';
import './ui.css';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  /** アクセシブル名。hideLabel でなければ隣に表示もする */
  label: string;
  disabled?: boolean;
  describedBy?: string;
  /** 行側に見出しがある場合など、ラベルを視覚的に出さない（名前だけ付ける） */
  hideLabel?: boolean;
}

/** つまみが滑って切り替わるスイッチ（ラベルのクリックでも切替） */
export function Toggle({ checked, onChange, label, disabled, describedBy, hideLabel }: ToggleProps) {
  return (
    <label className={['ui-toggle', disabled ? 'ui-toggle--disabled' : ''].filter(Boolean).join(' ')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={describedBy}
        disabled={disabled}
        className="ui-toggle__track"
        data-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <m.span layout transition={springs.press} className="ui-toggle__thumb" />
      </button>
      {!hideLabel && <span className="ui-toggle__label">{label}</span>}
    </label>
  );
}
