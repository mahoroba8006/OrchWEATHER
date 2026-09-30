import type { KeyboardEvent, ReactNode } from 'react';
import { m } from 'motion/react';
import { pressScale, springs } from '../../lib/motion';
import './ui.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** label が要素（アイコン等）の場合のアクセシブル名 */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** 同一画面内で一意な文字列。選択印の滑る移動（layout アニメーション）の識別子 */
  layoutId: string;
  variant?: 'pill' | 'underline';
  className?: string;
  /** 指定すると各タブに id=`${idPrefix}-${value}` を付ける（tabpanel の aria-labelledby 用） */
  idPrefix?: string;
}

/** 選択印が滑って移動するタブ／セグメント */
export function SegmentedControl<T extends string>({
  options, value, onChange, ariaLabel, layoutId, variant = 'pill', className, idPrefix,
}: SegmentedControlProps<T>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const nextIndex = (index + delta + options.length) % options.length;
    onChange(options[nextIndex].value);
    // ロービングタブインデックス: フォーカスも選択先へ移す
    (e.currentTarget.parentElement?.children[nextIndex] as HTMLElement | undefined)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={['ui-seg', `ui-seg--${variant}`, className].filter(Boolean).join(' ')}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <m.button
            key={opt.value}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-${opt.value}` : undefined}
            aria-selected={selected}
            aria-label={opt.ariaLabel}
            tabIndex={selected ? 0 : -1}
            className="ui-seg__item"
            whileTap={{ scale: pressScale }}
            transition={springs.press}
            onClick={() => { if (!selected) onChange(opt.value); }}
            onKeyDown={e => handleKeyDown(e, i)}
          >
            {selected && <m.span layoutId={layoutId} className="ui-seg__thumb" transition={springs.move} />}
            <span className="ui-seg__label">{opt.label}</span>
          </m.button>
        );
      })}
    </div>
  );
}
