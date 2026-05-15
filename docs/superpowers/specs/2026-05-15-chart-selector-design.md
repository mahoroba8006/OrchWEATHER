# チャート選択UI 設計書

**作成日:** 2026-05-15  
**対象ファイル:** `src/App.tsx`

---

## Context

パフォーマンス計測（Chrome DevTools Performance タブ）の結果、Scripting が全体の 90%（9,512ms / 10,550ms）を占めることが判明した。原因は 6 つの Recharts ComposedChart が同時にマウントされ続け、ホバー等の state 変化のたびに全チャートが再レンダリングされること。

選択中の 1 チャートのみをレンダリングする構成に変更し、再レンダリングコストを最大 1/6 に削減する。同時に、値表示エリアの配置を改善してモバイル UX を向上させる。

---

## 設計概要

### 1. チャート選択タブバー（新規追加）

- **位置:** 表示期間行（1月〜12月 / 年間表示 / 日次|月次）の直下
- **スタイル:** 横スクロール可能な pill 型タブ（既存の日次|月次トグルと同系の pink/rose カラー）
- **項目（順番固定）:** 気温 / 降水量 / 日照時間 / 日射量 / 積算温度 / 湿度
- **初期選択:** 気温

### 2. 単一チャートレンダリング

- `activeChart` state（`'temp' | 'precip' | 'sunshine' | 'radiation' | 'gdd' | 'humid'`）を追加
- 6 つの `<section>` を `{activeChart === 'X' && <section>...</section>}` で条件分岐
- **CSS display:none は使わない** — アンマウントにより Recharts SVG が DOM から完全除去され、再レンダリングコストがゼロになる

### 3. グラフ幅

- 現在の `chart-bleed` CSS（端から端まで全幅表示）、Y 軸 `mirror: true` を変更なく維持

### 4. 値表示ボックス（renderActivePanel の移動）

- **変更前:** チャートタイトル行の右側にインラインで表示
- **変更後:** チャートと MonthsTable の間に専用ボックスとして独立配置
- **タップ前:** 「タップして値を表示」プレースホルダー（薄い破線ボーダー）
- **タップ後:** 日付 + 地点・年ごとの値を列挙（現在と同内容）
- チャートタイトル行から `renderActivePanel` の呼び出しを削除

### 5. MonthsTable

- 各チャートの月次統計テーブルは選択チャートの下に残す（変更なし）

---

## state 変更

```typescript
// 追加
const [activeChart, setActiveChart] = useState<'temp' | 'precip' | 'sunshine' | 'radiation' | 'gdd' | 'humid'>('temp');
```

---

## コンポーネント構造（変更後）

```
<div>  ← メインコンテナ
  <TargetSelector />         ← 地点・年選択（変更なし）
  <DisplayRangeRow />        ← 表示期間 + 日次|月次トグル（変更なし）
  <ChartTabBar />            ← [NEW] 横スクロールタブ
  {activeChart === 'temp' && (
    <section>
      <ChartTitle />         ← タイトルのみ（値表示削除）
      <ChartFrame />         ← 全幅グラフ（変更なし）
      <ValuePanel />         ← [NEW] 値表示ボックス
      <MonthsTable />        ← 変更なし
    </section>
  )}
  {activeChart === 'precip' && ( ... )}
  ... 残り4チャート同様 ...
</div>
```

---

## 実装対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/App.tsx` | `activeChart` state 追加、タブバー追加、条件分岐レンダリング、`renderActivePanel` 移動 |

---

## 検証方法

1. `npm run dev` で起動
2. モバイル DevTools（375px）で以下を確認:
   - タブをタップすると対応チャートのみ表示されること
   - 値表示ボックスがチャートと MonthsTable の間に現れること
   - タップ前はプレースホルダー、タップ後は値が表示されること
   - グラフが端から端まで表示されること（chart-bleed 維持）
3. Chrome DevTools Performance タブで再計測し、Scripting 時間が削減されていることを確認
4. `npm run build` が通ること
