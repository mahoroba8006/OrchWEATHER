# 警報・注意報ガントバー表示 設計書

**日付:** 2026-05-30  
**対象:** 日別予報・時間別予報への気象庁注意報・警報のガントバー表示

---

## 概要

気象庁注意報・警報の有効期間を、日別予報のミニグラフ直下および時間別予報のミニグラフ直下に、細いガントチャートのような横バーとして表示する。

---

## 要件

- 対象時間帯の下に細いバーを表示する（ガントチャート形式）
- 色: 注意報＝黄〜オレンジ系グラデーション、警報＝ピンク〜レッド系、特別警報＝ラベンダー〜パープル系
- バー内テキスト: 警報名のみ（例: 「大雨」「大雪」）
- 同時間帯に複数の警報がある場合は行（レーン）を追加して重複しないように表示（上限なし）
- 日別: ミニグラフ行の直下に配置
- 時間別: ミニグラフ行の直下に配置
- 複数列をまたぐ警報は連続したバーとして描画する

---

## データ層の変更

### `src/api/jmaWarning.ts`

`JmaWarningItem` に `startMs` を追加する。

```typescript
interface JmaWarningItem {
  code: number
  name: string
  level: WarningLevel
  validPeriod?: string    // 表示用文字列 e.g. "5/29 06:00〜09:00"（既存）
  startMs?: number        // 追加: 開始時刻 UTC ms
  endMs?: number          // 既存: 終了時刻 UTC ms
}
```

`buildValidPeriodMap` で `〜` の左側を `Date.parse()` で変換し `startMs` として保持する。既存の `endMs` 算出と同じ方法。

有効期間なし（継続中）の場合は `startMs` のみ存在し `endMs` は `undefined`。

### `src/components/weather/WeatherTab.tsx`

`useJmaWarning()` の結果を `DailyForecast` と `HourlyTable` にも `jmaWarnings` prop として渡す。`enabledJmaGroups` によるフィルタリングは既存ロジックをそのまま流用する。

```
WeatherTab
  ├─ JmaWarningSummary  (既存・変更なし)
  ├─ DailyForecast      + jmaWarnings?: JmaWarningItem[] 追加
  └─ HourlyTable        + jmaWarnings?: JmaWarningItem[] 追加
```

---

## 共通ユーティリティ

### `src/lib/warningGantt.ts`（新規）

#### レーン割り当て関数

```typescript
/**
 * 警報リストを時間的に重ならないレーン（行）に分割して返す。
 * グリーディ区間スケジューリング（startMs 昇順で処理）。
 */
export function computeWarningLanes(
  warnings: JmaWarningItem[]
): JmaWarningItem[][]
```

例: `[大雨(06-18), 大雪(08-12), 洪水(14-20)]` → `[[大雨, 洪水], [大雪]]`  
（大雨と洪水は時間が重ならないため同じレーンに、大雪は大雨と重なるため別レーン）

#### 色定数

```typescript
export const GANTT_GRADIENT: Record<WarningLevel, string> = {
  advisory: 'linear-gradient(90deg, #fbbf24, #f59e0b)', // 注意報: 黄〜オレンジ
  warning:  'linear-gradient(90deg, #fb7185, #f43f5e)', // 警報: ピンク〜レッド
  special:  'linear-gradient(90deg, #c084fc, #a855f7)', // 特別警報: ラベンダー〜パープル
  none: '',
}
```

#### 解除未定バーの右端スタイル

`endMs` が `undefined` の場合、右端30pxを透明へのグラデーションでフェードアウトし、末尾に `→` を付加する。

```typescript
// バー右端のフェード: background に追加するオーバーレイ
export const INDEFINITE_FADE =
  'linear-gradient(90deg, transparent calc(100% - 30px), rgba(255,255,255,0.6) 100%)'
```

---

## 日別予報ガントバー

### 列マッピング

| 列の種類 | 時間範囲（JST） | 判定ロジック |
|---|---|---|
| 最初の3日: 午前列 | 04:00〜12:00 | 警報の期間がこの範囲と重なれば対象 |
| 最初の3日: 午後列 | 12:00〜20:00 | 同上 |
| 最初の3日: 夜間列 | 20:00〜翌04:00 | 同上 |
| 4日目以降 | 00:00〜24:00 | 該当日と重なれば対象（日全体） |

時間粒度は「列単位」（AM/PM/夜間列内の細かい位置は不要）。

### レンダリング構造

既存のミニグラフ行（`useLayoutEffect` で `dayX[]`/`dayWidths[]` を測定）の直後に、レーン数分の `<tr class="gantt-row">` を追加する。

```tsx
{/* 既存: ミニグラフ行 */}
<tr><td colSpan={totalCols}><svg>...</svg></td></tr>

{/* 追加: ガントバー行（レーンごと） */}
{lanes.map((lane, i) => (
  <tr key={i} className="gantt-row">
    <td colSpan={totalCols} style={{ position: 'relative', height: 22 }}>
      {lane.map(warning => (
        <WarningBar
          key={warning.code}
          warning={warning}
          left={dayX[startColIdx]}
          width={dayX[endColIdx] + dayWidths[endColIdx] - dayX[startColIdx]}
        />
      ))}
    </td>
  </tr>
))}
```

