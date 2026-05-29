/**
 * src/api/jmaWarning.ts
 *
 * 気象庁 防災情報 JSON から、指定エリアの注意報・警報を取得する。
 *
 * API: https://www.jma.go.jp/bosai/warning/data/warning/{prefCode}.json
 * レスポンス構造: json.areaTypes[].areas[].warnings[] = [{ code, status }]
 *   - areaTypes[0] = 一次細分区域 (class10s)
 *   - areaTypes[1] = 二次細分区域 (class20s) ← jmaAreaCode はここに対応
 *
 * コード体系:
 *   02-18: 注意報 (advisory)
 *   19-32: 警報 (warning)
 *   33-40: 特別警報 (special)
 */

/** 気象庁の現象コードと対応する日本語名 */
export const JMA_WARNING_NAMES: Record<string, string> = {
  // ── 注意報 (02-18) ──────────────────────────────────────────
  '02': '大雨',
  '03': '洪水',
  '04': '乾燥',
  '05': '霜',
  '06': 'なだれ',
  '07': '低温',
  '08': '着氷',
  '09': '着雪',
  '10': '融雪',
  '12': '大雪',
  '13': '風雪',
  '14': '濃霧',
  '15': '雷',
  '16': '強風',
  '17': '波浪',
  '18': '高潮',
  // ── 警報 (19-32) ────────────────────────────────────────────
  '19': '暴風雪',
  '20': '暴風',
  '21': '大雨',
  '22': '洪水',
  '23': '大雪',
  '24': '風雪',
  '25': '波浪',
  '26': '高潮',
  // ── 特別警報 (33-40) ────────────────────────────────────────
  '33': '大雨',
  '35': '高潮',
  '37': '波浪',
  '38': '暴風雪',
  '39': '暴風',
  '40': '大雪',
};

/** 警報レベル */
export type WarningLevel = 'warning' | 'advisory' | 'special' | 'none';

/** 1件の注意報・警報エントリ */
export interface JmaWarningItem {
  code: string;
  name: string;
  level: WarningLevel;
}

/** fetchJmaWarnings の返り値 */
export interface JmaWarningResult {
  reportDatetime: string;
  areaCode: string;
  items: JmaWarningItem[];
}

const BASE_URL = 'https://www.jma.go.jp/bosai/warning/data/warning';

/** 現象コード → WarningLevel */
function toLevel(code: string): WarningLevel {
  const n = parseInt(code, 10);
  if (isNaN(n)) return 'none';
  if (n >= 33) return 'special';
  if (n >= 19) return 'warning';
  if (n >= 2)  return 'advisory';
  return 'none';
}

/**
 * 指定 jmaAreaCode の注意報・警報を取得する。
 *
 * @param jmaAreaCode  class20s コード (7桁, 例: "2020201")
 * @param prefCode     警報 API URL 用の都道府県6桁コード (例: "200000")
 */
export async function fetchJmaWarnings(
  jmaAreaCode: string,
  prefCode: string,
): Promise<JmaWarningResult> {
  const res = await fetch(`${BASE_URL}/${prefCode}.json`);
  if (!res.ok) throw new Error(`JMA warning API error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  const reportDatetime: string = json.reportDatetime ?? '';

  // areaTypes[] の全エリアから対象コードを探す
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaTypes: any[] = json.areaTypes ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targetArea: any = null;
  for (const at of areaTypes) {
    const found = at.areas?.find((a: any) => a.code === jmaAreaCode);
    if (found) { targetArea = found; break; }
  }

  if (!targetArea) {
    return { reportDatetime, areaCode: jmaAreaCode, items: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const warnings: any[] = targetArea.warnings ?? [];

  const items: JmaWarningItem[] = warnings
    .filter((w: any) => w.status === '発表' || w.status === '更新')
    .map((w: any) => ({
      code:  String(w.code),
      name:  JMA_WARNING_NAMES[String(w.code)] ?? `現象コード${w.code}`,
      level: toLevel(String(w.code)),
    }))
    .filter(item => item.level !== 'none');

  // 重複排除
  const seen = new Set<string>();
  const uniqueItems = items.filter(item => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });

  return { reportDatetime, areaCode: jmaAreaCode, items: uniqueItems };
}
