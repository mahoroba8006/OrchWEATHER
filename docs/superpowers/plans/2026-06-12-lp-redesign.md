# LP全面ブラッシュアップ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LP（LandingPage.tsx）を13セクション→9セクションに再編し、アプリ本体のティール＋ガラスモーフィズムにデザイン統一、実機スクリーンショット5枚を組み込み、Safari互換性問題を解消する。

**Architecture:** スペック `docs/superpowers/specs/2026-06-12-lp-redesign-design.md` 準拠。繰り返しスタイルは新規 `src/landing.css` のクラスに抽出（`-webkit-` prefix一元管理）、一回限りのレイアウトはインラインstyleのまま。`LandingPage.tsx` は1ファイル構成を維持し、内部セクションコンポーネントに分割。

**Tech Stack:** React 19 + TypeScript + Vite。テストランナーは無いため、各タスクの検証は `npx tsc --noEmit` ＋ `npm run build` ＋ Chrome目視。

**重要な保護対象（壊してはならない既存実装）:**
- `handleLogin` のiOS Safari対応ロジック（コミット `4bb30ae`）: 通常ブラウザ=`signInWithPopup`、iOS PWA standalone=`signInWithRedirect`、`auth/popup-blocked` 時はredirectフォールバック
- フッターの免責文・データ提供元クレジット（文言変更禁止）
- Pain 3引用の文言（現行維持と決定済み）
- Hero H1の文言（現行維持と決定済み）

---

### Task 1: `src/landing.css` 作成

**Files:**
- Create: `src/landing.css`

- [ ] **Step 1: ファイルを作成**

```css
/* ─────────────────────────────────────────
   LP専用スタイル（LandingPage.tsx からのみ使用）
   Safari対応の -webkit- prefix はこのファイルで一元管理する
───────────────────────────────────────── */

.lp-root {
  min-height: 100vh;
  min-height: 100svh; /* iOS Safari アドレスバー対策（対応ブラウザで上書き） */
  background: var(--bg-gradient);
  color: var(--text-primary);
  font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
  overflow-x: hidden;
}

.lp-nav {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.78);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--card-border);
}

.lp-nav-inner {
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
}

.lp-section { padding: clamp(3rem, 8vw, 5.5rem) 1.25rem; }
.lp-container { max-width: 1000px; margin: 0 auto; }
.lp-container-narrow { max-width: 760px; margin: 0 auto; }

.lp-h2 {
  font-size: clamp(1.45rem, 4vw, 2.1rem);
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: 0.01em;
  margin: 0 0 0.9rem;
  text-align: center;
}

.lp-lead {
  color: var(--text-secondary);
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  line-height: 1.95;
  margin: 0;
}

.lp-glass {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

/* CTA（アプリのアクティブタブと同じグラデーション言語） */
.lp-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
  color: #ffffff;
  font-weight: 700;
  font-family: inherit;
  border: none;
  border-radius: 999px;
  padding: 0.8rem 1.7rem;
  font-size: 0.98rem;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(13, 148, 136, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.lp-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(13, 148, 136, 0.35); }
.lp-cta:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
.lp-cta--small { padding: 0.5rem 1.1rem; font-size: 0.85rem; }

/* HERO のスマホフレーム（CSS描画・画像はフレームなしの素のスクショ） */
.lp-phone {
  width: min(300px, 78vw);
  margin: 0 auto;
  border-radius: 40px;
  border: 9px solid #11403a;
  background: #11403a;
  box-shadow: var(--shadow-lg), 0 28px 64px rgba(13, 148, 136, 0.2);
  overflow: hidden;
}
.lp-phone img { display: block; width: 100%; height: auto; }

/* 機能ショーケース（ジグザグ） */
.lp-zigzag {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: clamp(1.5rem, 4vw, 3rem);
}
.lp-zigzag--reverse { flex-direction: row-reverse; }
.lp-zigzag > div { flex: 1 1 340px; min-width: 0; }

.lp-shot {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-lg);
  background: var(--card-bg-solid);
}

/* 比較表（モバイルは横スクロール） */
.lp-comp {
  width: 100%;
  min-width: 560px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.84rem;
}
.lp-comp th, .lp-comp td {
  padding: 0.7rem 0.6rem;
  text-align: center;
  border-bottom: 1px solid var(--card-border-sub);
  vertical-align: middle;
}
.lp-comp th { font-weight: 700; }
.lp-comp tr:last-child td { border-bottom: none; }
.lp-comp td:first-child, .lp-comp th:first-child { text-align: left; font-weight: 600; }
.lp-comp-ours { background: rgba(13, 148, 136, 0.07); font-weight: 600; }
.lp-comp-note {
  display: block;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-top: 0.2rem;
  line-height: 1.5;
}

/* FINAL CTA 帯 */
.lp-final {
  background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
  color: #ffffff;
  text-align: center;
}

/* フッター */
.lp-footer {
  background: #07221c;
  color: rgba(255, 255, 255, 0.5);
  padding: 2.5rem 1.5rem 2rem;
  font-size: 0.82rem;
}
.lp-footer a { color: rgba(255, 255, 255, 0.55); }
```

