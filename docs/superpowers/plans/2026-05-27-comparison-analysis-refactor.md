# 比較分析タブ リファクタリング Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 比較件数を最大2件に絞り、差の方向を「2件目基準で1件目に表示」へ反転し、予報日にも差を表示する。

**Architecture:** `src/App.tsx` 1ファイルのみの変更。差ロジックは `renderValueBox` 内の `refId` 変数1行と `computeAccumDiff` 関数の書き換えで完結する。他ファイルへの影響なし。

**Tech Stack:** React 19, TypeScript, Recharts, Vite

---

## 変更ファイル一覧

- Modify: `src/App.tsx`
  - L273: `addTarget()` の上限ガード 3→2
  - L1313: ヘッダーラベル "最大3件"→"最大2件"
  - L1320–1336: index 0 の「基準」span を削除
  - L1369: 「追加」ボタンの表示条件 `< 3`→`< 2`
  - L1047: `refId` の参照を `targets[0]` → `targets[1]` に変更
  - L1054–1089: `computeAccumDiff` を forecast key 対応版に書き換え

---

## Task 1: 最大件数を3から2へ変更（UI上限・ラベル）

**Files:**
- Modify: `src/App.tsx`

### 変更箇所1-A: `addTarget()` の上限ガード（L273）

- [ ] **Step 1: `addTarget` の上限を変更**

`src/App.tsx` の `addTarget` 関数（L273）を編集する。

変更前:
```ts
  const addTarget = () => {
    if (targets.length >= 3) return;
```

変更後:
```ts
  const addTarget = () => {
    if (targets.length >= 2) return;
```

### 変更箇所1-B: ヘッダーラベル（L1313）

- [ ] **Step 2: ヘッダーラベルを変更**

L1313 を編集する。

変更前:
```tsx
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>表示対象 (最大3件)</span>
```

変更後:
```tsx
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>表示対象 (最大2件)</span>
```

### 変更箇所1-C: 「追加」ボタン表示条件（L1369）

- [ ] **Step 3: ボタン表示条件を変更**

L1369 を編集する。

変更前:
```tsx
            {targets.length < 3 && (
```

変更後:
```tsx
            {targets.length < 2 && (
```

- [ ] **Step 4: 開発サーバーを起動して動作確認**

```bash
npm run dev
```

