// src/lib/weatherFetch.ts
// 気象データ取得（Open-Meteo）の共通フェッチ＋エラー分類器。
//
// fetch の失敗は原因によって意味が異なるが、ブラウザからは「サーバーが落ちている」のか
// 「ユーザー自身がオフライン」なのかを完全には区別できない（fetch reject はどちらも同じ
// TypeError "Failed to fetch" になる）。確実に判定できるのは次の2ケースのみ:
//   - サーバーがエラー応答した（5xx/429）            → 取得元（Open-Meteo）側の問題で確定
//   - navigator.onLine === false（端末がオフライン）  → ユーザー側の問題で確定
// それ以外（オンラインなのに到達不能＝グレーゾーン）は「取得元側の可能性が高い」に寄せる
// （オフラインは先に捕捉済みのため）。

export type WeatherFetchErrorKind = 'offline' | 'upstream' | 'data';

const MESSAGES: Record<WeatherFetchErrorKind, string> = {
  offline: 'インターネット接続が確認できません。接続を確認して ↻ で再試行してください。',
  upstream: '気象データの取得元がメンテナンス中、または現在使用できません。数時間後に再試行してください。',
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

/** 端末がオフラインだと確実に分かる場合のみ true。判定不能なブラウザでは false 扱い。 */
function isDefinitelyOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Open-Meteo へのフェッチを行い、失敗を WeatherFetchError に分類して throw する。
 * 成功時は Response を返す（呼び出し側は従来どおり res.json() 等を行う）。
 */
export async function weatherFetch(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    // fetch 自体が reject = 到達不能。オフライン確定なら user 側、それ以外は取得元側へ寄せる。
    throw new WeatherFetchError(isDefinitelyOffline() ? 'offline' : 'upstream');
  }
  if (!res.ok) {
    // サーバーが応答した上でのエラー。5xx/429 は取得元側の不調で確定。
    if (res.status >= 500 || res.status === 429) {
      throw new WeatherFetchError('upstream');
    }
    // 4xx 等（想定外のリクエスト不備など）は汎用メッセージへ。
    throw new WeatherFetchError('data');
  }
  return res;
}

/** レスポンス本文が想定形式でないときに使う（呼び出し側で形式検査した後に throw 用）。 */
export function weatherDataError(): WeatherFetchError {
  return new WeatherFetchError('data');
}
