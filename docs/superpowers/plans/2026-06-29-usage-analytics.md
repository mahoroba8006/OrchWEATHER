# 利用状況アナリティクス 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GA4（Firebase Analytics）を導入し、有料化判断に必要なリテンション・利用頻度・アクティブ数を計測。ファネル補強の最小カスタムイベント3種と、登録地域のオンデマンド集計スクリプトを追加する。

**Architecture:** Firebase Analytics SDK を `src/lib/analytics.ts` の薄いラッパー越しに使う。measurementId 未設定環境（ローカル開発）では no-op になり安全。カスタムイベントは `guest_start` / `login` / `weather_view` の3種のみ。登録地域は firebase-admin の独立スクリプトで手動集計（常設しない）。

**Tech Stack:** React 19 + Vite 8 + TypeScript / Firebase 12（Analytics は同梱）/ firebase-admin（スクリプトのみ）

**検証方針:** 本プロジェクトはテスト基盤を持たない（vitest 未導入）。CLAUDE.md の「最小限の影響・YAGNI」に従い、計測コードのためのテスト基盤新設はしない。各タスクの検証は **`npm run build`（`tsc -b && vite build`）通過** と、最終タスクでの **GA4 DebugView 手動確認** で行う。

---

## File Structure

| ファイル | 役割 | 操作 |
|---|---|---|
| `src/lib/firebase.ts` | Firebase 初期化。`app` を export し、config に measurementId を追加 | Modify |
| `src/lib/analytics.ts` | Analytics 薄いラッパー（init + 3イベント関数）。唯一の計測窓口 | Create |
| `src/App.tsx` | `guest_start`（1481行）と `weather_view`（weatherData 充足時）を発火 | Modify |
| `src/components/LandingPage.tsx` | `login` 発火（handleLogin 先頭） | Modify |
| `src/components/LoginScreen.tsx` | `login` 発火（handleLogin 先頭） | Modify |
| `scripts/aggregate-regions.mjs` | 登録地域のオンデマンド集計（firebase-admin） | Create |
| `public/privacy-policy.html` | GA4 使用の明記を追記 | Modify |
| `.env.example` | `VITE_FIREBASE_MEASUREMENT_ID` の存在を明示（あれば） | Modify |

---

## Task 1: Analytics ラッパーと firebase.ts の app export

計測の唯一の窓口を作る。measurementId 未設定・非対応ブラウザでは no-op にして、ローカル開発やテストでクラッシュしないようにする。

**Files:**
- Modify: `src/lib/firebase.ts`
- Create: `src/lib/analytics.ts`

- [ ] **Step 1: firebase.ts に measurementId を追加し app を export する**

`src/lib/firebase.ts` を以下に置き換える（既存の auth/db export は維持）:

```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
```

- [ ] **Step 2: analytics.ts を新規作成する**

`src/lib/analytics.ts` を新規作成:

```ts
// アプリ全体の計測窓口。
// measurementId 未設定（ローカル開発）や非対応ブラウザでは no-op になり、
// 計測の失敗がアプリ本体の動作を妨げないようにする（fire-and-forget で良い唯一の例外）。
import { getAnalytics, logEvent, isSupported, type Analytics } from 'firebase/analytics';
import { app } from './firebase';

let analytics: Analytics | null = null;

// 初期化は非同期（isSupported）。measurementId が無ければ初期化しない。
if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
  isSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(() => {
      // 計測の初期化失敗は握りつぶす（アプリ本体に影響させない）
    });
}

function track(name: string, params?: Record<string, unknown>): void {
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch {
    // 計測失敗は無視
  }
}

/** Google ログイン操作の発生。GA4 予約イベント名 'login' を使う。 */
export function logLogin(): void {
  track('login', { method: 'google' });
}

/** 「ログインせずに試す」= ゲスト試用の開始。 */
export function logGuestStart(): void {
  track('guest_start');
}

// weather_view はセッション中に一度だけ撃つ（自動更新・再フェッチで膨らませない）。
let weatherViewLogged = false;
/** コア機能（天気データ表示）への到達。1セッション1回のみ実発火。 */
export function logWeatherView(): void {
  if (weatherViewLogged) return;
  weatherViewLogged = true;
  track('weather_view');
}
```

- [ ] **Step 3: ビルドで型エラーが無いことを確認**

Run: `npm run build`
Expected: PASS（`tsc -b` がエラーなく完了し `vite build` が成功）

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase.ts src/lib/analytics.ts
git commit -m "feat(analytics): Firebase Analytics ラッパーを追加（no-op フォールバック付き）"
```

---

## Task 2: guest_start イベントを発火

「ログインせずに試す」クリックで `guest_start` を撃つ。発火点は App.tsx の `onTryGuest`。

**Files:**
- Modify: `src/App.tsx:1481`

- [ ] **Step 1: analytics をインポート**

`src/App.tsx` の import 群（17行目 `import { HelpPage } ...` の直後）に追加:

```ts
import { logGuestStart, logWeatherView, logLogin } from './lib/analytics';
```

（logWeatherView / logLogin は後続タスクで使う。まとめて import しておく。）

- [ ] **Step 2: onTryGuest に計測を追加**

`src/App.tsx:1481` の以下を:

```tsx
  if (!user && !guestMode) {
    return <LandingPage onTryGuest={() => setGuestMode(true)} />;
  }
