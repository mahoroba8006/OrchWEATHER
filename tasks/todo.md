# 今年のあゆみ＋節気ふりかえりカード（2026-10-03〜）

仕様書: [docs/superpowers/specs/2026-10-03-season-review-design.md](../docs/superpowers/specs/2026-10-03-season-review-design.md)／計画: [docs/superpowers/plans/2026-10-03-season-review.md](../docs/superpowers/plans/2026-10-03-season-review.md)
ブランチ: `feature/season-review`（worktree `.worktrees/season-review`）

- [x] 設計合意（全ユーザー向け・AI不使用／去年＋5年平均／1/1起点の積算・年初は30日平均／帯は常設・カードは節気の変わり目3日間＋節気名タップでシート／カードは数字＋日ごとの雨＋記録）
- [x] 計画レビュー（別エージェント）指摘5件を反映: 今年を today の暦年で固定・0℃未満は0・当年キャッシュ6時間失効・予報に地点を持たせて照合・閲覧計測は可視判定で帯下/シート両方
- [x] 実装（サブエージェント: Haiku=タスク1〜6、Sonnet=7〜9）
- [x] 実画面検証で判明・修正: ①archive 並列取得が 429 → 1リクエスト化 ②節気名ボタンが親の pointer-events:none で押せない ③節気の絵が白カードで見えない → 夜空色の台
- レビュー: テスト270件成功／tsc・lint（新規ファイル）OK／メイン 436.42→440.03KB gzip（+3.6KB）
- 実画面（375px・東京）: 帯「積算気温 去年より9日遅い・5年平均より6日遅い」、シートで白露のふりかえり（雨476mm=archive実値と一致）、9/24固定で帯下カード表示、1/1・1/2固定で「この30日」表示（前年を今年と出さない）
- [x] 実機確認で指摘: 空くらべと積算の数字が違う（0℃基準 vs 基準温度10℃）
- [x] 改修（branch `feature/season-pace-ticker`）: 名称「季節のあしどり」／気温・降水量・積算温度・日照時間の4項目を紙芝居表示／積算温度は空くらべの基準温度1・開始日・日数差ガードと共有／設定「比べ方」（空くらべに合わせる・直近30日）／テスト274件・実画面で4項目の巡回・reduced-motion・375px確認
- [x] 実機指摘の改善: 本文先頭に項目名（気温・降水量…）を色付きで表示し見出しは「季節のあしどり（期間）」に／表示8秒（倍）／切り替えを0.8秒のゆっくりした動きに（実測確認）
- [x] 今日の列・今の時刻の網掛け→淡い太線の枠／時刻の「今」を削除
- [x] 不具合: トップに「取得元がメンテナンス中」→ Open-Meteo の利用上限（長期間の要求の消費）が原因と推定。過去年を端末保存（2回目以降は今年分のみ）・429 は「アクセス集中」の文言に
- [x] 比べ方を項目ごと（降水量・積算温度・日照時間 × 累積／直近30日）に・気温は注記のみ／積算温度の単位を 30日=℃・累積=日 に（℃日廃止・累積の序盤は非表示）
- [x] ふりかえりカードをシート内で左右スライド（直近6節気・左が古い・最新から表示・点/矢印でも移動・見出しが追従・season_card_browse 計測）。帯下は最新1枚のまま
- [x] ふりかえりカード: 「ふりかえり ─」削除／イラスト台を青系に／雨の棒に最高・最低気温の折れ線（単調補間）＋雨量・日照から推定した天気アイコン（目安と注記）
- [x] ふりかえりの気温グラフを「最低〜最高の縦棒＋5年平均の帯（はみ出しを赤/青）」に変更、雨は別の段（10mm以上は数値）。折れ線は廃止
- [ ] ユーザー実機確認（develop プレビュー）→ OK なら main 反映の指示待ち
- 持ち越し: 第2段階（有料/AI許可ユーザー向け AI 講評）／空くらべの年別並列取得も同じ 429 の恐れ（未調査）

---

# アプリ全面リニューアル「空が主役」（2026-09-30〜）

**2026-10-01 main 反映済み（`6e1c22f..2efd2f3`、ユーザー指示）**

仕様書: [docs/superpowers/specs/2026-09-30-app-visual-redesign-design.md](../docs/superpowers/specs/2026-09-30-app-visual-redesign-design.md)

