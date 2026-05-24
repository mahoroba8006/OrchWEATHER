// src/components/weather/WeatherTab.tsx
import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store';
import { useForecast } from '../../hooks/useForecast';
import { detectRisks } from '../../lib/riskDetection';
import { DailyForecast } from './DailyForecast';
import { RiskSummary } from './RiskSummary';
import { HourlyTable } from './HourlyTable';
import { Footer } from '../Footer';

export function WeatherTab() {
  const { locations } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();

  // selectedLocationId が未設定の場合は最初の地点にフォールバック
  const location = locations.find(l => l.id === selectedLocationId) ?? locations[0] ?? null;

  const { data, loading, error, lastUpdated, refresh } = useForecast(
    location?.lat ?? null,
    location?.lon ?? null,
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
          地点を登録すると予報が表示されます
        </p>
        <p style={{ fontSize: '0.85rem' }}>
          「分析」タブの設定から地点を追加してください
        </p>
      </div>
    );
  }

  const timeStr = lastUpdated
    ? (() => {
        const jst = new Date(lastUpdated.getTime() + 9 * 60 * 60 * 1000);
        return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
      })()
    : null;

  const dayRisks = data ? detectRisks(data.hourly, data.daily) : [];

  const filteredHourly = data
    ? data.hourly.filter(h =>
        new Date(h.time + ':00+09:00').getTime() >= Date.now() - 6 * 60 * 60 * 1000
      )
    : [];

  const scrollToHour = useCallback((date: string, ampm: 'am' | 'pm') => {
    setScrollTarget(`${date}T${ampm === 'am' ? '00' : '12'}:00`);
  }, []);

  return (
    <div className="app-container">
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.75rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        flexWrap: 'wrap',
      }}>
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{
            fontSize: '0.85rem',
            padding: '0.4rem 0.75rem',
          }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        {timeStr && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginRight: '0.5rem' }}>
            最終更新: {timeStr}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          className="secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.8rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
          更新
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', color: '#c0392b', fontSize: '0.85rem', textAlign: 'center', background: '#fff9f8', borderRadius: 'var(--radius-md)' }}>
          {error}。↻ で再試行してください。
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
            <DailyForecast daily={data.daily} dayRisks={dayRisks} onHalfDayClick={scrollToHour} />
          </section>

          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <HourlyTable hourly={filteredHourly} daily={data.daily} scrollRef={hourlyScrollRef} scrollTarget={scrollTarget} />
          </section>
        </div>
      )}
      <Footer />
    </div>
  );
}
