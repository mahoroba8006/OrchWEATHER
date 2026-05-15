# Chart Selector UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6チャートを同時レンダリングする代わりに、横スクロールタブで選択した1チャートのみを表示してパフォーマンスを改善する。あわせて値表示をタイトル行からチャート・MonthsTable間の専用ボックスへ移動する。

**Architecture:** `activeChart` state を追加し、各 `<section>` を `{activeChart === 'x' && ...}` で条件分岐レンダリングする。CSS display:none は使わず DOM から完全アンマウントすることで Recharts SVG を除去し Scripting コストを削減する。`renderActivePanel` をリネーム・スタイル変更し、値表示ボックスとして各チャートのlegendとMonthsTableの間に配置する。

**Tech Stack:** React 19, TypeScript, Recharts, src/App.tsx（1315行、テストなし、ビルド検証で代替）

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/App.tsx` | `activeChart` state追加、タブバーJSX追加、`renderActivePanel`→`renderValueBox`へ変更、全6チャートsectionを条件分岐化＋値ボックス追加 |

---

### Task 1: `activeChart` state を追加し、チャート切替時に hover をリセットする

**Files:**
- Modify: `src/App.tsx:56-57`（既存の `chartViewMode` state 付近）

- [ ] **Step 1: `activeChart` state を追加**

`src/App.tsx` の `chartViewMode` state の直下（57行目付近）に追加：

```typescript
const [chartViewMode, setChartViewMode] = useState<'daily' | 'monthly'>('daily');
// ↓ この行を追加
type ChartId = 'temp' | 'precip' | 'sunshine' | 'radiation' | 'gdd' | 'humid';
const [activeChart, setActiveChart] = useState<ChartId>('temp');
const [hover, setHover] = useState<{ chartId: string; payload: any[]; label: string } | null>(null);
```

- [ ] **Step 2: チャート切替時に hover をリセットする useEffect を追加**

既存の useEffect 群（93行目付近）の直後に追加：

```typescript
// チャートを切り替えたとき前のホバー値をクリア
useEffect(() => {
  setHover(null);
}, [activeChart]);
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```
Expected: エラーなし

---

### Task 2: チャート選択タブバーを追加する

**Files:**
- Modify: `src/App.tsx`（表示期間 `</div>` の直後、エラー表示 `{error &&` の直前）

- [ ] **Step 1: タブバーの定義配列を追加**

`App` 関数内（`formatHoverLabel` などのヘルパー関数付近、または `renderValueBox` の近く）に追加：

```typescript
const CHART_TABS: { id: ChartId; label: string }[] = [
  { id: 'temp',      label: '気温' },
  { id: 'precip',    label: '降水量' },
  { id: 'sunshine',  label: '日照時間' },
  { id: 'radiation', label: '日射量' },
  { id: 'gdd',       label: '積算温度' },
  { id: 'humid',     label: '湿度' },
];
```

- [ ] **Step 2: タブバーJSXを表示期間パネルの直後に挿入**

`src/App.tsx` の表示期間パネル `</div>`（856行目付近）の直後、`{error &&` の直前に挿入：

```tsx
{/* チャート選択タブ */}
<div
  className="glass-panel"
  style={{
    padding: '0.5rem 1rem',
    display: 'flex',
    gap: '0.5rem',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  }}
>
  {CHART_TABS.map(tab => (
    <button
      key={tab.id}
      onClick={() => setActiveChart(tab.id)}
      style={{
        flexShrink: 0,
        padding: '0.3rem 0.9rem',
        borderRadius: '20px',
        fontSize: '0.85rem',
        border: activeChart === tab.id
          ? '1px solid #f4a7b9'
          : '1px solid rgba(244,167,185,0.35)',
        background: activeChart === tab.id
          ? '#f4a7b9'
          : 'transparent',
        color: activeChart === tab.id
          ? '#7a2840'
          : 'var(--text-secondary)',
        fontWeight: activeChart === tab.id ? 700 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {tab.label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```
Expected: エラーなし

- [ ] **Step 4: dev server で目視確認**

```bash
npm run dev
```

- ブラウザで `http://localhost:5173` を開き、表示期間パネルの下にタブバーが表示されることを確認
- 気温・降水量… のボタンが横並びで表示されること
- クリックしてもまだチャートは切り替わらない（Task 3以降で実装）

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx
git commit -m "feat: add chart selector tab bar"
```

---

### Task 3: `renderActivePanel` を `renderValueBox` にリファクタリング

**Files:**
- Modify: `src/App.tsx:613-640`（`renderActivePanel` 関数）

- [ ] **Step 1: `renderActivePanel` を `renderValueBox` にリネームしスタイルを変更**

613〜640行目の `renderActivePanel` 関数全体を以下に置き換える：

```typescript
const renderValueBox = (chartId: string) => {
  const boxStyle: React.CSSProperties = {
    marginTop: '0.5rem',
    marginBottom: '0.5rem',
    borderRadius: '8px',
    padding: '0.6rem 0.75rem',
    fontSize: '0.78rem',
  };

  if (hover?.chartId !== chartId) {
    return (
      <div style={{
        ...boxStyle,
        border: '1px dashed rgba(255,255,255,0.12)',
        color: '#475569',
        textAlign: 'center',
      }}>
        タップして値を表示
      </div>
    );
  }
  if (!hover.payload?.length) return null;

  const items = hover.payload.filter((p: any) => {
    if (p.value == null || p.value === undefined) return false;
    if (!isMonthly && (
      p.name?.includes('月平均気温') ||
      p.name?.includes('月平均湿度') ||
      p.name?.includes('月合計降水')
    )) return false;
    return true;
  });
  if (items.length === 0) return null;

  return (
    <div style={{
      ...boxStyle,
      background: 'rgba(244,167,185,0.07)',
      border: '1px solid rgba(244,167,185,0.2)',
    }}>
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700 }}>
        {formatHoverLabel(hover.label)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem' }}>
        {items.map((p: any, i: number) => {
          const metric = p.name.split(' ').slice(2).join(' ') || p.name;
          return (
            <span key={i} style={{ color: p.color, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
              {metric} <strong>{formatHoverEntry(p)}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: ビルドが通ることを確認（まだ renderActivePanel が残っているのでエラーになる）**

```bash
npm run build
```

Expected: `renderActivePanel` が見つからないエラーが出る（Step 3 で修正）

---

### Task 4: 気温チャートを条件分岐化し値ボックスを追加

**Files:**
- Modify: `src/App.tsx:864-916`（気温 section）

- [ ] **Step 1: 気温セクションを条件分岐で包み、タイトルから値表示を削除し、値ボックスを追加**

864〜916行目を以下に置き換える（`{/* 1. 気温 */}` から `</section>` まで）：

```tsx
{/* 1. 気温 (Temperature) */}
{activeChart === 'temp' && (
<section className="glass-panel" style={sectionStyle}>
  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
    <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><Thermometer size={18} /> 気温</h2>
  </div>
  {loading ? (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
  ) : (
    <>
      {chartFrame('temp', (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visibleChartData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
            <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
            <YAxis {...yAxisCommon} domain={['auto', 'auto']} label={{ value: '(℃)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
            <Tooltip content={tooltipContents.temp} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />
            {targets.map((target, index) => {
              const color = getYearColor(index, 'var(--chart-temp)');
              return (
                <React.Fragment key={target.id}>
                  <Bar dataKey={`t_${target.id}_tempRange`} name={`${getLocationName(target.locationId)} ${target.year}年 気温(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                  <Line type="monotone" dataKey={`t_${target.id}_monthlyMeanTemp`} name={`${getLocationName(target.locationId)} ${target.year}年 月平均気温`} stroke={color} strokeWidth={2.5} dot={false} connectNulls={true} isAnimationActive={false}>
                    {isMonthly && index === 0 && (
                      <LabelList dataKey={`t_${target.id}_monthlyMeanTemp`} position="top" formatter={(v: any) => typeof v === 'number' ? v.toFixed(1) : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                    )}
                  </Line>
                </React.Fragment>
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      ), true)}
      {renderCustomLegend([
        { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
        { label: '月間平均', type: 'solid' }
      ])}
      {renderValueBox('temp')}
      <MonthsTable
        rowsDef={[
          { key: 'meanTemp', label: '月平均気温 (℃)' },
          { key: 'maxTemp', label: '月最高気温 (℃)' },
          { key: 'minTemp', label: '月最低気温 (℃)' }
        ]}
        targets={targets}
        stats={monthlyStats}
        getYearColor={getYearColor}
        getLocationName={getLocationName}
      />
    </>
  )}
</section>
)}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```
Expected: エラーなし（残り5チャートの `renderActivePanel` 呼び出しがまだあるので型エラーが残る場合は次Taskで解消）

---

### Task 5: 降水量チャートを条件分岐化し値ボックスを追加

**Files:**
- Modify: `src/App.tsx`（降水量 section 全体）

- [ ] **Step 1: 降水量セクション（`{/* 2. 降水量 */}` 〜 `</section>`）を更新**

既存の降水量 section を以下に置き換える。変更箇所は ① `{activeChart === 'precip' && (` で包む ② タイトル行の `{renderActivePanel('precip')}` を削除 ③ MonthsTable の直前に `{renderValueBox('precip')}` を追加 ④ 末尾に `)}` を追加：

```tsx
{/* 2. 降水量 (Precipitation) */}
{activeChart === 'precip' && (
<section className="glass-panel" style={sectionStyle}>
  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
    <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><CloudRain size={18} /> 降水量</h2>
  </div>
  {loading ? (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
  ) : (
    <>
      {chartFrame('precip', (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visibleChartData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
            <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
            <YAxis yAxisId="left" {...yAxisCommon} label={{ value: '(mm)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" {...yAxisCommonRight} label={{ value: '(mm)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
            <Tooltip content={tooltipContents.precip} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />
            {targets.map((target, index) => {
              const name = `${getLocationName(target.locationId)} ${target.year}年`;
              const color = getYearColor(index, 'var(--chart-precip)');
              return (
                <React.Fragment key={target.id}>
                  <Bar yAxisId="left" dataKey={`monthlyPrecip_${target.id}`} name={`${name} 月合計降水`} fill={color} fillOpacity={isMonthly ? 0.5 : 1} shape={isMonthly ? <CustomWideBar /> : undefined} isAnimationActive={false}>
                    <LabelList dataKey={`monthlyPrecip_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' && v > 0 ? Math.round(v).toString() : ''} style={{ fontSize: 9, fill: color, fontWeight: 600 }} />
                  </Bar>
                  {!isMonthly && (
                    <Bar yAxisId="left" dataKey={`precip_${target.id}`} name={`${name} 日別降水`} fill={color} fillOpacity={0.5} isAnimationActive={false} />
                  )}
                  <Line yAxisId="right" type="monotone" dataKey={`accumPrecip_${target.id}`} name={`${name} 累積降水`} stroke={color} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                </React.Fragment>
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      ), true)}
      {renderCustomLegend(
        isMonthly
          ? [{ label: '月間降水量', type: 'thick-bar' }, { label: '累積降水量', type: 'solid' }]
          : [{ label: '降水量', type: 'thin-bar' }, { label: '月間降水量', type: 'thick-bar' }, { label: '累積降水量', type: 'solid' }]
      )}
      {renderValueBox('precip')}
      <MonthsTable
        rowsDef={[{ key: 'sumPrecip', label: '月合計降水量 (mm)' }]}
        targets={targets}
        stats={monthlyStats}
        getYearColor={getYearColor}
        getLocationName={getLocationName}
      />
    </>
  )}
</section>
)}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm run build
```

---

### Task 6: 日照時間・日射量・積算温度・湿度チャートを条件分岐化

**Files:**
- Modify: `src/App.tsx`（チャート3〜6の各 section）

各チャート section に対して Task 4/5 と同じパターンを適用する。変更点は3つのみ：
1. `{activeChart === 'X' && (` で包む（末尾に `)}` 追加）
2. タイトル行の `{renderActivePanel('X')}` を削除
3. MonthsTable の直前に `{renderValueBox('X')}` を追加
4. `chartFrame(..., true)` の `measure` 引数 ← 気温以外は現在 `measure` が渡されていない。条件分岐後は各チャートが単独でマウントされるため、すべての chartFrame に `true` を渡す

- [ ] **Step 1: 日照時間 section を更新（`{/* 3. 日照時間 */}`〜`</section>`）**

変更ルール（コメント `// CHANGE` 箇所のみ）:

```tsx
{/* 3. 日照時間 (Sunshine Duration) */}
{activeChart === 'sunshine' && (  // CHANGE: 追加
<section className="glass-panel" style={sectionStyle}>
  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
    <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><Clock size={18} /> 日照時間</h2>
    {/* CHANGE: renderActivePanel('sunshine') を削除 */}
  </div>
  {loading ? ( ... ) : (
    <>
      {chartFrame('sunshine', ( ... ), true)}  {/* CHANGE: true を追加 */}
      {renderCustomLegend([...])}
      {renderValueBox('sunshine')}  {/* CHANGE: 追加 */}
      <MonthsTable ... />
    </>
  )}
</section>
)}  {/* CHANGE: 追加 */}
```

- [ ] **Step 2: 日射量 section を更新（`{/* 4. 日射量 */}`〜`</section>`）**

同じパターンで `activeChart === 'radiation'`、`renderValueBox('radiation')`、chartFrame に `true` を追加。`renderActivePanel('radiation')` を削除。

- [ ] **Step 3: 積算温度 section を更新（`{/* 4. 有効積算温度 */}`〜`</section>`）**

同じパターンで `activeChart === 'gdd'`、`renderValueBox('gdd')`、chartFrame に `true` を追加。`renderActivePanel('gdd')` を削除。

- [ ] **Step 4: 湿度 section を更新（`{/* 5. 湿度 */}`〜`</section>`）**

同じパターンで `activeChart === 'humid'`、`renderValueBox('humid')`、chartFrame に `true` を追加。`renderActivePanel('humid')` を削除。

- [ ] **Step 5: ビルドが通ることを確認**

```bash
npm run build
```
Expected: エラーなし・警告なし

---

### Task 7: 動作確認とコミット

**Files:**
- なし（確認のみ）

- [ ] **Step 1: dev server で動作確認**

```bash
npm run dev
```

DevTools → デバイスモード（375px）で以下を全項目チェック：

| 確認項目 | 期待値 |
|---------|--------|
| タブをタップ | 対応チャートのみ表示される |
| タップ前の値ボックス | 「タップして値を表示」が表示される |
| タップ後の値ボックス | 日付＋地点別の値がボックス内に表示される |
| タイトル行 | 値表示がなく、タイトルのみ表示される |
| グラフ幅 | 端から端まで全幅（chart-bleed 維持） |
| 日次/月次トグル | 両方のモードでタブ切替が正常に動く |
| チャート切替 | 切替時に前チャートのホバー値がクリアされる |

- [ ] **Step 2: パフォーマンス確認（任意）**

Chrome DevTools → Performance タブで再計測し、Scripting 時間が削減されていることを確認（目安：9,512ms → 2,000ms以下）

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "feat: show single selected chart with tab bar for performance"
```

- [ ] **Step 4: push**

```bash
git push origin main
```
