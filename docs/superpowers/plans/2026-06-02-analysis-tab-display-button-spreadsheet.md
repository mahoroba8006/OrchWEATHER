# 比較分析タブ改善（表示ボタン＋365日スプレッドシート）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 比較分析タブに「表示」ボタンを追加してデータ取得を手動トリガー化し、グラフ下のスプレッドシートを365日の生データ（全指標を1テーブル）に刷新し、CSVダウンロードを追加する。

**Architecture:** `targets`（ペンディング：UIセレクタ用）と `committedTargets`（確定：データ取得・チャート描画用）の2ステートに分離する。「表示」ボタン押下時のみ `committedTargets` を更新し、`useWeatherData` はこれを受け取る。スプレッドシートは新コンポーネント `DailyRawTable` に切り出し、`MonthsTable` の呼び出しをすべて置き換える。

**Tech Stack:** React 19, TypeScript, `DailyWeather` interface（`src/api/weather.ts`）, Blob API（CSVダウンロード）

---

## ファイル構成

| 操作 | ファイル | 内容 |
|------|---------|------|
| 更新 | `src/App.tsx` | committedTargets state追加、useWeatherData切替、useMemo依存変更、chart rendering切替、表示ボタン追加、MonthsTable削除、DailyRawTable追加 |
| 新規作成 | `src/components/DailyRawTable.tsx` | 365日生データテーブル + CSVダウンロード |
| 更新 | `memory/project_deferred_tasks.md` | Case 1確認・Case 2不要記録 |

---

## Task 1: メモリ更新（Case 2 不要の記録）

**Files:**
- Modify: `C:\Users\kazma\.claude\projects\c--dev------\memory\project_deferred_tasks.md`

- [ ] **Step 1: project_deferred_tasks.md を読み込む**

- [ ] **Step 2: Case 1/2 の状態を更新する**

AI速度改善の項目を以下に書き換える：
```
## AI コメント速度改善（2026-06-02 更新）

### Case 1: thinkingBudget: 0 明示設定
- **状態:** 実施済み・効果確認済み（`789f864`）
- `functions/api/ai-comment.ts` に `thinkingConfig: { thinkingBudget: 0 }` 追加
- 初回取得レイテンシの改善を確認

### Case 2: 4並列リクエスト化
- **状態:** 不要（Case 1 で十分な改善が確認されたため見送り）
- 設計メモは残す（将来的に再検討が必要になった場合の参考用）
- 設計概要: 4タブ（weatherOverview/disasterPrep/sprayingAdvice/generalWorkAdvice）を
  別々のCloudflare Pages Functionにして並列実行。現状は1リクエストで4フィールドを逐次生成。
```

---

## Task 2: committedTargets ステートの追加

**Files:**
- Modify: `src/App.tsx` (lines 263–265 付近)

**背景:** 現在 `targets` 1つのstateがUI表示とデータ取得の両方に使われている。
分離により「UIで選択変更してもボタンを押すまでデータ取得が走らない」を実現する。

- [ ] **Step 1: App.tsx の targets 初期化箇所を確認・変更**

現在（line 263付近）：
```typescript
const [targets, setTargets] = useState<CompareTarget[]>([
  { id: `t_${Date.now()}`, locationId: initialLocation, year: new Date().getFullYear() }
]);
```

以下に変更（同一IDで両stateを初期化）：
```typescript
const initialTargetId = `t_${Date.now()}`;
const [targets, setTargets] = useState<CompareTarget[]>([
  { id: initialTargetId, locationId: initialLocation, year: new Date().getFullYear() }
]);
const [committedTargets, setCommittedTargets] = useState<CompareTarget[]>([
  { id: initialTargetId, locationId: initialLocation, year: new Date().getFullYear() }
]);
```

- [ ] **Step 2: useWeatherData の引数を committedTargets に切替**

Line 317付近：
```typescript
// 変更前
const { data: weatherData, loading, loadingStatus, error } = useWeatherData(targets);
// 変更後
const { data: weatherData, loading, loadingStatus, error } = useWeatherData(committedTargets);
```

- [ ] **Step 3: forecastLoc の依存を committedTargets に切替**

