import { useState, useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth';
import { useAppStore } from './store';
import { SettingsTab } from './components/settings/SettingsTab';
import { LandingPage } from './components/LandingPage';
import { auth } from './lib/firebase';
import { ensureUserDocument } from './lib/userRepository';
import { WeatherTab } from './components/weather/WeatherTab';
import { HistoricalWeatherTab } from './components/weather/HistoricalWeatherTab';
import { WeatherLoader } from './components/weather/WeatherLoader';
import { HelpPage } from './components/HelpPage';
import { AppHeader } from './components/shell/AppHeader';
import { BottomNav } from './components/shell/BottomNav';
import { tabIndex, type MainTab } from './components/shell/tabs';
import { Sheet } from './components/ui/Sheet';
import { SkyBand } from './components/sky/SkyBand';
import { springs } from './lib/motion';
import { EnvironmentGuidance } from './components/EnvironmentGuidance';
import { logGuestStart } from './lib/analytics';
import { AnalysisTab } from './components/analysis/AnalysisTab';
import { useAnalysisState } from './components/analysis/useAnalysisState';
import './App.css';


function AppContent() {
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings, setGeoLocation, setGeoStatus, loadAiAllowed, resetUserData, guestMode, setGuestMode } = useAppStore();
  const [topTab, setTopTab] = useState<MainTab>('weather');
  /** 設定・ヘルプのシート（タブとは独立して重ねて出す） */
  const [sheet, setSheet] = useState<'settings' | 'help' | null>(null);
  /** シートを開いた時点のスクロール位置。背景の沈み込みの基点にして、見ている位置がずれないようにする */
  const [sinkOriginY, setSinkOriginY] = useState(0);
  /** タブ切替のスライド方向（-1: 左へ戻る / 0: 初回 / 1: 右へ進む） */
  const [slideDir, setSlideDir] = useState(0);

  // モバイル判定（マウント時1回のみ。リサイズで再判定しないことで操作中のリセットを防ぐ）
  const [isMobile] = useState(() => window.innerWidth < 768);
  const isGuest = !user && guestMode;
  const analysis = useAnalysisState(isMobile);


  useEffect(() => {
    // iOS リダイレクト認証後の結果処理。onAuthStateChanged が自動で状態を更新するが
    // エラー（キャンセル等）をここで捕捉してサイレントに処理する
    getRedirectResult(auth).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setGuestMode(false);
        try {
          // ensureUserDocument を直列で先に実行。getDocFromServer と並行すると
          // setDoc 書き込み中のスナップショットを掴んで部分データが返る競合が起きる
          await ensureUserDocument(firebaseUser.uid);
          await Promise.all([
            loadLocations(firebaseUser.uid),
            loadUserSettings(firebaseUser.uid),
            loadAiAllowed(),
          ]);
        } catch (error) {
          console.error("Failed to load user settings or locations:", error);
        }
      } else {
        resetUserData();
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const geoAttemptedRef = useRef(false);


  // 起動時: デフォルト地点がなければ自動で現在地を取得する
  useEffect(() => {
    if (authLoading) return;
    if (geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;

    const defaultLocId = userSettings?.defaultLocationId;
    const hasValidDefault = defaultLocId && locations.some(l => l.id === defaultLocId);
    if (hasValidDefault) return;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('error');
      return;
    }

    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
        setGeoStatus('idle');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, [authLoading]);


  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <WeatherLoader label="読み込み中" />
      </div>
    );
  }

  const handleTabChange = (t: MainTab) => {
    setSlideDir(Math.sign(tabIndex(t) - tabIndex(topTab)));
    setTopTab(t);
  };
  const openSheet = (target: 'settings' | 'help') => {
    setSinkOriginY(window.scrollY);
    setSheet(target);
  };
  const sinking = sheet !== null && isMobile;

  if (!user && !guestMode) {
    return <LandingPage onTryGuest={() => { logGuestStart(); setGuestMode(true); }} />;
  }

  return (
    <>
      {/* シートを開くとモバイルでは背景が少し沈む。ボトムナビは fixed のため、この変形する枠の外に置く */}
      <m.div
        animate={{ scale: sinking ? 0.94 : 1, borderRadius: sinking ? 16 : 0 }}
        style={{ transformOrigin: `50% ${sinkOriginY}px`, overflow: sinking ? 'clip' : 'visible' }}
        transition={springs.move}
      >
      <AppHeader
        tab={topTab}
        onTabChange={handleTabChange}
        isMobile={isMobile}
        user={user}
        onLogin={() => { setSheet(null); setGuestMode(false); }}
        onLogout={() => { setSheet(null); signOut(auth); }}
        onOpenHelp={() => openSheet('help')}
        onOpenSettings={() => openSheet('settings')}
      />

      <div style={isMobile ? { paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' } : undefined}>
      {(topTab === 'weather' || topTab === 'history' || topTab === 'analysis') && (
      <m.div
        key={topTab}
        initial={{ opacity: 0, x: slideDir * 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={springs.move}
      >
      {topTab === 'weather' && <WeatherTab />}

      {topTab === 'history' && (
        <>
          <SkyBand title="空しらべ" />
          <div className="sky-overlap"><HistoricalWeatherTab /></div>
        </>
      )}

      {topTab === 'analysis' && <AnalysisTab isMobile={isMobile} analysis={analysis} />}
      </m.div>
      )}

      </div>
      </m.div>

      {/* ── モバイル ボトムナビゲーション（fixed のため変形する親の外に置く） ── */}
      {isMobile && <BottomNav tab={topTab} onTabChange={handleTabChange} />}

      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="設定" placement={isMobile ? 'bottom' : 'side'}>
        {isGuest ? (
          <div className="glass-panel" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>ログインが必要です</p>
            <p style={{ fontSize: '0.86rem', color: 'var(--ink-2)', lineHeight: 1.8, marginBottom: '1.2rem' }}>
              地点の登録や各種設定は、ログインすると利用できます。<br />未ログインでは現在地の天気のみご覧いただけます。
            </p>
            <button
              className="secondary"
              onClick={() => { setSheet(null); setGuestMode(false); }}
              style={{ padding: '0.5rem 1.2rem', borderRadius: 'var(--radius-md)' }}
            >
              ログインする
            </button>
          </div>
        ) : (
          <SettingsTab />
        )}
      </Sheet>
      <Sheet open={sheet === 'help'} onClose={() => setSheet(null)} title="使い方" placement={isMobile ? 'bottom' : 'side'}>
        <HelpPage />
      </Sheet>
  </>
  );
}

function App() {
  return (
    <>
      <EnvironmentGuidance />
      <AppContent />
    </>
  );
}

export default App;
