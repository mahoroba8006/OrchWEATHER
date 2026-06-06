import type { JmaWarningItem } from '../../api/jmaWarning';
import { GANTT_COLOR } from '../../lib/warningGantt';

interface WarningBarProps {
  warning: JmaWarningItem;
  left: string;   // CSS 値: バー左端の位置（親要素基点・% 指定）
  width: string;  // CSS 値: バーの幅（% 指定）
}

export function WarningBar({ warning, left, width }: WarningBarProps) {
  const color = GANTT_COLOR[warning.level] ?? GANTT_COLOR.advisory;

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
    </div>
  );
}