- [ ] **Step 2: ビルド確認（既存コードに影響なし）**

Run: `npx tsc --noEmit; npm run build`
Expected: 両方成功（cssはまだどこからもimportされていないため当然成功）

- [ ] **Step 3: Commit**

```bash
git add src/landing.css
git commit -m "feat(lp): LP専用スタイルシートを追加（-webkit- prefix一元管理）"
```

---

### Task 2: `LandingPage.tsx` 全面書き換え — 基礎＋NAV/HERO/FOOTER

**Files:**
- Modify: `src/components/LandingPage.tsx`（全置換。938行 → 本タスク完了時点で約300行）

**注意:** 旧ファイルの `C` パレット定数・`reasons`・`features`・`aiSections`・`comparisons`・`steps` データ・全セクションJSXは破棄する。`FadeIn`・`isIOSStandalone`・`handleLogin`・`pains`・フッター文言は下記コードの通り**保持**する。

- [ ] **Step 1: ファイル全体を以下の内容に置き換える**

```tsx
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
      {/* INSERT: PainSection / MakerNote (Task 3) */}
      {/* INSERT: FeaturesSection (Task 4) */}
      {/* INSERT: ComparisonSection / StepsSection / FinalCta (Task 5) */}
      <LpFooter />
    </div>
  );
}
```

**注:** `features` / `compRows` / `steps` / `Quote` import はこの時点では未使用のためTS6133エラーになる。Step 2のビルドでは**未使用警告の出るデータ定義とimportを一時的にコメントアウトせず**、`tsc` エラーを避けるため、本タスクでは `features`・`compRows`・`steps` の定義と `Quote, Sparkles, BarChart2, CloudSun, SlidersHorizontal` のimportを**Task 4/5実装時に追加する方式でもよい**。ただし推奨は「Task 2で上記コード全文をそのまま入れ、未使用エラーが出た識別子のみ `// @ts-expect-error` ではなく**一時的に `void features; void compRows; void steps;` をファイル末尾に追加**して回避し、Task 5完了時に削除」する方法（データ定義の二度書きを防ぐ）。

- [ ] **Step 2: 型チェック・ビルド**

Run: `npx tsc --noEmit; npm run build`
Expected: 成功。未使用エラーが出た場合は上記の `void` 文で回避（Task 5で削除すること）

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(lp): LP再構築の基礎 — NAV/HERO/FOOTERをティール統一デザインで実装"
```

---

### Task 3: PAIN ＋ MAKER'S NOTE セクション追加

**Files:**
- Modify: `src/components/LandingPage.tsx`

- [ ] **Step 1: `LpFooter` 定義の直前に以下の2コンポーネントを追加**

```tsx
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
```

- [ ] **Step 2: `LandingPage` の `{/* INSERT: PainSection / MakerNote (Task 3) */}` を以下に置換**

```tsx
      <PainSection />
      <MakerNote />
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npx tsc --noEmit; npm run build`
Expected: 成功

- [ ] **Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(lp): PAINセクションとMAKER'S NOTE（現場発ストーリー）を追加"
```

