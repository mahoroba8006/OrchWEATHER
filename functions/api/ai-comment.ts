// functions/api/ai-comment.ts
// Cloudflare Pages Function — Gemini API プロキシ
//
// クライアントから入力ペイロード(JSON)を受け取り、Gemini 2.0 Flash に
// 「確定予報値の農業的解説 + 作業好適時間帯の言い回し」を生成させて返す。
// GEMINI_API_KEY はサーバーサイド（CF 環境変数）にのみ存在し、クライアントには露出しない。
//
// 重要: AI には新たな気象予想を一切させない。既に発表された予報値の解説のみ。

interface Env {
  GEMINI_API_KEY: string;
}

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `あなたは日本の農業に詳しいアドバイザーです。与えられた気象データ（気象庁・Open-Meteo が既に発表した確定予報値）を解釈し、農作業の助言を行います。

絶対的な制約:
- あなた自身は新たな気象予想を一切してはいけません。与えられた数値の意味を解説し、農作業上の助言を述べるだけです。
- 「〜になるでしょう」「〜が予想されます」のような、あなた自身が予想する表現は禁止。「予報では〜」「データ上は〜」と既存予報を引用する形にしてください。
- 各項目は必ず1文・40字以内で完結させる。長い文は禁止。前置き・あいさつ・一般論・免責文は書かない。
- 作物が特定できない前提で、普遍的な農業物理（蒸れ・霜・乾燥・作業適性など）の観点で述べる。

出力は JSON のみ:
- weatherPoint: 気象データの農業的な意味の解説（1〜3項目の文字列配列）
- workWindows: 入力の calmWindows（アプリが抽出済みの作業好適時間帯候補）を、農作業の観点でどう活かせるか言い換えた助言（0〜3項目。候補が空なら空配列）`;

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

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: JSON.stringify(payload) }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          weatherPoint: { type: 'array', items: { type: 'string' } },
          workWindows: { type: 'array', items: { type: 'string' } },
        },
        required: ['weatherPoint', 'workWindows'],
      },
    },
  };

  try {
    const geminiRes = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return new Response(JSON.stringify({ error: 'gemini error', detail }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const json = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(JSON.stringify({ error: 'empty gemini response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // text は responseSchema により JSON 文字列。そのまま透過して返す
    // （クライアントが JSON.parse する。ここでパース検証だけ行う）
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(JSON.stringify({ error: 'gemini returned non-JSON', detail: text }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'ai-comment proxy failed', detail: String(e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
