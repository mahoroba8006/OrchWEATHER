// 日本の祝日（国民の祝日に関する法律・2020年以降の規定）。振替休日・国民の休日を含む
// 2020・2021年の東京五輪に伴う特例の移動は扱わない（カレンダーは今日の前後2週間のみ）

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** m月の第n月曜日 */
function nthMonday(y: number, m: number, n: number): number {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((8 - first) % 7) + (n - 1) * 7;
}

// 春分・秋分の日（1980〜2099年に有効な近似式）
const equinox = (y: number, base: number) =>
  Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

function baseHolidays(y: number): Map<string, string> {
  return new Map([
    [ymd(y, 1, 1), '元日'],
    [ymd(y, 1, nthMonday(y, 1, 2)), '成人の日'],
    [ymd(y, 2, 11), '建国記念の日'],
    [ymd(y, 2, 23), '天皇誕生日'],
    [ymd(y, 3, equinox(y, 20.8431)), '春分の日'],
    [ymd(y, 4, 29), '昭和の日'],
    [ymd(y, 5, 3), '憲法記念日'],
    [ymd(y, 5, 4), 'みどりの日'],
    [ymd(y, 5, 5), 'こどもの日'],
    [ymd(y, 7, nthMonday(y, 7, 3)), '海の日'],
    [ymd(y, 8, 11), '山の日'],
    [ymd(y, 9, nthMonday(y, 9, 3)), '敬老の日'],
    [ymd(y, 9, equinox(y, 23.2488)), '秋分の日'],
    [ymd(y, 10, nthMonday(y, 10, 2)), 'スポーツの日'],
    [ymd(y, 11, 3), '文化の日'],
    [ymd(y, 11, 23), '勤労感謝の日'],
  ]);
}

const shift = (date: string, days: number) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

const cache = new Map<number, Map<string, string>>();

/** その年の祝日（日付 → 名前） */
export function holidaysOf(y: number): Map<string, string> {
  const hit = cache.get(y);
  if (hit) return hit;
  const map = baseHolidays(y);
  const fixed = [...map.keys()].sort();
  // 国民の休日: 前日と翌日が祝日に挟まれた平日
  for (const d of fixed) {
    const mid = shift(d, 1);
    if (!map.has(mid) && map.has(shift(d, 2)) && new Date(`${mid}T00:00:00Z`).getUTCDay() !== 0) map.set(mid, '国民の休日');
  }
  // 振替休日: 祝日が日曜なら、その後の最も近い祝日でない日
  for (const d of fixed) {
    if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 0) continue;
    let next = shift(d, 1);
    while (map.has(next)) next = shift(next, 1);
    map.set(next, '振替休日');
  }
  cache.set(y, map);
  return map;
}

/** 祝日なら名前、そうでなければ null */
export function holidayName(date: string): string | null {
  return holidaysOf(parseInt(date.slice(0, 4), 10)).get(date) ?? null;
}
