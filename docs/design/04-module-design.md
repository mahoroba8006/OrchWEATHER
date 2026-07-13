# モジュール設計書 — Orch.Weather

| 項目 | 内容 |
|------|------|
| 文書種別 | モジュール設計書（処理意図＋分岐・判断ロジックの網羅） |
| 基準リビジョン | `6512b83`（2026-07-10） |
| 関連文書 | [内部設計書](03-internal-design.md) / [外部設計書](02-external-design.md) / [ADR](06-adr.md) |

## 本書の読み方
各モジュールを **①責務 → ②処理の流れ → ③分岐・判断ロジック（網羅）→ ④検証観点** で記す。逐次の行単位解説ではなく「どこで何を判断し、条件・閾値・フォールバック・タイブレークがどうなっているか」を漏れなく示す。presentational（判断が乏しい表示専用）モジュールは末尾の一覧表にまとめる。

分岐記号: `→` は分岐先、`∴` は既定/フォールバック。

---

## A. API層

### A-1. `api/forecast.ts` — 予報取得・整形（`fetchForecast`）
**責務:** Open-Meteo Forecast を1回取得し、時間別・日別・過去日別に整形。

**処理の流れ:** URL 構築（15日・384時間）→ 取得（`weatherFetch`）→ hourly 整形 → 時間帯集計（Map）→ daily 整形 → 今日基準で past/future 分割。

**分岐・判断ロジック:**
- レスポンス検証: `raw.hourly.time` または `raw.daily.time` が無ければ `weatherDataError()` を throw。
- hourly の各数値は `?? 既定値`（気温等=0、`freezingLevel`=9999、`pressure`=1013、`weatherCode`=0）。
- **時間帯振り分け（`hr` = 時刻の時）:**
  - `hr < 4` → 前日（`addDays(date,-1)`）の **夜間**
  - `4 ≤ hr < 12` → 当日 **午前**
  - `12 ≤ hr < 20` → 当日 **午後**
  - `hr ≥ 20` → 当日 **夜間**
- 集計値: 各時間帯の weatherCode配列・降水確率（max）・降水量（sum）・気温（max/min）・風速（max）。初回は `null` から代入、以降 `Math.max/min`。
- **欠損日判定（[ADR-0026](06-adr.md)）:** `temperature_2m_max` または `min` が `null` → `isPlaceholder=true`（気温は0で埋めるが表示側で「—」）。
- past/future 分割: JST 現在日 `todayJst` を UTC+9 から算出し、`date < todayJst` → `pastDaily`、`>= todayJst` → `daily`。
- hourly は `slice(0, 20+240)`（過去20h＋今日から10日）に絞って返す（集計は全384hで実施済み）。

**検証観点:** 夜間0-3時が前日夜間に入るか／末尾日null時に`isPlaceholder`が立つか／past/futureの境界日。

### A-2. `api/weather.ts` — 年実績取得・整形（`fetchWeatherData`）
**責務:** Archive から1年分の日別実績＋累積を作る（空くらべ）。

**分岐・判断ロジック:**
- メモリキャッシュ: キー `${lat},${lon},${year}` がヒットすれば即返す。
- **モデル選択:** `year >= 2016` → `jma_msm`、∴ `era5_land`。
- **終了日:** 当年（`year === currentYear`）→ 昨日、∴ `${year}-12-31`。
- 日別ループ: `temperature_2m_mean` が `null` の日は **スキップ**（欠測日を累積に混ぜない）。他項目は配列不在時 0。
- 累積: 降水/日射/日照を先頭から加算。日照は秒→時（`/3600`）。
- 境界月平均: 前年12月は常に取得、翌年1月は `year+1 <= currentYear` のときのみ（未来年は取得しない・[ADR](06-adr.md)）。取得失敗（`!res.ok`・空配列・例外）は `null`。

**検証観点:** 2016年境でモデルが切り替わるか／当年で終了日が昨日になるか／欠測日が累積に混入しないか。

