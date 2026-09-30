import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, m, useDragControls, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { springs } from '../../lib/motion';
import { useGuidanceModalFocus } from '../useGuidanceModalFocus';
import './ui.css';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** bottom: モバイルの下から出るシート / side: PCの右から出るパネル */
  placement?: 'bottom' | 'side';
  children: ReactNode;
}

/** 下スワイプで閉じると判定する距離(px)と速度(px/s) */
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 500;

function SheetPanel({ onClose, title, placement, children }: Omit<SheetProps, 'open'> & { placement: 'bottom' | 'side' }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const dragControls = useDragControls();
  useGuidanceModalFocus(panelRef, initialFocusRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const isBottom = placement === 'bottom';
  const hidden = isBottom ? { y: '100%' } : { x: '100%' };
  const shown = isBottom ? { y: 0 } : { x: 0 };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  };

  // ドラッグ開始はつまみ／ヘッダーからのみ（本文のスクロールと競合させない）
  const startDrag = isBottom ? (e: PointerEvent) => dragControls.start(e) : undefined;

  return (
    <>
      <m.div
        data-testid="sheet-backdrop"
        className="ui-sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`ui-sheet ui-sheet--${placement}`}
        initial={hidden}
        animate={shown}
        exit={hidden}
        transition={springs.move}
        drag={isBottom ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={isBottom ? handleDragEnd : undefined}
      >
        {isBottom && <div className="ui-sheet__grabber" aria-hidden="true" onPointerDown={startDrag} />}
        <div className="ui-sheet__header" onPointerDown={startDrag}>
          <h2 id={titleId} className="ui-sheet__title">{title}</h2>
          <button ref={initialFocusRef} type="button" className="ui-sheet__close" aria-label="閉じる" onClick={onClose}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="ui-sheet__body">{children}</div>
      </m.div>
    </>
  );
}

/** 下から出るシート（モバイル）／右から出るパネル（PC） */
export function Sheet({ open, placement = 'bottom', ...rest }: SheetProps) {
  return <AnimatePresence>{open && <SheetPanel key="sheet" placement={placement} {...rest} />}</AnimatePresence>;
}
