import type { CSSProperties } from 'react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const BACK_BTN_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--accent-color)',
  fontSize: '0.88rem',
  fontWeight: 600,
  padding: '0.5rem 0',
};

const BACK_HEADER_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  background: 'var(--bg-color)',
  paddingTop: '1rem',
  paddingBottom: '0.25rem',
};

const H1_STYLE: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
  color: 'var(--text-primary)',
  marginBottom: '1rem',
};

const H2_STYLE: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginTop: '2rem',
  marginBottom: '0.6rem',
  paddingBottom: '0.3rem',
  borderBottom: '1px solid var(--card-border)',
};

const H3_STYLE: CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: 'var(--accent-color)',
  marginTop: '1.1rem',
  marginBottom: '0.4rem',
};

const P_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
  marginBottom: '0.5rem',
};

const WARNING_BOX: CSSProperties = {
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: 'var(--radius-md)',
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: '#b91c1c',
  lineHeight: 1.6,
  marginTop: '0.75rem',
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
  background: 'rgba(13, 148, 136, 0.06)',
  border: '1px solid rgba(13, 148, 136, 0.2)',
  borderRadius: 'var(--radius-md)',
  padding: '0.75rem 1.25rem',
  marginBottom: '0.5rem',
};

const TOC_ITEM_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  color: 'var(--accent-color)',
  textDecoration: 'none',
  padding: '0.2rem 0',
  fontWeight: 500,
};

const TOC_LABEL_STYLE: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: '0.4rem',
  letterSpacing: '0.05em',
};

export function HelpPage({ onBack }: Props) {
  return (
    <div className="app-container" style={{ paddingTop: 0, paddingBottom: '2rem' }}>
      <div style={BACK_HEADER_STYLE}>
        <button style={BACK_BTN_STYLE} onClick={onBack}>
          <ChevronLeft size={16} strokeWidth={2.5} />
          戻る
        </button>
      </div>

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
            設定画面の「地点管理」から地点を登録します。以下の3つの方法が使えます。
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
                <td style={{ fontWeight: 600 }}>現在地から取得</td>
                <td>ブラウザの位置情報を使って自動取得します。初回は許可ダイアログが表示されます。</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>マップから選択</td>
                <td>地図上をタップ／クリックして任意の地点を登録します。</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>手動入力</td>
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
            登録した地点の現在の天気予報を表示します。時間別予報（2時間刻み）・日別予報・AIコメントの3つのセクションで構成されています。
          </p>

          <h3 style={H3_STYLE}>AIコメントの各タブ</h3>
          <p style={P_STYLE}>
            AIコメントは農作業の観点から気象データを解説します。設定タブで表示するタブを有効／無効に切り替えられます。
          </p>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%' }}>
            <thead>
              <tr>
                <th>タブ名</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>空ごよみ</td>
                <td>今日・明日の天気概況と数日先の傾向、作物への影響を解説します。</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>畑しごと</td>
                <td>草取り・収穫・定植など外作業のタイミングと注意点を提案します。</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>散布どき</td>
                <td>農薬・液肥の散布に適した条件と最適な時間帯を提案します。</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>施肥どき</td>
                <td>粒状・粉状肥料の施用タイミングを雨・土の状態から最適化して提案します。</td>
              </tr>

              <tr>
                <td style={{ fontWeight: 600 }}>じぶん好み</td>
                <td>自分でプロンプトを入力して、天気データに基づく任意の回答を取得できます。</td>
              </tr>
            </tbody>
          </table>

          <h3 style={H3_STYLE}>じぶん好みタブ — AIに渡しているデータ一覧</h3>
          <p style={P_STYLE}>
            じぶん好みタブでは以下のデータをAIに送信しています。プロンプトを書くときの参考にしてください。
          </p>

          <p style={{ ...P_STYLE, fontWeight: 600, marginBottom: '0.2rem' }}>時間別（1時間ごと × 72エントリ／今後72時間分）</p>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%', marginBottom: '0.75rem' }}>
            <thead>
              <tr>
                <th>項目</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>気温</td><td>℃</td></tr>
              <tr><td>湿度</td><td>%</td></tr>
              <tr><td>風速</td><td>m/s</td></tr>
              <tr><td>風向</td><td>16方位（北・北北東・北東 …）</td></tr>
              <tr><td>瞬間風速</td><td>m/s</td></tr>
              <tr><td>降水量</td><td>mm</td></tr>
              <tr><td>降水確率</td><td>%</td></tr>
              <tr><td>降雪量</td><td>cm</td></tr>
              <tr><td>紫外線指数</td><td>UV index</td></tr>
              <tr><td>飽差</td><td>g/m³（気温・湿度から計算）</td></tr>
              <tr><td>CAPE</td><td>J/kg（対流不安定の指標）</td></tr>
              <tr><td>0℃層高度</td><td>m（雪・雨の境界の目安）</td></tr>
              <tr><td>海面気圧</td><td>hPa</td></tr>
            </tbody>
          </table>

          <p style={{ ...P_STYLE, fontWeight: 600, marginBottom: '0.2rem' }}>日別予報（3〜7日後 / 5日分）および過去7日の日別実績</p>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%', marginBottom: '0.75rem' }}>
            <thead>
              <tr>
                <th>項目</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>最高気温 / 最低気温</td><td>℃</td></tr>
              <tr><td>降水確率（最大）</td><td>%</td></tr>
              <tr><td>降水量</td><td>mm</td></tr>
              <tr><td>日射量合計</td><td>MJ/m²</td></tr>
              <tr><td>日照時間</td><td>h</td></tr>
              <tr><td>最大風速</td><td>m/s</td></tr>
            </tbody>
          </table>

          <p style={{ ...P_STYLE, fontWeight: 600, marginBottom: '0.2rem' }}>その他</p>
          <table className="glass-table text-wrap" style={{ fontSize: '0.85rem', width: '100%', marginBottom: '0.75rem' }}>
            <thead>
              <tr>
                <th>項目</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>現在日時</td><td>日本時間（M/D(曜日) H時 形式）</td></tr>
              <tr><td>地点名</td><td>登録した地点の名称</td></tr>
              <tr><td>気象庁 注意報・警報</td><td>現在発令中のもの（なければ空）</td></tr>
            </tbody>
          </table>

          <div style={WARNING_BOX}>
            <strong>⚠️ ハルシネーション（AI の誤情報）に注意</strong><br />
            上記一覧にないデータをプロンプトで指定すると、AIが実際には存在しない数値を作り出して回答する場合があります。<br />
            例：「今日の露点温度は？」「蒸発散量は？」などは渡していないため、AIが数値を捏造するリスクがあります。プロンプトは上記一覧にあるデータを根拠にした内容にしてください。
          </div>
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
                <td>有効積算温度を計算するための基準温度を2種類まで設定できます。</td>
              </tr>
              <tr>
                <td>累計の集計開始日</td>
                <td>降水量・日照・日射・積算温度それぞれの累計カウントを開始する日（MM-DD）を設定できます。</td>
              </tr>
            </tbody>
          </table>

          <h3 style={H3_STYLE}>CSVダウンロード</h3>
          <p style={P_STYLE}>
            日別データをCSV形式でエクスポートできます。基本項目に加え、累計列（降水量・日照・日射）と積算温度列（日別・累計 × 2種類の基準温度）も含まれます。
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
