// src/components/weather/HistoricalWeatherTab.tsx
import { useState, useRef, useCallback } from 'react';
import { useAppStore, DEFAULT_RISK_THRESHOLDS } from '../../store';
import { useHistoricalForecast } from '../../hooks/useHistoricalForecast';
import { detectRisks } from '../../lib/riskDetection';
import { DailyForecast } from './DailyForecast';
import { RiskSummary } from './RiskSummary';
import { HourlyTable } from './HourlyTable';
import { Footer } from '../Footer';

/** JST の「昨日」の日付文字列（YYYY-MM-DD）を返す */
function jstYesterday(): string {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yd = new Date(jstNow);
  yd.setUTCDate(yd.getUTCDate() - 1);
  return yd.toISOString().slice(0, 10);
}

export function HistoricalWeatherTab() {
  const { locations, userSettings } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [yesterday] = useState(jstYesterday);
  const [startDate, setStartDate] = useState<string>(yesterday);
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();

  // selectedLocationId が未設定の場合は最初の地点にフォールバック
  const location = locations.find(l => l.id === selectedLocationId) ?? locations[0] ?? null;

  const { data, loading, error } = useHistoricalForecast(
    location?.lat ?? null,
    location?.lon ?? null,
    startDate,
  );

  // 地点未登録
  if (locations.length === 0) {
    return (
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '4rem 1rem',
        textAlign: 'center',
        color: '#8a93a6',
      }}>
        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          地点を登録すると過去の気象が表示されます
        </p>
        <p style={{ fontSize: '0.85rem' }}>
          「分析」タブの設定から地点を追加してください
        </p>
      </div>
    );
  }

  const enabledSet = new Set(
    userSettings?.riskThresholds?.enabledRisks ?? DEFAULT_RISK_THRESHOLDS.enabledRisks
  );

  // isPlaceholder でない日のみリスク判定・時間別表示に使用
  const nonPlaceholderDaily = data ? data.daily.filter(d => !d.isPlaceholder) : [];

  const dayRisks = data
    ? detectRisks(data.hourly, nonPlaceholderDaily, userSettings?.riskThresholds)
        .map(d => ({
          ...d,
          risks: d.risks.filter(r => enabledSet.has(r)),
        }))
    : [];

  const scrollToHour = useCallback((date: string, period: 'am' | 'pm' | 'night') => {
    const hour = period === 'am' ? '04' : period === 'pm' ? '12' : '20';
    setScrollTarget(`${date}T${hour}:00`);
  }, []);

  return (
    <div className="app-container">
      {/* 地点・日付セレクター */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        flexWrap: 'wrap',
      }}>
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          開始日
        </span>
        <input
          type="date"
          value={startDate}
          max={yesterday}
          onChange={e => {
            const v = e.target.value;
            if (v && v <= yesterday) setStartDate(v);
          }}
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          から10日分を表示（昨日以前のみ）
        </span>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          color: '#c0392b',
          fontSize: '0.85rem',
          textAlign: 'center',
          background: '#fff9f8',
          borderRadius: 'var(--radius-md)',
        }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: 'var(--text-tertiary)' }}>
          取得中...
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <RiskSummary dayRisks={dayRisks} />

          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <DailyForecast
              daily={data.daily}
              dayRisks={dayRisks}
              onHalfDayClick={scrollToHour}
            />
          </section>

          {data.hourly.length > 0 && (
            <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
              <HourlyTable
                hourly={data.hourly}
                daily={nonPlaceholderDaily}
                scrollRef={hourlyScrollRef}
                scrollTarget={scrollTarget}
                disablePastOpacity
              />
            </section>
          )}
        </div>
      )}
      <Footer />
    </div>
  );
}
