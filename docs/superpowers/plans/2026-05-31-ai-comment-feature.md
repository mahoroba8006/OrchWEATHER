# AI農作業コメント機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 天気タブに、既存の予報データを「農業的に翻訳」した気象ポイントと、アプリが抽出した作業好適時間帯を AI が言い回す「おすすめ作業タイミング」を表示する。

**Architecture:** Cloudflare Pages Function（`functions/api/ai-comment.ts`）を Gemini API のステートレスプロキシとして追加（既存 `functions/api/archive.ts` と同じ流儀。`GEMINI_API_KEY` は CF 環境変数）。クライアントは予報データから作業好適ウィンドウを決定論的に抽出し、入力ペイロード＋ハッシュを計算 → Firestore `/users/{uid}/aiComments/{hash}` を確認 → ミス時のみ Function を呼んで結果を Firestore に書き戻す。AI は新たな気象予想をせず、確定予報値の解説と作業助言のみを行う（気象業務法リスク回避）。

**Tech Stack:** Cloudflare Pages Functions、Gemini 2.0 Flash（REST API、`responseSchema` で JSON 構造化出力）、Firebase Firestore（v12、ユーザー別キャッシュ）、React 19 hooks。

**重要な設計原則:**
- **AIに予想させない。** 既存の確定予報値（Open-Meteo / 気象庁）を入力として渡し、その「農業的な意味の解説」と「作業助言」のみをさせる。新たな気象現象の予想は一切させない。
- **作業ウィンドウはアプリが決定論的に抽出。** 「風速・降水確率の条件を満たす連続時間帯」をクライアント側コードで抽出し、AI には言い回しのみさせる（幻覚防止＋法的安全）。
- **非ブロッキング。** AIセクションは独立。予報表示を待たせない。
- **ユーザー別キャッシュ。** TTL 4時間。既存 Firestore セキュリティルールがそのまま効く。

**検証方針:** 本プロジェクトはテストフレームワーク未導入のため、各タスクは `npm run build`（`tsc -b && vite build`）の成功と手動動作確認で検証する（既存機能と同じ流儀）。

---

## ファイル構成

| ファイル | 変更種別 | 責務 |
|---|---|---|
| `functions/api/ai-comment.ts` | 新規 | Pages Function。Gemini 呼び出しプロキシ（ステートレス） |
| `.dev.vars` | 新規 | wrangler ローカル開発用 `GEMINI_API_KEY`（gitignore 追加） |
| `.gitignore` | 変更 | `.dev.vars` を追加 |
| `src/lib/workWindows.ts` | 新規 | 時間別予報から作業好適ウィンドウを抽出 |
| `src/lib/aiCommentInput.ts` | 新規 | 入力ペイロード組立＋キャッシュキー用ハッシュ |
| `src/api/aiComment.ts` | 新規 | Function を呼ぶクライアント fetch |
| `src/lib/aiCommentCache.ts` | 新規 | Firestore キャッシュ読み書き |
| `src/hooks/useAiComment.ts` | 新規 | キャッシュ確認→ミス時 Function 呼出→書戻し |
| `src/components/weather/AiCommentCard.tsx` | 新規 | コメントカード UI（スケルトン付き） |
| `src/components/weather/WeatherTab.tsx` | 変更 | `AiCommentCard` を1行追加 |

`firebase.ts` / `store.ts` / `forecast.ts` / `jmaWarning.ts` はノータッチ。

---

## 事前準備（コードで完結しない手作業）

> この準備は実装着手前にユーザーが行う。実装自体はキーがなくても進められる（ビルドは通る）が、動作確認には必要。

