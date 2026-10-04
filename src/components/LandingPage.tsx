import { useState, useEffect, useRef, useCallback, type ReactNode, type CSSProperties } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import {
  Leaf, BarChart2, CloudSun, Sprout, MapPin, CalendarRange, Thermometer,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { logLogin, logLpDetailOpen } from '../lib/analytics';
import { SekkiArt } from './sky/sekkiArt';
import '../landing.css';

/* ─────────────────────────────────────────
   モーション・ユーティリティ
   （スクロール進捗・パララックス・reduced-motion 判定）
───────────────────────────────────────── */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 全体スクロール進捗 (0-1) を rAF スロットル・passive で監視し onProgress に渡す。
 *  reduced-motion 時は forceActive 指定がない限り購読しない（静的表示にフォールバック）。 */
function useScrollProgress(onProgress: (p: number) => void, opts?: { forceActive?: boolean }) {
  useEffect(() => {
    if (!opts?.forceActive && prefersReducedMotion()) return;
    let ticking = false;
    const compute = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    const tick = () => {
      onProgress(compute());
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(tick);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [onProgress, opts?.forceActive]);
}

/* ─────────────────────────────────────────
   スカイバックドロップ（スクロールで晴れていく空）
───────────────────────────────────────── */
// スクロール最上部（Hero）に最も青い「晴天」を置き、白い雲のコントラストを確保する。
// 下方向へ 青空 → 夜明け（暖色）へと推移。
const SKY_STOPS: [string, string, string][] = [
  ['#aaddff', '#d5eeff', '#fffbeb'], // 晴天（最上部）
  ['#bfe0fb', '#ddeffe', '#f2faff'], // 青空（中間）
  ['#fdf4e8', '#e3edf9', '#eef5fc'], // 夜明け（最下部）
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function skyColorsAt(p: number): [string, string, string] {
  const idx = p <= 0.5 ? 0 : 1;
  const t = p <= 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
  const from = SKY_STOPS[idx];
  const to = SKY_STOPS[idx + 1];
  return [0, 1, 2].map((i) => {
    const [ar, ag, ab] = hexToRgb(from[i]);
    const [br, bg, bb] = hexToRgb(to[i]);
    return `rgb(${lerpChannel(ar, br, t)}, ${lerpChannel(ag, bg, t)}, ${lerpChannel(ab, bb, t)})`;
  }) as [string, string, string];
}

function SkyBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const handleProgress = useCallback((p: number) => {
    const el = ref.current;
    if (!el) return;
    const [c1, c2, c3] = skyColorsAt(p);
    el.style.setProperty('--sky-1', c1);
    el.style.setProperty('--sky-2', c2);
    el.style.setProperty('--sky-3', c3);
  }, []);
  useScrollProgress(handleProgress);
  return <div ref={ref} className="lp-sky-backdrop" aria-hidden="true" />;
}

/* ─────────────────────────────────────────
   スクロール出現演出（Reveal）
───────────────────────────────────────── */
type RevealVariant = 'fade-up' | 'fade-left' | 'fade-right' | 'scale' | 'blur';

/** IntersectionObserver で1回だけ検知し、対象（または stagger 指定時は直接の子要素）に
 *  transition-delay を仕込んでから .lp-reveal--in を付与する。 */
function useRevealObserver<T extends HTMLElement>(delay: number, stagger?: number) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stagger) {
      Array.from(el.children).forEach((child, i) => {
        (child as HTMLElement).style.transitionDelay = `${delay + (i * stagger) / 1000}s`;
      });
    } else {
      el.style.transitionDelay = `${delay}s`;
    }
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.classList.add('lp-reveal--in');
      obs.unobserve(el);
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, stagger]);
  return ref;
}

function Reveal({ children, variant = 'fade-up', delay = 0, stagger, style, className }: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  /** 指定すると直接の子要素を80〜120ms間隔で時差表示する（カード群・リストなど） */
  stagger?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRevealObserver<HTMLDivElement>(delay, stagger);
  const rootClass = stagger ? 'lp-reveal-stagger' : 'lp-reveal';
  return (
    <div
      ref={ref}
      className={className ? `${rootClass} ${className}` : rootClass}
      data-variant={variant}
      style={style}
    >
      {children}
    </div>
  );
}

/** 比較表 tbody 用：行を上から順に stagger 表示。tr への transform 適用はSafari等での
 *  互換性が不安定なため opacity のみで安全にアニメーションする。 */
