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
}

export interface DailyForecastData {
  date: string;          // "2026-05-21"
  weatherCode: number;
  tempMax: number;       // ℃
  tempMin: number;       // ℃
  precipProbMax: number; // %
  precipSum: number;     // mm
  humidMin: number;      // %
  sunrise: string;       // "2026-05-21T04:43"
  sunset: string;        // "2026-05-21T18:52"
  radiationSum: number;  // MJ/m²
  snowfallSum: number;   // cm
  windSpeedMax: number;  // m/s
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
  ].join(',');

  const dailyParams = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_probability_max',
    'precipitation_sum', 'relative_humidity_2m_min',
    'sunrise', 'sunset',
    'shortwave_radiation_sum', 'snowfall_sum', 'wind_speed_10m_max',
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
  }));

  const daily: DailyForecastData[] = (raw.daily.time as string[]).map((t: string, i: number) => ({
    date:          t,
    weatherCode:   raw.daily.weather_code?.[i]                   ?? 0,
    tempMax:       raw.daily.temperature_2m_max?.[i]             ?? 0,
    tempMin:       raw.daily.temperature_2m_min?.[i]             ?? 0,
    precipProbMax: raw.daily.precipitation_probability_max?.[i]  ?? 0,
    precipSum:     raw.daily.precipitation_sum?.[i]              ?? 0,
    humidMin:      raw.daily.relative_humidity_2m_min?.[i]       ?? 100,
    sunrise:       raw.daily.sunrise?.[i]                        ?? '',
    sunset:        raw.daily.sunset?.[i]                         ?? '',
    radiationSum:  raw.daily.shortwave_radiation_sum?.[i]        ?? 0,
    snowfallSum:   raw.daily.snowfall_sum?.[i]                   ?? 0,
    windSpeedMax:  raw.daily.wind_speed_10m_max?.[i]             ?? 0,
  }));

  return { hourly, daily, fetchedAt: Date.now() };
}
