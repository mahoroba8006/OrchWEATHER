import type { JmaWarningItem, WarningLevel } from '../api/jmaWarning';

/**
 * 警報レベルごとのグラデーション背景色
 * 設定UIのボタン配色（注意報=黄、警報=ピンク、特別警報=パープル）と一致させる
 */
export const GANTT_GRADIENT: Record<WarningLevel, string> = {
  advisory: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
  warning:  'linear-gradient(90deg, #fb7185, #f43f5e)',
  special:  'linear-gradient(90deg, #c084fc, #a855f7)',
  none:     '',
};

/**
 * 警報リストを時間的に重ならないレーン（行）に分割して返す。
 * グリーディ区間スケジューリング（startMs 昇順）。
 * endMs === undefined の警報はそのレーンを Infinity まで占有する。
 */
export function computeWarningLanes(warnings: JmaWarningItem[]): JmaWarningItem[][] {
  const sorted = [...warnings]
    .filter(w => w.startMs !== undefined)
    .sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));

  // each lane tracks its current tail (Infinity for indefinite warnings)
  const lanes: Array<{ items: JmaWarningItem[]; tail: number }> = [];

  for (const w of sorted) {
    const start = w.startMs!;
    const tail  = w.endMs ?? Infinity;

    let placed = false;
    for (const lane of lanes) {
      if (start >= lane.tail) {
        lane.items.push(w);
        lane.tail = tail;
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push({ items: [w], tail });
    }
  }

  return lanes.map(l => l.items);
}
