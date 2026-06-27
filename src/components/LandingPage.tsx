import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import {
  Leaf, ArrowRight, Quote, Sparkles, BarChart2, CloudSun, SlidersHorizontal, Sprout,
  Clock, Sun, CloudRain, History,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import '../landing.css';

/* ─────────────────────────────────────────
   スクロールフェードイン
───────────────────────────────────────── */
function FadeIn({ children, delay = 0, style }: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setTimeout(() => {
        if (!el) return;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, delay * 1000);
      obs.unobserve(el);
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} style={{
      opacity: 0,
      transform: 'translateY(28px)',
      transition: 'opacity 0.65s cubic-bezier(.22,1,.36,1), transform 0.65s cubic-bezier(.22,1,.36,1)',
      ...style,
    }}>
      {children}
    </div>
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
const tabOverview = [
  {
    icon: CloudSun,
    name: '空もよう',
    tagline: '今日・明日の判断を、AIが手伝う',
  },
  {
    icon: BarChart2,
    name: '空くらべ',
    tagline: '去年と比べて、数字で見える',
  },
  {
    icon: History,
    name: '空しらべ',
    tagline: 'あの日の天気を、同じ画面で確認',
  },
];

type CompMark = { m: '✓' | '△' | '✗'; note?: string };
type CompRow = { label: string; ours: CompMark; general: CompMark; jma: CompMark };

const compRows: CompRow[] = [
  {
    label: '去年との比較・積算表示',
    ours: { m: '✓', note: '自動計算・グラフ表示' },
    general: { m: '✗' },
    jma: { m: '△', note: 'データはあるが自分で計算' },
  },
  {
    label: 'AIの作業提案',
    ours: { m: '✓', note: '散布・施肥・畑しごと' },
    general: { m: '✗' },
    jma: { m: '✗' },
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

const steps = [
  { num: 1, title: 'Googleアカウントで登録', body: '無料・30秒。メールアドレスの入力やパスワードの設定は不要です。' },
  { num: 2, title: '畑の場所を登録', body: '現在地ならワンタップ。地図から選んで複数の圃場を登録することもできます。' },
  { num: 3, title: '今日の「できる・できない」がすぐわかる', body: '時間ごとの空模様とAIの提案が、最初の画面に表示されます。' },
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

function TabBadge({ icon: Icon, name }: { icon: typeof CloudSun; name: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
      padding: '0.45rem 1rem',
      background: 'var(--accent-light)',
      border: '1px solid rgba(13,148,136,0.3)',
      borderRadius: 999,
      color: 'var(--accent-color)',
      fontWeight: 800,
      fontSize: '0.9rem',
      marginBottom: '1.6rem',
    }}>
      <Icon size={15} />
      {name}
    </div>
  );
}

/* ─────────────────────────────────────────
   セクション
───────────────────────────────────────── */
function Nav({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  return (
    <nav className="lp-nav">
      <div className="lp-nav-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Leaf size={20} color="var(--accent-color)" />
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Orch.Weather</span>
        </div>
        <button className="lp-cta lp-cta--small" onClick={onLogin} disabled={loading}>
          無料で始める
        </button>
      </div>
    </nav>
  );
}

function Hero({ loading, error, onLogin, onTryGuest }: { loading: boolean; error: string | null; onLogin: () => void; onTryGuest: () => void }) {
  return (
    <section className="lp-section" style={{ paddingTop: 'clamp(2.5rem, 6vw, 4rem)' }}>
      <div className="lp-container" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(2rem, 5vw, 3.5rem)' }}>
        <FadeIn style={{ flex: '1 1 400px', minWidth: 0 }}>
          <p style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'var(--accent-light)', color: 'var(--accent-color)',
            fontWeight: 700, fontSize: '0.8rem', borderRadius: 999,
            padding: '0.35rem 0.9rem', margin: '0 0 1.1rem',
          }}>
            <Sprout size={14} /> 農家が現場で作った気象データ活用ツール
          </p>
          <h1 style={{
            fontSize: 'clamp(1.7rem, 5.2vw, 2.7rem)', fontWeight: 800,
            lineHeight: 1.42, letterSpacing: '0.01em', margin: '0 0 1.1rem',
          }}>
            今日できるか、すぐわかる。<br />去年と比べて、数字で見える。
          </h1>
          <p className="lp-lead" style={{ marginBottom: '1.6rem' }}>
            散布・施肥・畑しごと——AIが気象データから「いつできるか」を提案。去年との比較も、積算温度も、ひとつのアプリで。
          </p>
          <button className="lp-cta" onClick={onLogin} disabled={loading}>
            <span style={{ background: '#fff', borderRadius: 6, padding: 3, display: 'inline-flex' }}><GoogleIcon /></span>
            {loading ? 'ログイン中...' : 'Googleアカウントで無料で始める'}
            <ArrowRight size={17} />
          </button>
          <div style={{ marginTop: '0.8rem' }}>
            <button className="lp-cta lp-cta--ghost" onClick={onTryGuest}>
              ログインせずに試す（現在地のみ）
              <ArrowRight size={17} />
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0.7rem 0 0' }}>
            登録30秒・いまは完全無料
          </p>
          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.6rem' }}>{error}</p>}
        </FadeIn>
        <FadeIn delay={0.15} style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="lp-phone">
            <img src="/lp/hero-imanosora.webp" alt="空もよう — 時間ごとの空模様とAI提案の画面" width={780} height={1688} />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── 3タブ俯瞰 ── */
function BridgeSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 0, paddingBottom: 'clamp(1rem, 3vw, 1.5rem)' }}>
      <div className="lp-container-narrow">
        <FadeIn>
          <h2 className="lp-h2">3つの画面で、農業の時間をすべてカバーする。</h2>
        </FadeIn>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '1rem',
          marginTop: '1.8rem',
        }}>
          {tabOverview.map((tab, i) => {
            const Icon = tab.icon;
            return (
              <FadeIn key={tab.name} delay={i * 0.1}>
                <div className="lp-glass" style={{ padding: '1.4rem 1.2rem', textAlign: 'center', height: '100%', boxSizing: 'border-box' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(13,148,136,0.12), rgba(13,148,136,0.28))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                  }}>
                    <Icon size={20} color="var(--accent-color)" />
                  </div>
                  <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: '0 0 0.4rem', letterSpacing: '0.02em' }}>
                    {tab.name}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                    {tab.tagline}
                  </p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── 空もよう（メイン） ── */
function SoraMoyoSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
      <div className="lp-container">
        <FadeIn>
          <TabBadge icon={CloudSun} name="空もよう" />
          <div className="lp-glass" style={{
            padding: '1.2rem 1.4rem',
            marginBottom: '2.5rem',
            borderLeft: '3px solid var(--accent-color)',
          }}>
            <Quote size={16} color="var(--accent-color)" style={{ marginBottom: '0.4rem' }} />
            <p style={{ fontWeight: 700, margin: '0 0 0.3rem', fontSize: '0.95rem' }}>
              今日できるか、毎朝頭の中で計算している
            </p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.85 }}>
              防除、散布、施肥…。今日できるか明日できるか、気温・降水確率・風速を一つずつ確認しながら考えている。
            </p>
          </div>
        </FadeIn>

        {/* AI農作業アドバイス */}
        <FadeIn>
          <div className="lp-zigzag" style={{ marginBottom: 'clamp(2.5rem, 7vw, 4rem)' }}>
            <div>
              <p style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem',
                margin: '0 0 0.7rem',
              }}>
                <Sparkles size={16} /> AI農作業アドバイス
              </p>
              <h3 style={{
                fontSize: 'clamp(1.2rem, 3.2vw, 1.55rem)', fontWeight: 800,
                lineHeight: 1.5, margin: '0 0 0.8rem',
              }}>
                「明日、散布できるか」に、答えが出る。
              </h3>
              <p className="lp-lead" style={{ fontSize: '0.92rem' }}>
                AIが気象データから作業できる時間帯と残るリスクをわかりやすく提案。あなたの判断をサポート。材料はすべてここに。
              </p>
            </div>
            <div>
              <img className="lp-shot" src="/lp/feature-ai.webp" alt="AI農作業アドバイスの画面" width={780} height={744} loading="lazy" />
            </div>
          </div>
        </FadeIn>

        {/* じぶん好みAI */}
        <FadeIn>
          <div className="lp-zigzag lp-zigzag--reverse" style={{ marginBottom: 'clamp(2.5rem, 7vw, 4rem)' }}>
            <div>
              <p style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem',
                margin: '0 0 0.7rem',
              }}>
                <SlidersHorizontal size={16} /> じぶん好みAI
              </p>
              <h3 style={{
                fontSize: 'clamp(1.2rem, 3.2vw, 1.55rem)', fontWeight: 800,
                lineHeight: 1.5, margin: '0 0 0.8rem',
              }}>
                あなたの畑に合わせて、AIに聞ける。
              </h3>
              <p className="lp-lead" style={{ fontSize: '0.92rem' }}>
                「標高が高いから2℃低めで考えて」「風に弱い作物がある」——自分の言葉で条件を登録すれば、AIがそれを踏まえて答えます。
              </p>
            </div>
            <div>
              <img className="lp-shot" src="/lp/feature-custom.webp" alt="じぶん好みプロンプト設定の画面" width={1167} height={1830} loading="lazy" />
            </div>
          </div>
        </FadeIn>

        {/* サブ機能グリッド */}
        <FadeIn>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.1rem',
          }}>

            {/* 3分割 + リスク/概況 */}
            <div className="lp-glass" style={{ padding: '1.5rem 1.4rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(13,148,136,0.12), rgba(13,148,136,0.28))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '0.85rem',
              }}>
                <Clock size={17} color="var(--accent-color)" />
              </div>
              <p style={{ fontWeight: 700, margin: '0 0 0.5rem', fontSize: '0.93rem' }}>
                午前・午後・夜間の3分割表示
              </p>
              <p style={{ margin: '0 0 0.9rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
                「晴れのち一時雨」も、午前が晴れで午後から雨なのか一目でわかる。リスク/概況の2モードで見方を切り替えられます。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <div style={{
                    background: 'rgba(244,167,185,0.2)', border: '1px solid #e88ea8',
                    borderRadius: 5, padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem', fontWeight: 700, color: '#9b2d4e',
                    whiteSpace: 'nowrap', flexShrink: 0, marginTop: '0.1rem',
                  }}>
                    リスクでみる
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.75 }}>
                    散布・播種など一発勝負の作業に。悪天候の見落としをゼロに。
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <div style={{
                    background: 'rgba(13,148,136,0.1)', border: '1px solid #0d9488',
                    borderRadius: 5, padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem', fontWeight: 700, color: '#0f766e',
                    whiteSpace: 'nowrap', flexShrink: 0, marginTop: '0.1rem',
                  }}>
                    概況でみる
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.75 }}>
                    雨の合間を積極的に活用したい日の指針に。
                  </p>
                </div>
              </div>
            </div>

            {/* 農業専門データ */}
            <div className="lp-glass" style={{ padding: '1.5rem 1.4rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.28))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '0.85rem',
              }}>
                <CloudRain size={17} color="#0284c7" />
              </div>
              <p style={{ fontWeight: 700, margin: '0 0 0.5rem', fontSize: '0.93rem' }}>
                農業に効く専門データを時間別に
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
                露点温度（病害感染リスク）、飽差（水分管理）、0℃層高度（雹リスク）、大気安定度（落雷リスク）——気温と降水確率だけでは見えない判断材料を時間別に一覧表示。
              </p>
            </div>

            {/* UV・カッパ */}
            <div className="lp-glass" style={{ padding: '1.5rem 1.4rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.28))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '0.85rem',
              }}>
                <Sun size={17} color="#d97706" />
              </div>
              <p style={{ fontWeight: 700, margin: '0 0 0.5rem', fontSize: '0.93rem' }}>
                紫外線指数とカッパ判断ラベル
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
                UV指数を時間別に確認。降水量はさらに3段階ラベルで表示：<strong>ぽつぽつ</strong>（0.5mm未満）・<strong>カッパ？</strong>（0.5〜1.0mm）・<strong>カッパ！</strong>（1.0mm〜）。この一段階の細かさが、作業を続けるか切り上げるかの判断を変えます。
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── 空くらべ ── */
function SoraKurabeSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
      <div className="lp-container">
        <FadeIn>
          <TabBadge icon={BarChart2} name="空くらべ" />
          <div className="lp-glass" style={{
            padding: '1.2rem 1.4rem',
            marginBottom: '2.5rem',
            borderLeft: '3px solid var(--accent-color)',
          }}>
            <Quote size={16} color="var(--accent-color)" style={{ marginBottom: '0.4rem' }} />
            <p style={{ fontWeight: 700, margin: '0 0 0.3rem', fontSize: '0.95rem' }}>
              「今年は暖かい気がする」けど、数字で確認できない
            </p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.85 }}>
              去年と比べてどれくらい違うのか、何日進んでいるか——感覚ではなく数字で把握したい。
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="lp-zigzag">
            <div>
              <p style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem',
                margin: '0 0 0.7rem',
              }}>
                <BarChart2 size={16} /> 前年比較・積算
              </p>
              <h3 style={{
                fontSize: 'clamp(1.2rem, 3.2vw, 1.55rem)', fontWeight: 800,
                lineHeight: 1.5, margin: '0 0 0.8rem',
              }}>
                「今年は早い？遅い？」が、数字でわかる。
              </h3>
              <p className="lp-lead" style={{ fontSize: '0.92rem' }}>
                積算温度・降水量・日射量などを自動計算しグラフィカルに表示。比較したい年、登録地点を選択でき「去年より何日進んでいるか」「あの場所とどれくらい違うか」まで一目。
              </p>
            </div>
            <div>
              <img className="lp-shot" src="/lp/feature-kurabe.webp" alt="前年比較チャートの画面" width={1178} height={1922} loading="lazy" />
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── 空しらべ（軽め） ── */
function SoraShirabeSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
      <div className="lp-container-narrow">
        <FadeIn>
          <TabBadge icon={History} name="空しらべ" />
          <div className="lp-glass" style={{ padding: 'clamp(1.6rem, 4vw, 2.4rem)' }}>
            <h3 style={{
              fontSize: 'clamp(1.1rem, 2.8vw, 1.35rem)', fontWeight: 800,
              lineHeight: 1.5, margin: '0 0 0.85rem',
            }}>
              あの日の天気が、今日と同じ画面で見える。
            </h3>
            <p className="lp-lead" style={{ fontSize: '0.9rem', margin: 0 }}>
              「防除が効かなかったのは天気のせいか」「あの大雨、実際どれくらいだった？」——
              空しらべは過去の任意の日付を選ぶと、時間別のすべてのデータをそのまま表示します。
              失敗した作業の原因追跡にも、翌年の作業計画を立てるときの参考にも。
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── 比較表 ── */
function MarkCell({ mark, ours = false }: { mark: CompMark; ours?: boolean }) {
  const color = mark.m === '✓' ? 'var(--accent-color)' : mark.m === '△' ? '#d97706' : '#b3bcc9';
  return (
    <td className={ours ? 'lp-comp-ours' : undefined}>
      <span style={{ color, fontWeight: 800, fontSize: '1rem' }}>{mark.m}</span>
      {mark.note && <span className="lp-comp-note">{mark.note}</span>}
    </td>
  );
}

function ComparisonSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-container-narrow">
        <FadeIn>
          <h2 className="lp-h2">一般の天気アプリとの違い</h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="lp-glass" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="lp-comp">
                <thead>
                  <tr>
                    <th></th>
                    <th style={{ color: 'var(--accent-color)' }}>Orch.Weather</th>
                    <th>一般天気アプリ</th>
                    <th>気象庁HP</th>
                  </tr>
                </thead>
                <tbody>
                  {compRows.map(r => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <MarkCell mark={r.ours} ours />
                      <MarkCell mark={r.general} />
                      <MarkCell mark={r.jma} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── 料金プラン別 機能比較 ── */
const tierGroups: { group: string; rows: { label: string; guest: CompMark; free: CompMark; paid: CompMark }[] }[] = [
  {
    group: '空もよう',
    rows: [
      { label: '天気情報',     guest: { m: '△', note: '現在地のみ' }, free: { m: '✓', note: '地点登録10件' }, paid: { m: '✓', note: '地点登録50件' } },
      { label: 'AIアドバイス', guest: { m: '✗' },                     free: { m: '✗', note: '近日提供予定' }, paid: { m: '✓' } },
    ],
  },
  {
    group: '空くらべ',
    rows: [
      { label: '前年比較・積算',             guest: { m: '△', note: '現在地' }, free: { m: '✓', note: '登録地点で比較' }, paid: { m: '✓', note: '登録地点で比較' } },
      { label: 'CSV出力（一括ダウンロード）', guest: { m: '✗' },                 free: { m: '✗' },                       paid: { m: '✓' } },
    ],
  },
  {
    group: '空しらべ',
    rows: [
      { label: '過去の天気', guest: { m: '△', note: '現在地' }, free: { m: '✓', note: '登録地点' }, paid: { m: '✓', note: '登録地点' } },
    ],
  },
];

function TierComparisonSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-container-narrow">
        <FadeIn>
          <h2 className="lp-h2">ログインでひろがる、できること</h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="lp-glass" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="lp-comp">
                <thead>
                  <tr>
                    <th colSpan={2}></th>
                    <th>ログインなし</th>
                    <th>ログイン<br />（無料）</th>
                    <th style={{ color: 'var(--accent-color)' }}>ログイン<br />（有料）<span style={{ fontSize: '0.68rem', fontWeight: 600 }}>※予定</span></th>
                  </tr>
                </thead>
                <tbody>
                  {tierGroups.flatMap(g => g.rows.map((r, i) => (
                    <tr key={g.group + r.label}>
                      {i === 0 && (
                        <td
                          rowSpan={g.rows.length}
                          style={{ textAlign: 'left', fontWeight: 700, verticalAlign: 'middle', whiteSpace: 'nowrap', borderRight: '1px solid var(--card-border-sub)' }}
                        >
                          {g.group}
                        </td>
                      )}
                      <td style={{ textAlign: 'left', fontWeight: 500 }}>{r.label}</td>
                      <MarkCell mark={r.guest} />
                      <MarkCell mark={r.free} />
                      <MarkCell mark={r.paid} ours />
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.85, margin: '1rem 0 0' }}>
いまはお試し期間として、多くの機能を無料でお使いいただけます。ご利用いただける機能の範囲は、お試し期間の終了やサービスの状況により、今後変更となる場合があります。あらかじめご了承ください。
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── 作った人 ── */
function MakerNote() {
  return (
    <section className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-container-narrow">
        <FadeIn>
          <div className="lp-glass" style={{
            padding: 'clamp(1.6rem, 4vw, 2.4rem)',
            textAlign: 'center',
            borderTop: '3px solid var(--accent-color)',
          }}>
            <Sprout size={26} color="var(--accent-color)" style={{ marginBottom: '0.8rem' }} />
            <h2 className="lp-h2" style={{ fontSize: 'clamp(1.25rem, 3.5vw, 1.6rem)' }}>
              作ったのは、同じ悩みを持つ農家です。
            </h2>
            <p className="lp-lead" style={{ textAlign: 'left' }}>
              Orch.Weatherは、毎朝の天気判断に時間を取られていた一人の農家が、自分の畑のために作ったアプリです。机の上ではなく、現場で使いながら磨いてきました。カッパが要るかまでわかる時間別表示も、雨の合間を見つけるAIの提案も、「現場で欲しかったもの」だけを載せています。
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── 始め方 ── */
function StepsSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-container">
        <FadeIn>
          <h2 className="lp-h2">3ステップで、今日から使える。</h2>
        </FadeIn>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.1rem',
          marginTop: '1.8rem',
        }}>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.1}>
              <div className="lp-glass" style={{ padding: '1.5rem 1.3rem', height: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  color: '#fff', fontWeight: 800, fontSize: '1.05rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.9rem',
                }}>
                  {s.num}
                </div>
                <p style={{ fontWeight: 700, margin: '0 0 0.5rem', fontSize: '0.98rem' }}>{s.title}</p>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.8 }}>{s.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 最終CTA ── */
function FinalCta({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  return (
    <section className="lp-section lp-final">
      <div className="lp-container-narrow">
        <FadeIn>
          <h2 className="lp-h2" style={{ color: '#fff' }}>明日の朝から、判断が変わる。</h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.9, margin: '0 0 1.6rem', fontSize: '0.95rem' }}>
            いまは完全無料。Googleアカウントがあれば30秒で始められます。
          </p>
          <button
            className="lp-cta"
            onClick={onLogin}
            disabled={loading}
            style={{ background: '#fff', color: 'var(--accent-color)', boxShadow: '0 10px 26px rgba(0,0,0,0.18)' }}
          >
            <GoogleIcon />
            {loading ? 'ログイン中...' : 'Googleアカウントで無料で始める'}
            <ArrowRight size={17} />
          </button>
        </FadeIn>
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
            本アプリは、気象庁等の公的機関が発表する公式予報データおよびOpen-Meteoの気象データをインプットとし、ユーザー自身が設定した指示文（プロンプト）に基づいて生成AIが機械的に文章を出力する「シミュレーション・サポートツール」です。アプリ自体が独自の気象予測を行うものではありません。AIの出力結果の正確性・安全性を保証するものではありませんので、実際の農作業の決定は、必ずご自身の責任のもとで公式の気象警報・注意報を確認して行ってください。
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Leaf size={16} color="var(--accent-color)" />
            <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Orch.Weather</span>
          </div>
          <p style={{ margin: '0 0 0.5rem' }}>
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
            　<a href="/disclaimer.html" target="_blank" rel="noopener noreferrer">免責事項</a>
          </p>
          <p style={{ margin: '0 0 0.5rem' }}>
            気象データ提供：<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            　注意報・警報：<a href="https://www.jma.go.jp" target="_blank" rel="noopener noreferrer">気象庁</a>
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
      <Nav loading={loading} onLogin={handleLogin} />
      <Hero loading={loading} error={error} onLogin={handleLogin} onTryGuest={onTryGuest} />
      <BridgeSection />
      <SoraMoyoSection />
      <SoraKurabeSection />
      <SoraShirabeSection />
      <ComparisonSection />
      <TierComparisonSection />
      <MakerNote />
      <StepsSection />
      <FinalCta loading={loading} onLogin={handleLogin} />
      <LpFooter />
    </div>
  );
}
