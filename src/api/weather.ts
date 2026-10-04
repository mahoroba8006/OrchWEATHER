import { format } from 'date-fns';
import { weatherFetch } from '../lib/weatherFetch';

/** 当年分は日々データが伸びるため、この時間で取り直す（過去年は確定値なので無期限） */
const CURRENT_YEAR_TTL_MS = 6 * 60 * 60 * 1000;
const weatherCache = new Map<string, { data: WeatherData; fetchedAt: number }>();

const JMA_START_YEAR = 2016;

function getApiConfig(year: number) {
  // 直接アクセス（通常運用）
  // archive-api が日本ネットワークから到達不能になった場合は下記プロキシ経由に切り替える:
  //   baseUrl: '/api/archive'  ← CF Pages Function (functions/api/archive.ts) 経由
  //   ローカル開発時は vite.config.ts の proxy 設定が /api/archive を転送する
  return {
    baseUrl: 'https://archive-api.open-meteo.com/v1/archive',
    modelParam: year >= JMA_START_YEAR ? '&models=jma_msm' : '&models=era5_land',
  };
}

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
  lat: number, lon: number, startDate: string, endDate: string, year: number
): Promise<{ tempMean: number; humidMean: number } | null> {
  const { baseUrl, modelParam } = getApiConfig(year);
  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}`
    + `&start_date=${startDate}&end_date=${endDate}`
    + `&daily=temperature_2m_mean,relative_humidity_2m_mean&timezone=Asia%2FTokyo${modelParam}`;
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
  const currentYear = new Date().getFullYear();
  const isCurrentYear = year === currentYear;

  const cached = weatherCache.get(key);
  if (cached && (!isCurrentYear || Date.now() - cached.fetchedAt < CURRENT_YEAR_TTL_MS)) return cached.data;

  const startDate = `${year}-01-01`;
  let endDate = `${year}-12-31`;

  if (isCurrentYear) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    endDate = format(yesterday, 'yyyy-MM-dd');
  }

  const { baseUrl, modelParam } = getApiConfig(year);
  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_max,relative_humidity_2m_min,relative_humidity_2m_mean,shortwave_radiation_sum,sunshine_duration&timezone=Asia%2FTokyo${modelParam}`;

  const response = await weatherFetch(url);
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
    fetchBoundaryMonthMeans(lat, lon, `${year - 1}-12-01`, `${year - 1}-12-31`, year - 1),
    year + 1 <= currentYear
      ? fetchBoundaryMonthMeans(lat, lon, `${year + 1}-01-01`, `${year + 1}-01-31`, year + 1)
      : Promise.resolve(null),
  ]);

  const result: WeatherData = {
    year,
    daily: processedData,
    prevDecMeans: prevDecMeans ?? undefined,
    nextJanMeans: nextJanMeans ?? undefined,
  };
  weatherCache.set(key, { data: result, fetchedAt: Date.now() });
  return result;
}

/** 季節のあしどり・節気ふりかえりで使う日別実績（DailyWeather の一部） */
export type DailyActual = Pick<DailyWeather, 'date' | 'tempMean' | 'tempMax' | 'tempMin' | 'precipSum' | 'sunshineDuration'>;

const actualsCache = new Map<string, { data: DailyActual[]; fetchedAt: number }>();

