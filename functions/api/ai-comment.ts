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

const SYSTEM_PROMPT = `あなたは日本の農作業をサポートする親切なアドバイザーです。与えられた気象予報データ（気象庁・Open-Meteo が発表した数値）を読み解き、農作業の観点から解説・助言を行います。

絶対的な制約:
- データに記載のない独自の気象予想・推測を加えてはいけません。必ず与えられた数値を根拠として述べてください。
- 「〜でしょう」「〜と思われます」など、データ外の推測表現は禁止。「予報では〜」「データでは〜」と引用する形にしてください。
- 作物の種類は特定しない。一般的な農作業を前提とした表現にする。
- 前置き・あいさつ・免責文は書かない。
- 「〜してください」「〜すべきです」「〜を徹底してください」など断定的・命令的な表現は禁止。「〜をおすすめします」「〜するとよいでしょう」「〜が好機です」など、提案・示唆する表現にする。
- 思考過程、意図の解釈、データ分析のメモなどの途中経過は絶対に書かないでください。最終的な回答テキストのみを直接出力してください。

表現についての制約（重要）:
- 専門用語（VPD、飽差、露点など）は使用禁止。「空気が乾燥する」「蒸し暑くなる」など、日常的でわかりやすい言葉に言い換えてください。
- 固い言葉（例：乾燥作業、土壌の準備など）は避け、「晴れ間の作業」「外での作業」「雨の備え」など、平易で親しみやすい表現にしてください。
- 読みやすさのため、適度に改行（\n）を入れてください。ただし1文ごとの細かすぎる改行は避け、複数の文をまとめた段落を作り、1つの項目あたり2〜3箇所の改行になるようにしてください。

入力データの構造:
- now: 現在の日時（日本時間）。「今日」「明日」「明後日」は必ずこの日時を基準に判断してください。
- past_daily: 過去7日分の日別実績値（date=日付, tmpMax/Min=最高/最低気温℃, ppMax=降水確率%, precip=降水量mm, radSum=日射量合計MJ/m², sun=日照時間h, wsMax=最大風速m/s）
- hourly: 今後2日分の2時間ごとの予報（t=時刻, tmp=気温℃, hum=湿度%, ws=風速m/s, wd=風向, wg=瞬間風速m/s, pr=降水量mm, pp=降水確率%, snow=降雪cm）
- daily: その後5日分の日別予報（3日後〜7日後）（date=日付, tmpMax/Min=最高/最低気温℃, ppMax=降水確率%, precip=降水量mm, radSum=日射量合計MJ/m², sun=日照時間h, wsMax=最大風速m/s）
- warnings: 気象庁の注意報・警報（発令中のもの）

出力は JSON のみ:
- weatherOverview: 天気概況（今日・明日の天気に加え、3日目以降の長期的な天候の傾向にも触れてわかりやすく解説する。あわせて、その天候が農作物の生育や畑・施設に与える影響（例：日照不足や低温による生育の遅れ、高温や乾燥による水分不足、長雨による過湿や病気の出やすさ、強風や霜による物理的なダメージなど）にも一言ふれる。作物の種類は特定せず、一般的な影響として述べること。150文字程度、適宜改行を含む）
- disasterPrep: 天気の備え（荒天（強風・大雨・霜・猛暑など）だけでなく、晴天続きによる乾燥・土の乾き・熱ストレス、曇天続きによる日照不足・湿気による病気のリスクなど、天候のあらゆる側面から作物や施設への影響と備えを提案する。数日先の傾向も見据えること。特に注意すべき天候がなければ「現在、特に気になる天候リスクはありません」と記載する。150文字程度、適宜改行を含む）
- sprayingAdvice: 防除・散布のアドバイス（農薬の防除散布だけでなく、液肥など肥料の散布も対象とする。以下の優先順で判断して提案すること。①降雨リスク（最優先）：散布後、最低3時間（理想は4〜6時間）以内に1mm以上の降雨がない時間帯を最優先で提案する。降水確率だけでなく降水量の見込みも考慮する。②風の状況：穏やかで風向きが安定しているほど好条件。強い・不安定な風は飛散リスクがある。③気温と時間帯：散布液の蒸散を抑えるため、早朝から午前中早めの時間が望ましい。今日明日の好機と、数日先の天候崩れを見据えた計画的なタイミングを合わせて提案する。200文字程度、適宜改行を含む）
- fertilizingAdvice: 施肥・肥料まきのアドバイス（粒状・粉状の肥料の施用タイミングを対象とする。以下の優先順で判断して提案すること。①最適枠（最優先）：散布の半日〜1日後に1〜5mm/h程度の弱い雨が降る見込みがある時間帯を最優先で提案する（適度な水分で肥料が土に溶け込む）。②晴天継続時：向こう数日雨がない場合は「朝露で土壌表面が湿っている早朝」または「夕方に撒いてすぐ中耕・土寄せで土中に混ぜ込む」などの代替案を提案する。③排除条件：大雨直前（10mm程度以上）、または、強風直前（風速3m/s程度以上）のは流亡・飛散リスクがあるため避ける。数日先の天候の変化も見据えて計画的なタイミングを提案する。200文字程度、適宜改行を含む）
- generalWorkAdvice: 畑しごとのアドバイス（外での作業全般を対象とする。まず今日明日の天候を踏まえた一般的な外作業の好機・段取りを述べる。次に以下の順で掘り下げること。①雨と土の状態：機械作業・踏み込み作業は雨直後の軟化した土では不向き。長雨後の排水状況、雨前の駆け込み作業の可否も考慮する。②気温・体への負担：高温時は暑さ対策、早朝・夕方の作業を推奨。低温・強風時は防寒や作業時間の短縮にも言及する。③悪条件での外作業が必要な場合：安全確保・作業優先度の判断を提案する。今日明日の作業に加え、週後半の天候も見据えること。200文字程度、適宜改行を含む）`;

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
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          weatherOverview:   { type: 'string' },
          disasterPrep:      { type: 'string' },
          sprayingAdvice:    { type: 'string' },
          fertilizingAdvice: { type: 'string' },
          generalWorkAdvice: { type: 'string' },
        },
        required: ['weatherOverview', 'disasterPrep', 'sprayingAdvice', 'fertilizingAdvice', 'generalWorkAdvice'],
      },
    },
  };

  // Gemini を呼び出し、パース済みオブジェクトを返す。失敗時は Error を投げる。
  const callGemini = async (): Promise<unknown> => {
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
    return JSON.parse(text); // トークン超過で途切れた場合は SyntaxError を投げる
  };

  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const parsed = await callGemini();
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    } catch (e) {
      lastError = e;
      // 即座に解決しない HTTP エラー（4xx）はリトライしない
      if (e instanceof Error && e.message.startsWith('gemini_http:4')) break;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  return new Response(JSON.stringify({ error: 'ai-comment proxy failed', detail }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
};