1. [Google AI Studio](https://aistudio.google.com/apikey) で Gemini API キーを発行
2. Cloudflare Pages ダッシュボード → 該当プロジェクト → Settings → Environment variables に `GEMINI_API_KEY` を追加（Production / Preview 両方）
3. ローカル動作確認時はリポジトリ直下に `.dev.vars` を作成し `GEMINI_API_KEY=発行したキー` を記入（Task 1 で作成）

---

## Task 1: Cloudflare Pages Function（Gemini プロキシ）

**Files:**
- Create: `functions/api/ai-comment.ts`
- Create: `.dev.vars`
- Modify: `.gitignore`

- [ ] **Step 1: `.gitignore` に `.dev.vars` を追加**

`.gitignore` の `# Environment variables (Firebase config)` ブロックを以下に変更:

```
# Environment variables (Firebase config)
.env

# Cloudflare Pages Functions ローカル環境変数（wrangler pages dev 用）
.dev.vars
```

- [ ] **Step 2: `.dev.vars` を作成**

リポジトリ直下に `.dev.vars` を作成（中身は各自のキー。コミットされない）:

```
GEMINI_API_KEY=ここに発行したGeminiキーを貼る
```

- [ ] **Step 3: Pages Function を作成**

`functions/api/ai-comment.ts` を以下の内容で作成:

```typescript
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

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `あなたは日本の農業に詳しいアドバイザーです。与えられた気象データ（気象庁・Open-Meteo が既に発表した確定予報値）を解釈し、農作業の助言を行います。

絶対的な制約:
- あなた自身は新たな気象予想を一切してはいけません。与えられた数値の意味を解説し、農作業上の助言を述べるだけです。
- 「〜になるでしょう」「〜が予想されます」のような、あなた自身が予想する表現は禁止。「予報では〜」「データ上は〜」と既存予報を引用する形にしてください。
- 各項目は1〜2文で簡潔に。前置き・あいさつ・一般論・免責文は書かない。
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
      maxOutputTokens: 600,
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
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: エラーなし（`functions/` は `tsc -b` の対象外だが、`vite build` も通ること）。

- [ ] **Step 5: コミット**

```bash
git add .gitignore functions/api/ai-comment.ts
git commit -m "feat: add Gemini proxy Pages Function for AI comments"
```

> 注: `.dev.vars` は gitignore 済みなので add されない（正しい）。

---

## Task 2: 作業好適ウィンドウ抽出（workWindows.ts）

**Files:**
- Create: `src/lib/workWindows.ts`

- [ ] **Step 1: ファイルを作成**

`src/lib/workWindows.ts` を以下の内容で作成:

```typescript
// src/lib/workWindows.ts
//
// 時間別予報から「作業好適時間帯（calm window）」を決定論的に抽出する。
// AI には抽出済みの候補を渡して言い回しのみさせる（幻覚防止・法的安全）。
//
// 好適条件（1時間ごと）:
//   - 風速 <= WIND_MAX（散布・ドローン等の風リスク回避）
//   - 降水確率 <= PRECIP_PROB_MAX かつ 降水量 == 0
//   - 日中（DAY_START〜DAY_END 時）
// これらを満たす連続時間帯を MIN_HOURS 以上のものだけ採用する。

import type { HourlyForecast } from '../api/forecast';

export interface CalmWindow {
  startISO: string;      // 例: "2026-05-31T06:00"
  endISO: string;        // 例: "2026-05-31T09:00"（最後の好適時刻 + 1h）
  maxWind: number;       // m/s（区間内最大）
  maxPrecipProb: number; // %（区間内最大）
  minTemp: number;       // ℃
  maxTemp: number;       // ℃
}

const WIND_MAX = 3;          // m/s
const PRECIP_PROB_MAX = 20;  // %
const MIN_HOURS = 3;         // 連続好適時間の最小数
const DAY_START = 5;         // 5時
const DAY_END = 18;          // 18時（この時刻は含まない）
const MAX_WINDOWS = 4;       // 返す最大件数

function hourOf(timeISO: string): number {
  // "2026-05-31T06:00" → 6
  const m = timeISO.match(/T(\d{2}):/);
  return m ? parseInt(m[1], 10) : -1;
}

function isCalmHour(h: HourlyForecast): boolean {
  const hr = hourOf(h.time);
  return (
    hr >= DAY_START &&
    hr < DAY_END &&
    h.windSpeed <= WIND_MAX &&
    h.precipProb <= PRECIP_PROB_MAX &&
    h.precipitation === 0
  );
}

/** 1時間先の ISO 文字列を返す（JST 前提・"YYYY-MM-DDTHH:00" 形式） */
function plusOneHourISO(timeISO: string): string {
  const t = Date.parse(`${timeISO}:00+09:00`);
  const d = new Date(t + 60 * 60 * 1000);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const da = String(jst.getUTCDate()).padStart(2, '0');
  const ho = String(jst.getUTCHours()).padStart(2, '0');
  return `${y}-${mo}-${da}T${ho}:00`;
}

export function findCalmWindows(hourly: HourlyForecast[]): CalmWindow[] {
  const windows: CalmWindow[] = [];
  let run: HourlyForecast[] = [];

  const flush = () => {
    if (run.length >= MIN_HOURS) {
      const winds = run.map(h => h.windSpeed);
      const probs = run.map(h => h.precipProb);
      const temps = run.map(h => h.temperature);
      windows.push({
        startISO: run[0].time,
        endISO: plusOneHourISO(run[run.length - 1].time),
        maxWind: Math.max(...winds),
        maxPrecipProb: Math.max(...probs),
        minTemp: Math.round(Math.min(...temps)),
        maxTemp: Math.round(Math.max(...temps)),
      });
    }
    run = [];
  };

  for (const h of hourly) {
    if (isCalmHour(h)) {
      run.push(h);
    } else {
      flush();
    }
  }
  flush();

  return windows.slice(0, MAX_WINDOWS);
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 型エラーなし（`HourlyForecast` のフィールド名 `windSpeed` / `precipProb` / `precipitation` / `temperature` / `time` は `src/api/forecast.ts` と一致）。

- [ ] **Step 3: コミット**

```bash
git add src/lib/workWindows.ts
git commit -m "feat: add deterministic calm-window extraction for AI work timing"
```

---

## Task 3: 入力ペイロード組立とハッシュ（aiCommentInput.ts）

**Files:**
- Create: `src/lib/aiCommentInput.ts`

- [ ] **Step 1: ファイルを作成**

`src/lib/aiCommentInput.ts` を以下の内容で作成:

```typescript
// src/lib/aiCommentInput.ts
//
// AI コメント用の入力ペイロードを組み立て、キャッシュキー用の安定ハッシュを計算する。
// ペイロードは Gemini に渡すデータ。トークン節約のため必要最小限に絞る。

import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';
import { findCalmWindows, type CalmWindow } from './workWindows';

export interface AiCommentDailyBrief {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipProbMax: number;
  precipSum: number;
}

export interface AiCommentInput {
  locationName: string;
  month: number;                  // 1-12
  daily: AiCommentDailyBrief[];   // 先頭5日
  warnings: string[];             // 気象庁警報・注意報名（例: "濃霧注意報"）
  calmWindows: CalmWindow[];
}

const LEVEL_SUFFIX: Record<string, string> = {
  special: '特別警報',
  warning: '警報',
  advisory: '注意報',
  none: '',
};

/** 予報・警報データから AI 入力ペイロードを組み立てる */
export function buildAiCommentInput(
  locationName: string,
  forecast: ForecastData,
  warnings: JmaWarningItem[],
): AiCommentInput {
  const daily: AiCommentDailyBrief[] = forecast.daily
    .filter(d => !d.isPlaceholder)
    .slice(0, 5)
    .map(d => ({
      date: d.date,
      weatherCode: d.weatherCode,
      tempMax: Math.round(d.tempMax),
      tempMin: Math.round(d.tempMin),
      precipProbMax: d.precipProbMax,
      precipSum: Math.round(d.precipSum),
    }));

  const warningNames = warnings.map(
    w => `${w.name}${LEVEL_SUFFIX[w.level] ?? ''}`,
  );

  // 現在時刻以降の時間別のみを対象に好適ウィンドウを抽出
  const nowMs = Date.now();
  const futureHourly = forecast.hourly.filter(
    h => Date.parse(`${h.time}:00+09:00`) >= nowMs,
  );
  const calmWindows = findCalmWindows(futureHourly);

  return {
    locationName,
    month: new Date(nowMs + 9 * 60 * 60 * 1000).getUTCMonth() + 1,
    daily,
    warnings: warningNames,
    calmWindows,
  };
}

/**
 * 入力ペイロードから安定したキャッシュキーを計算する（djb2 ハッシュ）。
 * 同一地点・同一予報なら同じキーになり、Firestore キャッシュがヒットする。
 */
export function hashAiCommentInput(input: AiCommentInput): string {
  const str = JSON.stringify(input);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i); // hash * 33 ^ c
  }
  // 符号なし32bit → 16進数文字列
  return (hash >>> 0).toString(16);
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 型エラーなし。`ForecastData` / `JmaWarningItem` のフィールド名が一致していること。

