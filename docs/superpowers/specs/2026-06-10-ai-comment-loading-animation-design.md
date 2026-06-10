# AIコメント ローディングアニメーション 設計書

**日付:** 2026-06-10  
**対象コンポーネント:** `src/components/weather/AiCommentCard.tsx`

---

## 概要

AIコメント取得中（`isStandardLoading` = true）に表示するローディング表示を、スケルトンバーから「タブアイコンのウェーブバウンス + テキスト」に刷新する。

---

## 現状

```tsx
// isStandardLoading 時の現在の表示
- 無効状態のタブバー（TabBar disabled）
- グレーのスケルトンバー × 3
- 「今日のポイントを分析中…」（薄いグレー）
```

---

## 新しい表示

### レイアウト

```
┌─────────────────────────────────────┐
│                                     │
│   ☁️  🌾  💧  🌱  ⚠️  ✏️           │
│   ← 波が左から右へ順番に跳ねる →     │
│                                     │
│        お天気を分析中…               │
│                                     │
└─────────────────────────────────────┘
```

- アイコン6つ（ALL_TABS の順）を中央揃えで1行表示
- 有効・無効設定に関わらず常に6つ表示
- 無効状態のタブバー（TabBar）は表示しない（操作できないため不要）
- `glass-panel` の padding は現状維持（`0.75rem 1rem`）

---

## アニメーション仕様

### アイコンウェーブバウンス

```css
@keyframes iconWaveBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30%           { transform: translateY(-10px); }
}
```

| プロパティ | 値 |
|---|---|
| duration | 1.2s |
| easing | ease-in-out |
| iteration | infinite |
| delay（i番目） | i × 0.2s（0s / 0.2s / 0.4s / 0.6s / 0.8s / 1.0s） |

- 波がちょうど1.2sで1周し、ディレイと周期が一致するため滑らかに流れ続ける
- アイコンサイズ: 28px

### テキスト「…」点滅

```css
@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
```

| プロパティ | 値 |
|---|---|
| 対象 | 「…」部分のみ（`<span>` で分離） |
| duration | 1.4s |
| easing | ease-in-out |
| iteration | infinite |

---

## テキスト仕様

```
お天気を分析中<span class="dot-pulse">…</span>
```

- フォントサイズ: `0.82rem`
- カラー: `var(--accent-color)`
- マージン: アイコン行の下 `1rem`
- 中央揃え

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/components/weather/AiCommentCard.tsx` | `isStandardLoading` ブロックをアニメーション表示に差し替え |
| `src/index.css` | `@keyframes iconWaveBounce`・`@keyframes dotPulse`・`.dot-pulse` クラスを追加 |

---

## 非対応範囲

- アイコンへの色付け・カラー変化: なし（現行アイコン色を維持）
- アイコンの影・グロー効果: なし（シンプルに保つ）
- リアルタイムの進捗表示: なし（APIの進捗は取得不可）
