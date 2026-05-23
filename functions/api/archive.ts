// functions/api/archive.ts
// Cloudflare Pages Function — archive-api.open-meteo.com へのプロキシ（スタンバイ）
//
// 【通常運用】src/api/weather.ts の baseUrl は直接 archive-api.open-meteo.com を指す。
// 【切り替え手順】archive-api が日本ネットワークから到達不能になった場合:
//   1. src/api/weather.ts の baseUrl を '/api/archive' に変更（コメント参照）
//   2. vite.config.ts のプロキシ設定をコメントイン
//   3. デプロイ → このファイルが CF エッジプロキシとして機能する
//
// このファイルは CF Pages にデプロイされているが、baseUrl が直接URLを指す限り呼ばれない。

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = `https://archive-api.open-meteo.com/v1/archive${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // 同じ年・地点データのキャッシュ（1時間）
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'archive proxy failed', detail: String(e) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
