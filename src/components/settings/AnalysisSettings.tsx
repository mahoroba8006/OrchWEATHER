import { useState, useEffect } from 'react';
import {
  useAppStore,
  DEFAULT_ACCUM_START_DATES,
  DEFAULT_ACCUM_DELTA_THRESHOLDS,
  type AccumStartDates,
  type AccumDeltaThresholds,
} from '../../store';
import { Button } from '../ui/Button';
import { SaveButton } from '../ui/SaveButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DEFAULT_PACE_OPTIONS, type PaceMetric, type SeasonPaceMode } from '../../lib/seasonReview';
import './settings.css';

// 累積開始日のプリセット（萌芽期/田植え/定植期など実運用日付）
const START_DATE_PRESETS: Array<{ label: string; mmdd: string }> = [
  { label: '1/1', mmdd: '01-01' },
  { label: '4/1', mmdd: '04-01' },
  { label: '5/1', mmdd: '05-01' },
  { label: '6/1', mmdd: '06-01' },
];

const ACCUM_CHART_LABELS: Record<keyof AccumStartDates, string> = {
  precip: '降水量',
  sunshine: '日照時間',
  radiation: '日射量',
  gdd: '有効積算温度',
};

const ACCUM_CHART_ORDER: Array<keyof AccumStartDates> = ['precip', 'sunshine', 'radiation', 'gdd'];

// MM-DD ↔ {mm, dd}
const parseMMDD = (s: string): { mm: number; dd: number } => {
  const [m, d] = s.split('-').map(Number);
  return { mm: m || 1, dd: d || 1 };
};

