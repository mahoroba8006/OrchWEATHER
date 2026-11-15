import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { weatherFetchJson, WeatherFetchError } from './weatherFetch';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ok = (body: unknown = { a: 1 }) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response('{}', { status: code });

/** fetch の応答を順に返す（関数なら呼ぶ）。最後の要素を使い回す */
function stubFetch(...steps: Array<Response | Error | ((init?: RequestInit) => Promise<Response>)>) {
  let i = 0;
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    const s = steps[Math.min(i++, steps.length - 1)];
    if (typeof s === 'function') return s(init);
    if (s instanceof Error) throw s;
    return s.clone();
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** 待ち時間を進めながら結果（成功値またはエラー）を取り出す */
async function run(url = 'https://x') {
  const p = weatherFetchJson(url).then(v => ({ v }), e => ({ e }));
  await vi.runAllTimersAsync();
  return p as Promise<{ v?: unknown; e?: any }>;
}

describe('weatherFetchJson のエラー分類', () => {
  it('429（利用回数・同時接続の上限）は「アクセス集中」とし、取り直さない', async () => {
    const fn = stubFetch(status(429));
    const { e } = await run();
    expect(e).toBeInstanceOf(WeatherFetchError);
    expect(e.kind).toBe('busy');
    expect(e.message).toContain('集中');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('4xx は取り直さない', async () => {
    const fn = stubFetch(status(400));
    expect((await run()).e.kind).toBe('data');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('成功時は JSON を返す', async () => {
    stubFetch(ok({ hello: 'world' }));
    expect((await run()).v).toEqual({ hello: 'world' });
  });
});

describe('weatherFetchJson の取り直し', () => {
  it('開いた直後の一瞬の失敗（届かない）は取り直して成功する', async () => {
    const fn = stubFetch(new TypeError('Load failed'), ok());
    expect((await run()).v).toEqual({ a: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('5xx も取り直す。3回とも駄目なら取得元の不調', async () => {
    const fn = stubFetch(status(503));
    expect((await run()).e.kind).toBe('upstream');
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('3回とも届かなければ「通信が不安定」（メンテナンス中とは言わない）', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const { e } = await run();
    expect(e.kind).toBe('network');
    expect(e.message).not.toContain('メンテナンス');
  });
  it('本文の途中切れも取り直す', async () => {
    const broken = new Response('{}', { status: 200 });
    vi.spyOn(broken, 'json').mockRejectedValue(new TypeError('Load failed'));
    const fn = stubFetch(async () => broken, ok());
    expect((await run()).v).toEqual({ a: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('本文が JSON でなければ形式の問題として取り直さない', async () => {
    const fn = stubFetch(new Response('<html>', { status: 200 }));
    expect((await run()).e.kind).toBe('data');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('応答が返らないときは20秒で打ち切って取り直す', async () => {
    const hang = (init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    const fn = stubFetch(hang, ok());
    const p = weatherFetchJson('https://x');
    await vi.advanceTimersByTimeAsync(19_999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1 + 1000);
    expect(fn).toHaveBeenCalledTimes(2);
    await expect(p).resolves.toEqual({ a: 1 });
  });
  it('オフラインなら通信が戻るのを待ってから取り直す', async () => {
    let online = false;
    vi.stubGlobal('navigator', { get onLine() { return online; } });
    const fn = stubFetch(new TypeError('offline'), ok());
    const p = weatherFetchJson('https://x');
    await vi.advanceTimersByTimeAsync(1000 + 5000);
    expect(fn).toHaveBeenCalledTimes(1); // まだ戻るのを待っている
    online = true;
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toEqual({ a: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
