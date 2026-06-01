// src/lib/dateUtils.ts
//
// 日付文字列（"YYYY-MM-DD"）の加減算ユーティリティ。
// カレンダー上の日付計算は必ず UTC 基準で行い、実行環境のタイムゾーンに
// 依存しないようにする（ローカル時刻 + toISOString の組み合わせは
// UTC 変換で日付がズレるため使用禁止）。

/** "YYYY-MM-DD" に n 日加算して "YYYY-MM-DD" を返す（n は負も可） */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
