// ビルド時に LP を HTML にする入口（scripts/prerender-lp.mjs から Vite の SSR で読み込む）。
// ブラウザでは使わない。firebase と analytics は prerender-lp.mjs で ./stubs の空の差し替えになる。
import { renderToString } from 'react-dom/server';
import { LandingPage } from '../components/LandingPage';

export function renderLp(): string {
  return renderToString(<LandingPage onTryGuest={() => {}} />);
}
