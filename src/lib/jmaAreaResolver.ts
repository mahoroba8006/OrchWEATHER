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

/**
 * jmaAreaCode の先頭2桁（都道府県相当）から警報 API に使う6桁都道府県コードを導出する。
 * 例: "0110000" → "010000"（北海道）, "1310100" → "130000"（東京）
 */
export function prefCodeFromAreaCode(areaCode: string): string {
  // 7桁コードの先頭2桁 = 都道府県識別
  const pref2 = areaCode.slice(0, 2);
  return `${pref2}0000`;
}