---

### Task 4: FEATURES ジグザグセクション追加

**Files:**
- Modify: `src/components/LandingPage.tsx`

- [ ] **Step 1: `LpFooter` 定義の直前に以下を追加**

```tsx
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
```

- [ ] **Step 2: `LandingPage` の `{/* INSERT: FeaturesSection (Task 4) */}` を以下に置換**

```tsx
      <FeaturesSection />
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npx tsc --noEmit; npm run build`
Expected: 成功（`void features;` を使っていた場合はこのタスクで削除）

- [ ] **Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(lp): FEATURESジグザグショーケース（4行・スクショ枠付き）を追加"
```

---

### Task 5: COMPARISON ＋ HOW TO START ＋ FINAL CTA 追加

**Files:**
- Modify: `src/components/LandingPage.tsx`

- [ ] **Step 1: `LpFooter` 定義の直前に以下の3コンポーネント＋1ヘルパーを追加**

```tsx
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
```

- [ ] **Step 2: `LandingPage` の `{/* INSERT: ComparisonSection / StepsSection / FinalCta (Task 5) */}` を以下に置換**

```tsx
      <ComparisonSection />
      <StepsSection />
      <FinalCta loading={loading} onLogin={handleLogin} />
```

- [ ] **Step 3: `void` 回避文が残っていれば削除し、型チェック・ビルド**

Run: `npx tsc --noEmit; npm run build`
Expected: 成功・未使用識別子なし

- [ ] **Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(lp): 比較表・3ステップ・FINAL CTAを追加しLP再構築を完了"
```

---

### Task 6: Chrome 表示確認（スクショ組み込み前）

**Files:** なし（確認のみ。問題があれば該当ファイルを修正）

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`（バックグラウンド）
Expected: `http://localhost:5173` で起動

- [ ] **Step 2: 以下のチェックリストをChromeで確認**

モバイル表示（DevTools Device Mode 390×844）と PC 表示（1280px）の両方で：
- [ ] 全9セクションが順番どおり表示される（画像はまだ404でalt枠表示＝想定どおり）
- [ ] NAVがスクロール時に上部固定され、背景がぼける
- [ ] CTAボタン3箇所（NAV/HERO/FINAL）がティールグラデーション（FINALは白）
- [ ] 比較表がモバイルで横スクロールできる
- [ ] ジグザグがモバイルでは縦積み（テキスト→画像の順）になる
- [ ] フォントがOutfit（英数字の見た目がアプリ本体と同じ）
- [ ] 横スクロールバーが出ない（overflow-x汚染なし）

- [ ] **Step 3: 問題があれば修正してコミット**

```bash
git add -A src/
git commit -m "fix(lp): 表示確認で見つかったレイアウト問題を修正"
```

（問題がなければこのコミットは不要）

---

### Task 7: スクリーンショット撮影・組み込み（※メインセッションで実施・ユーザー協力必須）

**Files:**
- Create: `public/lp/hero-imanosora.webp`
- Create: `public/lp/feature-ai.webp`
- Create: `public/lp/feature-kurabe.webp`
- Create: `public/lp/feature-hourly.webp`
- Create: `public/lp/feature-custom.webp`
- Modify: `src/components/LandingPage.tsx`（imgのwidth/height実寸更新）

**このタスクはサブエージェントに委任しないこと。** Googleログイン・画面操作のユーザー協力が必要。

- [ ] **Step 1: 撮影セッションの段取りをユーザーと確認**

撮影する5画面と状態：
1. **hero-imanosora**: いまの空タブ最上部（モバイル幅390px・注意報サマリー＋日別予報が見える状態）
2. **feature-ai**: AIコメントカード（散布どきタブなど内容が表示された状態）
3. **feature-kurabe**: 空くらべタブのチャート（2年比較が表示された状態が理想）
4. **feature-hourly**: 時間別予報テーブル（カッパラベル・降水ありの時間帯が見える状態が理想）
5. **feature-custom**: じぶん好み設定画面。デモプロンプトとして以下を入力した状態：
   「露地栽培でぶどうとリンゴを栽培しています。この季節の作業を考慮したうえで、気象データをもとに、この先1週間の畑仕事の見通しを整理して教えてください。
   親しみやすい言葉で、モチベーションの上がる一言を添えてください。」