- [x] 設計合意（A空が主役／ヒーロー型／Motion導入／設定はシート）
- [x] 仕様書作成・コミット
- [x] 第1段階 実装計画: [docs/superpowers/plans/2026-09-30-app-redesign-phase1-foundation.md](../docs/superpowers/plans/2026-09-30-app-redesign-phase1-foundation.md)
- [x] 第1段階 土台（トークン・書体・Motion・共通部品・Playwright撮影）→develop `9262793`
  - レビュー: テスト73件成功／ビルド成功／バンドル +38.4KB gzip（予算50KB内）／撮影 before・phase1-final 比較で崩れなし
  - 途中是正: ①撮影にgeolocation付与（ゲストで地点なし→空画面だった）②Plex化でモード切替ボタンが折返し→nowrap ③グローバル button:hover の優先度が .premium-pill/.ui-btn の背景を上書き→:where() で優先度0に
  - 第2段階への持ち越し: Sheet の閉じアニメ中も Esc/スクロールロックが残る（usePresenceで改善可）・スワイプ閉じの実機確認
  - [x] ユーザー実機確認（2026-10-03 確認完了）（developプレビュー）
- [x] 第2段階 骨格（ヒーロー空・ナビ・タブ遷移・設定/ヘルプのシート化）→develop
  - 計画: docs/superpowers/plans/2026-09-30-app-redesign-phase2-shell.md
  - テスト140件成功／ビルド成功／バンドル 476.32KB gzip（基準426.86KBから累計+49.5KB＝予算50KBの上限到達）
  - レビュー是正: ナビをtablist→nav+aria-current／ログアウト時にシートを閉じる／空を毎分再計算／ヘッダーボタンを暗い半透明にしてコントラスト確保／雲粒子の横線化を修正
  - ★第3段階以降の前提: 予算を使い切ったため、Motion機能の遅延読み込み or 空くらべのコード分割で余地を作ってから追加すること
  - [x] ユーザー実機確認（2026-10-03 確認完了）（下スワイプで閉じる／ログイン時の地図モーダル・削除確認がシート上に出る／粒子の滑らかさ・発熱）
- [x] 第3段階 空もよう →develop
  - 計画: docs/superpowers/plans/2026-10-01-app-redesign-phase3-weather.md
  - テスト157件成功／ビルド成功／メイン 428.29KB gzip（Leaflet遅延読み込みで -49.8KB、基準からの累計 +1.4KB）
  - 内容: 注意報の意味色バー帯（伸び・警報は3回脈動）／日別に気温レンジバー・滑る選択印・今日列の淡色／時間別の罫線整理・「今」の縦帯・降水量バー／AIコメントの下線タブ・方向つき切替・行ごと表示・雲ローディング／骨組み表示・エラー揺れ・カード順次表示／モード切替をセグメント化
  - レビュー是正: 地図チャンク読込失敗で白画面→ErrorBoundaryで保護＋再試行可／AIコメントにtabpanel
  - 持ち越し: AIスワイプの指追従（既存ロジックと競合リスクのため見送り）
  - [x] ユーザー実機確認（2026-10-03 確認完了）（ログイン時のAIコメント・注意報発表地点の帯）
- [x] 第4段階 空くらべ・空しらべ →develop
  - 計画: docs/superpowers/plans/2026-10-01-app-redesign-phase4-analysis.md
  - App.tsx 2566→206行（空くらべを AnalysisTab / useAnalysisState / chartShapes へ純粋移動。stateはApp側フックで保持しタブ往復の保持・取得/計測タイミングを不変に。移動前後の操作ログ一致を確認）
  - 操作部をカード＋セグメント化、チャートは軸線なし・淡い横グリッド・細線・範囲バー軽量化・値表示の滑らかな差し替え、空しらべ操作パネル整理
  - 計画の誤り: 「日別データ表」は実在せず（CSVボタンのみ）→表の見出し固定は不要と判断
  - レビュー是正: タブ追従が縦スクロールを動かす恐れ→横のみに限定／ヘルプ表の偶数行ホバー
  - [x] ユーザー実機確認（2026-10-03 確認完了）（空くらべのピンチ・スワイプ・タップ値表示、比較対象複数）
- [x] 第5段階 設定中身・ログイン・LP統一・互換エイリアス撤去 →develop
  - 計画: docs/superpowers/plans/2026-10-01-app-redesign-phase5-finish.md
  - 互換エイリアス撤去（165箇所置換・旧名使用をテストで検知）／テーマ色 #0E6B65
  - 設定: 下線サブタブ・Toggle・SaveButton（チェック描画）・地点リストの滑らかな増減
  - ログイン画面を夜明けの空に（※LoginScreenは現在どこからも描画されていない＝未使用コード）／ヘルプ組版＋実UIとの文言ズレ4件修正
  - LP: 書体をPlexへ・アクセント統一・ヒーロー見出し縮小
  - テスト168件／メイン 428.81KB gzip
  - [x] ユーザー実機確認（2026-10-03 確認完了）（ログイン時の設定4画面）→ OKならmain反映の指示待ち