function RevealTbody({ children, stagger = 90 }: { children: ReactNode; stagger?: number }) {
  const ref = useRevealObserver<HTMLTableSectionElement>(0, stagger);
  return (
    <tbody ref={ref} className="lp-reveal-stagger--row">
      {children}
    </tbody>
  );
}

/* ─────────────────────────────────────────
   iOS PWA モード判定
───────────────────────────────────────── */
const isIOSStandalone = () =>
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

/* ─────────────────────────────────────────
   データ定義
───────────────────────────────────────── */
type CompMark = { m: '✓' | '○' | '◎' | '△' | '✗'; note?: string };
type CompRow = { label: string; ours: CompMark; general: CompMark; jma: CompMark };

const compRows: CompRow[] = [
  {
    label: '去年との比較・積算表示',
    ours: { m: '✓', note: '自動計算・グラフ表示' },
    general: { m: '✗' },
    jma: { m: '△', note: 'データはあるが自分で計算' },
  },
  {
    label: '現場目線のラベル',
    ours: { m: '✓', note: 'カッパ？・紫外線' },
    general: { m: '✗' },
    jma: { m: '✗' },
  },
  {
    label: '農業に効く専門データ',
    ours: { m: '✓', note: '露点・飽差・0℃層高度なども時間別に' },
    general: { m: '✗' },
    jma: { m: '△', note: '一部の観測点のみ' },
  },
  {
    label: 'あの日の天気を見える化',
    ours: { m: '✓', note: '過去の日付の時間別データを今日と同じ画面で' },
    general: { m: '✗' },
    jma: { m: '△', note: '検索はできるが表形式・観測地点のみ' },
  },
  {
    label: 'CSV持ち出し',
    ours: { m: '✓', note: '気温・降水量・日射量など過去1年分をまとめて保存' },
    general: { m: '✗' },
    jma: { m: '△', note: '観測地点のデータのみ' },
  },
  {
    label: '料金',
    ours: { m: '✓', note: '無料' },
    general: { m: '△', note: '無料（広告あり）' },
    jma: { m: '✓', note: '無料' },
  },
];

/* ─────────────────────────────────────────
   共通パーツ
───────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

/** 「ログインせずに試す」「Googleで始める」を同じ強さで並べる */
function CtaPair({ loading, onLogin, onTryGuest, onDark = false }: { loading: boolean; onLogin: () => void; onTryGuest: () => void; onDark?: boolean }) {
  const cls = onDark ? 'lp-cta lp-cta--pair lp-cta--on-dark' : 'lp-cta lp-cta--pair';
  return (
    <div className="lp-cta-pair">
      <button className={cls} onClick={onTryGuest} disabled={loading}>
        <CloudSun size={18} /> ログインせずに試す
      </button>
      <button className={cls} onClick={onLogin} disabled={loading}>
        <span className="lp-cta__google"><GoogleIcon /></span>
        {loading ? 'ログイン中...' : 'Googleで始める'}
      </button>
    </div>
  );
}

/** 画面写真（角丸・影つき） */
function Shot({ src, alt, width, height, eager = false }: { src: string; alt: string; width: number; height: number; eager?: boolean }) {
  return <img className="lp-shot" src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} />;
}

/** 章の区切りの節気の絵（白い絵なので青い台に載せる）。立春から順に使う */
function SekkiDivider({ index }: { index: number }) {
  return (
    <div className="lp-sekki-divider" aria-hidden="true">
      <span className="lp-sekki-divider__tile"><SekkiArt index={index} size={40} /></span>
    </div>
  );
}

