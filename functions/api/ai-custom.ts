// functions/api/ai-custom.ts
// Cloudflare Pages Function — カスタムAIコメント用 Gemini API プロキシ
//
// クライアントから天気予報ペイロード + ユーザー入力プロンプトを受け取り、
// Gemini に自由形式のテキスト回答を生成させて返す。

interface Env {
  GEMINI_API_KEY: string;
}

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `あなたは日本の農作業をサポートするアドバイザーです。
与えられた気象予報データを参考にしながら、ユーザーからの質問・指示に答えてください。

制約:
- 前置き・あいさつ・免責文は書かない。
- 読みやすさのため、適度に改行（\\n）を入れてください。ただし1文ごとの細かすぎる改行は避け、複数の文をまとめた段落を作り、1つの項目あたり2〜3箇所の改行になるようにしてください。`;

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await context.request.json() as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const customPrompt = typeof payload.customPrompt === 'string' ? payload.customPrompt.slice(0, 200) : '';
  if (!customPrompt) {
    return new Response(JSON.stringify({ error: 'customPrompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // customPrompt を除いた天気データを構築
  const { customPrompt: _omit, ...weatherData } = payload;

  const userContent = `気象予報データ:\n${JSON.stringify(weatherData)}\n\n質問・指示:\n${customPrompt}`;

  // JSON スキーマは使用しない。スキーマ付きだと長い日本語テキストが
  // maxOutputTokens 到達前に JSON として打ち切られ parse エラーになるため、
  // プレーンテキストで受け取り、こちら側で JSON ラップして返す。
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 2048,
    },
  };

  const callGemini = async (): Promise<string> => {
    const geminiRes = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      throw new Error(`gemini_http:${geminiRes.status}:${detail}`);
    }
    const json = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('gemini_empty');
    return text;
  };

  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const text = await callGemini();
      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    } catch (e) {
      lastError = e;
      if (e instanceof Error && e.message.startsWith('gemini_http:4')) break;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  return new Response(JSON.stringify({ error: 'ai-custom proxy failed', detail }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
};
