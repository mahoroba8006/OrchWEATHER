import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Save } from 'lucide-react';
import {
  useAppStore,
  DEFAULT_ACCUM_START_DATES,
  DEFAULT_ACCUM_DELTA_THRESHOLDS,
  type AccumStartDates,
  type AccumDeltaThresholds,
} from '../../store';

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

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

const SAVE_BTN: CSSProperties = {
  background: 'rgba(244,167,185,0.35)',
  color: '#7a2840',
  border: '1px solid rgba(244,167,185,0.6)',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.4rem 0.9rem',
  fontSize: '0.85rem',
};

export function AnalysisSettings() {
  const {
    userSettings,
    updateBaseTempSettings,
    updateAccumStartDates,
    updateAccumDeltaThresholds,
    updateWeatherCodeMode,
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

  const updateAccumStart = (chart: keyof AccumStartDates, mmdd: string) => {
    setAccumStartForm((prev) => ({ ...prev, [chart]: mmdd }));
  };

  const renderStatus = (status: SaveStatus) => {
    if (status.kind === 'idle') return null;
    const color =
      status.kind === 'error' ? '#c62828'
      : status.kind === 'saved' ? '#2e7d32'
      : 'var(--text-secondary)';
    const text = status.kind === 'saving' ? '保存中…' : status.msg ?? '';
    return (
      <span style={{ marginRight: '0.6rem', fontSize: '0.78rem', color, alignSelf: 'center' }}>
        {text}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 天気コードの集計方法 */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>天気コードの集計方法</h3>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => updateWeatherCodeMode('severity')}
            className="secondary"
            style={{
              padding: '0.5rem 1rem',
              background: userSettings?.weatherCodeMode === 'severity' ? 'rgba(244,167,185,0.45)' : undefined,
              color: userSettings?.weatherCodeMode === 'severity' ? '#7a2840' : undefined,
            }}
          >
            最深刻度（推奨）
          </button>
          <button
            onClick={() => updateWeatherCodeMode('frequency')}
            className="secondary"
            style={{
              padding: '0.5rem 1rem',
              background: userSettings?.weatherCodeMode === 'frequency' ? 'rgba(244,167,185,0.45)' : undefined,
              color: userSettings?.weatherCodeMode === 'frequency' ? '#7a2840' : undefined,
            }}
          >
            最頻値
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          各時間帯で最も深刻な天気コードを代表値とするか、最も多く観測された天気コードを代表値とするかを選択します。
        </p>
      </div>

      {/* 有効積算温度の設定 */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>有効積算温度の設定</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {([0, 1] as const).map((i) => (
            <div className="form-group" key={i} style={{ flex: 1, minWidth: '120px' }}>
              <label>基準温度{i + 1} (℃)</label>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {renderStatus(baseTempStatus)}
          <button
            onClick={handleSaveBaseTempSettings}
            disabled={baseTempStatus.kind === 'saving'}
            style={{
              ...SAVE_BTN,
              cursor: baseTempStatus.kind === 'saving' ? 'not-allowed' : 'pointer',
              opacity: baseTempStatus.kind === 'saving' ? 0.6 : 1,
            }}
          >
            <Save size={14} /> 保存
          </button>
        </div>
      </div>

      {/* 累積開始日・日数差ガード閾値の設定 */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>累積の開始日・日数差 表示設定</h3>

        {/* チャート毎の開始日 */}
        {ACCUM_CHART_ORDER.map((chart) => {
          const { mm, dd } = parseMMDD(accumStartForm[chart]);
          const maxDay = lastDayOf(mm);
          const safeDay = Math.min(dd, maxDay);
          return (
            <div key={chart} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ACCUM_CHART_LABELS[chart]} 累積開始日</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={mm}
                  onChange={(e) => {
                    const newMm = parseInt(e.target.value, 10);
                    const newDd = Math.min(safeDay, lastDayOf(newMm));
                    updateAccumStart(chart, formatMMDD(newMm, newDd));
                  }}
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
                <select
                  value={safeDay}
                  onChange={(e) => updateAccumStart(chart, formatMMDD(mm, parseInt(e.target.value, 10)))}
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>クイック:</span>
                {START_DATE_PRESETS.map((p) => (
                  <button
                    key={p.mmdd}
                    onClick={() => updateAccumStart(chart, p.mmdd)}
                    className="secondary"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem',
                      background: accumStartForm[chart] === p.mmdd ? 'rgba(244,167,185,0.45)' : undefined,
                      color: accumStartForm[chart] === p.mmdd ? '#7a2840' : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* 日数差 ガード閾値 */}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>日数差 表示開始閾値</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>範囲: 1〜500</div>
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>範囲: 1〜2000</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {renderStatus(accumStatus)}
          <button
            onClick={handleSaveAccumSettings}
            disabled={accumStatus.kind === 'saving'}
            style={{
              ...SAVE_BTN,
              cursor: accumStatus.kind === 'saving' ? 'not-allowed' : 'pointer',
              opacity: accumStatus.kind === 'saving' ? 0.6 : 1,
            }}
          >
            <Save size={14} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