### A-3. `api/historicalForecast.ts` — 過去10日取得・整形（`fetchHistoricalForecast`）
**責務:** 開始日に応じてデータ源を切替え、10日分を整形（空しらべ）。

**分岐・判断ロジック（3段階）:**
- 取得実施は `startDate <= yesterday` のときのみ（未来開始は API を叩かない）。
- **段階選択:**
  - `startDate >= today-14`（`forecastCutoff`）→ Forecast API（完全データ）
  - `2022-01-01 <= startDate < today-14` → Historical Forecast API（完全データ）
  - `startDate < 2022-01-01` → Archive API ＋ `ecmwf_ifs`（CAPE可・0℃層高度9999固定・降水確率/UV不在）
- API終了日 `apiEndDate` = `min(startDate+9, yesterday)`。
- 10日配列構築: 各日について `date >= today` → プレースホルダー、∴ API結果に該当日があればそれ、無ければプレースホルダー。
- `availability`: `hasValues()` で各項目（降水確率/0℃層高度/UV/CAPE）の実在を判定（値0からの推測はしない＝誤非表示防止）。

**検証観点:** today-14 と 2022-01-01 の各境界で正しい API が選ばれるか／段階3で availability が降水確率=false になるか。

### A-4. `api/jmaWarning.ts` — 警報取得・整形（`fetchJmaWarnings`）
**責務:** r8 JSON から対象エリアの有効な注意報・警報を抽出。

**分岐・判断ロジック:**
- 取得失敗（`!res.ok`）→ throw。
- 各エントリ: `entry.warning` 無し → スキップ。`class20Items` から `areaCode === jmaAreaCode` を検索、無ければスキップ。
- **status フィルタ:** `解除` / `発表警報・注意報はなし` → 除外。`発表`/`継続`/`更新` 以外も除外。
- プロパティ: `type` に「危険度」を含む `dangerProp` と `significancyPart` を持つ `sigProp` の両方が必要（欠ければスキップ）。
- 現象名: `R8_PHENOMENON[type]` に無ければスキップ。
- **レベル判定（先頭桁）:** 5→特別警報(`special`)、4→危険警報(`warning`)、3→警報(`warning`)、2→注意報(`advisory`)、他→スキップ。
- 名称 = 基底名（level別に special/warn/adv を選択）＋サフィックス。
- **重複排除:** キー `${type}:${先頭桁}`。最初に出現したものを優先。
- 最終 `items` は `level !== 'none'` のみ。代表 `reportDatetime` は全エントリの最大（sort→reverse）。

**検証観点:** 継続警報が残るか／解除が除外されるか／同一現象・同レベルの重複が1件化されるか／北海道等でも取得できるか（prefCode）。

### A-5. `api/aiComment.ts` / `api/me.ts`（クライアント）
**分岐・判断ロジック:**
- `authHeaders`: `auth.currentUser?.getIdToken()` が取れれば `Authorization: Bearer` を付与、無ければ付けない。
- `!res.ok` → throw。**Content-Type が `application/json` を含まない → throw**（vite dev で Function 未稼働時に SPA の HTML が返るケースをエラー化し、呼び出し側で握り潰させる）。
- `me.ts` の `fetchAiAllowed`: token 無し→`false`、`!res.ok`/非JSON/例外→すべて **`false`（安全側）**、`data.aiAllowed === true` のみ true。

**検証観点:** 未ログインで false／dev環境（Function無し）でAIが静かに無効化されるか。

---

## B. ドメイン / ユーティリティ層

### B-1. `lib/wmoSeverity.ts` — 天気コード判定
**分岐・判断ロジック:**
- `wmoSeverity(code)`: `WMO_SEVERITY` マップ（26段階）を引く。未定義は **0**。
- `worstCode(a,b)`: `wmoSeverity(a) >= wmoSeverity(b)` なら a、∴ b。
- `modeCode(codes)`: 空→`null`。頻度Mapを作り、`count > maxFreq`、**同数なら深刻度が高い方**を採用（タイブレーク）。
- `selectCode(codes, mode)`: 空→`null`。`severity`→最大深刻度の reduce、`frequency`→`modeCode`。

