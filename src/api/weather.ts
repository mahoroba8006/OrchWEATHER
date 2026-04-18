import { format } from 'date-fns';

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
  accumPrecip: number;
  accumRadiation: number;
}

export interface WeatherData {
  year: number;
  daily: DailyWeather[];
}

export async function fetchWeatherData(lat: number, lon: number, year: number): Promise<WeatherData> {
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
  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_max,relative_humidity_2m_min,relative_humidity_2m_mean,shortwave_radiation_sum&timezone=Asia%2FTokyo`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const rawData = await response.json();
  const daily = rawData.daily;

  let currentAccumPrecip = 0;
  let currentAccumRadiation = 0;

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

    currentAccumPrecip += precipSum;
    currentAccumRadiation += radiation;

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
      accumPrecip: currentAccumPrecip,
      accumRadiation: currentAccumRadiation,
    });
  });

  return { year, daily: processedData };
}
