// src/api/historicalForecast.ts
// 過去の気象データ取得 — Open-Meteo forecast API with start_date / end_date
import type { ForecastData, DailyForecastData, HourlyForecast } from './forecast';

// ── ヘルパー ─────────────────────────────────────────────────────────────────

/** JST の「今日」と「昨日」の日付文字列（YYYY-MM-DD）を返す */
function jstTodayAndYesterday(): { today: string; yesterday: string } {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jstNow.toISOString().slice(0, 10);
  const yd = new Date(jstNow);
  yd.setUTCDate(yd.getUTCDate() - 1);
  const yesterday = yd.toISOString().slice(0, 10);
  return { today, yesterday };
}

/** YYYY-MM-DD に n 日加算した文字列を返す */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** データがない日（未来など）のプレースホルダーエントリ */
function createPlaceholderDay(date: string): DailyForecastData {
  return {
    date,
    isPlaceholder: true,
    weatherCode: 0,
    tempMax: 0, tempMin: 0,
    precipProbMax: 0, precipSum: 0,
    humidMin: 0, humidMax: 0,
    sunrise: '', sunset: '',
    radiationSum: 0, snowfallSum: 0,
    windSpeedMax: 0, sunshineDuration: 0,
    amWeatherCode:    null, pmWeatherCode:    null, nightWeatherCode: null,
    amPrecipProb:     null, pmPrecipProb:     null, nightPrecipProb:  null,
    amPrecipSum:      null, pmPrecipSum:      null, nightPrecipSum:   null,
  };
}

// ── API フェッチ ──────────────────────────────────────────────────────────────

