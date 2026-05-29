/**
 * src/api/jmaWarning.ts
 *
 * 気象庁 防災情報 JSON から、指定エリアの注意報・警報を取得する。
 *
 * API: https://www.jma.go.jp/bosai/warning/data/warning/{prefCode}.json
 *   prefCode: 都道府県レベルの6桁コード (例: "130000" = 東京都)
 *
 * 返すデータの単位:
 *   - areaTypes[0] = 一次細分区域レベル (class10s)
 *   - areaTypes[1] = 二次細分区域レベル (class20s) ← jmaAreaCode はここに対応
 */

/** 気象庁の現象コードと対応する日本語名 */
export const JMA_WARNING_NAMES: Record<string, string> = {
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
  '19': '暴風雪',
  '20': '暴風',
  '33': '特別警報（大雨）',
  '35': '特別警報（高潮）',
  '37': '特別警報（波浪）',
  '38': '特別警報（暴風雪）',
  '39': '特別警報（暴風）',
  '40': '特別警報（大雪）',
};

/** 警報レベル (気象庁定義の status コード) */
export type WarningLevel = 'warning' | 'advisory' | 'special' | 'none';

/** 1件の注意報・警報エントリ */
export interface JmaWarningItem {
  /** 現象コード (例: "02" = 大雨) */
  code: string;
  /** 日本語名 */
  name: string;
  /** 警報レベル */
  level: WarningLevel;
  /** 警戒期間の開始時刻 (ISO 8601) — 取得できた場合のみ */
  validFrom?: string;
  /** 警戒期間の終了時刻 (ISO 8601) — 取得できた場合のみ */
  validTo?: string;
}

/** fetchJmaWarnings の返り値 */
export interface JmaWarningResult {
  /** 発表日時 (ISO 8601) */
  reportDatetime: string;
  /** 対象エリアコード */
  areaCode: string;
  /** 発表中の注意報・警報リスト (空配列 = 発表なし) */
  items: JmaWarningItem[];
}

const BASE_URL = 'https://www.jma.go.jp/bosai/warning/data/warning';

/**
 * status コード → WarningLevel 変換
 * 気象庁 JSON の各エントリには status (数値 or 文字列) が入る。
 * 0 = 解除, 1-4 = 注意報, 5-9 = 警報, 50-59 = 特別警報
 */
function toLevel(status: number | string): WarningLevel {
  const n = typeof status === 'string' ? parseInt(status, 10) : status;
  if (n <= 0)  return 'none';
  if (n >= 50) return 'special';
  if (n >= 5)  return 'warning';
  return 'advisory';
}

/**
 * 指定 jmaAreaCode の注意報・警報を取得する。
 *
 * @param jmaAreaCode  class20s コード (7桁, 例: "1310100")
 * @param prefCode     警報 API URL 用の都道府県6桁コード (例: "130000")
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

  // areaTypes[1] が class20s (二次細分区域) レベル
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaType1 = (json.areaTypes as any[])?.find((at: any) =>
    at.areas?.some((a: any) => a.code === jmaAreaCode)
  );
  const targetArea = areaType1?.areas?.find((a: any) => a.code === jmaAreaCode);

  if (!targetArea) {
    return { reportDatetime, areaCode: jmaAreaCode, items: [] };
  }

  // timeSeries: timeDefines (ISO datetime 配列) + areas (エリア別警報値配列) の対応
  const items: JmaWarningItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeSeries: any[] = json.timeSeries ?? [];

  // 最新時点 (index 0) の発表状況を抽出する
  for (const ts of timeSeries) {
    const timeDefines: string[] = ts.timeDefines ?? [];
    if (timeDefines.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tsArea = ts.areas?.find((a: any) => a.code === jmaAreaCode);
    if (!tsArea) continue;

    // 警報・注意報の種別コード一覧 (kindCodes) と現在の status
    const kindCodes: string[] = tsArea.kindCodes ?? [];
    const statuses: (number | string)[] = tsArea.statuses ?? [];

    for (let i = 0; i < kindCodes.length; i++) {
      const code = kindCodes[i];
      const status = statuses[0] !== undefined ? statuses[0] : (statuses[i] ?? 0);
      const level = toLevel(status);
      if (level === 'none') continue;

      // 警戒期間: status が非0の最初の時刻 〜 再び0になる直前の時刻
      let validFrom: string | undefined;
      let validTo: string | undefined;
      for (let t = 0; t < timeDefines.length; t++) {
        const st = toLevel(Array.isArray(tsArea.statuses) ? tsArea.statuses[t] ?? 0 : status);
        if (st !== 'none' && validFrom === undefined) validFrom = timeDefines[t];
        if (st === 'none' && validFrom !== undefined && validTo === undefined) {
          validTo = timeDefines[t];
          break;
        }
      }

      items.push({
        code,
        name: JMA_WARNING_NAMES[code] ?? `現象コード${code}`,
        level,
        validFrom,
        validTo,
      });
    }
    // 最初の timeSeries だけ処理（現況の発表状況に絞る）
    break;
  }

  // 重複排除（同一コードが複数 timeSeries に出現する場合）
  const seen = new Set<string>();
  const uniqueItems = items.filter(item => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });

  return { reportDatetime, areaCode: jmaAreaCode, items: uniqueItems };
}