**検証観点:** ブロック横断（例 code65 vs 71）で深刻度比較が正しいか／頻度同数タイで深刻度優先か。

### B-2. `lib/jmaAreaResolver.ts` — エリア解決
**分岐・判断ロジック:**
- `resolveJmaAreaCode`: GSI `!res.ok`→throw。`muniCd` 無し→`null`。`areaLookup[muniCd]` 無し→`null`。
- `prefCodeFromAreaCode`: ①`AREA_TO_PREF[areaCode]` があればそれ（北海道/鹿児島/沖縄の気象台別）→ ②先頭2桁 `46`→`460100`、`47`→`471000` → ∴ `${先頭2桁}0000`。

**検証観点:** 北海道（例011000）・鹿児島本土（460100）・沖縄本島（471000）が正しい prefCode になるか／通常県で `{pref2}0000` か。

### B-3. `lib/aiCommentInput.ts` — AI入力生成・ハッシュ
**分岐・判断ロジック:**
- **4時間バケット丸め（[ADR-0015](06-adr.md)）:** `bucketStartMs(now)` = JST基準で 0/4/8/12/16/20時境界に切り下げ。以後の `now`・hourly窓開始をこれ基準にし、同一バケット内でハッシュを固定。
- hourly フィルタ: `Date.parse(time+"+09:00") >= nowMs` の未来分のみ。標準=2時間おき（`i%2===0`）×36件、カスタム=1時間おき×72件。
- past_daily/daily: `!isPlaceholder` で除外→ `slice(-7)` / `slice(0,9)`。数値は用途別に丸め（気温=整数、日射/日照/風速=小数1桁）。
- 警報名 = `name + LEVEL_SUFFIX[level]`。
- ハッシュ: `djb2(JSON.stringify(input))`。カスタムは `${inputHash}-${promptHash}`。

**検証観点:** 同一4hバケット内でハッシュ不変か／予報値更新でハッシュが変わるか／プレースホルダー日が入力に混じらないか。

### B-4. `lib/aiCommentCache.ts` — AIキャッシュ
**分岐・判断ロジック:**
- 読み: ドキュメント無し→`null`。`Date.now() - cachedAt > 4h` → `null`（TTL失効）。各フィールドは型チェックして文字列化。
- パス: 標準=`aiComments/{hash}`、カスタム=`aiComments/c:{hash}`（接頭辞で分離）。

**検証観点:** 4h経過で null（再生成）になるか／標準とカスタムが衝突しないか。

### B-5. `lib/weatherFetch.ts` — フェッチ＋エラー分類
**分岐・判断ロジック:**
- `fetch` が reject → `navigator.onLine === false` なら `offline`、∴ `upstream`（オンラインなのに到達不能はグレーだが取得元側に寄せる）。
- `!res.ok`: `status >= 500 || status === 429` → `upstream`、∴ `data`。
- 各 kind に固定の日本語メッセージ。

**検証観点:** オフライン端末で offline 文言／5xx・429 で upstream 文言／4xx で汎用文言。

### B-6. `lib/warningGantt.ts` — ガント配置
**分岐・判断ロジック:**
- `startMs` 未定義の警報を除外し、`startMs` 昇順ソート。
- グリーディ配置: 各警報を「`start >= lane.tail` の既存レーン」に入れる。無ければ新レーン。**r8 は終了時刻なし → `tail=Infinity`**（各レーンは以降を占有）。
- 配色 `GANTT_COLOR[level]`（注意報=橙/警報=赤/特別警報=ピンク）。

**検証観点:** 重なる警報が別レーンになるか／終了時刻なしでレーンが最後まで占有されるか。

