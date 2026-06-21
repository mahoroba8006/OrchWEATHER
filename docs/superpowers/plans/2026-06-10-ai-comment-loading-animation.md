# AIコメント ローディングアニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AIコメント取得中のスケルトン表示を、タブアイコンのウェーブバウンス＋「お天気を分析中…」テキストに差し替える。

**Architecture:** `index.css` にキーフレームとユーティリティクラスを追加し、`AiCommentCard.tsx` の `isStandardLoading` ブロックを新アニメーション JSX で置き換える。ライブラリ追加なし。

**Tech Stack:** React 19 + TypeScript、CSS @keyframes（既存 index.css に追記）

---

### Task 1: index.css にアニメーション用 CSS を追加

**Files:**
- Modify: `src/index.css`（`.ai-tab-bar::-webkit-scrollbar { display: none; }` ブロックの直後に追記）

- [x] **Step 1: 現在の末尾を確認し、追記位置を特定する**

`.ai-tab-bar` ブロックは `src/index.css` 約363行付近にある。`.ai-tab-bar::-webkit-scrollbar { display: none; }` の直後（スワイプ実装時に追記した `@keyframes slideInFromRight` の前）に挿入する。

- [x] **Step 2: 以下の CSS を `src/index.css` の `.ai-tab-bar::-webkit-scrollbar { display: none; }` の直後に追加する**

```css
@keyframes iconWaveBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30%           { transform: translateY(-10px); }
}
@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
.dot-pulse {
  display: inline-block;
  animation: dotPulse 1.4s ease-in-out infinite;
}
```

- [x] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

---

### Task 2: AiCommentCard.tsx のローディング表示を差し替える

**Files:**
- Modify: `src/components/weather/AiCommentCard.tsx`（`isStandardLoading` の return ブロック）

- [x] **Step 1: 現在の `isStandardLoading` ブロックを以下に差し替える**

対象: `if (isStandardLoading) { return ( ... ); }` 全体

```tsx
if (isStandardLoading) {
  return (
    <section className="glass-panel" style={{ padding: '1.2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {ALL_TABS.map(({ key, Icon }, i) => (
          <span
            key={key}
            style={{
              display: 'inline-flex',
              color: 'var(--accent-color)',
              animation: 'iconWaveBounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          >
            <Icon size={28} />
          </span>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--accent-color)' }}>
        お天気を分析中<span className="dot-pulse">…</span>
      </div>
    </section>
  );
}
```

- [x] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

期待: 型エラーなし・`✓ built in ...`

- [x] **Step 3: dev server で目視確認する**

```bash
npm run dev
```

確認項目:
- AIコメントカードのローディング中に6つのアイコンが左から順に上下に跳ねる
- 「お天気を分析中…」の「…」が点滅する
- ロード完了後は通常のタブ表示に切り替わる

- [x] **Step 4: コミットする**

```bash
git add src/components/weather/AiCommentCard.tsx src/index.css
git commit -m "feat: AIコメント ローディングをウェーブバウンスアニメーションに刷新"
```
