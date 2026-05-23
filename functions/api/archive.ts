// functions/api/archive.ts
// Cloudflare Pages Function — archive-api.open-meteo.com へのプロキシ
// archive-api は日本ネットワークから直接到達不能なため edge 経由で転送する

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
