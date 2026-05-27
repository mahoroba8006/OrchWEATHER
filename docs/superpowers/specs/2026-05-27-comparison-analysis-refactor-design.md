# 設計スペック: 比較分析タブ リファクタリング

**日付:** 2026-05-27  
**対象ファイル:** `src/App.tsx`

---

## 概要

比較分析タブの比較件数を最大2件に絞り、差の表示ロジックを「2件目を基準とした1件目への差表示」に変更する。  
あわせて「基準」ラベルを廃止し、UIをシンプル化する。

---

## 変更要件

### 1. 最大件数: 3 → 2

| 変更箇所 | 変更前 | 変更後 |
|---------|--------|--------|
| `addTarget()` のガード | `targets.length >= 3` | `targets.length >= 2` |
| 「比較対象を追加」ボタン表示条件 | `targets.length < 3` | `targets.length < 2` |
| ヘッダーラベル | `表示対象 (最大3件)` | `表示対象 (最大2件)` |

既存ユーザーが3件登録している状態はあり得ない（画面操作でのみ追加できるため）。

### 2. ターゲット行ラベルの変更

| index | 変更前 | 変更後 |
|-------|--------|--------|
| 0 | `基準`（グリーン pill） | ラベルなし（span を丸ごと削除） |
| 1 | `比較`（ブルー pill） | `比較`（変更なし、2件目が存在する場合のみ表示） |

index 0 の行では色つき縦バー（4px）だけが識別子として残る。

### 3. 差の方向・表示位置の反転

#### 変更前
```
refId  = targets[0] (基準)
v0     = targets[0] の累積値
delta  = targets[1].value − v0   (比較 − 基準)
表示位置 = targets[1] の行
```

#### 変更後
```
refId  = targets[1] (基準)
v0     = targets[1] の累積値
delta  = targets[0].value − v0   (1件目 − 2件目)
表示位置 = targets[0] の行
```

**実装上の変更は1行のみ：**
```ts
// renderValueBox 内
// 変更前
const refId = accumDiffConfig && targets.length > 1 ? targets[0]?.id : null;
// 変更後
const refId = accumDiffConfig && targets.length > 1 ? targets[1]?.id : null;
```

これにより:
- `v0` が targets[1] の値になる
- `computeAccumDiff` 内の `targetId === refId` ガードが targets[1] をスキップ
- targets[0] の payload エントリに対して `delta = targets[0].value − targets[1].value` が計算される
- Δ日逆引きも targets[0] の累積系列を使う（`seriesByTarget.get(t0id)`）

#### 差が表示される条件
- `targets.length > 1`（2件目が存在する場合のみ）
- 対象チャート: GDD / 累積日射量 / 累積降水量 / 日照時間（累積系のみ）
- 気温・湿度・飽差への差追加は**スコープ外**

#### 差の符号の意味（変更後）
| delta | 表示 | 意味 |
|-------|------|------|
| > 0 | `+X` | 1件目が2件目より多い／進んでいる |
| < 0 | `−X` | 1件目が2件目より少ない／遅れている |

### 4. 予報日の差表示

予報日（10日予報オーバーレイ）では targets[0] の累積値が通常キーではなく予報キーに格納される。

| チャート | 通常キー（確定日） | 予報キー（予報日） |
|---------|------------|------------|
| GDD | `accum_${id}` | `forecast_accum_gdd_${id}` |
| 日射量 | `accumRadiation_${id}` | `forecast_accum_radiation_${id}` |
| 降水量 | `accumPrecip_${id}` | `forecast_accum_precip_${id}` |
| 日照時間 | `accumSunshine_${id}` | `forecast_accum_sunshine_${id}` |

`computeAccumDiff` を以下のように拡張する:

```ts
// refKey prefix → 対応する forecast prefix のマップ
const forecastPrefixMap: Record<string, string> = {
  'accum_':           'forecast_accum_gdd_',
  'accumRadiation_':  'forecast_accum_radiation_',
  'accumPrecip_':     'forecast_accum_precip_',
  'accumSunshine_':   'forecast_accum_sunshine_',
};

const computeAccumDiff = (p: any): string | null => {
  if (!accumDiffConfig || !refId || typeof v0 !== 'number') return null;
  const prefix = accumDiffConfig.refKeyPrefix;
  const t0id = targets[0]?.id;
  if (!t0id || typeof p.dataKey !== 'string') return null;

  // 通常キーまたは予報キーに一致するか確認
  const forecastPrefix = forecastPrefixMap[prefix];
  const isRegularKey  = p.dataKey === `${prefix}${t0id}`;
  const isForecastKey = !!forecastPrefix && p.dataKey === `${forecastPrefix}${t0id}`;
  if (!isRegularKey && !isForecastKey) return null;
  if (typeof p.value !== 'number') return null;

  const delta = p.value - v0;
  const deltaStr = accumDiffConfig.formatDelta(delta);

  if (isMonthly || !accumDiffConfig.showDays) return `(${deltaStr})`;
  if (v0 < accumDiffConfig.threshold) return `(${deltaStr})`;
  if (hoverDoy == null) return `(${deltaStr})`;

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

予報日のΔ日: `seriesByTarget.get(t0id)` は確定データの累積系列（予報を含まない）なので、予報日の「何日早い」はその確定データを基点に計算される（挙動として自然）。

---

## 変更対象コードの範囲

すべて `src/App.tsx` 内の変更。他ファイルへの影響なし。

| 変更箇所 | 行数規模 |
|---------|---------|
| `addTarget()` の上限チェック | 1行 |
| ヘッダーラベル文字列 | 1行 |
| 「追加」ボタン表示条件 | 1行 |
| targets 行の「基準」span 削除 | 約6行削除 |
| `renderValueBox` の `refId` 1行 | 1行 |
| `computeAccumDiff` の書き換え | 約15行 |

合計: 変更・削除 **約25行**

---

## スコープ外

- 気温・湿度・飽差への差追加
- MonthsTable（数値スプレッドシート）への差列追加
- 3件目を指定していた既存ユーザーの移行処理（そのようなユーザーは存在しない）
