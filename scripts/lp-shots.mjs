// LP 用の画面写真を撮る（開発用）。
// 使い方: 別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動し、
//         `LAT=35.681 LON=139.767 node scripts/lp-shots.mjs` を実行する。出力は screenshots/lp/（git 管理外）。
//         空もようの2枚だけ撮るときは ONLY=moyo を付ける。
// Open-Meteo の利用上限を消費するので、実行回数は絞ること。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5180';
const lat = Number(process.env.LAT ?? 35.681);
const lon = Number(process.env.LON ?? 139.767);
const outDir = join('screenshots', 'lp');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true,
  locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
  permissions: ['geolocation'], geolocation: { latitude: lat, longitude: lon },
});
await context.addInitScript(() => { localStorage.setItem('guestMode', '1'); });
const page = await context.newPage();
const save = async (locator, name) => { await locator.screenshot({ path: join(outDir, `${name}.png`) }); console.log('saved', name); };

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(6000); // 季節のあしどりの集計待ち

  // 1) 空もよう: 「リスクでみる」「概況でみる」の2枚（空に節気・候が写る）
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const [label, name] of [['リスクでみる', 'moyo-risk'], ['概況でみる', 'moyo-gaikyo']]) {
    await page.getByRole('tab', { name: label }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(outDir, `${name}.png`), clip: { x: 0, y: 0, width: 390, height: 844 } });
    console.log('saved', name);
  }
  if (process.env.ONLY === 'moyo') process.exit(0);

  // 2) 季節のあしどりの帯（8秒ごとに項目が替わるので、積算温度が出るまで待つ）
  const strip = page.locator('.season-strip').first();
  await strip.getByText('積算温度', { exact: true }).waitFor({ timeout: 40000 });
  await page.waitForTimeout(1200); // 切り替えの動きが終わるまで
  await save(strip, 'season-band');

  // 3) 節気ふりかえりカード。REVIEW（期間の書き出し。例 "9/7〜"）の節気が出るまで左へ送る
  const reviewStart = process.env.REVIEW ?? '9/7〜';
  await page.locator('.sekki-badge--button').click();
  await page.waitForTimeout(1500);
  const target = page.locator('.season-card').filter({ hasText: reviewStart });
  for (let i = 0; i < 12 && !(await target.isVisible()); i++) {
    await page.getByRole('button', { name: /前/ }).first().click();
    await page.waitForTimeout(900);
  }
  await save(target, 'review-card');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // 4) 空くらべ: 今年と去年を重ねる（固定表示の下のナビが写り込まないよう隠す）
  await page.getByRole('button', { name: '空くらべ' }).first().click();
  await page.addStyleTag({ content: '.shell-bottomnav { display: none !important; }' });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /比較対象を追加/ }).click();
  // 地点・年の select が2行（4つ）並ぶ。2行目の年（4つ目）を去年にする
  await page.locator('select').nth(3).selectOption(String(new Date().getFullYear() - 1));
  await page.getByRole('button', { name: '表示', exact: true }).click();
  await page.waitForTimeout(8000);
  const charts = page.locator('.recharts-responsive-container');
  // グラフはタブ切り替え。表示中のグラフは section.analysis-card--chart
  const card = page.locator('section.analysis-card--chart').filter({ has: charts });
  await save(card, 'kurabe-temp');
  await page.getByRole('tab', { name: '積算温度' }).click();
  await page.waitForTimeout(2500);
  await save(card, 'kurabe-gdd');
} finally {
  await browser.close();
}
