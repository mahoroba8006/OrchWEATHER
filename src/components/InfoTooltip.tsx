import { useState, useRef, type CSSProperties } from 'react';

interface Props {
  text: string;
}

const ICON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  borderRadius: '50%',
  color: '#fff',
  fontSize: '0.6rem',
  fontStyle: 'italic',
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
  marginLeft: 3,
  flexShrink: 0,
  lineHeight: 1,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  verticalAlign: 'middle',
};

const POPUP_STYLE: CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid var(--card-border)',
  borderRadius: 10,
  padding: '0.65rem 0.8rem',
  boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
  maxWidth: 260,
  fontSize: '0.73rem',
  lineHeight: 1.65,
  color: 'var(--text-primary)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

export function InfoTooltip({ text }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const toggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!open && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const TIP_W = 260;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - TIP_W - 8));
      // 下に出す。画面下端に近い場合は上に反転
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow > 140 ? rect.bottom + 6 : rect.top - 6 - 120;
      setPos({ top, left });
    }
    setOpen(p => !p);
  };

  return (
    <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
      <span
        ref={iconRef}
        role="button"
        tabIndex={0}
        onClick={toggle}
        onTouchEnd={toggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggle(e as any); }}
        style={{
          ...ICON_STYLE,
          background: open ? 'var(--accent-color)' : '#94a3b8',
        }}
        aria-label="説明を表示"
        aria-expanded={open}
      >
        i
      </span>

      {open && (
        <>
          {/* 全画面オーバーレイ: クリックで閉じる */}
          <span
            onClick={() => setOpen(false)}
            onTouchEnd={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          />
          <span style={{ ...POPUP_STYLE, top: pos.top, left: pos.left }}>
            {text}
          </span>
        </>
      )}
    </span>
  );
}
