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