### B-7. `lib/userRepository.ts` — 設定CRUD
**分岐・判断ロジック:**
- `ensureUserDocument`: `getDoc`→`exists()` が false のときだけ `setDoc({createdAt})`（[ADR-0022](06-adr.md)。毎回setDoc禁止＝並行getDocへの部分スナップショット競合回避）。
- `getUserSettings`（前方互換マイグレーション）:
  - 各既定は `data?.x ?? DEFAULT`。オブジェクト系（accumStartDates等）は `{...DEFAULT, ...(data ?? {})}` で新キー補完。
  - `enabledJmaGroups`/`enabledAiSections`: 保存済みに **新規デフォルトを差分追加**（`DEFAULT.filter(未保有)`）、未保存なら全デフォルト。
  - `aiCustomPrompt`: 文字列ならそれ、∴ `DEFAULT_AI_CUSTOM_PROMPT`。
  - `weatherCodeMode`: `'frequency'` のときだけ frequency、∴ `severity`。
- 更新系はすべて `setDoc(..., {merge:true})`。

**検証観点:** 新グループ追加時に既存ユーザーへ自動追加されるか／`weatherCodeMode` 未知値が severity に倒れるか。

### B-8. `lib/dateUtils.ts` / `lib/geo.ts` / `lib/analytics.ts` / `lib/firebase.ts` / `lib/locationRepository.ts`
| モジュール | 主要な分岐・判断 | 検証観点 |
|-----------|------------------|----------|
| `dateUtils.addDays` | `Date.UTC(y,m-1,d+n)` で計算（ローカル解釈＋toISOStringは禁止・[ADR-0011](06-adr.md)）。分岐なし・純関数 | 月跨ぎ・年跨ぎ・負数でズレないか |
| `geo.ts` | `getGeoErrorMessage`: `PERMISSION_DENIED`/`TIMEOUT`/∴ の3分岐。`GEO_SUPPORTED` は navigator 有無 | 各GPSエラーの文言 |
| `analytics.ts` | `VITE_FIREBASE_MEASUREMENT_ID` 無し／`isSupported()` false → `analytics=null` で全て no-op。`logWeatherView` は `weatherViewLogged` フラグで1回のみ | ID未設定でno-op／weather_viewが1回のみ |
| `firebase.ts` | 分岐なし（`VITE_*` から初期化） | env欠落時の挙動 |
| `locationRepository.ts` | 分岐なし（Firestore CRUD の薄いラッパー） | ― |

---

## C. 状態層

### C-1. `store.ts` — Zustand ストア
**分岐・判断ロジック:**
- `guestMode` 初期値: `localStorage.getItem('guestMode') === '1'`（localStorage不可環境は try/catch で無視）。
- `addLocation`: uid 無し→中断。**上限 = `aiAllowed ? 50 : 10`**、`locations.length >= limit` で例外 throw。
- 各 update系: uid 無し→中断 → `await リモート更新` → ローカル state 更新。
- `updateWeatherCodeMode` のみ **楽観更新**（先に state 更新、リモートは best-effort `.catch`）＝切替の即時性優先。
- `resetUserData`: locations/userSettings/aiAllowed をクリア（ログアウト時の残留防止）。

**検証観点:** 上限超過で例外／ログアウトで前ユーザーデータ消去／モード切替の即時反映。

---

## D. フック層

### D-1. `useForecast` / `useHistoricalForecast`
**分岐・判断ロジック（共通パターン）:**
- lat/lon（+startDate）が null → data=null で中断。
- キャッシュ: `useForecast` TTL30分（キー`lat,lon`・モード非依存）、`useHistoricalForecast` TTL60分（過去不変のため長め）。ヒット時は即セット。
- **stale制御:** `activeKey.current !== key` の応答は破棄（地点連打時の古い応答無視）。
- `useForecast` は `inflightRef` で多重発火中の loading を管理し、`refresh(force)` でキャッシュ無視再取得。

**検証観点:** 地点連打で古い応答が表示に残らないか／TTL内でAPIを叩かないか。

