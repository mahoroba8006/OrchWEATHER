// src/lib/riskDetection.ts
import type { HourlyForecast, DailyForecastData } from '../api/forecast';

export type RiskType = 'frost' | 'thunder' | 'hail' | 'wind' | 'rain' | 'heat' | 'dry';

export interface DayRisk {
  date: string;
  risks: RiskType[];
  comment: string;
}

export interface RiskBadge {
  type: RiskType;
  emoji: string;
  label: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
}

const ARATEN_RISK_SET: ReadonlySet<RiskType> = new Set(['thunder', 'hail', 'wind', 'rain']);

export const RISK_BADGES: Record<RiskType, RiskBadge> = {
  frost:   { type: 'frost',   emoji: '❄',  label: '霜',   badgeBg: '#fcefc4', badgeColor: '#a07825', borderColor: '#e6c478' },
  thunder: { type: 'thunder', emoji: '⚡', label: '雷雨', badgeBg: '#f7d4cf', badgeColor: '#a35047', borderColor: '#d99c93' },
  hail:    { type: 'hail',    emoji: '🧊', label: '雹',   badgeBg: '#f3d4e3', badgeColor: '#9c456e', borderColor: '#d693b3' },
  wind:    { type: 'wind',    emoji: '💨', label: '強風', badgeBg: '#dee0ef', badgeColor: '#5c6385', borderColor: '#9aa1bf' },
  rain:    { type: 'rain',    emoji: '🌊', label: '大雨', badgeBg: '#e6dff0', badgeColor: '#634b85', borderColor: '#ab98c8' },
  heat:    { type: 'heat',    emoji: '☀',  label: '高温', badgeBg: '#fcdcc4', badgeColor: '#c0392b', borderColor: '#d39867' },
  dry:     { type: 'dry',     emoji: '🌵', label: '乾燥', badgeBg: '#ece6d4', badgeColor: '#766a3f', borderColor: '#b8a878' },
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
  return '';
}

// 日0-2: hourly 精密判定
function detectHourlyRisks(hours: HourlyForecast[]): { risks: RiskType[]; firstHour: number | undefined } {
  const riskSet = new Set<RiskType>();
  let firstAratenHour: number | undefined;

  for (const h of hours) {
    const hour = parseInt(h.time.slice(11, 13), 10);
    const detected: RiskType[] = [];

    if (h.dewPoint <= 0 && h.temperature <= 3)         detected.push('frost');
    if (h.cape >= 500 || (h.weatherCode >= 95 && h.weatherCode <= 99)) detected.push('thunder');
    if (h.cape >= 1000 && h.freezingLevel <= 3500)     detected.push('hail');
    if (h.windSpeed >= 15)                             detected.push('wind');
    if (h.precipitation >= 30)                         detected.push('rain');
    if (h.temperature >= 35)                           detected.push('heat');
    if (h.humidity <= 30)                              detected.push('dry');

    if (detected.length > 0) {
      if (detected.some(r => ARATEN_RISK_SET.has(r)) && firstAratenHour === undefined) {
        firstAratenHour = hour;
      }
      detected.forEach(r => riskSet.add(r));
    }
  }

  return { risks: Array.from(riskSet), firstHour: firstAratenHour };
}

// 日3-10: daily 代替判定
function detectDailyRisks(day: DailyForecastData): RiskType[] {
  const risks: RiskType[] = [];
  if (day.tempMin <= 3)                                           risks.push('frost');
  if (day.weatherCode >= 95 && day.weatherCode <= 99)            risks.push('thunder');
  if (day.weatherCode === 96 || day.weatherCode === 99)          risks.push('hail');
  if (day.windSpeedMax >= 15)                                     risks.push('wind');
  if (day.precipSum >= 80)                                        risks.push('rain');
  if (day.tempMax >= 35)                                          risks.push('heat');
  if (day.humidMin <= 30)                                         risks.push('dry');
  return risks;
}

/**
 * 全11日分のリスクを判定して返す。
 * hourly データが存在する日（日0-2）は精密判定、それ以外は daily 代替判定。
 */
export function detectRisks(hourly: HourlyForecast[], daily: DailyForecastData[]): DayRisk[] {
  return daily.map((day) => {
    const dayHours = hourly.filter(h => h.time.slice(0, 10) === day.date);

    if (dayHours.length > 0) {
      const { risks, firstHour } = detectHourlyRisks(dayHours);
      return { date: day.date, risks, comment: buildComment(risks, firstHour) };
    } else {
      const risks = detectDailyRisks(day);
      return { date: day.date, risks, comment: buildComment(risks) };
    }
  });
}
