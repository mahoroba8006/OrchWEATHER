// 空のアドバイス（AI コメント）の停止中は、AI エンドポイントが Gemini を呼ばずに 503 を返すこと。
// /api/ai-comment・/api/ai-custom はどちらも Gemini を呼ぶ前に requireAiAccess を通る
// （ハンドラ本体は Cloudflare の型に依存し tsc -b の対象外のため、共通ガードで確かめる）。
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AI_ADVICE_ENABLED } from './features';
import { AI_ENDPOINTS_ENABLED, requireAiAccess } from '../../functions/api/_auth';

const env = { AI_ALLOWLIST: 'a@example.com', FIREBASE_PROJECT_ID: 'p' };

afterEach(() => vi.restoreAllMocks());

describe('空のアドバイスの停止', () => {
  it('クライアントとサーバーのフラグがどちらも停止になっている', () => {
    expect(AI_ADVICE_ENABLED).toBe(false);
    expect(AI_ENDPOINTS_ENABLED).toBe(false);
  });

  it('requireAiAccess はトークン検証も外部通信もせずに 503 を返す', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const req = new Request('https://x/api/ai-comment', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
    const res = await requireAiAccess(req, env);
    expect(res?.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