- [ ] **Step 3: コミット**

```bash
git add src/lib/aiCommentInput.ts
git commit -m "feat: add AI comment input payload builder and cache hash"
```

---

## Task 4: クライアント fetch と Firestore キャッシュ

**Files:**
- Create: `src/api/aiComment.ts`
- Create: `src/lib/aiCommentCache.ts`

- [ ] **Step 1: クライアント fetch を作成**

`src/api/aiComment.ts` を以下の内容で作成:

```typescript
// src/api/aiComment.ts
//
// Cloudflare Pages Function (/api/ai-comment) を呼ぶクライアント側 fetch。
// vite dev（wrangler 不使用）では Function が存在せず SPA の index.html が返るため、
// Content-Type が JSON でない場合はエラーにして呼び出し元でグレースフルに無視させる。

import type { AiCommentInput } from '../lib/aiCommentInput';

export interface AiCommentData {
  weatherPoint: string[];
  workWindows: string[];
}

export async function fetchAiComment(input: AiCommentInput): Promise<AiCommentData> {
  const res = await fetch('/api/ai-comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`AI comment API error: ${res.status}`);
  }

  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    // vite dev で Function 未稼働 → HTML が返るケース
    throw new Error('AI comment endpoint unavailable (non-JSON response)');
  }

  const data = await res.json() as Partial<AiCommentData>;
  return {
    weatherPoint: Array.isArray(data.weatherPoint) ? data.weatherPoint : [],
    workWindows: Array.isArray(data.workWindows) ? data.workWindows : [],
  };
}
```