### D-2. `useJmaWarning`
**分岐・判断ロジック:**
- `jmaAreaCode` 無し → data=null・error=null で中断。
- `prefCodeFromAreaCode` で prefCode 解決。キャッシュ TTL30分（キー=jmaAreaCode）。
- `visibilitychange` で `visible` 復帰時に再取得（stale なら）。
- `isMounted` ガードで unmount 後の setState を防止。

**検証観点:** コード未解決地点でスキップ／フォアグラウンド復帰で更新。

### D-3. `useAiComment` / `useAiCustomComment`
**分岐・判断ロジック（無限ループ防止が核心・[ADR](06-adr.md)）:**
- **有効条件:** `useAiComment`=uid && locationName && forecast、`useAiCustomComment`=さらに `customPrompt.trim().length > 0`。
- input/hash は**本体で毎レンダー純粋計算**（安価）。effect 依存は **`[uid, hash]` のプリミティブのみ**（input は参照不安定なので `inputRef` 経由で読む）。→ 参照が毎レンダー変わっても hash 不変なら effect 再発火しない。
- run 内: ①キャッシュ read（失敗は無視して続行）→ ヒットなら setComment＋`setLoading(false)`（地点切替でfetch中→切替先ヒットのケースで loading 残留を確実に解消）→ ②ミスなら Function 呼出 → ③成功時 setComment＋書き戻し（失敗は warn のみ）。
- **`cancelled` フラグ:** cleanup で true。以降の setState を全て抑止（stale応答の混入防止）。
- エラー時: `useAiComment` は error セット、`useAiCustomComment` は**静かに失敗（カード非表示）**。

**検証観点:** 警報配列の再生成で無限ループしないか／地点切替でloadingが残らないか／未許可（uid無し）でcomment=null。

### D-4. `useWeatherData`（空くらべ）
**分岐・判断ロジック:**
- targets 空 → data クリア。
- **geo変化検知:** `geoLocation` の座標キーが変わったら、`fetchedSpecs` から `__geo__` エントリを削除して再取得を促す。
- **差分フェッチ:** 前回仕様（locationId/year）と異なる target だけ取得（`Promise.all`）。全一致なら何もしない。
- 地点解決: `__geo__`→store geoLocation、∴ locations 検索。見つからない（削除済み）→ 空 daily の WeatherData を返す（警告ログ）。
- setData: 現行 target id のものだけ残し（削除分を除去）、新規/更新分を上書き。
- 依存に `JSON.stringify(targets)` を使い参照比較を安定化。

**検証観点:** 選択変更した target だけ再取得されるか／geo更新で__geo__が再取得されるか／削除地点で落ちないか。

---

## E. サーバー層（functions/api）

### E-1. `_auth.ts` — 認可基盤
**分岐・判断ロジック:**
- `getCerts`: `certCache.expiresAt > now` ならキャッシュ、∴ 取得。`Cache-Control: max-age` を尊重（無ければ3600秒）。
- `verifyIdToken`: header に `kid` 無し→throw。証明書に該当 kid 無し→throw。`jose.jwtVerify`（`issuer=securetoken.google.com/{projectId}`・`audience=projectId`）。`sub` 無し→throw。※`email_verified` は検査しない（許可名簿が手動明示メールのため十分）。
- `isAllowlisted`: email/allowlist いずれか無し→`false`。カンマ分割・trim・小文字化して包含判定。
- `requireAiAccess`: token 無し→**401**。検証例外→**401**。名簿外→**403**。許可→`null`。

**検証観点:** 無トークンで401／改竄トークンで401／名簿外メールで403／許可メールで通過。

