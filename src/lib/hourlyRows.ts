// 時間別の表（HourlyTable）で、ユーザーが出し入れできる行の定義（唯一の定義元）

export const HOURLY_ROW_OPTIONS = [
  { key: 'temperature', label: '気温' },
  { key: 'precipProb', label: '降水確率' },
  { key: 'precip', label: '降水量' },
  { key: 'snowfall', label: '降雪量' },
  { key: 'windSpeed', label: '風速' },
  { key: 'windGusts', label: '瞬間風速' },
  { key: 'windDir', label: '風向き' },
  { key: 'pressure', label: '気圧' },
  { key: 'humidity', label: '湿度' },
  { key: 'vpd', label: '飽差' },
  { key: 'dewPoint', label: '露点' },
  { key: 'cape', label: 'CAPE' },
  { key: 'freezing', label: '0℃層高度' },
] as const;

export type HourlyRowKey = (typeof HOURLY_ROW_OPTIONS)[number]['key'];

/** 非表示の行を保存する（将来増える行は、初期状態で表示になる） */
export const DEFAULT_HIDDEN_HOURLY_ROWS: HourlyRowKey[] = ['windGusts', 'pressure', 'humidity', 'vpd', 'dewPoint', 'cape', 'freezing'];

const KNOWN_KEYS: ReadonlySet<string> = new Set(HOURLY_ROW_OPTIONS.map(o => o.key));

/** 未知のキー・重複・文字列以外を捨てる */
export function sanitizeHiddenHourlyRows(raw: readonly unknown[]): HourlyRowKey[] {
  const out: HourlyRowKey[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && KNOWN_KEYS.has(v) && !out.includes(v as HourlyRowKey)) out.push(v as HourlyRowKey);
  }
  return out;
}

/** 保存値の読み取り。配列でなければおすすめの設定にする */
export function parseHiddenHourlyRows(raw: unknown): HourlyRowKey[] {
  return Array.isArray(raw) ? sanitizeHiddenHourlyRows(raw) : [...DEFAULT_HIDDEN_HOURLY_ROWS];
}

export const GUEST_HIDDEN_HOURLY_ROWS_KEY = 'hiddenHourlyRows';

export function loadGuestHiddenHourlyRows(): HourlyRowKey[] {
  try {
    const s = localStorage.getItem(GUEST_HIDDEN_HOURLY_ROWS_KEY);
    return parseHiddenHourlyRows(s === null ? undefined : JSON.parse(s));
  } catch {
    return [...DEFAULT_HIDDEN_HOURLY_ROWS];
  }
}

export function saveGuestHiddenHourlyRows(rows: readonly HourlyRowKey[]): void {
  try {
    localStorage.setItem(GUEST_HIDDEN_HOURLY_ROWS_KEY, JSON.stringify(rows));
  } catch { /* localStorage 不可環境は無視 */ }
}
