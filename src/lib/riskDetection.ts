// src/lib/riskDetection.ts
import type { HourlyForecast, DailyForecastData } from '../api/forecast';
import type { RiskThresholds, RiskSensitivity, RiskType } from '../store';

export type { RiskType };  // 既存の consumers（RiskSummary.tsx 等）向けに re-export

export interface DayRisk {
  date: string;
  risks: RiskType[];
  comment: string;
  metrics: Partial<Record<RiskType, string>>; // 判断根拠の指標・値
}

export interface RiskBadge {
  type: RiskType;
  iconFile: string;  // Meteocons SVG filename (without .svg), from /icons/weather/
  label: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
}

const ARATEN_RISK_SET: ReadonlySet<RiskType> = new Set(['thunder', 'hail', 'wind', 'rain']);

// SYNC: このオブジェクトは src/store.ts・src/lib/userRepository.ts にも
//       ローカルコピーがある（循環 import 回避のため）。新フィールド追加時は3箇所を同時に更新すること。
const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  frost:              3,
  frostDewPoint:      0,
  wind:               15,
  rainHourly:         30,
  rainDaily:          80,
  heat:               35,
  dry:                30,
  thunderSensitivity: 'medium',
  hailSensitivity:    'medium',
  hailFreezingLevel:  3500,
  snow:               3,
  cold:               0,
  enabledRisks: [
    'frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow',
  ] as RiskType[],
};

const THUNDER_CAPE_MAP: Record<RiskSensitivity, number> = {
  low: 1000, medium: 500, high: 250,
};
const HAIL_CAPE_MAP: Record<RiskSensitivity, number> = {
  low: 2000, medium: 1000, high: 300,
};

export const RISK_BADGES: Record<RiskType, RiskBadge> = {
  frost:   { type: 'frost',   iconFile: 'thermometer-snow',    label: '霜',   badgeBg: '#fcefc4', badgeColor: '#a07825', borderColor: '#e6c478' },
  thunder: { type: 'thunder', iconFile: 'lightning-bolts',     label: '雷雨', badgeBg: '#f7d4cf', badgeColor: '#a35047', borderColor: '#d99c93' },
  hail:    { type: 'hail',    iconFile: 'snowflake',           label: '雹',   badgeBg: '#f3d4e3', badgeColor: '#9c456e', borderColor: '#d693b3' },
  wind:    { type: 'wind',    iconFile: 'umbrella-wind-alt',   label: '強風', badgeBg: '#dee0ef', badgeColor: '#5c6385', borderColor: '#9aa1bf' },
  rain:    { type: 'rain',    iconFile: 'raindrops',           label: '大雨', badgeBg: '#e6dff0', badgeColor: '#634b85', borderColor: '#ab98c8' },
  heat:    { type: 'heat',    iconFile: 'thermometer-warmer',  label: '高温', badgeBg: '#fcdcc4', badgeColor: '#c0392b', borderColor: '#d39867' },
  dry:     { type: 'dry',     iconFile: 'thermometer-raindrop',label: '乾燥', badgeBg: '#ece6d4', badgeColor: '#766a3f', borderColor: '#b8a878' },
  cold:    { type: 'cold',    iconFile: 'thermometer-colder',  label: '低温', badgeBg: '#d4e8fc', badgeColor: '#1a5276', borderColor: '#7ab3e0' },
  snow:    { type: 'snow',    iconFile: 'snowman',             label: '降雪', badgeBg: '#e8f0f8', badgeColor: '#2c5f8a', borderColor: '#a0c4e8' },
};

// WMO weather code → 絵文字（昼）
export function weatherCodeToEmoji(code: number): string {
  if (code === 0)                      return '☀️';
  if (code <= 2)                       return '🌤️';
  if (code === 3)                      return '☁️';
  if (code === 45 || code === 48)      return '🌫️';
  if (code >= 51 && code <= 55)        return '🌦️';
  if (code === 56 || code === 57)      return '🌨️';
  if (code >= 61 && code <= 65)        return '🌧️';
  if (code === 66 || code === 67)      return '🌨️';
  if (code >= 71 && code <= 75)        return '❄️';
  if (code === 77)                     return '🌨️';
  if (code >= 80 && code <= 82)        return '🌦️';
  if (code >= 85 && code <= 86)        return '🌨️';
  if (code === 95)                     return '⛈️';
  if (code === 96 || code === 99)      return '⛈️';
  return '🌡️';
}

// WMO weather code → 絵文字（夜：晴れ・薄曇りを星に置換）
export function weatherCodeToNightEmoji(code: number): string {
  if (code <= 2) return '✨';
  return weatherCodeToEmoji(code);
}

function getTimePrefix(hour: number): string {
  if (hour <= 9)  return '早朝';
  if (hour <= 14) return '昼';
  if (hour <= 18) return '午後';
  return '夜';
}

