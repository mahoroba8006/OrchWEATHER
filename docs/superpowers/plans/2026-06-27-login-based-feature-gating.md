# ログイン状態による機能制限 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログイン状態に応じて機能を3段階（未ログイン=現在地のみ/ログイン非許可=10地点/ログインAI許可=50地点+AI）に制限し、AIエンドポイントにサーバー側のトークン検証＋env許可リストを導入してコスト漏れを止める。

**Architecture:** Cloudflare Pages Function 側で `jose` を使い Firebase ID トークンを検証（WebCrypto・Admin SDK不使用）、env `AI_ALLOWLIST` で許可判定。クライアントは `/api/me` で得た `aiAllowed` 1つで「実AI vs Coming Soon」と「地点上限50 vs 10」を分岐。未ログインは `guestMode` で現在地のみアプリ本体へ通す。

**Tech Stack:** React 19 + Zustand + Firebase Auth/Firestore + Cloudflare Pages Functions + jose(JWT検証) + Vite。

**検証方針:** 本リポジトリにテストランナーは無い。各タスクは `npm run build`（tsc型チェック＋viteビルド）でのコンパイル検証と、ブラウザ／`wrangler pages dev` での手動確認を用いる。`vite` dev サーバーは Pages Function を実行しないため、`functions/` の動作確認は `npx wrangler pages dev dist` か本番/プレビューデプロイで行う。

参照スペック: [docs/superpowers/specs/2026-06-27-login-based-feature-gating-design.md](../specs/2026-06-27-login-based-feature-gating-design.md)

---

## ファイル構成

**新規:**
- `functions/api/_auth.ts` — Firebase IDトークン検証ヘルパー（jose使用）＋Bearer抽出＋許可リスト判定。
- `functions/api/me.ts` — トークン検証して `{ aiAllowed }` を返す Pages Function。
- `src/api/me.ts` — `/api/me` を呼ぶクライアント fetch。
- `src/components/weather/AiComingSoonCard.tsx` — AI非許可時に表示する Coming Soon カード。

**変更:**
- `functions/api/ai-comment.ts`, `functions/api/ai-custom.ts` — 冒頭にトークン検証＋許可リストゲート（401/403）。
- `src/api/aiComment.ts` — fetch に `Authorization: Bearer` を付与。
- `src/store.ts` — `aiAllowed` / `guestMode` 状態と関連アクション、`addLocation` の上限ガード。
- `src/App.tsx` — ログインゲート改修（guestMode）、ログイン時の `loadAiAllowed` 呼び出し、ヘッダーのゲスト用ログインボタン。
- `src/components/LandingPage.tsx` — 「ログインせずに試す」ボタン（`onTryGuest`）。
- `src/components/weather/WeatherTab.tsx` — `aiAllowed` でAI取得をゲートし Coming Soon を出し分け。
- `package.json` — `jose` 依存追加。
- `.dev.vars` — `AI_ALLOWLIST`, `FIREBASE_PROJECT_ID` 追加。

---

## Phase 1 — サーバー側トークン検証＋AIゲート（中核のセキュリティ修正）

### Task 1.1: jose 依存の追加

**Files:**
- Modify: `package.json`

- [ ] **Step 1: jose をインストール**

Run: `npm install jose@^5`
Expected: `package.json` の dependencies に `"jose": "^5..."` が追加され、`package-lock.json` が更新される。

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npm run build`
Expected: エラーなく完了（`✓ built`）。

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "build: add jose for Firebase ID token verification in Pages Functions"
```

---

### Task 1.2: トークン検証ヘルパー `_auth.ts`

**Files:**
- Create: `functions/api/_auth.ts`

- [ ] **Step 1: ヘルパーを実装**

`functions/api/_auth.ts`:

```ts
// functions/api/_auth.ts
// Firebase ID トークン検証（Cloudflare Pages Function / WebCrypto, Admin SDK不使用）。
// Google の securetoken x509 証明書を取得し jose で RS256 署名・iss/aud/exp を検証する。
// 証明書はレスポンスの Cache-Control: max-age を尊重してモジュール内メモリにキャッシュする。

import { importX509, jwtVerify, decodeProtectedHeader } from 'jose';

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertMap { [kid: string]: string }

let certCache: { certs: CertMap; expiresAt: number } | null = null;

async function getCerts(): Promise<CertMap> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) return certCache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`);
  const certs = (await res.json()) as CertMap;
  const m = (res.headers.get('Cache-Control') ?? '').match(/max-age=(\d+)/);
  const maxAge = m ? parseInt(m[1], 10) : 3600;
  certCache = { certs, expiresAt: now + maxAge * 1000 };
  return certs;
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
}

/** Authorization ヘッダーから Bearer トークンを取り出す。無ければ null。 */
export function getBearerToken(request: Request): string | null {
  const h = request.headers.get('Authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/** Firebase ID トークンを検証して uid/email を返す。失敗時は throw。 */
export async function verifyIdToken(token: string, projectId: string): Promise<VerifiedUser> {
  const { kid } = decodeProtectedHeader(token);
  if (!kid) throw new Error('no kid in token header');
  const certs = await getCerts();
  const pem = certs[kid];
  if (!pem) throw new Error('unknown kid');
  const key = await importX509(pem, 'RS256');
  const { payload } = await jwtVerify(token, key, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) throw new Error('no sub in token');
  const email = typeof payload.email === 'string' ? payload.email : null;
  return { uid, email };
}

/** email が許可リスト（カンマ区切り env）に含まれるか。大文字小文字を無視。 */
export function isAllowlisted(email: string | null, allowlist: string | undefined): boolean {
  if (!email || !allowlist) return false;
  const set = allowlist
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return set.includes(email.toLowerCase());
}
```

- [ ] **Step 2: 型チェック（ビルド）**

Run: `npm run build`
Expected: エラーなく完了。`jose` のインポートが解決される。

- [ ] **Step 3: コミット**

```bash
git add functions/api/_auth.ts
git commit -m "feat(api): add Firebase ID token verification helper (jose)"
```

---

### Task 1.3: `ai-comment.ts` にゲートを追加

**Files:**
- Modify: `functions/api/ai-comment.ts:10-12`（Env 拡張）, `functions/api/ai-comment.ts:50-64`（ゲート挿入）

- [ ] **Step 1: Env インターフェースを拡張**

`functions/api/ai-comment.ts` の `interface Env` を置き換える:

```ts
interface Env {
  GEMINI_API_KEY: string;
  AI_ALLOWLIST: string;
  FIREBASE_PROJECT_ID: string;
}
```

ファイル冒頭の import 群（`interface Env` の直前）に追加:

```ts
import { getBearerToken, verifyIdToken, isAllowlisted } from './_auth';
```

- [ ] **Step 2: メソッドチェック直後に認可ゲートを挿入**

`onRequest` 内、`if (context.request.method !== 'POST') { ... }` ブロックの直後（`const apiKey = context.env.GEMINI_API_KEY;` の直前）に挿入:

```ts
  // ── 認可: ログイン済み かつ AI許可リストに含まれるユーザーのみ ──
  const token = getBearerToken(context.request);
  if (!token) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  let email: string | null;
  try {
    ({ email } = await verifyIdToken(token, context.env.FIREBASE_PROJECT_ID));
  } catch {
    return new Response(JSON.stringify({ error: 'invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!isAllowlisted(email, context.env.AI_ALLOWLIST)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
```

- [ ] **Step 3: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 4: コミット**

```bash
git add functions/api/ai-comment.ts
git commit -m "feat(api): gate ai-comment with token verification + allowlist (401/403)"
```

---

### Task 1.4: `ai-custom.ts` にゲートを追加

**Files:**
- Modify: `functions/api/ai-custom.ts`（Env 拡張・import・ゲート挿入）

- [ ] **Step 1: ai-custom.ts の構造を確認**

Run: `npx rg -n "interface Env|onRequest|method !== 'POST'|GEMINI_API_KEY" functions/api/ai-custom.ts`
Expected: `interface Env`、`onRequest`、POSTチェック、`GEMINI_API_KEY` 参照の行番号が出る。

- [ ] **Step 2: import と Env を追加**

`functions/api/ai-custom.ts` の冒頭 import 群に追加:

```ts
import { getBearerToken, verifyIdToken, isAllowlisted } from './_auth';
```

`interface Env` に `AI_ALLOWLIST: string;` と `FIREBASE_PROJECT_ID: string;` を追加（`GEMINI_API_KEY` と並べる）。

- [ ] **Step 3: POSTチェック直後に同じ認可ゲートを挿入**

`onRequest` 内のメソッドチェック直後・GEMINI_API_KEY 取得の直前に、Task 1.3 Step 2 と同一のゲートブロック（`const token = getBearerToken(...)` から 403 まで）を挿入する。

- [ ] **Step 4: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 5: コミット**

```bash
git add functions/api/ai-custom.ts
git commit -m "feat(api): gate ai-custom with token verification + allowlist (401/403)"
```

---

### Task 1.5: `/api/me` エンドポイント

**Files:**
- Create: `functions/api/me.ts`

- [ ] **Step 1: 実装**

`functions/api/me.ts`:

```ts
// functions/api/me.ts
// ログイン中ユーザーが AI 許可リストに含まれるかを返す。
// クライアントはこの aiAllowed 1値で「実AI vs Coming Soon」「地点上限50 vs 10」を分岐する。

import { getBearerToken, verifyIdToken, isAllowlisted } from './_auth';

interface Env {
  AI_ALLOWLIST: string;
  FIREBASE_PROJECT_ID: string;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequest: PagesFunction<Env> = async (context) => {
  const token = getBearerToken(context.request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    const { email } = await verifyIdToken(token, context.env.FIREBASE_PROJECT_ID);
    return json({ aiAllowed: isAllowlisted(email, context.env.AI_ALLOWLIST) }, 200);
  } catch {
    return json({ error: 'invalid token' }, 401);
  }
};
```

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 3: コミット**

```bash
git add functions/api/me.ts
git commit -m "feat(api): add /api/me returning aiAllowed flag"
```

---

### Task 1.6: 環境変数の追加（ローカル）

**Files:**
- Modify: `.dev.vars`

- [ ] **Step 1: 現在の .dev.vars を確認**

Run: `npx rg -n "." .dev.vars`
Expected: 既存の `GEMINI_API_KEY=...` などが表示される。

- [ ] **Step 2: 変数を追記**

`.dev.vars` の末尾に2行追加（`<自分のメール>` は実際の許可メール、`<projectId>` は `VITE_FIREBASE_PROJECT_ID` と同じ値に置換）:

```
AI_ALLOWLIST=<自分のメール>
FIREBASE_PROJECT_ID=<projectId>
```

- [ ] **Step 3: 本番設定のメモを残す（コミットしない確認のみ）**

`.dev.vars` は gitignore 対象である想定。Run: `git check-ignore .dev.vars`
Expected: `.dev.vars` と出力される（＝無視対象。コミットされない）。
本番では Cloudflare Pages のダッシュボード「Settings → Environment variables」に `AI_ALLOWLIST` と `FIREBASE_PROJECT_ID` を別途設定する必要がある（このタスクの手動TODO。デプロイ前に実施）。

- [ ] **Step 4: コミット（.dev.vars は無視されるため設定変更のみ・コミット対象なし）**

`.dev.vars` が ignore される場合、このタスクにコミット対象は無い。次のタスクへ進む。
（もし `git check-ignore` が空＝追跡対象なら、秘密情報の混入を避けるため即座にユーザーへ確認し、`.gitignore` に `.dev.vars` を追加してからコミットすること。）

---

### Task 1.7: クライアント fetch に Authorization ヘッダーを付与

**Files:**
- Modify: `src/api/aiComment.ts:1-44`

- [ ] **Step 1: auth を import**

`src/api/aiComment.ts` の import 群（`import type { AiCommentInput, AiCustomInput }` の下）に追加:

```ts
import { auth } from '../lib/firebase';
```

- [ ] **Step 2: 共通ヘッダー生成関数を追加**

`fetchAiCustomComment` の定義の直前に挿入:

```ts
// ログイン中なら ID トークンを Authorization に載せる（サーバー側の認可ゲート用）。
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await auth.currentUser?.getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
```

- [ ] **Step 3: 両 fetch の headers を差し替え**

`fetchAiCustomComment` 内:

```ts
  const res = await fetch('/api/ai-custom', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ ...input, customPrompt, locationInfo: input.location }),
  });
```

`fetchAiComment` 内:

```ts
  const res = await fetch('/api/ai-comment', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
```

- [ ] **Step 4: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 5: 手動確認（wrangler）**

Run: `npx wrangler pages dev dist`（別ターミナル。事前に `npm run build` 済み）
許可メールでログインした状態のブラウザで空もようタブを開き、AIコメントが生成されること。`.dev.vars` の `AI_ALLOWLIST` から自分のメールを一時的に外して再起動すると 403 で AI が出ないことを確認（確認後は戻す）。
Expected: 許可時=AI表示、非許可時=AI非表示（コンソールに 403）。

- [ ] **Step 6: コミット**

```bash
git add src/api/aiComment.ts
git commit -m "feat(ai): send Firebase ID token to AI endpoints"
```

---

## Phase 2 — クライアントの aiAllowed 状態（/api/me）

### Task 2.1: `/api/me` クライアント fetch

**Files:**
- Create: `src/api/me.ts`

- [ ] **Step 1: 実装**

`src/api/me.ts`:

```ts
// src/api/me.ts
// /api/me を呼び、ログイン中ユーザーが AI 許可リストに含まれるかを取得する。
// 失敗時は false（安全側）。

import { auth } from '../lib/firebase';

export async function fetchAiAllowed(): Promise<boolean> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('Content-Type') ?? '';
    if (!contentType.includes('application/json')) return false; // vite dev 等で Function 未稼働
    const data = (await res.json()) as { aiAllowed?: unknown };
    return data.aiAllowed === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 3: コミット**

```bash
git add src/api/me.ts
git commit -m "feat(api): add client fetchAiAllowed (/api/me)"
```

---

### Task 2.2: store に `aiAllowed` 状態を追加

**Files:**
- Modify: `src/store.ts:1-9`（import）, `src/store.ts:121-161`（AppState型・初期値・アクション）

- [ ] **Step 1: import 追加**

`src/store.ts` の import 群（`import { create } from 'zustand';` の下あたり）に追加:

```ts
import { fetchAiAllowed } from './api/me';
```

- [ ] **Step 2: AppState 型にフィールドとアクションを追加**

`interface AppState` 内、`geoStatus: 'idle' | 'loading' | 'error';` の直後に追加:

```ts
  aiAllowed: boolean;
```

`setGeoStatus: (status: ...) => void;` の直後に追加:

```ts
  loadAiAllowed: () => Promise<void>;
  setAiAllowed: (allowed: boolean) => void;
```

- [ ] **Step 3: 初期値とアクションの実装を追加**

`create<AppState>()((set, get) => ({` 直後の初期値群、`geoStatus: 'idle',` の直後に追加:

```ts
  aiAllowed: false,
```

`setGeoStatus: (status) => set({ geoStatus: status }),` の直後に追加:

```ts
  setAiAllowed: (allowed) => set({ aiAllowed: allowed }),
  loadAiAllowed: async () => {
    const allowed = await fetchAiAllowed();
    set({ aiAllowed: allowed });
  },
```

- [ ] **Step 4: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 5: コミット**

```bash
git add src/store.ts
git commit -m "feat(store): add aiAllowed state and loadAiAllowed action"
```

---

### Task 2.3: ログイン時に `loadAiAllowed` を呼ぶ／ログアウトでリセット

**Files:**
- Modify: `src/App.tsx:137`（store分割代入）, `src/App.tsx:184-200`（onAuthStateChanged）

- [ ] **Step 1: store から関数を取得**

`src/App.tsx:137` の分割代入に `setAiAllowed` と `loadAiAllowed` を追加する:

```ts
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings, geoLocation, setGeoLocation, setGeoStatus, setAiAllowed, loadAiAllowed } = useAppStore();
```

- [ ] **Step 2: onAuthStateChanged に分岐を追加**

`src/App.tsx` の `onAuthStateChanged` コールバック内、`if (firebaseUser) {` ブロックの `await Promise.all([...])` の後（catch の前）に `loadAiAllowed()` を追加し、`else` でリセットする。該当ブロックを次のように変更:

```ts
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await ensureUserDocument(firebaseUser.uid);
          await Promise.all([
            loadLocations(firebaseUser.uid),
            loadUserSettings(firebaseUser.uid),
          ]);
          await loadAiAllowed();
        } catch (error) {
          console.error("Failed to load user settings or locations:", error);
        }
      } else {
        setAiAllowed(false);
      }
      setAuthLoading(false);
```

- [ ] **Step 3: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 4: コミット**

```bash
git add src/App.tsx
git commit -m "feat(auth): load aiAllowed on login, reset on logout"
```

---

## Phase 3 — AI 表示ゲート（Coming Soon）

### Task 3.1: Coming Soon カードコンポーネント

**Files:**
- Create: `src/components/weather/AiComingSoonCard.tsx`

- [ ] **Step 1: 実装**

`src/components/weather/AiComingSoonCard.tsx`:

```tsx
// src/components/weather/AiComingSoonCard.tsx
// AI コメント非許可ユーザー（未ログイン／ログイン非許可）に表示する Coming Soon カード。
// 既存 AiCommentCard と同じ glass-panel の枠で、AI枠の位置を保つ。

import { Sparkles } from 'lucide-react';

export function AiComingSoonCard() {
  return (
    <section className="glass-panel" style={{ padding: '1.4rem 1.2rem', textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--accent-color)',
          fontWeight: 700,
          fontSize: '0.9rem',
          marginBottom: '0.5rem',
        }}
      >
        <Sparkles size={16} /> AIによる段取りまとめ
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        近日提供予定です。気象データから散布・施肥・畑しごとの段取りをAIが提案します。
      </p>
    </section>
  );
}
```

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 3: コミット**

```bash
git add src/components/weather/AiComingSoonCard.tsx
git commit -m "feat(weather): add AiComingSoonCard placeholder"
```

---

### Task 3.2: WeatherTab で aiAllowed により出し分け

**Files:**
- Modify: `src/components/weather/WeatherTab.tsx:4`（import）, `:10-12`（import追加）, `:18`（store分割代入）, `:91-107`（AI取得のゲート）, `:343-352`（描画分岐）

- [ ] **Step 1: import と store 取得**

`src/components/weather/WeatherTab.tsx:10` の直後（`import { AiCommentCard } ...` の下）に追加:

```ts
import { AiComingSoonCard } from './AiComingSoonCard';
```

`src/components/weather/WeatherTab.tsx:18` の分割代入に `aiAllowed` を追加:

```ts
  const { locations, userSettings, geoLocation, geoStatus, setGeoLocation, user, updateWeatherCodeMode, aiAllowed } = useAppStore();
```

- [ ] **Step 2: AI 取得を aiAllowed でゲート**

`useAiComment(...)` の第1引数を `aiAllowed ? user?.uid : null` に変更（許可されない限り取得しない＝Gemini 呼び出しゼロ）:

```ts
  const { comment: aiComment, loading: aiCommentLoading } = useAiComment(
    aiAllowed ? user?.uid : null,
    location?.name,
    data,
    filteredJmaWarning?.items,
  );
```

`useAiCustomComment(...)` の第1引数も同様にゲート:

```ts
  const { text: aiCustomText, loading: aiCustomLoading } = useAiCustomComment(
    aiAllowed && customEnabled ? user?.uid : null,
    customEnabled ? location?.name : null,
    customEnabled ? data : null,
    customEnabled ? filteredJmaWarning?.items : undefined,
    customEnabled ? (aiCustomPrompt || DEFAULT_AI_CUSTOM_PROMPT) : '',
  );
```

- [ ] **Step 3: 描画を分岐**

`src/components/weather/WeatherTab.tsx:343-352` の `<div ref={aiSectionRef}>...</div>` ブロックを次に置き換える:

```tsx
          <div ref={aiSectionRef}>
            {aiAllowed ? (
              <AiCommentCard
                comment={aiComment}
                loading={aiCommentLoading}
                enabledSections={enabledAiSections}
                customText={aiCustomText}
                customLoading={aiCustomLoading}
                hasCustomPrompt={!!(aiCustomPrompt || DEFAULT_AI_CUSTOM_PROMPT)}
              />
            ) : (
              <AiComingSoonCard />
            )}
          </div>
```

- [ ] **Step 4: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 5: 手動確認**

Run: `npx wrangler pages dev dist`（`npm run build` 後）
- 許可メールでログイン → 空もように実AIコメント。
- `.dev.vars` の AI_ALLOWLIST から自分を外して再起動 → 同じ場所に「近日提供予定」カード（確認後戻す）。
Expected: 許可=実AI、非許可=Coming Soon。

- [ ] **Step 6: コミット**

```bash
git add src/components/weather/WeatherTab.tsx
git commit -m "feat(weather): gate AI by aiAllowed, show Coming Soon otherwise"
```

---

## Phase 4 — 地点登録の上限（10 / 50）

### Task 4.1: `addLocation` に上限ガード

**Files:**
- Modify: `src/store.ts:262-269`（addLocation）

- [ ] **Step 1: 上限ガードを追加**

`src/store.ts` の `addLocation` を次に置き換える（`aiAllowed` で 50/10 を分岐し、超過時は Error を throw。呼び出し元 `LocationSettings.handleSave` の catch がメッセージを表示する）:

```ts
  addLocation: async (loc) => {
    const uid = get().user?.uid;
    if (!uid) return;
    const limit = get().aiAllowed ? 50 : 10;
    if (get().locations.length >= limit) {
      throw new Error(`登録できる地点は最大${limit}件までです`);
    }
    const id = await addLocationToFirestore(uid, loc);
    set((state) => ({
      locations: [...state.locations, { ...loc, id }],
    }));
  },
```

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 3: 手動確認**

`npx wrangler pages dev dist` か `npm run dev`（地点保存は Firestore 直なので vite dev でも可）。
非許可アカウントで地点を10件登録済みにし、11件目を保存しようとすると LocationSettings に「登録できる地点は最大10件までです」が表示されること（`LocationSettings.handleSave` の `setSaveError` 経由）。現在地（📍現在地）は件数に数えないこと。
Expected: 11件目がブロックされエラー表示。現在地はカウント外。

- [ ] **Step 4: コミット**

```bash
git add src/store.ts
git commit -m "feat(store): enforce location limit (10 / 50 for AI-allowed)"
```

---

## Phase 5 — ゲストモード（未ログイン→現在地のみ）

### Task 5.1: store に `guestMode` 状態

**Files:**
- Modify: `src/store.ts`（AppState型・初期値・アクション）

- [ ] **Step 1: 型にフィールドとアクションを追加**

`interface AppState` の `aiAllowed: boolean;` の直後に追加:

```ts
  guestMode: boolean;
```

`setAiAllowed: (allowed: boolean) => void;` の直後に追加:

```ts
  setGuestMode: (on: boolean) => void;
```

- [ ] **Step 2: 初期値（localStorage 復元）とアクション**

初期値群の `aiAllowed: false,` の直後に追加:

```ts
  guestMode: typeof localStorage !== 'undefined' && localStorage.getItem('guestMode') === '1',
```

`setAiAllowed: (allowed) => set({ aiAllowed: allowed }),` の直後に追加:

```ts
  setGuestMode: (on) => {
    try {
      if (on) localStorage.setItem('guestMode', '1');
      else localStorage.removeItem('guestMode');
    } catch { /* localStorage 不可環境は無視 */ }
    set({ guestMode: on });
  },
```

- [ ] **Step 3: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 4: コミット**

```bash
git add src/store.ts
git commit -m "feat(store): add guestMode state with localStorage persistence"
```

---

### Task 5.2: LandingPage に「ログインせずに試す」ボタン

**Files:**
- Modify: `src/components/LandingPage.tsx:697-740`（LandingPage 本体・props）, `:182-222`（Hero に導線追加）

- [ ] **Step 1: LandingPage が onTryGuest を受け取るようにする**

`export function LandingPage() {` を次に変更:

```tsx
export function LandingPage({ onTryGuest }: { onTryGuest: () => void }) {
```

- [ ] **Step 2: Hero に props を渡す**

`LandingPage` の return 内、`<Hero loading={loading} error={error} onLogin={handleLogin} />` を次に変更:

```tsx
      <Hero loading={loading} error={error} onLogin={handleLogin} onTryGuest={onTryGuest} />
```

- [ ] **Step 3: Hero に「ログインせずに試す」ボタンを追加**

`function Hero({ loading, error, onLogin }: { loading: boolean; error: string | null; onLogin: () => void }) {` のシグネチャを変更:

```tsx
function Hero({ loading, error, onLogin, onTryGuest }: { loading: boolean; error: string | null; onLogin: () => void; onTryGuest: () => void }) {
```

Hero 内、登録CTAボタン（`<button className="lp-cta" onClick={onLogin} ...>...</button>`）の直後・`<p ...>登録30秒・いまは完全無料</p>` の直前に追加:

```tsx
          <button
            onClick={onTryGuest}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.86rem',
              padding: '0.6rem 0.2rem', marginLeft: '0.6rem',
            }}
          >
            ログインせずに試す（現在地のみ）
            <ArrowRight size={15} />
          </button>
```

- [ ] **Step 4: ビルド**

Run: `npm run build`
Expected: エラーなく完了（`onTryGuest` 未配線でも型は通る。配線は Task 5.3）。

- [ ] **Step 5: コミット**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(lp): add try-without-login button (onTryGuest)"
```

---

### Task 5.3: App.tsx のログインゲート改修

**Files:**
- Modify: `src/App.tsx:137`（store分割代入）, `src/App.tsx:1475-1477`（ゲート）

- [ ] **Step 1: store から guestMode/setGuestMode を取得**

`src/App.tsx:137` の分割代入に `guestMode` と `setGuestMode` を追加:

```ts
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings, geoLocation, setGeoLocation, setGeoStatus, setAiAllowed, loadAiAllowed, guestMode, setGuestMode } = useAppStore();
```

- [ ] **Step 2: ログイン成功時に guestMode を解除**

`src/App.tsx` の onAuthStateChanged 内、`if (firebaseUser) {` ブロック先頭（`try {` の前）に追加:

```ts
        setGuestMode(false);
```

- [ ] **Step 3: ゲートを guestMode 対応に**

`src/App.tsx:1475-1477` を次に置き換える:

```tsx
  if (!user && !guestMode) {
    return <LandingPage onTryGuest={() => setGuestMode(true)} />;
  }
```

- [ ] **Step 4: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 5: 手動確認**

Run: `npm run dev`
- 未ログイン状態でLP表示 → 「ログインせずに試す」クリック → アプリ本体が表示され、位置情報許可後に現在地の予報が出る。AI枠は Coming Soon。
- リロードしてもLPに戻らずアプリ本体のまま（localStorage 永続）。
Expected: ゲストで現在地予報＋Coming Soon、リロード維持。

- [ ] **Step 6: コミット**

```bash
git add src/App.tsx
git commit -m "feat(auth): allow guest (current-location-only) past login gate"
```

---

### Task 5.4: ゲスト時ヘッダーのログインボタン化

**Files:**
- Modify: `src/App.tsx`（デスクトップ／モバイルヘッダーの右側ブロック）

- [ ] **Step 1: ゲスト判定を用意**

`src/App.tsx` のヘッダー JSX 直前（`return ( <> <div style={{ ...header... }}>` の前）で参照できる位置に、`const isGuest = !user && guestMode;` を定義する（コンポーネント本体スコープ、例えば `const isMobile = ...` の近く）。

- [ ] **Step 2: ゲスト時はアバター／ログアウトの代わりにログインボタン**

ヘッダーの右側ブロックで、`user.photoURL`／ログアウトボタン（`signOut(auth)`）を含む箇所を、ゲストでは「ログイン」ボタンに差し替える。デスクトップ側 [src/App.tsx の `signOut(auth)` ボタン] とモバイル側それぞれで、`user` が存在する場合のみ従来のアバター＋ログアウトを描画し、`isGuest` の場合は次のボタンを描画する:

```tsx
              <button
                className="secondary"
                onClick={() => setGuestMode(false)}
                title="ログイン"
                style={{ padding: '0.4rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', borderRadius: 'var(--radius-md)' }}
              >
                ログイン
              </button>
```

（`setGuestMode(false)` でゲストを抜けると `!user && !guestMode` によりLP＝ログイン画面へ戻る。）

実装メモ: 既存ヘッダーは `user` 前提でアバター等を参照しているため、`user ? ( ...従来... ) : ( ...上記ログインボタン... )` の三項で囲む。`user.photoURL` 参照は `user &&` ガード下に置くこと。

- [ ] **Step 3: ビルド**

Run: `npm run build`
Expected: エラーなく完了（`user` が null の可能性が出るため、ヘッダー内の `user.xxx` 参照箇所すべてに `user &&` ガードが必要。型エラーが出たら該当箇所をガードする）。

- [ ] **Step 4: 手動確認**

Run: `npm run dev`
ゲストモードでヘッダー右に「ログイン」ボタンが出る → クリックでLP（ログイン画面）に戻る。ログイン後はアバター＋ログアウトに戻る。
Expected: ゲスト=ログインボタン、ログイン後=従来表示。

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx
git commit -m "feat(header): show login button for guests"
```

---

### Task 5.5: ゲスト時の設定タブをログイン誘導に差し替え

**Files:**
- Modify: `src/App.tsx:2501`（SettingsTab 描画）

- [ ] **Step 1: ゲストでは設定タブをログイン誘導カードに**

`src/App.tsx:2501` の `{topTab === 'settings' && <SettingsTab />}` を次に置き換える（`isGuest` は Task 5.4 Step 1 で定義済み）:

```tsx
      {topTab === 'settings' && (isGuest ? (
        <div className="app-container">
          <div className="glass-panel" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>ログインが必要です</p>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1.2rem' }}>
              地点の登録や各種設定は、ログインすると利用できます。<br />未ログインでは現在地の天気のみご覧いただけます。
            </p>
            <button
              className="secondary"
              onClick={() => setGuestMode(false)}
              style={{ padding: '0.5rem 1.2rem', borderRadius: 'var(--radius-md)' }}
            >
              ログインする
            </button>
          </div>
        </div>
      ) : (
        <SettingsTab />
      ))}
```

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: エラーなく完了。

- [ ] **Step 3: 手動確認**

Run: `npm run dev`
ゲストモードで設定タブを開く → 「ログインが必要です」カード＋「ログインする」ボタン。クリックでLPへ。
Expected: ゲストは設定不可・ログイン誘導。

- [ ] **Step 4: コミット**

```bash
git add src/App.tsx
git commit -m "feat(settings): show login prompt for guests in settings tab"
```

---

## Phase 6 — 統合検証

### Task 6.1: 全状態の手動E2E確認

**Files:** （変更なし。検証のみ）

- [ ] **Step 1: 本番相当ビルドで wrangler 起動**

Run: `npm run build && npx wrangler pages dev dist`

- [ ] **Step 2: 3状態 ＋ サーバー認可を確認**

以下を順に確認しチェックする:
- [ ] 未ログイン（ゲスト）: LP→「ログインせずに試す」→現在地の予報表示・地点セレクタに保存地点なし・AI枠 Coming Soon。
- [ ] ログイン非許可（AI_ALLOWLIST に無いメール）: ログイン→地点を10件まで登録可・11件目はエラー・AI枠 Coming Soon。
- [ ] ログインAI許可（AI_ALLOWLIST に有るメール）: 実AIコメント表示・地点を50件まで登録可。
- [ ] サーバー認可: ブラウザのコンソール（または curl）で未認証のまま `POST /api/ai-comment` → 401。非許可ユーザーのトークンで → 403（Gemini 未呼び出し）。

- [ ] **Step 3: 結果を session-log に記録（コミットは Wrap-up 時）**

確認結果を `tasks/session-log.md` に追記する（本タスクでのコミットは不要。最終のセッション Wrap-up でまとめてコミットする）。

---

## 本番デプロイ前チェックリスト（手動TODO・コード外）

- [ ] Cloudflare Pages の環境変数に `AI_ALLOWLIST`（許可メールをカンマ区切り）と `FIREBASE_PROJECT_ID` を設定。
- [ ] `jose` が本番ビルドに含まれることを確認（`npm run build` 後の `functions` バンドル）。
- [ ] Firestore セキュリティルールが `users/{uid}` を本人のみ読み書きに制限していることを確認（本機能のスコープ外だが前提。開いている場合は別途対応）。
