# アプリ内ブラウザ検知・PWAインストール導線 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ内ブラウザから通常ブラウザへの移動を案内し、通常ブラウザではOS別のPWAインストール導線を提供する。

**Architecture:** UAとPWA状態を純粋関数へ分離し、`EnvironmentGuidance`が外部ブラウザ案内とインストール案内を優先順位付きで制御します。PWAは`vite-plugin-pwa`でmanifestとService Workerを生成します。

**Tech Stack:** React 19、TypeScript、Vite 8、Vitest、vite-plugin-pwa、lucide-react、Cloudflare Pages。

**Spec:** `docs/superpowers/specs/2026-09-08-in-app-browser-and-install-guidance-design.md`

## Global Constraints

- LINE、X、Instagram、Facebookだけを積極検出し、未知のWebViewは検出しない。
- `intent://`、独自スキーム、自動外部ブラウザ起動は追加しない。
- 外部ブラウザ案内は同一セッションだけ、インストール案内の「あとで」は7日間抑制する。
- Androidのボタンは`beforeinstallprompt`を受信したときだけ表示する。
- iPhone/iPadは手順表示、Mac/Windowsは対象外。standaloneとアプリ内ブラウザではインストール案内を出さない。
- 新規関数はテストを先に書き、失敗を確認してから実装する。

## File Structure

| File | Role |
|---|---|
| `src/lib/inAppBrowser.ts` | UAから対象アプリ内ブラウザとプラットフォームを判定する。 |
| `src/lib/installPrompt.ts` | standalone、OS、7日抑制から表示可否を決める。 |
| `src/components/OpenInBrowserDiagram.tsx` | 外部ブラウザへ移るSVG図解。 |
| `src/components/OpenInBrowserNotice.tsx` | 外部ブラウザ案内とURLコピーのモーダル。 |
| `src/components/InstallPrompt.tsx` | Android prompt/iOS手順のモーダル。 |
| `src/components/EnvironmentGuidance.tsx` | 判定、イベント、抑制、表示優先順位の共通入口。 |
| `src/App.tsx` | 共通入口を既存画面より外側にマウントする。 |
| `src/main.tsx` / `vite.config.ts` | Service Worker、PWA、Vitest設定。 |

### Task 1: テスト基盤とPWAプラグインを追加する

**Files:**

- Modify: `package.json`, `package-lock.json`, `vite.config.ts`

**Produces:** `npm run test` が `src/**/*.test.ts` を実行し、ViteがPWA生成を行える。

- [ ] **Step 1: 開発依存を追加する**

Run: `npm.cmd install -D vitest@^3 vite-plugin-pwa@^1`

Expected: `package.json` と lockfile に依存が追加される。

- [ ] **Step 2: テストスクリプトとVitest設定を追加する**

`package.json`へ`"test": "vitest run src"`と`"test:watch": "vitest src"`を追加する。`vite.config.ts`は`vitest/config`から`defineConfig`をimportし、`test: { environment: 'node', include: ['src/**/*.test.ts'] }`を設定する。

- [ ] **Step 3: 実行可能性を確認してコミットする**

Run: `npm.cmd run test`

Expected: テストなしをエラーにするVitest設定の場合は`passWithNoTests: true`を追加後、終了コード0。

Run: `git add package.json package-lock.json vite.config.ts; git commit -m "chore: add test and pwa build tooling"`

### Task 2: UA判定をTDDで実装する

**Files:**

- Create: `src/lib/inAppBrowser.ts`
- Create: `src/lib/inAppBrowser.test.ts`

**Interfaces:**

- Produces: `type Platform = 'ios' | 'android' | 'other'`
- Produces: `type InAppBrowserApp = 'LINE' | 'X' | 'Instagram' | 'Facebook'`
- Produces: `type InAppBrowser = { app: InAppBrowserApp; platform: Platform }`
- Produces: `detectInAppBrowser(ua: string): InAppBrowser | null`

- [ ] **Step 1: 失敗する検出テストを書く**

`src/lib/inAppBrowser.test.ts`で、LINE Android、X iOS、Instagram（FBAN併記）、Facebook、通常Chrome、`PowerLine/2.0`を順に検証する。期待値は対象4種だけ`{ app, platform }`、通常ChromeとPowerLineは`null`とする。

- [ ] **Step 2: テストが未実装で失敗することを確認する**

Run: `npm.cmd run test -- src/lib/inAppBrowser.test.ts`

Expected: `Failed to resolve import "./inAppBrowser"`。

- [ ] **Step 3: 最小実装を書く**

`LINE`は`/(?:^|\s)Line\/\d/`、`X`は`/(?:^|\s)(?:Twitter for iPhone|Twitter for iPad|TwitterAndroid)/`、`Instagram`は`/(?:^|\s)Instagram[\s/]/`、`Facebook`は`/\bFB(?:AN|AV)\//`で判定する。InstagramをFacebookより先に置く。プラットフォームはiPhone/iPad/iPodをiOS、AndroidをAndroid、それ以外をotherとする。

