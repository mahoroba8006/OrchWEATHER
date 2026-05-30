import type { JmaWarningItem } from '../../api/jmaWarning';
import { GANTT_GRADIENT } from '../../lib/warningGantt';

interface WarningBarProps {
  warning: JmaWarningItem;
  left: number;   // px: バー左端の絶対位置（親要素基点）
  width: number;  // px: バーの幅
}

export function WarningBar({ warning, left, width }: WarningBarProps) {
  const bg = GANTT_GRADIENT[warning.level] || GANTT_GRADIENT.advisory;
  const indefinite = warning.endMs === undefined;
  const showText = width >= 32;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        width,
        top: 1,
        height: 20,
        background: bg,
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {showText && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            paddingLeft: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
            lineHeight: 1,
          }}
        >
          {warning.name}
        </span>
      )}
      {indefinite && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 16,
              width: 28,
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65))',
              pointerEvents: 'none',
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: '#fff',
              paddingRight: 4,
              flexShrink: 0,
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            →
          </span>
        </>
      )}
    </div>
  );
}
