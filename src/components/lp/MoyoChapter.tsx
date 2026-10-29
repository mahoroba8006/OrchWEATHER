// src/components/lp/MoyoChapter.tsx
// 4. 空もよう（午後・晩夏）。写真の直前の「概況でみる／リスクでみる」を押すと、カレンダーと午前・午後・夜間の写真が一緒に切り替わる。
// 押されるまでは、見えている間だけ自動で切り替える（最初は概況＝アプリの既定）。一度押したら自動切替は止める。
// 動きを減らす設定では、自動切替と切り替えの動きだけを止め、押して切り替える操作は同じにする。
import { useEffect, useState, type CSSProperties } from 'react';
import { logLpMoyoToggle } from '../../lib/analytics';
import { useChapterView, useInViewOnce, useReduced, useVisibility } from './hooks';
import { LineReveal, Shot } from './primitives';
import './moyo.css';

const MODES = [
  { key: 'gaikyo', label: '概況でみる' },
  { key: 'risk', label: 'リスクでみる' },
] as const;
// 画面は東京・2026年10月30日朝の表示（10月29日夜の予報）。見かたごとに1枚ずつ
const SHOTS = [
  { key: 'calendar', name: 'カレンダー', width: 780, height: 1046, caption: ['先週の天気、今日の天気、', 'この先の天気を、ひと目で'] },
  { key: 'daily', name: '午前・午後・夜間の表', width: 780, height: 608, caption: ['作業時間に合わせて、', '午前（4時〜12時）・', '午後（12時〜20時）・', '夜間（20時〜翌4時）で表示'] },
] as const;
const RAIN_WORDS = ['ぽつぽつ', 'カッパ？', 'カッパ！'];
// 折り返しは意味のまとまり（lp-phrase）ごと
const POINTS: { text: string[]; sub?: string[] }[] = [
  { text: ['概況でみる：', 'いちばん長い天気'], sub: ['雨の予報でも、', '晴れ・くもりの時間が', '長ければその天気に'] },
  { text: ['リスクでみる：', 'いちばん悪い天気'], sub: ['晴れの予報でも、', 'にわか雨や雷が', '見落としにくい'] },
  { text: ['1日を、作業時間にあわせた3つに'], sub: ['午前（4時〜12時）・', '午後（12時〜20時）・', '夜間（20時〜翌4時）'] },
  { text: ['1時間ごと、', '2週間先までの予報を表示'] },
];

