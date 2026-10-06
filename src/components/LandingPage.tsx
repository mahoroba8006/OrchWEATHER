// LP「一日×一年の空」の組み立てとログイン処理。章の中身は src/components/lp/ にある。
import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { logLogin } from '../lib/analytics';
import { SkyScene } from './lp/SkyScene';
import { LpNav, SekkiDial } from './lp/LpNav';
import { LpHero } from './lp/LpHero';
import { HunchChapter } from './lp/HunchChapter';
import { SekkiChapter } from './lp/SekkiChapter';
import { KurabeChapter } from './lp/KurabeChapter';
import { MoyoChapter } from './lp/MoyoChapter';
import { MakerChapter } from './lp/MakerChapter';
import { FinalChapter, LpFooter } from './lp/FinalChapter';

const isIOSStandalone = () =>
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

export function LandingPage({ onTryGuest }: { onTryGuest: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    logLogin();
    try {
      if (isIOSStandalone()) {
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch {
          // fall through to error display
        }
      }
      setError('ログインに失敗しました。もう一度お試しください。');
      setLoading(false);
    }
  };

  const cta = { loading, onLogin: handleLogin, onTryGuest };
  return (
    <div className="lp-root">
      <SkyScene />
      <LpNav loading={loading} onLogin={handleLogin} />
      <SekkiDial />
      <main className="lp-main">
        <LpHero {...cta} error={error} />
        <HunchChapter />
        <SekkiChapter />
        <KurabeChapter />
        <MoyoChapter />
        <MakerChapter />
        <FinalChapter {...cta} />
      </main>
      <LpFooter />
    </div>
  );
}
