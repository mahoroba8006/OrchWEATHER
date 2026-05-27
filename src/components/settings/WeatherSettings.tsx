import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import {
  useAppStore,
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
  type RiskSensitivity,
  type RiskType,
} from '../../store';
import { RISK_BADGES } from '../../lib/riskDetection';

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
  key: keyof Pick<RiskThresholds,
    'frost' | 'frostDewPoint' | 'wind' | 'rainHourly' | 'rainDaily' |
    'heat' | 'dry' | 'hailFreezingLevel' | 'snow' | 'cold'>;
  unit:      string;
  direction: '以上' | '以下';
  min:       number;
  max:       number;
  step:      number;
}

const FROST_TEMP:    NumericField = { key: 'frost',             unit: '℃',   direction: '以下', min: -5,   max: 5,    step: 0.5 };
const FROST_DEW:     NumericField = { key: 'frostDewPoint',     unit: '℃',   direction: '以下', min: -5,   max: 3,    step: 0.5 };
const WIND_FIELD:    NumericField = { key: 'wind',              unit: 'm/s',  direction: '以上', min: 5,    max: 30,   step: 1   };
const HEAT_FIELD:    NumericField = { key: 'heat',              unit: '℃',   direction: '以上', min: 28,   max: 42,   step: 0.5 };
const DRY_FIELD:     NumericField = { key: 'dry',               unit: '%',    direction: '以下', min: 10,   max: 60,   step: 5   };
const RAIN_DAILY:    NumericField = { key: 'rainDaily',         unit: 'mm',   direction: '以上', min: 20,   max: 300,  step: 10  };
const RAIN_HOURLY:   NumericField = { key: 'rainHourly',        unit: 'mm/h', direction: '以上', min: 10,   max: 100,  step: 5   };
const HAIL_FREEZING: NumericField = { key: 'hailFreezingLevel', unit: 'm',    direction: '以下', min: 2000, max: 5000, step: 100 };
const COLD_FIELD:    NumericField = { key: 'cold',              unit: '℃',   direction: '以下', min: -15,  max: 5,    step: 0.5 };
const SNOW_FIELD:    NumericField = { key: 'snow',              unit: 'cm',   direction: '以上', min: 1,    max: 30,   step: 1   };

function sanitiseThresholds(form: RiskThresholds): RiskThresholds {
  const clamp = (v: number, min: number, max: number, fallback: number) =>
    isNaN(v) ? fallback : Math.min(max, Math.max(min, v));
  return {
    frost:              clamp(form.frost,             -5,    5,    DEFAULT_RISK_THRESHOLDS.frost),
    frostDewPoint:      clamp(form.frostDewPoint,     -5,    3,    DEFAULT_RISK_THRESHOLDS.frostDewPoint),
    wind:               clamp(form.wind,               5,    30,   DEFAULT_RISK_THRESHOLDS.wind),
    rainHourly:         clamp(form.rainHourly,         10,   100,  DEFAULT_RISK_THRESHOLDS.rainHourly),
    rainDaily:          clamp(form.rainDaily,          20,   300,  DEFAULT_RISK_THRESHOLDS.rainDaily),
    heat:               clamp(form.heat,               28,   42,   DEFAULT_RISK_THRESHOLDS.heat),
    dry:                clamp(form.dry,                10,   60,   DEFAULT_RISK_THRESHOLDS.dry),
    thunderSensitivity: form.thunderSensitivity,
    hailSensitivity:    form.hailSensitivity,
    hailFreezingLevel:  clamp(form.hailFreezingLevel,  2000, 5000, DEFAULT_RISK_THRESHOLDS.hailFreezingLevel),
    snow:               clamp(form.snow,               1,    30,   DEFAULT_RISK_THRESHOLDS.snow),
    cold:               clamp(form.cold,               -15,  5,    DEFAULT_RISK_THRESHOLDS.cold),
    enabledRisks:       form.enabledRisks,
  };
}

const RISK_LABEL: CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 600,
  minWidth: '3rem',
  flexShrink: 0,
};

const SUB: CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const AND_SEP: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  flexShrink: 0,
};

