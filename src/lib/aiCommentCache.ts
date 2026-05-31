// src/lib/aiCommentCache.ts
//
// AI コメントの Firestore ユーザー別キャッシュ。
// パス: /users/{uid}/aiComments/{hash}（既存セキュリティルールがそのまま効く）
// TTL: 4時間。書き込みは await + try/catch（プロジェクト方針）で呼び出し元が保護する。

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { AiCommentData } from '../api/aiComment';

const TTL_MS = 4 * 60 * 60 * 1000; // 4時間

export async function readAiCommentCache(
  uid: string,
  hash: string,
): Promise<AiCommentData | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'aiComments', hash));
  if (!snap.exists()) return null;
  const data = snap.data();
  const cachedAt: number = data.cachedAt?.toMillis?.() ?? 0;
  if (Date.now() - cachedAt > TTL_MS) return null;
  return {
    weatherPoint: Array.isArray(data.weatherPoint) ? data.weatherPoint : [],
    workWindows: Array.isArray(data.workWindows) ? data.workWindows : [],
  };
}

export async function writeAiCommentCache(
  uid: string,
  hash: string,
  data: AiCommentData,
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'aiComments', hash), {
    weatherPoint: data.weatherPoint,
    workWindows: data.workWindows,
    cachedAt: serverTimestamp(),
  });
}
