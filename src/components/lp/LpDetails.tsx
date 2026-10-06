// 詳しく読む層（読みたい人だけ開く）。中身はページ内に残る（検索に拾われる）。開いたら GA4 に記録。
// 文章・表の中身は旧 LandingPage.tsx から移したもの（変更しない）。
import type { ReactNode } from 'react';
import { logLpDetailOpen } from '../../lib/analytics';

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

/** 詳しく読む層の折りたたみ。中身はページ内に残る（検索に拾われる）。開いたら GA4 に記録 */
function Detail({ section, title, children }: { section: 'features' | 'compare' | 'faq'; title: string; children: ReactNode }) {
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
  const color = (mark.m === '✓' || mark.m === '○' || mark.m === '◎') ? 'var(--lp-leaf)' : mark.m === '△' ? '#d97706' : '#b3bcc9';
  return (
    <td className={ours ? 'lp-comp-ours' : undefined}>
      <span style={{ color, fontWeight: 800, fontSize: '1rem' }}>{mark.m}</span>
      {mark.note && <span className="lp-comp-note">{mark.note}</span>}
    </td>
  );
}

function CompareTable() {
  return (
    <div className="lp-table-wrap">
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="lp-comp">
          <thead>
            <tr>
              <th></th>
              <th style={{ color: 'var(--lp-leaf)' }}>Orch.Weather</th>
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
      <div className="lp-table-wrap">
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="lp-comp">
            <thead>
              <tr>
                <th colSpan={2}></th>
                <th>ログインなし</th>
                <th>ログイン<br />（無料）</th>
                <th style={{ color: 'var(--lp-leaf)' }}>ログイン<br />（有料）<span style={{ fontSize: '0.68rem', fontWeight: 600 }}>※予定</span></th>
              </tr>
            </thead>
            <tbody>
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
            </tbody>
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

export function LpDetails() {
  return (
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
      <Detail section="faq" title="よくある質問">
        <dl className="lp-faq">
          {faqs.map((f) => (
            <div key={f.q} className="lp-faq__item">
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </Detail>
    </div>
  );
}
