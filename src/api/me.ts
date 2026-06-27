// src/api/me.ts
// /api/me を呼び、ログイン中ユーザーが AI 許可リストに含まれるかを取得する。
// 失敗時は false（安全側）。

import { auth } from '../lib/firebase';

export async function fetchAiAllowed(): Promise<boolean> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('Content-Type') ?? '';
    if (!contentType.includes('application/json')) return false; // vite dev 等で Function 未稼働
    const data = (await res.json()) as { aiAllowed?: unknown };
    return data.aiAllowed === true;
  } catch {
    return false;
  }
}