- [ ] **Step 2: Firestore キャッシュを作成**

`src/lib/aiCommentCache.ts` を以下の内容で作成:

```typescript
// src/lib/aiCommentCache.ts
//
// AI コメントの Firestore ユーザー別キャッシュ。
// パス: /users/{uid}/aiComments/{hash}（既存セキュリティルールがそのまま効く）
// TTL: 4時間。書き込みは await + try/catch（プロジェクト方針）で呼び出し元が保護する。

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { AiCommentData } from '../api/aiComment';

const TTL_MS = 4 * 60 * 60 * 1000; // 4時間

export async function readAiCommentCache(
  uid: string,
  hash: string,
): Promise<AiCommentData | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'aiComments', hash));
  if (!snap.exists()) return null;
  const data = snap.data();
  const cachedAt: number = data.cachedAt?.toMillis?.() ?? 0;
  if (Date.now() - cachedAt > TTL_MS) return null;
  return {
    weatherPoint: Array.isArray(data.weatherPoint) ? data.weatherPoint : [],
    workWindows: Array.isArray(data.workWindows) ? data.workWindows : [],
  };
}

export async function writeAiCommentCache(
  uid: string,
  hash: string,
  data: AiCommentData,
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'aiComments', hash), {
    weatherPoint: data.weatherPoint,
    workWindows: data.workWindows,
    cachedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 型エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/api/aiComment.ts src/lib/aiCommentCache.ts
git commit -m "feat: add AI comment client fetch and Firestore cache"
```

