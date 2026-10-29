import type { CSSProperties } from 'react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  /** 未指定なら戻るボタンを出さない（シート内表示） */
  onBack?: () => void;
}

const BACK_BTN_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--accent)',
  fontSize: '0.88rem',
  fontWeight: 600,
  padding: '0.5rem 0',
};

const BACK_HEADER_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  background: 'var(--surface-ground)',
  paddingTop: '1rem',
  paddingBottom: '0.25rem',
};

const H1_STYLE: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
  color: 'var(--ink-1)',
  marginBottom: '1rem',
};

const H2_STYLE: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: 'var(--ink-1)',
  marginTop: '24px',
  marginBottom: '0.6rem',
  paddingBottom: '0.3rem',
  borderBottom: '1px solid var(--line)',
};

const H3_STYLE: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 600,
  color: 'var(--ink-1)',
  marginTop: '1.1rem',
  marginBottom: '0.4rem',
};

const P_STYLE: CSSProperties = {
  fontSize: '0.88rem',
  color: 'var(--ink-2)',
  lineHeight: 1.8,
  marginBottom: '0.5rem',
};

const FORMULA_BOX: CSSProperties = {
  background: 'rgba(var(--accent-rgb), 0.06)',
  border: '1px solid rgba(var(--accent-rgb), 0.2)',
  borderRadius: 'var(--radius-md)',
  padding: '0.6rem 1rem',
  fontSize: '0.88rem',
  fontWeight: 600,
  color: 'var(--ink-1)',
  marginBottom: '0.75rem',
};

const NOTE_BOX: CSSProperties = {
  background: 'rgba(245, 158, 11, 0.08)',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  borderRadius: 'var(--radius-md)',
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: '#92400e',
  lineHeight: 1.6,
  marginTop: '0.75rem',
};

const TOC_STYLE: CSSProperties = {
  background: 'rgba(var(--accent-rgb), 0.06)',
  border: '1px solid rgba(var(--accent-rgb), 0.2)',
  borderRadius: 'var(--radius-md)',
  padding: '0.75rem 1.25rem',
  marginBottom: '0.5rem',
};

const TOC_ITEM_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  color: 'var(--accent)',
  textDecoration: 'none',
  padding: '0.2rem 0',
  fontWeight: 500,
};

const TOC_LABEL_STYLE: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--ink-2)',
  marginBottom: '0.4rem',
  letterSpacing: '0.05em',
};

