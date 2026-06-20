// src/api/historicalForecast.ts
// 過去の気象データ取得 — 3段階APIストラテジー
//
//   段階1: startDate >= today-14
//          → forecast API（完全データ）
//            CAPE ✅ / 0℃層高度 ✅ / 降水確率 ✅ / UV指数 ✅
//
//   段階2: 2022-01-01 <= startDate < today-14
//          → historical-forecast API（完全データ）
//            CAPE ✅ / 0℃層高度 ✅ / 降水確率 ✅ / UV指数 ✅
//
//   段階3: startDate < 2022-01-01
//          → archive API + ecmwf_ifs（CAPEのみ）
//            CAPE ✅（約8ヶ月分） / 0℃層高度 ❌（9999固定） / 降水確率 ❌ / UV指数 ❌
//
import type { ForecastData, DailyForecastData, HourlyForecast, FieldAvailability } from './forecast';
import { addDays } from '../lib/dateUtils';

// ── 定数 ──────────────────────────────────────────────────────────────────────

/** forecast API が過去を遡れる日数（open-meteo の仕様上 ~14日） */
const FORECAST_LOOKBACK_DAYS = 14;

/**
 * historical-forecast API のデータ開始日（実測により 2022-01-01 から有効値が返る）
 * これより前は freezinglevel_height / cape 等が null になるため archive API へフォールバック。
 */
const HISTORICAL_FORECAST_START = '2022-01-01';

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

/** API レスポンスにそのフィールドが実在し、有効値（非null）を含むか判定する */
function hasValues(arr: unknown): boolean {
  return Array.isArray(arr) && arr.some(v => v != null);
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
    amCodes: [], pmCodes: [], nightCodes: [],
    amPrecipProb:     null, pmPrecipProb:     null, nightPrecipProb:  null,
    amPrecipSum:      null, pmPrecipSum:      null, nightPrecipSum:   null,
    amTempMax: null, amTempMin: null,
    pmTempMax: null, pmTempMin: null,
    nightTempMax: null, nightTempMin: null,
    amWindMax: null, pmWindMax: null, nightWindMax: null,
  };
}

// ── AM/PM/夜間集計 ────────────────────────────────────────────────────────────

type DayAmPmEntry = {
  amCodes: number[]; pmCodes: number[]; nightCodes: number[];
  amProb: number | null; pmProb: number | null; nightProb: number | null;
  amPrecipSum: number;   pmPrecipSum: number;   nightPrecipSum: number;
  amWindMax: number | null; pmWindMax: number | null; nightWindMax: number | null;
};

/** 時間別データから AM(4-12) / PM(12-20) / 夜間(20-翌4) の集計マップを構築する */
function buildDayAmPmMap(hourly: HourlyForecast[]): Map<string, DayAmPmEntry> {
  const map = new Map<string, DayAmPmEntry>();

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

    if (!map.has(targetDate)) {
      map.set(targetDate, {
        amCodes: [], pmCodes: [], nightCodes: [],
        amProb: null, pmProb: null, nightProb: null,
        amPrecipSum: 0, pmPrecipSum: 0, nightPrecipSum: 0,
        amWindMax: null, pmWindMax: null, nightWindMax: null,
      });
    }
    const d = map.get(targetDate)!;
    if (period === 'am') {
      d.amCodes.push(h.weatherCode);
      d.amProb       = d.amProb === null ? h.precipProb  : Math.max(d.amProb,  h.precipProb);
      d.amPrecipSum += h.precipitation;
      d.amWindMax    = d.amWindMax === null ? h.windSpeed  : Math.max(d.amWindMax, h.windSpeed);
    } else if (period === 'pm') {
      d.pmCodes.push(h.weatherCode);
      d.pmProb       = d.pmProb === null ? h.precipProb  : Math.max(d.pmProb,  h.precipProb);
      d.pmPrecipSum += h.precipitation;
      d.pmWindMax    = d.pmWindMax === null ? h.windSpeed  : Math.max(d.pmWindMax, h.windSpeed);
    } else {
      d.nightCodes.push(h.weatherCode);
      d.nightProb       = d.nightProb === null ? h.precipProb  : Math.max(d.nightProb,  h.precipProb);
      d.nightPrecipSum += h.precipitation;
      d.nightWindMax    = d.nightWindMax === null ? h.windSpeed  : Math.max(d.nightWindMax, h.windSpeed);
    }
  }

  return map;
}