- [ ] **Step 4: テストを通してコミットする**

Run: `npm.cmd run test -- src/lib/inAppBrowser.test.ts`

Expected: 全ケースPASS。

Run: `git add src/lib/inAppBrowser.ts src/lib/inAppBrowser.test.ts; git commit -m "feat: detect supported in-app browsers"`

### Task 3: インストール表示可否をTDDで実装する

**Files:**

- Create: `src/lib/installPrompt.ts`
- Create: `src/lib/installPrompt.test.ts`

**Interfaces:**

- Consumes: `detectInAppBrowser(ua: string): InAppBrowser | null`
- Produces: `INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000`
- Produces: `isIosOrIpad(ua: string, maxTouchPoints: number): boolean`
- Produces: `shouldPromptInstall({ ua, standalone, maxTouchPoints, dismissedAt, now, androidPromptReady }): boolean`
- Produces: `isStandalone(): boolean`

- [ ] **Step 1: 失敗する表示可否テストを書く**

テストはiPhone Safari初回=true、standalone=false、LINE=false、Androidはイベント後のみ=true、7日未満のdismissedAt=false、ちょうど7日後=true、`Macintosh`かつtouchPoints>1のiPad=true、Mac touchPoints=0=falseを検証する。

- [ ] **Step 2: 未実装による失敗を確認する**

Run: `npm.cmd run test -- src/lib/installPrompt.test.ts`

Expected: `Failed to resolve import "./installPrompt"`。

- [ ] **Step 3: 最小実装を書く**

最初にstandalone、アプリ内ブラウザ、7日未満の抑制をfalseにする。次にiPhone/iPad/iPod、または`Macintosh && maxTouchPoints > 1`をtrueにする。残りは`/Android/`と`androidPromptReady`の両方がtrueの場合だけtrueにする。`isStandalone`はiOSの`navigator.standalone === true`と`matchMedia('(display-mode: standalone)')`のORとする。

- [ ] **Step 4: テストを通してコミットする**

Run: `npm.cmd run test -- src/lib/installPrompt.test.ts`

Expected: 全ケースPASS。

Run: `npm.cmd run test; git add src/lib/installPrompt.ts src/lib/installPrompt.test.ts; git commit -m "feat: add install prompt eligibility rules"`

### Task 4: PWA配信資産とService Workerを整える

**Files:**

- Modify: `vite.config.ts`, `src/main.tsx`, `index.html`
- Delete: `public/manifest.json`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

**Produces:** ビルド出力の`manifest.webmanifest`、`sw.js`、192px/512pxアイコン。Androidの`beforeinstallprompt`の前提を満たす。

- [ ] **Step 1: 専用サイズのPNGを作る**

既存`public/icon.png`（792x745）は変更せず、画像を縦横比維持で中央配置し、背景`#f0f4f8`の192px、512px、180px正方形PNGを生成する。

- [ ] **Step 2: `VitePWA`を設定する**

`registerType: 'autoUpdate'`、`includeAssets: ['apple-touch-icon.png']`を指定する。manifestは`name`/`short_name`をOrch.Weather、`lang: 'ja'`、`start_url: '/'`、`scope: '/'`、`display: 'standalone'`、`background_color: '#f0f4f8'`、`theme_color: '#51c49f'`、新しい192px・512pxアイコンとする。

- [ ] **Step 3: Service Worker登録とHTML移行を行う**

`src/main.tsx`で`virtual:pwa-register`の`registerSW({ immediate: true })`を呼ぶ。`index.html`から`/manifest.json`参照を削除しAppleアイコンを`/apple-touch-icon.png`へ切り替える。`public/manifest.json`は削除する。

- [ ] **Step 4: ビルド出力を確認してコミットする**

Run: `npm.cmd run build`

Expected: `dist/manifest.webmanifest`、`dist/sw.js`、`dist/icon-192.png`、`dist/icon-512.png`、`dist/apple-touch-icon.png`が存在し、manifestはstandaloneと2アイコンを含む。

Run: `git add vite.config.ts src/main.tsx index.html public/icon-192.png public/icon-512.png public/apple-touch-icon.png public/manifest.json; git commit -m "feat: add installable pwa assets"`

### Task 5: 外部ブラウザ・インストール案内を統合する

**Files:**

- Create: `src/components/OpenInBrowserDiagram.tsx`
- Create: `src/components/OpenInBrowserNotice.tsx`
- Create: `src/components/InstallPrompt.tsx`
- Create: `src/components/EnvironmentGuidance.tsx`
- Create: `src/components/EnvironmentGuidance.test.tsx`
- Modify: `src/App.tsx`, `package.json`, `package-lock.json`, `vite.config.ts`

