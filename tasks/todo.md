# B案: Bitgo風モバイルチャート UX 実装計画

## 目的
モバイルでチャートを「画面端から端まで表示」「ドラッグでパン」「タップで値表示」「crosshair（縦＋横点線＋X軸ラベル）」できるようにする。

## 仕様（合意済み）
- 日次モード: 90日ウィンドウ、ドラッグで左右スライド
- 月次モード: 現状維持（12点しかないのでパン不要）
- ピンチズーム: 不要
- 標準tooltipは引き続き無効、ヘッダー右側に値表示
- 案①+④+⑥（前回未コミット分）は土台として活用

## 実装ステップ

- [x] 1. `ChartFrame` を全モード `width: 100%` に変更（日次の `minWidth: 700px` / `overflowX: auto` を削除）
- [x] 2. `dailyViewport` state（`{ start: number, end: number }`）を追加し、ローダー完了時に末尾90日にリセット
- [x] 3. `visibleChartData` / `visibleGddChartData` を導出（日次時のみslice、月次はそのまま）
- [x] 4. Recharts の `onMouseDown` / `onMouseMove` / `onMouseUp` を組み合わせたパン検出
  - 閾値5px超え → パンモード、`hover` 抑制、viewport をシフト
  - 5px以下で離す → タップとみなし `hover` を更新
- [x] 5. `onClick` ハンドラ追加（mousemoveが発火しないタッチ環境用フォールバック）
- [x] 6. crosshair拡張：縦線（既存）＋横線（Customized で描画）＋X軸日付ラベル（hover.label を下端の黒い小箱で表示）
- [x] 7. `npm run build` で型チェック・ビルド通過確認
- [x] 8. dev server で実機確認（375px DevTools モバイル）：
  - 日次モードで100%幅、初期表示は末尾90日
  - 左右ドラッグでviewportが動く
  - タップで値がヘッダー右に出る
  - 縦＋横の点線＋日付ラベルが出る
  - 月次モードは変化なし
- [x] 9. ユーザー実機確認OKなら commit & push

## 主な技術判断
- **ドラッグ vs タップの分離:** mousedown時に startX 記録、mousemove時に閾値超えで「ドラッグモード」へ。Recharts自身の `state.chartX` をピクセル座標に使う
- **viewport シフト量計算:** `dx_pixel / chartWidth * 90` (要素数) で indices 単位の移動量を算出、`Math.max(0, Math.min(maxStart, ...))` でクランプ
- **横線+X軸ラベル描画:** Recharts `<Customized>` または絶対配置divでオーバーレイ。今回は `<Customized>` で SVG 内に直接描画（DPRやスケールズレを回避）
- **複数target時:** 横線は first target の cy にだけ引く（複数引くと煩雑）。値はヘッダーで全target並べる
- **monthlyモードの crosshair:** 同じ仕組みを流用（パンだけスキップ）

## レビュー（実装後に記入）

### 変更ファイル
- `src/App.tsx`

### 設計判断（事後）
- (実装後に追記)

### 検証結果
- (実装後に追記)

---

# [優先度: 中] dotfilesリポジトリによるPC環境バックアップ整備

## 背景・ブレインストーミング

PCの電源異常を契機に、ローカル環境全体のバックアップ戦略を整理した。
プロジェクトコードはGitHub（OrchWEATHER）に全コミット済みのため安全。
抜け落ちているのは「Gitに入れられないシークレット」と「Claudeの個人設定」の2系統。

### バックアップが必要なファイル（5種類）

| # | ファイル | 場所 | 理由 |
|---|---|---|---|
| 1 | `.env` | `c:\dev\気象アプリ\.env` | FirebaseキーなどGitIgnore対象 |
| 2 | `.dev.vars` | 同上 | Cloudflare Pages Functions用環境変数 |
| 3 | `CLAUDE.md`（グローバル） | `C:\Users\kazma\.claude\CLAUDE.md` | 思考OS・行動原則プロンプト。再現不可 |
| 4 | `keybindings.json` | `C:\Users\kazma\.claude\keybindings.json` | キーバインド設定 |
| 5 | `memory\`フォルダ | `C:\Users\kazma\.claude\projects\c--dev------\memory\` | Claudeのプロジェクト文脈蓄積 |

### 方針
- GitHubに**プライベートリポジトリ「dotfiles」**を作成し一元管理
- Google Driveは`.git`フォルダ破損リスクがあるため`c:\dev\`を同期対象から外す
- VS CodeはSettings Syncでバックアップ（GitHubアカウント連携）
- 新PC復旧は`git clone dotfiles` → コピー配置 → `git clone OrchWEATHER` → `npm install`で完結

## 実装ステップ

- [ ] 1. GitHubで`dotfiles`プライベートリポジトリを作成
- [ ] 2. 以下の構成でファイルをコピーしコミット＆プッシュ
  ```
  dotfiles/
  ├── claude/
  │   ├── CLAUDE.md
  │   ├── keybindings.json
  │   └── memory/ （全ファイル）
  └── secrets/
      ├── orchweather.env  ← .envのリネームコピー
      └── orchweather.dev.vars
  ```
- [ ] 3. Google Drive for Desktopの設定から`c:\dev\`を同期対象外に変更
- [ ] 4. VS CodeのSettings Syncを有効化（File → Turn on Settings Sync）
- [ ] 5. dotfiles READMEに新PC復旧手順を記載

## 新PC復旧手順（メモ）
```powershell
git clone https://github.com/mahoroba8006/dotfiles.git
Copy-Item dotfiles\claude\CLAUDE.md C:\Users\[name]\.claude\CLAUDE.md
Copy-Item dotfiles\claude\memory\ C:\Users\[name]\.claude\projects\...\memory\ -Recurse
Copy-Item dotfiles\secrets\orchweather.env C:\dev\気象アプリ\.env

git clone https://github.com/mahoroba8006/OrchWEATHER.git
cd OrchWEATHER && npm install
```
