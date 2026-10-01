import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { springs } from '../../lib/motion';
import { Button } from './Button';
import './ui.css';

interface SaveButtonProps {
  onClick: () => void | Promise<void>;
  /** 保存の状態は親が持つ（既存の保存 state をそのまま渡す） */
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
  /** 通常時の文言（既定「保存」） */
  children?: ReactNode;
  /** 保存完了時の文言（既定「保存しました」） */
  savedLabel?: string;
}

/** 保存中の脈動・保存完了のチェック描画を持つ保存ボタン */
export function SaveButton({ onClick, saving, saved, disabled, children = '保存', savedLabel = '保存しました' }: SaveButtonProps) {
  return (
    <Button variant="primary" className="ui-savebtn" onClick={() => { void onClick(); }} disabled={disabled || saving}>
      {saving ? (
        <m.span key="saving" className="ui-savebtn__inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span className="ui-savebtn__pulse" aria-hidden="true" />
          保存中…
        </m.span>
      ) : saved ? (
        <m.span key="saved" className="ui-savebtn__inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <m.path
              d="M3 8.5l3.2 3.2L13 4.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={springs.enter}
            />
          </svg>
          {savedLabel}
        </m.span>
      ) : (
        <span className="ui-savebtn__inner">{children}</span>
      )}
    </Button>
  );
}