/** AM/PM/夜間集計マップから daily エントリのフィールドを展開する */
function expandDayAmPm(map: Map<string, DayAmPmEntry>, t: string) {
  return {
    amCodes:   map.get(t)?.amCodes    ?? [],
    pmCodes:   map.get(t)?.pmCodes    ?? [],
    nightCodes: map.get(t)?.nightCodes ?? [],
    amPrecipProb:     map.get(t)?.amProb    ?? null,
    pmPrecipProb:     map.get(t)?.pmProb    ?? null,
    nightPrecipProb:  map.get(t)?.nightProb ?? null,
    amPrecipSum:      map.has(t) ? map.get(t)!.amPrecipSum    : null,
    pmPrecipSum:      map.has(t) ? map.get(t)!.pmPrecipSum    : null,
    nightPrecipSum:   map.has(t) ? map.get(t)!.nightPrecipSum : null,
    amTempMax: null, amTempMin: null,
    pmTempMax: null, pmTempMin: null,
    nightTempMax: null, nightTempMin: null,
    amWindMax:    map.get(t)?.amWindMax    ?? null,
    pmWindMax:    map.get(t)?.pmWindMax    ?? null,
    nightWindMax: map.get(t)?.nightWindMax ?? null,
  };
}

// ── API フェッチ（段階1・2共通） ─────────────────────────────────────────────

/**
 * forecast / historical-forecast の両エンドポイントで使えるフェッチ共通実装。
 * どちらも同じパラメーター体系・レスポンス形式を持つ。
 *
 * @param baseUrl  'https://api.open-meteo.com/v1/forecast'
 *              or 'https://historical-forecast-api.open-meteo.com/v1/forecast'
 */
async function fetchViaForecastEndpoint(
  baseUrl: string,
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<ForecastData> {
  const hourlyParams = [
    'temperature_2m', 'precipitation', 'precipitation_probability',
    'dew_point_2m', 'relative_humidity_2m',
    'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    'cape', 'freezinglevel_height',
    'pressure_msl', 'weather_code', 'shortwave_radiation', 'snowfall', 'uv_index',
  ].join(',');

  const dailyParams = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_sum', 'precipitation_probability_max',
    'relative_humidity_2m_min', 'relative_humidity_2m_max',
    'sunrise', 'sunset',
    'shortwave_radiation_sum', 'snowfall_sum', 'wind_speed_10m_max',
    'sunshine_duration',
  ].join(',');

  const url = baseUrl
    + `?latitude=${lat}&longitude=${lon}`
    + '&timezone=Asia%2FTokyo'
    + '&wind_speed_unit=ms'
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

  const hourly: HourlyForecast[] = (raw.hourly.time as string[]).map((t: string, i: number) => ({
    time:          t,
    temperature:   raw.hourly.temperature_2m?.[i]            ?? 0,
    precipitation: raw.hourly.precipitation?.[i]             ?? 0,
    precipProb:    raw.hourly.precipitation_probability?.[i] ?? 0,
    dewPoint:      raw.hourly.dew_point_2m?.[i]              ?? 0,
    humidity:      raw.hourly.relative_humidity_2m?.[i]      ?? 0,
    windSpeed:     raw.hourly.wind_speed_10m?.[i]            ?? 0,
    windDirection: raw.hourly.wind_direction_10m?.[i]        ?? 0,
    windGusts:     raw.hourly.wind_gusts_10m?.[i]            ?? 0,
    cape:          raw.hourly.cape?.[i]                      ?? 0,
    freezingLevel: raw.hourly.freezinglevel_height?.[i]      ?? 9999,
    pressure:      raw.hourly.pressure_msl?.[i]              ?? 1013,
    weatherCode:   raw.hourly.weather_code?.[i]              ?? 0,
    radiation:     raw.hourly.shortwave_radiation?.[i]       ?? 0,
    snowfall:      raw.hourly.snowfall?.[i]                  ?? 0,
    uvIndex:       raw.hourly.uv_index?.[i]                  ?? 0,
  }));

  const dayAmPm = buildDayAmPmMap(hourly);

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
    ...expandDayAmPm(dayAmPm, t),
  }));

  const availability: FieldAvailability = {
    precipProb:    hasValues(raw.hourly.precipitation_probability),
    freezingLevel: hasValues(raw.hourly.freezinglevel_height),
    uvIndex:       hasValues(raw.hourly.uv_index),
    cape:          hasValues(raw.hourly.cape),
  };

  return { hourly, daily, pastDaily: [], fetchedAt: Date.now(), availability };
}