function buildComment(risks: RiskType[], firstHour?: number): string {
  if (risks.some(r => ARATEN_RISK_SET.has(r))) {
    const prefix = firstHour !== undefined ? getTimePrefix(firstHour) : '';
    return prefix ? `${prefix} 荒天` : '荒天';
  }
  if (risks.includes('heat') && risks.includes('dry')) return '猛暑＋乾燥';
  if (risks.includes('heat')) return '猛暑日';
  if (risks.includes('frost')) return '早朝 霜';
  if (risks.includes('dry')) return '乾燥注意';
  if (risks.includes('snow')) return '降雪注意';
  if (risks.includes('cold')) return '低温注意';
  return '';
}

// 日0-2: hourly 精密判定
function detectHourlyRisks(
  hours: HourlyForecast[],
  t: RiskThresholds,
  thunderCape: number,
  hailCape: number
): {
  risks: RiskType[];
  firstHour: number | undefined;
  metrics: Partial<Record<RiskType, string>>;
} {
  const riskSet = new Set<RiskType>();
  let firstAratenHour: number | undefined;

  // 極値追跡
  let frostMinTemp = Infinity, frostMinDew = Infinity;
  let thunderMaxCape = 0;
  let hailMaxCape = 0, hailMinFreezing = Infinity;
  let windMax = 0;
  let rainMax = 0;
  let heatMax = -Infinity;
  let dryMin = Infinity;
  let coldMinTemp = Infinity;
  let snowMax = 0;

  for (const h of hours) {
    const hour = parseInt(h.time.slice(11, 13), 10);
    const detected: RiskType[] = [];

    // 霜：気温 ≤ t.frost ＆ 露点 ≤ t.frostDewPoint（複合条件）
    if (h.dewPoint <= t.frostDewPoint && h.temperature <= t.frost) {
      detected.push('frost');
      if (h.temperature < frostMinTemp) frostMinTemp = h.temperature;
      if (h.dewPoint    < frostMinDew)  frostMinDew  = h.dewPoint;
    }
    if (h.cape >= thunderCape || (h.weatherCode >= 95 && h.weatherCode <= 99)) {
      detected.push('thunder');
      if (h.cape > thunderMaxCape) thunderMaxCape = h.cape;
    }
    // 雹：CAPE ≥ hailCape ＆ 0℃層高度 ≤ t.hailFreezingLevel（複合条件）
    if (h.cape >= hailCape && h.freezingLevel <= t.hailFreezingLevel) {
      detected.push('hail');
      if (h.cape          > hailMaxCape)    hailMaxCape    = h.cape;
      if (h.freezingLevel < hailMinFreezing) hailMinFreezing = h.freezingLevel;
    }
    if (h.windSpeed >= t.wind)          { detected.push('wind');  if (h.windSpeed    > windMax)  windMax  = h.windSpeed; }
    if (h.precipitation >= t.rainHourly){ detected.push('rain');  if (h.precipitation > rainMax) rainMax  = h.precipitation; }
    if (h.temperature >= t.heat)        { detected.push('heat');  if (h.temperature  > heatMax)  heatMax  = h.temperature; }
    if (h.humidity <= t.dry)            { detected.push('dry');   if (h.humidity     < dryMin)   dryMin   = h.humidity; }
    if (h.temperature <= t.cold) { detected.push('cold');  if (h.temperature < coldMinTemp) coldMinTemp = h.temperature; }
    if (h.snowfall   >= t.snow)  { detected.push('snow');  if (h.snowfall    > snowMax)     snowMax     = h.snowfall;    }

    if (detected.length > 0) {
      if (detected.some(r => ARATEN_RISK_SET.has(r)) && firstAratenHour === undefined) {
        firstAratenHour = hour;
      }
      detected.forEach(r => riskSet.add(r));
    }
  }

  const risks = Array.from(riskSet);
  const metrics: Partial<Record<RiskType, string>> = {};
  if (riskSet.has('frost'))   metrics.frost   = `気温 ${frostMinTemp.toFixed(1)}℃、露点 ${frostMinDew.toFixed(1)}℃`;
  if (riskSet.has('thunder')) metrics.thunder = thunderMaxCape > 0 ? `CAPE ${Math.round(thunderMaxCape)} J/kg` : '';
  if (riskSet.has('hail'))    metrics.hail    = `CAPE ${Math.round(hailMaxCape)} J/kg、0℃層 ${Math.round(hailMinFreezing)} m`;
  if (riskSet.has('wind'))    metrics.wind    = `風速 ${windMax.toFixed(1)} m/s`;
  if (riskSet.has('rain'))    metrics.rain    = `降水 ${rainMax.toFixed(1)} mm/h`;
  if (riskSet.has('heat'))    metrics.heat    = `気温 ${heatMax.toFixed(1)}℃`;
  if (riskSet.has('dry'))     metrics.dry     = `湿度 ${dryMin}%`;
  if (riskSet.has('cold')) metrics.cold = `気温 ${coldMinTemp.toFixed(1)}℃`;
  if (riskSet.has('snow')) metrics.snow = `積雪 ${snowMax.toFixed(1)} cm`;

  return { risks, firstHour: firstAratenHour, metrics };
}