### E-2. `ai-comment.ts` — 標準AIプロキシ
**分岐・判断ロジック:**
- メソッド `!= POST` → **405**。`requireAiAccess` 拒否→その Response。`GEMINI_API_KEY` 無し→**500**。body JSON パース失敗→**400**。
- `responseSchema`（4フィールド `minLength:200`・required）、`thinkingBudget:1024`、`temperature:0.6`。
- Gemini 応答: `!ok`→`gemini_http:{status}` を throw。parts から `!p.thought` の text を取り出し（無ければ `gemini_empty`）、`JSON.parse`（途中切れは SyntaxError）。
- **リトライ:** 最大3回。ただし `gemini_http:4`（4xx）で始まるエラーは即中断（リトライ無効）。全滅→**502**。

**検証観点:** GET で405／未設定キーで500／不正bodyで400／Gemini 4xxで即502（リトライしない）。

### E-3. `ai-custom.ts` — カスタムAIプロキシ
**分岐・判断ロジック:** メソッド/認可/キー/body は E-2 同様。プレーンテキスト応答。**ガードレール（プロンプト内）:** 農業・気象以外→定型拒否文、プロンプトインジェクション→定型拒否文、過剰長要求（>400字）→無視して400字以内、気象値はデータ厳守／農学一般知識は可（[ADR-0016](06-adr.md)）。

**検証観点:** 領域外質問で定型文／インジェクションで定型文／長文要求でも400字以内。

### E-4. `me.ts` / `archive.ts`
- `me.ts`: token 無し→401、検証例外→401、成功→`{aiAllowed}`（200）。
- `archive.ts`: archive-api へ透過。例外→502。`Cache-Control: max-age=3600`。**通常未使用**（`weather.ts` が直URLを指す限り呼ばれない）。

---

## F. 画面層 — 判断が濃いもの

### F-1. `App.tsx` — 全体統括・分析タブ
**認証・現在地ライフサイクルの分岐:**
- `onAuthStateChanged`: user あり→`setGuestMode(false)` → **直列** `await ensureUserDocument` → `Promise.all([loadLocations, loadUserSettings, loadAiAllowed])`（[ADR-0022](06-adr.md) の競合回避）。例外は console.error に留め、最後に必ず `setAuthLoading(false)`（起動フリーズ防止）。user なし→`resetUserData()`。
- 分析初期化（1回・`analysisInitializedRef`）: 有効な `defaultLocationId` があればそれ、∴ `__geo__` を target[0] に設定。
- 現在地自動取得（1回・`geoAttemptedRef`）: `authLoading` 中は待つ。有効デフォルトがあれば取得しない。geolocation 非対応→`geoStatus='error'`。取得成功→`__geo__` 設定＋`idle`、失敗→`error`。
- 地点削除の自動復旧: target が掴む locationId が locations に無ければ、有効デフォルト or 先頭地点にフォールバック（`__geo__` は対象外）。
- geo取得後、`locationId===''` の target を `__geo__` に置換。
- `handleRangeChange`: `startMM > endMM` になる変更は破棄。
- 表示条件: 未ログイン かつ 非ゲスト→`LandingPage`。`weather_view` は `logWeatherView`（セッション1回）で計測。

**分析チャート構築（`useMemo` 群）の分岐:**
- 予報オーバーレイは `!isMonthly && forecastData && targets[0].year===currentYear` のときのみ。
- 各予報ループで **`if (fDay.isPlaceholder) return;`**（欠損日を0で描かない・[ADR-0026](06-adr.md)）。
- 月次15日=当月平均、1日=前月と当月の中間値をプロット。
- Δ日逆引き: 比較年（targets[1]）系列で「上段（targets[0]）の現在値に達した日」を `findDateByAccum` で検索。GDD閾値30・日射100 未満は Δ表示を抑制。

**検証観点:** 認証失敗で無限ローディングにならないか／欠損日がグラフに0で出ないか／地点削除で分析が落ちないか。

