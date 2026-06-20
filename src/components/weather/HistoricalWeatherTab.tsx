// src/components/weather/HistoricalWeatherTab.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { GEO_OPTIONS, getGeoErrorMessage } from '../../lib/geo';
import { useHistoricalForecast } from '../../hooks/useHistoricalForecast';
import { DailyForecast } from './DailyForecast';
import { HourlyTable } from './HourlyTable';
import { Footer } from '../Footer';

/** JST の「昨日」の日付文字列（YYYY-MM-DD）を返す */
function jstYesterday(): string {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yd = new Date(jstNow);
  yd.setUTCDate(yd.getUTCDate() - 1);
  return yd.toISOString().slice(0, 10);
}

/** JST の「n日前」の日付文字列（YYYY-MM-DD）を返す */
function jstDaysAgo(n: number): string {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const d = new Date(jstNow);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function HistoricalWeatherTab() {
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, updateWeatherCodeMode } = useAppStore();
  const weatherCodeMode = userSettings?.weatherCodeMode ?? 'severity';
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [buttonGeoLoading, setButtonGeoLoading] = useState(false);
  const [buttonGeoError, setButtonGeoError] = useState('');
  const [yesterday] = useState(jstYesterday);
  const [startDate, setStartDate] = useState<string>(() => jstDaysAgo(10));
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const hourlySectionRef = useRef<HTMLElement>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();

  // デフォルト地点 or geoLocation が揃ったとき初期選択を確定させる
  useEffect(() => {
    if (selectedLocationId !== '') return;
    const defaultLocId = userSettings?.defaultLocationId;
    if (defaultLocId && locations.some(l => l.id === defaultLocId)) {
      setSelectedLocationId(defaultLocId);
      return;
    }
    if (geoLocation) {
      setSelectedLocationId('__geo__');
    }
  }, [selectedLocationId, userSettings?.defaultLocationId, geoLocation, locations]);

  // 地点の解決: __geo__ → geoLocation、それ以外 → locations から検索してフォールバック
  const location = (() => {
    if (selectedLocationId === '__geo__') return geoLocation;
    return locations.find(l => l.id === selectedLocationId) ?? geoLocation ?? locations[0] ?? null;
  })();

  // 現在地ボタンのハンドラ
  const handleGetCurrentLocation = () => {
    setButtonGeoLoading(true);
    setButtonGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
        setSelectedLocationId('__geo__');
        setButtonGeoLoading(false);
      },
      (err) => {
        setButtonGeoError(getGeoErrorMessage(err));
        setButtonGeoLoading(false);
      },
      GEO_OPTIONS,
    );
  };

  const { data, loading, loadingStatus, error } = useHistoricalForecast(
    location?.lat ?? null,
    location?.lon ?? null,
    startDate,
  );

  const scrollToHour = useCallback((date: string, period: 'am' | 'pm' | 'night') => {
    const hour = period === 'am' ? '04' : period === 'pm' ? '12' : '20';
    setScrollTarget(`${date}T${hour}:00`);
    if (hourlySectionRef.current) {
      const rect = hourlySectionRef.current.getBoundingClientRect();
      window.scrollBy({ top: rect.top - 56, behavior: 'smooth' });
    }
  }, []);

  // 地点未登録かつ geo も未取得
  if (locations.length === 0 && !geoLocation) {
    const emptyStyle = {
      maxWidth: 1200,
      margin: '0 auto',
      padding: '4rem 1rem',
      textAlign: 'center' as const,
      color: '#8a93a6',
    };
    if (geoStatus === 'loading') {
      return (
        <div style={emptyStyle}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '1rem' }}>位置情報を取得中…</p>
        </div>
      );
    }
    if (geoStatus === 'error') {
      return (
        <div style={emptyStyle}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>位置情報が取得できませんでした</p>
          <p style={{ fontSize: '0.85rem' }}>設定タブから地点を登録するか、上のボタンで現在地を取得してください</p>
        </div>
      );
    }
    return (
      <div style={emptyStyle}>
        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>地点を登録すると過去の気象が表示されます</p>
        <p style={{ fontSize: '0.85rem' }}>「設定」タブから地点を追加してください</p>
      </div>
    );
  }

  // isPlaceholder でない日のみ時間別表示に使用
  const nonPlaceholderDaily = data ? data.daily.filter(d => !d.isPlaceholder) : [];

  // 過去APIの段階によって欠落する項目は、その日に実データがある時だけ表示する。
  // availability 未指定（=全項目あり）の場合は何も隠さない。
  const hiddenRowKeys = (() => {
    const av = data?.availability;
    if (!av) return undefined;
    const hidden = new Set<string>();
    if (!av.precipProb)    hidden.add('precipProb');
    if (!av.freezingLevel) hidden.add('freezing');
    if (!av.uvIndex)       hidden.add('uv');
    if (!av.cape)          hidden.add('cape');
    return hidden;
  })();

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
        <button
          onClick={handleGetCurrentLocation}
          disabled={buttonGeoLoading}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.8rem',
            background: 'rgba(13,148,136,0.12)',
            color: 'var(--accent-color)',
            border: '1px solid rgba(13,148,136,0.3)',
            borderRadius: 'var(--radius-md, 6px)',
            cursor: buttonGeoLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            opacity: buttonGeoLoading ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {buttonGeoLoading
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />取得中…</>
            : <><MapPin size={14} />現在地を表示</>}
        </button>
        <select
          value={location?.id ?? ''}
          onChange={e => setSelectedLocationId(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
        >
          {geoLocation && <option value="__geo__">📍 現在地</option>}
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        {buttonGeoError && (
          <span style={{ fontSize: '0.78rem', color: '#c62828', width: '100%' }}>
            ⚠ {buttonGeoError}
          </span>
        )}

        <div style={{ width: '100%', height: 0 }} />
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
          から10日分を表示
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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 200, gap: '0.9rem' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-color)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {loadingStatus || '気象データを取得中...'}
          </span>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '0.4rem', padding: '0 0.75rem 0.5rem' }}>
              <button
                onClick={() => updateWeatherCodeMode('severity')}
                className="secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  background: weatherCodeMode === 'severity' ? 'rgba(244,167,185,0.45)' : undefined,
                  color: weatherCodeMode === 'severity' ? '#7a2840' : undefined,
                  borderColor: weatherCodeMode === 'severity' ? '#e88ea8' : undefined,
                }}
              >
                リスクでみる
              </button>
              <button
                onClick={() => updateWeatherCodeMode('frequency')}
                className="secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  background: weatherCodeMode === 'frequency' ? 'rgba(13,148,136,0.18)' : undefined,
                  color: weatherCodeMode === 'frequency' ? '#0f766e' : undefined,
                  borderColor: weatherCodeMode === 'frequency' ? '#0d9488' : undefined,
                }}
              >
                概況でみる
              </button>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: '0.3rem' }}>
                {weatherCodeMode === 'severity'
                  ? '時間帯でいちばん悪い天気を表示'
                  : '時間帯でいちばん多い天気を表示'}
              </span>
            </div>
            <DailyForecast
              daily={nonPlaceholderDaily}
              weatherCodeMode={weatherCodeMode}
              onHalfDayClick={scrollToHour}
            />
          </section>

          {data.hourly.length > 0 && (
            <section ref={hourlySectionRef} className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
              <HourlyTable
                hourly={data.hourly}
                daily={nonPlaceholderDaily}
                scrollRef={hourlyScrollRef}
                scrollTarget={scrollTarget}
                disablePastOpacity
                hiddenRowKeys={hiddenRowKeys}
              />
            </section>
          )}
        </div>
      )}
      <Footer />
    </div>
  );
}
