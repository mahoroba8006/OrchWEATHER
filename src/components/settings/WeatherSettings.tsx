import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import {
  useAppStore,
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
  type RiskSensitivity,
} from '../../store';

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

const SENSITIVITY_LABELS: Record<RiskSensitivity, string> = {
  low:    '控えめ',
  medium: '標準',
  high:   '敏感',
};

const SENSITIVITY_OPTIONS: RiskSensitivity[] = ['low', 'medium', 'high'];

interface NumericField {
  key:       keyof Pick<RiskThresholds, 'frost' | 'frostDewPoint' | 'wind' | 'rainHourly' | 'rainDaily' | 'heat' | 'dry' | 'hailFreezingLevel'>;
  label:     string;
  unit:      string;
  direction: '≤' | '≥';
  min:       number;
  max:       number;
  step:      number;
}

// 霜行・雹行以外の単独フィールド（2カラムグリッドに並べる）
const SOLO_NUMERIC_FIELDS: NumericField[] = [
  { key: 'wind',       label: '強風',        unit: 'm/s',  direction: '≥', min: 5,   max: 30,  step: 1   },
  { key: 'heat',       label: '高温',        unit: '℃',   direction: '≥', min: 28,  max: 42,  step: 0.5 },
  { key: 'dry',        label: '乾燥',        unit: '%',    direction: '≤', min: 10,  max: 60,  step: 5   },
  { key: 'rainHourly', label: '大雨 時間雨量', unit: 'mm/h', direction: '≥', min: 10,  max: 100, step: 5   },
];

// 霜の複合条件フィールド（気温 ＆ 露点、1行に並べる）
const FROST_FIELDS: [NumericField, NumericField] = [
  { key: 'frost',        label: '気温', unit: '℃', direction: '≤', min: -5, max: 5, step: 0.5 },
  { key: 'frostDewPoint', label: '露点', unit: '℃', direction: '≤', min: -5, max: 3, step: 0.5 },
];

// 雹の 0℃層高度フィールド（感度トグルの隣に ＆ で接続）
const HAIL_FREEZING_FIELD: NumericField =
  { key: 'hailFreezingLevel', label: '0℃層高度', unit: 'm', direction: '≤', min: 2000, max: 5000, step: 100 };

function sanitiseThresholds(form: RiskThresholds): RiskThresholds {
  const clamp = (v: number, min: number, max: number, fallback: number) =>
    isNaN(v) ? fallback : Math.min(max, Math.max(min, v));
  return {
    frost:              clamp(form.frost,             -5,   5,    DEFAULT_RISK_THRESHOLDS.frost),
    frostDewPoint:      clamp(form.frostDewPoint,     -5,   3,    DEFAULT_RISK_THRESHOLDS.frostDewPoint),
    wind:               clamp(form.wind,               5,   30,   DEFAULT_RISK_THRESHOLDS.wind),
    rainHourly:         clamp(form.rainHourly,        10,   100,  DEFAULT_RISK_THRESHOLDS.rainHourly),
    rainDaily:          clamp(form.rainDaily,         20,   300,  DEFAULT_RISK_THRESHOLDS.rainDaily),
    heat:               clamp(form.heat,              28,   42,   DEFAULT_RISK_THRESHOLDS.heat),
    dry:                clamp(form.dry,               10,   60,   DEFAULT_RISK_THRESHOLDS.dry),
    thunderSensitivity: form.thunderSensitivity,
    hailSensitivity:    form.hailSensitivity,
    hailFreezingLevel:  clamp(form.hailFreezingLevel, 2000, 5000, DEFAULT_RISK_THRESHOLDS.hailFreezingLevel),
  };
}