/** パッと見せる層の章（見出し一行＋添える一行＋写真） */
function GlanceSection({ eyebrow, title, titleText, note, lead, children, reverse = false }: {
  eyebrow: ReactNode; title: ReactNode; titleText: string; note?: string; lead: ReactNode; children: ReactNode; reverse?: boolean;
}) {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <div className={reverse ? 'lp-glance lp-glance--reverse' : 'lp-glance'}>
          <Reveal variant={reverse ? 'fade-right' : 'fade-left'}>
            <p className="lp-eyebrow">{eyebrow}</p>
            <h2 className="lp-h2 lp-glance__title" aria-label={titleText}>{title}</h2>
            {note && <p className="lp-glance__note">{note}</p>}
            <div className="lp-glance__lead">{lead}</div>
          </Reveal>
          <Reveal variant={reverse ? 'fade-left' : 'fade-right'}>{children}</Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   セクション
───────────────────────────────────────── */
function Nav({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const handleProgress = useCallback((p: number) => {
    setScrolled(window.scrollY > 40);
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
  }, []);
  // ナビの状態遷移は継続的な演出ではなく離散的なUIフィードバックのため forceActive で reduced-motion 下でも維持
  useScrollProgress(handleProgress, { forceActive: true });

  return (
    <nav className={scrolled ? 'lp-nav lp-nav--scrolled' : 'lp-nav'}>
      <div className="lp-nav-glass" aria-hidden="true" />
      <div className="lp-nav-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Leaf size={20} color="var(--accent)" />
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Orch.Weather</span>
        </div>
        <button className="lp-cta lp-cta--small" onClick={onLogin} disabled={loading}>
          無料で始める
        </button>
      </div>
      <div className="lp-nav-progress-track" aria-hidden="true">
        <div ref={barRef} className="lp-nav-progress" />
      </div>
    </nav>
  );
}

/* Hero「生きている空」装飾（雲の浮遊＋光のシマー）。aria-hidden・pointer-events:none で読み上げ／操作に影響しない */
function HeroSky() {
  return (
    <div className="lp-hero-sky" aria-hidden="true">
      <div className="lp-hero-cloud lp-hero-cloud--1" />
      <div className="lp-hero-cloud lp-hero-cloud--2" />
      <div className="lp-hero-cloud lp-hero-cloud--3" />
      <div className="lp-hero-cloud lp-hero-cloud--4" />
      <div className="lp-hero-cloud lp-hero-cloud--5" />
      <div className="lp-hero-shimmer" />
    </div>
  );
}

function Hero({ loading, error, onLogin, onTryGuest }: { loading: boolean; error: string | null; onLogin: () => void; onTryGuest: () => void }) {
  return (
    <section className="lp-hero lp-section" style={{ paddingTop: 'clamp(2.5rem, 6vw, 4rem)' }}>
      <HeroSky />
      <div className="lp-container lp-hero__grid">
        <Reveal style={{ flex: '1 1 400px', minWidth: 0 }}>
          <p className="lp-hero__badge"><Sprout size={14} /> 農家が現場で作った天気アプリ</p>
          <h1 className="lp-hero__title" aria-label="『今年は遅い』が、数字で見える。"><span className="lp-phrase">『今年は遅い』が、</span><span className="lp-phrase">数字で見える。</span></h1>
          <p className="lp-lead lp-hero__lead">二十四節気ごとに、去年・5年平均と比べてふりかえる、農家のための天気アプリ。</p>
          <CtaPair loading={loading} onLogin={onLogin} onTryGuest={onTryGuest} />
          <p className="lp-cta-note">ログインなしでも現在地で試せます。Googleアカウントなら登録30秒・いまは無料。</p>
          {error && <p className="lp-error">{error}</p>}
        </Reveal>
        <Reveal variant="scale" delay={0.15} style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="lp-hero__shot lp-phone--float">
            <Shot src="/lp/review-card.webp" alt="節気のふりかえりカード — 去年・5年平均と比べた気温・雨・日照" width={780} height={1114} eager />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SeasonSection() {
  return (
    <GlanceSection
      eyebrow={<><CalendarRange size={16} /> 季節のふりかえり</>}
      titleText="二十四節気ごとに、今年の半月を一枚に。"
      title={<><span className="lp-phrase">二十四節気ごとに、</span><span className="lp-phrase">今年の半月を一枚に。</span></>}
      note="暦は、農の時計だった。"
      lead={<p className="lp-glance__big">積算温度、去年より18日遅い。<br />数字で、季節の進み具合がわかる。</p>}
    >
      <div className="lp-shot-stack">
        <Shot src="/lp/season-band.webp" alt="季節のあしどり — 気温・降水量・積算温度・日照を去年と比べる帯" width={780} height={106} />
        <Shot src="/lp/review-card-2.webp" alt="節気のふりかえりカード（処暑）" width={780} height={1114} />
      </div>
    </GlanceSection>
  );
}

function KurabeSection() {
  return (
    <GlanceSection
      reverse
      eyebrow={<><BarChart2 size={16} /> 空くらべ</>}
      titleText="去年と、あの場所と、並べて見える。"
      title={<><span className="lp-phrase">去年と、あの場所と、</span><span className="lp-phrase">並べて見える。</span></>}
      lead={
        <ul className="lp-points">
          <li><CalendarRange size={18} /> 年をまたいで、重ねて比べる</li>
          <li><MapPin size={18} /> 地点を並べて、違いを比べる</li>
          <li><Thermometer size={18} /> 積算温度を、自動で計算</li>
        </ul>
      }
    >
      <div className="lp-shot-stack">
        <Shot src="/lp/kurabe-temp.webp" alt="空くらべ — 今年と去年の気温を重ねたグラフ" width={780} height={1157} />
        <Shot src="/lp/kurabe-gdd.webp" alt="空くらべ — 有効積算温度のグラフ" width={780} height={1253} />
      </div>
    </GlanceSection>
  );
}

function MoyoSection() {
  return (
    <GlanceSection
      eyebrow={<><CloudSun size={16} /> 空もよう</>}
      titleText="今日の作業、やるかやめるかすぐ決まる。"
      title={<><span className="lp-phrase">今日の作業、</span><span className="lp-phrase">やるかやめるか</span><span className="lp-phrase">すぐ決まる。</span></>}
      lead={
        <ul className="lp-points">
          <li>「リスクでみる」— その時間帯のいちばん悪い天気</li>
          <li>「概況でみる」— その時間帯のいちばん長い天気</li>
          <li>毎日、今日の節気と七十二候を表示</li>
        </ul>
      }
    >
      <Shot src="/lp/moyo.webp" alt="空もよう — 午前・午後・夜間の天気と、リスク／概況の切り替え" width={780} height={1688} />
    </GlanceSection>
  );
}

function MidCta(props: { loading: boolean; onLogin: () => void; onTryGuest: () => void }) {
  return (
    <section className="lp-section lp-section--tight">
      <div className="lp-container-narrow" style={{ textAlign: 'center' }}>
        <Reveal><CtaPair {...props} /></Reveal>
      </div>
    </section>
  );
}

/** 詳しく読む層の折りたたみ。中身はページ内に残る（検索に拾われる）。開いたら GA4 に記録 */
function Detail({ section, title, children }: { section: 'features' | 'compare' | 'maker' | 'faq'; title: string; children: ReactNode }) {
  return (
    <details
      className="lp-details"
      data-section={section}
      onToggle={(e) => { if (e.currentTarget.open) logLpDetailOpen(section); }}
    >
      <summary className="lp-details__summary">{title}</summary>
      <div className="lp-details__body">{children}</div>
    </details>
  );
}

/* ── 比較表 ── */
function MarkCell({ mark, ours = false }: { mark: CompMark; ours?: boolean }) {
  const color = (mark.m === '✓' || mark.m === '○' || mark.m === '◎') ? 'var(--accent)' : mark.m === '△' ? '#d97706' : '#b3bcc9';
  return (
    <td className={ours ? 'lp-comp-ours' : undefined}>
      <span style={{ color, fontWeight: 800, fontSize: '1rem' }}>{mark.m}</span>
      {mark.note && <span className="lp-comp-note">{mark.note}</span>}
    </td>
  );
}

function CompareTable() {
  return (
    <div className="lp-glass" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="lp-comp">
          <thead>
            <tr>
              <th></th>
              <th style={{ color: 'var(--accent)' }}>Orch.Weather</th>
              <th>一般天気アプリ</th>
              <th>気象庁HP</th>
            </tr>
          </thead>
          <RevealTbody>
            {compRows.map(r => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <MarkCell mark={r.ours} ours />
                <MarkCell mark={r.general} />
                <MarkCell mark={r.jma} />
              </tr>
            ))}
          </RevealTbody>
        </table>
      </div>
    </div>
  );
}

/* ── 料金プラン別 機能比較 ── */
const tierGroups: { group: string; rows: { label: string; guest: CompMark; free: CompMark; paid: CompMark }[] }[] = [
  {
    group: '空もよう',
    rows: [
      { label: '天気情報',     guest: { m: '△', note: '現在地' }, free: { m: '○', note: '10件' },           paid: { m: '◎', note: '50件' } },
    ],
  },
  {
    group: '空くらべ',
    rows: [
      { label: '前年比較・積算',             guest: { m: '△', note: '現在地のみ' }, free: { m: '◎', note: '登録地点' }, paid: { m: '◎', note: '登録地点' } },
      { label: 'CSV出力（一括ダウンロード）', guest: { m: '✗' },                     free: { m: '✗' },                   paid: { m: '◎' } },
    ],
  },
  {
    group: '空しらべ',
    rows: [
      { label: '過去の天気', guest: { m: '△', note: '現在地' }, free: { m: '◎', note: '登録地点' }, paid: { m: '◎', note: '登録地点' } },
    ],
  },
];

function TierTable() {
  return (
    <>
      <div className="lp-glass" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="lp-comp">
            <thead>
              <tr>
                <th colSpan={2}></th>
                <th>ログインなし</th>
                <th>ログイン<br />（無料）</th>
                <th style={{ color: 'var(--accent)' }}>ログイン<br />（有料）<span style={{ fontSize: '0.68rem', fontWeight: 600 }}>※予定</span></th>
              </tr>
            </thead>
            <RevealTbody>
              {tierGroups.flatMap(g => g.rows.map((r, i) => (
                <tr key={g.group + r.label}>
                  {i === 0 && (
                    <td
                      rowSpan={g.rows.length}
                      style={{ textAlign: 'left', fontWeight: 700, verticalAlign: 'middle', whiteSpace: 'nowrap', borderRight: '1px solid var(--line)' }}
                    >
                      {g.group}
                    </td>
                  )}
                  <td style={{ textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap', width: '1%' }}>{r.label}</td>
                  <MarkCell mark={r.guest} />
                  <MarkCell mark={r.free} />
                  <MarkCell mark={r.paid} ours />
                </tr>
              )))}
            </RevealTbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--ink-2)', lineHeight: 1.85, margin: '1rem 0 0' }}>
        いまはお試し期間として、多くの機能を無料でお使いいただけます。ご利用いただける機能の範囲は、お試し期間の終了やサービスの状況により、今後変更となる場合があります。あらかじめご了承ください。
      </p>
    </>
  );
}

const faqs: { q: string; a: string }[] = [
  { q: '無料で使えますか？', a: 'いまはお試し期間として、多くの機能を無料でお使いいただけます。有料プランは予定段階です。ご利用いただける機能の範囲は、今後変更となる場合があります。' },
  { q: 'ログインしないと使えませんか？', a: 'ログインなしでも、現在地の天気・ふりかえり・去年との比較を試せます。畑の場所を登録して使うには、Googleアカウントでのログインが必要です。' },
  { q: '「5年平均」とは何ですか？', a: '去年から5年前までの、同じ月日の期間の実績の平均です。ふりかえりや季節のあしどりは、過去の実績の集計と比較です。' },
  { q: 'データはどこから来ていますか？', a: '気象データ（実績・予報）は Open-Meteo、注意報・警報は気象庁の発表を使っています。アプリが独自に天気を予測することはありません。' },
];

function DetailsSection() {
  return (
    <section className="lp-section">
      <div className="lp-container-narrow">
        <Reveal><h2 className="lp-h2">もっと詳しく</h2></Reveal>
        <div className="lp-details-list">
          <Detail section="features" title="機能をくわしく見る">
            <h3 className="lp-details__h3">空くらべ — 積算を、自分の畑に合わせて</h3>
            <ul className="lp-details__list">
              <li>降水量・日照時間・日射量・積算温度の4つを、毎日の値から自動で積み上げてグラフにします。</li>
              <li>積算の開始日は、萌芽や定植など生育に合わせて自由に設定できます。</li>
              <li>積算温度の基準温度は2種類まで登録でき、ねらいの異なる積算を並べて確認できます。</li>
              <li>比較したい年や登録地点をグラフに重ねると、「去年より何日進んでいるか」「あの場所とどれくらい違うか」がわかります。</li>
            </ul>
            <h3 className="lp-details__h3">空もよう — 畑の時間で、1日を3つに</h3>
            <ul className="lp-details__list">
              <li>1日を午前4〜12時・午後12〜20時・夜間20〜翌4時に分けて、天気が変わるタイミングをつかめます。</li>
              <li>3mmまでの雨を「ぽつぽつ」「カッパ？」「カッパ！」の3段階で表示します。</li>
              <li>露点温度（霜）・飽差（水分管理）・0℃層高度（雹）・大気安定度（落雷）・紫外線指数を、時間別に一覧できます。</li>
            </ul>
            <h3 className="lp-details__h3">空しらべ — あの日の天気を、今日と同じ画面で</h3>
            <ul className="lp-details__list">
              <li>過去の日付を選ぶと、時間別のすべてのデータをそのまま表示します。作業の原因追跡や、翌年の計画に。</li>
              <li>ログイン（有料・予定）では、気温・降水量・日射量など過去1年分をCSVでまとめて保存できます。</li>
            </ul>
          </Detail>
          <Detail section="compare" title="一般の天気アプリとの違い・料金">
            <CompareTable />
            <h3 className="lp-details__h3">ログインでひろがる、できること</h3>
            <TierTable />
          </Detail>
          <Detail section="maker" title="作った人のこと">
            <p className="lp-details__p">
              Orch.Weatherは、農作業の判断を助け、作物の生育を可視化したい。そう考えた一人の農家が、「現場で欲しかったもの」を詰め込んだアプリです。
            </p>
            <p className="lp-details__p">
              積算温度を自動で計算し、昨年と何日違うかを並べて表示。天気は「概況」と「リスク」を切り替えて確認でき、1日は畑に出る時間に合わせて午前・午後・夜間に分割。こうした機能は、机の上ではなく、現場で使いながら磨いてきたものばかりです。
            </p>
          </Detail>
          <Detail section="faq" title="よくある質問">
            <dl className="lp-faq">
              {faqs.map(f => (
                <div key={f.q} className="lp-faq__item">
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </Detail>
        </div>
      </div>
    </section>
  );
}

/* ── 最終CTA ── */
function FinalCta(props: { loading: boolean; onLogin: () => void; onTryGuest: () => void }) {
  return (
    <section className="lp-section lp-final">
      <div className="lp-final-glow" aria-hidden="true" />
      <div className="lp-container-narrow">
        <Reveal>
          <h2 className="lp-h2" style={{ color: '#fff' }}>今年の季節を、数字で見てみる。</h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.9, margin: '0 0 1.6rem', fontSize: '0.95rem' }}>
            ログインなしでも、現在地ですぐに試せます。
          </p>
          <CtaPair {...props} onDark />
        </Reveal>
      </div>
    </section>
  );
}

/* ── フッター ── */
function LpFooter() {
  return (
    <footer className="lp-footer">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          fontSize: '0.77rem',
          lineHeight: 1.75,
          color: 'rgba(255,255,255,0.45)',
        }}>
          <p style={{ margin: '0 0 0.4rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>ご利用上の注意</p>
          <p style={{ margin: 0 }}>
            本アプリは、気象庁が発表する注意報・警報や、Open-Meteoが提供する気象データ（実績・予報）を、農業で使いやすい形に整理してお見せするツールです。アプリが独自に天気を予測することはなく、気象予報業務許可を要する予報業務を行うものではありません。表示される数値やグラフは参考情報であり、データの誤差・欠損・遅延や、予報と実際の天候が異なることがあります。農薬散布・防霜対策などの実際の作業判断は、気象庁の最新の警報・注意報や現地の状況とあわせて、ご自身の責任のもとで行ってください。詳しくは下記の免責事項をご覧ください。
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Leaf size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Orch.Weather</span>
          </div>
          <p style={{ margin: '0 0 0.5rem' }}>
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
            {'　'}<a href="/disclaimer.html" target="_blank" rel="noopener noreferrer">免責事項</a>
            {'　'}<a href="/contact.html" target="_blank" rel="noopener noreferrer">お問い合わせ</a>
          </p>
          <p style={{ margin: '0 0 0.5rem' }}>
            気象データ提供：<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            {'　'}注意報・警報：<a href="https://www.jma.go.jp" target="_blank" rel="noopener noreferrer">気象庁</a>
          </p>
          <p style={{ margin: 0 }}>© 2025 Orch.Weather — Orchシリーズ農業専用ツール</p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
   LandingPage 本体
───────────────────────────────────────── */
export function LandingPage({ onTryGuest }: { onTryGuest: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    logLogin();
    try {
      if (isIOSStandalone()) {
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch {
          // fall through to error display
        }
      }
      setError('ログインに失敗しました。もう一度お試しください。');
      setLoading(false);
    }
  };

  return (
    <div className="lp-root">
      <SkyBackdrop />
      {/* Nav は sticky。positioned な .lp-content の内側に入れると sticky が壊れるため root 直下に置く（z-index:50 で空レイヤー/コンテンツより前面） */}
      <Nav loading={loading} onLogin={handleLogin} />
      <div className="lp-content">
        <Hero loading={loading} error={error} onLogin={handleLogin} onTryGuest={onTryGuest} />
        <SekkiDivider index={0} />
        <SeasonSection />
        <SekkiDivider index={1} />
        <KurabeSection />
        <SekkiDivider index={2} />
        <MoyoSection />
        <MidCta loading={loading} onLogin={handleLogin} onTryGuest={onTryGuest} />
        <SekkiDivider index={3} />
        <DetailsSection />
        <FinalCta loading={loading} onLogin={handleLogin} onTryGuest={onTryGuest} />
        <LpFooter />
      </div>
    </div>
  );
}
