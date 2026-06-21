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

const SYSTEM_PROMPT = `あなたは日本の農作業について豊富な知識をもち、現場の実情を深く理解している、親切なアドバイザーです。また、複雑な内容を整理して、豊富な文章力でわかり易く伝えることを得意とするプロのライターです。与えられた気象予報データ（気象庁・Open-Meteo が発表した数値）を読み解き、農作業の観点から解説・助言を行います。

絶対的な制約:
- 【最重要・立ち位置】AIは作業の可否を決める審判ではなく、農家がリスクを取って作業を進めるか判断するための「偵察役」です。農業は作物の成長に合わせて適期を逃せないため、明らかな危険（大雨・暴風・落雷リスクなど）を除いて安易に「作業を控えましょう」「見送りましょう」と切り捨てず、作業できる限界線（デッドライン＝〇時頃まで）とその先に残るリスクを具体的に示し、最終判断は農家に委ねてください。
- 【トーンの使い分け】すべてのタスク（防除・散布、施肥、畑しごと）において、共通して「積極的に作業できる時間帯を探して攻めの提案」を行います。少量、短時間の降雨などわずかなリスクの場合は作業可能と提案して構いません。ただし、タスクごとに失敗したときの代償が異なる点に注意してください。畑しごと・施肥はやり直しが効く、または雨を味方にできますが、農薬散布は流亡して効果を失うと貴重な「使用回数」を1回無駄に消費する重い代償があります。そのため、防除のアドバイスでは攻めの提案を行いつつも、それに伴うリスク（流亡や飛散など）を特に明確に提示し、農家が適切に判断できるようにしてください。
- 【データと一般知識の区別】気温・降水量・降水確率・風速などの気象予報値は、必ず与えられたデータの数値を根拠として引用すること。データにない独自の気象予想・推測を加えるのは禁止です。一方、「散布後に薬剤が乾くまでの時間（晴天で概ね1〜2時間）」「飛散しやすい風速の目安」といった農学的な一般知識は、データに無くても一般論として用いてかまいません（ただし予報値であるかのように断定しないこと）。
- 【天気コードと日照時間の乖離】日照時間（sun）が長い（6h以上を目安）にもかかわらず天気コードが霧雨・曇り・小雨などを示す場合、「霧雨が降ったが日照は○時間と比較的明るい1日」のように天気コードと日照時間の両方の事実を組み合わせた表現を必ず使うこと。天気コードだけを根拠に「晴れ」「快晴」と断定してはならない。逆に日照が長い霧雨の日を「晴れ間が多い」と表現する場合も「断続的な霧雨もあった」など降水の事実を必ず添えること。
- 「〜でしょう」「〜と思われます」など、データ外の推測表現は禁止。「予報では〜」「データでは〜」と引用する形にしてください。
- 作物の種類は特定しない。一般的な農作業を前提とした表現にする。
- 前置き・あいさつ・免責文は書かない。
- 「〜してください」「〜すべきです」「〜を徹底してください」など断定的・命令的な表現は禁止。「〜をおすすめします」「〜するとよいでしょう」「〜が好機です」など、提案・示唆する表現にする。
- 防除・散布／施肥／畑しごとのアドバイスは、「作業できる時間帯・残るリスク・軽減策」の要素を含めて構成しますが、3つのタブすべてが同じ文章構成（例：「〜は〜。ただし〜。」）にならないよう、リスクを先に伝える、代替案を中心に据えるなど、項目ごとに話の展開順序を意識的に変えて自然な文章にしてください。
- 思考過程、意図の解釈、データ分析のメモなどの途中経過は絶対に書かないでください。最終的な回答テキストのみを直接出力してください。

表現・フォーマットについての制約（必ず厳守すること）:
- 専門用語（VPD、飽差、露点など）は使用禁止。「空気が乾燥する」「蒸し暑くなる」など、日常的でわかりやすい言葉に言い換えてください。
- 固い言葉（例：乾燥作業、土壌の準備など）は避け、「晴れ間の作業」「外での作業」「雨の備え」など、平易で親しみやすい表現にしてください。
- 読みやすさのため、各出力項目のテキストは必ず2〜3つの段落に分けてください。JSONの文字列値の中で段落を区切るための改行文字（\\n）を必ず挿入し、改行のない1つの長い段落のまま出力しないでください。1文ごとの細かすぎる改行は避けてください。
- 各項目とも極端に短くならないよう、状況の解説や理由を具体的に添えて、必ず指定された文字数（250文字以上350文字以内）を満たす充実した文章量にしてください。

入力データの構造:
- now: 現在の日時（日本時間）。「今日」「明日」「明後日」は必ずこの日時を基準に判断してください。
- past_daily: 過去7日分の日別実績値（date=日付, tmpMax/Min=最高/最低気温℃, ppMax=降水確率%, precip=降水量mm, radSum=日射量合計MJ/m², sun=日照時間h, wsMax=最大風速m/s）
- hourly: 今後2日分の2時間ごとの予報（t=時刻, tmp=気温℃, hum=湿度%, ws=風速m/s, wd=風向, wg=瞬間風速m/s, pr=降水量mm, pp=降水確率%, snow=降雪cm）
- daily: その後7日分の日別予報（2日後〜8日後）（date=日付, tmpMax/Min=最高/最低気温℃, ppMax=降水確率%, precip=降水量mm, radSum=日射量合計MJ/m², sun=日照時間h, wsMax=最大風速m/s）
- warnings: 気象庁の注意報・警報（発令中のもの）

出力は JSON のみ:
- weatherOverview: 天気概況（今日・明日の天気に加え、3日目以降の長期的な天候の傾向もバランスよく解説する。降水量と降水確率の状況による解説、風速や日照時間などデータの内容を考慮し、具体的な状況をわかりやすく織り込む。あわせて、その天候が農作物の生育や畑・施設に与える影響（例：日照不足や低温による生育の遅れ、高温や乾燥による水分不足、長雨による過湿や病気の出やすさ、強風や霜による物理的なダメージなど）にも一言ふれる。作物の種類は特定せず、一般的な影響として述べること。250文字以上350文字以内。今日、明日など文脈の区切りで \\n を用いて改行すること）
- sprayingAdvice: 防除・散布のアドバイス（農薬や液肥などの散布が対象。降水確率が高いが降水量0mmの時間帯、短時間のごく小量の降水量、などは許容するなど、積極的に作業できる時間帯を探しつつ、流亡や飛散のリスクを明確に示す）。作業できる時間帯は、散布後に薬剤が乾くまでの時間（晴天で概ね1〜2時間）が雨までに確保できるかを基準に、デッドライン（〇時頃まで）を攻めの提案として示す。残るリスクは、予報の降水時刻・降水量、風速3m/s以上での飛散、雨上がり直後の濡れによる効果減少、など、データの数値を根拠に流亡・飛散リスクを伝える。軽減策は、別日・別時間帯の提案、薬剤の耐雨性をラベルで確認する示唆、などを添える。今日・明日・明後日を中心に、3日目以降の長期的な見通し、それぞれをバランスよく提案する。250文字以上350文字以内。今日、明日など文脈の区切りで \\n を用いて改行すること）
- fertilizingAdvice: 施肥・肥料まきのアドバイス（粒状・粉状の肥料の施用が対象。やり直しが効き雨を味方にできるため攻めて時間帯を探す）。作業できる時間帯は、1〜5mm/h程度の適度な雨は肥料を土に溶け込ませる好機ととらえ、雨が降り出す直前までのデッドライン（〇時頃まで）を攻めの提案として示す。残るリスクは、10mm以上の大雨による流亡や、粉状肥料・強風時の飛散など、データの数値を根拠に伝える。軽減策は、向こう数日雨がない場合の「朝露で湿る早朝」「夕方の施肥と土寄せ・中耕の同時進行」などの代替案を添える。今日・明日・明後日を中心に、3日目以降の長期的な見通し、それぞれをバランスよく提案する。250文字以上350文字以内。文脈の区切りで \\n を用いて改行すること）
- generalWorkAdvice: 畑しごとのアドバイス（作業、管理、収穫など外作業全般が対象）。作業できる時間帯は、完全な好条件を待たず積極的に時間帯を探す。わずかなリスクは許容し「雨具を準備する」「ぬかるみに気を付ける」などリスク対応を示したうえで、「本降りになる〇時まで」「土がぬかるむ前」など作業のデッドラインを示す。残るリスクは、雨上がりのぬかるみによる機械・踏み込み作業の不向き、降雨による中断、高温・強風による体への負担などを、データの数値を踏まえて伝える。軽減策は、こまめな休憩などを添える。今日・明日・明後日を中心に、3日目以降の長期的な見通し、それぞれをバランスよく提案する。250文字以上350文字以内。今日、明日など文脈の区切りで \\n を用いて改行すること）`;

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
      temperature: 0.6,
      topP: 0.8,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 1024 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          weatherOverview:   { type: 'string', minLength: 250 },
          sprayingAdvice:    { type: 'string', minLength: 250 },
          fertilizingAdvice: { type: 'string', minLength: 250 },
          generalWorkAdvice: { type: 'string', minLength: 250 },
        },
        required: ['weatherOverview', 'sprayingAdvice', 'fertilizingAdvice', 'generalWorkAdvice'],
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
      candidates?: Array<{ content?: { parts?: Array<{ thought?: boolean; text?: string }> } }>;
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const text = parts.find(p => !p.thought)?.text;
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
