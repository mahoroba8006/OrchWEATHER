// src/api/aiComment.ts
//
// Cloudflare Pages Function (/api/ai-comment) を呼ぶクライアント側 fetch。
// vite dev（wrangler 不使用）では Function が存在せず SPA の index.html が返るため、
// Content-Type が JSON でない場合はエラーにして呼び出し元でグレースフルに無視させる。

import type { AiCommentInput } from '../lib/aiCommentInput';

export interface AiCommentData {
  weatherPoint: string[];
  workWindows: string[];
}

export async function fetchAiComment(input: AiCommentInput): Promise<AiCommentData> {
  const res = await fetch('/api/ai-comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`AI comment API error: ${res.status}`);
  }

  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    // vite dev で Function 未稼働 → HTML が返るケース
    throw new Error('AI comment endpoint unavailable (non-JSON response)');
  }

  const data = await res.json() as Partial<AiCommentData>;
  return {
    weatherPoint: Array.isArray(data.weatherPoint) ? data.weatherPoint : [],
    workWindows: Array.isArray(data.workWindows) ? data.workWindows : [],
  };
}
