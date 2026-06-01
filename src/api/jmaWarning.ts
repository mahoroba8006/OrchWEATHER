/**
 * src/api/jmaWarning.ts
 *
 * 気象庁 防災情報 JSON (R8 フォーマット) から、指定エリアの注意報・警報を取得する。
 *
 * API: https://www.jma.go.jp/bosai/warning/data/r8/{prefCode}.json
 * レスポンス構造:
 *   json["0"], json["1"], ... = 電文エントリ（警報種別ごとに分割）
 *   各エントリ.warning.class20Items[].areaCode  ← 二次細分区域コード
 *   各エントリ.warning.class20Items[].kinds[].{code, status, properties}
 *     status: "発表" | "継続" | "解除" | "発表警報・注意報はなし"
 *     properties[].type: "風危険度" | "波危険度" | "雷危険度" | "土砂災害危険度" など
 *     properties[].significancyPart.locals[].code: "20"=注意報 / "30"=警報 / "50"=特別警報
 *
 * 旧 warning/data/warning/{prefCode}.json は 2026-05 ごろから更新が止まり、
 * JMA の防災ページは r8 フォーマットに完全移行済み。
 */

/** 警報レベル */
export type WarningLevel = 'warning' | 'advisory' | 'special' | 'none';

/** 1件の注意報・警報エントリ */
export interface JmaWarningItem {
  code: string;
  name: string;
  level: WarningLevel;
  /** 発表時刻を "M/D H:MM〜" 形式で表示（r8 は終了時刻なし） */
  validPeriod?: string;
  /** 発表時刻の UTC ms */
  startMs?: number;
  /** 有効期間終了時刻の UTC ms（r8 では常に undefined） */
  endMs?: number;
}

/** fetchJmaWarnings の返り値 */
export interface JmaWarningResult {
  reportDatetime: string;
  areaCode: string;
  items: JmaWarningItem[];
}

const BASE_URL = 'https://www.jma.go.jp/bosai/warning/data/r8';

// r8 properties[].type → {adv: 注意報名, warn: 警報名, special: 特別警報名}
const R8_PHENOMENON: Record<string, { adv: string; warn: string; special: string }> = {
  '大雨浸水危険度':  { adv: '大雨',   warn: '大雨',   special: '大雨'   },
  '大雨土砂危険度':  { adv: '大雨',   warn: '大雨',   special: '大雨'   },
  '土砂災害危険度':  { adv: '土砂災害', warn: '土砂災害', special: '土砂災害' },
  '洪水危険度':      { adv: '洪水',   warn: '洪水',   special: '洪水'   },
  '高潮危険度':      { adv: '高潮',   warn: '高潮',   special: '高潮'   },
  '風危険度':        { adv: '強風',   warn: '暴風',   special: '暴風'   },
  '風雪危険度':      { adv: '風雪',   warn: '暴風雪', special: '暴風雪' },
  '波危険度':        { adv: '波浪',   warn: '波浪',   special: '波浪'   },
  '大雪危険度':      { adv: '大雪',   warn: '大雪',   special: '大雪'   },
  '雷危険度':        { adv: '雷',     warn: '雷',     special: '雷'     },
  '乾燥危険度':      { adv: '乾燥',   warn: '乾燥',   special: '乾燥'   },
  '濃霧危険度':      { adv: '濃霧',   warn: '濃霧',   special: '濃霧'   },
  'なだれ危険度':    { adv: 'なだれ', warn: 'なだれ', special: 'なだれ' },
  '低温危険度':      { adv: '低温',   warn: '低温',   special: '低温'   },
  '霜危険度':        { adv: '霜',     warn: '霜',     special: '霜'     },
  '着氷危険度':      { adv: '着氷',   warn: '着氷',   special: '着氷'   },
  '着雪危険度':      { adv: '着雪',   warn: '着雪',   special: '着雪'   },
  '融雪危険度':      { adv: '融雪',   warn: '融雪',   special: '融雪'   },
};

