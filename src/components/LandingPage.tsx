import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import {
  Leaf, ArrowRight, Quote, Sparkles, BarChart2, CloudSun, SlidersHorizontal, Sprout,
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
   通常の iOS Safari ブラウザは signInWithPopup が使えるが、
   ホーム画面から起動した PWA モードではポップアップが OS レベルで
   ブロックされるため signInWithRedirect を使う必要がある。
───────────────────────────────────────── */
const isIOSStandalone = () =>
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

/* ─────────────────────────────────────────
   データ定義
───────────────────────────────────────── */
const pains = [
  {
    label: '去年との違いが見えない',
    quote: '「今年は暖かい気がする」けど、実際去年と比べてどれくらい違うのか、何日進んでいるか、数字で確認できない。',
  },
  {
    label: '今日か明日か、頭の中で計算',
    quote: '防除、散布、施肥…。今日できるか明日できるか、気温・降水確率・風速を一つずつ確認しながら考えている。',
  },
  {
    label: '自分の農場に合わせた提案が欲しい',
    quote: '「うちは標高が高いから予想気温から3℃は低くなる。」自分の持っている基準でアラートが出せたらいいのに。',
  },
];

const features = [
  {
    icon: Sparkles,
    eyebrow: 'AI農作業アドバイス',
    title: '「明日、散布できるか」に、答えが出る。',
    body: 'AIが気象データから作業できる時間帯と残るリスクをわかりやすく提案。あなたの判断をサポート。材料はすべてここに。',
    img: '/lp/feature-ai.webp',
    alt: 'AI農作業アドバイスの画面',
  },
  {
    icon: BarChart2,
    eyebrow: '前年比較・積算',
    title: '「今年は早い？遅い？」が、数字でわかる。',
    body: '積算温度・降水量・日射量などを自動計算しグラフィカルに表示。比較したい年、登録地点を選択でき「去年より何日進んでいるか」「あの場所とどれくらい違うか」まで一目。',
    img: '/lp/feature-kurabe.webp',
    alt: '前年比較チャートの画面',
  },
  {
    icon: CloudSun,
    eyebrow: '時間ごとの空',
    title: 'カッパが要るか、まで書いてある。',
    body: '降水量は「ぽつぽつ」「カッパ？」「カッパ！」。紫外線の強さも一目で。露点・飽差・0℃層高度など、作物に影響する専門データも時間別に確認でき、今日の作業の準備も万全。',
    img: '/lp/feature-hourly.webp',
    alt: '時間別予報テーブルの画面',
  },
  {
    icon: SlidersHorizontal,
    eyebrow: 'じぶん好みAI',
    title: 'あなたの畑に合わせて、AIに聞ける。',
    body: '「標高が高いから2℃低めで考えて」「風に弱い作物がある」——自分の言葉で条件を登録すれば、AIがそれを踏まえて答えます。',
    img: '/lp/feature-custom.webp',
    alt: 'じぶん好みプロンプト設定の画面',
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

function Hero({ loading, error, onLogin }: { loading: boolean; error: string | null; onLogin: () => void }) {
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
          <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0.7rem 0 0' }}>
            登録30秒・いまは完全無料
          </p>
          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.6rem' }}>{error}</p>}
        </FadeIn>
        <FadeIn delay={0.15} style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="lp-phone">
            {/* width/height は Task 7 で実画像の寸法に更新する */}
            <img src="/lp/hero-imanosora.webp" alt="いまの空 — 時間ごとの空模様とAI提案の画面" width={780} height={1688} />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function PainSection() {
  return (
    <section className="lp-section" style={{ paddingBottom: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
      <div className="lp-container">
        <FadeIn>
          <h2 className="lp-h2">農家の気象データ活用、こんな悩みはありませんか</h2>
        </FadeIn>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.1rem',
          marginTop: '1.8rem',
        }}>
          {pains.map((p, i) => (
            <FadeIn key={p.label} delay={i * 0.1}>
              <div className="lp-glass" style={{ padding: '1.4rem 1.3rem', height: '100%', boxSizing: 'border-box' }}>
                <Quote size={18} color="var(--accent-color)" style={{ marginBottom: '0.6rem' }} />
                <p style={{ fontWeight: 700, margin: '0 0 0.55rem', fontSize: '0.98rem' }}>{p.label}</p>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.85 }}>{p.quote}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

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

function FeaturesSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-container">
        <FadeIn>
          <h2 className="lp-h2">画面を見れば、今日やることが決まる。</h2>
        </FadeIn>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(2.5rem, 7vw, 4.5rem)',
          marginTop: '2.2rem',
        }}>
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <FadeIn key={f.title}>
                <div className={i % 2 === 1 ? 'lp-zigzag lp-zigzag--reverse' : 'lp-zigzag'}>
                  <div>
                    <p style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem',
                      margin: '0 0 0.7rem',
                    }}>
                      <Icon size={16} /> {f.eyebrow}
                    </p>
                    <h3 style={{
                      fontSize: 'clamp(1.2rem, 3.2vw, 1.55rem)', fontWeight: 800,
                      lineHeight: 1.5, margin: '0 0 0.8rem',
                    }}>
                      {f.title}
                    </h3>
                    <p className="lp-lead" style={{ fontSize: '0.92rem' }}>{f.body}</p>
                  </div>
                  <div>
                    {/* width/height は Task 7 で実画像の寸法に更新する */}
                    <img className="lp-shot" src={f.img} alt={f.alt} width={800} height={600} loading="lazy" />
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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
export function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isIOSStandalone()) {
        // iOS PWA モード: ポップアップが OS レベルでブロックされるためリダイレクト方式
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } else {
        // 通常ブラウザ（iOS Safari 含む）: ポップアップ方式
        // iOS Safari で signInWithRedirect を使うと ITP により認証ステートが
        // リダイレクト後に失われ LP に戻ってしまうバグがあるため popup を使用
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        // ポップアップがブロックされた場合はリダイレクト方式にフォールバック
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
      <Hero loading={loading} error={error} onLogin={handleLogin} />
      <PainSection />
      <MakerNote />
      <FeaturesSection />
      {/* INSERT: ComparisonSection / StepsSection / FinalCta (Task 5) */}
      <LpFooter />
    </div>
  );
}

void compRows; void steps; // Task 5 完了時に削除