const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  flexWrap: 'wrap',
};

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

  const handleNumericChange = (key: NumericField['key'], raw: string) => {
    setForm(prev => ({ ...prev, [key]: parseFloat(raw) }));
  };

  const handleSensitivityChange = (
    key: 'thunderSensitivity' | 'hailSensitivity',
    value: RiskSensitivity
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleEnabledChange = (type: RiskType, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      enabledRisks: checked
        ? prev.enabledRisks.includes(type)
            ? prev.enabledRisks
            : [...prev.enabledRisks, type]
        : prev.enabledRisks.filter(r => r !== type),
    }));
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
    // DEFAULT_RISK_THRESHOLDS を明示的に渡す（setForm の非同期性に依存しないため）
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

  const renderInlineInput = (field: NumericField) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={form[field.key] as number}
        onChange={e => handleNumericChange(field.key, e.target.value)}
        style={{ width: '4.5rem' }}
      />
      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {field.unit}　{field.direction}
      </span>
    </div>
  );

  const renderSensitivityToggle = (key: 'thunderSensitivity' | 'hailSensitivity') => (
    <div style={{ display: 'flex', gap: '0.35rem' }}>
      {SENSITIVITY_OPTIONS.map(opt => (
        <button
          key={opt}
          onClick={() => handleSensitivityChange(key, opt)}
          className="secondary"
          style={{
            padding: '0.25rem 0.7rem', fontSize: '0.8rem',
            background: form[key] === opt ? 'rgba(244,167,185,0.45)' : undefined,
            color:      form[key] === opt ? '#7a2840'              : undefined,
            fontWeight: form[key] === opt ? 600                    : undefined,
          }}
        >
          {SENSITIVITY_LABELS[opt]}
        </button>
      ))}
    </div>
  );

  // チェックボックス＋アイコンの共通レンダラー
  const renderRowStart = (type: RiskType) => (
    <>
      <input
        type="checkbox"
        checked={form.enabledRisks.includes(type)}
        onChange={e => handleEnabledChange(type, e.target.checked)}
        style={{ flexShrink: 0, cursor: 'pointer', width: '1rem', height: '1rem' }}
      />
      <img
        src={`/icons/weather/${RISK_BADGES[type].iconFile}.svg`}
        width={18}
        height={18}
        alt={RISK_BADGES[type].label}
        style={{ flexShrink: 0 }}
      />
    </>
  );

  return (
    <div
      className="glass-panel"
      style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>リスク検知の閾値</h3>

      {/* 霜（春） */}
      <div style={ROW}>
        {renderRowStart('frost')}
        <span style={RISK_LABEL}>霜</span>
        <span style={SUB}>気温</span>
        {renderInlineInput(FROST_TEMP)}
        <span style={AND_SEP}>＆</span>
        <span style={SUB}>露点</span>
        {renderInlineInput(FROST_DEW)}
      </div>

      {/* 雷雨（夏） */}
      <div style={ROW}>
        {renderRowStart('thunder')}
        <span style={RISK_LABEL}>雷雨</span>
        {renderSensitivityToggle('thunderSensitivity')}
      </div>

      {/* 雹（夏） */}
      <div style={ROW}>
        {renderRowStart('hail')}
        <span style={RISK_LABEL}>雹</span>
        {renderSensitivityToggle('hailSensitivity')}
        <span style={AND_SEP}>＆</span>
        <span style={SUB}>0℃層高度</span>
        {renderInlineInput(HAIL_FREEZING)}
      </div>

      {/* 大雨（夏〜秋） */}
      <div style={ROW}>
        {renderRowStart('rain')}
        <span style={RISK_LABEL}>大雨</span>
        <span style={SUB}>（24時間雨量）</span>
        {renderInlineInput(RAIN_DAILY)}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>／</span>
        <span style={SUB}>（1時間雨量）</span>
        {renderInlineInput(RAIN_HOURLY)}
      </div>

      {/* 強風 */}
      <div style={ROW}>
        {renderRowStart('wind')}
        <span style={RISK_LABEL}>強風</span>
        <span style={SUB}>風速</span>
        {renderInlineInput(WIND_FIELD)}
      </div>

      {/* 高温（夏） */}
      <div style={ROW}>
        {renderRowStart('heat')}
        <span style={RISK_LABEL}>高温</span>
        <span style={SUB}>気温</span>
        {renderInlineInput(HEAT_FIELD)}
      </div>

      {/* 乾燥（秋〜冬） */}
      <div style={ROW}>
        {renderRowStart('dry')}
        <span style={RISK_LABEL}>乾燥</span>
        <span style={SUB}>湿度</span>
        {renderInlineInput(DRY_FIELD)}
      </div>

      {/* 低温（冬） */}
      <div style={ROW}>
        {renderRowStart('cold')}
        <span style={RISK_LABEL}>低温</span>
        <span style={SUB}>気温</span>
        {renderInlineInput(COLD_FIELD)}
      </div>

      {/* 降雪（冬） */}
      <div style={ROW}>
        {renderRowStart('snow')}
        <span style={RISK_LABEL}>降雪</span>
        <span style={SUB}>積雪量</span>
        {renderInlineInput(SNOW_FIELD)}
      </div>

      {/* フッター：デフォルトに戻す + 保存 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
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
