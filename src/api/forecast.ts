// src/api/forecast.ts

export interface HourlyForecast {
  time: string;          // "2026-05-21T15:00"
  temperature: number;   // ℃
  precipitation: number; // mm
  precipProb: number;    // %
  dewPoint: number;      // ℃
  humidity: number;      // %
  windSpeed: number;     // m/s
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
  amWeatherCode: number | null; // WMO max 06:00-11:00
  pmWeatherCode: number | null; // WMO max 12:00-17:00
  amPrecipProb:  number | null; // % max 06:00-11:00
  pmPrecipProb:  number | null; // % max 12:00-17:00
  amPrecipSum:   number | null; // mm sum 00:00-11:59（時間別データがある日のみ）
  pmPrecipSum:   number | null; // mm sum 12:00-23:59（時間別データがある日のみ）
}

export interface ForecastData {
  hourly: HourlyForecast[];    // 72エントリ
  daily: DailyForecastData[];  // 11エントリ
  fetchedAt: number;           // Date.now()
}

export async function fetchForecast(lat: number, lon: number): Promise<ForecastData> {
  const hourlyParams = [
    'temperature_2m', 'precipitation', 'precipitation_probability',
    'dew_point_2m', 'relative_humidity_2m',
    'wind_speed_10m', 'wind_gusts_10m',
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
    + '&past_hours=6'
    + '&forecast_days=11'
    + '&forecast_hours=72'
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
    windGusts:     raw.hourly.wind_gusts_10m?.[i]              ?? 0,
    cape:          raw.hourly.cape?.[i]                         ?? 0,
    freezingLevel: raw.hourly.freezinglevel_height?.[i]        ?? 9999,
    pressure:      raw.hourly.pressure_msl?.[i]                ?? 1013,
    weatherCode:   raw.hourly.weather_code?.[i]                ?? 0,
    radiation:     raw.hourly.shortwave_radiation?.[i]         ?? 0,
    snowfall:      raw.hourly.snowfall?.[i]                    ?? 0,
    uvIndex:       raw.hourly.uv_index?.[i]                   ?? 0,
  }));

  // 午前(6-11時)・午後(12-17時)別に最大 weatherCode / precipProb を hourly から集計
  const dayAmPm = new Map<string, {
    amCode: number | null; pmCode: number | null;
    amProb: number | null; pmProb: number | null;
    amPrecipSum: number;   pmPrecipSum: number;
  }>();
  for (const h of hourly) {
    const date = h.time.slice(0, 10);
    const hr = parseInt(h.time.slice(11, 13), 10);
    if (!dayAmPm.has(date)) dayAmPm.set(date, { amCode: null, pmCode: null, amProb: null, pmProb: null, amPrecipSum: 0, pmPrecipSum: 0 });
    const d = dayAmPm.get(date)!;
    if (hr < 12) {
      d.amCode       = d.amCode === null ? h.weatherCode : Math.max(d.amCode, h.weatherCode);
      d.amProb       = d.amProb === null ? h.precipProb  : Math.max(d.amProb,  h.precipProb);
      d.amPrecipSum += h.precipitation;
    } else {
      d.pmCode       = d.pmCode === null ? h.weatherCode : Math.max(d.pmCode, h.weatherCode);
      d.pmProb       = d.pmProb === null ? h.precipProb  : Math.max(d.pmProb,  h.precipProb);
      d.pmPrecipSum += h.precipitation;
    }
  }

  const daily: DailyForecastData[] = (raw.daily.time as string[]).map((t: string, i: number) => ({
    date:          t,
    weatherCode:   raw.daily.weather_code?.[i]                   ?? 0,
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
    amWeatherCode: dayAmPm.get(t)?.amCode ?? null,
    pmWeatherCode: dayAmPm.get(t)?.pmCode ?? null,
    amPrecipProb:  dayAmPm.get(t)?.amProb ?? null,
    pmPrecipProb:  dayAmPm.get(t)?.pmProb ?? null,
    amPrecipSum:   dayAmPm.has(t) ? dayAmPm.get(t)!.amPrecipSum : null,
    pmPrecipSum:   dayAmPm.has(t) ? dayAmPm.get(t)!.pmPrecipSum : null,
  }));

  return { hourly, daily, fetchedAt: Date.now() };
}
