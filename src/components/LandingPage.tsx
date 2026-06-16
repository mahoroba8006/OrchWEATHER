import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import {
  Leaf, ArrowRight, Quote, Sparkles, BarChart2, CloudSun, SlidersHorizontal, Sprout,
  Clock, Sun, CloudRain,
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
    w: 780, h: 744,
    alt: 'AI農作業アドバイスの画面',
  },
  {
    icon: BarChart2,
    eyebrow: '前年比較・積算',
    title: '「今年は早い？遅い？」が、数字でわかる。',
    body: '積算温度・降水量・日射量などを自動計算しグラフィカルに表示。比較したい年、登録地点を選択でき「去年より何日進んでいるか」「あの場所とどれくらい違うか」まで一目。',
    img: '/lp/feature-kurabe.webp',
    w: 1178, h: 1922,
    alt: '前年比較チャートの画面',
  },
  {
    icon: CloudSun,
    eyebrow: '時間ごとの空',
    title: '露点・飽差・0℃層高度まで、時間別に。',
    body: '気温と降水確率だけでは農作業の判断はできません。露点温度、飽差、0℃層高度（雹リスク）、大気安定度（落雷リスク）——農業に効く専門データを時間別に一覧表示。「あの日の空」機能では過去任意の日付も同じ画面で確認でき、失敗した作業の原因追跡にも役立ちます。',
    img: '/lp/feature-hourly.webp',
    w: 1165, h: 1959,
    alt: '時間別予報テーブルの画面',
  },
  {
    icon: SlidersHorizontal,
    eyebrow: 'じぶん好みAI',
    title: 'あなたの畑に合わせて、AIに聞ける。',
    body: '「標高が高いから2℃低めで考えて」「風に弱い作物がある」——自分の言葉で条件を登録すれば、AIがそれを踏まえて答えます。',
    img: '/lp/feature-custom.webp',
    w: 1167, h: 1830,
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
            <img src="/lp/hero-imanosora.webp" alt="空もよう — 時間ごとの空模様とAI提案の画面" width={780} height={1688} />
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
                    <img className="lp-shot" src={f.img} alt={f.alt} width={f.w} height={f.h} loading="lazy" />
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

function MarkCell({ mark, ours = false }: { mark: CompMark; ours?: boolean }) {
  const color = mark.m === '✓' ? 'var(--accent-color)' : mark.m === '△' ? '#d97706' : '#b3bcc9';
  return (
    <td className={ours ? 'lp-comp-ours' : undefined}>
      <span style={{ color, fontWeight: 800, fontSize: '1rem' }}>{mark.m}</span>
      {mark.note && <span className="lp-comp-note">{mark.note}</span>}
    </td>
  );
}

function FieldFeaturesSection() {
  return (
    <section className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-container">
        <FadeIn>
          <h2 className="lp-h2">農家の時間軸で、天気を読む。</h2>
          <p className="lp-lead" style={{ marginTop: '0.5rem' }}>
            ふつうの天気アプリは「消費者向け」に作られています。Orch.Weatherは、現場で使いながら磨いてきた3つのこだわりが違います。
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="lp-zigzag" style={{ marginTop: '2.2rem' }}>
            <div>
              <p style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem',
                margin: '0 0 0.7rem',
              }}>
                <Clock size={16} /> 作業の実態に合わせた3時間帯
              </p>
              <h3 style={{ fontSize: 'clamp(1.2rem, 3.2vw, 1.55rem)', fontWeight: 800, lineHeight: 1.5, margin: '0 0 0.8rem' }}>
                「午前中に防除したい」——<br />その時間帯だけを、確認できる。
              </h3>
              <p className="lp-lead" style={{ fontSize: '0.92rem', marginBottom: '1.6rem' }}>
                ふつうの天気予報は「今日」「明日」という一日単位。でも農作業は時間勝負です。防除は午前中が勝負、施肥は雨の前後が狙い目——Orch.Weatherは<strong>午前（4〜12時）・午後（12〜20時）・夜間（20〜翌4時）</strong>に分けて、それぞれの気温・降水量・風速を一画面に表示します。「何時から動けるか」を判断する時間を、ゼロにします。
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.3))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sun size={17} color="#d97706" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, margin: '0 0 0.25rem', fontSize: '0.93rem' }}>紫外線指数（UV）を時間別に表示</p>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.8 }}>
                      屋外で何時間も動く農家にとって、紫外線は見えにくいリスク。帽子だけでいいか、腕まで覆うべきか——UV指数が時間別に確認できるので、日焼け対策を前日から計画できます。
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(14,165,233,0.3))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CloudRain size={17} color="#0284c7" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, margin: '0 0 0.25rem', fontSize: '0.93rem' }}>「小雨」をさらに細かく——カッパ判断ラベル</p>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.8 }}>
                      一般の天気アプリが「小雨」でひとくくりにする3mm以下の雨を、Orch.Weatherはさらに3段階に分けます。0.5mm未満は<strong>ぽつぽつ</strong>（カッパ不要）、0.5〜1.5mmは<strong>カッパ？</strong>（迷う帯）、1.5〜3mmは<strong>カッパ！</strong>（着て動ける）。この一段階の細かさが、作業を続けるか切り上げるかの判断を変えます。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <img
                className="lp-shot"
                src="/lp/feature-daily.webp"
                alt="午前・午後・夜間の時間帯別天気予報画面"
                width={780}
                height={1400}
                loading="lazy"
              />
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
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
      <FieldFeaturesSection />
      <ComparisonSection />
      <StepsSection />
      <FinalCta loading={loading} onLogin={handleLogin} />
      <LpFooter />
    </div>
  );
}