// ── API フェッチ（段階3） ─────────────────────────────────────────────────────

/**
 * 段階3: archive API + ecmwf_ifs（2022-01-01 より前）
 * CAPEは約8ヶ月前まで取得可能。0℃層高度・降水確率・UV指数は非対応（固定値で補完）。
 */
async function fetchViaArchiveApi(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<ForecastData> {
  // ecmwf_ifs: アーカイブAPIでCAPEを提供できる唯一のモデル（ERA5はCAPEなし）
  // freezinglevel_height は全モデルで取得不可（null → 9999 でフォールバック）
  const hourlyParams = [
    'temperature_2m', 'precipitation',
    'cape',
    'dew_point_2m', 'relative_humidity_2m',
    'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    'pressure_msl', 'weather_code', 'shortwave_radiation', 'snowfall',
  ].join(',');

  // アーカイブAPIは precipitation_probability_max を持たない（null → 0 でフォールバック）
  const dailyParams = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_sum', 'relative_humidity_2m_min', 'relative_humidity_2m_max',
    'sunrise', 'sunset',
    'shortwave_radiation_sum', 'snowfall_sum', 'wind_speed_10m_max',
    'sunshine_duration',
  ].join(',');

  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${lat}&longitude=${lon}`
    + '&timezone=Asia%2FTokyo'
    + '&wind_speed_unit=ms'
    + '&models=ecmwf_ifs'
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

  const hourly: HourlyForecast[] = (raw.hourly.time as string[]).map((t: string, i: number) => ({
    time:          t,
    temperature:   raw.hourly.temperature_2m?.[i]         ?? 0,
    precipitation: raw.hourly.precipitation?.[i]          ?? 0,
    precipProb:    0,    // archive API は降水確率なし
    dewPoint:      raw.hourly.dew_point_2m?.[i]           ?? 0,
    humidity:      raw.hourly.relative_humidity_2m?.[i]   ?? 0,
    windSpeed:     raw.hourly.wind_speed_10m?.[i]         ?? 0,
    windDirection: raw.hourly.wind_direction_10m?.[i]     ?? 0,
    windGusts:     raw.hourly.wind_gusts_10m?.[i]         ?? 0,
    cape:          raw.hourly.cape?.[i]                   ?? 0,  // ecmwf_ifs で約8ヶ月分取得可
    freezingLevel: 9999,  // archive API はいかなるモデルでも 0℃層高度なし
    pressure:      raw.hourly.pressure_msl?.[i]           ?? 1013,
    weatherCode:   raw.hourly.weather_code?.[i]           ?? 0,
    radiation:     raw.hourly.shortwave_radiation?.[i]    ?? 0,
    snowfall:      raw.hourly.snowfall?.[i]               ?? 0,
    uvIndex:       0,    // archive API はUV指数なし
  }));

  const dayAmPm = buildDayAmPmMap(hourly);

  const daily: DailyForecastData[] = (raw.daily.time as string[]).map((t: string, i: number) => ({
    date:             t,
    weatherCode:      raw.daily.weather_code?.[i]                   ?? 0,
    tempMax:          raw.daily.temperature_2m_max?.[i]             ?? 0,
    tempMin:          raw.daily.temperature_2m_min?.[i]             ?? 0,
    precipProbMax:    raw.daily.precipitation_probability_max?.[i]  ?? 0,  // 常に null → 0
    precipSum:        raw.daily.precipitation_sum?.[i]              ?? 0,
    humidMin:         raw.daily.relative_humidity_2m_min?.[i]       ?? 100,
    humidMax:         raw.daily.relative_humidity_2m_max?.[i]       ?? 0,
    sunrise:          raw.daily.sunrise?.[i]                        ?? '',
    sunset:           raw.daily.sunset?.[i]                         ?? '',
    radiationSum:     raw.daily.shortwave_radiation_sum?.[i]        ?? 0,
    snowfallSum:      raw.daily.snowfall_sum?.[i]                   ?? 0,
    windSpeedMax:     raw.daily.wind_speed_10m_max?.[i]             ?? 0,
    sunshineDuration: (raw.daily.sunshine_duration?.[i] ?? 0) / 3600,
    ...expandDayAmPm(dayAmPm, t),
  }));

  // archive API は降水確率・0℃層高度・UV指数を要求していない（レスポンスに不在）。
  // CAPE は ecmwf_ifs で取得しており、値があれば available とする。
  const availability: FieldAvailability = {
    precipProb:    hasValues(raw.hourly.precipitation_probability),
    freezingLevel: hasValues(raw.hourly.freezinglevel_height),
    uvIndex:       hasValues(raw.hourly.uv_index),
    cape:          hasValues(raw.hourly.cape),
  };

  return { hourly, daily, pastDaily: [], fetchedAt: Date.now(), availability };
}

// ── エクスポート ──────────────────────────────────────────────────────────────

/**
 * startDate から 10 日分の過去気象データを取得する。
 *
 * API 選択ロジック（3段階）:
 *   段階1: startDate >= today-14
 *          → forecast API（完全データ）
 *   段階2: HISTORICAL_FORECAST_START <= startDate < today-14
 *          → historical-forecast API（完全データ、2022年以降）
 *   段階3: startDate < HISTORICAL_FORECAST_START
 *          → archive API + ecmwf_ifs（CAPE取得可、0℃層高度は9999固定）
 *
 * 今日以降の日はプレースホルダー（isPlaceholder=true）として補完する。
 */
export async function fetchHistoricalForecast(
  lat: number,
  lon: number,
  startDate: string,
): Promise<ForecastData> {
  const { today, yesterday } = jstTodayAndYesterday();

  // forecast API が遡れる上限日（inclusive）
  const forecastCutoff = addDays(today, -FORECAST_LOOKBACK_DAYS);

  // API に渡す終了日: startDate+9 と昨日の小さい方
  const tentativeEnd = addDays(startDate, 9);
  const apiEndDate   = tentativeEnd < yesterday ? tentativeEnd : yesterday;

  let apiData: ForecastData | null = null;
  if (startDate <= yesterday) {
    if (startDate >= forecastCutoff) {
      // 段階1: 直近14日 → forecast API（完全データ）
      apiData = await fetchViaForecastEndpoint(
        'https://api.open-meteo.com/v1/forecast',
        lat, lon, startDate, apiEndDate,
      );
    } else if (startDate >= HISTORICAL_FORECAST_START) {
      // 段階2: 2022-01-01 以降 → historical-forecast API（完全データ）
      apiData = await fetchViaForecastEndpoint(
        'https://historical-forecast-api.open-meteo.com/v1/forecast',
        lat, lon, startDate, apiEndDate,
      );
    } else {
      // 段階3: 2022年より前 → archive API + ecmwf_ifs（CAPE取得可）
      apiData = await fetchViaArchiveApi(lat, lon, startDate, apiEndDate);
    }
  }

  // 10 日分の配列を構築（今日以降はプレースホルダー）
  const fullDaily: DailyForecastData[] = Array.from({ length: 10 }, (_, i) => {
    const dateStr = addDays(startDate, i);
    if (dateStr >= today) return createPlaceholderDay(dateStr);
    const existing = apiData?.daily.find(d => d.date === dateStr);
    return existing ?? createPlaceholderDay(dateStr);
  });

  return {
    hourly:    apiData?.hourly ?? [],
    daily:     fullDaily,
    pastDaily: [],
    fetchedAt: Date.now(),
    availability: apiData?.availability,
  };
}