export function HelpPage({ onBack }: Props) {
  return (
    <div className="app-container" style={{ paddingTop: 0, paddingBottom: '2rem' }}>
      {onBack && (
        <div style={BACK_HEADER_STYLE}>
          <button style={BACK_BTN_STYLE} onClick={onBack}>
            <ChevronLeft size={16} strokeWidth={2.5} />
            戻る
          </button>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h1 style={H1_STYLE}>アプリの使い方</h1>

        {/* 目次 */}
        <div style={TOC_STYLE}>
          <div style={TOC_LABEL_STYLE}>目次</div>
          <a href="#location" style={TOC_ITEM_STYLE}>1. 地点登録の方法</a>
          <a href="#weather" style={TOC_ITEM_STYLE}>2. 空もよう</a>
          <a href="#compare" style={TOC_ITEM_STYLE}>3. 空くらべ</a>
          <a href="#history" style={TOC_ITEM_STYLE}>4. 空しらべ</a>
        </div>

        {/* ── 1. 地点登録 ── */}
        <section id="location">
          <h2 style={H2_STYLE}>1. 地点登録の方法</h2>
          <p style={P_STYLE}>
            設定画面の「地点設定」から地点を登録します。以下の3つの方法が使えます。
          </p>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%' }}>
            <thead>
              <tr>
                <th>方法</th>
                <th>説明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>現在地で登録</td>
                <td>ブラウザの位置情報を使って自動取得します。初回は許可ダイアログが表示されます。</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>マップから選ぶ</td>
                <td>地図上をタップ／クリックして任意の地点を登録します。</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>手動で追加</td>
                <td>地点名・緯度・経度を直接入力して登録します。</td>
              </tr>
            </tbody>
          </table>
          <p style={{ ...P_STYLE, marginTop: '0.6rem' }}>
            複数地点を登録しておくと「空くらべ」で比較できます。
          </p>
        </section>

        {/* ── 2. 空もよう ── */}
        <section id="weather">
          <h2 style={H2_STYLE}>2. 空もよう</h2>
          <p style={P_STYLE}>
            登録した地点の現在の天気予報を表示します。日別予報・時間別予報の2つのセクションで構成されています。
          </p>

          <h3 style={H3_STYLE}>天気アイコンの表示モード</h3>
          <p style={P_STYLE}>
            日別予報の上部にある切替ボタンで、天気アイコンの決め方を変えられます。
          </p>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%', marginBottom: '0.75rem' }}>
            <thead>
              <tr>
                <th>モード</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>概況でみる</td>
                <td>午前・午後・夜間それぞれの時間帯で、<strong>いちばん長い天気</strong>を代表アイコンとして表示します。まず降っていない時間（晴れ・くもり）と降っている時間（雨・雪・雷）を比べ、長い方（同じなら降っている方）の中で最も多い天気を選びます。外で作業できる時間の長さをつかみたいときに使います。カレンダーの1日は、午前と午後（4〜20時）で決めます。晴れでも雨量が出ている日は、降る時間が短い日です。雨の時間は「リスクでみる」や時間別の表で確かめられます。（デフォルト）</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>リスクでみる</td>
                <td>午前・午後・夜間それぞれの時間帯で、<strong>最も悪い天気コード</strong>を代表アイコンとして表示します。悪天候を見逃したくないときに使います。</td>
              </tr>
            </tbody>
          </table>

          <h3 style={H3_STYLE}>ミニアイコンタグ</h3>
          <p style={P_STYLE}>
            各時間帯セルのアイコン下には、<strong>現在選んでいないモードの天気</strong>を小さなタグで表示しています。
            「概況でみる」選択中はピンク色のタグがリスクの天気を、「リスクでみる」選択中はティール色のタグが概況の天気を補足表示します。
            2つのモードの違いが大きい日（たとえば夜だけ雨が降るなど）を一目で確認できます。
          </p>
        </section>

        {/* ── 3. 空くらべ ── */}
        <section id="compare">
          <h2 style={H2_STYLE}>3. 空くらべ</h2>
          <p style={P_STYLE}>
            最大2地点・複数年のデータを並べて比較できる画面です。年ごとの傾向把握や地点間の気象差の確認に使います。
          </p>

          <h3 style={H3_STYLE}>比較対象の設定</h3>
          <p style={P_STYLE}>
            地点と年を選択してターゲットを追加します（最大2ターゲット）。気温・降水量・日射量・積算温度などをグラフで比較できます。
          </p>

          <h3 style={H3_STYLE}>分析設定</h3>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%' }}>
            <thead>
              <tr>
                <th>設定項目</th>
                <th>説明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>積算温度の基準温度</td>
                <td>有効積算温度の基準温度と上限温度を2組（設定1・設定2）まで設定できます。計算方法は下の「積算温度の計算方法」をご覧ください。</td>
              </tr>
              <tr>
                <td>累計の集計開始日</td>
                <td>降水量・日照・日射・積算温度それぞれの累計カウントを開始する日（MM-DD）を設定できます。</td>
              </tr>
            </tbody>
          </table>

          <h3 style={H3_STYLE}>積算温度の計算方法</h3>
          <p style={P_STYLE}>
            有効積算温度は、作物の生育に効いた暖かさを毎日足し上げた値です。1日分は次のように計算します（0を下回る日は0）。
          </p>
          <div style={FORMULA_BOX}>1日分 ＝ 日平均気温 − 基準温度 − 上限を超えた分</div>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%' }}>
            <colgroup><col style={{ width: '6.5em' }} /><col /></colgroup>
            <tbody>
              <tr>
                <td>基準温度</td>
                <td>作物が育ち始める温度です。日平均気温がこれを下回る日は0として数えます。</td>
              </tr>
              <tr>
                <td>上限温度</td>
                <td>これより暑くても、生育はそれ以上速く進まないとみなす温度です（任意）。設定すると、上限を超えた分を数えません。空欄なら上限なしで計算します。20〜50℃で、基準温度より高い値を設定できます。</td>
              </tr>
              <tr>
                <td>計算方式</td>
                <td>上限を超えた分の見積もり方です。日別のデータには1時間ごとの気温がないため、最高・最低気温から一日の気温の上がり下がりをなめらかな波（正弦曲線）として見積もり、上限より上にはみ出した部分だけを差し引きます（米国カリフォルニア大学の病害虫管理プログラム UC IPM が勧める「正弦法＋水平カットオフ」）。最高気温が上限を超えない日は何も差し引きません。</td>
              </tr>
              <tr>
                <td>設定1・2</td>
                <td>2組まで設定でき、グラフの上で切り替えられます。同じ基準温度で上限温度だけ変えて比べることもできます。設定1は空もようの「季節のあしどり」にも使います。</td>
              </tr>
              <tr>
                <td>開始日</td>
                <td>設定した日（MM-DD）から足し上げます。</td>
              </tr>
            </tbody>
          </table>
          <p style={{ ...P_STYLE, marginTop: '0.6rem' }}>
            計算例：最高36℃・最低24℃（日平均30℃）、基準温度10℃の日は、上限なしで20.0℃、上限33℃では昼過ぎに33℃を超えた分（約0.7℃）を差し引いて約19.3℃になります。
          </p>
          <div style={NOTE_BOX}>
            <strong>気温データについて</strong><br />
            日平均気温は1時間ごとの気温の平均（24時間平均）です。予報（点線）の期間は（最高＋最低）÷2で計算します。<br />
            気温は約10km四方の推計値のため、畑で測った値より最高気温が低めに出ることがあり、そのぶん上限温度の効き目も小さめに出ます。
          </div>

          <h3 style={H3_STYLE}>CSVダウンロード</h3>
          <p style={P_STYLE}>
            日別データをCSV形式でエクスポートできます。基本項目に加え、累計列（降水量・日照・日射）と積算温度列（日別・累計 × 設定1・設定2）も含まれます。
          </p>

          <div style={NOTE_BOX}>
            <strong>⚠️ 2021年以前のデータについて</strong><br />
            2022年1月1日以降は全項目取得できますが、2021年12月31日以前のデータは以下の項目が取得できません：<br />
            ・降水確率 ・UV指数 ・0℃層高度（9999 固定）
          </div>
        </section>

        {/* ── 4. 空しらべ ── */}
        <section id="history">
          <h2 style={H2_STYLE}>4. 空しらべ</h2>
          <p style={P_STYLE}>
            任意の日付を指定して、その日の気象データ（時間別・日別）を参照できる画面です。過去の作業記録との照合や、特定のイベント時の気象確認に使います。
          </p>

          <h3 style={H3_STYLE}>使い方</h3>
          <p style={P_STYLE}>
            地点を選択し、参照したい日付を入力すると気象データを取得・表示します。
          </p>

          <div style={NOTE_BOX}>
            <strong>⚠️ 2021年以前のデータについて</strong><br />
            「空くらべ」と同様に、2021年12月31日以前のデータは以下の項目が取得できません：<br />
            ・降水確率 ・UV指数 ・0℃層高度（9999 固定）
          </div>
        </section>
      </div>
    </div>
  );
}