```

次に変更:

```tsx
  if (!user && !guestMode) {
    return <LandingPage onTryGuest={() => { logGuestStart(); setGuestMode(true); }} />;
  }
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(analytics): ゲスト試用開始で guest_start を計測"
```

---

## Task 3: login イベントを発火（2箇所）

ログインボタンのクリック（= ログイン操作の発生）で `login` を撃つ。LandingPage と LoginScreen の両 handleLogin 先頭に入れる。クリック時点で撃つことで popup/redirect どちらの経路でも確実に1回計上する。

**Files:**
- Modify: `src/components/LandingPage.tsx:977`
- Modify: `src/components/LoginScreen.tsx:31`

- [ ] **Step 1: LandingPage に import と発火を追加**

`src/components/LandingPage.tsx` の import 群（先頭付近、`import { auth } ...` がある近辺）に追加:

```ts
import { logLogin } from '../lib/analytics';
```

`src/components/LandingPage.tsx:977` の handleLogin を:

```tsx
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
```

次に変更（`logLogin()` を try の前、setLoading の後に挿入）:

```tsx
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    logLogin();
    try {
```

- [ ] **Step 2: LoginScreen に import と発火を追加**

`src/components/LoginScreen.tsx` の import 群（`import { auth } from '../lib/firebase';` の直後、4行目あたり）に追加:

```ts
import { logLogin } from '../lib/analytics';
```

`src/components/LoginScreen.tsx:31` の handleLogin を:

```tsx
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
```

次に変更:

```tsx
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    logLogin();
    try {
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/LandingPage.tsx src/components/LoginScreen.tsx
git commit -m "feat(analytics): ログイン操作で login を計測"
```

---

## Task 4: weather_view イベントを発火（セッション1回）

天気データが初めて揃ったタイミングで `weather_view` を撃つ。`logWeatherView` 内のフラグで1セッション1回に制限済みなので、App 側は weatherData 充足のたびに呼んで良い。

**Files:**
- Modify: `src/App.tsx`（`useWeatherData` 呼び出し = 313行付近の直後に useEffect を追加）

- [ ] **Step 1: weatherData 充足時に発火する useEffect を追加**

`src/App.tsx:313` の以下の行:

```tsx
  const { data: weatherData, loading, loadingStatus, error } = useWeatherData(committedTargets);
```

の直後に、次の useEffect を挿入:

```tsx
  // コア機能（天気データ表示）への到達を計測。logWeatherView 側でセッション1回に制限。
  useEffect(() => {
    if (Object.keys(weatherData).length > 0) {
      logWeatherView();
    }
  }, [weatherData]);
```

（`logWeatherView` は Task 2 Step 1 で import 済み。`useEffect` は既に import されている。）

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(analytics): 天気データ表示到達で weather_view を計測（セッション1回）"
```

---

## Task 5: プライバシーポリシーに GA4 使用を明記

Cookie 同意バナーは出さない方針のため、ポリシーへの記載で対応する。

**Files:**
- Modify: `public/privacy-policy.html`

- [ ] **Step 1: 現在の構造を確認**

Run: `npm run build` の前に、`public/privacy-policy.html` を開き、既存の見出し（`<h2>` 等）の文体・タグ構造を確認する。既存項目の最後の閉じタグ直後に、同じ体裁で1セクションを追記する。

- [ ] **Step 2: アクセス解析セクションを追記**

`public/privacy-policy.html` の本文末尾（最後のセクションの直後、フッターや `</body>` の前）に、既存の見出しレベルに合わせて以下を追記する（タグは既存の体裁に合わせること。以下は `<h2>`/`<p>` を使う例）:

```html
<h2>アクセス解析ツールについて</h2>
<p>
  本サービスは、利用状況の把握とサービス改善のため、Google が提供するアクセス解析ツール「Google Analytics」を使用しています。
  Google Analytics は Cookie を利用して匿名のトラフィックデータを収集します。収集されるデータは匿名であり、個人を特定するものではありません。
  この機能は Cookie を無効にすることで収集を拒否できます。詳細は
  <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google のポリシー</a>
  をご確認ください。
</p>
```

- [ ] **Step 3: ビルド確認（静的ファイルなので build が通ればよい）**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/privacy-policy.html
git commit -m "docs(privacy): プライバシーポリシーに Google Analytics 使用を明記"
```

---

## Task 6: 登録地域のオンデマンド集計スクリプト（独立・スキップ可）

> **注:** このタスクは firebase-admin のサービスアカウント鍵が必要で、ユーザー作業が絡む。地域は「参考程度」のため、鍵準備が難しい場合は後回しにしてよい。前タスク群（GA4 計測）とは独立しているため、ここをスキップしても計測は機能する。

全 `users/{uid}/locations` の `name` を読み、出現数で集計してコンソール出力する。常設しない。

**Files:**
- Create: `scripts/aggregate-regions.mjs`
- Modify: `package.json`（firebase-admin を devDependencies に追加）

- [ ] **Step 1: firebase-admin を devDependency として追加**

Run: `npm install --save-dev firebase-admin`
Expected: `package.json` の devDependencies に `firebase-admin` が追加され、エラーなく完了

- [ ] **Step 2: 集計スクリプトを作成**

`scripts/aggregate-regions.mjs` を新規作成:

```js
// 登録地域のオンデマンド集計。
// 実行前にサービスアカウント鍵のパスを環境変数で渡すこと:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json node scripts/aggregate-regions.mjs
// 鍵は Firebase コンソール > プロジェクト設定 > サービスアカウント から発行。リポジトリにコミットしないこと。
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main() {
  const usersSnap = await db.collection('users').get();
  const counts = new Map();
  let userCount = 0;
  let locationCount = 0;

  for (const userDoc of usersSnap.docs) {
    userCount += 1;
    const locsSnap = await userDoc.ref.collection('locations').get();
    for (const loc of locsSnap.docs) {
      locationCount += 1;
      const name = (loc.data().name ?? '(名称未設定)').trim() || '(名称未設定)';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\nユーザー数: ${userCount} / 登録地点総数: ${locationCount}\n`);
  console.log('登録地域の分布（出現数 降順）:');
  for (const [name, count] of sorted) {
    console.log(`  ${String(count).padStart(4)}  ${name}`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('集計に失敗しました:', err);
  process.exit(1);
});
```

- [ ] **Step 3: 実行して動作確認**

Run: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json node scripts/aggregate-regions.mjs`
（Windows PowerShell の場合: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\key.json"; node scripts/aggregate-regions.mjs`）
Expected: ユーザー数・地点総数と、地域名ごとの出現数が降順で表示される

- [ ] **Step 4: 鍵をコミットしないことを確認**

`.gitignore` にサービスアカウント鍵のパターン（例 `*serviceAccount*.json`、`*-firebase-adminsdk-*.json`）が含まれているか確認。無ければ追記する。

- [ ] **Step 5: Commit**

```bash
git add scripts/aggregate-regions.mjs package.json package-lock.json .gitignore
git commit -m "feat(analytics): 登録地域のオンデマンド集計スクリプトを追加"
```

---

## Task 7: 最終検証とユーザー作業の引き渡し

**Files:** なし（検証とドキュメント確認のみ）

- [ ] **Step 1: フルビルド確認**

Run: `npm run build`
Expected: PASS

- [ ] **Step 2: ユーザー作業の案内をまとめる**

以下をユーザーに伝える（コードでは完結しない部分）:
1. Firebase コンソールで GA4 を有効化（プロジェクト設定 > 統合 > Google Analytics、または Analytics ダッシュボードから）し、`measurementId`（`G-XXXXXXXXXX`）を取得。
2. ローカル `.env` と Cloudflare Pages の本番 env に `VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX` を追加し、再デプロイ。
3. GA4 の DebugView を開き、ローカル or 本番で以下を手動確認:
   - LP 表示 → `page_view`
   - 「ログインせずに試す」→ `guest_start`
   - 「Googleで始める/ログイン」→ `login`
   - 天気データ表示 → `weather_view`（1セッション1回）
4. 数週間〜1ヶ月寝かせて、GA4 のリテンション・エンゲージメントレポートで有料化判断材料を蓄積する。

- [ ] **Step 3: セッションログ更新（プロジェクト運用ルール）**

`tasks/session-log.md` に本実装のセッションブロックを追記する。

---

## Self-Review（計画作成者によるチェック・完了済み）

- **Spec coverage:** ① GA4導入=Task1 / ②カスタムイベント3種=Task2,3,4 / ③地域集計=Task6 / ④プライバシー追記=Task5 / 環境変数案内=Task7。全 spec 要件にタスクが対応。
- **Placeholder scan:** TBD/TODO なし。全コードブロックは実コードを記載。
- **Type consistency:** `logLogin` / `logGuestStart` / `logWeatherView` の関数名が Task1 定義と Task2/3/4 使用で一致。`app` export（Task1）を analytics.ts が import で参照、一致。
- **検証の置換理由:** テスト基盤不在のため TDD ステップをビルド＋DebugView 手動確認に置換（CLAUDE.md「最小限の影響・YAGNI」優先）。
