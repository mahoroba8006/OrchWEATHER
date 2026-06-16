// src/api/forecast.ts

import { addDays } from '../lib/dateUtils';
import { wmoSeverity } from '../lib/wmoSeverity';

export interface HourlyForecast {
  time: string;          // "2026-05-21T15:00"
  temperature: number;   // ℃
  precipitation: number; // mm
  precipProb: number;    // %
  dewPoint: number;      // ℃
  humidity: number;      // %
  windSpeed: number;     // m/s
  windDirection: number; // degrees (0-360)
  windGusts: number;     // m/s
  cape: number;          // J/kg
  freezingLevel: number; // m
  pressure: number;      // hPa
  weatherCode: number;   // WMO code
  radiation: number;     // W/m²
  snowfall: number;      // cm
  uvIndex: number;       // UV index
}

export interface DailyForecastData {
  date: string;          // "2026-05-21"
  weatherCode: number;
  tempMax: number;       // ℃
  tempMin: number;       // ℃
  precipProbMax: number; // %
  precipSum: number;     // mm
  humidMin: number;      // %
  humidMax: number;      // %
  sunrise: string;       // "2026-05-21T04:43"
  sunset: string;        // "2026-05-21T18:52"
  radiationSum: number;  // MJ/m²
  snowfallSum: number;   // cm
  windSpeedMax: number;  // m/s
  sunshineDuration: number;  // h（日照時間、秒→時間に変換済み）
  amWeatherCode:    number | null; // WMO max 04:00-11:00
  pmWeatherCode:    number | null; // WMO max 12:00-19:00
  nightWeatherCode: number | null; // WMO max 20:00-翌3:00
  amPrecipProb:     number | null; // % max 04:00-11:00
  pmPrecipProb:     number | null; // % max 12:00-19:00
  nightPrecipProb:  number | null; // % max 20:00-翌3:00
  amPrecipSum:      number | null; // mm sum 04:00-11:59（時間別データがある日のみ）
  pmPrecipSum:      number | null; // mm sum 12:00-19:59（時間別データがある日のみ）
  nightPrecipSum:   number | null; // mm sum 20:00-翌3:59（時間別データがある日のみ）
  amTempMax:         number | null; // ℃ max 04:00-11:00
  amTempMin:         number | null; // ℃ min 04:00-11:00
  pmTempMax:         number | null; // ℃ max 12:00-19:00
  pmTempMin:         number | null; // ℃ min 12:00-19:00
  nightTempMax:      number | null; // ℃ max 20:00-翌3:00
  nightTempMin:      number | null; // ℃ min 20:00-翌3:00
  amWindMax:         number | null; // m/s max 04:00-11:00
  pmWindMax:         number | null; // m/s max 12:00-19:00
  nightWindMax:      number | null; // m/s max 20:00-翌3:00
  isPlaceholder?:   boolean;       // true: 取得データなし（未来日など）—表示用
}

// 時間別の一部フィールドはデータソース（過去API段階）によって欠落する。
// 値（0 など）からの推測は誤検知するため、APIレスポンスにフィールドが
// 実在したかを取得層で判定して持ち回る。undefined は「全項目あり」とみなす。
export interface FieldAvailability {
  precipProb: boolean;     // 降水確率
  freezingLevel: boolean;  // 0℃層高度
  uvIndex: boolean;        // 紫外線指数
  cape: boolean;           // CAPE
}

export interface ForecastData {
  hourly: HourlyForecast[];        // 今日〜3日後（HourlyTable 用 72h）
  daily: DailyForecastData[];      // 今日〜15日後（最大16日）
  pastDaily: DailyForecastData[];  // 過去7日分
  fetchedAt: number;               // Date.now()
  availability?: FieldAvailability; // 過去API用。未指定は全項目利用可（通常予報）
}