Line 320付近：
```typescript
// 変更前
const forecastLoc = useMemo(() => {
  const t = targets[0];
  ...
}, [targets, locations, geoLocation]);

// 変更後
const forecastLoc = useMemo(() => {
  const t = committedTargets[0];
  if (!t) return null;
  const loc = t.locationId === '__geo__'
    ? geoLocation
    : locations.find(l => l.id === t.locationId);
  return loc ? { lat: loc.lat, lon: loc.lon } : null;
}, [committedTargets, locations, geoLocation]);
```

---

## Task 3: useMemo フックの committedTargets 切替

**Files:**
- Modify: `src/App.tsx` (baseChartData, gddData, radiationData, monthlyStats, monthlyChartData)

**背景:** データ計算用useMemoがすべて `targets` に依存しているため、
committedTargets に切替えないと「確定前の選択でデータが計算される」バグが起きる。

- [ ] **Step 1: baseChartData useMemo を切替（line 367付近）**

変更箇所：
```typescript
// 変更前
const baseChartData = useMemo(() => {
  if (Object.keys(weatherData).length === 0) return [];
  const map = new Map<string, any>();
  targets.forEach((target, index) => {
    ...
  });
  ...
}, [..., targets, ...]);

// 変更後（forEachをcommittedTargets.forEachに、依存配列もcommittedTargetsに）
const baseChartData = useMemo(() => {
  if (Object.keys(weatherData).length === 0) return [];
  const map = new Map<string, any>();
  committedTargets.forEach((target, index) => {
    ...
  });
  ...
}, [..., committedTargets, ...]);
```

baseChartData useMemo の依存配列（末尾付近）を探して `targets` → `committedTargets` に変更。
内部の `targets.forEach` → `committedTargets.forEach` に変更。

- [ ] **Step 2: gddData useMemo を切替（line 543付近）**

gddData useMemo 内の：
- `targets.forEach(...)` → `committedTargets.forEach(...)`
- 依存配列の `targets` → `committedTargets`

- [ ] **Step 3: radiationData useMemo を切替（line 609付近）**

radiationData useMemo 内の：
- `targets.forEach(...)` → `committedTargets.forEach(...)`
- 依存配列の `targets` → `committedTargets`

- [ ] **Step 4: monthlyStats useMemo を切替（line 677付近）**

monthlyStats useMemo 内の：
- `targets.forEach(...)` → `committedTargets.forEach(...)`
- 依存配列の `targets` → `committedTargets`

- [ ] **Step 5: monthlyChartData useMemo を切替（line 787付近）**

monthlyChartData useMemo 内の targets 参照をすべて committedTargets に変更。
依存配列も同様に。

- [ ] **Step 6: currentTargetHasForecast を切替（line 857付近）**

```typescript
// 変更前
const currentTargetHasForecast =
  !isMonthly && !!forecastData && targets[0]?.year === currentYear;
// 変更後
const currentTargetHasForecast =
  !isMonthly && !!forecastData && committedTargets[0]?.year === currentYear;
```

---

## Task 4: チャート描画セクションの committedTargets 切替

**Files:**
- Modify: `src/App.tsx` (topTab === 'analysis' のレンダリングセクション、line 1551〜2228)

**背景:** チャートは committedTargets のデータを表示するので、
ループもラベルも committedTargets を参照しなければならない。

- [ ] **Step 1: チャート描画セクション内の targets → committedTargets を一括変更**

line 1551〜2228 の範囲で以下を変更（セレクタUI範囲 1433〜1549 は変更しない）：

変更対象パターン：
```
targets.map(  →  committedTargets.map(
targets.length  →  committedTargets.length （チャート描画内のみ）
```

具体的に変更が必要な箇所（各チャートセクションの .map コール）：
- 気温チャート（line 1600付近）: `targets.map((target, index) => {` → committedTargets
- 降水チャート（line 1700付近）: 2か所の `targets.map`
- 日射チャート（line 1850付近）: `targets.map`
- 日照チャート（line 1940付近）: `targets.map`
- GDDチャート（line 2040付近）: `targets.map`
- 湿度チャート（line 2100付近）: `targets.map`
- 飽差チャート（line 2160付近）: `targets.map`

