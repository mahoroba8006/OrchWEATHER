# 日別予報レイアウト redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DailyForecast の行構成を7行→6行に整理し、日付・天気テキスト・アイコンの縦位置を全日で統一する。

**Architecture:** `DailyForecast.tsx` のみ変更。分割日（最初の3日）の colSpan=3 日付セルに時間帯ラベルを flex で内包し、独立していた「時間帯ラベル行」を削除。非分割日の天気テキストを日付行から天気テキスト行へ移動。

**Tech Stack:** React 19 + TypeScript（変更はJSX/CSS in JS のみ、ライブラリ追加なし）

**Spec:** `docs/superpowers/specs/2026-06-13-daily-forecast-layout-redesign-design.md`

---

### Task 1: 分割日の日付セルに時間帯ラベルを統合し、独立ラベル行を削除

**Files:**
- Modify: `src/components/weather/DailyForecast.tsx`

対象箇所は2か所ある。まず「日付行（Row 1）」の split ブランチを修正し、次に「時間帯ラベル行」の `<tr>` を丸ごと削除する。

- [ ] **Step 1: 日付行の split ブランチを書き換える**

`src/components/weather/DailyForecast.tsx` の `{/* 日付 */}` `<tr>` 内、`if (split)` ブロックを以下に置き換える。

```tsx
if (split) {
  return (
    <td
      key={day.date}
      colSpan={3}
      style={{ ...spanCell(day, i), textAlign: 'left', paddingTop: '0.75rem', paddingLeft: '0.5rem', verticalAlign: 'top' }}
    >
      <div style={{ fontSize: '0.975rem', color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 500, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ display: 'flex', marginTop: '0.35rem' }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>午前</div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, borderLeft: '1px solid var(--card-border-sub)' }}>午後</div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, borderLeft: '1px solid var(--card-border-sub)' }}>夜間</div>
      </div>
    </td>
  );
}
```

変更前（`if (split)` ブロック全体）:
```tsx
if (split) {
  return (
    <td
      key={day.date}
      colSpan={3}
      style={{ ...spanCell(day, i), textAlign: 'left', paddingTop: '0.75rem', paddingLeft: '0.5rem' }}
    >
      <div style={{ fontSize: '0.975rem', color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 500, whiteSpace: 'nowrap' }}>
        {label}
      </div>
    </td>
  );
}
```

- [ ] **Step 2: 独立していた「時間帯ラベル行」の `<tr>` を削除する**

`{/* 時間帯ラベル */}` コメントから始まる `<tr>` ブロック全体を削除する。

削除対象（このブロック全体）:
```tsx
{/* 時間帯ラベル */}
<tr>
  {daily.map((day, i) => {
    if (i < SPLIT_DAYS) {
      const tStyle: CSSProperties = { fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, lineHeight: 1.4 };
      return (
        <Fragment key={day.date}>
          <td style={amCell(day)}><div style={tStyle}><div>午前</div><div>(4-12)</div></div></td>
          <td style={pmCell(day)}><div style={tStyle}><div>午後</div><div>(12-20)</div></div></td>
          <td style={nightCell(day, i)}><div style={tStyle}><div>夜間</div><div>{i === SPLIT_DAYS - 1 ? '(20-0)' : '(20-翌4)'}</div></div></td>
        </Fragment>
      );
    }
    return <td key={day.date} style={singleCell(day, i)} />;
  })}
</tr>
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

---

### Task 2: 非分割日の日付行から天気テキストを除去し、天気テキスト行に追加する

**Files:**
- Modify: `src/components/weather/DailyForecast.tsx`

非分割日の天気テキスト (`codeToLabel`) を日付行から削除し、天気テキスト行（現行の `{/* 時間帯別天気 */}` 行）の非分割ブランチに移動する。

- [ ] **Step 1: 日付行の非分割ブランチから天気テキスト subtitleを削除する**

`{/* 日付 */}` `<tr>` 内の非分割ブランチ（`if (split)` の後の `return`）を以下に置き換える。

変更前:
```tsx
return (
  <td
    key={day.date}
    style={{ ...singleCell(day, i), paddingTop: '0.75rem' }}
  >
    <div style={{ fontSize: '0.975rem', color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 500 }}>
      {label}
    </div>
    {(() => {
      const tl = codeToLabel(day.weatherCode);
      return tl ? (
        <div style={{ fontSize: '0.806rem', color: 'var(--text-tertiary)', marginTop: '0.15rem', fontWeight: 500 }}>{tl}</div>
      ) : null;
    })()}
  </td>
);
```

変更後:
```tsx
return (
  <td
    key={day.date}
    style={{ ...singleCell(day, i), paddingTop: '0.75rem', verticalAlign: 'top' }}
  >
    <div style={{ fontSize: '0.975rem', color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 500 }}>
      {label}
    </div>
  </td>
);
```

- [ ] **Step 2: 天気テキスト行の非分割ブランチに天気テキストを追加する**

`{/* 時間帯別天気 */}` `<tr>` 内の非分割ブランチを以下に置き換える。

変更前（非分割ブランチ）:
```tsx
return <td key={day.date} style={singleCell(day, i)} />;
```

変更後:
```tsx
return (
  <td key={day.date} style={singleCell(day, i)}>
    <div style={{ fontSize: '0.806rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
      {day.isPlaceholder ? '—' : (codeToLabel(day.weatherCode) ?? '—')}
    </div>
  </td>
);
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待: `✓ built in ...` でエラーなし

---

### Task 3: 目視確認とコミット

**Files:**
- `src/components/weather/DailyForecast.tsx`（変更済み）

- [ ] **Step 1: dev サーバーで目視確認する**

```bash
npm run dev
```

確認項目:
1. 分割日（最初の3日）の日付セル内に「午前/午後/夜間」ラベルが日付の直下に表示される
2. 時刻（4-12 等）は表示されない
3. 非分割日（4日目以降）の日付は1行のみ（天気テキストは別行に移動）
4. 全日で天気テキスト行が同じ行に揃っている
5. 全日で天気アイコンが同じ行に揃っている
6. ミニグラフ・ガントバーの位置に変化がない

- [ ] **Step 2: コミットする**

```bash
git add src/components/weather/DailyForecast.tsx
git commit -m "feat(daily): 日別予報レイアウト整理 - 時間帯ラベルを日付セルに統合、天気テキスト行を全日統一"
```
