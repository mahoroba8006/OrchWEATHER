# LP ビジュアル刷新仕様書：「スクロールで晴れていく空」

作成日: 2026-07-21 ／ 承認済み（ユーザー合意: 空色背景＋teal維持・ライブラリ追加なし・全力で先進的に）

## 目的

LP（`src/components/LandingPage.tsx`）を「青空・気持ちのいい空・先進的・前向き」な印象の
スクロール体験に刷新する。**記載内容（文言・情報・セクション構成・DOM順序）は一切変更しない。**

## 絶対制約

1. **文言不変**: 表示テキストは1文字も変更しない。追加・削除・言い換え禁止
2. **依存追加ゼロ**: npm パッケージを追加しない。IntersectionObserver＋requestAnimationFrame＋CSS のみ
3. **変更ファイルは2つのみ**: `src/components/LandingPage.tsx` と `src/landing.css`
4. **性能**: アニメーションは transform / opacity / CSS変数のみ（layout/paint を誘発するプロパティ禁止）。
   scroll listener は passive＋rAFスロットル。`will-change` は常時表示レイヤーのみ最小限
5. **アクセシビリティ**: `prefers-reduced-motion: reduce` で全動的演出を無効化し、静的な空グラデーション＋即時表示にフォールバック
6. **可読性最優先**: 空の色はすべて淡いパステル。本文テキスト（濃色）とのコントラストを損なう彩度・暗さは禁止
7. **Safari対応**: `-webkit-` prefix は `landing.css` で一元管理（既存方針を踏襲）。iOS Safari で backdrop-filter・sticky が壊れないこと

## デザインコンセプト

ページ全体を1つの「空」とし、スクロール進捗に応じて背景が
**夜明けの淡い色 → 澄んだ青空 → 明るい晴天** へ連続変化する。前向きな物語として着地させる。

## 実装項目（7点）

### 1. スカイバックドロップ（ページ全体の背景）

- `position: fixed; inset: 0; z-index: 0;` の背景レイヤー `SkyBackdrop` コンポーネントを新設し、`.lp-root` 直下に配置。コンテンツは `position: relative; z-index: 1` で上に載せる
- `.lp-root` の `background: var(--bg-gradient)` は撤去（スカイレイヤーが背景を担う）
- スクロール進捗率 `p = scrollY / (scrollHeight - innerHeight)` を rAF で監視し、3つのパレットを RGB 線形補間して CSS変数 `--sky-1` `--sky-2` `--sky-3`（縦グラデーション3ストップ）に書き込む
  - 夜明け（p=0）: 例 `#fdf4e8 → #e3edf9 → #eef5fc`（淡い暖色が上端にわずかに残る朝）
  - 青空（p=0.5）: 例 `#bfe0fb → #ddeffe → #f2faff`
  - 晴天（p=1）: 例 `#aaddff → #d5eeff → #fffbeb`（下端にほのかな陽光の暖色）
  - ※正確な色値は実装時に可読性を確認しながら微調整してよい（パステル維持が条件）
- reduced-motion 時は青空パレット固定

### 2. Hero「生きている空」

- Hero セクション内に装飾レイヤー（`aria-hidden="true"`・`pointer-events: none`）を追加:
  - ぼかした白い雲（`border-radius: 50%`＋`filter: blur()` の div を数個重ねた雲塊）2〜3層が CSS keyframes で画面を非常にゆっくり横断（1周 60〜120秒級）
  - 淡い光のグラデーション（radial-gradient）が opacity をゆらぐ shimmer
- スマホモック（`.lp-phone`）: 浮遊アニメ（translateY ±6px 程度・4〜6秒ループ）＋スクロールで軽い視差（背景より遅く動く）
- モバイル（例: 640px以下）では雲レイヤーを削減して負荷軽減

### 3. ナビゲーションの変化

- 最上部（scrollY < 40px 目安）: 背景透明・ボーダーなし
- スクロール後: 現行の白曇りガラス（rgba白＋blur）へ transition で遷移
- ナビ下辺にスクロール進捗バー（teal `#0d9488`、高さ2〜3px、`transform: scaleX(p)` で伸縮）

### 4. セクション別出現アニメーション（Reveal 拡張）

- 既存 `FadeIn` を拡張し `Reveal` 化（props: `variant`, `delay`, `stagger` 等）。既存の使用箇所は壊さない
- バリアント: `fade-up`（既存相当）／`fade-left`／`fade-right`／`scale`（0.94→1）／`blur`（blur(8px)→0 併用フェード）
- ジグザグ（SoraMoyo/SoraKurabe/SoraShirabe/AiAdvice の画像×テキスト）は画像とテキストを左右逆方向からスライドイン
- 見出し・リード・カード群は stagger（子要素 80〜120ms 間隔の時差表示）
- 一度表示したら unobserve（既存方針踏襲・再アニメなし）

### 5. パララックス雲（セクション間装飾）

- セクションの隙間に装飾雲レイヤー（絶対配置・`pointer-events: none`・`aria-hidden`）を2〜3箇所配置
- scrollY×係数（例 0.1〜0.3 の速度差）で `translate3d` 移動し奥行きを表現
- 本文の可読域と重なる場合は opacity を十分下げる（0.5以下目安）

### 6. 表・リストの時差表示

- 比較表（ComparisonSection / TierComparisonSection）: 行が上から順に stagger 表示
- 導入ステップ（StepsSection）: 各ステップが順番に現れる（番号→テキストの順でもよい）

### 7. 最終CTA帯

- `.lp-final`（teal グラデーション帯）はブランド維持のため色を変えない
- 帯の背景に淡い放射光（conic/radial-gradient の光線、opacity 0.1前後）装飾を追加し「晴天への着地」を表現
- 直前で空パレットが最も明るい晴天色に到達している状態にする

## アーキテクチャ

- 追加フック（LandingPage.tsx 内に定義。ファイル分割は不要だが、してもよい）:
  - `useScrollProgress()`: 全体進捗 p（rAFスロットル・passive）
  - `useParallax(speed)`: 要素の translate3d 用オフセット
- `Reveal` コンポーネント（FadeIn の後継。FadeIn は Reveal の fade-up として統合してよい）
- `SkyBackdrop` コンポーネント（CSS変数書き込み＋グラデーション描画）
- keyframes・装飾クラスは `landing.css` に追加

## 検証手順（実装完了の条件）

1. `npm run build`（tsc＋vite）が通ること
2. dev サーバーでデスクトップ幅＋375px モバイル幅の両方を目視確認:
   - スクロールで空の色が夜明け→青空→晴天に変化する
   - Hero の雲が流れ、スマホモックが浮遊する
   - ナビが透明→曇りガラスに遷移し、進捗バーが伸びる
   - 各セクションがバリアント違いで出現し、表・ステップが時差表示される
   - 横スクロールが発生しない（overflow-x: hidden 維持）
3. 表示テキストが変更前と完全一致すること（文言 diff ゼロ）
4. DevTools で prefers-reduced-motion をエミュレートし、静的表示になること
5. **コミットはしない**（ユーザー実機確認後に別途実施）
