// デザイン検証用: ゲストモードで主要タブを撮影する。
// 使い方: 別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動しておき、
//         `npm run screenshots -- <出力ディレクトリ名>` を実行する。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5180';
const outDir = join('screenshots', process.argv[2] ?? 'current');

const viewports = [
  { name: 'mobile', viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true },
  { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: false },
];
const tabs = ['空もよう', '空くらべ', '空しらべ'];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: vp.viewport,
      deviceScaleFactor: vp.deviceScaleFactor,
      hasTouch: vp.hasTouch,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });
    await context.addInitScript(() => {
      window.localStorage.setItem('guestMode', '1');
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    for (const [i, label] of tabs.entries()) {
      await page.getByRole('button', { name: label }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500); // 描画・アニメーション完了待ち
      const file = join(outDir, `${vp.name}-${i + 1}-${label}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`saved ${file}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
