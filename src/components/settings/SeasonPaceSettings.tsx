import { useState } from 'react';
import { useAppStore } from '../../store';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DEFAULT_PACE_OPTIONS, type PaceMetric, type SeasonPaceMode } from '../../lib/seasonReview';
import './settings.css';

// 季節のあしどりで比べ方を選べる項目（気温は常に直近30日）
const PACE_METRICS: Array<{ metric: PaceMetric; label: string }> = [
  { metric: 'precip', label: '降水量' },
  { metric: 'gdd', label: '積算温度' },
  { metric: 'sunshine', label: '日照時間' },
];

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

/** 空もようの「季節のあしどり」の比べ方（項目ごとに 累積／直近30日） */
export function SeasonPaceSettings() {
  const { userSettings, updateSeasonPaceModes } = useAppStore();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const seasonPaceModes = userSettings?.seasonPaceModes ?? DEFAULT_PACE_OPTIONS.modes;

  // 選択はストアの値をそのまま表示するので、保存に失敗しても元の選択のまま残る
  const handleChange = async (metric: PaceMetric, mode: SeasonPaceMode) => {
    setStatus({ kind: 'saving' });
    try {
      await updateSeasonPaceModes({ ...seasonPaceModes, [metric]: mode });
      setStatus({ kind: 'saved', msg: '比べ方を保存しました' });
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SeasonPaceSettings] season pace mode save failed', err);
      setStatus({ kind: 'error', msg: `保存失敗: ${message}` });
    }
  };

  return (
    <div className="set-card">
      <h3 className="set-title">季節のあしどりの比べ方</h3>
      <div className="set-hint">
        「季節のあしどり」で、去年・5年平均と比べる期間を項目ごとに選びます。
        累積は空くらべの設定の開始日から（積算温度は基準温度1）、直近30日は昨日までの30日間です。
      </div>
      {PACE_METRICS.map(({ metric, label }) => (
        <div key={metric} className="set-pace-row">
          <span className="set-field-label">{label}</span>
          <SegmentedControl<SeasonPaceMode>
            options={[
              { value: 'analysis', label: '累積' },
              { value: 'recent', label: '直近30日' },
            ]}
            value={seasonPaceModes[metric]}
            onChange={(mode) => handleChange(metric, mode)}
            ariaLabel={`季節のあしどり ${label}の比べ方`}
            layoutId={`settings-season-pace-${metric}`}
          />
        </div>
      ))}
      <div className="set-hint">気温は、いつも直近30日の平均で比べます。</div>
      <div className="set-actions">
        {status.kind === 'error' && <span className="set-error">{status.msg}</span>}
        {status.kind === 'saved' && <span className="set-hint">{status.msg}</span>}
      </div>
    </div>
  );
}
