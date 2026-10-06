// LP 用の画面写真を撮る（開発用）。
// 使い方: 別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動し、
//         `LAT=35.681 LON=139.767 node scripts/lp-shots.mjs` を実行する。出力は screenshots/lp/（git 管理外）。
//         空もようの2枚だけ撮るときは ONLY=moyo、時間別の表と空くらべだけは ONLY=extra を付ける。
//         空くらべは TEMP_DAY（既定 9/20）・GDD_DAY（既定 10/5）の日付に指を置いた状態で撮る。
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
// ONLY=moyo: 空もようの2枚だけ／ONLY=extra: 空もようの時間別と空くらべ（値を表示した状態）だけ
const only = process.env.ONLY;
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
  if (only === 'moyo') process.exit(0);

  // 1b) 空もようの時間別の表（午前の天気・気温・降水・風などが並ぶ範囲）
  const hourlyTable = page.locator('td.hourly-label', { hasText: '時刻' }).first().locator('xpath=ancestor::table');
  await hourlyTable.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await save(page.locator('td.hourly-label', { hasText: '時刻' }).first().locator('xpath=ancestor::section[1]'), 'moyo-hourly');

  if (!only) {

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

  }

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
  // グラフ上の日付に指を置いた状態（下の枠にその日の値と差が出る）。枠の日付が day になるまで右へずらし、
  // その位置のまま撮る（要素の撮影は画面を動かして指が外れるため、先に表示位置を決めてから画面を切り抜く）
  // 図と値の枠を合わせると画面の高さを超えるので、この撮影の間だけ画面を縦に伸ばす
  await page.setViewportSize({ width: 390, height: 1600 });
  const shootWithValue = async (day, name) => {
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -40));
    await page.waitForTimeout(500);
    const box = await card.locator('.recharts-surface').first().boundingBox();
    // 枠の表示は指の動きより遅れて変わる。1px ずつ動かして「位置 → 日付」を記録し、
    // day が出た位置の真ん中へ戻して撮る
    const y = box.y + box.height * 0.5;
    const hits = [];
    for (let x = Math.round(box.x + 2); x < box.x + box.width - 2; x += 1) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(40);
      const label = await card.locator('.analysis-value__label').first().textContent({ timeout: 100 }).catch(() => null);
      if (label === day) hits.push(x);
      else if (hits.length) break;
    }
    if (!hits.length) throw new Error(`グラフ上で ${day} が見つからない`);
    // 遅れの分だけ記録は右にずれるので、見つかった範囲の左寄りへ戻す
    await page.mouse.move(Math.max(box.x + 2, hits[0] - 2), y);
    await page.waitForTimeout(800); // 値の枠が広がり終わるまで
    // 念のため、落ち着いた状態で日付を確かめ、ずれていれば左右に少しずつ動かして合わせる
    let shown = await card.locator('.analysis-value__label').first().textContent();
    for (const dx of [-1, -2, -3, -4, 1, 2, 3, 4]) {
      if (shown === day) break;
      await page.mouse.move(hits[0] + dx, y);
      await page.waitForTimeout(400);
      shown = await card.locator('.analysis-value__label').first().textContent();
    }
    if (shown !== day) throw new Error(`枠の日付が ${shown}（${day} のはず）`);
    const c = await card.boundingBox();
    const v = await card.locator('.analysis-value').first().boundingBox();
    await page.screenshot({ path: join(outDir, `${name}.png`), clip: { x: c.x, y: c.y, width: c.width, height: v.y + v.height + 16 - c.y } });
    console.log('saved', name);
  };
  await shootWithValue(process.env.TEMP_DAY ?? '9/20', 'kurabe-temp');
  await page.getByRole('tab', { name: '積算温度' }).click();
  await page.waitForTimeout(2500);
  await shootWithValue(process.env.GDD_DAY ?? '10/5', 'kurabe-gdd');
} finally {
  await browser.close();
}
