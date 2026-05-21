// src/components/weather/WeatherTab.tsx
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store';
import { useForecast } from '../../hooks/useForecast';
import { detectRisks } from '../../lib/riskDetection';
import { DailyForecast } from './DailyForecast';
import { RiskSummary } from './RiskSummary';
import { HourlyTable } from './HourlyTable';

export function WeatherTab() {
  const { locations } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

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

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1rem',
        background: '#fff',
        borderBottom: '1px solid #ebeef5',
        flexWrap: 'wrap',
      }}>
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{
            fontSize: '0.85rem',
            padding: '0.25rem 0.5rem',
            borderRadius: 6,
            border: '1px solid #d4d8e4',
            color: '#37445e',
          }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        {timeStr && (
          <span style={{ fontSize: '0.78rem', color: '#a8aebc' }}>
            最終更新: {timeStr}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.65rem',
            fontSize: '0.78rem',
            border: '1px solid #d4d8e4',
            borderRadius: 6,
            background: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: '#5b6478',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={13} />
          更新
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', color: '#c0392b', fontSize: '0.85rem', textAlign: 'center', background: '#fff9f8' }}>
          {error}。↻ で再試行してください。
        </div>
      )}

      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#8a93a6' }}>
          取得中...
        </div>
      )}

      {data && (
        <>
          <DailyForecast daily={data.daily} dayRisks={dayRisks} />
          <RiskSummary dayRisks={dayRisks} />
          <HourlyTable hourly={data.hourly.filter(h =>
            new Date(h.time + ':00+09:00').getTime() >= Date.now() - 6 * 60 * 60 * 1000
          )} />
        </>
      )}
    </div>
  );
}
