# 設計書：モバイル分析タブ デフォルト viewport（月揃え）

**日付:** 2026-05-24  
**対象ファイル:** `src/App.tsx` のみ

---

## 目的

モバイル（画面幅 < 768px）で分析タブを開いた際、デフォルトで
「今日基準・2ヶ月前の月初 〜 翌月の月末」に絞った日次グラフを表示する。

過去年を選択した場合も**同じ月日範囲**をその年に当てはめる（季節比較が容易になる）。

---

## 動作仕様（今日 = 2026/05/24 の例）

| 選択年 | start | end | 備考 |
|---|---|---|---|
| 2026 | 2026/03/01 | 2026/05/23 | データ末尾でクランプ（未来データなし） |
| 2025 | 2025/03/01 | 2025/06/30 | 過去年は月末まで存在するのでそのまま |
| 2024 | 2024/03/01 | 2024/06/30 | 同上 |

- **start月** = today.month − 2（月初 = 1日）
- **end月**   = today.month + 1（月末 = その月の最終日）
- 年またぎ（今が1月 or 2月 → start が前年11〜12月扱いになる）は、
  startStr > endStr になるため end を データ末尾にクランプして対処
- デスクトップは従来どおり 365日ウィンドウ（変更なし）

---

## 実装変更

### 1. `isMobile` state（マウント時1回判定）

```typescript
const [isMobile] = useState(() => window.innerWidth < 768);
```

リサイズで viewport を強制リセットするとドラッグ中に崩れるため、再判定なし。

### 2. ヘルパー関数 `calcMobileDefaultViewport`

コンポーネント外の純粋関数として追加。

- `data[0].date.substring(0,4)` から選択年を取得
- `startStr` / `endStr` を構築してバイナリ的に index を検索
- 年またぎ時は `endStr < startStr` を検知 → endIdx = data.length − 1

### 3. `dailyViewport` 初期化 useEffect の分岐追加

```typescript
useEffect(() => {
  const total = filteredBaseChartData.length;
  if (total === 0) { setDailyViewport(null); return; }

  if (isMobile) {
    const vp = calcMobileDefaultViewport(filteredBaseChartData, new Date());
    if (vp) { setDailyViewport(vp); return; }
  }

  // デスクトップ or フォールバック
  const w = Math.min(DAILY_WINDOW, total);
  setDailyViewport({ start: total - w, end: total });
}, [filteredBaseChartData.length, isMobile]);
```

---

## 非変更事項

- パン（ドラッグスクロール）ロジック → そのまま
- `DAILY_WINDOW = 365` → デスクトップ用として存続
- 月次モード → 変更なし
