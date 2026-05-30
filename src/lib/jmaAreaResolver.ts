/**
 * src/lib/jmaAreaResolver.ts
 *
 * 緯度経度 → 気象庁 class20s エリアコード（7桁）解決ユーティリティ。
 *
 * 処理フロー:
 *   1. 国土地理院 逆ジオコーディング API → muniCd (5桁)
 *   2. jmaAreaLookup.json を参照 → jmaAreaCode (7桁)
 *
 * jmaAreaLookup.json は scripts/build-jma-area-map.mjs で生成される静的テーブル。
 * 解決結果は呼び出し元でキャッシュ（Firestore）することを前提とする。
 */

import lookup from '../data/jmaAreaLookup.json';
import names  from '../data/jmaAreaNames.json';

const areaLookup = lookup as Record<string, string>;
const areaNames  = names  as Record<string, string>;

const GSI_REVERSE_URL = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress';

interface GsiResult {
  results: {
    muniCd: string;   // 5桁ゼロパディング (例: "01101")
    lv01Nm: string;   // 町丁目名
  };
}

/**
 * 緯度経度から気象庁 class20s エリアコード（7桁）を解決する。
 *
 * @returns エリアコード文字列、または解決不能時 null
 * @throws  ネットワークエラー時は例外をそのまま re-throw
 */
export async function resolveJmaAreaCode(lat: number, lon: number): Promise<string | null> {
  const url = `${GSI_REVERSE_URL}?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GSI API error: ${res.status}`);

  const json: GsiResult = await res.json();
  const muniCd = json.results?.muniCd;
  if (!muniCd) return null;

  // jmaAreaLookup.json は5桁ゼロパディング形式で格納済み
  return areaLookup[muniCd] ?? null;
}

/**
 * jmaAreaCode からエリア名（日本語）を返す。
 * 例: "2010200" → "松本"
 */
export function getAreaName(areaCode: string): string | null {
  return areaNames[areaCode] ?? null;
}

// 沖縄は気象台が4つに分かれており、先頭2桁の法則が通用しない。
// 471000=本島地方, 472000=南大東島, 473000=宮古島地方, 474000=八重山地方
const OKINAWA_AREA_TO_PREF: Record<string, string> = {
  '4735700': '472000', // 南大東村
  '4735800': '472000', // 北大東村
  '4721400': '473000', // 宮古島市
  '4737500': '473000', // 多良間村
  '4720700': '474000', // 石垣市
  '4738100': '474000', // 竹富町
  '4738200': '474000', // 与那国町
};

/**
 * jmaAreaCode の先頭2桁（都道府県相当）から警報 API に使う6桁都道府県コードを導出する。
 * 例: "0110000" → "010000"（北海道）, "1310100" → "130000"（東京）
 * 沖縄（47）は複数気象台に分かれるため個別マッピングで上書きする。
 */
export function prefCodeFromAreaCode(areaCode: string): string {
  if (OKINAWA_AREA_TO_PREF[areaCode]) return OKINAWA_AREA_TO_PREF[areaCode];
  const pref2 = areaCode.slice(0, 2);
  // 沖縄の大多数（本島地方）は 471000
  if (pref2 === '47') return '471000';
  return `${pref2}0000`;
}