連続バー（複数列またぎ）は `left` と `width` の計算で自然に表現される。バーの開始位置 = `dayX[startColIdx]`、終了位置 = `dayX[endColIdx] + dayWidths[endColIdx]`。

#### startColIdx / endColIdx の算出

1. `startMs` が属する日を特定する
2. その日が最初の3日以内 → AM/PM/夜間を判定してサブ列インデックスを決定（AM=0, PM=1, Night=2 のオフセット）
3. 4日目以降 → 対応する日のインデックスをそのまま使用
4. `endMs` が undefined（継続中）の場合 → `endColIdx` = 最後の表示列（右端）とする

### WarningBar コンポーネント

```tsx
// position: absolute で配置
// left, width を props で受け取る
// テキスト: 警報名のみ（バー幅が短い場合は非表示）
// endMs が undefined の場合: 右端フェード + → マーク
```

バー内テキストが入りきらない目安: バー幅 < 32px → テキスト非表示。

---

## 時間別予報ガントバー

### 列マッピング

`COL_W = 32px` 固定で 1列 = 1時間。日の出・日の入り列（`SunEntry`）が途中に挿入されるため、時刻→x座標の変換には既存の `hourlyPos[]` を使用する。

```
警報 startMs → 対応する hourly[i].time を検索（切り捨て: Math.floor）→ x = hourlyPos[i] * COL_W
警報 endMs   → 対応する hourly[j].time を検索（切り上げ: Math.ceil）  → right = hourlyPos[j] * COL_W
width = right - x
endMs が undefined（継続中）→ right = 表示中の最終 hourly 列の右端
```

### レンダリング構造

日別と同じ構造。ミニグラフ行の直後にレーン数分の `<tr>` を追加。

```tsx
{lanes.map((lane, i) => (
  <tr key={i} className="gantt-row">
    <td colSpan={totalCols} style={{ position: 'relative', height: 22 }}>
      {lane.map(warning => (
        <WarningBar
          key={warning.code}
          warning={warning}
          left={hourlyPos[startIdx] * COL_W}
          width={(hourlyPos[endIdx] - hourlyPos[startIdx]) * COL_W}
        />
      ))}
    </td>
  </tr>
))}
```

### 日別との差異

| 項目 | 日別 | 時間別 |
|---|---|---|
| 列幅 | `dayWidths[]`（可変・測定値） | `COL_W = 32px`（固定） |
| 時間粒度 | 列単位（AM/PM/夜間 or 1日） | 1時間単位 |
| x座標計算 | `dayX[colIdx]` | `hourlyPos[i] * COL_W` |

---

## WarningBar コンポーネント仕様

`src/components/weather/WarningBar.tsx`（新規）として切り出す。

### Props

```typescript
interface WarningBarProps {
  warning: JmaWarningItem
  left: number    // px: バー左端の絶対位置
  width: number   // px: バーの幅
}
```

### 視覚仕様

| 項目 | 値 |
|---|---|
| 高さ | 20px（上下1pxマージン含め行高22px） |
| 角丸 | 4px |
| 文字サイズ | 10px |
| フォントウェイト | 600 |
| テキスト内容 | 警報名のみ（例: 「大雨」「大雪」） |
| テキスト色 | `#fff` |
| テキストの余白 | 左4px |
| テキスト溢れ | `overflow: hidden`、`white-space: nowrap`、`text-overflow: ellipsis` |
| バー幅 < 32px | テキスト非表示 |
| 解除未定（`endMs` undefined） | 右端30pxをフェードアウト + `→` マーク |

### 色（グラデーション）

| レベル | CSS |
|---|---|
| `advisory`（注意報） | `linear-gradient(90deg, #fbbf24, #f59e0b)` |
| `warning`（警報） | `linear-gradient(90deg, #fb7185, #f43f5e)` |
| `special`（特別警報） | `linear-gradient(90deg, #c084fc, #a855f7)` |

---

## スコープ外

- ツールチップ（時刻詳細）: 時刻の詳細は既存の `JmaWarningSummary` で確認する
- 解除未定バーの「（解除未定）」テキスト: バー内には表示しない（スペース確保のため）

---

## 影響ファイル

| ファイル | 変更種別 |
|---|---|
| `src/api/jmaWarning.ts` | 修正: `startMs` 追加 |
| `src/lib/warningGantt.ts` | 新規: レーン計算・色定数 |
| `src/components/weather/WarningBar.tsx` | 新規: 共通バーコンポーネント |
| `src/components/weather/DailyForecast.tsx` | 修正: `jmaWarnings` prop 追加、ガントバー行挿入 |
| `src/components/weather/HourlyTable.tsx` | 修正: `jmaWarnings` prop 追加、ガントバー行挿入 |
| `src/components/weather/WeatherTab.tsx` | 修正: `jmaWarnings` を両コンポーネントに渡す |
