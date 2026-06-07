# 教訓ログ（Lessons Learned）

ミスのパターンと再発防止ルールを記録する。

## フォーマット

```
## YYYY-MM-DD: （ミスの概要）
- **状況:** （何が起きたか）
- **原因:** （なぜ起きたか）
- **ルール:** （次回から守るルール）
```

---

## 2026-06-01: JMA注意報は timeSeries を持たない種別がある（濃霧・乾燥など）
- **状況:** 濃霧注意報が発表5/28から4日間表示され続け、AIにも渡り続けた。期間表示も出なかった。
- **原因:** 濃霧(14)等は top-level `areaTypes` に `status:発表` のみ存在し、`timeSeries` に時系列(levels)を持たない。さらに当該地域の唯一の timeSeries が `雷危険度` の複合オブジェクト形式で、`buildValidPeriodMap` がスキップ → `validPeriodMap` 空 → `startMs/endMs/validPeriod` 全て undefined。結果、期限ベースの除外もAIの24hフィルタ(startMs基準)も発動しなかった。
- **ルール:** 期限情報のない注意報は `reportDatetime`（発表時刻）を基準に経過時間で除外する。除外判定は `fetchJmaWarnings` の1箇所に集約し、UI・AI・ガントバーを単一ソースで制御する（AI側に別基準の重複フィルタを置かない＝基準ズレによる不整合を防ぐ）。期間表示は終了時刻が無い種別では発表時刻のみ表示（JMAは濃霧等に終了時刻を提供しない）。

## 2026-06-06: 共有コンポーネントの型変更時に全使用箇所の型注釈更新を漏らした
- **状況:** `WarningBar` の props を `number → string` に変更した際、`DailyForecast.tsx` の `warningToBar` の return 文は修正したが、関数の戻り値型注釈 `{ left: number; width: number }` を更新し忘れた。ローカル tsc は通過したがリモートビルドで2度エラー。
- **原因:** return 文の値と型注釈が別行にあり、片方だけ修正して確認が不完全だった。ローカルの tsc が通過した理由は不明（tsconfig のスコープ差異の可能性）。
- **ルール:** 共有コンポーネントの props/返値型を変更したら `grep -n "warningToBar\|WarningBar"` 等で全使用箇所を列挙し、**return 文と型注釈を両方**変更する。変更後は必ず `npx tsc --noEmit` を実行して確認すること。

## 2026-06-01: 日付計算で `new Date(str)` + `toISOString()` がTZズレを起こす
- **状況:** 日別の夜間降水量が時間別の合計と一致しない。6/3未明の雨4.9mmが2日ズレて6/1夜間に合算されていた。
- **原因:** `new Date(date + 'T00:00:00')` はローカル時刻（JST）として解釈され、その後 `toISOString()` でUTCに変換すると9時間戻って日付が1日余分にズレる。`setDate(-1)` と合わせて計2日ズレた。
- **ルール:** カレンダー上の日付加減算は必ずUTC基準で行う。`src/lib/dateUtils.ts` の `addDays()`（`Date.UTC` ベース）を使う。ローカル時刻Dateを生成して `toISOString()` で日付を取り出す処理は禁止。
