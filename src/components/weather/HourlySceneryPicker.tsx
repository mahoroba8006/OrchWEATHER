import { useEffect, useRef, useState } from 'react';
import { useAppStore, useHourlyScenery } from '../../store';
import { SCENERY_OPTIONS, type HourlyScenery } from '../../lib/hourlyScenery';
import { SegmentedControl } from '../ui/SegmentedControl';
import '../settings/settings.css';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

/** 時間別の表の後ろの景色を選ぶ。設定画面と空もようのシートで共通 */
export function HourlySceneryPicker({ layoutId }: { layoutId: string }) {
  const scenery = useHourlyScenery();
  const updateHourlyScenery = useAppStore(s => s.updateHourlyScenery);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // 選択はストアの値をそのまま表示するので、保存に失敗しても元の選択のまま残る
  const handleChange = async (next: HourlyScenery) => {
    clearTimeout(timerRef.current);
    setStatus({ kind: 'saving' });
    try {
      await updateHourlyScenery(next);
      setStatus({ kind: 'saved', msg: '保存しました' });
      timerRef.current = setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      console.error('[HourlySceneryPicker] save failed', err);
      setStatus({ kind: 'error', msg: `保存失敗: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  return (
    <div className="set-stack" style={{ marginBottom: '1rem' }}>
      <div className="set-hint">背景の景色。</div>
      <SegmentedControl<HourlyScenery>
        options={SCENERY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
        value={scenery}
        onChange={v => void handleChange(v)}
        ariaLabel="背景の景色"
        layoutId={layoutId}
      />
      <span role="status">
        {status.kind === 'error' && <span className="set-error">{status.msg}</span>}
        {status.kind === 'saved' && <span className="set-hint">{status.msg}</span>}
      </span>
    </div>
  );
}