- [x] ヒーローに二十四節気・七十二候（読み付き）＋節気ごとの水墨・水彩風イラスト24枚 →develop
  - 計画: docs/superpowers/plans/2026-10-01-sekki-hero.md／太陽黄経の天文計算（固定表なし）・略本暦／テスト214件／+7.2KB gzip
  - 高さ760px以下は絵40px・読み省略の控えめ表示（隠さない）。812pxではヒーロー高さ増加0
  - 絵の弱め: 雨水・白露・寒椿（小寒）・霜降 → 2026-10-03 ユーザー確認完了
- [ ] 後続候補: LPのアプリ画面写真が旧デザインのまま（public/lp）→新デザインで撮り直し
- [x] 地点削除を await＋失敗表示に修正（テスト追加）／未使用 LoginScreen.tsx を削除

---

# LP ビジュアル刷新「スクロールで晴れていく空」（2026-07-21）

仕様書: [docs/superpowers/specs/2026-07-21-lp-visual-redesign-design.md](../docs/superpowers/specs/2026-07-21-lp-visual-redesign-design.md)
実装は Sonnet 5 サブエージェントに委任（クレジット節約方針）。

- [x] 設計合意（空色背景＋teal維持／ライブラリなし／全力で先進的）
- [x] 仕様書作成
- [ ] Sonnet サブエージェントによる実装（LandingPage.tsx＋landing.css のみ・文言不変）
- [ ] npm run build 通過＋dev サーバー目視検証（デスクトップ＋375px＋reduced-motion）
- [ ] ユーザー実機確認 → OKならコミット＆push（develop）

---

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
# 2026-09-09 設定画面の配色分離

- [x] 設定テーマを注意報の暖色からインディゴ系へ変更
- [x] ボタン・フォーカスリング・枠線・影をテーマ色へ連動
- [x] 配色回帰テストを追加し、失敗→成功を確認
- [x] 全テストと本番ビルドを実行

## レビュー

- `src/index.css` の設定専用トークンだけをインディゴ系へ変更し、警報・注意報・日照色は維持しました。
- Vitest: 6ファイル・43テスト成功。
- 本番ビルド成功。既存のチャンクサイズ警告のみで、今回の変更に伴うエラーはありません。
- CUAのブラウザが利用不可だったため、実画面スクリーンショットの取得は未実施です。
# 2026-09-09 空しらべ PCズーム操作

- [x] PC用ズーム計算をテスト駆動で追加
- [x] `Ctrl/⌘＋ホイール`でカーソル位置を中心にズーム
- [x] 「縮小・拡大・全体表示」ボタンと操作案内を追加
- [x] 通常ホイールのページスクロールを維持
- [x] 全テスト・本番ビルド・画面操作を検証

## レビュー

- カーソル位置をアンカーにしたPCズームを追加しました。ホイール単独は処理せず、ページスクロールを維持します。
- Reactのpassive wheel制約を回避するため、グラフ領域へ`passive: false`のネイティブリスナーを限定登録しました。
- Vitest: 6ファイル・44テスト成功。本番ビルド成功。
- Chrome実画面で操作UIの表示、拡大によるX軸範囲変更、月次モードでの非表示を確認しました。
- `npm run lint`は既存の`.worktrees`を含む193件のエラーで失敗しました。今回追加箇所に固有の新規エラーは確認されていません。

# 2026-10-03 節気ふりかえり計画書レビュー

- [x] 対象計画書・仕様書・過去の教訓を確認する
- [x] 計算例を再現し、既存の取得・UI契約と照合する
- [x] 優先度・根拠行・修正案を整理し、レビュー結果を記録する

## レビュー

- P1: computeYearPace が最新日の年を採用し、当年データ欠損・1/1 に前年を「今年」と表示する（計画694〜697行）。
- P2: 当年 archive の無期限キャッシュを更新せず、過去7日の補完範囲を超えると欠損が残る（計画926行、src/api/weather.ts:70〜82）。
- P2: 地点切替直後の旧予報で新地点の archive 取得を開始し、予報と競合・年別取得が重複する（計画915〜926行）。
- P2: season_card_view は帯下カードのマウントだけを計測し、Sheet 内での閲覧を計測しない（計画1151行・1401行）。
- 検証: 計画の TypeScript コード例を Node の stripTypeScriptTypes で実行。当年データなしの2026-01-02と2026-01-01で、前年の積算を「今年のあゆみ」と表示することを再現。通常ケースは期待どおり28日早い。
- 未確定仕様: 0℃基準の積算で負の日平均気温を加算するか0に切り上げるかを明示する必要がある。
- 設計書・アプリコードは変更していません。実装前レビューのためアプリの全テスト・ビルドは実施していません。

