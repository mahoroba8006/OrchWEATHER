// src/components/weather/WeatherTab.tsx
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { useAppStore, DEFAULT_AI_SECTIONS } from '../../store';
import { GEO_OPTIONS, getGeoErrorMessage } from '../../lib/geo';
import { useForecast } from '../../hooks/useForecast';
import { useJmaWarning } from '../../hooks/useJmaWarning';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Skeleton } from '../ui/Skeleton';
import { Reveal } from '../ui/Reveal';
import { DailyForecast } from './DailyForecast';
import { JmaWarningSummary } from './JmaWarningSummary';
import { AiCommentCard } from './AiCommentCard';
import { AiComingSoonCard } from './AiComingSoonCard';
import { useAiComment } from '../../hooks/useAiComment';
import { useAiCustomComment } from '../../hooks/useAiCustomComment';
import { DEFAULT_AI_CUSTOM_PROMPT } from '../../lib/userRepository';
import { HourlyTable } from './HourlyTable';
import { Footer } from '../Footer';
import { SkyHero } from '../sky/SkyHero';
import { fallbackSky, useSkyStore, type SkyState, type SkySummary } from '../../skyStore';
import { Sheet } from '../ui/Sheet';
import { useSeasonReview } from '../../hooks/useSeasonReview';
import { SeasonPaceTicker } from '../season/SeasonPaceTicker';
import { SeasonInlineCard } from '../season/SeasonReviewCard';
import { SeasonReviewCarousel } from '../season/SeasonReviewCarousel';
import { DEFAULT_PACE_OPTIONS, type PaceOptions, type SeasonReview } from '../../lib/seasonReview';
import { logSeasonCardOpen } from '../../lib/analytics';
import {
  classifyWeather, currentHourIndex, hhmmToMinutes, jstDateString, jstMinutesOfDay, skyPalette, timeOfDay,
} from '../../lib/sky';

