// src/components/lp/FinalChapter.tsx
// 6. 最後のボタン（夜・冬）。一年を読み終えて「今日」に戻ってくる。フッターは現行の文章を引き継ぐ。
import { sekkiForDate } from '../../lib/sekki';
import { useChapterView } from './hooks';
import { CtaPair, LineReveal } from './primitives';
import './final.css';

export function FinalChapter(props: { loading: boolean; onLogin: () => void; onTryGuest: () => void }) {
  const ref = useChapterView<HTMLElement>('final');
  const today = sekkiForDate(new Date());
  return (
    <section ref={ref} className="lp-ch lp-final" data-scene="0.88">
      <p className="lp-final__today">今日は{today.name}。</p>
      <LineReveal lines={['今年の季節を、', '数字で見てみる。']} />
      <CtaPair {...props} tone="night" />
      <p className="lp-final__note">ログインなしでも、現在地ですぐに試せます。</p>
    </section>
  );
}

export function LpFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__notice">
        <p className="lp-footer__noticeh">ご利用上の注意</p>
        <p>
          本アプリは、気象庁が発表する注意報・警報や、Open-Meteoが提供する気象データ（実績・予報）を、農業で使いやすい形に整理してお見せするツールです。アプリが独自に天気を予測することはなく、気象予報業務許可を要する予報業務を行うものではありません。表示される数値やグラフは参考情報であり、データの誤差・欠損・遅延や、予報と実際の天候が異なることがあります。農薬散布・防霜対策などの実際の作業判断は、気象庁の最新の警報・注意報や現地の状況とあわせて、ご自身の責任のもとで行ってください。詳しくは下記の免責事項をご覧ください。
        </p>
      </div>
      <div className="lp-footer__brand">
        <img src="/icons/yamamatsu-mark-white.svg" alt="" width={20} height={20} />
        <span>Orch.Weather</span>
      </div>
      <p className="lp-footer__links">
        <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
        <a href="/disclaimer.html" target="_blank" rel="noopener noreferrer">免責事項</a>
        <a href="/contact.html" target="_blank" rel="noopener noreferrer">お問い合わせ</a>
      </p>
      <p className="lp-footer__links">
        <span>気象データ提供：<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a></span>
        <span>注意報・警報：<a href="https://www.jma.go.jp" target="_blank" rel="noopener noreferrer">気象庁</a></span>
      </p>
      <p className="lp-footer__copy">© 2025 Orch.Weather — Orchシリーズ農業専用ツール</p>
    </footer>
  );
}