---

## Task 5: オーケストレーション Hook（useAiComment.ts）

**Files:**
- Create: `src/hooks/useAiComment.ts`

- [ ] **Step 1: ファイルを作成**

`src/hooks/useAiComment.ts` を以下の内容で作成:

```typescript
// src/hooks/useAiComment.ts
//
// AI コメントのオーケストレーション。
// 1. 予報・警報データから入力ペイロード＋ハッシュを計算
// 2. Firestore キャッシュ確認（ヒット → 即返す・API 呼ばない）
// 3. ミス → Pages Function 呼出 → 結果を Firestore に書き戻す
// 非ブロッキング: エラー時は静かに失敗し comment = null（天気表示を邪魔しない）
//
// 【無限ループ防止の要】
// 呼び出し元の WeatherTab は filteredJmaWarning.items を毎レンダー .filter() で
// 再生成するため、warnings/forecast の「参照」は毎レンダー変わる。
// これを effect の依存に直接入れると、毎レンダー発火 → setComment(新オブジェクト)
// → 再レンダー → … の無限ループ（＋過剰な Firestore Read）になる。
// 対策: input/hash は本体で毎レンダー計算（純粋・安価）し、
//       effect の依存は「プリミティブの hash と uid」だけにする。
//       これにより、setLoading 等で再レンダーが起きても hash 不変なら
//       effect は再発火せず、in-flight リクエストも握り潰されない。

import { useState, useEffect, useRef } from 'react';
import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';
import { fetchAiComment, type AiCommentData } from '../api/aiComment';
import { buildAiCommentInput, hashAiCommentInput } from '../lib/aiCommentInput';
import { readAiCommentCache, writeAiCommentCache } from '../lib/aiCommentCache';

export function useAiComment(
  uid: string | null | undefined,
  locationName: string | null | undefined,
  forecast: ForecastData | null,
  warnings: JmaWarningItem[] | undefined,
) {
  const [comment, setComment] = useState<AiCommentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 入力とハッシュを毎レンダー計算する純粋処理（findCalmWindows は O(72) で安価）。
  // Date.now() を使うが、時間別データは時刻単位のため hash は同一時間帯内で安定する。
  const input =
    uid && locationName && forecast
      ? buildAiCommentInput(locationName, forecast, warnings ?? [])
      : null;
  const hash = input ? hashAiCommentInput(input) : null;

  // 最新 input を ref で保持。effect は hash でゲートし、本体は ref から読む
  // （input は参照不安定なので依存に入れない）。
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (!uid || !hash) {
      setComment(null);
      return;
    }
    const currentInput = inputRef.current;
    if (!currentInput) return;

    let cancelled = false;

    const run = async () => {
      setError(null);
      // 1. キャッシュ確認
      try {
        const cached = await readAiCommentCache(uid, hash);
        if (cancelled) return;
        if (cached) {
          setComment(cached);
          return;
        }
      } catch {
        // キャッシュ読み取り失敗は無視して API へ進む
      }
      if (cancelled) return;

      // 2. ミス → Function 呼出
      setComment(null);
      setLoading(true);
      try {
        const data = await fetchAiComment(currentInput);
        if (cancelled) return;
        setComment(data);
        // 3. 書き戻し（失敗は致命的でない）
        try {
          await writeAiCommentCache(uid, hash, data);
        } catch {
          console.warn('[useAiComment] cache write failed');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'AIコメントの取得に失敗しました');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
    // 依存はプリミティブのみ。input は inputRef 経由で読むため依存に含めない
  }, [uid, hash]);

  return { comment, loading, error };
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 型エラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/hooks/useAiComment.ts
git commit -m "feat: add useAiComment orchestration hook"
```