ブラウザで比較分析タブを開き、以下を確認する:
- 「比較対象を追加」ボタンが1件目が表示されているときのみ表示される
- ボタンを押すと2件目が追加され、ボタンが消える（最大2件）
- ヘッダーが「表示対象 (最大2件)」になっている

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: limit comparison targets to 2"
```

---

## Task 2: 「基準」ラベルを削除

**Files:**
- Modify: `src/App.tsx`

`targets.map` の中で index 0 に表示している「基準」pill span（L1320–1336）を削除する。index 1 の「比較」pill は残す。

- [ ] **Step 1: 「基準」span をコンディショナルレンダリングに変更**

L1319 の `<div style={{ flexShrink: 0, width: '4px'...` の直後（L1320–1336）を以下に置き換える。

変更前:
```tsx
                <span
                  title={index === 0 ? '比較の基準となる対象（差表示の基点）' : '基準との差が表示されます'}
                  style={{
                    flexShrink: 0,
                    minWidth: '38px',
                    textAlign: 'center',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '999px',
                    background: index === 0 ? 'rgba(13,148,136,0.12)' : 'rgba(2,132,199,0.08)',
                    color: index === 0 ? 'var(--accent-color)' : 'var(--accent-blue)',
                    border: index === 0 ? '1px solid rgba(13,148,136,0.25)' : '1px solid rgba(2,132,199,0.2)',
                  }}
                >
                  {index === 0 ? '基準' : '比較'}
                </span>
```

変更後:
```tsx
                {index > 0 && (
                  <span
                    title="1件目との差が表示されます"
                    style={{
                      flexShrink: 0,
                      minWidth: '38px',
                      textAlign: 'center',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '999px',
                      background: 'rgba(2,132,199,0.08)',
                      color: 'var(--accent-blue)',
                      border: '1px solid rgba(2,132,199,0.2)',
                    }}
                  >
                    比較
                  </span>
                )}
```

- [ ] **Step 2: 動作確認**

ブラウザで比較分析タブを開き、以下を確認する:
- 1件のみのとき: カラーバー（緑4px縦線）のみ、「基準」ラベルなし
- 2件のとき: 1件目はカラーバーのみ、2件目に「比較」ラベルあり

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: remove 基準 label from first target row"
```

---

## Task 3: 差の方向を反転（refId を targets[1] へ変更）

**Files:**
- Modify: `src/App.tsx`

`renderValueBox` 内（L1047）の `refId` 定義を `targets[1]` 参照に変更する。これにより:
- `v0` = targets[1]（2件目）の累積値
- `computeAccumDiff` が targets[0]（1件目）の行に差を表示
- delta = targets[0].value − targets[1].value

- [ ] **Step 1: `refId` の1行を変更**

L1047 を編集する。

変更前:
```ts
          const refId = accumDiffConfig && targets.length > 1 ? targets[0]?.id : null;
```

変更後:
```ts
          const refId = accumDiffConfig && targets.length > 1 ? targets[1]?.id : null;
```

- [ ] **Step 2: `refKey` の参照確認**

L1048–1051 はそのまま変更不要。`refId` が targets[1].id を指すため `v0` も自動的に targets[1] の値になる:
```ts
          const refKey = refId && accumDiffConfig ? `${accumDiffConfig.refKeyPrefix}${refId}` : null;
          const v0 = refKey
            ? hover.payload.find((p: any) => p.dataKey === refKey)?.value
            : undefined;
```

- [ ] **Step 3: 動作確認**

ブラウザで比較分析タブを開き、GDD チャートで2件を登録してホバーする:
- 差の値が1件目の行に表示されること
- 2件目の行には差が出ないこと
- delta の符号: 1件目が2件目より多ければ `+X`、少なければ `−X`

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: invert diff direction — refId now targets[1], diff shown on targets[0]"
```

---

## Task 4: 予報日の差表示（computeAccumDiff を forecast key 対応へ）

**Files:**
- Modify: `src/App.tsx`

予報日では targets[0] の累積値が `forecast_accum_precip_${id}` 等のキーに格納される。現在の prefix 比較（`p.dataKey.startsWith(prefix)`）では一致しないため、差が出ない。

forecast key → 通常 prefix のマッピングを追加し、両方のキー形式を許容する。

- [ ] **Step 1: `computeAccumDiff` を書き換え**

L1054–1089 の `computeAccumDiff` 全体を以下に置き換える:

変更前:
```ts
          const computeAccumDiff = (p: any): string | null => {
            if (!accumDiffConfig || !refId || typeof v0 !== 'number') return null;
            const prefix = accumDiffConfig.refKeyPrefix;
            if (typeof p.dataKey !== 'string' || !p.dataKey.startsWith(prefix)) return null;
            const targetId = p.dataKey.slice(prefix.length);
            if (targetId === refId || typeof p.value !== 'number') return null;

            const delta = p.value - v0;
            const deltaStr = accumDiffConfig.formatDelta(delta);

            // 月次モードは Δ値 のみ
            if (isMonthly) return `(${deltaStr})`;

            // Δ日 を出さない設定（降水量・日照時間）は Δ値 のみ
            if (!accumDiffConfig.showDays) return `(${deltaStr})`;

            // 序盤ガード: V0 が小さすぎる場合は Δ日 を出さない
            if (v0 < accumDiffConfig.threshold) return `(${deltaStr})`;
            if (hoverDoy == null) return `(${deltaStr})`;

            const series = accumDiffConfig.seriesByTarget?.get(targetId);
            if (!series) return `(${deltaStr})`;

            const crossDate = findDateByAccum(series, v0);
            if (!crossDate) return `(${deltaStr} / 未到達)`;

            const crossDoy = mmddToDoy(crossDate);
            if (crossDoy == null) return `(${deltaStr})`;

            const deltaDays = hoverDoy - crossDoy;
            const daysStr =
              deltaDays === 0 ? '同日'
              : deltaDays > 0 ? `${deltaDays}日早い`
              : `${-deltaDays}日遅い`;
            return `(${deltaStr} / ${daysStr})`;
          };
```

変更後:
```ts
          const computeAccumDiff = (p: any): string | null => {
            if (!accumDiffConfig || !refId || typeof v0 !== 'number') return null;
            const t0id = targets[0]?.id;
            if (!t0id || typeof p.dataKey !== 'string') return null;

            // 通常キーと予報キーの両方を許容する
            const prefix = accumDiffConfig.refKeyPrefix;
            const forecastPrefixMap: Record<string, string> = {
              'accum_':           'forecast_accum_gdd_',
              'accumRadiation_':  'forecast_accum_radiation_',
              'accumPrecip_':     'forecast_accum_precip_',
              'accumSunshine_':   'forecast_accum_sunshine_',
            };
            const forecastPrefix = forecastPrefixMap[prefix];
            const isRegularKey  = p.dataKey === `${prefix}${t0id}`;
            const isForecastKey = !!forecastPrefix && p.dataKey === `${forecastPrefix}${t0id}`;
            if (!isRegularKey && !isForecastKey) return null;
            if (typeof p.value !== 'number') return null;

            const delta = p.value - v0;
            const deltaStr = accumDiffConfig.formatDelta(delta);

            // 月次モードは Δ値 のみ
            if (isMonthly) return `(${deltaStr})`;

            // Δ日 を出さない設定（降水量・日照時間）は Δ値 のみ
            if (!accumDiffConfig.showDays) return `(${deltaStr})`;

            // 序盤ガード: V0 が小さすぎる場合は Δ日 を出さない
            if (v0 < accumDiffConfig.threshold) return `(${deltaStr})`;
            if (hoverDoy == null) return `(${deltaStr})`;

            // Δ日逆引き: targets[0] の確定データ系列を使用（予報日でも同様）
            const series = accumDiffConfig.seriesByTarget?.get(t0id);
            if (!series) return `(${deltaStr})`;

            const crossDate = findDateByAccum(series, v0);
            if (!crossDate) return `(${deltaStr} / 未到達)`;

            const crossDoy = mmddToDoy(crossDate);
            if (crossDoy == null) return `(${deltaStr})`;

            const deltaDays = hoverDoy - crossDoy;
            const daysStr =
              deltaDays === 0 ? '同日'
              : deltaDays > 0 ? `${deltaDays}日早い`
              : `${-deltaDays}日遅い`;
            return `(${deltaStr} / ${daysStr})`;
          };
```

- [ ] **Step 2: 動作確認（予報日）**

今年を1件目に設定した状態でブラウザを開き、GDD・降水量・日射量・日照時間チャートで予報日（破線表示の範囲）をホバーする。以下を確認する:
- 予報日のホバー時に差（`+X℃` 等）が値ボックスの1件目の行に表示される
- 確定日のホバー時と同様の書式で差が表示される
- 1件のみの場合は差が表示されない

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: show diff on forecast dates in comparison analysis"
```

---

## Task 5: 最終確認 & push

- [ ] **Step 1: 全変更点の総合確認**

比較分析タブで以下のシナリオをすべて手動確認する:

| シナリオ | 確認内容 |
|---------|---------|
| 1件のみ | 「比較」ラベルなし、「比較対象を追加」ボタンが表示される |
| 「追加」ボタンを押す | 2件目が追加される、ボタンが消える（3件目は追加できない） |
| 2件のとき | 1件目: ラベルなし（カラーバーのみ）、2件目:「比較」ラベルあり |
| GDD ホバー（確定日） | 差（+X℃ / X日早い）が1件目の行に表示される |
| GDD ホバー（予報日） | 同様に差が1件目の行に表示される |
| 降水量・日照 ホバー | 差（+Xmm / +Xh）が1件目の行に表示される（Δ日なし） |
| 1件のみでホバー | 差が表示されない |

- [ ] **Step 2: git push**

```bash
git push origin main
```

---

## スペック対応チェック

| スペック要件 | 対応タスク |
|------------|---------|
| 最大2件 | Task 1 |
| 「基準」ラベル削除 | Task 2 |
| 2件目のみ「比較」表示 | Task 2 |
| 差を1件目の行に表示 | Task 3 |
| 2件目を基準に差を算出 | Task 3 |
| 1件のみは差を表示しない | Task 3（targets.length > 1 条件で既に制御） |
| 予報日も差を表示 | Task 4 |