### F-2. `weather/WeatherTab.tsx` — 空もよう統括
**分岐・判断ロジック:**
- 地点解決: `selectedLocationId==='__geo__'`→geoLocation、∴ `locations.find(id) ?? geoLocation ?? locations[0] ?? null`。
- 初期選択: 有効 `defaultLocationId` があればそれ、∴ geoLocation あれば `__geo__`。
- 空状態: locations 0件かつ geo 無し→`geoStatus` が loading/idle なら「取得中」、∴「取得できませんでした」。
- 警報フィルタ: `level==='special'`→常時表示、`warningNameToGroup(name)` が null（未分類）or 有効グループ集合に含む→表示。
- AI 有効判定: 標準AI=`aiAllowed ? uid : null`（未許可は Coming Soon カード）。カスタム=`aiAllowed && customEnabled` かつ関連引数を渡す。
- 半日クリック: period→時刻（am=04/pm=12/night=20）へ scrollTarget 設定＋スクロール。

**検証観点:** 未許可でComingSoon／特別警報が設定に関わらず出るか／地点フォールバック順序。

### F-3. `weather/DailyForecast.tsx` — 日別予報
**分岐・判断ロジック:**
- 全描画ループで `if (day.isPlaceholder)` → 気温・アイコン・降水を描かず「—」。日付行も placeholder は気温非表示。
- `probColor(p)`: `p>=70`→濃青、`p>=40`→水色、∴ 淡色。
- ミニチャート: `validTemps` は placeholder 除外＋各期間の非null値のみ。降水は `amPrecipSum !== null`（時間別あり）なら午前/午後/夜間の3バー、∴ 日合計1バー。`bh===0` は非描画。温度線は先頭/末尾を端に anchor。
- パン/タップ分離（モバイル）: mousedown で startX 記録、mousemove で移動量が **閾値5px超**→ドラッグ（hover抑制・viewportシフト）、5px以下で離す→タップ（hover更新）。日次のみ90日ウィンドウをスライド。
- `dayBorder(i)`: 最終日以外に右罫線。
- 警報ガント: `computeWarningLanes` でレーン化し `WarningBar` を配置。列は各日を3分割（am 04-12/pm 12-20/night 20-翌04）した `startMs/endMs`。

**検証観点:** placeholder日が「—」か／降水が時間別ありなら3分割・なしなら1本か／5pxでドラッグ/タップが分離するか。

### F-4. `weather/HourlyTable.tsx` — 時間別予報表
**分岐・判断ロジック:**
- 固定列幅（`table-layout:fixed`＋colgroup、COL_W=42px、LABEL_W=76px）。SVGミニグラフは1:1座標。
- 夜間判定 `isNighttime`: daily の sunrise/sunset イベントを時刻順に並べ、直前イベントが sunset なら夜。
- 過去時間フェード: 1時間前カットオフより前は `opacity:0.35`（`disablePastOpacity` で無効化＝履歴タブ）。
- 降水体感ラベル `precipToLabel`（HTMLオーバーレイ・列幅クリップ）: ~0.5=ぽつぽつ / 0.5–1.0=カッパ？ / 1.0–3=カッパ！ / 3–10=本降り / 10–20=ザーザー / 20–30=土砂降り / 30–50=激しい雨 / 50–80=滝のよう / 80–=猛烈（[ADR/現場基準](06-adr.md)）。
- 降水数値: `0`→'0.0'、非ゼロは最低0.1mmに切上げ（`Math.ceil(x*10)/10`）＝雨アイコンとの矛盾回避。
- 降雪行: 期間内降雪>0 のときだけ表示。UV行: 夜間は空セル。
- 初期スクロール: 天気タブ=現在時刻付近、履歴タブ=左端固定。
- 警報ガント行を内包。

**検証観点:** sunset後が夜判定か／0.03mmが0.1mm表示か／降雪ゼロで行非表示か／夜間UVが空か。

### F-5. `weather/WeatherIcon.tsx` — 天気アイコン
**分岐・判断ロジック:** `codeToIconFile(code, isNight)` が WMO コードを Meteocons ファイル名へ写像（コード3・53/55・65・75/77 等は昼夜共通、他は `-day/-night`）。未定義→`not-available`。`animated` で `/icons/weather`（アニメ）か `/icons/weather-static`（静的）を選択。`codeToLabel`/`codeToShortLabel`/`dayTransitionLabel`（午前と午後が同一なら1語、異なれば「AのちB」）。

