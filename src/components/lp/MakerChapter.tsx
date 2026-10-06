// src/components/lp/MakerChapter.tsx
// 5. 作った人＋詳しく読む（夕焼け・秋）。本文は現行の「作った人のこと」の文章を引き継ぐ。
import { useChapterView } from './hooks';
import { LpDetails } from './LpDetails';
import { LineReveal } from './primitives';
import './maker.css';

export function MakerChapter() {
  const ref = useChapterView<HTMLElement>('maker');
  return (
    <section ref={ref} className="lp-ch lp-maker" data-scene="0.64">
      <div className="lp-maker__story">
        <LineReveal lines={['現場で', '欲しかったものを、', '農家が作りました。']} />
        <p>
          Orch.Weatherは、農作業の判断を助け、作物の生育を可視化したい。そう考えた一人の農家が、「現場で欲しかったもの」を詰め込んだアプリです。
        </p>
        <p>
          積算温度を自動で計算し、昨年と何日違うかを並べて表示。天気は「概況」と「リスク」を切り替えて確認でき、1日は畑に出る時間に合わせて午前・午後・夜間に分割。こうした機能は、机の上ではなく、現場で使いながら磨いてきたものばかりです。
        </p>
      </div>
      <LpDetails />
    </section>
  );
}
