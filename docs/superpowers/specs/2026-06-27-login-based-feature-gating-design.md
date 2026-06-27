# ログイン状態による機能制限 — 設計

作成日: 2026-06-27

## 背景・目的

ログイン状態に応じてアプリの機能を段階的に制限する。狙いは2つ ——(1) AIコメント（Gemini, 1回≈¥1.2）のコスト漏れを止める、(2) 未ログインでも現在地だけは試せる導線を作りログイン率を測定する。

現状の課題:
- **AIエンドポイントに認証が無い**: [functions/api/ai-comment.ts](../../../functions/api/ai-comment.ts) はPOSTされたpayloadをそのままGeminiに流すだけ。`uid` の有無でAIを出し分けているのは [src/hooks/useAiComment.ts](../../../src/hooks/useAiComment.ts) のクライアント側だけで、URLを直接叩けば未ログインでもGeminiを呼べて課金が発生する。
- **未ログインは全ブロック**: [src/App.tsx:1476](../../../src/App.tsx#L1476) の `if(!user) return <LandingPage/>` がアプリ本体を完全に塞いでいる。

## 3つのアクセス状態（全体像）

| 状態 | 地点登録 | AIコメント | 入口 |
|---|---|---|---|
| **未ログイン（ゲスト）** | 現在地のみ・保存不可 | Coming Soon | LPの「ログインせずに試す」 |
| **ログイン・非許可** | 最大 **10** 地点を保存可 | Coming Soon | Googleログイン |
| **ログイン・AI許可**（env名簿） | 最大 **50** 地点を保存可 | 実AI | Googleログイン（名簿登録済み） |

- 現在地（`__geo__`）は仮想地点で `locations` に含まれず、地点上限のカウント外。

## 1. 未ログイン（ゲスト）導線

- LandingPage に「ログインせずに試す」ボタンを追加 → `guestMode` フラグを立ててアプリ本体を表示する。
- [src/App.tsx:1476](../../../src/App.tsx#L1476) の `if(!user) return <LandingPage/>` を `if(!user && !guestMode) return <LandingPage onTryGuest=.../>` に変更。
- ゲスト時の挙動:
  - `locationId` は `__geo__` 固定。
  - 地点セレクタ／地点追加UIは非表示。
  - 設定タブの uid 必須項目は無効。
  - ヘッダーに「ログイン」ボタンを表示（随時ログインへ昇格できる）。
- `guestMode` は localStorage に保存し、リロードで再びLPに戻さない。ログアウト時にクリア。
- 既存の `__geo__`・uid-null 経路にそのまま乗るため、本体ロジックへの影響は最小。

## 2. AIサーバー強制（B方式: env許可リスト）

許可リストの保管場所は **Cloudflare 環境変数**（B方式）。理由は、身内（数人・低頻度）の規模では最もシンプルで、将来の課金ティア（A2: カスタムクレーム）へ移行する際も捨てるコードが約数行で済むため（移行の土台＝トークン検証が共有再利用される）。

- **新規共有ヘルパー** `functions/api/_auth.ts`:
  - Firebase IDトークンを検証する。Googleの公開鍵（`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`）を取得し、WebCrypto で RS256 署名を検証。`iss == https://securetoken.google.com/<FIREBASE_PROJECT_ID>`、`aud == <FIREBASE_PROJECT_ID>`、`exp` 未経過を検査。
  - 戻り値は **`{ uid, email }`**。（uid も返すのは、将来の「日次お試しAI」がuid単位でカウントするための前準備。）
  - 公開鍵はレスポンスの `Cache-Control: max-age` を尊重してメモリキャッシュ。
- [functions/api/ai-comment.ts](../../../functions/api/ai-comment.ts) / [functions/api/ai-custom.ts](../../../functions/api/ai-custom.ts) の冒頭:
  - `Authorization: Bearer <idToken>` が無い／検証失敗 → **401**。
  - 検証OKだが `email` が `AI_ALLOWLIST` に含まれない → **403**（Geminiを呼ぶ前に短絡。課金ゼロ）。
  - 両方クリアで既存のGemini処理へ。
- **新規 `/api/me`**（`functions/api/me.ts`）:
  - トークンを検証し `{ aiAllowed: boolean }` を返すだけ（`_auth.ts` を再利用、〜15行）。
  - クライアントの「身内判定」の**単一の真実**。名簿をサーバーenv 1か所に集約し、クライアントバンドルに個人メールを露出させない。
- 環境変数（Cloudflare Pages）:
  - `AI_ALLOWLIST`: カンマ区切りのメールアドレス。
  - `FIREBASE_PROJECT_ID`: トークンの `aud`/`iss` 検証用。
- クライアント [src/api/aiComment.ts](../../../src/api/aiComment.ts):
  - `fetchAiComment` / `fetchAiCustomComment` の fetch に `Authorization: Bearer <idToken>` を付与（呼び出し側がトークンを渡す）。

## 3. クライアントのAI表示・地点上限の分岐

- ログイン時に `/api/me` を1回呼び、`aiAllowed` を store に保存する。
- **AIコメント枠**:
  - `aiAllowed === true` → 実AIを fetch（既存経路）。
  - それ以外（ゲスト・ログイン非許可）→ **Coming Soon カード**を表示。
  - Coming Soon は静的プレースホルダ（「AIによる段取りまとめは近日提供予定」）。需要測定の計装（クリック/通知登録）は別タスク「測定の出口閾値」に委ね、本設計では作り込まない。
- **地点上限**:
  - [src/store.ts:262](../../../src/store.ts#L262) `addLocation` の冒頭で `limit = aiAllowed ? 50 : 10`。`get().locations.length >= limit` ならエラーを返してブロック。
  - UIは上限到達時に追加ボタンを無効化し「最大N地点まで」を表示。

## 4. セキュリティ補足

- B方式は名簿がサーバーenvにあり、Firestore に `aiEnabled` フィールドを持たないため、**この機能のためのFirestoreセキュリティルール変更は不要**。
- 地点上限（10/50）はクライアント側のUXゲートであり、コスト上のセキュリティ要件ではない（突破されても自分のFirestoreが微増するだけ）。AIのコスト保護はサーバー側401/403が担う。
- 既存のFirestoreルール（`users/{uid}` の own-data 制限）は本変更の前提。現状ルールが開いている場合は別途要対応（本設計のスコープ外、要注意点として記録）。

## 5. 将来拡張のための前準備（今回作らないが考慮済み）

- **日次お試しAI**（ログイン非許可ユーザーに1日1回など）: Bの土台（トークン検証）の上に「uid単位の日次カウンター」を足すだけで実現可能。
  - 許可判定 = `(email∈AI_ALLOWLIST) OR (loggedIn AND 今日の利用回数 < N)`。
  - カウンターの保管は **Cloudflare KV / Durable Objects**（Firestoreではない）。判定がCloudflareにあるため、Firestoreを使うと避けたサービスアカウント配管が復活する。
  - 濫用口（捨てアカウントでのタダ取り）は実装時にIP/デバイス併用を検討。AI1回≈¥1.2で旨味が小さいため現時点では考慮不要。
- **課金ティア**: B → A2（カスタムクレーム）へ移行。土台のトークン検証を再利用し、`(email∈名簿) OR (claims.aiEnabled===true)` のOR分岐を足すだけ。クレーム付与は決済Webhook（Cloud Function）で `setCustomUserClaims`。

## 6. 検証

- `npm run build` で型チェック・ビルド通過。
- 手動確認:
  1. 未ログイン（ゲスト）= 現在地表示・AI Coming Soon・地点追加不可。
  2. ログイン非許可 = 最大10地点・AI Coming Soon。
  3. 名簿登録メール = 実AI表示・最大50地点。
  4. 地点を上限+1件追加しようとするとブロックされる。
  5. 未認証で `/api/ai-comment` を直叩き → 401。非許可ユーザーのトークンで叩く → 403（Gemini未呼び出し）。

## 変更ファイル（想定）

- 新規: `functions/api/_auth.ts`, `functions/api/me.ts`
- 変更: `functions/api/ai-comment.ts`, `functions/api/ai-custom.ts`
- 変更: `src/api/aiComment.ts`（Authヘッダー）
- 変更: `src/App.tsx`（guestMode 導線・ゲスト時UI制御）
- 変更: `src/store.ts`（aiAllowed 状態・/api/me 取得・addLocation 上限）
- 変更: LandingPage コンポーネント（「ログインせずに試す」ボタン）
- 変更: AIコメント描画（AiCommentCard / WeatherTab の Coming Soon 分岐）
- 環境変数追加: `AI_ALLOWLIST`, `FIREBASE_PROJECT_ID`（`.dev.vars` と Cloudflare 本番）