**検証観点:** 夜コードで night アイコン／未定義コードで not-available／午前午後同一で「のち」を出さない。

### F-6. `weather/HistoricalWeatherTab.tsx` — 空しらべ
**分岐・判断ロジック:** 期間指定→`useHistoricalForecast`。`availability` で不在項目（降水確率/0℃層高度/UV等）の行を非表示（`hiddenRowKeys`）。日別/時間別の切替。天気コードモード（severity/frequency）を共有。

**検証観点:** 2022年前の期間で降水確率行が消えるか。

### F-7. `settings/LocationSettings.tsx` / `LocationMapModal.tsx`
**分岐・判断ロジック:**
- 追加経路3種（現在地/地図/手動）。上限は store の `addLocation` で強制（超過で例外→UIエラー）。
- `LocationMapModal` の `autoLocate`（既定true）: **編集時（`editingId!=='new'`）は false** で登録座標を維持、新規/ヘッダー選択は true で GPS 追従（[修正済みバグ](06-adr.md)）。
- 地図クリックで座標選択→GSI逆ジオで地名候補。

**検証観点:** 既存地点の「地図で修正」で現在地に飛ばないか／上限超過でエラー表示。

### F-8. `components/DailyRawTable.tsx`
**分岐・判断ロジック:** 全指標×日数の表。**CSV出力は `aiAllowed` のときのみ実行可**、未許可はロックボタン（押下不可）。CSVは UTF-8 BOM 付き（Excel/Safari対応）。

**検証観点:** 未許可でCSVボタンがロック／出力ファイルがExcelで文字化けしないか。

---

## G. 画面層 — presentational（判断が乏しいモジュール）
主に表示・整形で、分岐は表示条件程度。

| モジュール | 主な分岐・判断 | 検証観点 |
|-----------|----------------|----------|
| `main.tsx` | なし（ルート描画） | 起動するか |
| `components/LandingPage.tsx` | ゲスト/ログイン導線、比較表の記号（◎/○/△/✗）。`login`/`guest_start` 発火 | 導線イベントが撃たれるか |
| `components/LoginScreen.tsx` | iOS→redirect / 他→popup の分岐 | iOSでredirect認証 |
| `components/HelpPage.tsx` | 開く前タブの記憶と復帰 | 戻り先が正しいか |
| `components/Footer.tsx` | リンクのみ | ― |
| `components/MonthsTable.tsx` | 月別集計の整形（旧UI） | ― |
| `settings/SettingsTab.tsx` | 4サブタブ切替、モバイルのみアカウント欄 | モバイルでログアウト可 |
| `settings/JmaWarningSettings.tsx` | グループON/OFFトグル、デフォルト地点選択、説明文表示 | トグルが保存されるか |
| `settings/AiCommentSettings.tsx` | セクション選択・プロンプト入力。**未許可は操作不可** | 未許可で操作不可か |
| `settings/AnalysisSettings.tsx` | 基準温度・累積開始日・Δ閾値の入力・保存 | 保存が反映されるか |
| `weather/JmaWarningSummary.tsx` | ロード中かつ未取得は非表示。発表/継続/更新のバッジ分岐 | 継続で時刻を出さないか |
| `weather/WarningBar.tsx` | 幅は割合%文字列（CSS委譲） | 12hまで正しく伸びるか |
| `weather/AiCommentCard.tsx` | 有効セクションのタブ表示、ローディング分岐 | 有効セクションのみ表示 |
| `weather/AiComingSoonCard.tsx` | 静的カード | ― |
| `weather/WeatherLoader.tsx` | アニメーションのみ | ― |

---

## 更新履歴
| 日付 | リビジョン | 変更 |
|------|-----------|------|
| 2026-07-10 | `6512b83` | 初版（全モジュールの分岐・判断ロジックを網羅） |
