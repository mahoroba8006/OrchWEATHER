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
