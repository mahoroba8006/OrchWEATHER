// src/lib/features.ts
//
// 機能の表示・停止を切り替えるフラグ。

// 空のアドバイス（AI コメント）。2026-10-20 に表示と AI への送信を停止した。
// ロジック（hooks/useAiComment・useAiCustomComment、api/aiComment、AiCommentCard、AiCommentSettings）は残してある。
// 戻すときは true にし、サーバー側の functions/api/_auth.ts の AI_ENDPOINTS_ENABLED も true にする。
export const AI_ADVICE_ENABLED = false;