**Interfaces:**

- Consumes: `InAppBrowser`、`detectInAppBrowser`、`isStandalone`、`shouldPromptInstall`。
- Produces: `EnvironmentGuidance(): JSX.Element | null`。

- [ ] **Step 1: コンポーネントの失敗テストを追加する**

`@testing-library/react`、`@testing-library/user-event`、`jsdom`を開発依存へ追加し、Vitest環境をjsdomへ変更する。テストではLINE UAとAndroidのinstall eventが同時にある場合、`ブラウザで開いてください`だけが表示され、`アプリをホーム画面に追加`は出ないことを確認する。iPhone Safariでは共有ボタン→ホーム画面追加手順、Androidはイベント保持後だけ`インストール`ボタンが出ることも確認する。

- [ ] **Step 2: 未実装で失敗を確認する**

Run: `npm.cmd run test -- src/components/EnvironmentGuidance.test.tsx`

Expected: `Failed to resolve import "./EnvironmentGuidance"`。

- [ ] **Step 3: 外部ブラウザ案内を実装する**

`OpenInBrowserDiagram`には、位置を断定しないアドレス欄、縦三点メニュー、「ブラウザで開く」「リンクをコピー」を描く。`OpenInBrowserNotice`には`role="dialog"`、`aria-modal="true"`、検出アプリ名、URL、コピー、長押しフォールバック、「あとで」を置く。コピーはClipboard API優先、hidden textareaと`document.execCommand('copy')`を二段目とする。

- [ ] **Step 4: インストール案内と統合制御を実装する**

`EnvironmentGuidance`は`beforeinstallprompt`を`preventDefault()`して保持し、`appinstalled`でイベントを破棄して閉じる。保持する型は`prompt(): Promise<void>`と`userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>`を持つイベントとする。外部ブラウザ案内を最優先し、その表示中はインストール案内を出さない。

外部ブラウザの「あとで」は`sessionStorage`キー`orchweather.inapp-dismissed`、インストールの「あとで」とAndroidのdismissedは`localStorage`キー`orchweather.install-dismissed-at`へ書く。ストレージ例外は無視しReact状態だけ閉じる。モーダル表示中はbodyスクロールを抑止しcleanupで復元する。

`InstallPrompt`はAndroidでは`onInstall`ボタン、iOS/iPadOSでは共有アイコンと`共有ボタン → ホーム画面に追加`手順だけを表示する。Androidの`prompt()`例外では短いエラーと「あとで」を表示する。

- [ ] **Step 5: `App.tsx`の最上位へ追加する**

`EnvironmentGuidance`を`authLoading`、`user`、`guestMode`による既存の早期returnより前に常に描画する。既存の`LoginScreen.tsx`は`App.tsx`から使われていないため変更しない。

- [ ] **Step 6: テスト・lint・buildを通してコミットする**

Run: `npm.cmd run test; npm.cmd run lint; npm.cmd run build`

Expected: すべて終了コード0。

Run: `git add src/components/OpenInBrowserDiagram.tsx src/components/OpenInBrowserNotice.tsx src/components/InstallPrompt.tsx src/components/EnvironmentGuidance.tsx src/components/EnvironmentGuidance.test.tsx src/App.tsx package.json package-lock.json vite.config.ts; git commit -m "feat: guide users to browser and pwa install"`

### Task 6: 本番相当と実機で確認する

**Files:**

- Modify: 実機確認で本機能の不備が見つかった場合だけTask 1〜5の対象ファイル。

- [ ] **Step 1: 本番ビルドを起動する**

Run: `npm.cmd run preview -- --host 127.0.0.1`

Expected: 本番ビルドの配信URLが表示される。

- [ ] **Step 2: PWA配信を確認する**

Applicationパネルでmanifest、192px/512pxアイコン、activated Service Worker、standalone設定を確認する。

- [ ] **Step 3: 実機導線を確認する**

LINEとXのiOS/Android、iOS Safari、Android Chromeで、外部ブラウザ案内、OS別インストール案内、あとで抑制、installed PWAでの非表示を確認する。

- [ ] **Step 4: 最終検証を行う**

Run: `npm.cmd run test; npm.cmd run lint; npm.cmd run build; git status --short`

Expected: テスト・lint・buildが終了コード0。本機能の実機対応で変更が生じた場合だけ、実際に変えたファイルをステージし`git commit -m "fix: polish browser and install guidance"`を実行する。

## Plan Self-Review

- 検知、図解、コピー、両方の抑制、OS別導線、standalone除外、PWA生成、アクセシビリティ、テストと実機確認をTask 1〜6で網羅している。
- 未定義のインターフェースや未決定の実装内容は含めていない。
- AndroidのインストールUIは保持イベントがある場合だけ描画するため、動作しないボタンを表示しない。
