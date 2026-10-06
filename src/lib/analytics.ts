// アプリ全体の計測窓口。
// measurementId 未設定（ローカル開発）や非対応ブラウザでは no-op になり、
// 計測の失敗がアプリ本体の動作を妨げないようにする（fire-and-forget で良い唯一の例外）。
import { getAnalytics, logEvent, isSupported, type Analytics } from 'firebase/analytics';
import { app } from './firebase';

let analytics: Analytics | null = null;

// 初期化は非同期（isSupported）。measurementId が無ければ初期化しない。
if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
  isSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(() => {
      // 計測の初期化失敗は握りつぶす（アプリ本体に影響させない）
    });
}

function track(name: string, params?: Record<string, unknown>): void {
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch {
    // 計測失敗は無視
  }
}

/** Google ログイン操作の発生。GA4 予約イベント名 'login' を使う。 */
export function logLogin(): void {
  track('login', { method: 'google' });
}

/** 「ログインせずに試す」= ゲスト試用の開始。 */
export function logGuestStart(): void {
  track('guest_start');
}

// weather_view はセッション中に一度だけ撃つ（自動更新・再フェッチで膨らませない）。
let weatherViewLogged = false;
/** コア機能（天気データ表示）への到達。1セッション1回のみ実発火。 */
export function logWeatherView(): void {
  if (weatherViewLogged) return;
  weatherViewLogged = true;
  track('weather_view');
}

// season_card_view はセッション中に一度だけ撃つ（タブ往復・帯下とシートの両方で膨らませない）。
let seasonCardViewLogged = false;
/** 節気ふりかえりカード本体が画面に入った。1セッション1回のみ実発火。source は最初に見た場所。 */
export function logSeasonCardView(source: 'inline' | 'sheet'): void {
  if (seasonCardViewLogged) return;
  seasonCardViewLogged = true;
  track('season_card_view', { source });
}

/** 描画エラー（真っ白になる代わりにエラー画面を出したとき・補助機能を隠したとき）。原因を遠隔で知るため */
export function logAppError(where: string, error: Error | null): void {
  track('app_error', { where, message: `${error?.name ?? 'Error'}: ${error?.message ?? ''}`.slice(0, 100) });
}

/** ヒーローの節気名からふりかえりカードを開いた。 */
export function logSeasonCardOpen(): void {
  track('season_card_open');
}

// season_card_browse は「何節気前まで遡ったか」ごとに1セッション1回（スワイプで膨らませない）。
const seasonCardBrowseLogged = new Set<number>();
/** ふりかえりカードを左右にめくって古い節気を見た。back = 最新から何節気前か（1以上）。 */
export function logSeasonCardBrowse(back: number): void {
  if (seasonCardBrowseLogged.has(back)) return;
  seasonCardBrowseLogged.add(back);
  track('season_card_browse', { back });
}

/** LP の「詳しく読む」折りたたみを開いた。どの詳細が読まれているかを見る（section: features / compare / maker / faq） */
export function logLpDetailOpen(section: string): void {
  track('lp_detail_open', { section });
}

/** LP の各章が画面に入った（どこまで読まれたか）。章ごとに1回だけ送る */
export function logLpChapterView(chapter: string): void {
  track('lp_chapter_view', { chapter });
}

/** LP の空もようで「リスクでみる／概況でみる」が押された（触れる仕掛けが効いているか） */
export function logLpMoyoToggle(mode: string): void {
  track('lp_moyo_toggle', { mode });
}
