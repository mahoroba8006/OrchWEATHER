import { format } from 'date-fns';

const weatherCache = new Map<string, WeatherData>();

function buildCacheKey(lat: number, lon: number, year: number): string {
  return `${lat},${lon},${year}`;
}

export interface DailyWeather {
  date: string;
  tempMean: number;
  tempMax: number;
  tempMin: number;
  precipSum: number;
  humidMean: number;
  humidMax: number;
  humidMin: number;
  radiation: number; // 日射量(MJ/m²)
  sunshineDuration: number; // 日照時間(h)
  accumPrecip: number;
  accumRadiation: number;
  accumSunshineDuration: number; // 累積日照時間(h)
}

export interface WeatherData {
  year: number;
  daily: DailyWeather[];
  prevDecMeans?: { tempMean: number; humidMean: number };
  nextJanMeans?: { tempMean: number; humidMean: number };
}

async function fetchBoundaryMonthMeans(
  lat: number, lon: number, startDate: string, endDate: string
): Promise<{ tempMean: number; humidMean: number } | null> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}`
    + `&start_date=${startDate}&end_date=${endDate}`
    + `&daily=temperature_2m_mean,relative_humidity_2m_mean&timezone=Asia%2FTokyo`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = await res.json();
    const temps: number[] = (raw.daily.temperature_2m_mean as (number | null)[]).filter((v): v is number => v !== null);
    const humids: number[] = (raw.daily.relative_humidity_2m_mean as (number | null)[]).filter((v): v is number => v !== null);
    if (temps.length === 0) return null;
    return {
      tempMean: temps.reduce((a, b) => a + b, 0) / temps.length,
      humidMean: humids.reduce((a, b) => a + b, 0) / humids.length,
    };
  } catch {
    return null;
  }
}

export async function fetchWeatherData(lat: number, lon: number, year: number): Promise<WeatherData> {
  const key = buildCacheKey(lat, lon, year);
  if (weatherCache.has(key)) return weatherCache.get(key)!;

  const currentYear = new Date().getFullYear();
  const isCurrentYear = year === currentYear;

  const startDate = `${year}-01-01`;
  let endDate = `${year}-12-31`;

  if (isCurrentYear) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    endDate = format(yesterday, 'yyyy-MM-dd');
  }

  const baseUrl = 'https://archive-api.open-meteo.com/v1/archive';
  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_max,relative_humidity_2m_min,relative_humidity_2m_mean,shortwave_radiation_sum,sunshine_duration&timezone=Asia%2FTokyo`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const rawData = await response.json();
  const daily = rawData.daily;

  let currentAccumPrecip = 0;
  let currentAccumRadiation = 0;
  let currentAccumSunshineDuration = 0;

  const processedData: DailyWeather[] = [];

  daily.time.forEach((timeStr: string, index: number) => {
    if (daily.temperature_2m_mean[index] === null) return;

    const tempMean = daily.temperature_2m_mean[index];
    const tempMax = daily.temperature_2m_max[index];
    const tempMin = daily.temperature_2m_min[index];
    const precipSum = daily.precipitation_sum ? daily.precipitation_sum[index] : 0;
    const humidMean = daily.relative_humidity_2m_mean ? daily.relative_humidity_2m_mean[index] : 0;
    const humidMax = daily.relative_humidity_2m_max ? daily.relative_humidity_2m_max[index] : 0;
    const humidMin = daily.relative_humidity_2m_min ? daily.relative_humidity_2m_min[index] : 0;
    const radiation = daily.shortwave_radiation_sum ? daily.shortwave_radiation_sum[index] : 0;
    const sunshineDuration = daily.sunshine_duration ? (daily.sunshine_duration[index] ?? 0) / 3600 : 0;

    currentAccumPrecip += precipSum;
    currentAccumRadiation += radiation;
    currentAccumSunshineDuration += sunshineDuration;

    processedData.push({
      date: timeStr,
      tempMean,
      tempMax,
      tempMin,
      precipSum,
      humidMean,
      humidMax,
      humidMin,
      radiation,
      sunshineDuration,
      accumPrecip: currentAccumPrecip,
      accumRadiation: currentAccumRadiation,
      accumSunshineDuration: currentAccumSunshineDuration,
    });
  });

  const [prevDecMeans, nextJanMeans] = await Promise.all([
    fetchBoundaryMonthMeans(lat, lon, `${year - 1}-12-01`, `${year - 1}-12-31`),
    fetchBoundaryMonthMeans(lat, lon, `${year + 1}-01-01`, `${year + 1}-01-31`),
  ]);

  const result: WeatherData = {
    year,
    daily: processedData,
    prevDecMeans: prevDecMeans ?? undefined,
    nextJanMeans: nextJanMeans ?? undefined,
  };
  weatherCache.set(key, result);
  return result;
}
