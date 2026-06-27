// functions/api/_auth.ts
// Firebase ID トークン検証（Cloudflare Pages Function / WebCrypto, Admin SDK不使用）。
// Google の securetoken x509 証明書を取得し jose で RS256 署名・iss/aud/exp を検証する。
// 証明書はレスポンスの Cache-Control: max-age を尊重してモジュール内メモリにキャッシュする。

import { importX509, jwtVerify, decodeProtectedHeader } from 'jose';

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertMap { [kid: string]: string }

let certCache: { certs: CertMap; expiresAt: number } | null = null;

async function getCerts(): Promise<CertMap> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) return certCache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`);
  const certs = (await res.json()) as CertMap;
  const m = (res.headers.get('Cache-Control') ?? '').match(/max-age=(\d+)/);
  const maxAge = m ? parseInt(m[1], 10) : 3600;
  certCache = { certs, expiresAt: now + maxAge * 1000 };
  return certs;
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
}

/** Authorization ヘッダーから Bearer トークンを取り出す。無ければ null。 */
export function getBearerToken(request: Request): string | null {
  const h = request.headers.get('Authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/** Firebase ID トークンを検証して uid/email を返す。失敗時は throw。 */
export async function verifyIdToken(token: string, projectId: string): Promise<VerifiedUser> {
  const { kid } = decodeProtectedHeader(token);
  if (!kid) throw new Error('no kid in token header');
  const certs = await getCerts();
  const pem = certs[kid];
  if (!pem) throw new Error('unknown kid');
  const key = await importX509(pem, 'RS256');
  // 注: email_verified は検査していない。許可リストは手動管理の明示メールのみのため十分。
  // 将来ドメイン一致（@example.com 等）に広げる場合は email_verified === true の検査を追加すること。
  const { payload } = await jwtVerify(token, key, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) throw new Error('no sub in token');
  const email = typeof payload.email === 'string' ? payload.email : null;
  return { uid, email };
}

/** email が許可リスト（カンマ区切り env）に含まれるか。大文字小文字を無視。 */
export function isAllowlisted(email: string | null, allowlist: string | undefined): boolean {
  if (!email || !allowlist) return false;
  const set = allowlist
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return set.includes(email.toLowerCase());
}

/** AI エンドポイント共通の認可ガード。拒否時はその Response を、許可時は null を返す。 */
export async function requireAiAccess(
  request: Request,
  env: { AI_ALLOWLIST: string; FIREBASE_PROJECT_ID: string },
): Promise<Response | null> {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const token = getBearerToken(request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  let email: string | null;
  try {
    ({ email } = await verifyIdToken(token, env.FIREBASE_PROJECT_ID));
  } catch {
    return json({ error: 'invalid token' }, 401);
  }
  if (!isAllowlisted(email, env.AI_ALLOWLIST)) return json({ error: 'forbidden' }, 403);
  return null;
}
