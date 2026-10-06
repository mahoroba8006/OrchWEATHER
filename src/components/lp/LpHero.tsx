// src/components/lp/LpHero.tsx
// 0. 最初の画面（夜明け・立春）。見出しがせり上がり、丘の向こうからカードが昇り、札の数字が数え上がる。
import { sekkiForDate } from '../../lib/sekki';
import { useChapterView } from './hooks';
import { LP_FACTS_ASOF } from './lpFacts';
import { CountUp, CtaPair, LineReveal, Shot } from './primitives';
import './hero.css';

export function LpHero({ loading, error, onLogin, onTryGuest }: {
  loading: boolean; error: string | null; onLogin: () => void; onTryGuest: () => void;
}) {
  const ref = useChapterView<HTMLElement>('hero');
  const today = sekkiForDate(new Date());
  return (
    <section ref={ref} id="top" className="lp-ch lp-hero" data-scene="0">
      <div className="lp-hero__copy">
        {/* 今日の節気は見出しの上の小さな札に（縦に積む段数を増やさない） */}
        <p className="lp-hero__today">
          今日は<b>{today.name}</b>
          <span className="lp-hero__kou">{today.kou.name}（{today.kou.reading}）</span>
        </p>
        <LineReveal as="h1" className="lp-hero__title" lines={['「今年は遅い」が、', '数字で見える。']} />
        <p className="lp-hero__sub">勘を、数字で裏づける。</p>
        <p className="lp-hero__use"><span className="lp-phrase">あなたの農園の天気が見える。</span><span className="lp-phrase">あの年・あの場所との違いが見える。</span></p>
        <CtaPair loading={loading} onLogin={onLogin} onTryGuest={onTryGuest} />
        <p className="lp-hero__note"><span className="lp-phrase">Googleアカウントですぐにログイン。</span><span className="lp-phrase">無料で利用できます</span></p>
        {error && <p className="lp-error" role="alert">{error}</p>}
      </div>
      <div className="lp-hero__device">
        <Shot src="/lp/review-card.webp" alt="節気のふりかえりカード（白露）— 去年・5年平均と比べた気温・雨・日照" width={780} height={1114} eager />
        <div className="lp-hero__badge">
          <p className="lp-chip">
            積算温度 去年より<CountUp to={18} delay={1100} />日遅い
          </p>
          <p className="lp-hero__asof">{LP_FACTS_ASOF}</p>
        </div>
      </div>
    </section>
  );
}
