// functions/api/me.ts
// ログイン中ユーザーが AI 許可リストに含まれるかを返す。
// クライアントはこの aiAllowed 1値で「実AI vs Coming Soon」「地点上限50 vs 10」を分岐する。

import { getBearerToken, verifyIdToken, isAllowlisted } from './_auth';

interface Env {
  AI_ALLOWLIST: string;
  FIREBASE_PROJECT_ID: string;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequest: PagesFunction<Env> = async (context) => {
  const token = getBearerToken(context.request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    const { email } = await verifyIdToken(token, context.env.FIREBASE_PROJECT_ID);
    return json({ aiAllowed: isAllowlisted(email, context.env.AI_ALLOWLIST) }, 200);
  } catch {
    return json({ error: 'invalid token' }, 401);
  }
};
