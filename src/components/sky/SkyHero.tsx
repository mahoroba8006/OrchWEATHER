// 空もようのヒーロー。「今の空」を背景に、地点・気温・天気・操作ボタンを白文字で載せる。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { animate, m, useReducedMotion } from 'motion/react';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import { springs } from '../../lib/motion';
import { hasIntroPlayed, markIntroPlayed } from '../../lib/intro';
import { useSkyStore, type SkyState } from '../../skyStore';
import { WeatherIcon, codeToLabel } from '../weather/WeatherIcon';
import { SkyParticles } from './SkyParticles';
import { SekkiBadge } from './SekkiBadge';
import { SekkiArt } from './sekkiArt';
import { sekkiForDate } from '../../lib/sekki';
import { jstDateString } from '../../lib/sky';
import './sky.css';

export interface SkyHeroProps {
  sky: SkyState;
  /** 現在気温（null=取得中 → "—°" 表示） */
  temperature: number | null;
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  /** "23:15" */
  lastUpdated: string | null;
  loading: boolean;
  /** 地点表示部。ログイン時は透明な <select> を重ねたものを渡す */
  locationSlot: ReactNode;
  onLocate: () => void;
  locating: boolean;
  onRefresh: () => void;
  /** エラー文言などをヒーロー下部に出す */
  children?: ReactNode;
}

const round = (v: number | null) => (v === null ? '—' : String(Math.round(v)));

export function SkyHero({
  sky, temperature, weatherCode, tempMax, tempMin, lastUpdated, loading,
  locationSlot, onLocate, locating, onRefresh, children,
}: SkyHeroProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => document.visibilityState === 'hidden');
  const [playIntro] = useState(() => !hasIntroPlayed());
  const day = jstDateString(new Date());
  // 日付が変わった次の再描画で更新される
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sekkiIndex = useMemo(() => sekkiForDate(new Date()).index, [day]);
  /** カウントアップ中の表示値。null のときは temperature をそのまま出す */
  const [counting, setCounting] = useState<number | null>(null);

  // ヒーローの画面内判定 → 粒子の停止とヘッダー縮小表示
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      setOffscreen(!entry.isIntersecting);
      useSkyStore.getState().setHeroVisible(entry.isIntersecting);
    }, { threshold: 0 });
    io.observe(el);
    return () => {
      io.disconnect();
      useSkyStore.getState().setHeroVisible(true);
    };
  }, []);

  // タブが非表示の間は粒子を止める
  useEffect(() => {
    const onChange = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // 初回だけ 0 → 現在気温 へカウントアップ
  useLayoutEffect(() => {
    if (temperature === null || hasIntroPlayed()) return;
    if (reduced) {
      markIntroPlayed();
      return;
    }
    // 最終値が一瞬見えないよう、描画前に 0 から始める（副作用の同期 setState は意図的）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCounting(0);
    const controls = animate(0, temperature, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setCounting(v),
      onComplete: () => {
        markIntroPlayed();
        setCounting(null);
      },
    });
    return () => {
      controls.stop();
      setCounting(null);
    };
  }, [temperature, reduced]);

  const shown = counting ?? temperature;
  // 4文字以上（"-12°" など）の気温は中央のアイコンと重なるため、狭い幅ではアイコンを右へ退避させる
  const wideTemp = temperature !== null && `${Math.round(temperature)}°`.length >= 4;
  const enter = (i: number) => ({
    initial: playIntro ? { opacity: 0, y: 12 } : false,
    animate: { opacity: 1, y: 0 },
    transition: { ...springs.enter, delay: i * 0.06 },
  } as const);

  return (
    <section
      ref={rootRef}
      className="sky-hero"
      style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} 100%)` }}
    >
      <SkyParticles
        weather={sky.weather}
        isNight={sky.isNight}
        paused={offscreen || tabHidden}
        backdrop={(
          <div className="sky-hero__art-frame" aria-hidden="true">
            <m.div
              className={`sky-hero__art${sky.isNight ? ' sky-hero__art--night' : ''}`}
              initial={playIntro && !reduced ? { opacity: 0, scale: 1.02 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <SekkiArt index={sekkiIndex} variant="backdrop" size={200} />
            </m.div>
          </div>
        )}
      />
      <div className="sky-hero__inner">
        <m.div className="sky-hero__row" {...enter(0)}>
          <div className="sky-hero__loc">{locationSlot}</div>
          <div className="sky-hero__actions">
            <button type="button" className="sky-hero__btn" aria-label="現在地を表示" onClick={onLocate} disabled={locating}>
              {locating
                ? <Loader2 size={20} className="sky-hero__spin" aria-hidden="true" />
                : <MapPin size={20} aria-hidden="true" />}
            </button>
            <button type="button" className="sky-hero__btn" aria-label="更新" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={20} className={loading ? 'sky-hero__spin' : undefined} aria-hidden="true" />
            </button>
          </div>
        </m.div>

        <m.div className="sky-hero__main" {...enter(1)}>
          <span className="sky-hero__temp">{`${shown === null ? '—' : Math.round(shown)}°`}</span>
          {weatherCode !== null && (
            <span aria-hidden="true" className={`sky-hero__icon${wideTemp ? ' sky-hero__icon--wide-temp' : ''}`}>
              <WeatherIcon code={weatherCode} isNight={sky.isNight} size={88} />
            </span>
          )}
        </m.div>

        <m.div className="sky-hero__meta" {...enter(2)}>
          <div className="sky-hero__label">{weatherCode === null ? ' ' : codeToLabel(weatherCode)}</div>
          <div className="sky-hero__range">
            <span>{`最高 ${round(tempMax)}°`}</span>
            <span className="sky-hero__range-sep"> / </span>
            <span className="sky-hero__range-min">{`最低 ${round(tempMin)}°`}</span>
          </div>
        </m.div>

        {children && <m.div className="sky-hero__extra" {...enter(3)}>{children}</m.div>}

        <div className="sky-hero__foot">
          {lastUpdated && <span className="sky-hero__updated">{`最終更新 ${lastUpdated}`}</span>}
          <div className="sky-hero__sekki"><SekkiBadge /></div>
        </div>
      </div>
    </section>
  );
}