export function WeatherTab() {
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, user, updateWeatherCodeMode, aiAllowed } = useAppStore();
  const weatherCodeMode = userSettings?.weatherCodeMode ?? 'severity';
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [buttonGeoLoading, setButtonGeoLoading] = useState(false);
  const [buttonGeoError, setButtonGeoError] = useState('');
  const hourlyScrollRef = useRef<HTMLDivElement>(null);
  const hourlySectionRef = useRef<HTMLElement>(null);
  const aiSectionRef = useRef<HTMLDivElement>(null);
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

  // 季節のあしどり・節気ふりかえり（予報の取得完了後に非同期で集計。予報表示は待たせない）
  // 項目ごとの比べ方（ゲストは userSettings が無いので既定値）
  const paceOptions: PaceOptions = {
    modes: userSettings?.seasonPaceModes ?? DEFAULT_PACE_OPTIONS.modes,
    baseTemp: userSettings?.baseTempSettings?.[0] ?? 10,
    startDates: {
      precip: userSettings?.accumStartDates?.precip ?? '01-01',
      sunshine: userSettings?.accumStartDates?.sunshine ?? '01-01',
      gdd: userSettings?.accumStartDates?.gdd ?? '01-01',
    },
    gddDaysMin: userSettings?.accumDeltaThresholds?.gdd ?? 30,
  };
  const season = useSeasonReview(location?.lat ?? null, location?.lon ?? null, data, paceOptions);
  const seasonReview = season.status === 'ready' ? season.view.review : null;
  const seasonReviews = season.status === 'ready' ? season.view.reviews : [];
  // シート内でいま見えている節気（スワイプで変わる）。閉じたら null に戻す
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);
  const shownReview = sheetIndex !== null ? seasonReviews[sheetIndex] : seasonReview;
  // 開いたときのふりかえりを覚える。地点切替などで別のふりかえりになったら閉じ、戻っても勝手に開き直さない
  const [openedReview, setOpenedReview] = useState<SeasonReview | null>(null);

  // 気象庁注意報・警報（jmaAreaCode が設定済みの登録地点のみ有効）
  const { data: jmaWarning, loading: jmaLoading } = useJmaWarning(location?.jmaAreaCode);

  // AI コメント設定
  const enabledAiSections = userSettings?.enabledAiSections ?? DEFAULT_AI_SECTIONS;
  const aiCustomPrompt = userSettings?.aiCustomPrompt ?? '';

  // AI 農作業コメント（予報・警報が揃ったら非同期取得）
  const { comment: aiComment, loading: aiCommentLoading } = useAiComment(
    aiAllowed ? user?.uid : null,
    location?.name,
    data,
    jmaWarning?.items,
  );

  // カスタマイズAIコメント（'custom' セクションが有効かつプロンプト設定済みのとき取得）
  const customEnabled = enabledAiSections.includes('custom');
  const { text: aiCustomText, loading: aiCustomLoading } = useAiCustomComment(
    aiAllowed && customEnabled ? user?.uid : null,
    customEnabled ? location?.name : null,
    customEnabled ? data : null,
    customEnabled ? jmaWarning?.items : undefined,
    customEnabled ? (aiCustomPrompt || DEFAULT_AI_CUSTOM_PROMPT) : '',
  );

  const scrollToHour = useCallback((date: string, period: 'am' | 'pm' | 'night') => {
    const hour = period === 'am' ? '04' : period === 'pm' ? '12' : '20';
    setScrollTarget(`${date}T${hour}:00`);
    if (hourlySectionRef.current) {
      const rect = hourlySectionRef.current.getBoundingClientRect();
      window.scrollBy({ top: rect.top - 56, behavior: 'smooth' });
    }
  }, []);

  // 1分ごとに空を再計算する（再取得なしで日没などをまたいで更新するため）
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // 今の空（予報の現在時刻の行と日の出・日の入りから算出。未取得時は fallbackSky）
  const current = useMemo(() => {
    const now = new Date();
    if (!data || data.hourly.length === 0) return { sky: fallbackSky(now), hour: null, today: null };
    const idx = currentHourIndex(data.hourly, now);
    const hour = data.hourly[idx === -1 ? 0 : idx];
    const today = data.daily.find(d => d.date === jstDateString(now)) ?? null;
    const tod = today && today.sunrise && today.sunset
      ? timeOfDay(jstMinutesOfDay(now), hhmmToMinutes(today.sunrise), hhmmToMinutes(today.sunset))
      : fallbackSky(now).tod;
    const weather = classifyWeather(hour.weatherCode);
    const sky: SkyState = { tod, weather, ...skyPalette(tod, weather) };
    return { sky, hour, today };
    // minuteTick は時刻の再計算トリガー
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, minuteTick]);

  // ヘッダー・他タブの空帯へ今の空を発行する
  const locationName = location?.name ?? '現在地';
  useEffect(() => {
    const summary: SkySummary | null = current.hour
      ? { temperature: current.hour.temperature, weatherCode: current.hour.weatherCode, locationName }
      : null;
    useSkyStore.getState().publish(current.sky, summary);
  }, [current, locationName]);

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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="60%" height={20} />
          </div>
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
  const hourlyLastDate = filteredHourly.length > 0 ? filteredHourly[filteredHourly.length - 1].time.slice(0, 10) : undefined;

  return (
    <>
      <SkyHero
        sky={current.sky}
        temperature={current.hour?.temperature ?? null}
        weatherCode={current.hour?.weatherCode ?? null}
        tempMax={current.today?.tempMax ?? null}
        tempMin={current.today?.tempMin ?? null}
        lastUpdated={timeStr}
        loading={loading}
        onLocate={handleGetCurrentLocation}
        locating={buttonGeoLoading}
        onRefresh={refresh}
        onSekkiOpen={seasonReview ? () => { setOpenedReview(seasonReview); logSeasonCardOpen(); } : undefined}
        locationSlot={(
          <>
            <span className="sky-hero__loc-name">{locationName}</span>
            {user && <ChevronDown size={16} aria-hidden="true" style={{ flexShrink: 0, marginLeft: 2, opacity: 0.85 }} />}
            {user && (
              <select
                className="sky-hero__select"
                aria-label="地点"
                value={location?.id ?? ''}
                onChange={e => setSelectedLocationId(e.target.value)}
              >
                {geoLocation && <option value="__geo__">📍 現在地</option>}
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}
          </>
        )}
      >
        {buttonGeoError && <span role="alert">⚠ {buttonGeoError}</span>}
      </SkyHero>
      {/* ヒーロー直後のコンテンツ: 最初のカードがヒーロー下端に24px重なる */}
      <div className="app-container" style={{ position: 'relative', marginTop: -24, paddingTop: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>

      {error && (
        <div
          key={error}
          role="alert"
          className="ui-shake"
          style={{
            padding: '0.85rem 1rem',
            color: 'var(--ink-1)',
            fontSize: '0.85rem',
            background: 'var(--surface-card)',
            border: '1px solid var(--line)',
            borderLeft: '4px solid #c0392b',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {error}
        </div>
      )}

      {loading && !data && (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink-3)', textAlign: 'center', padding: '1.6rem 0 0.4rem' }}>
            {loadingStatus || '天気予報を取得中...'}
          </span>
          <Skeleton height={280} radius="var(--radius-lg)" />
          <Skeleton height={360} radius="var(--radius-lg)" />
        </div>
      )}

      {data && (
        <>
          <SeasonPaceTicker state={season} />
          {season.status === 'ready' && season.view.showCard && season.view.review && (
            <SeasonInlineCard review={season.view.review} />
          )}

          {/* AI ステータスバー */}
          {enabledAiSections.some(s => s !== 'custom') && (
            aiCommentLoading ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.85rem',
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem', color: 'var(--ink-2)',
              }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)', flexShrink: 0 }} />
                空のようすを みています…
              </div>
            ) : aiComment ? (
              <div
                role="button"
                onClick={() => {
                  if (aiSectionRef.current) {
                    const rect = aiSectionRef.current.getBoundingClientRect();
                    window.scrollBy({ top: rect.top - 56, behavior: 'smooth' });
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.85rem',
                  background: '#ffffff',
                  border: '1px solid rgba(var(--accent-rgb),0.3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem', color: 'var(--accent)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span>
                  <span style={{ display: 'inline-block', animation: 'fade-pulse 1.8s ease-in-out infinite' }}>✨</span>
                  {' '}空もようと 段取りをまとめました
                </span>
                <ChevronDown size={15} style={{ flexShrink: 0 }} />
              </div>
            ) : null
          )}

          <Reveal index={0}>
            <JmaWarningSummary result={jmaWarning} loading={jmaLoading} />
          </Reveal>

          <Reveal index={1}>
          <section className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '0.6rem', padding: '0 0.75rem 0.5rem' }}>
              <SegmentedControl
                variant="pill"
                className="ui-seg--compact"
                ariaLabel="天気アイコンの表示基準"
                layoutId="weather-code-mode"
                options={[
                  { value: 'severity', label: 'リスクでみる' },
                  { value: 'frequency', label: '概況でみる' },
                ]}
                value={weatherCodeMode}
                onChange={updateWeatherCodeMode}
              />
              <span style={{ fontSize: '0.75rem', lineHeight: 1.35, color: 'var(--ink-3)', minWidth: 0 }}>
                {weatherCodeMode === 'severity'
                  ? '時間帯でいちばん悪い天気を表示'
                  : '時間帯でいちばん多い天気を表示'}
              </span>
            </div>
            <DailyForecast
              daily={data.daily}
              weatherCodeMode={weatherCodeMode}
              onHalfDayClick={scrollToHour}
              jmaWarnings={jmaWarning?.items}
              hourlyLastDate={hourlyLastDate}
            />
          </section>
          </Reveal>

          <p style={{ fontSize: '0.7rem', color: 'var(--ink-3)', textAlign: 'right', margin: '0.1rem 0.5rem' }}>
            午前：4〜12時　　午後：12〜20時　　夜間：20〜翌4時
          </p>

          <Reveal index={2}>
          <section ref={hourlySectionRef} className="glass-panel" style={{ padding: '1rem 0', overflow: 'hidden' }}>
            <HourlyTable hourly={filteredHourly} daily={data.daily} scrollRef={hourlyScrollRef} scrollTarget={scrollTarget} jmaWarnings={jmaWarning?.items} />
          </section>
          </Reveal>

          <Reveal index={3}>
          <div ref={aiSectionRef}>
            {aiAllowed ? (
              <AiCommentCard
                comment={aiComment}
                loading={aiCommentLoading}
                enabledSections={enabledAiSections}
                customText={aiCustomText}
                customLoading={aiCustomLoading}
                hasCustomPrompt={!!(aiCustomPrompt || DEFAULT_AI_CUSTOM_PROMPT)}
              />
            ) : (
              <AiComingSoonCard />
            )}
          </div>
          </Reveal>

        </>
      )}
      </div>
      <Sheet
        open={openedReview !== null && openedReview === seasonReview}
        onClose={() => { setOpenedReview(null); setSheetIndex(null); }}
        title={shownReview ? `${shownReview.range.name}のふりかえり` : 'ふりかえり'}
      >
        {seasonReviews.length > 0 && <SeasonReviewCarousel reviews={seasonReviews} onIndexChange={setSheetIndex} />}
      </Sheet>
      <Footer />
    </div>
    </>
  );
}
