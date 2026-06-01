import type { JmaWarningItem } from '../../api/jmaWarning';
import { GANTT_COLOR } from '../../lib/warningGantt';

interface WarningBarProps {
  warning: JmaWarningItem;
  left: number;   // px: バー左端の絶対位置（親要素基点）
  width: number;  // px: バーの幅
}

export function WarningBar({ warning, left, width }: WarningBarProps) {
  const color = GANTT_COLOR[warning.level] ?? GANTT_COLOR.advisory;
  const indefinite = warning.endMs === undefined;
  const showText = width >= 32;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        width,
        top: 2,
        height: 14,
        background: color.bg,
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {showText && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: color.text,
            paddingLeft: 3,
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
        <span
          style={{
            fontSize: 10,
            color: color.text,
            paddingRight: 3,
            flexShrink: 0,
            lineHeight: 1,
            fontWeight: 700,
            opacity: 0.7,
          }}
        >
          →
        </span>
      )}
    </div>
  );
}