また各チャートの MonthsTable に渡している `targets={targets}` の箇所（削除予定なので後で対応）。

---

## Task 5: 「表示」ボタンの追加

**Files:**
- Modify: `src/App.tsx` (line 1539〜1548 付近、セレクタUIの末尾)

**背景:** セレクタUI（targets state利用）の最下部に表示ボタンを追加する。
ボタン押下で committedTargets を targets の現在値でコピーする。

- [ ] **Step 1: セレクタUI末尾のボタン行を変更**

現在（line 1539付近）：
```tsx
{targets.length < 2 && (
  <button
    onClick={addTarget}
    className="secondary"
    style={{ alignSelf: 'flex-start', marginTop: '0.25rem', padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
  >
    <Plus size={15} /> 比較対象を追加
  </button>
)}
```

以下に変更（「比較対象を追加」と「表示」を横並びの行にする）：
```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
  {targets.length < 2 ? (
    <button
      onClick={addTarget}
      className="secondary"
      style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
    >
      <Plus size={15} /> 比較対象を追加
    </button>
  ) : (
    <div />
  )}
  <button
    onClick={() => setCommittedTargets([...targets])}
    style={{
      padding: '0.5rem 1.25rem',
      fontSize: '0.88rem',
      fontWeight: 700,
      background: 'linear-gradient(135deg, var(--accent-color) 0%, #0f766e 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
    }}
  >
    <BarChart2 size={16} /> 表示
  </button>
</div>
```

`BarChart2` は lucide-react からインポート済みかどうか確認し、未インポートの場合は追加する。

---

## Task 6: DailyRawTable コンポーネントの作成

**Files:**
- Create: `src/components/DailyRawTable.tsx`

**仕様:**
- 1行 = 1日（MM-DD）
- 列 = 全指標 × ターゲット数（指標グループ内でA/Bを隣接）
- ターゲット2件のとき2行ヘッダー（指標名 / 地点名+年）
- ターゲット1件のとき1行ヘッダー
- CSVダウンロードボタンを右上に配置
- 飽差は `calcVPD(tempMean, humidMean)` でその場計算

- [ ] **Step 1: コンポーネントファイルを作成する**

