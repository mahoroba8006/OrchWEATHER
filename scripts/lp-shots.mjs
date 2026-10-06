// LP 用の画面写真を撮る（開発用）。
// 使い方: 別ターミナルで `npm run dev -- --port 5180 --strictPort` を起動し、
//         `LAT=35.681 LON=139.767 node scripts/lp-shots.mjs` を実行する。出力は screenshots/lp/（git 管理外）。
//         空もようの2枚だけ撮るときは ONLY=moyo、時間別の表と空くらべだけは ONLY=extra、
//         時間別の表をすべての項目・雨の日で2枚に分けて撮るときは ONLY=hourly（RAIN_DAY で日付）を付ける。
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
// HAR=1: 気象データの応答をファイルに記録し、2回目以降はそれを再生する（撮り直しで Open-Meteo の上限を使わない）
if (process.env.HAR) {
  const { existsSync } = await import('node:fs');
  const har = join(outDir, 'open-meteo.har');
  await context.routeFromHAR(har, { url: /open-meteo\.com/, update: !existsSync(har), updateContent: 'embed' });
}
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

  // 1a) 時間別の表（すべての項目・雨の時間帯）。空しらべで RAIN_DAY（既定 2026-09-20、東京で日中に雨）を開き、
  //     RAIN_HOUR 時の列へ横に送って、「作業の行」と「データの行」の2枚に分けて撮る
  if (only === 'hourly') {
    await page.evaluate(() => localStorage.setItem('hiddenHourlyRows', '[]'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: '空しらべ' }).first().click();
    await page.addStyleTag({ content: '.shell-bottomnav { display: none !important; }' });
    await page.waitForTimeout(1500);
    await page.locator('input[type="date"]').fill(process.env.RAIN_DAY ?? '2026-09-20');
    await page.waitForTimeout(8000);
    const label = (txt) => page.locator('td.hourly-label', { hasText: txt }).first();
    const table = label('時刻').locator('xpath=ancestor::table');
    await table.scrollIntoViewIfNeeded();
    // 横に送る入れ物（表の祖先で横にはみ出しているもの）に印を付け、RAIN_HOUR（既定 10）時の列を左端へ送る
    await table.evaluate((t, hour) => {
      let sc = t.parentElement;
      while (sc && !['auto', 'scroll'].includes(getComputedStyle(sc).overflowX)) sc = sc.parentElement;
      sc.setAttribute('data-shot-scroller', '');
      const timeRow = [...t.querySelectorAll('tr')].find((r) => r.querySelector('td.hourly-label')?.textContent === '時刻');
      const cell = [...timeRow.querySelectorAll('td:not(.hourly-label)')].find((c) => c.textContent.trim() === hour);
      sc.scrollLeft = cell.offsetLeft - timeRow.querySelector('td.hourly-label').offsetWidth;
    }, process.env.RAIN_HOUR ?? '10');
    console.log('widths', await table.evaluate((t) => { const out = []; for (let e = t; e && out.length < 8; e = e.parentElement) out.push(`${e.tagName}.${(e.className || '').toString().slice(0, 24)} cw=${e.clientWidth} sw=${e.scrollWidth} ox=${getComputedStyle(e).overflowX}`); return out; }));
    await page.waitForTimeout(800);
    const groups = {
      'moyo-hourly-work': ['日付', '時刻', '天気', '気温/降水', '気温', '降水確率', '降水量', '降雪量', '風速', '瞬間風速', '風向き'],
      'moyo-hourly-data': ['日付', '時刻', '紫外線指数', '気圧', '湿度', '飽差', '露点', 'CAPE', '0℃層高度'],
    };
    for (const [name, keep] of Object.entries(groups)) {
      await table.evaluate((t, keep) => {
        for (const r of t.querySelectorAll('tr')) {
          const l = r.querySelector('td.hourly-label')?.textContent ?? '';
          r.style.display = keep.some((k) => l === k || (l.startsWith(k) && !keep.some((o) => o.length > k.length && l.startsWith(o)))) ? '' : 'none';
        }
      }, keep);
      await page.waitForTimeout(500);
      await page.locator('[data-shot-scroller]').screenshot({ path: join(outDir, `${name}.png`) });
      console.log('saved', name);
    }
    process.exit(0);
  }

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