export function MoyoChapter() {
  const reduced = useReduced();
  const ref = useChapterView<HTMLElement>('moyo');
  const [deviceRef, visible, seen] = useVisibility<HTMLDivElement>(0.35);
  const [hourlyRef, hourlySeen] = useInViewOnce<HTMLDivElement>(0.2);
  const [mode, setMode] = useState(0);
  const [touched, setTouched] = useState(false);
  // 読み上げる文。押したときだけ書き換える（自動切替では変えない＝3.2秒ごとに読み上げない）
  const [announce, setAnnounce] = useState('');
  // 押されるまで・見えている間だけ自動で切り替える（画面外ではタイマーを止める）
  useEffect(() => {
    if (reduced || touched || !visible) return;
    const id = window.setInterval(() => setMode((m) => 1 - m), 3200);
    return () => window.clearInterval(id);
  }, [reduced, touched, visible]);

  const choose = (i: number) => {
    setTouched(true);
    setMode(i);
    setAnnounce(MODES[i].label);
    logLpMoyoToggle(MODES[i].key);
  };

  return (
    <section ref={ref} className={reduced ? 'lp-ch lp-moyo lp-moyo--still' : 'lp-ch lp-moyo'} data-scene="0.4">
      <div className="lp-moyo__copy">
        <LineReveal lines={['雨マークの日でも、', '畑に出られる時間が', 'すぐわかる。']} />
        <p className="lp-moyo__caption">天気の見かたを、2つから選べる。</p>
        {/* 切り替えの読み上げは、押したときだけ下の行で知らせる（自動切替のたびに読まれないように）。
            aria-live の領域は最初から置いておかないと、最初の一回が読まれないことがある */}
        <p className="lp-sr" aria-live="polite">{announce}</p>
        <ul className="lp-moyo__points">
          {POINTS.map((t) => (
            <li key={t.text[0]}>
              {t.text.map((x) => <span key={x} className="lp-phrase">{x}</span>)}
              {t.sub && <span className="lp-moyo__sub">{t.sub.map((x) => <span key={x} className="lp-phrase">{x}</span>)}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div ref={deviceRef} className={seen || reduced ? 'lp-moyo__screens is-in' : 'lp-moyo__screens'}>
        <div className="lp-moyo__controls">
          <div className="lp-moyo__modes" role="group" aria-label="空もようの見方">
            {MODES.map((m, i) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={i === mode}
                aria-controls="lp-moyo-screen"
                className={i === mode ? 'is-on' : ''}
                onClick={() => choose(i)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="lp-moyo__tap">タップで切り替え</p>
        </div>
        <div id="lp-moyo-screen" className="lp-moyo__shots">
          {SHOTS.map((shot) => (
            <figure key={shot.key} className="lp-moyo__shot">
              <div className="lp-moyo__stack">
                {MODES.map((m, i) => (
                  <img
                    key={m.key}
                    src={`/lp/moyo-${shot.key}-${m.key}.webp`}
                    alt={`${shot.name} — ${m.label}`}
                    aria-hidden={i !== mode}
                    width={shot.width}
                    height={shot.height}
                    loading="lazy"
                    decoding="async"
                    className={i === mode ? 'is-on' : ''}
                  />
                ))}
              </div>
              <figcaption>{shot.caption.map((x) => <span key={x} className="lp-phrase">{x}</span>)}</figcaption>
            </figure>
          ))}
        </div>
        <p className="lp-moyo__tablenote">画面は東京・2026年10月30日朝の表示（10月29日時点の予報）。</p>
      </div>
      <div ref={hourlyRef} className={hourlySeen || reduced ? 'lp-moyo__hourly is-in' : 'lp-moyo__hourly'}>
        <p className="lp-moyo__hourlylead"><span className="lp-phrase">1時間ごとの空がわかる。</span><span className="lp-phrase">作業が決まる。</span></p>
        {/* 全項目を「おすすめの項目（色の付く行を含む）」と「そのほかの項目」の2枚に分けて小さく並べる（スマホは横にめくる） */}
        <div className="lp-moyo__tables">
          <figure className="lp-moyo__table">
            {/* 表の中の「カッパ！」などと同じ、3mmまでの雨のことばを札にして添える */}
            <div className="lp-moyo__tablewrap">
              <Shot src="/lp/moyo-hourly-work.webp" alt="時間別の表（おすすめの項目）— 天気・気温・降水確率・降水量・日照時間・日射量・紫外線指数・風速・風向き" width={740} height={968} />
              <ul className="lp-moyo__rain" aria-label="3mmまでの雨の言い方">
                {RAIN_WORDS.map((w, i) => <li key={w} style={{ '--i': i } as CSSProperties}>{w}</li>)}
              </ul>
            </div>
            <figcaption>一般的な情報も</figcaption>
            <p className="lp-moyo__rainnote">3mmまでの雨は、3段階のことばで。</p>
          </figure>
          <figure className="lp-moyo__table">
            <Shot src="/lp/moyo-hourly-data.webp" alt="時間別の表（そのほかの項目）— 瞬間風速・気圧・湿度・飽差・露点・CAPE・0℃層高度" width={740} height={696} />
            <figcaption>専門的な情報も</figcaption>
          </figure>
        </div>
        <p className="lp-moyo__tablenote">画面は東京・2026年9月8日（雨のち晴れ）の実績。</p>
      </div>
    </section>
  );
}
