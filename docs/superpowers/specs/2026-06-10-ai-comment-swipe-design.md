# AIコメントタブ スワイプナビゲーション 設計書

**日付:** 2026-06-10  
**対象コンポーネント:** `src/components/weather/AiCommentCard.tsx`

---

## 概要

モバイルで AI コメントカードのタブを左右スワイプで切り替えられるようにする。  
スライドアニメーション付き。外部ライブラリ追加なし。

---

## 動作仕様

| 操作 | 挙動 |
|---|---|
| コンテンツ部分を左スワイプ | 次のタブへ（右からスライドイン） |
| コンテンツ部分を右スワイプ | 前のタブへ（左からスライドイン） |
| タブをタップして切替 | インデックス差からスライド方向を自動判定 |
| 端のタブで端方向スワイプ | 何もしない（ループなし） |
| 縦方向の動きが支配的な場合 | スワイプとして無視（`|dy| > |dx|`） |

スワイプ検知閾値: **60px**

---

## 実装方式

### スワイプ検知

`AiCommentCard` コンポーネント内にインラインで実装。

```
touchstart → startX / startY を記録
touchend   → dx = endX - startX
             if |dx| > 60 && |dy| < |dx|:
               dx < 0 → 次のタブへ（slide-in-right）
               dx > 0 → 前のタブへ（slide-in-left）
```

`touchmove` は使わない（スクロールとの競合を避けるため `passive` ハンドラ不要）。

### アニメーション

- コンテンツ div に `key={activeTab}` を付与 → タブ変更で React が再マウント
- `slideDirection: 'left' | 'right' | null` を `useRef` で管理（state にしない → 再レンダリング不要）
- 再マウント時に `slide-in-left` または `slide-in-right` CSS クラスを適用

### CSS（index.css に追加）

```css
@keyframes slideInFromRight {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes slideInFromLeft {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
.slide-in-right { animation: slideInFromRight 0.22s ease-out; }
.slide-in-left  { animation: slideInFromLeft  0.22s ease-out; }
```

コンテンツラッパーに `overflow: hidden` を追加してはみ出しを隠す。

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/components/weather/AiCommentCard.tsx` | スワイプロジック追加、`handleTabSelect` でスライド方向管理、コンテンツ div に `key` とクラス付与 |
| `src/index.css` | `@keyframes slideInFromRight/Left` と `.slide-in-*` クラスを追加 |

---

## 考慮事項・非対応範囲

- **リアルタイムのドラッグ追従（指に追従する効果）**: 非対応。スワイプ完了後にアニメーションする方式を採用。
- **タブバー部分のスワイプ**: 検知対象はコンテンツエリアのみ（タブバーは既存の横スクロールを維持）
- **ローディング中**: `isStandardLoading` の場合はスワイプ無効（タブ操作が `disabled` と同じ扱い）
