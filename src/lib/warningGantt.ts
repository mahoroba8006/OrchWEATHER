import type { JmaWarningItem, WarningLevel } from '../api/jmaWarning';

/**
 * 警報レベルごとの配色（気象庁の注意報・警報ボックスに合わせた色調）
 * JmaWarningSettings の LEVEL_STYLE と同系色で統一。
 */
export const GANTT_COLOR: Record<WarningLevel, { bg: string; text: string }> = {
  advisory: { bg: 'rgba(251,146,60,0.30)',  text: '#7c4b00' },
  warning:  { bg: 'rgba(239,68,68,0.25)',   text: '#9b2226' },
  special:  { bg: 'rgba(220,38,127,0.22)',  text: '#6d1a3e' },
  none:     { bg: '', text: '' },
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

  // r8 API は終了時刻を持たないため、各警報はレーン末尾まで占有する
  const lanes: Array<{ items: JmaWarningItem[]; tail: number }> = [];

  for (const w of sorted) {
    const start = w.startMs!;
    const tail  = Infinity;

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
