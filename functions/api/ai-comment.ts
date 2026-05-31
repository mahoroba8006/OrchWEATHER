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

const SYSTEM_PROMPT = `あなたは日本の農業の現場監督者です。与えられた気象予報データ（気象庁・Open-Meteo が発表した数値）を読み解き、農作業の観点から解説・助言を行います。

絶対的な制約:
- データに記載のない独自の気象予想・推測を加えてはいけません。必ず与えられた数値を根拠として述べてください。
- 「〜でしょう」「〜と思われます」など、データ外の推測表現は禁止。「予報では〜」「データでは〜」と引用する形にしてください。
- 作物の種類は特定しない。一般的な農作業を前提とした表現にする。
- 前置き・あいさつ・免責文は書かない。
- 「〜してください」「〜すべきです」「〜を徹底してください」など断定的・命令的な表現は禁止。「〜をおすすめします」「〜するとよいでしょう」「〜が好機です」など、提案・示唆する表現にする。

入力データの構造:
- hourly: 今後3日分の時間別予報（t=時刻, tmp=気温℃, dew=露点℃, hum=湿度%, vpd=飽差kPa, ws=風速m/s, wd=風向, wg=瞬間風速m/s, pr=降水量mm, pp=降水確率%, rad=日射量W/m², uv=UV指数, snow=降雪cm）
- daily: その後4日分の日別予報（date=日付, tmpMax/Min=最高/最低気温℃, ppMax=降水確率%, precip=降水量mm, radSum=日射量合計MJ/m², sun=日照時間h, wsMax=最大風速m/s）
- warnings: 気象庁の注意報・警報（発令中のもの）

出力は JSON のみ:
- weatherOverview: 天気概況（今日・明日および今後の天気をデータに基づき150文字程度で解説。農作物への影響に一言触れる）
- workAdvice: 作業アドバイス（農業現場監督の立場で、天候を踏まえた作業タイミングを150文字程度で提案。晴れ間・風・雨前後のタイミングなど）`;

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
          weatherOverview: { type: 'string' },
          workAdvice: { type: 'string' },
        },
        required: ['weatherOverview', 'workAdvice'],
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