export function WeatherSettings() {
  const { userSettings, updateRiskThresholds } = useAppStore();
  const [form, setForm] = useState<RiskThresholds>(
    userSettings?.riskThresholds ?? DEFAULT_RISK_THRESHOLDS
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  useEffect(() => {
    if (userSettings?.riskThresholds) {
      setForm({ ...userSettings.riskThresholds });
    }
  }, [userSettings]);

  const handleNumericChange = (
    key: keyof Pick<RiskThresholds, 'frost' | 'frostDewPoint' | 'wind' | 'rainHourly' | 'rainDaily' | 'heat' | 'dry' | 'hailFreezingLevel'>,
    raw: string
  ) => {
    setForm((prev) => ({ ...prev, [key]: parseFloat(raw) }));
  };

  const handleSensitivityChange = (
    key: 'thunderSensitivity' | 'hailSensitivity',
    value: RiskSensitivity
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (thresholds: RiskThresholds) => {
    setStatus({ kind: 'saving' });
    try {
      await updateRiskThresholds(sanitiseThresholds(thresholds));
      setStatus({ kind: 'saved', msg: 'リスク閾値を保存しました' });
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      console.error('[WeatherSettings] riskThresholds save failed', err);
      setStatus({
        kind: 'error',
        msg: `保存失敗: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleReset = async () => {
    setForm({ ...DEFAULT_RISK_THRESHOLDS });
    await handleSave(DEFAULT_RISK_THRESHOLDS);
  };

  const renderStatus = (s: SaveStatus) => {
    if (s.kind === 'idle') return null;
    const color =
      s.kind === 'error'  ? '#c62828' :
      s.kind === 'saved'  ? '#2e7d32' :
      'var(--text-secondary)';
    const text = s.kind === 'saving' ? '保存中…' : s.msg ?? '';
    return (
      <span style={{ marginRight: '0.6rem', fontSize: '0.78rem', color, alignSelf: 'center' }}>
        {text}
      </span>
    );
  };

  // 単一フィールドのレンダラー（再利用）
  const renderNumericInput = (field: NumericField) => (
    <div className="form-group" key={field.key}>
      <label>{field.label} {field.direction}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={form[field.key] as number}
          onChange={(e) => handleNumericChange(field.key, e.target.value)}
          style={{ width: '100%' }}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {field.unit}
        </span>
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
        {field.min}〜{field.max}
      </div>
    </div>
  );

  return (
    <div
      className="glass-panel"
      style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>リスク検知の閾値</h3>

      {/* 霜：気温 ≤ X ℃ ＆ 露点 ≤ X ℃（複合条件を1行で表示） */}
      <div>
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>霜</label>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.4rem' }}>
          <div style={{ flex: 1 }}>{renderNumericInput(FROST_FIELDS[0])}</div>
          <span style={{
            paddingTop: '1.6rem', fontSize: '0.85rem', fontWeight: 700,
            color: 'var(--text-secondary)', flexShrink: 0,
          }}>＆</span>
          <div style={{ flex: 1 }}>{renderNumericInput(FROST_FIELDS[1])}</div>
        </div>
      </div>

      {/* その他の単独数値閾値 — 2カラムグリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {SOLO_NUMERIC_FIELDS.map(renderNumericInput)}
      </div>

      {/* 大雨 日雨量（単独行、左寄せ） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {renderNumericInput({ key: 'rainDaily', label: '大雨 日雨量', unit: 'mm', direction: '≥', min: 20, max: 300, step: 10 })}
      </div>

      {/* 区切り線 */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />

      {/* 感度トグル（雷雨・雹） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* 雷雨感度 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '4.5rem' }}>雷雨感度</span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {SENSITIVITY_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => handleSensitivityChange('thunderSensitivity', opt)}
                className="secondary"
                style={{
                  padding: '0.25rem 0.7rem', fontSize: '0.8rem',
                  background: form.thunderSensitivity === opt ? 'rgba(244,167,185,0.45)' : undefined,
                  color:      form.thunderSensitivity === opt ? '#7a2840' : undefined,
                  fontWeight: form.thunderSensitivity === opt ? 600 : undefined,
                }}
              >
                {SENSITIVITY_LABELS[opt]}
              </button>
            ))}
          </div>
        </div>

        {/* 雹感度 ＆ 0℃層高度（複合条件を1行で表示） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '4.5rem' }}>雹 感度</span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {SENSITIVITY_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => handleSensitivityChange('hailSensitivity', opt)}
                className="secondary"
                style={{
                  padding: '0.25rem 0.7rem', fontSize: '0.8rem',
                  background: form.hailSensitivity === opt ? 'rgba(244,167,185,0.45)' : undefined,
                  color:      form.hailSensitivity === opt ? '#7a2840' : undefined,
                  fontWeight: form.hailSensitivity === opt ? 600 : undefined,
                }}
              >
                {SENSITIVITY_LABELS[opt]}
              </button>
            ))}
          </div>
          {/* ＆ 0℃層高度インライン */}
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>＆</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {HAIL_FREEZING_FIELD.label} {HAIL_FREEZING_FIELD.direction}
            </span>
            <input
              type="number"
              min={HAIL_FREEZING_FIELD.min}
              max={HAIL_FREEZING_FIELD.max}
              step={HAIL_FREEZING_FIELD.step}
              value={form.hailFreezingLevel}
              onChange={(e) => handleNumericChange('hailFreezingLevel', e.target.value)}
              style={{ width: '5rem' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {HAIL_FREEZING_FIELD.unit}
            </span>
          </div>
        </div>
      </div>

      {/* フッター：デフォルトに戻す + 保存 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem' }}>
        <button
          onClick={handleReset}
          disabled={status.kind === 'saving'}
          className="secondary"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.82rem', padding: '0.4rem 0.75rem',
            opacity: status.kind === 'saving' ? 0.6 : 1,
            cursor:  status.kind === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          <RotateCcw size={13} /> デフォルトに戻す
        </button>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {renderStatus(status)}
          <button
            onClick={() => handleSave(form)}
            disabled={status.kind === 'saving'}
            style={{
              ...SAVE_BTN,
              cursor:  status.kind === 'saving' ? 'not-allowed' : 'pointer',
              opacity: status.kind === 'saving' ? 0.6 : 1,
            }}
          >
            <Save size={14} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
