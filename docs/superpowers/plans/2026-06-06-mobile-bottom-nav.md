# モバイル ボトムナビゲーション 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ表示でヘッダーの4タブ崩れを解消し、ボトムナビ（天気情報・あの時の天気・比較分析）＋ヘッダー設定ギアアイコンのモバイルUIを実装する。デスクトップは現状維持。

**Architecture:** `isMobile`（`window.innerWidth < 768`）フラグで分岐。ヘッダーをモバイル用にシンプル化（アイコン＋設定ギア）し、画面下端に固定ボトムナビを追加。コンテンツエリアにはボトムナビ分の `paddingBottom` を付与。新規コンポーネントは作らず `App.tsx` に inline で実装する（変更箇所が1ファイルに集約され追跡しやすい）。

**Tech Stack:** React 19, TypeScript, lucide-react（Sun/Clock/BarChart2/Settings — すべて既 import 済み）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/App.tsx` | ヘッダー条件分岐 + ボトムナビ JSX 追加 + コンテンツラッパー padding |

CSS は全て inline style で完結させる（既存 App.css のスコープ汚染を避けるため）。

---

## Task 1: モバイルヘッダーをシンプル化

**Files:**
- Modify: `src/App.tsx` L1386–L1447（ヘッダー div 全体）

**現状の構造（モバイルで崩れる箇所）:**
```
[アイコン] [タブ4つ flex:1] [avatar+logout Desktop only]
```
→ 4タブが横に入り切らず縦折れ

**モバイル後の構造:**
```
[アイコン]  [flex:1 spacer]  [avatar]  [⚙設定ボタン]
```

- [ ] **Step 1: App.tsx のヘッダー部分を条件分岐に書き換える**

`src/App.tsx` L1395–L1446 の「メインタブ」と「Desktop のみ」ブロックを以下に置換する:

```tsx
        {isMobile ? (
          /* ── モバイルヘッダー: アイコン + spacer + avatar + 設定ギア ── */
          <>
            <div style={{ flex: 1 }} />
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                width={28}
                height={28}
                style={{ borderRadius: '50%', border: '1.5px solid var(--accent-color)', flexShrink: 0 }}
              />
            )}
            <button
              onClick={() => setTopTab('settings')}
              style={{
                background: topTab === 'settings'
                  ? 'linear-gradient(135deg, var(--accent-color) 0%, #0f766e 100%)'
                  : 'rgba(167, 203, 192, 0.2)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0.45rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: topTab === 'settings' ? '#ffffff' : 'var(--text-secondary)',
                flexShrink: 0,
              }}
              title="設定"
            >
              <Settings size={20} />
            </button>
          </>
        ) : (
          /* ── デスクトップヘッダー: 4タブ + avatar + logout（現状維持） ── */
          <>
            <div className="premium-segmented-tab" style={{ background: 'rgba(167, 203, 192, 0.15)', flex: 1 }}>
              {(['weather', 'history', 'analysis', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTopTab(tab)}
                  style={{
                    padding: '0.5rem 1.2rem',
                    background: topTab === tab ? 'linear-gradient(135deg, var(--accent-color) 0%, #0f766e 100%)' : 'transparent',
                    color: topTab === tab ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    fontWeight: topTab === tab ? 700 : 500,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    borderRadius: 'calc(var(--radius-md) - 4px)',
                    boxShadow: topTab === tab ? '0 4px 12px rgba(13, 148, 136, 0.15)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  {tab === 'weather' ? '天気情報'
                    : tab === 'history' ? 'あの時の天気'
                    : tab === 'analysis' ? '比較分析'
                    : <><Settings size={13} /> 設定</>}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0, marginLeft: '0.25rem' }}>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? ''}
                  width={28}
                  height={28}
                  style={{ borderRadius: '50%', border: '1.5px solid var(--accent-color)' }}
                />
              )}
              <button
                className="secondary"
                onClick={() => signOut(auth)}
                title="ログアウト"
                style={{ padding: '0.4rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', borderRadius: 'var(--radius-md)' }}
              >
                <LogOut size={13} /> ログアウト
              </button>
            </div>
          </>
        )}