async function fetchRawHistorical(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<ForecastData> {
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
    + `&start_date=${startDate}`
    + `&end_date=${endDate}`
    + `&hourly=${hourlyParams}`
    + `&daily=${dailyParams}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`過去の気象データの取得に失敗しました (${res.status})`);
  const raw = await res.json();

  if (!raw?.hourly?.time || !raw?.daily?.time) {
    throw new Error('気象データの形式が不正です');
  }

  // hourly マッピング
  const hourly: HourlyForecast[] = (raw.hourly.time as string[]).map((t: string, i: number) => ({
    time:          t,
    temperature:   raw.hourly.temperature_2m?.[i]              ?? 0,
    precipitation: raw.hourly.precipitation?.[i]                ?? 0,
    precipProb:    raw.hourly.precipitation_probability?.[i]    ?? 0,
    dewPoint:      raw.hourly.dew_point_2m?.[i]                 ?? 0,
    humidity:      raw.hourly.relative_humidity_2m?.[i]         ?? 0,
    windSpeed:     raw.hourly.wind_speed_10m?.[i]               ?? 0,
    windDirection: raw.hourly.wind_direction_10m?.[i]           ?? 0,
    windGusts:     raw.hourly.wind_gusts_10m?.[i]               ?? 0,
    cape:          raw.hourly.cape?.[i]                          ?? 0,
    freezingLevel: raw.hourly.freezinglevel_height?.[i]         ?? 9999,
    pressure:      raw.hourly.pressure_msl?.[i]                 ?? 1013,
    weatherCode:   raw.hourly.weather_code?.[i]                 ?? 0,
    radiation:     raw.hourly.shortwave_radiation?.[i]          ?? 0,
    snowfall:      raw.hourly.snowfall?.[i]                     ?? 0,
    uvIndex:       raw.hourly.uv_index?.[i]                    ?? 0,
  }));

  // AM(4-12) / PM(12-20) / 夜間(20-翌4) 集計
  const dayAmPm = new Map<string, {
    amCode: number | null; pmCode: number | null; nightCode: number | null;
    amProb: number | null; pmProb: number | null; nightProb: number | null;
    amPrecipSum: number;   pmPrecipSum: number;   nightPrecipSum: number;
  }>();

  for (const h of hourly) {
    const date = h.time.slice(0, 10);
    const hr   = parseInt(h.time.slice(11, 13), 10);

    let targetDate: string;
    let period: 'am' | 'pm' | 'night';
    if (hr < 4) {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      targetDate = d.toISOString().slice(0, 10);
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
        amCode: null, pmCode: null, nightCode: null,
        amProb: null, pmProb: null, nightProb: null,
        amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
      });
    }
    const d = dayAmPm.get(targetDate)!;
    if (period === 'am') {
      d.amCode       = d.amCode === null ? h.weatherCode : Math.max(d.amCode, h.weatherCode);
      d.amProb       = d.amProb === null ? h.precipProb  : Math.max(d.amProb,  h.precipProb);
      d.amPrecipSum += h.precipitation;
    } else if (period === 'pm') {
      d.pmCode       = d.pmCode === null ? h.weatherCode : Math.max(d.pmCode, h.weatherCode);
      d.pmProb       = d.pmProb === null ? h.precipProb  : Math.max(d.pmProb,  h.precipProb);
      d.pmPrecipSum += h.precipitation;
    } else {
      d.nightCode       = d.nightCode === null ? h.weatherCode : Math.max(d.nightCode, h.weatherCode);
      d.nightProb       = d.nightProb === null ? h.precipProb  : Math.max(d.nightProb,  h.precipProb);
      d.nightPrecipSum += h.precipitation;
    }
  }

  // daily マッピング
  const daily: DailyForecastData[] = (raw.daily.time as string[]).map((t: string, i: number) => ({
    date:             t,
    weatherCode:      raw.daily.weather_code?.[i]                   ?? 0,
    tempMax:          raw.daily.temperature_2m_max?.[i]             ?? 0,
    tempMin:          raw.daily.temperature_2m_min?.[i]             ?? 0,
    precipProbMax:    raw.daily.precipitation_probability_max?.[i]  ?? 0,
    precipSum:        raw.daily.precipitation_sum?.[i]              ?? 0,
    humidMin:         raw.daily.relative_humidity_2m_min?.[i]       ?? 100,
    humidMax:         raw.daily.relative_humidity_2m_max?.[i]       ?? 0,
    sunrise:          raw.daily.sunrise?.[i]                        ?? '',
    sunset:           raw.daily.sunset?.[i]                         ?? '',
    radiationSum:     raw.daily.shortwave_radiation_sum?.[i]        ?? 0,
    snowfallSum:      raw.daily.snowfall_sum?.[i]                   ?? 0,
    windSpeedMax:     raw.daily.wind_speed_10m_max?.[i]             ?? 0,
    sunshineDuration: (raw.daily.sunshine_duration?.[i] ?? 0) / 3600,
    amWeatherCode:    dayAmPm.get(t)?.amCode    ?? null,
    pmWeatherCode:    dayAmPm.get(t)?.pmCode    ?? null,
    nightWeatherCode: dayAmPm.get(t)?.nightCode ?? null,
    amPrecipProb:     dayAmPm.get(t)?.amProb    ?? null,
    pmPrecipProb:     dayAmPm.get(t)?.pmProb    ?? null,
    nightPrecipProb:  dayAmPm.get(t)?.nightProb ?? null,
    amPrecipSum:      dayAmPm.has(t) ? dayAmPm.get(t)!.amPrecipSum    : null,
    pmPrecipSum:      dayAmPm.has(t) ? dayAmPm.get(t)!.pmPrecipSum    : null,
    nightPrecipSum:   dayAmPm.has(t) ? dayAmPm.get(t)!.nightPrecipSum : null,
  }));

  return { hourly, daily, fetchedAt: Date.now() };
}

// ── エクスポート ──────────────────────────────────────────────────────────────

/**
 * startDate から 10 日分の過去気象データを取得する。
 * 昨日以降の日はプレースホルダー（isPlaceholder=true）として補完する。
 */
export async function fetchHistoricalForecast(
  lat: number,
  lon: number,
  startDate: string,
): Promise<ForecastData> {
  const { today, yesterday } = jstTodayAndYesterday();

  // API に渡す終了日: startDate+9 と昨日の小さい方
  const tentativeEnd = addDays(startDate, 9);
  const apiEndDate   = tentativeEnd < yesterday ? tentativeEnd : yesterday;

  // 昨日より後に開始している場合はデータなし
  let apiData: ForecastData | null = null;
  if (startDate <= yesterday) {
    apiData = await fetchRawHistorical(lat, lon, startDate, apiEndDate);
  }

  // 10 日分の配列を構築（昨日より後はプレースホルダー）
  const fullDaily: DailyForecastData[] = Array.from({ length: 10 }, (_, i) => {
    const dateStr = addDays(startDate, i);
    if (dateStr >= today) return createPlaceholderDay(dateStr);
    const existing = apiData?.daily.find(d => d.date === dateStr);
    return existing ?? createPlaceholderDay(dateStr);
  });

  return {
    hourly:    apiData?.hourly ?? [],
    daily:     fullDaily,
    fetchedAt: Date.now(),
  };
}
