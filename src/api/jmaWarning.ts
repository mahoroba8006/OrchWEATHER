/**
 * src/api/jmaWarning.ts
 *
 * 気象庁 防災情報 JSON から、指定エリアの注意報・警報を取得する。
 *
 * API: https://www.jma.go.jp/bosai/warning/data/warning/{prefCode}.json
 * レスポンス構造:
 *   json.areaTypes[].areas[].warnings[] = [{ code, status }]
 *     - areaTypes[0] = 一次細分区域 (class10s)
 *     - areaTypes[1] = 二次細分区域 (class20s) ← jmaAreaCode はここに対応
 *   json.timeSeries[].timeDefines[] + areaTypes[].areas[].warnings[].levels[]
 *     → 各時刻ステップの警報有効フラグ。有効期間算出に使用。
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
  /** timeSeries から算出した有効期間。例: "5/29 06:00〜09:00" */
  validPeriod?: string;
  /** 有効期間開始時刻の UTC ms */
  startMs?: number;
  /** 有効期間終了時刻の UTC ms。継続中（解除未定）の場合は undefined */
  endMs?: number;
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
 * JST の ISO8601 文字列（例: "2026-05-29T06:00:00+09:00"）から
 * 月・日・時を取り出す。オフセット付きなのでそのままパースで OK。
 */
function parseJST(iso: string): { month: number; date: number; hour: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/);
  if (!m) return null;
  return { month: parseInt(m[2], 10), date: parseInt(m[3], 10), hour: parseInt(m[4], 10) };
}

function fmtHH(h: number): string { return `${h}:00`; }
function fmtMDHH(mon: number, d: number, h: number): string { return `${mon}/${d} ${fmtHH(h)}`; }

/**
 * JST ISO 文字列（オフセット付き、例 "2026-05-28T06:51:00+09:00"）を
 * "M/D H:MM"（例 "5/28 6:51"）に整形する。発表時刻の表示用。
 */
function fmtIssuance(iso: string): string | null {
  const ms = Date.parse(iso);
  if (isNaN(ms)) return null;
  const jst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

/** 期限情報のない注意報を発表時刻から除外するまでの時間（6時間） */
const WARN_INDEFINITE_MAX_MS = 6 * 60 * 60 * 1000;

/** buildValidPeriodMap の返り値型 */
interface ValidPeriodEntry {
  period: string;
  /** 有効期間開始時刻の UTC ms。 */
  startMs?: number;
  /** 有効期間終了時刻の UTC ms。予報期間終端まで続く場合は undefined。 */
  endMs?: number;
}

/**
 * timeSeries から警報コードごとの有効期間情報マップを構築する。
 * timeSeries[].areaTypes[].areas[].warnings[].levels[] の非 "00" スロットを探索し、
 * 開始〜終了を "M/D HH:00〜HH:00" 形式と終了 UTC ms で返す。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildValidPeriodMap(timeSeries: any[], areaCode: string): Map<string, ValidPeriodEntry> {
  const map = new Map<string, ValidPeriodEntry>();

  for (const ts of timeSeries) {
    const defines: string[] = ts.timeDefines ?? [];
    if (defines.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tsArea: any = null;
    for (const at of ts.areaTypes ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = at.areas?.find((a: any) => a.code === areaCode);
      if (found) { tsArea = found; break; }
    }
    if (!tsArea) continue;

    for (const w of tsArea.warnings ?? []) {
      const code = String(w.code);
      if (map.has(code)) continue; // 先の timeSeries エントリ優先

      const levels: unknown[] = w.levels ?? [];
      // levels が文字列配列でない場合（雷危険度など複合オブジェクト形式）はスキップ。
      // エントリをマップに追加しないことで validPeriodMap.get() が undefined を返し、
      // フィルタ側で「期限未設定 = 除外しない」として正しく扱われる。
      if (levels.length === 0 || typeof levels[0] !== 'string') continue;
      const active: number[] = [];
      for (let i = 0; i < levels.length; i++) {
        if (levels[i] && levels[i] !== '00') active.push(i);
      }
      if (active.length === 0) continue;

      const from = parseJST(defines[active[0]]);
      if (!from) continue;

      const endIdx = active[active.length - 1] + 1;
      if (endIdx < defines.length) {
        const to = parseJST(defines[endIdx]);
        if (!to) continue;
        const period = from.date === to.date
          ? `${fmtMDHH(from.month, from.date, from.hour)}〜${fmtHH(to.hour)}`
          : `${fmtMDHH(from.month, from.date, from.hour)}〜${fmtMDHH(to.month, to.date, to.hour)}`;
        // ISO 文字列をそのまま Date.parse して UTC ms を得る（タイムゾーン込みで正確）
        const startMs = Date.parse(defines[active[0]]);
        const endMs = Date.parse(defines[endIdx]);
        map.set(code, {
          period,
          startMs: isNaN(startMs) ? undefined : startMs,
          endMs: isNaN(endMs) ? undefined : endMs,
        });
      } else {
        // 予報期間終端まで続く場合（終了時刻算出不可）
        const startMs = Date.parse(defines[active[0]]);
        map.set(code, {
          period: `${fmtMDHH(from.month, from.date, from.hour)}〜（解除未定）`,
          startMs: isNaN(startMs) ? undefined : startMs,
        });
      }
    }
  }

  return map;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = at.areas?.find((a: any) => a.code === jmaAreaCode);
    if (found) { targetArea = found; break; }
  }

  if (!targetArea) {
    return { reportDatetime, areaCode: jmaAreaCode, items: [] };
  }

  // timeSeries から有効期間マップを構築
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeSeries: any[] = json.timeSeries ?? [];
  const validPeriodMap = buildValidPeriodMap(timeSeries, jmaAreaCode);
  const now = Date.now();
  const reportMs = Date.parse(reportDatetime);     // 発表時刻（期限なし注意報の基準）
  const issuanceLabel = fmtIssuance(reportDatetime); // "5/28 6:51"（期間表示フォールバック用）

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const warnings: any[] = targetArea.warnings ?? [];

  const items: JmaWarningItem[] = warnings
    .filter((w: any) => w.status === '発表' || w.status === '更新' || w.status === '継続')
    .filter((w: any) => {
      const validity = validPeriodMap.get(String(w.code));
      // 終了時刻あり: 過去なら除外（JMA が 解除 を出さず継続が残るケース対策）
      if (validity?.endMs !== undefined) return validity.endMs > now;
      // 終了時刻なし（濃霧など期限情報のない注意報・解除未定）:
      // 発表時刻から WARN_INDEFINITE_MAX_MS を超えたものは除外する。
      // ここで除外すると UI・AI・ガントバー全てから消える（単一の判定箇所）。
      if (isNaN(reportMs)) return true; // 基準不明は安全側で残す
      return (now - reportMs) <= WARN_INDEFINITE_MAX_MS;
    })
    .map((w: any) => {
      const entry = validPeriodMap.get(String(w.code));
      return {
        code:        String(w.code),
        name:        JMA_WARNING_NAMES[String(w.code)] ?? `現象コード${w.code}`,
        level:       toLevel(String(w.code)),
        // 期間が取れない注意報は発表時刻を表示（例 "5/28 6:51〜"）
        validPeriod: entry?.period ?? (issuanceLabel ? `${issuanceLabel}〜` : undefined),
        startMs:     entry?.startMs,
        endMs:       entry?.endMs,
      };
    })
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