/** startDate〜endDate を1リクエストで取得（メモリに6時間キャッシュ） */
async function fetchActualsRange(lat: number, lon: number, startDate: string, endDate: string): Promise<DailyActual[]> {
  const key = `${lat},${lon},${startDate},${endDate}`;
  const cached = actualsCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CURRENT_YEAR_TTL_MS) return cached.data;

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}`
    + `&start_date=${startDate}&end_date=${endDate}`
    + '&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration'
    + '&timezone=Asia%2FTokyo&models=jma_msm';
  const raw = await (await weatherFetch(url)).json();
  const d = raw.daily;
  const data: DailyActual[] = [];
  (d.time as string[]).forEach((date, i) => {
    // archive の直近は未確定で null のことがある（その日は予報の過去日で補う）
    if (d.temperature_2m_mean[i] === null || d.temperature_2m_max[i] === null || d.temperature_2m_min[i] === null) return;
    data.push({
      date,
      tempMean: d.temperature_2m_mean[i],
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      precipSum: d.precipitation_sum[i] ?? 0,
      sunshineDuration: (d.sunshine_duration[i] ?? 0) / 3600,
    });
  });
  actualsCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

// ---- 確定した過去年の端末保存 ----
// Open-Meteo 無料枠は IP ごとに1分・1時間・1日の上限があり、長い期間の要求は2週間ごとに1回分として数える。
// 約6年分を開くたびに取り直すと1回で90〜180回分を消費し上限に達する（予報まで 429 で拒否される）ため、
// 変わらない過去年は端末に保存して2回目以降は今年分だけを取る。

const PAST_KEY_PREFIX = 'pastActuals:v1:';
/** 保存する地点数の上限（古いものから捨てる。1地点あたり約50KB） */
const PAST_MAX_LOCATIONS = 5;

/** 座標は 0.01°（約1km）に丸める。現在地の GPS の揺れで毎回取り直さないため（jma_msm の格子は約5km） */
const pastKey = (lat: number, lon: number) => `${PAST_KEY_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`;

/** 列ごとの配列で保存（start から1日ずつ連続。欠けのある範囲は保存しない） */
interface StoredPast { start: string; end: string; savedAt: number; t: number[]; mx: number[]; mn: number[]; p: number[]; s: number[] }

const utcDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const dayCount = (start: string, end: string) => utcDay(end) - utcDay(start) + 1;

function readPast(lat: number, lon: number, start: string, end: string): DailyActual[] | null {
  try {
    const raw = localStorage.getItem(pastKey(lat, lon));
    if (!raw) return null;
    const st = JSON.parse(raw) as StoredPast;
    if (st.start > start || st.end < end) return null;
    const from = utcDay(start) - utcDay(st.start);
    const n = dayCount(start, end);
    const out: DailyActual[] = [];
    for (let i = from; i < from + n; i++) {
      const date = new Date((utcDay(st.start) + i) * 86400000).toISOString().slice(0, 10);
      out.push({ date, tempMean: st.t[i], tempMax: st.mx[i], tempMin: st.mn[i], precipSum: st.p[i], sunshineDuration: st.s[i] });
    }
    return out;
  } catch {
    return null; // 保存領域が使えない・壊れている場合は取り直す
  }
}

function writePast(lat: number, lon: number, start: string, end: string, days: DailyActual[]): void {
  if (days.length !== dayCount(start, end)) return; // 欠けがある（未確定の日を含む）範囲は保存しない
  const st: StoredPast = {
    start, end, savedAt: Date.now(),
    t: days.map(d => d.tempMean), mx: days.map(d => d.tempMax), mn: days.map(d => d.tempMin),
    p: days.map(d => d.precipSum), s: days.map(d => d.sunshineDuration),
  };
  try {
    localStorage.setItem(pastKey(lat, lon), JSON.stringify(st));
    // 地点数の上限を超えたら、保存が古いものから消す
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PAST_KEY_PREFIX));
    if (keys.length > PAST_MAX_LOCATIONS) {
      const savedAt = (k: string) => { try { return (JSON.parse(localStorage.getItem(k) ?? '{}') as StoredPast).savedAt ?? 0; } catch { return 0; } };
      keys.sort((a, b) => savedAt(a) - savedAt(b)).slice(0, keys.length - PAST_MAX_LOCATIONS).forEach(k => localStorage.removeItem(k));
    }
  } catch {
    // 容量不足・プライベートモードなどで保存できなくても、表示は続ける（次回また取得するだけ）
  }
}

/**
 * startDate〜endDate の日別実績。archive API は同時接続数にも上限があり（超えると 429）、
 * 年ごとの並列取得は避けて、過去年と今年分の最大2リクエストを順番に行う。
 * 過去年（endDate の前年末まで）は端末に保存済みならそれを使う。期間は jma_msm の提供開始（2016年）以降が前提。
 */
export async function fetchDailyActuals(lat: number, lon: number, startDate: string, endDate: string): Promise<DailyActual[]> {
  const y = Number(endDate.slice(0, 4));
  const pastEnd = `${y - 1}-12-31`;
  const currentStart = startDate > `${y}-01-01` ? startDate : `${y}-01-01`;

  let past: DailyActual[] = [];
  if (startDate <= pastEnd) {
    const stored = readPast(lat, lon, startDate, pastEnd);
    if (stored) {
      past = stored;
    } else {
      past = await fetchActualsRange(lat, lon, startDate, pastEnd);
      writePast(lat, lon, startDate, pastEnd, past);
    }
  }
  const current = await fetchActualsRange(lat, lon, currentStart, endDate);
  return [...past, ...current];
}