```typescript
import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import type { CompareTarget } from '../hooks/useWeather';
import type { WeatherData } from '../api/weather';

function calcVPD(tempC: number, humidPct: number): number {
  const e_s_hPa = 6.1078 * Math.pow(10, 7.5 * tempC / (tempC + 237.3));
  const a_max = 216.67 * e_s_hPa / (tempC + 273.15);
  return a_max * (1 - humidPct / 100);
}

interface DailyRawTableProps {
  targets: CompareTarget[];
  weatherData: Record<string, WeatherData>;
  getYearColor: (index: number, baseColor: string) => string;
  getLocationName: (id: string) => string;
}

// 指標定義（順番がそのまま列順）
const METRICS = [
  { key: 'tempMax',          label: '最高気温(℃)',    fmt: (v: number) => v.toFixed(1) },
  { key: 'tempMin',          label: '最低気温(℃)',    fmt: (v: number) => v.toFixed(1) },
  { key: 'tempMean',         label: '平均気温(℃)',    fmt: (v: number) => v.toFixed(1) },
  { key: 'precipSum',        label: '降水量(mm)',      fmt: (v: number) => v.toFixed(1) },
  { key: 'radiation',        label: '日射量(MJ/m²)',  fmt: (v: number) => v.toFixed(2) },
  { key: 'sunshineDuration', label: '日照時間(h)',     fmt: (v: number) => v.toFixed(1) },
  { key: 'humidMean',        label: '平均湿度(%)',     fmt: (v: number) => v.toFixed(1) },
  { key: 'vpd',              label: '飽差(g/m³)',     fmt: (v: number) => v.toFixed(2) },
] as const;

type MetricKey = typeof METRICS[number]['key'];

export function DailyRawTable({ targets, weatherData, getYearColor, getLocationName }: DailyRawTableProps) {
  // 全ターゲットから MM-DD の日付一覧を収集・ソート
  const allDates = useMemo(() => {
    const set = new Set<string>();
    targets.forEach(t => {
      weatherData[t.id]?.daily.forEach(d => set.add(d.date.substring(5)));
    });
    return Array.from(set).sort();
  }, [targets, weatherData]);

  // ターゲットごとに MM-DD → DailyWeather の Map を作成
  const dayMaps = useMemo(() => {
    return targets.map(t => {
      const m = new Map<string, any>();
      weatherData[t.id]?.daily.forEach(d => {
        m.set(d.date.substring(5), {
          ...d,
          vpd: calcVPD(d.tempMean, d.humidMean),
        });
      });
      return m;
    });
  }, [targets, weatherData]);

  const isSingle = targets.length === 1;

  // CSVダウンロード
  function downloadCsv() {
    const lines: string[] = [];

    // ヘッダー行
    if (isSingle) {
      const t = targets[0];
      const label = `${getLocationName(t.locationId)} ${t.year}年`;
      lines.push(['日付', ...METRICS.map(m => `${m.label}(${label})`)].join(','));
    } else {
      // 2行ヘッダーをCSVでは1行にまとめる（指標名_地点名+年 の形式）
      const headerCols = ['日付'];
      METRICS.forEach(m => {
        targets.forEach((t, i) => {
          headerCols.push(`${m.label}_${getLocationName(t.locationId)}${t.year}年`);
        });
      });
      lines.push(headerCols.join(','));
    }

    // データ行
    allDates.forEach(mmdd => {
      const cols = [mmdd];
      METRICS.forEach(m => {
        targets.forEach((_, i) => {
          const day = dayMaps[i].get(mmdd);
          const val = day?.[m.key as MetricKey];
          cols.push(val != null && !isNaN(val) ? m.fmt(val as number) : '');
        });
      });
      lines.push(cols.join(','));
    });

    const bom = '﻿'; // Excel UTF-8 BOM
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const firstTarget = targets[0];
    const fname = `weather_${getLocationName(firstTarget.locationId)}_${firstTarget.year}.csv`;
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (allDates.length === 0) return null;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          日別データ ({allDates.length}日)
        </span>
        <button
          onClick={downloadCsv}
          className="secondary"
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Download size={14} /> CSV ダウンロード
        </button>
      </div>
      <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
        <table className="glass-table" style={{ fontSize: '0.8rem' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            {isSingle ? (
              <tr>
                <th style={{ minWidth: '52px' }}>日付</th>
                {METRICS.map(m => (
                  <th key={m.key} style={{ whiteSpace: 'nowrap' }}>{m.label}</th>
                ))}
              </tr>
            ) : (
              <>
                <tr>
                  <th rowSpan={2} style={{ minWidth: '52px' }}>日付</th>
                  {METRICS.map(m => (
                    <th key={m.key} colSpan={targets.length} style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{m.label}</th>
                  ))}
                </tr>
                <tr>
                  {METRICS.flatMap(m =>
                    targets.map((t, i) => (
                      <th
                        key={`${m.key}-${t.id}`}
                        style={{
                          color: getYearColor(i, 'var(--text-primary)'),
                          fontWeight: 500,
                          fontSize: '0.72rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {getLocationName(t.locationId)}<br />{t.year}年
                      </th>
                    ))
                  )}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {allDates.map(mmdd => (
              <tr key={mmdd}>
                <td style={{ fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {mmdd.replace('-', '/')}
                </td>
                {METRICS.flatMap(m =>
                  targets.map((_, i) => {
                    const day = dayMaps[i].get(mmdd);
                    const val = day?.[m.key as MetricKey];
                    return (
                      <td key={`${m.key}-${i}`} className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        {val != null && !isNaN(val as number) ? m.fmt(val as number) : '-'}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェックを実行する**

```powershell
cd "c:\dev\気象アプリ"
npx tsc --noEmit 2>&1 | head -30
```

エラーがあれば修正する。よくあるエラー：
- `MetricKey` の型エラー → `day?.[m.key as string]` に変更
- `WeatherData` import が見つからない → `src/api/weather.ts` から import

---

## Task 7: App.tsx から MonthsTable を削除し DailyRawTable を追加

**Files:**
- Modify: `src/App.tsx`

**背景:** 現在 MonthsTable は各チャートセクション（気温/降水/日射/日照/GDD/湿度/飽差）の末尾に計7回呼び出されている。これをすべて削除し、チャートセクション群の直後に DailyRawTable を1つ追加する。

- [ ] **Step 1: MonthsTable インポートを DailyRawTable に切り替える**

App.tsx の import 行を確認し：
```typescript
// 削除
import { MonthsTable } from './components/MonthsTable';
// 追加
import { DailyRawTable } from './components/DailyRawTable';
```

- [ ] **Step 2: 各チャートセクションの MonthsTable 呼び出し（7か所）を削除**

以下の各箇所を削除する：
- 気温チャートの `<MonthsTable rowsDef={[...]} targets={targets} .../>` (line 1670付近)
- 降水チャートの MonthsTable (line 1784付近)
- 日照チャートの MonthsTable (line 1880付近)
- 日射チャートの MonthsTable (line 1977付近)
- GDDチャートの MonthsTable (line 2096付近)
- 湿度チャートの MonthsTable (line 2155付近)
- 飽差チャートの MonthsTable (line 2213付近)

- [ ] **Step 3: DailyRawTable を分析タブ末尾（Footer の直前）に追加**

`<Footer />` の直前（line 2228付近）に追加：
```tsx
{/* 日別データスプレッドシート */}
{Object.keys(weatherData).length > 0 && (
  <section className="glass-panel" style={{ padding: '1.25rem' }}>
    <DailyRawTable
      targets={committedTargets}
      weatherData={weatherData}
      getYearColor={getYearColor}
      getLocationName={getLocationName}
    />
  </section>
)}
```

- [ ] **Step 4: TypeScript 型チェックを実行**

```powershell
cd "c:\dev\気象アプリ"
npx tsc --noEmit 2>&1 | head -50
```

エラーがあれば修正する。

- [ ] **Step 5: ローカル開発サーバーで動作確認**

```powershell
cd "c:\dev\気象アプリ"
npm run dev
```

確認項目：
- 分析タブを開いたとき、デフォルト地点・今年のデータが自動表示される
- 地点や年を変更しても、「表示」ボタンを押すまでチャートが変わらない
- 「表示」ボタンを押すとデータ取得が始まりチャートが更新される
- チャート下部（Footer直前）に365日のテーブルが表示される
- 2ターゲット選択時、各指標ごとにA/B列が隣接して表示される
- CSVダウンロードボタンで正しいデータがダウンロードされる
- テーブルがスクロール可能（maxHeight: 420px）である
- モバイル画面で「比較対象を追加」と「表示」ボタンが同じ行に並ぶ

---

## Task 8: コミット

- [ ] **Step 1: ビルドが通ることを確認**

```powershell
cd "c:\dev\気象アプリ"
npm run build 2>&1 | tail -20
```

- [ ] **Step 2: コミット**

```powershell
git add src/App.tsx src/components/DailyRawTable.tsx
git commit -m "feat: 比較分析タブに表示ボタン追加・365日スプレッドシート刷新・CSVダウンロード追加

- targets(pending) / committedTargets(confirmed) の2ステート分離
- 表示ボタン押下時のみデータ取得をトリガー（手動更新化）
- MonthsTable を DailyRawTable（全指標×365日×ターゲット）に置換
- CSV ダウンロード機能追加（UTF-8 BOM付き、Excel対応）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 補足：既知の注意点

1. **`BarChart2` インポート**: lucide-react の `BarChart2` または `Play` を使用。未インポートなら import リストに追加。
2. **`MonthsTable` の削除**: `MonthsTable.tsx` ファイル自体は残しても削除しても構わない（削除推奨で `git rm`）。
3. **テーブルのスクロール**: `maxHeight: 420px` + `overflowY: auto` + `sticky` thead でスクロール時もヘッダーが固定される。
4. **CSVのBOM**: Excel で文字化けしないよう `'﻿'` を先頭に付与している。
5. **365日未満のデータ**: 今年途中・APIデータが不完全な場合は取得できている日数分だけ表示（`allDates.length`が可変）。
