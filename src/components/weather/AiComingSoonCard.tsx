// src/components/weather/AiComingSoonCard.tsx
// AI コメント非許可ユーザー（未ログイン／ログイン非許可）に表示する Coming Soon カード。
// 既存 AiCommentCard と同じ glass-panel の枠で、AI枠の位置を保つ。

import { Sparkles } from 'lucide-react';

export function AiComingSoonCard() {
  return (
    <section className="glass-panel" style={{ padding: '1.4rem 1.2rem', textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--accent-color)',
          fontWeight: 700,
          fontSize: '0.9rem',
          marginBottom: '0.5rem',
        }}
      >
        <Sparkles size={16} /> AIによる段取りまとめ
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        近日提供予定です。気象データから散布・施肥・畑しごとの段取りをAIが提案します。
      </p>
    </section>
  );
}