/** r8 significancyPart.locals[].code の先頭桁 → レベル情報 */
function r8LevelFromCode(code: string): { suffix: string; level: WarningLevel } | null {
  const d = parseInt(code.charAt(0), 10);
  if (d === 5) return { suffix: '特別警報', level: 'special' };
  if (d === 4) return { suffix: '危険警報', level: 'warning' };
  if (d === 3) return { suffix: '警報',     level: 'warning' };
  if (d === 2) return { suffix: '注意報',   level: 'advisory' };
  return null;
}

/**
 * JST の ISO8601 文字列（例: "2026-06-01T16:14:00+09:00"）を
 * "M/D H:MM"（例 "6/1 16:14"）に整形する。発表時刻の表示用。
 */
function fmtIssuance(iso: string): string | null {
  const ms = Date.parse(iso);
  if (isNaN(ms)) return null;
  const jst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * 指定 jmaAreaCode の注意報・警報を取得する（R8 フォーマット）。
 *
 * @param jmaAreaCode  class20s コード (7桁, 例: "4622200")
 * @param prefCode     警報 API URL 用の都道府県6桁コード (例: "460040")
 */
export async function fetchJmaWarnings(
  jmaAreaCode: string,
  prefCode: string,
): Promise<JmaWarningResult> {
  const res = await fetch(`${BASE_URL}/${prefCode}.json`);
  if (!res.ok) throw new Error(`JMA warning API error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: Record<string, any> = await res.json();

  const reportDatetimes: string[] = [];
  // typeKey = "風危険度:30" など → 重複排除キー
  const itemMap = new Map<string, JmaWarningItem>();

  for (const k of Object.keys(json)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry: any = json[k];
    if (!entry?.warning) continue;

    const reportDt: string = entry.reportDatetime ?? '';
    if (reportDt) reportDatetimes.push(reportDt);

    // 対象エリアを class20Items から探す
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const class20Items: any[] = entry.warning.class20Items ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const areaEntry: any = class20Items.find(item => item.areaCode === jmaAreaCode);
    if (!areaEntry) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const kind of (areaEntry.kinds ?? []) as any[]) {
      const status: string = kind.status ?? '';
      // 解除・発表なし は除外
      if (status === '解除' || status === '発表警報・注意報はなし') continue;
      if (status !== '発表' && status !== '継続' && status !== '更新') continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props: any[] = kind.properties ?? [];
      const dangerProp = props.find((p: any) => typeof p.type === 'string' && p.type.includes('危険度'));
      const sigProp    = props.find((p: any) => p.significancyPart);
      if (!dangerProp || !sigProp) continue;

      const phenomenon = R8_PHENOMENON[dangerProp.type as string];
      if (!phenomenon) continue;

      const lvCode: string = sigProp.significancyPart?.locals?.[0]?.code ?? '';
      const lvInfo = r8LevelFromCode(lvCode);
      if (!lvInfo) continue;

      const { suffix, level } = lvInfo;
      const baseName =
        level === 'special'  ? phenomenon.special :
        level === 'warning'  ? phenomenon.warn    :
        phenomenon.adv;
      const name = baseName + suffix;

      const issuanceLabel = fmtIssuance(reportDt);
      const validPeriod = issuanceLabel ? `${issuanceLabel}〜` : undefined;
      const startMs = reportDt ? Date.parse(reportDt) : undefined;

      // 同じ現象・レベルの重複を排除（最初に出現したエントリを優先）
      const dedupeKey = `${dangerProp.type}:${lvCode.charAt(0)}`;
      if (!itemMap.has(dedupeKey)) {
        itemMap.set(dedupeKey, {
          code: String(kind.code ?? ''),
          name,
          level,
          validPeriod,
          startMs: isNaN(startMs ?? NaN) ? undefined : startMs,
          endMs: undefined,  // r8 は終了時刻を提供しない
        });
      }
    }
  }

  // 最新の reportDatetime を代表値として使用
  const latestReportDt = reportDatetimes.sort().reverse()[0] ?? '';

  return {
    reportDatetime: latestReportDt,
    areaCode: jmaAreaCode,
    items: [...itemMap.values()].filter(item => item.level !== 'none'),
  };
}