export async function fetchForecast(lat: number, lon: number): Promise<ForecastData> {
  const hourlyParams = [
    'temperature_2m', 'precipitation', 'precipitation_probability',
    'dew_point_2m', 'relative_humidity_2m',
    'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    'cape', 'freezinglevel_height', 'pressure_msl',
    'weather_code', 'shortwave_radiation', 'snowfall',
    'uv_index',
  ].join(',');

  const dailyParams = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_probability_max',
    'precipitation_sum', 'relative_humidity_2m_min', 'relative_humidity_2m_max',
    'sunrise', 'sunset',
    'shortwave_radiation_sum', 'snowfall_sum', 'wind_speed_10m_max',
    'sunshine_duration',
  ].join(',');

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lon}`
    + '&timezone=Asia%2FTokyo'
    + '&models=best_match'
    + '&wind_speed_unit=ms'
    + '&past_hours=20'
    + '&past_days=7'
    + '&forecast_days=16'
    + '&forecast_hours=384'
    + `&hourly=${hourlyParams}`
    + `&daily=${dailyParams}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`予報データの取得に失敗しました (${res.status})`);
  const raw = await res.json();

  if (!raw?.hourly?.time || !raw?.daily?.time) {
    throw new Error('予報データの形式が不正です');
  }

  const hourly: HourlyForecast[] = (raw.hourly.time as string[]).map((t: string, i: number) => ({
    time: t,
    temperature:   raw.hourly.temperature_2m?.[i]             ?? 0,
    precipitation: raw.hourly.precipitation?.[i]               ?? 0,
    precipProb:    raw.hourly.precipitation_probability?.[i]   ?? 0,
    dewPoint:      raw.hourly.dew_point_2m?.[i]                ?? 0,
    humidity:      raw.hourly.relative_humidity_2m?.[i]        ?? 0,
    windSpeed:     raw.hourly.wind_speed_10m?.[i]              ?? 0,
    windDirection: raw.hourly.wind_direction_10m?.[i]          ?? 0,
    windGusts:     raw.hourly.wind_gusts_10m?.[i]              ?? 0,
    cape:          raw.hourly.cape?.[i]                         ?? 0,
    freezingLevel: raw.hourly.freezinglevel_height?.[i]        ?? 9999,
    pressure:      raw.hourly.pressure_msl?.[i]                ?? 1013,
    weatherCode:   raw.hourly.weather_code?.[i]                ?? 0,
    radiation:     raw.hourly.shortwave_radiation?.[i]         ?? 0,
    snowfall:      raw.hourly.snowfall?.[i]                    ?? 0,
    uvIndex:       raw.hourly.uv_index?.[i]                   ?? 0,
  }));

  // 最頻値を返す。同頻度の場合は大きい（悪い）コードを採用
  function modeCode(codes: number[]): number | null {
    if (codes.length === 0) return null;
    const freq = new Map<number, number>();
    for (const c of codes) freq.set(c, (freq.get(c) ?? 0) + 1);
    let maxFreq = 0, result = 0;
    for (const [code, count] of freq) {
      if (count > maxFreq || (count === maxFreq && wmoSeverity(code) > wmoSeverity(result))) {
        maxFreq = count; result = code;
      }
    }
    return result;
  }

  // 午前(4-11時)・午後(12-19時)・夜間(20-翌3時)別に weatherCode / precipProb を hourly から集計
  // 夜間は 0-3 時を前日の夜間として扱う
  const dayAmPm = new Map<string, {
    amCodes: number[]; pmCodes: number[]; nightCodes: number[];
    amProb: number | null; pmProb: number | null; nightProb: number | null;
    amPrecipSum: number;   pmPrecipSum: number;   nightPrecipSum: number;
    amTempMax: number | null; amTempMin: number | null;
    pmTempMax: number | null; pmTempMin: number | null;
    nightTempMax: number | null; nightTempMin: number | null;
    amWindMax: number | null; pmWindMax: number | null; nightWindMax: number | null;
  }>();
  for (const h of hourly) {
    const date = h.time.slice(0, 10);
    const hr = parseInt(h.time.slice(11, 13), 10);

    // 0-3 時は前日の夜間に属する
    let targetDate: string;
    let period: 'am' | 'pm' | 'night';
    if (hr < 4) {
      targetDate = addDays(date, -1);
      period = 'night';
    } else if (hr < 12) {
      targetDate = date;
      period = 'am';
    } else if (hr < 20) {
      targetDate = date;
      period = 'pm';
    } else {
      targetDate = date;
      period = 'night';
    }

    if (!dayAmPm.has(targetDate)) {
      dayAmPm.set(targetDate, {
        amCodes: [], pmCodes: [], nightCodes: [],
        amProb: null, pmProb: null, nightProb: null,
        amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
        amTempMax: null, amTempMin: null,
        pmTempMax: null, pmTempMin: null,
        nightTempMax: null, nightTempMin: null,
        amWindMax: null, pmWindMax: null, nightWindMax: null,
      });
    }
    const d = dayAmPm.get(targetDate)!;
    if (period === 'am') {
      d.amCodes.push(h.weatherCode);
      d.amProb       = d.amProb === null ? h.precipProb  : Math.max(d.amProb,  h.precipProb);
      d.amPrecipSum += h.precipitation;
      d.amTempMax    = d.amTempMax === null ? h.temperature : Math.max(d.amTempMax, h.temperature);
      d.amTempMin    = d.amTempMin === null ? h.temperature : Math.min(d.amTempMin, h.temperature);
      d.amWindMax    = d.amWindMax === null ? h.windSpeed   : Math.max(d.amWindMax, h.windSpeed);
    } else if (period === 'pm') {
      d.pmCodes.push(h.weatherCode);
      d.pmProb       = d.pmProb === null ? h.precipProb  : Math.max(d.pmProb,  h.precipProb);
      d.pmPrecipSum += h.precipitation;
      d.pmTempMax    = d.pmTempMax === null ? h.temperature : Math.max(d.pmTempMax, h.temperature);
      d.pmTempMin    = d.pmTempMin === null ? h.temperature : Math.min(d.pmTempMin, h.temperature);
      d.pmWindMax    = d.pmWindMax === null ? h.windSpeed   : Math.max(d.pmWindMax, h.windSpeed);
    } else {
      d.nightCodes.push(h.weatherCode);
      d.nightProb       = d.nightProb === null ? h.precipProb  : Math.max(d.nightProb,  h.precipProb);
      d.nightPrecipSum += h.precipitation;
      d.nightTempMax    = d.nightTempMax === null ? h.temperature : Math.max(d.nightTempMax, h.temperature);
      d.nightTempMin    = d.nightTempMin === null ? h.temperature : Math.min(d.nightTempMin, h.temperature);
      d.nightWindMax    = d.nightWindMax === null ? h.windSpeed   : Math.max(d.nightWindMax, h.windSpeed);
    }
  }

  const daily: DailyForecastData[] = (raw.daily.time as string[]).map((t: string, i: number) => ({
    date:          t,
    weatherCode:   raw.daily.weather_code?.[i] ?? 0,
    tempMax:       raw.daily.temperature_2m_max?.[i]             ?? 0,
    tempMin:       raw.daily.temperature_2m_min?.[i]             ?? 0,
    precipProbMax: raw.daily.precipitation_probability_max?.[i]  ?? 0,
    precipSum:     raw.daily.precipitation_sum?.[i]              ?? 0,
    humidMin:      raw.daily.relative_humidity_2m_min?.[i]       ?? 100,
    humidMax:      raw.daily.relative_humidity_2m_max?.[i]       ?? 0,
    sunrise:       raw.daily.sunrise?.[i]                        ?? '',
    sunset:        raw.daily.sunset?.[i]                         ?? '',
    radiationSum:  raw.daily.shortwave_radiation_sum?.[i]        ?? 0,
    snowfallSum:   raw.daily.snowfall_sum?.[i]                   ?? 0,
    windSpeedMax:  raw.daily.wind_speed_10m_max?.[i]             ?? 0,
    sunshineDuration: (raw.daily.sunshine_duration?.[i] ?? 0) / 3600,
    amWeatherCode:    modeCode(dayAmPm.get(t)?.amCodes    ?? []),
    pmWeatherCode:    modeCode(dayAmPm.get(t)?.pmCodes    ?? []),
    nightWeatherCode: modeCode(dayAmPm.get(t)?.nightCodes ?? []),
    amPrecipProb:     dayAmPm.get(t)?.amProb    ?? null,
    pmPrecipProb:     dayAmPm.get(t)?.pmProb    ?? null,
    nightPrecipProb:  dayAmPm.get(t)?.nightProb ?? null,
    amPrecipSum:      dayAmPm.has(t) ? dayAmPm.get(t)!.amPrecipSum    : null,
    pmPrecipSum:      dayAmPm.has(t) ? dayAmPm.get(t)!.pmPrecipSum    : null,
    nightPrecipSum:   dayAmPm.has(t) ? dayAmPm.get(t)!.nightPrecipSum : null,
    amTempMax:        dayAmPm.get(t)?.amTempMax          ?? null,
    amTempMin:         dayAmPm.get(t)?.amTempMin         ?? null,
    pmTempMax:         dayAmPm.get(t)?.pmTempMax         ?? null,
    pmTempMin:         dayAmPm.get(t)?.pmTempMin         ?? null,
    nightTempMax:      dayAmPm.get(t)?.nightTempMax      ?? null,
    nightTempMin:      dayAmPm.get(t)?.nightTempMin      ?? null,
    amWindMax:         dayAmPm.get(t)?.amWindMax          ?? null,
    pmWindMax:         dayAmPm.get(t)?.pmWindMax          ?? null,
    nightWindMax:      dayAmPm.get(t)?.nightWindMax       ?? null,
  }));

  // 今日のJST日付でdailyを過去/未来に分割
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayJst = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}-${String(jstNow.getUTCDate()).padStart(2, '0')}`;
  const pastDaily = daily.filter(d => d.date < todayJst);
  const futureDaily = daily.filter(d => d.date >= todayJst);

  // HourlyTable 用は past_hours(20) + 72h のみ返す（dayAmPm は全384h で構築済み）
  return { hourly: hourly.slice(0, 20 + 72), daily: futureDaily, pastDaily, fetchedAt: Date.now() };
}