```

- [ ] **Step 2: ビルド確認**

```powershell
cd "c:\dev\気象アプリ"; npm run build
```

Expected: `✓ built in ...ms`（型エラーなし）

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "refactor: モバイルヘッダーをシンプル化（設定ギアのみ）"
```

---

## Task 2: ボトムナビゲーションバー追加

**Files:**
- Modify: `src/App.tsx`（`</>`閉じタグの直前にボトムナビ JSX を追加）

使用アイコン（すべて既 import 済み）:
- 天気情報: `Sun`
- あの時の天気: `Clock`
- 比較分析: `BarChart2`

- [ ] **Step 1: ボトムナビ JSX をフラグメントの末尾（`</>` 直前）に追加**

`{topTab === 'settings' && <SettingsTab />}` の直後、`</>` の直前に以下を挿入:

```tsx
      {/* ── モバイル ボトムナビゲーション ── */}
      {isMobile && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 'calc(56px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--card-border)',
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 50,
        }}>
          {([
            { id: 'weather',  label: '天気情報',      Icon: Sun      },
            { id: 'history',  label: 'あの時の天気',  Icon: Clock    },
            { id: 'analysis', label: '比較分析',       Icon: BarChart2 },
          ] as const).map(({ id, label, Icon }) => {
            const active = topTab === id;
            return (
              <button
                key={id}
                onClick={() => setTopTab(id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.2rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 400,
                  fontSize: '0.65rem',
                  padding: '0.4rem 0',
                  transition: 'color 0.2s ease',
                }}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
                {label}
              </button>
            );
          })}
        </nav>
      )}
```

- [ ] **Step 2: ビルド確認**

```powershell
cd "c:\dev\気象アプリ"; npm run build
```

Expected: `✓ built in ...ms`

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "feat: モバイル用ボトムナビゲーションを追加"
```

---

## Task 3: コンテンツエリアのボトムパディング

ボトムナビ（56px + safe-area）の下にコンテンツが隠れないよう、モバイル時にコンテンツラッパーへ `paddingBottom` を付与する。

**Files:**
- Modify: `src/App.tsx`（コンテンツ部分のラッパー）

**現状の構造:**
```tsx
{topTab === 'weather'   && <WeatherTab />}
{topTab === 'history'   && <HistoricalWeatherTab />}
{topTab === 'analysis'  && <div className="app-container">...</div>}
{topTab === 'settings'  && <SettingsTab />}
```

- [ ] **Step 1: コンテンツ全体を padding 付きラッパーで包む**

`App.tsx` の `{topTab === 'weather' && <WeatherTab />}` の直前に開始タグを、`{topTab === 'settings' && <SettingsTab />}` の直後に閉じタグを追加する:

```tsx
      <div style={isMobile ? { paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' } : undefined}>
        {topTab === 'weather'   && <WeatherTab />}
        {topTab === 'history'   && <HistoricalWeatherTab />}
        {topTab === 'analysis'  && (
          /* ... 既存の analysis JSX ... */
        )}
        {topTab === 'settings'  && <SettingsTab />}
      </div>
```

> **注意:** analysis タブの長大な JSX はそのまま内部に含める。構造変更はラッパー追加のみ。

- [ ] **Step 2: ビルド確認**

```powershell
cd "c:\dev\気象アプリ"; npm run build
```

Expected: `✓ built in ...ms`

- [ ] **Step 3: DevTools でモバイル表示確認（375px）**

1. `npm run dev` 起動
2. Chrome DevTools → デバイスツールバー → iPhone SE（375×667）
3. ヘッダー: アイコン + 設定ギアのみ ✓
4. ボトムナビ: 天気情報・あの時の天気・比較分析 の3タブ ✓
5. 各タブタップでコンテンツ切替 ✓
6. 設定ギアタップで設定タブに切替 ✓
7. コンテンツ最下部がボトムナビに隠れないこと ✓

- [ ] **Step 4: デスクトップ表示確認（1280px）**

1. DevTools でデスクトップ幅に戻す
2. ヘッダー: アイコン + 4タブ + avatar + ログアウト（現状と同一）✓
3. ボトムナビが表示されないこと ✓

- [ ] **Step 5: 最終コミット & push**

```bash
git add src/App.tsx
git commit -m "feat: モバイルコンテンツラッパーにボトムナビ分のpadding追加"
git push
```