---

## Task 6: コメントカード UI と WeatherTab 統合

**Files:**
- Create: `src/components/weather/AiCommentCard.tsx`
- Modify: `src/components/weather/WeatherTab.tsx`

- [ ] **Step 1: AiCommentCard を作成**

`src/components/weather/AiCommentCard.tsx` を以下の内容で作成:

```tsx
// src/components/weather/AiCommentCard.tsx
//
// AI 農作業コメントカード。JmaWarningSummary の直下に配置。
// loading 中はスケルトン、データなし/エラー時は何も表示しない（非ブロッキング）。

import { Sprout, Tractor } from 'lucide-react';
import type { AiCommentData } from '../../api/aiComment';

interface Props {
  comment: AiCommentData | null;
  loading: boolean;
}

export function AiCommentCard({ comment, loading }: Props) {
  if (loading) {
    return (
      <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>
          🌱 AI 農作業コメント
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: '90%' }} />
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(13,148,136,0.10)', width: '70%' }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#b8c0cf', marginTop: '0.5rem' }}>
          今日のポイントを分析中…
        </div>
      </section>
    );
  }

  if (!comment) return null;

  const hasWeather = comment.weatherPoint.length > 0;
  const hasWindows = comment.workWindows.length > 0;
  if (!hasWeather && !hasWindows) return null;

  return (
    <section className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
      {hasWeather && (
        <div style={{ marginBottom: hasWindows ? '0.7rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '0.35rem' }}>
            <Sprout size={16} />
            今日の気象ポイント
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {comment.weatherPoint.map((line, i) => (
              <li key={i} style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {hasWindows && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '0.35rem' }}>
            <Tractor size={16} />
            おすすめ作業タイミング
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {comment.workWindows.map((line, i) => (
              <li key={i} style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: '0.68rem', color: '#b8c0cf', marginTop: '0.6rem' }}>
        ※気象庁・Open-Meteo の予報データに基づく解説です
      </div>
    </section>
  );
}
```

> 注: `Sprout` / `Tractor` は lucide-react のアイコン。存在を確認済み（lucide-react v1.8）。万一バージョンで未提供の場合は `Leaf` / `Wheat` 等に差し替える。

- [ ] **Step 2: WeatherTab に import を追加**

`src/components/weather/WeatherTab.tsx` の import セクション、`import { JmaWarningSummary } from './JmaWarningSummary';` の直後に追加:

```tsx
import { AiCommentCard } from './AiCommentCard';
import { useAiComment } from '../../hooks/useAiComment';
```

- [ ] **Step 3: useAiComment を呼ぶ**

`WeatherTab.tsx` の `useJmaWarning` 呼び出しの直後（`filteredJmaWarning` 定義より後）に追加:

```tsx
  // AI 農作業コメント（予報・警報が揃ったら非同期取得）
  const { comment: aiComment, loading: aiCommentLoading } = useAiComment(
    user?.uid,
    location?.name,
    data,
    filteredJmaWarning?.items,
  );
```

> `user` は `useAppStore()` から取得済み。Step 3a で分割代入に追加すること。

- [ ] **Step 3a: store 分割代入に `user` を追加**

`WeatherTab.tsx` 冒頭の以下の行:

```tsx
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation } = useAppStore();
```

を以下に変更:

```tsx
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, user } = useAppStore();
```

- [ ] **Step 4: カードをレンダリング**

`WeatherTab.tsx` の return 内、`<JmaWarningSummary result={filteredJmaWarning} loading={jmaLoading} />` の直後に追加:

```tsx
            <AiCommentCard comment={aiComment} loading={aiCommentLoading} />
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: 型エラーなし、ビルド成功。

- [ ] **Step 6: ローカル動作確認（Cloudflare Functions 込み）**

`.dev.vars` に `GEMINI_API_KEY` がある状態で:

```bash
npm run build
npx wrangler pages dev dist
```

確認事項:
1. 天気タブを開く → 警報サマリーの下に「🌱 AI 農作業コメント」スケルトンが一瞬表示される
2. 1〜3秒後にコメントが差し込まれる（天気表示はブロックされない）
3. 「今日の気象ポイント」に1〜3行の解説が出る
4. calmWindows が抽出された場合「おすすめ作業タイミング」が出る（出ない日もあり得る＝正常）
5. 出力に未来の気象を断定する「予想」表現が含まれていないこと（プロンプト制約の効きを目視確認）
6. 同じ地点で再読込 → スケルトンなしで即表示（Firestore キャッシュヒット）
7. Firestore コンソールで `/users/{uid}/aiComments/{hash}` ドキュメントが作成されていること

> `vite dev`（`npm run dev`）では Function が動かず `/api/ai-comment` が HTML を返すため、コメントは表示されない（エラーは握り潰され天気は正常表示）。これは仕様。AI の確認は `wrangler pages dev` か CF プレビューで行う。

- [ ] **Step 7: コミット & push**

```bash
git add src/components/weather/AiCommentCard.tsx src/components/weather/WeatherTab.tsx
git commit -m "feat: display AI farming comment card in weather tab"
git push
```

- [ ] **Step 8: 本番動作確認**

CF ダッシュボードに `GEMINI_API_KEY` が設定済みであることを確認 → デプロイ完了後 `orchweather.pages.dev` の天気タブで Step 6 の 1〜7 を再確認。

---

## セルフレビュー

### Spec カバレッジ（合意事項）
- [x] AI エンジン: Gemini 2.0 Flash（Pages Function プロキシ、キーはサーバーのみ）→ Task 1
- [x] 実行環境是正: Firebase Functions ではなく Cloudflare Pages Function → Task 1
- [x] アイデア1（気象翻訳）: weatherPoint → Task 1 プロンプト + Task 6 UI
- [x] アイデア2（作業ウィンドウ）: アプリが決定論的抽出 → AI が言い回し → Task 2 + Task 1
- [x] ユーザー別キャッシュ TTL 4h: `/users/{uid}/aiComments/{hash}` → Task 4
- [x] 非ブロッキング・スケルトン → Task 5 + Task 6
- [x] 法的安全: AI に予想させずプロンプトで制約＋出典明示 → Task 1 + Task 6
- [x] ユーザー入力ゼロ: 既存データのみ使用 → Task 3
- [x] ノータッチ: firebase.ts / store.ts / forecast.ts / jmaWarning.ts

### 型の一貫性
- `AiCommentData { weatherPoint: string[]; workWindows: string[] }` → `aiComment.ts` で定義、`aiCommentCache.ts` / `useAiComment.ts` / `AiCommentCard.tsx` で一致
- `AiCommentInput` → `aiCommentInput.ts` で定義、`aiComment.ts`（引数）/ `useAiComment.ts` で一致
- `CalmWindow` → `workWindows.ts` で定義、`aiCommentInput.ts` で使用
- `findCalmWindows(hourly: HourlyForecast[])` → Task 2 で定義、Task 3 で呼出（シグネチャ一致）
- `HourlyForecast` フィールド: `time` / `windSpeed` / `precipProb` / `precipitation` / `temperature`（`forecast.ts` と一致）
- `JmaWarningItem` フィールド: `name` / `level`（`jmaWarning.ts` と一致）
- store: `user?.uid`（`store.ts` の `user: User | null` と一致）

### 想定される弱点（実装時に注意）
- Gemini のレスポンスが `responseSchema` を無視するケース → `aiComment.ts` で配列チェック済み・グレースフル
- `serverTimestamp()` 直後の読みで `cachedAt` が null → `?? 0` で TTL 切れ扱い（次回再取得）＝安全側
- lucide-react のアイコン名（Sprout / Tractor）→ 未提供なら差し替え（Step 1 注記済み）
