// src/components/weather/WeatherTab.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw, MapPin, Loader2 } from 'lucide-react';
import { useAppStore, ALL_JMA_GROUPS, DEFAULT_AI_SECTIONS, warningNameToGroup } from '../../store';
import { GEO_OPTIONS, getGeoErrorMessage } from '../../lib/geo';
import { useForecast } from '../../hooks/useForecast';
import { useJmaWarning } from '../../hooks/useJmaWarning';
import { DailyForecast } from './DailyForecast';
import { JmaWarningSummary } from './JmaWarningSummary';
import { AiCommentCard } from './AiCommentCard';
import { useAiComment } from '../../hooks/useAiComment';
import { useAiCustomComment } from '../../hooks/useAiCustomComment';
import { HourlyTable } from './HourlyTable';
import { Footer } from '../Footer';

export function WeatherTab() {
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, user } = useAppStore();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [buttonGeoLoading, setButtonGeoLoading] = useState(false);
  const [buttonGeoError, setButtonGeoError] = useState('');
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
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

  const { data, loading, loadingStatus, error, lastUpdated, refresh } = useForecast(
    location?.lat ?? null,
    location?.lon ?? null,
  );

  // 気象庁注意報・警報（jmaAreaCode が設定済みの登録地点のみ有効）
  const { data: jmaWarning, loading: jmaLoading } = useJmaWarning(location?.jmaAreaCode);

  // AI コメント設定
  const enabledAiSections = userSettings?.enabledAiSections ?? DEFAULT_AI_SECTIONS;
  const aiCustomPrompt = userSettings?.aiCustomPrompt ?? '';

  // 有効グループでフィルタリング（特別警報は常に表示）
  const enabledJmaGroups = userSettings?.enabledJmaGroups ?? ALL_JMA_GROUPS;
  const enabledGroupSet = new Set(enabledJmaGroups);
  const filteredJmaWarning = jmaWarning && {
    ...jmaWarning,
    items: jmaWarning.items.filter(item => {
      if (item.level === 'special') return true; // 特別警報は常に表示
      const group = warningNameToGroup(item.name);
      return group === null || enabledGroupSet.has(group); // 未分類（土砂災害等）は常に表示
    }),
  };

  // AI 農作業コメント（予報・警報が揃ったら非同期取得）
  const { comment: aiComment, loading: aiCommentLoading } = useAiComment(
    user?.uid,
    location?.name,
    data,
    filteredJmaWarning?.items,
  );

  // カスタマイズAIコメント（'custom' セクションが有効かつプロンプト設定済みのとき取得）
  const customEnabled = enabledAiSections.includes('custom');
  const { text: aiCustomText, loading: aiCustomLoading } = useAiCustomComment(
    customEnabled ? user?.uid : null,
    customEnabled ? location?.name : null,
    customEnabled ? data : null,
    customEnabled ? filteredJmaWarning?.items : undefined,
    customEnabled ? aiCustomPrompt : '',
  );

  // 地点未登録かつ geo も未取得
  if (locations.length === 0 && !geoLocation) {
    const emptyStyle = {
      maxWidth: 1200,
      margin: '0 auto',
      padding: '4rem 1rem',
      textAlign: 'center' as const,
      color: '#8a93a6',
    };
    if (geoStatus === 'loading' || geoStatus === 'idle') {
      return (
        <div style={emptyStyle}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '1rem' }}>位置情報を取得中…</p>
        </div>
      );
    }
    return (
      <div style={emptyStyle}>
        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>位置情報が取得できませんでした</p>
        <p style={{ fontSize: '0.85rem' }}>設定タブから地点を登録するか、上のボタンで現在地を取得してください</p>
      </div>
    );
  }

  const timeStr = lastUpdated
    ? (() => {
        const jst = new Date(lastUpdated.getTime() + 9 * 60 * 60 * 1000);
        return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
      })()
    : null;

  // data.hourly は API の past_hours=6 により既に約6時間前から始まる。
  // ここで追加フィルターをかけると端数時間が除外され、
  // nightPrecipSum など日別集計値と表示値がずれるため、そのまま渡す。
  const filteredHourly = data ? data.hourly : [];

  const scrollToHour = useCallback((date: string, period: 'am' | 'pm' | 'night') => {
    const hour = period === 'am' ? '04' : period === 'pm' ? '12' : '20';
    setScrollTarget(`${date}T${hour}:00`);
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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 200, gap: '0.9rem' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-color)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {loadingStatus || '天気予報を取得中...'}
          </span>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <JmaWarningSummary result={filteredJmaWarning} loading={jmaLoading} />
          <AiCommentCard
            comment={aiComment}
            loading={aiCommentLoading}
            enabledSections={enabledAiSections}
            customText={aiCustomText}
            customLoading={aiCustomLoading}
            hasCustomPrompt={aiCustomPrompt.trim().length > 0}
          />

          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <DailyForecast daily={data.daily} onHalfDayClick={scrollToHour} jmaWarnings={filteredJmaWarning?.items} />
          </section>

          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <HourlyTable hourly={filteredHourly} daily={data.daily} scrollRef={hourlyScrollRef} scrollTarget={scrollTarget} jmaWarnings={filteredJmaWarning?.items} />
          </section>

        </div>
      )}
      <Footer />
    </div>
  );
}
