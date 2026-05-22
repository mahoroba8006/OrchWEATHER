# 天気SVGアイコン統合 設計書

**日付**: 2026-05-22  
**対象ブランチ**: main  
**ステータス**: 承認済み

---

## 概要

現在、天気アイコンはUnicode絵文字（`weatherCodeToEmoji()`）で表示している。
これをClimacons SVGアイコンに置き換え、天気種別ごとに色付けされた統一感のある表示にする。

---

## 採用アプローチ

**SVGパスデータをTypeScriptに直接埋め込む方式（Approach C）**

- Climaconsは全て単一 `<path>` 要素で構成されているため、`d` 属性値をTS定数として格納し `<svg><path fill={color} />` として描画する
- 新パッケージの追加なし
- アセットファイルの管理不要（publicフォルダへのコピーも不要）
- CSS `fill` プロパティで完全な色制御が可能

---

## 使用するアイコン（計11種）

ソース: `C:\Users\kazma\Downloads\Climacons-Font\SVG\`

| WMOコード | 天気 | アイコン名（昼） | アイコン名（夜） |
|-----------|------|----------------|----------------|
| 0 | 快晴 | `Sun.svg` | `Moon.svg` ★夜間専用 |
| 1〜2 | 薄曇り | `Cloud-Sun.svg` | `Cloud-Moon.svg` ★夜間専用 |
| 3 | 曇り | `Cloud.svg` | `Cloud.svg`（共通） |
| 45, 48 | 霧 | `Cloud-Fog.svg` | `Cloud-Fog.svg`（共通） |
| 51〜55 | 小雨 | `Cloud-Drizzle.svg` | `Cloud-Drizzle.svg`（共通） |
| 56, 57, 66, 67 | みぞれ | `Cloud-Hail.svg` | `Cloud-Hail.svg`（共通） |
| 61〜65, 80〜82 | 雨 | `Cloud-Rain.svg` | `Cloud-Rain.svg`（共通） |
| 71〜77, 85〜86 | 雪 | `Snowflake.svg` | `Snowflake.svg`（共通） |
| 95〜99 | 雷雨 | `Cloud-Lightning.svg` | `Cloud-Lightning.svg`（共通） |

**夜間切り替えは code 0〜2 のみ**。それ以外は `isNight` フラグを無視し昼用アイコンを使用。

---

## カラースキーム

| アイコン | 色コード | 色名 |
|----------|----------|------|
| Sun | `#F59E0B` | 琥珀（amber-400） |
| Moon | `#94A3B8` | シルバー（slate-400） |
| Cloud-Sun | `#FBBF24` | 薄琥珀（amber-300） |
| Cloud-Moon | `#A0AEC0` | 青みシルバー |
| Cloud | `#9CA3AF` | グレー（gray-400） |
| Cloud-Fog | `#B0B5C4` | 薄グレー |
| Cloud-Drizzle | `#60A5FA` | 薄青（blue-400） |
| Cloud-Rain | `#3B82F6` | 青（blue-500） |
| Cloud-Hail | `#06B6D4` | シアン（cyan-500） |
| Snowflake | `#93C5FD` | 水色（blue-300） |
| Cloud-Lightning | `#F87171` | 赤（red-400） |

---

## 新規ファイル

### `src/components/weather/WeatherIcon.tsx`

```
WeatherIcon
├── PATHS: Record<string, string>       // 11アイコン分のSVGパスデータ（d属性値）
├── ICON_COLORS: Record<string, string> // アイコン名 → 色コード
├── codeToIconName(code, isNight)       // WMOコード + isNight → アイコン名
└── WeatherIcon({ code, isNight?, size? })  // <svg> レンダリング
```

インターフェース:

```typescript
interface WeatherIconProps {
  code: number;
  isNight?: boolean; // default: false
  size?: number;     // default: 24 (px)
}
```

---

## 変更ファイル

### `src/components/weather/HourlyTable.tsx`

- `nightWeatherNode()` 関数を削除
- 天気行のレンダリングを以下に置換:
  ```tsx
  // Before
  {isNighttime(entry.data.time) ? nightWeatherNode(code) : weatherCodeToEmoji(code)}
  
  // After
  <WeatherIcon code={entry.data.weatherCode} isNight={isNighttime(entry.data.time)} size={24} />
  ```
- 天気セルの `td` から `fontSize: '1.5em'`, `lineHeight: 1`, `color` スタイルを削除
- 過去時間のフェードアウト: 現在 `color: faded ? '#c0c4cf' : undefined` だが、SVGは `color` が効かないため `opacity: faded ? 0.35 : 1` に変更
- `weatherCodeToEmoji` のimportを削除

### `src/components/weather/DailyForecast.tsx`

- `weatherCodeToEmoji()` の全呼び出しを `<WeatherIcon code={...} size={42} />` に置換
- `isNight` は渡さない（常に昼用アイコン）
- `weatherCodeToEmoji` のimportを削除
- `fontSize: '2.6rem'` ラッパーのfontSize指定を削除（SVGはsize propで制御）

---

## 変更しないファイル

- `src/lib/riskDetection.ts`: `weatherCodeToEmoji` は残存（削除はスコープ外）

---

## サイズ

| 使用箇所 | size prop |
|---------|-----------|
| 時間別予報（HourlyTable） | `24` px |
| 日別予報（DailyForecast） | `42` px |

---

## 実装手順（概要）

1. 11種のSVGファイルからパスデータ（`d` 属性）を読み取る
2. `WeatherIcon.tsx` を新規作成（PATHS定数 + コンポーネント）
3. `HourlyTable.tsx` を修正
4. `DailyForecast.tsx` を修正
5. 動作確認（昼間アイコン・夜間切り替え・全WMOコード）
