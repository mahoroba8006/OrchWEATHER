/**
 * JMA 警報エリアコード静的テーブル生成スクリプト
 *
 * 出力: src/data/jmaAreaLookup.json
 *   { [muniCd: string]: string | null }
 *   国土地理院 muniCd (5桁) → 気象庁 class20s コード (7桁)
 *
 * 実行: node scripts/build-jma-area-map.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH       = path.resolve(__dirname, '../src/data/jmaAreaLookup.json');
const OUT_NAMES_PATH = path.resolve(__dirname, '../src/data/jmaAreaNames.json');

// ─────────────────────────────────────────────────────────────────────────────
// 1. 気象庁 area.json 取得
// ─────────────────────────────────────────────────────────────────────────────
console.log('[1/4] 気象庁 area.json を取得中...');
const areaRes = await fetch('https://www.jma.go.jp/bosai/common/const/area.json');
if (!areaRes.ok) throw new Error(`area.json fetch failed: ${areaRes.status}`);
const areaJson = await areaRes.json();

/** @type {Record<string, { name: string; parent: string }>} */
const class20s = areaJson.class20s ?? {};

console.log(`  class20s: ${Object.keys(class20s).length} 件`);

// class20s の名称 → コード 逆引きマップ（全角スペース除去済み）
const nameToCode20 = /** @type {Record<string, string>} */ ({});
for (const [code, info] of Object.entries(class20s)) {
  const normalized = info.name.replace(/\s/g, '');
  nameToCode20[normalized] = code;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 国土地理院 muni.js 取得
// ─────────────────────────────────────────────────────────────────────────────
console.log('[2/4] 国土地理院 muni.js を取得中...');
const muniRes = await fetch('https://maps.gsi.go.jp/js/muni.js');
if (!muniRes.ok) throw new Error(`muni.js fetch failed: ${muniRes.status}`);
const muniText = await muniRes.text();

// フォーマット: GSI.MUNI_ARRAY["1101"] = '1,北海道,1101,札幌市　中央区';
// muniCd (5桁, 例 "01101") → parseInt で "1101" に変換してキーに合わせる
const muniData = /** @type {Map<string, string>} */ (new Map());
const muniRe = /MUNI_ARRAY\["(\d+)"\]\s*=\s*'([^']+)'/g;
let m;
while ((m = muniRe.exec(muniText)) !== null) {
  const key = m[1];                      // 例: "1101", "13101"
  const parts = m[2].split(',');         // ['1','北海道','1101','札幌市　中央区']
  if (parts.length < 4) continue;
  const cityName = parts.slice(3).join(',').replace(/\s/g, '');  // 全角スペース除去
  muniData.set(key, cityName);
}
console.log(`  市区町村: ${muniData.size} 件`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. muniCd → jmaAreaCode の対応表を構築
// ─────────────────────────────────────────────────────────────────────────────
console.log('[3/4] マッピングテーブルを構築中...');

/**
 * 名称正規化: スペース・ヶ/ケ 等の表記ゆれを統一
 * @param {string} s
 */
const normalizeStr = (s) =>
  s.replace(/\s/g, '').replace(/ヶ/g, 'ケ').replace(/ヵ/g, 'カ');

// nameToCode20 のキーも正規化し直す
for (const [code, info] of Object.entries(class20s)) {
  nameToCode20[normalizeStr(info.name)] = code;
}

/**
 * 自動解決が難しいケースの手動マッピング
 * (muniCd → jmaAreaCode)
 *
 * 政令指定都市の区は area.json で「○○市東部/西部/南部/北部」に集約されている。
 * 各区がどの区域に属するかを地理的に割り当てた。
 * 北方領土（01695-01700）は気象庁の対象外のため null。
 */
const MANUAL_OVERRIDES = /** @type {Record<string, string | null>} */ ({
  // ── 北方領土（JMA 対象外） ────────────────────────────────────────────
  '01695': null, '01697': null, '01698': null, '01699': null, '01700': null,

  // ── 仙台市 wards → 東部 / 西部 ───────────────────────────────────────
  '04101': '0410002', // 青葉区 → 西部（山間部含む）
  '04102': '0410001', // 宮城野区 → 東部（沿岸）
  '04103': '0410001', // 若林区 → 東部
  '04104': '0410001', // 太白区 → 東部
  '04105': '0410002', // 泉区 → 西部

  // ── 七ケ宿町（ケ/ヶ 異字体） ─────────────────────────────────────────
  '04302': '0430200', // 七ケ宿町 → 七ヶ宿町

  // ── 横浜市 wards → 北部 / 南部 ───────────────────────────────────────
  '14101': '1410011', // 鶴見区 → 北部
  '14102': '1410011', // 神奈川区 → 北部
  '14103': '1410012', // 西区 → 南部
  '14104': '1410012', // 中区 → 南部
  '14105': '1410012', // 南区 → 南部
  '14106': '1410012', // 保土ケ谷区 → 南部
  '14107': '1410012', // 磯子区 → 南部（南東）
  '14108': '1410012', // 金沢区 → 南部（南東）
  '14109': '1410011', // 港北区 → 北部
  '14110': '1410012', // 戸塚区 → 南部
  '14111': '1410012', // 港南区 → 南部
  '14112': '1410011', // 旭区 → 北部（中西）
  '14113': '1410011', // 緑区 → 北部（北東）
  '14114': '1410012', // 瀬谷区 → 南部（西）
  '14115': '1410012', // 栄区 → 南部（南東）
  '14116': '1410012', // 泉区 → 南部
  '14117': '1410011', // 青葉区 → 北部（北西）
  '14118': '1410011', // 都筑区 → 北部

  // ── 相模原市 wards → 西部 / 東部 ─────────────────────────────────────
  '14151': '1415011', // 緑区 → 西部（旧津久井）
  '14152': '1415012', // 中央区 → 東部
  '14153': '1415012', // 南区 → 東部（旧相模原市南部）

  // ── 静岡市 wards → 南部 / 北部 ───────────────────────────────────────
  '22101': '2210002', // 葵区 → 北部（山岳部含む）
  '22102': '2210001', // 駿河区 → 南部（沿岸）
  '22103': '2210001', // 清水区 → 南部（沿岸）

  // ── 浜松市 wards → 南部 / 北部 ───────────────────────────────────────
  '22138': '2213001', // 中央区 → 南部（旧浜松市街地）
  '22139': '2213001', // 浜名区 → 南部（浜名湖周辺）
  '22140': '2213002', // 天竜区 → 北部（山間部）

  // ── 梼原町（異字体: 梼 vs 檮） ───────────────────────────────────────
  '39405': '3940500', // 梼原町 → 檮原町
});

/**
 * @param {string} muniCd  GSI の 5桁 muniCd (例: "01101")
 * @returns {string | null}
 */
function resolve(muniCd) {
  // 手動オーバーライドが存在する場合は優先
  if (Object.prototype.hasOwnProperty.call(MANUAL_OVERRIDES, muniCd)) {
    return MANUAL_OVERRIDES[muniCd];
  }

  // GSI reverse geocoder は "01101" 形式。muni.js キーは parseInt 後の文字列 "1101" / "13101"
  const muniKey = String(parseInt(muniCd, 10));
  const rawName = muniData.get(muniKey);
  if (!rawName) return null;
  const cityName = normalizeStr(rawName);

  // ① 完全一致（例: "函館市", "千代田区"）
  if (nameToCode20[cityName]) return nameToCode20[cityName];

  // ② 政令市の区: "札幌市中央区" → "札幌市" を抽出
  const cityPart = cityName.match(/^(.+?[市])/)?.[1];
  if (cityPart && nameToCode20[cityPart]) return nameToCode20[cityPart];

  // ③ 郡名除去: "石狩郡当別町" → "当別町"
  const townPart = cityName.includes('郡') ? cityName.replace(/^.+?郡/, '') : null;
  if (townPart && nameToCode20[townPart]) return nameToCode20[townPart];

  // ④ 前方一致（表記ゆれ: area.json 側が短い場合）
  const fwd = Object.keys(nameToCode20).find(
    name => cityName.startsWith(name) || name.startsWith(cityName)
  );
  if (fwd) return nameToCode20[fwd];

  return null;
}

const lookup = /** @type {Record<string, string | null>} */ ({});
const stats = { matched: 0, unresolved: 0 };
const unresolvedList = [];

// GSI muniCd は 5桁ゼロパディング形式 ("01101") で格納
// muni.js のキーは "1101" (Hokkaido) / "13101" (Tokyo) のように 4〜5 桁
// 全 muniData エントリに対してゼロパディングした 5桁 muniCd を生成する
for (const [muniKey] of muniData) {
  // muni.js key → 5桁ゼロパディング muniCd
  const muniCd = muniKey.padStart(5, '0');
  const code = resolve(muniCd);
  lookup[muniCd] = code;
  if (code) stats.matched++;
  else {
    stats.unresolved++;
    unresolvedList.push(`${muniCd} "${muniData.get(muniKey)}"`);
  }
}

const total = Object.keys(lookup).length;
console.log(`\n  結果:
    解決済み: ${stats.matched}
    未解決  : ${stats.unresolved}
    合計    : ${total} 件
    解決率  : ${((stats.matched / total) * 100).toFixed(1)}%`);

if (unresolvedList.length > 0) {
  console.log('\n  [未解決の一覧]');
  unresolvedList.forEach(l => console.log('   ', l));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. JSON ファイル書き出し
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n[4/4] ${OUT_PATH} に書き出し中...`);
mkdirSync(path.dirname(OUT_PATH), { recursive: true });
// null エントリは除外（未解決分はランタイムでフォールバック）
const cleaned = Object.fromEntries(
  Object.entries(lookup).filter(([, v]) => v !== null)
);
writeFileSync(OUT_PATH, JSON.stringify(cleaned), 'utf-8');

const sizeKB = (JSON.stringify(cleaned).length / 1024).toFixed(1);
console.log(`  完了: ${Object.keys(cleaned).length} 件, ${sizeKB} KB`);

// エリアコード → エリア名テーブル (class20s をそのまま利用)
const areaNames = Object.fromEntries(
  Object.entries(class20s).map(([code, info]) => [code, info.name.replace(/\s/g, '')])
);
writeFileSync(OUT_NAMES_PATH, JSON.stringify(areaNames), 'utf-8');
const namesSizeKB = (JSON.stringify(areaNames).length / 1024).toFixed(1);
console.log(`  エリア名テーブル: ${Object.keys(areaNames).length} 件, ${namesSizeKB} KB (${OUT_NAMES_PATH})\n`);
