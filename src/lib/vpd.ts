// 飽差 = 飽和水蒸気量 - 実水蒸気量 [g/m³]（施設園芸の現場標準単位）
// e_s(T)[hPa] = 6.1078 × 10^(7.5T/(T+237.3))（Tetens式）
// 飽和水蒸気量[g/m³] = 216.67 × e_s / (T + 273.15) （理想気体の状態方程式）
export function calcVPD(tempC: number, humidPct: number): number {
  const e_s_hPa = 6.1078 * Math.pow(10, 7.5 * tempC / (tempC + 237.3));
  const a_max = 216.67 * e_s_hPa / (tempC + 273.15);
  return a_max * (1 - humidPct / 100);
}
