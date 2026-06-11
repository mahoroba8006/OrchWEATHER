import { useState, useEffect, useRef, type ReactNode } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import {
  Leaf, CloudSun, Droplets, AlertTriangle,
  BarChart2, MapPin, FileDown, Shovel, Sprout, ArrowRight,
  Check, X, SlidersHorizontal, Quote, Clock, Umbrella, Zap,
} from 'lucide-react';
import { auth } from '../lib/firebase';

/* ─────────────────────────────────────────
   カラーパレット
───────────────────────────────────────── */
const C = {
  primary:     '#51c49f',
  primaryDark: '#0f8a66',
  primaryBg:   '#d4f5ec',
  sky:         '#2563eb',
  skyBg:       '#dbeafe',
  amber:       '#d97706',
  amberBg:     '#fef3c7',
  bg:          '#f0faf7',
  surface:     '#ffffff',
  text:        '#0c2118',
  textSub:     '#4b6b5a',
  border:      '#c8e6d8',
};

/* ─────────────────────────────────────────
   スクロールフェードイン
───────────────────────────────────────── */
function FadeIn({ children, delay = 0, style }: {
  children: ReactNode;
  delay?: number;
  style?: React.CSSProperties;
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
   iOS 判定
───────────────────────────────────────── */
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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

const reasons = [
  {
    num: 1,
    title: 'もう計算ツールはいらない。前年比較も積算も自動で見える化',
    points: [
      '前年や別の圃場のデータをグラフで並べて比較。「今年は去年より何日進んでいるか」が数字で一目瞭然。',
      '積算温度だけでなく、降水量・日射量・日照時間も積算開始日を自由に設定して自動集計。比較チャートですぐ確認できる。',
    ],
  },
  {
    num: 2,
    title: '農業のプロが欲しい「専門気象データ」を網羅',
    points: [
      '飽差、露点温度、気圧、CAPE、0℃層高度など、一般アプリにはない農業専用データを網羅。',
      '現場目線の表示にもこだわり。紫外線指数や時間別の「カッパ要否ラベル」で、屋外作業の判断を現場でサポート。',
    ],
  },
  {
    num: 3,
    title: 'AIが「あなたの畑の専属アドバイザー」になる',
    points: [
      '発表された気象データを元に、AIが「防除・散布のタイミング」「施肥の適期」「今日の畑仕事の注意点」「天候リスクへの備え」をわかりやすく解説。',
      'プロンプト機能で「自分好みの言い回し」や「自身の農園の特性」を踏まえた回答にカスタマイズ可能。',
    ],
  },
];

const features = [
  {
    icon: <CloudSun size={22} />,
    color: C.amber,
    bg: C.amberBg,
    title: 'AI が農作業アドバイスを自動生成',
    desc: '散布・施肥・畑しごと・天気の備え——5つの視点から72時間のデータを読み解き、「今日は何時まで散布できるか」を具体的な数値根拠とともに提案。判断材料を届ける「偵察役」として毎朝自動生成します。',
  },
  {
    icon: <BarChart2 size={22} />,
    color: '#7c3aed',
    bg: '#ede9fe',
    title: '積算データを自動計算して前年・他圃場と比較',
    desc: '積算温度（GDD）・降水量・日射量・日照時間を、開始日と基準温度を設定するだけで自動集計。前年・他圃場のチャートと重ねれば、「今年は生育が3日早い」「今年は日射が少ない」が感覚ではなく数字でわかります。',
  },
  {
    icon: <Clock size={22} />,
    color: C.sky,
    bg: C.skyBg,
    title: 'あの失敗の原因を、気象データで追う',
    desc: '「あの日なぜ病気が出たか」「あの散布はなぜ効かなかったか」——任意の日付を指定して、その日の気象を1時間ごとに参照。過去の作業と気象を照合すれば、失敗の原因が明確になります。気づきをAIのカスタムプロンプトに活用すれば、次の判断の精度がさらに上がります。',
  },
  {
    icon: <FileDown size={22} />,
    color: C.primaryDark,
    bg: C.primaryBg,
    title: 'データをそのまま手元に持ち出せる',
    desc: '表示中のすべてのデータをワンクリックでCSV出力。スプレッドシートへの貼り付けや、作業日誌・防除記録との照合にそのまま使えます。',
  },
  {
    icon: <Zap size={22} />,
    color: '#dc2626',
    bg: '#fee2e2',
    title: '雷雨・霜・雹のリスクを読む「深読みデータ」',
    desc: '露点温度・CAPE・0℃層高度など、一般アプリには表示されない専門値を網羅。「今日は雹の可能性があるか」「霜が降りる条件か」——農作業の判断基準になる数値を、現場目線で確認できます。',
  },
  {
    icon: <Umbrella size={22} />,
    color: '#0284c7',
    bg: '#e0f2fe',
    title: '「カッパは要るか」「日焼け止めは要るか」が一目でわかる',
    desc: '時間別降水量を「ぽつぽつ」「カッパ？」「カッパ！」「本降り」など現場感覚に合わせたラベルで表示。紫外線指数も時間ごとに確認でき、屋外で長時間働く農家の体を守る準備を直感的に判断できます。',
  },
];

const aiSections = [
  { icon: <CloudSun size={18} />,     label: '空ごよみ',   desc: '天気の概況と注目ポイント' },
  { icon: <Shovel size={18} />,       label: '畑しごと',   desc: '外作業・土仕事のアドバイス' },
  { icon: <Droplets size={18} />,     label: '散布どき',   desc: '農薬・液肥の散布適期と時間帯' },
  { icon: <Sprout size={18} />,       label: '施肥どき',   desc: '施肥・肥料まきの適期と注意点' },
  { icon: <AlertTriangle size={18} />, label: '天気の備え', desc: '悪天候への対処と注意点' },
];

const comparisons = [
  { feature: '飽差（VPD）表示',     orch: true,  general: false, jma: false },
  { feature: '積算温度（GDD）自動計算', orch: true, general: false, jma: false },
  { feature: 'AI農作業アドバイス',  orch: true,  general: false, jma: false },
  { feature: '前年との気象比較',    orch: true,  general: false, jma: '手作業が必要' },
  { feature: '気象庁警報の統合表示', orch: true,  general: '△',  jma: true },
  { feature: 'CSVエクスポート',     orch: true,  general: false, jma: false },
  { feature: '複数地点管理',        orch: true,  general: '△',  jma: false },
];

const steps = [
  {
    icon: <Leaf size={28} />,
    title: 'Googleアカウントでログイン',
    desc: '設定やお気に入り地点が複数デバイスで自動同期。登録は30秒で完了します。',
  },
  {
    icon: <MapPin size={28} />,
    title: '圃場の地点を登録',
    desc: '地図上でタップ、またはGPS取得で座標を登録。気象庁連携で警報エリアも自動設定されます。',
  },
  {
    icon: <CloudSun size={28} />,
    title: '農業専用データをすぐ活用',
    desc: 'VPD・積算温度・AIアドバイス・気象庁警報が即日表示。CSVで持ち出しも可能です。',
  },
];

/* ─────────────────────────────────────────
   チェック / バツ セル
───────────────────────────────────────── */
function CompCell({ val }: { val: boolean | string }) {
  if (val === true)  return <span style={{ color: C.primaryDark, fontWeight: 700 }}><Check size={18} /></span>;
  if (val === false) return <span style={{ color: '#9ca3af' }}><X size={18} /></span>;
  return <span style={{ color: '#9ca3af', fontSize: 13 }}>{val}</span>;
}

/* ─────────────────────────────────────────
   メインコンポーネント
───────────────────────────────────────── */
export function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isIOS()) {
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
    } catch {
      setError('ログインに失敗しました。もう一度お試しください。');
      setLoading(false);
    }
  };

  const LoginBtn = ({ large = false }: { large?: boolean }) => (
    <button
      onClick={handleLogin}
      disabled={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: large ? '0.9rem 2rem' : '0.7rem 1.4rem',
        fontSize: large ? '1.05rem' : '0.95rem',
        fontWeight: 700,
        background: C.primary,
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        boxShadow: '0 2px 12px rgba(81,196,159,0.35)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 18px rgba(81,196,159,0.45)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = '';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(81,196,159,0.35)';
      }}
    >
      {/* Google G mark */}
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      {loading ? 'ログイン中...' : 'Googleアカウントで無料で始める'}
      {!loading && <ArrowRight size={16} />}
    </button>
  );

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>

      {/* ─── NAV ─── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(240,250,247,0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Leaf size={22} color={C.primary} />
          <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            Orch.<span style={{ color: C.primary }}>Weather</span>
          </span>
        </div>
        <LoginBtn />
      </nav>

      {/* ─── HERO ─── */}
      <section style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: 'clamp(3rem, 8vw, 6rem) 1.5rem clamp(2rem, 5vw, 4rem)',
        textAlign: 'center',
      }}>
        <FadeIn>
          <div style={{
            display: 'inline-block',
            background: C.primaryBg,
            color: C.primaryDark,
            fontSize: 13,
            fontWeight: 700,
            padding: '4px 14px',
            borderRadius: 999,
            marginBottom: '1.25rem',
            letterSpacing: '0.03em',
          }}>
            農家が現場で作った気象データ活用ツール
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5.5vw, 3.2rem)',
            fontWeight: 900,
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            margin: '0 0 1.25rem',
          }}>
            今日できるか、すぐわかる。<br />
            <span style={{ color: C.primary }}>去年と比べて、数字で見える。</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.15rem)',
            color: C.textSub,
            lineHeight: 1.75,
            maxWidth: 580,
            margin: '0 auto 2rem',
          }}>
            「散布できるか」「施肥はいつか」——毎日の判断をデータが代わりに出す。前年との違いも積算温度も、ひとつのツールで数字として確認できます。
          </p>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <LoginBtn large />
            {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{error}</p>}
            <p style={{ fontSize: 12, color: C.textSub, margin: 0 }}>完全無料・クレジットカード不要</p>
          </div>
        </FadeIn>

        {/* スクリーンショットプレースホルダー */}
        <FadeIn delay={0.2}>
          <div style={{
            marginTop: 'clamp(2rem, 5vw, 3.5rem)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 12px 48px rgba(15,138,102,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            border: `1px solid ${C.border}`,
            background: '#e8f5f0',
            minHeight: 240,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.textSub,
            fontSize: 14,
          }}>
            {/* 画面ショット追加予定 */}
            <span style={{ opacity: 0.5 }}>スクリーンショット</span>
          </div>
        </FadeIn>
      </section>

      {/* ─── PAIN ─── */}
      <section style={{ background: C.surface, padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <FadeIn>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.primary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Problem
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 800, margin: '0 0 2.5rem', letterSpacing: '-0.02em' }}>
              農家の気象データ活用、<wbr />こんな課題はありませんか
            </h2>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {pains.map((p, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '1.5rem',
                }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.primary, margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.label}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <Quote size={16} color={C.primaryDark} style={{ flexShrink: 0, marginTop: 3 }} />
                    <p style={{ color: C.text, fontSize: '0.95rem', lineHeight: 1.75, margin: 0, fontStyle: 'italic' }}>{p.quote}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SOLUTION ─── */}
      <section style={{ padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <FadeIn>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.primary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Solution
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 800, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
              判断に迷わず、いきあたりばったりを卒業する。
            </h2>
            <p style={{ textAlign: 'center', color: C.textSub, fontSize: '0.95rem', margin: '0 auto 2.5rem', maxWidth: 520 }}>
              毎日の判断にかかる時間を削り、前年との比較を数字で確認できる。現場から生まれた3つの機能が、農業の「勘頼み」をデータに変えます。
            </p>
          </FadeIn>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {reasons.map((r, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: 'clamp(1.25rem, 3vw, 2rem)',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 46, height: 46,
                    background: C.primary,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '1.15rem',
                    flexShrink: 0,
                  }}>
                    {r.num}
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '1.02rem', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
                      理由{r.num}：{r.title}
                    </p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {r.points.map((pt, j) => (
                        <li key={j} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <Check size={15} color={C.primary} style={{ flexShrink: 0, marginTop: 4 }} />
                          <span style={{ color: C.textSub, fontSize: '0.9rem', lineHeight: 1.75 }}>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{ padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <FadeIn>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.primary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Features
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 800, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
              農業従事者に必要な機能が、ここにある
            </h2>
            <p style={{ textAlign: 'center', color: C.textSub, fontSize: '0.95rem', margin: '0 auto 2.5rem', maxWidth: 520 }}>
              一般の天気アプリにはない農業専用の指標と、現場の判断を支えるAIアドバイスを搭載しています。
            </p>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {features.map((f, i) => (
              <FadeIn key={i} delay={i * 0.07}>
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '1.5rem',
                  height: '100%',
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    width: 42, height: 42,
                    background: f.bg,
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: f.color,
                    marginBottom: '1rem',
                  }}>
                    {f.icon}
                  </div>
                  <p style={{ fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.97rem' }}>{f.title}</p>
                  <p style={{ color: C.textSub, fontSize: '0.875rem', lineHeight: 1.75, margin: 0 }}>{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI SPOTLIGHT ─── */}
      <section style={{ background: C.surface, padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2.5rem',
            alignItems: 'center',
          }}>
            <FadeIn>
              <div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: C.amberBg, color: C.amber,
                  fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                  marginBottom: '1rem',
                }}>
                  <CloudSun size={14} /> AI農作業アドバイス
                </div>
                <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, lineHeight: 1.3, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
                  「明日、散布できるか。施肥のタイミングは。」<br />
                  <span style={{ color: C.primary }}>AIが気象データから提案する。</span>
                </h2>
                <p style={{ color: C.textSub, lineHeight: 1.8, fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
                  気象データをもとに、AIが農薬散布の適期から、施肥・肥料まきのタイミング、外作業の注意点まで、具体的な時間帯・注意事項を提案します。
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {aiSections.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: '0.75rem',
                    }}>
                      <span style={{ color: C.primaryDark, marginTop: 1 }}>{s.icon}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', margin: '0 0 2px' }}>{s.label}</p>
                        <p style={{ color: C.textSub, fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              {/* スクリーンショットプレースホルダー */}
              <div style={{
                background: '#fef9ec',
                border: `1px solid #fde68a`,
                borderRadius: 16,
                minHeight: 280,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#a37b00', fontSize: 14,
              }}>
                <span style={{ opacity: 0.5 }}>AIコメントのスクリーンショット</span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── CUSTOM PROMPT SPOTLIGHT ─── */}
      <section style={{ padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2.5rem',
            alignItems: 'center',
          }}>
            <FadeIn>
              <div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: C.primaryBg, color: C.primaryDark,
                  fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                  marginBottom: '1rem',
                }}>
                  <SlidersHorizontal size={14} /> あなた専用プロンプト
                </div>
                <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, lineHeight: 1.3, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
                  天気の「生データ」を、<br />
                  <span style={{ color: C.primary }}>あなた専用の右腕に。</span>
                </h2>
                <p style={{ color: C.textSub, lineHeight: 1.8, fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
                  一般的な天気アプリは、決まりきった情報しか教えてくれません。しかし、育てる作物も、畑の標高も、農家としてのこだわりも、十人十色のはずです。
                </p>
                <p style={{ color: C.textSub, lineHeight: 1.8, fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
                  あなた自身の栽培ルールや好みのトーンを指示文（プロンプト）として入力しておくだけで、世界にひとつだけの「あなた専用の営農アドバイザー」が完成します。公式データをどう料理するかは、あなたの自由です。
                </p>
                {/* 例文 吹き出し */}
                {[
                  '「うちは標高が高くて霜が怖いから、最低気温5℃以下で大袈裟にアラートを出してほしい」',
                  '「降水量、風速、時間帯、など自分の持っている基準に一致する作業のタイミングを提案してほしい」',
                  '「親しみやすい言葉で、作業のモチベーションの上がる一言を添えてほしい」',
                ].map((ex, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '0.75rem',
                    background: C.primaryBg,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${C.primary}`,
                    borderRadius: '0 10px 10px 0',
                    padding: '0.75rem 1rem',
                    marginBottom: i < 2 ? '0.6rem' : 0,
                  }}>
                    <Quote size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ color: C.text, fontSize: '0.85rem', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>{ex}</p>
                  </div>
                ))}
                {/* インライン免責メモ */}
                <p style={{ color: C.textSub, fontSize: '0.75rem', lineHeight: 1.6, marginTop: '1rem', opacity: 0.8 }}>
                  ※ AIの出力は気象庁等の公式データをインプットとした参考情報です。実際の農作業の判断はご自身の責任のもとで行ってください。
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              {/* スクリーンショットプレースホルダー */}
              <div style={{
                background: C.primaryBg,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                minHeight: 300,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.textSub, fontSize: 14,
              }}>
                <span style={{ opacity: 0.5 }}>カスタムプロンプト設定のスクリーンショット</span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── WARNING SPOTLIGHT ─── */}
      <section style={{ padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2.5rem',
            alignItems: 'center',
          }}>
            <FadeIn>
              {/* スクリーンショットプレースホルダー */}
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 16,
                minHeight: 260,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9f1239', fontSize: 14,
                order: 0,
              }}>
                <span style={{ opacity: 0.5 }}>警報ガントチャートのスクリーンショット</span>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: C.primaryBg, color: C.primaryDark,
                  fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                  marginBottom: '1rem',
                }}>
                  <Leaf size={14} /> 現場目線の機能
                </div>
                <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, lineHeight: 1.3, margin: '0 0 1.2rem', letterSpacing: '-0.02em' }}>
                  農業の現場だから<br />
                  <span style={{ color: C.primary }}>わかる機能。</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {[
                    { emoji: '🌧', title: '降水量は「言葉」で伝える', desc: '「カッパ！」「本降り」など、雨具の準備要否がひと目でわかる表現に変換。細かい降水量の刻みで作業判断をサポートします。' },
                    { emoji: '☀', title: '紫外線指数を時間ごとに表示', desc: '夏場の農作業に欠かせない、時間帯ごとの紫外線指数をリアルタイムで表示。日焼け・熱中症対策の参考に。' },
                    { emoji: '💨', title: '瞬間風速で突風を見逃さない', desc: '平均風速だけでなく、瞬間風速も表示。散布タイミングや支柱・ハウスの養生判断に役立ちます。' },
                  ].map(item => (
                    <div key={item.title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.3rem', lineHeight: 1, marginTop: '0.1rem' }}>{item.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{item.title}</div>
                        <div style={{ color: C.textSub, fontSize: '0.82rem', lineHeight: 1.7 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ─── */}
      <section style={{ background: C.surface, padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <FadeIn>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.primary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Comparison
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 800, margin: '0 0 2rem', letterSpacing: '-0.02em' }}>
              一般の天気アプリとの違い
            </h2>
          </FadeIn>
          <FadeIn delay={0.05}>
            <div style={{
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700, borderBottom: `1px solid ${C.border}`, color: C.textSub, fontSize: '0.8rem' }}>機能</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, borderBottom: `1px solid ${C.border}`, color: C.primaryDark, fontSize: '0.85rem', minWidth: 110 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Leaf size={14} />Orch.Weather
                      </span>
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, borderBottom: `1px solid ${C.border}`, color: C.textSub, fontSize: '0.8rem' }}>一般の天気アプリ</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, borderBottom: `1px solid ${C.border}`, color: C.textSub, fontSize: '0.8rem' }}>気象庁サイト</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? C.surface : C.bg }}>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, fontWeight: 500 }}>{row.feature}</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                        <CompCell val={row.orch} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                        <CompCell val={row.general} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                        <CompCell val={row.jma} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{ padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <FadeIn>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.primary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              How it works
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 800, margin: '0 0 2.5rem', letterSpacing: '-0.02em' }}>
              3ステップで使い始める
            </h2>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 0.09}>
                <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                  <div style={{
                    width: 64, height: 64,
                    background: C.primaryBg,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: C.primaryDark,
                    margin: '0 auto 1rem',
                    fontSize: '1.5rem',
                    fontWeight: 900,
                  }}>
                    {s.icon}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    background: C.primaryBg, color: C.primaryDark,
                    fontSize: 11, fontWeight: 800,
                    padding: '2px 10px', borderRadius: 999,
                    marginBottom: '0.5rem',
                  }}>
                    STEP {i + 1}
                  </div>
                  <p style={{ fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.97rem' }}>{s.title}</p>
                  <p style={{ color: C.textSub, fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section style={{ background: C.surface, padding: 'clamp(3rem, 7vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <FadeIn>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.primary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Pricing
            </p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 800, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
              完全無料でご利用いただけます
            </h2>
            <p style={{ color: C.textSub, lineHeight: 1.8, marginBottom: '2rem' }}>
              Open-Meteoと気象庁の公開データを活用しているため、すべての機能を無料でご利用いただけます。AI農作業アドバイス機能も追加費用なしで利用可能です。
            </p>
            <div style={{
              border: `2px solid ${C.primary}`,
              borderRadius: 16,
              padding: '2rem',
              background: C.bg,
            }}>
              <p style={{ fontSize: '2.5rem', fontWeight: 900, color: C.primaryDark, margin: '0 0 0.25rem' }}>¥0</p>
              <p style={{ color: C.textSub, fontSize: '0.9rem', margin: '0 0 1.5rem' }}>クレジットカード不要・登録は30秒</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', textAlign: 'left' }}>
                {['飽差・積算温度・日射量の自動計算', 'AI農作業アドバイス（5セクション）', '気象庁注意報・警報のリアルタイム表示', '前年との気象比較チャート', '複数地点の登録と管理', 'CSVエクスポート'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0', fontSize: '0.9rem' }}>
                    <Check size={16} color={C.primaryDark} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{
        background: `linear-gradient(135deg, ${C.primaryDark} 0%, #0d6e55 50%, #0a5a45 100%)`,
        padding: 'clamp(3rem, 8vw, 5rem) 1.5rem',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <FadeIn>
            <div style={{
              width: 56, height: 56,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <Leaf size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, color: '#fff', margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
              今日から、気象データを農業の武器に。
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: '2rem', fontSize: '0.95rem' }}>
              飽差・積算温度・AIアドバイスがすぐ使える。Googleアカウントだけで、すぐに始められます。
            </p>
            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.95rem 2.2rem',
                fontSize: '1.05rem',
                fontWeight: 800,
                background: '#fff',
                color: C.primaryDark,
                border: 'none',
                borderRadius: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {loading ? 'ログイン中...' : 'Googleアカウントで無料で始める'}
              {!loading && <ArrowRight size={16} />}
            </button>
            {error && <p style={{ color: 'rgba(255,200,200,1)', fontSize: '0.875rem', marginTop: '0.75rem' }}>{error}</p>}
          </FadeIn>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        background: '#081a10',
        color: 'rgba(255,255,255,0.5)',
        padding: '2.5rem 1.5rem 2rem',
        fontSize: '0.82rem',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* 免責事項 */}
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
          {/* ロゴ・リンク */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Leaf size={16} color={C.primary} />
              <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Orch.Weather</span>
            </div>
            <p style={{ margin: '0 0 0.5rem' }}>
              気象データ提供：<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)' }}>Open-Meteo</a>
              　注意報・警報：<a href="https://www.jma.go.jp" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)' }}>気象庁</a>
            </p>
            <p style={{ margin: 0 }}>© 2025 Orch.Weather — Orchシリーズ農業専用ツール</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