// 日3-10: daily 代替判定
function detectDailyRisks(
  day: DailyForecastData,
  t: RiskThresholds
): {
  risks: RiskType[];
  metrics: Partial<Record<RiskType, string>>;
} {
  const risks: RiskType[] = [];
  const metrics: Partial<Record<RiskType, string>> = {};

  if (day.tempMin <= t.frost)                               { risks.push('frost');   metrics.frost   = `最低気温 ${day.tempMin.toFixed(1)}℃`; }
  if (day.weatherCode >= 95 && day.weatherCode <= 99)       { risks.push('thunder'); /* 天気コード判定のため指標値なし */ }
  if (day.weatherCode === 96 || day.weatherCode === 99)     { risks.push('hail');    /* 天気コード判定のため指標値なし */ }
  if (day.windSpeedMax >= t.wind)                           { risks.push('wind');    metrics.wind    = `最大風速 ${day.windSpeedMax.toFixed(1)} m/s`; }
  if (day.precipSum >= t.rainDaily)                         { risks.push('rain');    metrics.rain    = `降水量 ${day.precipSum.toFixed(1)} mm`; }
  if (day.tempMax >= t.heat)                                { risks.push('heat');    metrics.heat    = `最高気温 ${day.tempMax.toFixed(1)}℃`; }
  if (day.humidMin <= t.dry)                                { risks.push('dry');     metrics.dry     = `最低湿度 ${day.humidMin}%`; }
  if (day.tempMin    <= t.cold)  { risks.push('cold'); metrics.cold = `最低気温 ${day.tempMin.toFixed(1)}℃`;    }
  if (day.snowfallSum >= t.snow) { risks.push('snow'); metrics.snow = `積雪 ${day.snowfallSum.toFixed(1)} cm`; }

  return { risks, metrics };
}

/**
 * 1時間分のリスクを判定して返す（HourlyTable の行ごとの表示用）。
 * ユーザー設定・enabledRisks を完全に反映する。
 */
export function detectSingleHourRisks(
  h: HourlyForecast,
  thresholds?: RiskThresholds,
): RiskType[] {
  const t           = { ...DEFAULT_RISK_THRESHOLDS, ...thresholds };
  const thunderCape = THUNDER_CAPE_MAP[t.thunderSensitivity];
  const hailCape    = HAIL_CAPE_MAP[t.hailSensitivity];
  const enabledSet  = new Set(t.enabledRisks);

  const risks: RiskType[] = [];
  if (enabledSet.has('frost')   && h.dewPoint <= t.frostDewPoint && h.temperature <= t.frost)                    risks.push('frost');
  if (enabledSet.has('thunder') && (h.cape >= thunderCape || (h.weatherCode >= 95 && h.weatherCode <= 99)))      risks.push('thunder');
  if (enabledSet.has('hail')    && h.cape >= hailCape && h.freezingLevel <= t.hailFreezingLevel)                 risks.push('hail');
  if (enabledSet.has('wind')    && h.windSpeed >= t.wind)                                                        risks.push('wind');
  if (enabledSet.has('rain')    && h.precipitation >= t.rainHourly)                                              risks.push('rain');
  if (enabledSet.has('heat')    && h.temperature >= t.heat)                                                      risks.push('heat');
  if (enabledSet.has('dry')     && h.humidity <= t.dry)                                                          risks.push('dry');
  if (enabledSet.has('cold')    && h.temperature <= t.cold)                                                      risks.push('cold');
  if (enabledSet.has('snow')    && h.snowfall >= t.snow)                                                         risks.push('snow');
  return risks;
}

/**
 * 全11日分のリスクを判定して返す。
 * hourly データが存在する日（日0-2）は精密判定、それ以外は daily 代替判定。
 */
export function detectRisks(
  hourly: HourlyForecast[],
  daily: DailyForecastData[],
  thresholds?: RiskThresholds
): DayRisk[] {
  const t = { ...DEFAULT_RISK_THRESHOLDS, ...thresholds };
  const thunderCape = THUNDER_CAPE_MAP[t.thunderSensitivity];
  const hailCape    = HAIL_CAPE_MAP[t.hailSensitivity];

  return daily.map((day) => {
    const dayHours = hourly.filter(h => h.time.slice(0, 10) === day.date);

    if (dayHours.length > 0) {
      const { risks, firstHour, metrics } = detectHourlyRisks(dayHours, t, thunderCape, hailCape);
      return { date: day.date, risks, comment: buildComment(risks, firstHour), metrics };
    } else {
      const { risks, metrics } = detectDailyRisks(day, t);
      return { date: day.date, risks, comment: buildComment(risks), metrics };
    }
  });
}