- [ ] **Step 2: 撮影方法の決定と実行**

**方法A（自動・推奨）:** `npm run dev` 起動 → Chrome を `--remote-debugging-port` またはPlaywright（`channel: 'chrome'`・headless:false・persistent profile）で起動 → ユーザーがその窓でGoogleログイン → スクリプトが390×844・deviceScaleFactor:2 でビューポートスクリーンショットを5枚PNG撮影。
**方法B（フォールバック）:** ユーザーがiPhone実機でスクショ撮影し、5ファイルを提供。
※方法Aのスクリプトは実行時に `scripts/capture-lp-shots.mjs` として作成し、撮影完了後に削除するか `.gitignore` 対象とする（リポジトリには含めない）。

- [ ] **Step 3: WebP変換して `public/lp/` に配置**

PNG→WebP変換（sharp を一時利用 or 他ツール）。品質80・長辺1600px以内。
Run: `node -e` ワンライナーまたは一時スクリプトで変換し、`public/lp/*.webp` として保存。

- [ ] **Step 4: 実画像の寸法を確認し、LandingPage.tsx の width/height を実寸に更新**

PowerShellで寸法確認:
```powershell
Add-Type -AssemblyName System.Drawing
Get-ChildItem public/lp/*.webp | ForEach-Object { $i=[System.Drawing.Image]::FromFile($_.FullName); "$($_.Name): $($i.Width)x$($i.Height)"; $i.Dispose() }
```
（WebPが読めない場合は変換前PNGで確認）
`Hero` の `<img width={780} height={1688}>` と `FeaturesSection` の `<img width={800} height={600}>` を実寸に置換（アスペクト比が画像と一致していればCLSが出ない）。

- [ ] **Step 5: Chromeで画像表示を確認**

- [ ] 5枚すべて表示される・ぼやけていない（Retina 2x）
- [ ] HEROのスマホフレーム内に収まっている
- [ ] CLS（読み込み時のガタつき）が起きない

- [ ] **Step 6: Commit**

```bash
git add public/lp/ src/components/LandingPage.tsx
git commit -m "feat(lp): 実機スクリーンショット5枚を撮影・組み込み"
```

---

### Task 8: 最終検証・push・iOS実機確認の依頼

- [ ] **Step 1: 最終ビルド**

Run: `npx tsc --noEmit; npm run build`
Expected: 成功

- [ ] **Step 2: Chrome最終確認**

モバイル390px・PC 1280pxの両方でLP全体をスクロールし、Task 6のチェックリストを再確認（今回は画像あり）。

- [ ] **Step 3: push**

```bash
git push
```

- [ ] **Step 4: ユーザーにiOS Safari実機確認を依頼**

確認ポイントを提示：
- NAVのぼかし（backdrop-filter）が効いているか
- HEROが初期表示で欠けないか（100svh対応）
- 比較表の横スクロールがスムーズか
- 画像が表示されるか（WebP対応）
- ログインが正常に動くか（popup方式・`4bb30ae` の修正確認を兼ねる）

---

## Self-Review チェック済み事項

- スペック全要件のタスク対応: 9セクション構成（Task 2-5）/ デザイントークン（Task 1）/ Safari 3点対応（Task 1のCSS: webkit-backdrop-filter・svh・-webkit-sticky）/ スクショ5枚＋デモプロンプト（Task 7）/ 検証（Task 6・8）
- 型整合: `CompMark`・`CompRow` はTask 2定義→Task 5使用で一致。`FadeIn`/`GoogleIcon`/`handleLogin` のシグネチャはTask間で一致
- 旧LPからの保持物: pains文言・免責文・クレジット・ログインロジックすべてTask 2に原文埋め込み済み
- 追加改善: フッターにプライバシーポリシー/免責事項リンクを追加（旧LPには無かった。ログイン導線があるLPとして必要）
