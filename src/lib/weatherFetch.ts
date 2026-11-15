// src/lib/weatherFetch.ts
// 気象データ取得（Open-Meteo）の共通フェッチ＋自動の取り直し＋エラー分類器。
//
// スマホでアプリを開いた直後や画面を前に戻した直後は、端末がオンライン扱いでも通信が
// まだ立ち上がっておらず、1回目の fetch が失敗することがある（再読み込みすれば取れる）。
// そのため一時的な失敗（届かない・時間切れ・5xx・本文の途中切れ）は少し待って取り直す。
// 429（利用上限）と 4xx は取り直しても良くならない（429 はむしろ悪化する）ので即エラー。
//
// ブラウザからは「取得元が落ちている」のか「端末側の通信が不安定」なのかを区別できない
// （fetch reject はどちらも TypeError になる）。確実に分かるのは次だけ:
//   - 5xx                          → 取得元側の不調で確定（upstream）
//   - 429                          → 利用上限による一時制限で確定（busy）
//   - navigator.onLine === false   → 端末がオフラインで確定（offline）
// それ以外の届かない・時間切れは network（通信が不安定か、取得元に一時的につながらない）。

export type WeatherFetchErrorKind = 'offline' | 'network' | 'upstream' | 'busy' | 'data';

const MESSAGES: Record<WeatherFetchErrorKind, string> = {
  offline: 'インターネット接続が確認できません。接続を確認して ↻ で再試行してください。',
  network: '通信が不安定か、気象データの取得元に一時的につながりません。少し時間をおいて ↻ で再試行してください。',
  upstream: '気象データの取得元がメンテナンス中、または現在使用できません。数時間後に再試行してください。',
  // Open-Meteo 無料枠は IP ごとに1分・1時間・1日の上限があり、超えると 429 を返す（共有回線では他の人の利用も合算）
  busy: '気象データの取得元へのアクセスが集中しているため、一時的に制限されています。しばらくしてから ↻ で再試行してください。',
  data: 'データを取得できませんでした。↻ で再試行してください。',
};

/** ユーザー向け日本語メッセージを `.message` に持つエラー。表示側はそのまま出すだけでよい。 */
export class WeatherFetchError extends Error {
  readonly kind: WeatherFetchErrorKind;
  constructor(kind: WeatherFetchErrorKind) {
    super(MESSAGES[kind]);
    this.name = 'WeatherFetchError';
    this.kind = kind;
  }
}

/** 取り直す前の待ち時間（ミリ秒）。長さ＝取り直しの回数（計3回まで試す） */
const RETRY_DELAYS_MS = [1000, 3000];
/** 1回の通信の時間切れ。電波の弱い所でいつまでも待たせない */
const TIMEOUT_MS = 20_000;
/** 過去データ（archive）は年数が多いと正常でも10秒を超えることがある（10年分で12.6秒を実測）ので長めに */
const ARCHIVE_TIMEOUT_MS = 60_000;
const timeoutFor = (url: string) => (url.includes('archive-api.open-meteo.com') ? ARCHIVE_TIMEOUT_MS : TIMEOUT_MS);
/** オフラインのとき、通信が戻るのを待つ上限 */
const ONLINE_WAIT_MS = 10_000;

/** 端末がオフラインだと確実に分かる場合のみ true。判定不能なブラウザでは false 扱い。 */
function isDefinitelyOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** 通信が戻るか上限時間がたつまで待つ */
function waitForOnline(maxMs: number): Promise<void> {
  if (!isDefinitelyOffline() || typeof window === 'undefined') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('online', done);
      resolve();
    };
    const timer = setTimeout(done, maxMs);
    window.addEventListener('online', done);
  });
}

/** 1回分の取得。本文の読み込みまで含めて時間切れを掛ける */
async function attempt(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutFor(url));
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch {
      throw new WeatherFetchError(isDefinitelyOffline() ? 'offline' : 'network');
    }
    if (!res.ok) {
      if (res.status === 429) throw new WeatherFetchError('busy');
      if (res.status >= 500) throw new WeatherFetchError('upstream');
      throw new WeatherFetchError('data');
    }
    try {
      return await res.json();
    } catch (e) {
      // 途中で切れた（時間切れ含む）なら通信の問題。届いた本文が JSON でないなら形式の問題
      if (e instanceof SyntaxError) throw new WeatherFetchError('data');
      throw new WeatherFetchError(isDefinitelyOffline() ? 'offline' : 'network');
    }
  } finally {
    clearTimeout(timer);
  }
}

/** 取り直す価値がある失敗か（一時的なものだけ） */
function isRetryable(kind: WeatherFetchErrorKind): boolean {
  return kind === 'offline' || kind === 'network' || kind === 'upstream';
}

/**
 * Open-Meteo から JSON を取得する。一時的な失敗は 1秒→3秒 待って計3回まで試し、
 * それでも駄目なら WeatherFetchError を throw する（`.message` はそのまま表示できる日本語）。
 */
export async function weatherFetchJson(url: string): Promise<any> {
  for (let i = 0; ; i++) {
    try {
      return await attempt(url);
    } catch (e) {
      const err = e instanceof WeatherFetchError ? e : new WeatherFetchError('data');
      if (!isRetryable(err.kind) || i >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[i]);
      await waitForOnline(ONLINE_WAIT_MS);
    }
  }
}

/** レスポンス本文が想定形式でないときに使う（呼び出し側で形式検査した後に throw 用）。 */
export function weatherDataError(): WeatherFetchError {
  return new WeatherFetchError('data');
}