const formatMMDD = (mm: number, dd: number): string =>
  `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

// 各月の最終日
const lastDayOf = (mm: number): number => {
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[mm - 1] || 31;
};

// 季節のあしどりで比べ方を選べる項目（気温は常に直近30日）
const PACE_METRICS: Array<{ metric: PaceMetric; label: string }> = [
  { metric: 'precip', label: '降水量' },
  { metric: 'gdd', label: '積算温度' },
  { metric: 'sunshine', label: '日照時間' },
];

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

export function AnalysisSettings() {
  const {
    userSettings,
    updateBaseTempSettings,
    updateAccumStartDates,
    updateAccumDeltaThresholds,
    updateSeasonPaceModes,
  } = useAppStore();

  const [baseTempForm, setBaseTempForm] = useState<[number, number]>(
    userSettings?.baseTempSettings ?? [10, 3.5]
  );

  const [accumStartForm, setAccumStartForm] = useState<AccumStartDates>(
    userSettings?.accumStartDates ?? DEFAULT_ACCUM_START_DATES
  );

  const [accumThresholdForm, setAccumThresholdForm] = useState<AccumDeltaThresholds>(
    userSettings?.accumDeltaThresholds ?? DEFAULT_ACCUM_DELTA_THRESHOLDS
  );

  const [baseTempStatus, setBaseTempStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [accumStatus, setAccumStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [paceStatus, setPaceStatus] = useState<SaveStatus>({ kind: 'idle' });
  const seasonPaceModes = userSettings?.seasonPaceModes ?? DEFAULT_PACE_OPTIONS.modes;

  useEffect(() => {
    if (userSettings) {
      setBaseTempForm([...userSettings.baseTempSettings]);
      setAccumStartForm({ ...userSettings.accumStartDates });
      setAccumThresholdForm({ ...userSettings.accumDeltaThresholds });
    }
  }, [userSettings]);

  const handleSaveBaseTempSettings = async () => {
    setBaseTempStatus({ kind: 'saving' });
    try {
      const sanitised: [number, number] = [
        isNaN(baseTempForm[0]) ? 10 : baseTempForm[0],
        isNaN(baseTempForm[1]) ? 3.5 : baseTempForm[1],
      ];
      await updateBaseTempSettings(sanitised);
      setBaseTempStatus({ kind: 'saved', msg: '基準温度を保存しました' });
      setTimeout(() => setBaseTempStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      console.error('[AnalysisSettings] baseTemp save failed', err);
      setBaseTempStatus({ kind: 'error', msg: `保存失敗: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  const handleSaveAccumSettings = async () => {
    const clampInt = (v: number, max: number) => Math.min(max, Math.max(1, Math.round(v) || 1));
    setAccumStatus({ kind: 'saving' });
    try {
      await Promise.all([
        updateAccumStartDates(accumStartForm),
        updateAccumDeltaThresholds({
          gdd: clampInt(accumThresholdForm.gdd, 500),
          radiation: clampInt(accumThresholdForm.radiation, 2000),
        }),
      ]);
      setAccumStatus({ kind: 'saved', msg: '累積設定を保存しました' });
      setTimeout(() => setAccumStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AnalysisSettings] accum settings save failed', err);
      setAccumStatus({ kind: 'error', msg: `保存失敗: ${message}` });
    }
  };

  // 選択はストアの値をそのまま表示するので、保存に失敗しても元の選択のまま残る
  const handleChangePaceMode = async (metric: PaceMetric, mode: SeasonPaceMode) => {
    setPaceStatus({ kind: 'saving' });
    try {
      await updateSeasonPaceModes({ ...seasonPaceModes, [metric]: mode });
      setPaceStatus({ kind: 'saved', msg: '比べ方を保存しました' });
      setTimeout(() => setPaceStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AnalysisSettings] season pace mode save failed', err);
      setPaceStatus({ kind: 'error', msg: `保存失敗: ${message}` });
    }
  };

  const updateAccumStart = (chart: keyof AccumStartDates, mmdd: string) => {
    setAccumStartForm((prev) => ({ ...prev, [chart]: mmdd }));
  };

  const renderStatus = (status: SaveStatus) => {
    if (status.kind !== 'error') return null;
    return <span className="set-error">{status.msg}</span>;
  };

  return (
    <div className="set-stack">
      {/* 有効積算温度の設定 */}
      <div className="set-card">
        <h3 className="set-title">有効積算温度の設定</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {([0, 1] as const).map((i) => (
            <div className="form-group" key={i} style={{ flex: 1, minWidth: '120px' }}>
              <label>基準温度{i + 1} (℃){i === 0 ? '・メイン' : ''}</label>
              <input
                type="number"
                step="0.1"
                value={baseTempForm[i]}
                onChange={(e) => {
                  const next: [number, number] = [...baseTempForm] as [number, number];
                  next[i] = parseFloat(e.target.value);
                  setBaseTempForm(next);
                }}
              />
            </div>
          ))}
        </div>
        <div className="set-hint">基準温度1は空もようの「季節のあしどり」にも使います。</div>
        <div className="set-actions">
          {renderStatus(baseTempStatus)}
          <SaveButton
            onClick={handleSaveBaseTempSettings}
            saving={baseTempStatus.kind === 'saving'}
            saved={baseTempStatus.kind === 'saved'}
            savedLabel={baseTempStatus.msg}
          />
        </div>
      </div>

      {/* 累積開始日・日数差ガード閾値の設定 */}
      <div className="set-card">
        <h3 className="set-title">累積の開始日・日数差 表示設定</h3>

        {/* チャート毎の開始日 */}
        {ACCUM_CHART_ORDER.map((chart) => {
          const { mm, dd } = parseMMDD(accumStartForm[chart]);
          const maxDay = lastDayOf(mm);
          const safeDay = Math.min(dd, maxDay);
          return (
            <div key={chart} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label className="set-field-label">{ACCUM_CHART_LABELS[chart]} 累積開始日</label>
              <div className="set-quick">
                <select
                  value={mm}
                  onChange={(e) => {
                    const newMm = parseInt(e.target.value, 10);
                    const newDd = Math.min(safeDay, lastDayOf(newMm));
                    updateAccumStart(chart, formatMMDD(newMm, newDd));
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
                <select
                  value={safeDay}
                  onChange={(e) => updateAccumStart(chart, formatMMDD(mm, parseInt(e.target.value, 10)))}
                >
                  {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
                <div className="set-quick__group">
                  <span className="set-quick__label">クイック:</span>
                  {START_DATE_PRESETS.map((p) => (
                    <Button
                      key={p.mmdd}
                      variant={accumStartForm[chart] === p.mmdd ? 'primary' : 'secondary'}
                      className="set-btn-xs"
                      onClick={() => updateAccumStart(chart, p.mmdd)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* 日数差 ガード閾値 */}
        <div className="set-sep">
          <div className="set-field-label">日数差 表示開始閾値</div>
          <div className="set-hint">
            累積値がこの値未満の期間は日数差を非表示にします（序盤の不安定な状況における表示を抑制）。
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>有効積算温度 (℃)</label>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={accumThresholdForm.gdd}
                onChange={(e) => setAccumThresholdForm({ ...accumThresholdForm, gdd: parseInt(e.target.value, 10) || 1 })}
              />
              <div className="set-hint">範囲: 1〜500</div>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>累積日射量 (MJ/m²)</label>
              <input
                type="number"
                min={1}
                max={2000}
                step={10}
                value={accumThresholdForm.radiation}
                onChange={(e) => setAccumThresholdForm({ ...accumThresholdForm, radiation: parseInt(e.target.value, 10) || 1 })}
              />
              <div className="set-hint">範囲: 1〜2000</div>
            </div>
          </div>
        </div>

        <div className="set-actions">
          {renderStatus(accumStatus)}
          <SaveButton
            onClick={handleSaveAccumSettings}
            saving={accumStatus.kind === 'saving'}
            saved={accumStatus.kind === 'saved'}
            savedLabel={accumStatus.msg}
          />
        </div>
      </div>

      {/* 空もようの季節のあしどりの比べ方 */}
      <div className="set-card">
        <h3 className="set-title">季節のあしどりの比べ方</h3>
        <div className="set-hint">
          空もようの「季節のあしどり」で、去年・5年平均と比べる期間を項目ごとに選びます。
          累積は上の開始日から（積算温度は基準温度1）、直近30日は昨日までの30日間です。
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
              onChange={(mode) => handleChangePaceMode(metric, mode)}
              ariaLabel={`季節のあしどり ${label}の比べ方`}
              layoutId={`settings-season-pace-${metric}`}
            />
          </div>
        ))}
        <div className="set-hint">気温は、いつも直近30日の平均で比べます。</div>
        <div className="set-actions">
          {renderStatus(paceStatus)}
          {paceStatus.kind === 'saved' && <span className="set-hint">{paceStatus.msg}</span>}
        </div>
      </div>
    </div>
  );
}
