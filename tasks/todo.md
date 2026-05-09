# A案: 月次/日次 切替ボタン 実装計画

## 目的
モバイルでチャートが潰れる問題を、日次（365点）/月次（12点）切替で解決する。

## 実装ステップ（完了）

- [x] 1. `chartViewMode` state を追加（'daily' | 'monthly', デフォルト 'daily'）
- [x] 2. 表示期間バーに「日次 / 月次」トグルボタンを追加
- [x] 3. `monthlyStats` を拡張（`minHumid`, `maxHumid` を追加）
- [x] 4. `monthlyChartData` useMemo を追加（12エントリ、累積値含む）
- [x] 5. `filteredMonthlyChartData` useMemo を追加（displayRange でフィルタ）
- [x] 6. 全6チャートに適用
- [x] 7. minWidth を月次時 350px に縮小
- [x] 8. ローカル動作確認（ユーザー実機で検証完了）

## レビュー

### 変更ファイル
- `src/App.tsx`（約150行追加）

### 設計判断
- **データ構造の統一:** 月次データのフィールド名を日次と完全一致させたことで、各チャートの分岐ロジックを最小化（data/shape/ticks のみ切替）
- **CustomRangeBar の扱い:** 12点表示では細い縦線より太いバーの方が視認性が高いため、月次時は `shape={undefined}` でデフォルトBar描画＋fillOpacity 0.3 で透過
- **降水量の日別バー:** 月次モードでは月合計と冗長になるため非表示。月合計バー＋累積線のみに簡略化
- **累積値:** 月次の累積は `monthlyStats` を順次加算して再計算（日次の累積と微小な誤差は許容）

### 検証結果
- TypeScript型チェック: 通過
- 本番ビルド: 通過
- ユーザー実機確認: OK
