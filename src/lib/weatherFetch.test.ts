import { afterEach, describe, expect, it, vi } from 'vitest';
import { weatherFetch, WeatherFetchError } from './weatherFetch';

afterEach(() => vi.unstubAllGlobals());

const respond = (status: number) => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));

describe('weatherFetch のエラー分類', () => {
  it('429（利用回数・同時接続の上限）は「アクセス集中」として区別する', async () => {
    respond(429);
    const err = await weatherFetch('https://x').catch(e => e);
    expect(err).toBeInstanceOf(WeatherFetchError);
    expect(err.kind).toBe('busy');
    expect(err.message).toContain('集中');
  });
  it('5xx は取得元の不調', async () => {
    respond(503);
    const err = await weatherFetch('https://x').catch(e => e);
    expect(err.kind).toBe('upstream');
  });
  it('成功時は Response を返す', async () => {
    respond(200);
    expect((await weatherFetch('https://x')).status).toBe(200);
  });
});
