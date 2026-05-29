import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CloudRain, Thermometer, Droplets, DropletOff, Leaf, Settings, Sun, Plus, X, LogOut, Clock, MapPin, Loader2 } from 'lucide-react';
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, LabelList } from 'recharts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useAppStore } from './store';
import { SettingsTab } from './components/settings/SettingsTab';
import { useWeatherData, type CompareTarget } from './hooks/useWeather';
import { useForecast } from './hooks/useForecast';
import { MonthsTable } from './components/MonthsTable';
import { LoginScreen } from './components/LoginScreen';
import { auth } from './lib/firebase';
import { ensureUserDocument } from './lib/userRepository';
import { GEO_OPTIONS, getGeoErrorMessage } from './lib/geo';
import { WeatherTab } from './components/weather/WeatherTab';
import { HistoricalWeatherTab } from './components/weather/HistoricalWeatherTab';
import { Footer } from './components/Footer';
import './App.css';

const CustomWideBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (x === undefined || y === undefined || height === undefined || height <= 0) {
    return null;
  }
  // 日次の細い幅を無視して、月間用の太いバーを強制的に描画する
  const customWidth = 16; // 以前の24pxの約70%
  const offsetX = x + width / 2 - customWidth / 2;
  return (
    <rect 
      x={offsetX} 
      y={y} 
      width={customWidth} 
      height={height} 
      fill={fill} 
      fillOpacity={0.25} 
      rx={3} 
      ry={3}
    />
  );
};

const CustomRangeBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (x === undefined || y === undefined || height === undefined || height <= 0) {
    return null;
  }
  const centerX = x + width / 2;
  const capWidth = 2; // キャップの幅を短く変更
  return (
    <g opacity={0.4}>
      <line x1={centerX} y1={y} x2={centerX} y2={y + height} stroke={fill} strokeWidth={1.5} />
      <line x1={centerX - capWidth} y1={y} x2={centerX + capWidth} y2={y} stroke={fill} strokeWidth={1.5} />
      <line x1={centerX - capWidth} y1={y + height} x2={centerX + capWidth} y2={y + height} stroke={fill} strokeWidth={1.5} />
    </g>
  );
};

const ForecastRangeBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (x === undefined || y === undefined || height === undefined || height <= 0) {
    return null;
  }
  const centerX = x + width / 2;
  const capWidth = 2;
  return (
    <g opacity={0.7}>
      <line x1={centerX} y1={y} x2={centerX} y2={y + height} stroke={fill} strokeWidth={1.5} strokeDasharray="5 4" />
      <line x1={centerX - capWidth} y1={y} x2={centerX + capWidth} y2={y} stroke={fill} strokeWidth={1.5} />
      <line x1={centerX - capWidth} y1={y + height} x2={centerX + capWidth} y2={y + height} stroke={fill} strokeWidth={1.5} />
    </g>
  );
};

type ChartId = 'temp' | 'precip' | 'sunshine' | 'radiation' | 'gdd' | 'humid' | 'vpd';

const CHART_TABS: { id: ChartId; label: string }[] = [
  { id: 'temp',      label: '気温' },
  { id: 'precip',    label: '降水量' },
  { id: 'gdd',       label: '積算温度' },
  { id: 'radiation', label: '日射量' },
  { id: 'sunshine',  label: '日照時間' },
  { id: 'humid',     label: '湿度' },
  { id: 'vpd',       label: '飽差' },
];

// 飽差 = 飽和水蒸気量 - 実水蒸気量 [g/m³]（施設園芸の現場標準単位）
// e_s(T)[hPa] = 6.1078 × 10^(7.5T/(T+237.3))（Tetens式）
// 飽和水蒸気量[g/m³] = 216.67 × e_s / (T + 273.15) （理想気体の状態方程式）
const calcVPD = (tempC: number, humidPct: number): number => {
  const e_s_hPa = 6.1078 * Math.pow(10, 7.5 * tempC / (tempC + 237.3));
  const a_max = 216.67 * e_s_hPa / (tempC + 273.15);
  return a_max * (1 - humidPct / 100);
};

// MM-DD → 日番号（非閏年ベース、2/29は便宜上60を返す）
const MONTH_DAY_OFFSETS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const mmddToDoy = (mmdd: string): number | null => {
  if (!mmdd || !mmdd.includes('-')) return null;
  const [m, d] = mmdd.split('-').map(Number);
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12) return null;
  return MONTH_DAY_OFFSETS[m - 1] + d;
};

// GDD逆引き: 累積系列 series で初めて accum >= v になる MM-DD を返す（未到達なら null）
const findDateByAccum = (
  series: Array<{ mmdd: string; accum: number }>,
  v: number
): string | null => {
  for (const point of series) {
    if (point.accum >= v) return point.mmdd;
  }
  return null;
};

// GDD序盤の Δ日 表示を抑制する閾値（℃）
const GDD_DELTA_DAYS_MIN_V0 = 30;

// 累積日射量 序盤の Δ日 表示を抑制する閾値（MJ/m²）
const RADIATION_DELTA_DAYS_MIN_V0 = 100;

/**
 * モバイル用デフォルト viewport を計算する
 * start = 今日の月 −2 の月初日、end = 今日の月 +1 の月末日
 * 選択年のデータに当てはめてインデックスを返す（季節比較が目的）
 */
function calcMobileDefaultViewport(
  data: { dateStr: string }[],
  today: Date,
  selectedYear: number
): { start: number; end: number } | null {
  if (data.length === 0) return null;

  const todayMonth = today.getMonth() + 1; // 1–12

  // start: 2ヶ月前の月初
  let startMonth = todayMonth - 2;
  if (startMonth <= 0) startMonth += 12;

  // end: 翌月の月末
  let endMonth = todayMonth + 1;
  if (endMonth > 12) endMonth -= 12;

  const startStr = `${String(startMonth).padStart(2, '0')}-01`;
  // new Date(year, month, 0).getDate() = その月の最終日
  const lastDay = new Date(selectedYear, endMonth, 0).getDate();
  const endStr = `${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // start index: startStr 以上の最初のエントリ
  let startIdx = data.findIndex(d => d?.dateStr && d.dateStr >= startStr);
  if (startIdx === -1) startIdx = 0;

  // end index: endStr 以下の最後のエントリ
  // 年またぎ（startMonth > endMonth）のとき endStr < startStr になるので data末尾へクランプ
  let endIdx = data.length - 1;
  if (endStr >= startStr) {
    for (let i = data.length - 1; i >= 0; i--) {
      const d = data[i];
      if (d?.dateStr && d.dateStr <= endStr) { endIdx = i; break; }
    }
  }

  if (startIdx >= endIdx) return null;
  return { start: startIdx, end: endIdx + 1 };
}

function App() {
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings, geoLocation, setGeoLocation, setGeoStatus } = useAppStore();
  const [topTab, setTopTab] = useState<'weather' | 'history' | 'analysis' | 'settings'>('weather');
  const currentYear = new Date().getFullYear();
  const [selectedBaseTempIndex, setSelectedBaseTempIndex] = useState<0 | 1>(0);
  const [displayRange, setDisplayRange] = useState({ startMM: 1, endMM: 12 });
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'monthly'>('daily');
  const [activeChart, setActiveChart] = useState<ChartId>('temp');
  const [hover, setHover] = useState<{ chartId: string; payload: any[]; label: string } | null>(null);
  const pendingHoverRef = useRef<{ chartId: string; payload: any[]; label: string } | null>(null);
  const hoverRafRef = useRef<number>(0);

  // モバイル判定（マウント時1回のみ。リサイズで再判定しないことで操作中のリセットを防ぐ）
  const [isMobile] = useState(() => window.innerWidth < 768);

  // Bitgo風: 日次モードのパン可能ウィンドウ（365日）
  const DAILY_WINDOW = 365;
  const [dailyViewport, setDailyViewport] = useState<{ start: number; end: number } | null>(null);
  const panRef = useRef<{ startX: number; startViewportStart: number; dragging: boolean; chartId: string } | null>(null);
  const panRafRef = useRef<number>(0);
  const pendingViewportRef = useRef<{ start: number; end: number } | null>(null);
  const chartFrameRef = useRef<HTMLDivElement | null>(null);
  const [chartPixelWidth, setChartPixelWidth] = useState(300);

  // チャート幅をresizeに合わせて計測（pan時の dx → indices 換算用）
  // 計測対象は first ChartFrame（loading解除後にmountするため callback ref で観測開始）
  const chartFrameCbRef = useCallback((el: HTMLDivElement | null) => {
    chartFrameRef.current = el;
    if (!el) return;
    setChartPixelWidth(el.offsetWidth);
    const obs = new ResizeObserver(() => setChartPixelWidth(el.offsetWidth));
    obs.observe(el);
    (el as any).__obs = obs;
  }, []);

  // チャートを切り替えたとき前のホバー値をクリア
  useEffect(() => {
    setHover(null);
  }, [activeChart]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // ensureUserDocument を直列で先に実行。getDocFromServer と並行すると
          // setDoc 書き込み中のスナップショットを掴んで部分データが返る競合が起きる
          await ensureUserDocument(firebaseUser.uid);
          await Promise.all([
            loadLocations(firebaseUser.uid),
            loadUserSettings(firebaseUser.uid),
          ]);
        } catch (error) {
          console.error("Failed to load user settings or locations:", error);
        }
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const geoAttemptedRef = useRef(false);
  const [analysisGeoLoading, setAnalysisGeoLoading] = useState(false);
  const [analysisGeoError, setAnalysisGeoError] = useState('');

  // 起動時: デフォルト地点がなければ自動で現在地を取得する
  useEffect(() => {
    if (authLoading) return;
    if (geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;

    const defaultLocId = userSettings?.defaultLocationId;
    const hasValidDefault = defaultLocId && locations.some(l => l.id === defaultLocId);
    if (hasValidDefault) return;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('error');
      return;
    }

    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
        setGeoStatus('idle');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, [authLoading]);

  const initialLocation = locations.length > 0 ? locations[0].id : '';
  const [targets, setTargets] = useState<CompareTarget[]>([
    { id: `t_${Date.now()}`, locationId: initialLocation, year: new Date().getFullYear() }
  ]);

  // マスターデータから削除された地点を掴んでいるターゲットを自動復旧させる
  useEffect(() => {
    setTargets(prev => {
      let changed = false;
      const validIds = new Set(locations.map(l => l.id));
      const defaultLocId = userSettings?.defaultLocationId;
      const hasValidDefault = defaultLocId && validIds.has(defaultLocId);
      const next = prev.map(t => {
        // __geo__ は仮想地点なので復旧対象外
        if (t.locationId === '__geo__') return t;
        if (!validIds.has(t.locationId)) {
          changed = true;
          const fallback = hasValidDefault
            ? defaultLocId!
            : locations.length > 0 ? locations[0].id : '';
          return { ...t, locationId: fallback };
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, [locations, userSettings?.defaultLocationId]);

  // geoLocation が取得されたとき locationId が空の targets を __geo__ に切り替える
  useEffect(() => {
    if (!geoLocation) return;
    setTargets(prev => {
      const hasEmpty = prev.some(t => t.locationId === '');
      if (!hasEmpty) return prev;
      return prev.map(t => t.locationId === '' ? { ...t, locationId: '__geo__' } : t);
    });
  }, [geoLocation]);

  const firstOfMonths = Array.from({length: 12}, (_, i) => `${String(i + 1).padStart(2, '0')}-01`);

  const lastDayOfMonth = (mm: number) => new Date(2000, mm, 0).getDate();

  const handleRangeChange = (field: 'startMM' | 'endMM', value: number) => {
    setDisplayRange(prev => {
      const next = { ...prev, [field]: value };
      if (next.startMM > next.endMM) return prev;
      return next;
    });
  };

  const { data: weatherData, loading, loadingStatus, error } = useWeatherData(targets);

  // 分析タブ用予報データ（targets[0] の地点のみ取得）
  const forecastLoc = useMemo(() => {
    const t = targets[0];
    if (!t) return null;
    const loc = t.locationId === '__geo__'
      ? geoLocation
      : locations.find(l => l.id === t.locationId);
    return loc ? { lat: loc.lat, lon: loc.lon } : null;
  }, [targets, locations, geoLocation]);

  const { data: forecastData } = useForecast(
    forecastLoc?.lat ?? null,
    forecastLoc?.lon ?? null,
  );

  const addTarget = () => {
    if (targets.length >= 2) return;
    const lastTarget = targets[targets.length - 1];
    setTargets([
      ...targets, 
      { 
        id: `t_${Date.now()}_${Math.random().toString(36).substring(2)}`, 
        locationId: lastTarget?.locationId || initialLocation, 
        year: (lastTarget?.year || new Date().getFullYear()) - 1 
      }
    ]);
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
  };

  const updateTarget = (id: string, field: 'locationId' | 'year', value: string | number) => {
    setTargets(targets.map(t => {
      if (t.id === id) {
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  const getLocationName = (id: string) => {
    if (id === '__geo__') return '現在地';
    const loc = locations.find(l => l.id === id);
    return loc ? loc.name : '未設定';
  };

  // Convert raw API data into Recharts format grouped by MM-DD
  const baseChartData = useMemo(() => {
    if (Object.keys(weatherData).length === 0) return [];

    const map = new Map<string, any>();

    targets.forEach((target, index) => {
      const data = weatherData[target.id];
      if (!data) return;

      const monthlyMean = new Map<string, number>();
      const monthlyPrecipSum = new Map<string, number>();
      const monthlyHumidMean = new Map<string, number>();
      const monthlyVpdMeanMap = new Map<string, number>();
      const monthlyVpdMaxMean = new Map<string, number>();
      for (let m = 1; m <= 12; m++) {
        const monthStr = m.toString().padStart(2, '0');
        const daysInMonth = data.daily.filter(d => d.date.substring(5, 7) === monthStr);
        if (daysInMonth.length > 0) {
          const sumTemp = daysInMonth.reduce((acc, d) => acc + d.tempMean, 0);
          monthlyMean.set(monthStr, sumTemp / daysInMonth.length);

          const sumPrecip = daysInMonth.reduce((acc, d) => acc + d.precipSum, 0);
          monthlyPrecipSum.set(monthStr, sumPrecip);

          const sumHumid = daysInMonth.reduce((acc, d) => acc + d.humidMean, 0);
          monthlyHumidMean.set(monthStr, sumHumid / daysInMonth.length);

          const sumVpdMean = daysInMonth.reduce((acc, d) => acc + calcVPD(d.tempMean, d.humidMean), 0);
          monthlyVpdMeanMap.set(monthStr, sumVpdMean / daysInMonth.length);

          const sumVpdMax = daysInMonth.reduce((acc, d) => acc + calcVPD(d.tempMax, d.humidMin), 0);
          monthlyVpdMaxMean.set(monthStr, sumVpdMax / daysInMonth.length);
        }
      }

      const plotDayStr = index === 0 ? '09' : index === 1 ? '16' : '23';

      // 累積開始日（MM-DD）— ユーザー設定。未設定はデフォルト '01-01'
      const precipStart = userSettings?.accumStartDates?.precip ?? '01-01';
      const sunshineStart = userSettings?.accumStartDates?.sunshine ?? '01-01';
      const radiationStart = userSettings?.accumStartDates?.radiation ?? '01-01';
      let accumPrecipRunning = 0;
      let accumSunshineRunning = 0;
      let accumRadiationRunning = 0;

      data.daily.forEach(day => {
        const mmdd = day.date.substring(5);
        const monthStr = day.date.substring(5, 7);
        const dayStr = day.date.substring(8, 10);
        if (!map.has(mmdd)) {
          map.set(mmdd, { dateStr: mmdd });
        }
        const entry = map.get(mmdd)!;
        entry[`t_${target.id}_temp`] = day.tempMean;
        entry[`t_${target.id}_tempRange`] = [day.tempMin, day.tempMax];

        // 15日：当月の月平均値をプロット
        if (dayStr === '15') {
          if (monthlyMean.has(monthStr)) {
            entry[`t_${target.id}_monthlyMeanTemp`] = monthlyMean.get(monthStr);
          }
          if (monthlyHumidMean.has(monthStr)) {
            entry[`monthlyHumid_${target.id}`] = monthlyHumidMean.get(monthStr);
          }
          if (monthlyVpdMaxMean.has(monthStr)) {
            entry[`monthlyMeanVpdMax_${target.id}`] = monthlyVpdMaxMean.get(monthStr);
          }
        }

        // 1日：前月と当月の月平均の中間値をプロット
        if (dayStr === '01') {
          const prevMM = String(parseInt(monthStr) - 1).padStart(2, '0');
          const prevTemp = monthStr === '01'
            ? data.prevDecMeans?.tempMean
            : monthlyMean.get(prevMM);
          const prevHumid = monthStr === '01'
            ? data.prevDecMeans?.humidMean
            : monthlyHumidMean.get(prevMM);
          const prevVpdMax = monthStr === '01'
            ? (data.prevDecMeans ? calcVPD(data.prevDecMeans.tempMean, data.prevDecMeans.humidMean) : undefined)
            : monthlyVpdMaxMean.get(prevMM);
          const curTemp = monthlyMean.get(monthStr);
          const curHumid = monthlyHumidMean.get(monthStr);
          const curVpdMax = monthlyVpdMaxMean.get(monthStr);
          if (prevTemp !== undefined && curTemp !== undefined) {
            entry[`t_${target.id}_monthlyMeanTemp`] = (prevTemp + curTemp) / 2;
          }
          if (prevHumid !== undefined && curHumid !== undefined) {
            entry[`monthlyHumid_${target.id}`] = (prevHumid + curHumid) / 2;
          }
          if (prevVpdMax !== undefined && curVpdMax !== undefined) {
            entry[`monthlyMeanVpdMax_${target.id}`] = (prevVpdMax + curVpdMax) / 2;
          }
        }

        entry[`humidRange_${target.id}`] = [day.humidMin, day.humidMax];
        entry[`vpdRange_${target.id}`] = [calcVPD(day.tempMin, day.humidMax), calcVPD(day.tempMax, day.humidMin)];
        entry[`vpdMean_${target.id}`] = calcVPD(day.tempMean, day.humidMean);

        if (dayStr === plotDayStr && monthlyPrecipSum.has(monthStr)) {
          entry[`monthlyPrecip_${target.id}`] = monthlyPrecipSum.get(monthStr);
        }

        entry[`precip_${target.id}`] = day.precipSum;
        entry[`humid_${target.id}`] = day.humidMean;
        entry[`radiation_${target.id}`] = day.radiation;
        entry[`sunshine_${target.id}`] = day.sunshineDuration;

        // 累積系：開始日 (MM-DD) 以降のみ加算。開始日より前は折線非表示用に null
        if (mmdd >= precipStart) {
          accumPrecipRunning += day.precipSum;
          entry[`accumPrecip_${target.id}`] = accumPrecipRunning;
        } else {
          entry[`accumPrecip_${target.id}`] = null;
        }
        if (mmdd >= sunshineStart) {
          accumSunshineRunning += day.sunshineDuration;
          entry[`accumSunshine_${target.id}`] = accumSunshineRunning;
        } else {
          entry[`accumSunshine_${target.id}`] = null;
        }
        if (mmdd >= radiationStart) {
          accumRadiationRunning += day.radiation;
          entry[`accumRadiation_${target.id}`] = accumRadiationRunning;
        } else {
          entry[`accumRadiation_${target.id}`] = null;
        }
      });

      // 12/31：12月と翌年1月の中間値（翌年データがある場合のみ）
      if (data.nextJanMeans) {
        const dec31Entry = map.get('12-31');
        if (dec31Entry) {
          const decTemp  = monthlyMean.get('12');
          const decHumid = monthlyHumidMean.get('12');
          const decVpdMax = monthlyVpdMaxMean.get('12');
          if (decTemp !== undefined) {
            dec31Entry[`t_${target.id}_monthlyMeanTemp`] = (decTemp + data.nextJanMeans.tempMean) / 2;
          }
          if (decHumid !== undefined) {
            dec31Entry[`monthlyHumid_${target.id}`] = (decHumid + data.nextJanMeans.humidMean) / 2;
          }
          if (decVpdMax !== undefined) {
            const nextVpdMax = calcVPD(data.nextJanMeans.tempMean, data.nextJanMeans.humidMean);
            dec31Entry[`monthlyMeanVpdMax_${target.id}`] = (decVpdMax + nextVpdMax) / 2;
          }
        }
      }

      // ── 予報オーバーレイ（targets[0] + 今年のみ） ──────────────────────────
      if (index === 0 && forecastData && target.year === currentYear) {
        forecastData.daily.forEach(fDay => {
          const mmdd = fDay.date.slice(5); // "YYYY-MM-DD" → "MM-DD"

          if (!map.has(mmdd)) {
            map.set(mmdd, { dateStr: mmdd });
          }
          const entry = map.get(mmdd)!;

          // 基本指標（破線縦バー用、[min, max] 配列形式）
          entry[`forecast_tempRange_${target.id}`]  = [fDay.tempMin, fDay.tempMax];
          entry[`forecast_humidRange_${target.id}`] = [fDay.humidMin, fDay.humidMax];
          entry[`forecast_vpdRange_${target.id}`]   = [calcVPD(fDay.tempMin, fDay.humidMax), calcVPD(fDay.tempMax, fDay.humidMin)];

          // 累積系（前の accumXxxRunning 変数が履歴ループ後の最終値を保持している）
          if (mmdd >= precipStart) {
            accumPrecipRunning += fDay.precipSum;
            entry[`forecast_accum_precip_${target.id}`] = accumPrecipRunning;
          }
          if (mmdd >= sunshineStart) {
            accumSunshineRunning += fDay.sunshineDuration;
            entry[`forecast_accum_sunshine_${target.id}`] = accumSunshineRunning;
          }
          if (mmdd >= radiationStart) {
            accumRadiationRunning += fDay.radiationSum;
            entry[`forecast_accum_radiation_${target.id}`] = accumRadiationRunning;
          }
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [weatherData, targets, userSettings, forecastData, currentYear]);

  const gddData = useMemo(() => {
    const selectedBaseTemp = userSettings?.baseTempSettings[selectedBaseTempIndex] ?? 10;
    const gddStart = userSettings?.accumStartDates?.gdd ?? '01-01';
    const overlay = new Map<string, Record<string, number | null>>();
    const seriesByTarget = new Map<string, Array<{ mmdd: string; accum: number }>>();

    targets.forEach((target) => {
      const data = weatherData[target.id];
      if (!data) return;
      let runningAccumTemp = 0;
      const series: Array<{ mmdd: string; accum: number }> = [];
      data.daily.forEach(day => {
        const mmdd = day.date.substring(5);
        const inRange = mmdd >= gddStart;
        const diff = day.tempMean - selectedBaseTemp;
        const dailyAccum = diff > 0 ? diff : 0;
        const existing = overlay.get(mmdd) ?? {};
        if (inRange) {
          runningAccumTemp += dailyAccum;
          existing[`dailyAccum_${target.id}`] = dailyAccum;
          existing[`accum_${target.id}`] = runningAccumTemp;
          series.push({ mmdd, accum: runningAccumTemp });
        } else {
          // 開始日より前は折線非表示・バー非表示
          existing[`dailyAccum_${target.id}`] = null;
          existing[`accum_${target.id}`] = null;
        }
        overlay.set(mmdd, existing);
      });
      seriesByTarget.set(target.id, series);

      // ── 予報GDD累積（targets[0] + 今年のみ） ────────────────────────────────
      if (targets[0]?.id === target.id && forecastData && target.year === currentYear) {
        let forecastGddRunning = runningAccumTemp; // 昨日時点の累積GDD

        forecastData.daily.forEach(fDay => {
          const mmdd = fDay.date.slice(5); // "YYYY-MM-DD" → "MM-DD"
          const existing = overlay.get(mmdd) ?? {};

          if (mmdd >= gddStart) {
            const tempMean = (fDay.tempMax + fDay.tempMin) / 2;
            const diff = tempMean - selectedBaseTemp;
            const dailyGdd = diff > 0 ? diff : 0;
            forecastGddRunning += dailyGdd;
            existing[`forecast_accum_gdd_${target.id}`] = forecastGddRunning;
          }
          overlay.set(mmdd, existing);
        });
      }
    });

    return { overlay, seriesByTarget };
  }, [weatherData, targets, userSettings, selectedBaseTempIndex, forecastData, currentYear]);

  // 日射量チャート Δ日 逆引き用：累積日射量の MM-DD 系列
  // 累積は baseChartData と同じ開始日ベースで自前計算
  const radiationData = useMemo(() => {
    const radiationStart = userSettings?.accumStartDates?.radiation ?? '01-01';
    const seriesByTarget = new Map<string, Array<{ mmdd: string; accum: number }>>();
    targets.forEach((target) => {
      const data = weatherData[target.id];
      if (!data) return;
      const series: Array<{ mmdd: string; accum: number }> = [];
      let running = 0;
      data.daily.forEach(day => {
        const mmdd = day.date.substring(5);
        if (mmdd < radiationStart) return;
        running += day.radiation;
        series.push({ mmdd, accum: running });
      });
      seriesByTarget.set(target.id, series);
    });
    return { seriesByTarget };
  }, [weatherData, targets, userSettings]);

  const filteredBaseChartData = useMemo(() => {
    const startMM = displayRange.startMM;
    const endMM   = displayRange.endMM;

    const mainStart = `${String(startMM).padStart(2,'0')}-01`;
    const mainEnd   = `${String(endMM).padStart(2,'0')}-${String(lastDayOfMonth(endMM)).padStart(2,'0')}`;

    return baseChartData.filter((d: any) => {
      if (d.dateStr >= mainStart && d.dateStr <= mainEnd) return true;
      // 前日: 開始月の前月末（startMM > 1 のみ — 同年内に存在する）
      if (startMM > 1) {
        const prevMM  = startMM - 1;
        const prevKey = `${String(prevMM).padStart(2,'0')}-${String(lastDayOfMonth(prevMM)).padStart(2,'0')}`;
        if (d.dateStr === prevKey) return true;
      }
      // 翌日: 終了月の翌月1日（endMM < 12 のみ — 同年内に存在する）
      if (endMM < 12) {
        const nextKey = `${String(endMM + 1).padStart(2,'0')}-01`;
        if (d.dateStr === nextKey) return true;
      }
      return false;
    });
  }, [baseChartData, displayRange]);

  const filteredGddChartData = useMemo(() => {
    if (gddData.overlay.size === 0) return filteredBaseChartData;
    return filteredBaseChartData.map(entry => {
      const gdd = gddData.overlay.get(entry.dateStr);
      return gdd ? { ...entry, ...gdd } : entry;
    });
  }, [filteredBaseChartData, gddData]);

  const filteredFirstOfMonths = useMemo(() => {
    const startKey = `${String(displayRange.startMM).padStart(2,'0')}-01`;
    const endKey   = `${String(displayRange.endMM).padStart(2,'0')}-01`;
    return firstOfMonths.filter(m => m >= startKey && m <= endKey);
  }, [firstOfMonths, displayRange]);



  const monthlyStats = useMemo(() => {
    if (Object.keys(weatherData).length === 0) return {};
    const stats: Record<string, any> = {};
    const baseT = userSettings?.baseTempSettings[selectedBaseTempIndex] ?? 10;
    const precipStart = userSettings?.accumStartDates?.precip ?? '01-01';
    const sunshineStart = userSettings?.accumStartDates?.sunshine ?? '01-01';
    const radiationStart = userSettings?.accumStartDates?.radiation ?? '01-01';
    const gddStart = userSettings?.accumStartDates?.gdd ?? '01-01';

    // 月別合計の partial 計算
    // 開始月より前 → null（月別バー非表示）
    // 開始月 → 開始日以降のみ集計（半月分など）
    // 開始月以降 → 全月の合計
    const partialSum = <T extends { date: string }>(
      monthDays: T[],
      monthMM: string,
      startMMDD: string,
      mapper: (d: T) => number
    ): number | null => {
      const startMM = startMMDD.substring(0, 2);
      if (monthMM < startMM) return null;
      const days = monthMM > startMM ? monthDays : monthDays.filter(d => d.date.substring(5) >= startMMDD);
      return days.reduce((s, d) => s + mapper(d), 0);
    };

    targets.forEach(target => {
      const data = weatherData[target.id];

      if (!data) return;
      stats[target.id] = {};

      for (let m = 1; m <= 12; m++) {
        const monthMM = String(m).padStart(2, '0');
        const monthStr = `${target.year}-${monthMM}`;
        const monthDays = data.daily.filter(d => d.date.startsWith(monthStr));

        if (monthDays.length === 0) {
          stats[target.id][m] = null;
          continue;
        }

        const meanTemp = monthDays.reduce((sum, d) => sum + d.tempMean, 0) / monthDays.length;
        const maxTemp = Math.max(...monthDays.map(d => d.tempMax));
        const minTemp = Math.min(...monthDays.map(d => d.tempMin));

        const sumPrecip = monthDays.reduce((sum, d) => sum + d.precipSum, 0);
        const meanPrecip = sumPrecip / monthDays.length;

        const sumRad = monthDays.reduce((sum, d) => sum + d.radiation, 0);
        const meanRad = sumRad / monthDays.length;

        const sumSunshine = monthDays.reduce((sum, d) => sum + d.sunshineDuration, 0);
        const meanSunshine = sumSunshine / monthDays.length;

        let monthAccumSum = 0;
        monthDays.forEach(d => {
          const diff = d.tempMean - baseT;
          if (diff > 0) monthAccumSum += diff;
        });

        // 開始日適用版（月別バー・累積バー用）
        const sumPrecipPartial = partialSum(monthDays, monthMM, precipStart, d => d.precipSum);
        const sumSunshinePartial = partialSum(monthDays, monthMM, sunshineStart, d => d.sunshineDuration);
        const sumRadPartial = partialSum(monthDays, monthMM, radiationStart, d => d.radiation);
        const monthAccumSumPartial = partialSum(monthDays, monthMM, gddStart, d => {
          const diff = d.tempMean - baseT;
          return diff > 0 ? diff : 0;
        });
        
        const monthMeanAccum = monthAccumSum / monthDays.length;
        
        const meanHumid = monthDays.reduce((sum, d) => sum + d.humidMean, 0) / monthDays.length;
        const maxHumid = Math.max(...monthDays.map(d => d.humidMax));
        const minHumid = Math.min(...monthDays.map(d => d.humidMin));

        const meanVpdMin = monthDays.reduce((sum, d) => sum + calcVPD(d.tempMin, d.humidMax), 0) / monthDays.length;
        const meanVpdMax = monthDays.reduce((sum, d) => sum + calcVPD(d.tempMax, d.humidMin), 0) / monthDays.length;
        const meanVpd = monthDays.reduce((sum, d) => sum + calcVPD(d.tempMean, d.humidMean), 0) / monthDays.length;

        stats[target.id][m] = {
          meanTemp,
          maxTemp,
          minTemp,
          meanPrecip,
          sumPrecip,
          meanRad,
          sumRad,
          meanSunshine,
          sumSunshine,
          monthAccumSum,
          monthMeanAccum,
          meanHumid,
          maxHumid,
          minHumid,
          meanVpdMin,
          meanVpdMax,
          meanVpd,
          // 累積開始日に基づく partial 合計（開始月より前は null、開始月は半月分など）
          sumPrecipPartial,
          sumSunshinePartial,
          sumRadPartial,
          monthAccumSumPartial,
        };
      }
    });
    return stats;
  }, [weatherData, targets, userSettings, selectedBaseTempIndex]);

  // 月次表示用のチャートデータ（monthlyStats から12エントリを生成）
  // 現在年の進行中の月以降は累積値（折線）を出力しない（partial合計で線が低く見える問題を回避）
  const monthlyChartData = useMemo(() => {
    if (Object.keys(monthlyStats).length === 0) return [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const entries: any[] = [];
    const accumPrecip: Record<string, number> = {};
    const accumSunshine: Record<string, number> = {};
    const accumRadiation: Record<string, number> = {};
    const accumGdd: Record<string, number> = {};

    for (let m = 1; m <= 12; m++) {
      const entry: any = { dateStr: String(m).padStart(2, '0') };
      targets.forEach(target => {
        const s = monthlyStats[target.id]?.[m];
        if (!s) return;

        const isInProgressMonth = target.year === currentYear && m >= currentMonth;

        entry[`t_${target.id}_tempRange`] = [s.minTemp, s.maxTemp];
        entry[`t_${target.id}_monthlyMeanTemp`] = s.meanTemp;

        // 月別合計バー: 開始月より前は null（バー非表示）、開始月は partial 値
        if (s.sumPrecipPartial !== null) entry[`monthlyPrecip_${target.id}`] = s.sumPrecipPartial;
        if (s.sumSunshinePartial !== null) entry[`sunshine_${target.id}`] = s.sumSunshinePartial;
        if (s.sumRadPartial !== null) entry[`radiation_${target.id}`] = s.sumRadPartial;
        if (s.monthAccumSumPartial !== null) entry[`dailyAccum_${target.id}`] = s.monthAccumSumPartial;

        entry[`humidRange_${target.id}`] = [s.minHumid, s.maxHumid];
        entry[`monthlyHumid_${target.id}`] = s.meanHumid;

        entry[`vpdRange_${target.id}`] = [s.meanVpdMin, s.meanVpdMax];
        entry[`vpdMean_${target.id}`] = s.meanVpd;
        entry[`monthlyMeanVpdMax_${target.id}`] = s.meanVpdMax;

        // 累積カウンタ: 開始月より前は null、開始月以降は partial 値を加算（進行中月は除外）
        if (!isInProgressMonth) {
          if (s.sumPrecipPartial !== null) {
            accumPrecip[target.id] = (accumPrecip[target.id] || 0) + s.sumPrecipPartial;
            entry[`accumPrecip_${target.id}`] = accumPrecip[target.id];
          }
          if (s.sumSunshinePartial !== null) {
            accumSunshine[target.id] = (accumSunshine[target.id] || 0) + s.sumSunshinePartial;
            entry[`accumSunshine_${target.id}`] = accumSunshine[target.id];
          }
          if (s.sumRadPartial !== null) {
            accumRadiation[target.id] = (accumRadiation[target.id] || 0) + s.sumRadPartial;
            entry[`accumRadiation_${target.id}`] = accumRadiation[target.id];
          }
          if (s.monthAccumSumPartial !== null) {
            accumGdd[target.id] = (accumGdd[target.id] || 0) + s.monthAccumSumPartial;
            entry[`accum_${target.id}`] = accumGdd[target.id];
          }
        }
      });
      entries.push(entry);
    }
    return entries;
  }, [monthlyStats, targets]);

  const filteredMonthlyChartData = useMemo(() => {
    return monthlyChartData.filter(d => {
      const m = parseInt(d.dateStr, 10);
      return m >= displayRange.startMM && m <= displayRange.endMM;
    });
  }, [monthlyChartData, displayRange]);

  // チャート切替用ヘルパー
  const isMonthly = chartViewMode === 'monthly';
  // 日次モード + 今年 + 予報取得済み の3条件が揃ったとき点線オーバーレイを表示
  const currentTargetHasForecast =
    !isMonthly && !!forecastData && targets[0]?.year === currentYear;
  const chartData = isMonthly ? filteredMonthlyChartData : filteredBaseChartData;
  const gddChartData = isMonthly ? filteredMonthlyChartData : filteredGddChartData;
  const xTickFormatterBase = isMonthly
    ? (val: string) => `${parseInt(val, 10)}月`
    : (val: string) => val.split('-').join('/');

  // 日次データのレンジが変わるたびに viewport をリセット
  // モバイル: 今日基準で「2ヶ月前の月初〜翌月の月末」に絞る（選択年の同季節を表示）
  // デスクトップ: 末尾 365日（従来どおり）
  useEffect(() => {
    const total = filteredBaseChartData.length;
    if (total === 0) { setDailyViewport(null); return; }

    if (isMobile) {
      const selectedYear = targets[0]?.year ?? new Date().getFullYear();
      const vp = calcMobileDefaultViewport(filteredBaseChartData, new Date(), selectedYear);
      if (vp) { setDailyViewport(vp); return; }
    }

    const w = Math.min(DAILY_WINDOW, total);
    setDailyViewport({ start: total - w, end: total });
  }, [filteredBaseChartData.length, isMobile]);

  // pan用: 表示中サブセット（月次はそのまま）
  const visibleChartData = useMemo(() => {
    if (isMonthly || !dailyViewport) return chartData;
    return chartData.slice(dailyViewport.start, dailyViewport.end);
  }, [chartData, isMonthly, dailyViewport]);

  const visibleGddChartData = useMemo(() => {
    if (isMonthly || !dailyViewport) return gddChartData;
    return gddChartData.slice(dailyViewport.start, dailyViewport.end);
  }, [gddChartData, isMonthly, dailyViewport]);

  // X軸の月始ティックも表示範囲内に絞る（範囲外はラベル消す）
  const xTicks = useMemo(() => {
    if (isMonthly) return undefined;
    if (!dailyViewport) return filteredFirstOfMonths;
    const visibleSet = new Set(visibleChartData.map((d: any) => d.dateStr));
    return filteredFirstOfMonths.filter(t => visibleSet.has(t));
  }, [filteredFirstOfMonths, visibleChartData, dailyViewport, isMonthly]);

  const xTickFormatter = xTickFormatterBase;

  // Y軸を mirror 表示にしてチャートを画面端から端まで拡張するための共通props
  // (グラフ上にラベルが重なるが、ユーザー要望でOK)
  // ※ SVG fill は CSS変数を解決しないので実色を直接指定する
  const yAxisCommon = {
    width: 30,
    mirror: true,
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 10, fill: '#94a3b8' },
  } as const;
  const yAxisCommonRight = { ...yAxisCommon } as const;
  const chartMargin = { top: 25, right: 0, left: 0, bottom: 0 };

  // Pointer events によるパンハンドラ
  // Recharts は onMouseDown/Up を発火しないため、ChartFrameのラッパdivで検出する。
  const justDraggedRef = useRef(false);

  const handlePointerDown = (chartId: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMonthly || !dailyViewport) return;
    panRef.current = {
      startX: e.clientX,
      startViewportStart: dailyViewport.start,
      dragging: false,
      chartId,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current || !dailyViewport) return;
    const dx = e.clientX - panRef.current.startX;
    if (!panRef.current.dragging && Math.abs(dx) > 5) {
      panRef.current.dragging = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    }
    if (panRef.current.dragging) {
      e.preventDefault();
      const windowSize = dailyViewport.end - dailyViewport.start;
      const totalLen = chartData.length;
      const plotWidth = Math.max(1, chartPixelWidth - 8);
      const shift = Math.round(-dx / plotWidth * windowSize);
      const newStart = Math.max(0, Math.min(totalLen - windowSize, panRef.current.startViewportStart + shift));
      pendingViewportRef.current = { start: newStart, end: newStart + windowSize };
      if (!panRafRef.current) {
        panRafRef.current = requestAnimationFrame(() => {
          panRafRef.current = 0;
          const v = pendingViewportRef.current;
          if (v) setDailyViewport(v);
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.dragging) {
      justDraggedRef.current = true;
      window.setTimeout(() => { justDraggedRef.current = false; }, 150);
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      setHover(null); // パン後は表示位置がずれるのでクリア
    }
    panRef.current = null;
  };

  // マウスがチャート外へ出たらパネルをクリア（タッチはタップ後も値を維持するためスキップ）
  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    setHover(null);
  };

  const chartLoading = (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '350px', gap: '0.9rem' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-color)' }} />
      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
        {loadingStatus || 'データを取得中...'}
      </span>
    </div>
  );

  // 全モード 横幅100%。render ヘルパー（コンポーネントでなく関数）にすることで
  // state 更新時の App 再描画でもアンマウント→マウントが起きないようにしている
  const chartFrame = (chartId: string, children: React.ReactNode, measure?: boolean) => (
    <div
      ref={measure ? chartFrameCbRef : undefined}
      className="chart-bleed"
      onPointerDown={handlePointerDown(chartId)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      style={{
        position: 'relative',
        width: '100%',
        touchAction: isMonthly ? 'auto' : 'pan-y',
      }}
    >
      <div style={{ height: '350px', width: '100%' }}>
        {children}
      </div>
    </div>
  );

  const getYearColor = (index: number, _baseColor: string) => {
    const targetColors = [
      'var(--accent-color)', // 1つ目: グリーン系
      '#9b66d9',             // 2つ目: パープル系
      'var(--chart-precip)', // 3つ目: ブルー系
    ];
    return targetColors[index % targetColors.length];
  };

  // ホバー状態 → ヘッダーに表示する固定値パネルへ流し込むためのヘルパー
  const formatHoverLabel = (label: string) => {
    if (!label) return '';
    if (label.includes('-')) {
      const [mm, dd] = label.split('-');
      return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`;
    }
    return `${parseInt(label, 10)}月`;
  };

  const formatHoverEntry = (entry: any) => {
    let unit = '℃';
    if (entry.name.includes('降水')) unit = 'mm';
    else if (entry.name.includes('湿度')) unit = '%';
    else if (entry.name.includes('日射')) unit = 'MJ/m²';
    else if (entry.name.includes('日照')) unit = 'h';
    else if (entry.name.includes('飽差')) unit = 'g/m³';
    if (Array.isArray(entry.value) && entry.value.length === 2) {
      const isVpd = entry.name.includes('飽差');
      const fmt = (v: number) => isVpd ? v.toFixed(1) : v.toFixed(2);
      return `${fmt(entry.value[0])}～${fmt(entry.value[1])}${unit}`;
    }
    if (typeof entry.value !== 'number') return '--';
    const isIntegerLike = entry.name.includes('降水') || entry.name.includes('日照') || entry.name.includes('日射') || entry.name.includes('積算');
    return `${isIntegerLike ? Math.round(entry.value) : entry.value.toFixed(1)}${unit}`;
  };

  const renderValueBox = (chartId: string) => {
    const boxStyle: React.CSSProperties = {
      marginTop: '0.5rem',
      marginBottom: '0.5rem',
      borderRadius: '8px',
      padding: '0.6rem 0.75rem',
      fontSize: '0.78rem',
    };

    if (hover?.chartId !== chartId) {
      return (
        <div style={{
          ...boxStyle,
          border: '1px dashed rgba(255,255,255,0.12)',
          color: '#475569',
          textAlign: 'center',
        }}>
          タップして値を表示
        </div>
      );
    }
    if (!hover.payload?.length) return null;

    const items = hover.payload.filter((p: any) => {
      if (p.value == null || p.value === undefined) return false;
      if (!isMonthly && (
        p.name?.includes('月平均気温') ||
        p.name?.includes('月平均湿度') ||
        p.name?.includes('月合計降水') ||
        p.name?.includes('月平均最高飽差')
      )) return false;
      return true;
    });
    if (items.length === 0) return null;

    return (
      <div style={{
        ...boxStyle,
        background: 'rgba(244,167,185,0.07)',
        border: '1px solid rgba(244,167,185,0.2)',
      }}>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700 }}>
          {formatHoverLabel(hover.label)}
        </div>
        {(() => {
          const groups = new Map<string, any[]>();
          items.forEach((p: any) => {
            if (!groups.has(p.color)) groups.set(p.color, []);
            groups.get(p.color)!.push(p);
          });

          // 1本目を基準とした Δ値 / Δ日 注釈
          // - GDD / 累積日射量: Δ値 + Δ日（serisByTarget で逆引き）
          // - 降水量 / 日照時間: Δ値のみ（showDays:false で逆引きをスキップ）
          const accumDiffConfig: {
            refKeyPrefix: string;
            seriesByTarget: Map<string, Array<{ mmdd: string; accum: number }>> | null;
            threshold: number;
            formatDelta: (d: number) => string;
            showDays: boolean;
          } | null =
            chartId === 'gdd' ? {
              refKeyPrefix: 'accum_',
              seriesByTarget: gddData.seriesByTarget,
              threshold: userSettings?.accumDeltaThresholds?.gdd ?? GDD_DELTA_DAYS_MIN_V0,
              formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d))}℃`,
              showDays: true,
            }
            : chartId === 'radiation' ? {
              refKeyPrefix: 'accumRadiation_',
              seriesByTarget: radiationData.seriesByTarget,
              threshold: userSettings?.accumDeltaThresholds?.radiation ?? RADIATION_DELTA_DAYS_MIN_V0,
              formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d))} MJ/m²`,
              showDays: true,
            }
            : chartId === 'precip' ? {
              refKeyPrefix: 'accumPrecip_',
              seriesByTarget: null,
              threshold: 0,
              formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d))}mm`,
              showDays: false,
            }
            : chartId === 'sunshine' ? {
              refKeyPrefix: 'accumSunshine_',
              seriesByTarget: null,
              threshold: 0,
              formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d) * 10) / 10}h`,
              showDays: false,
            }
            : null;

          const refId = accumDiffConfig && targets.length > 1 ? targets[1]?.id : null;
          const refKey = refId && accumDiffConfig ? `${accumDiffConfig.refKeyPrefix}${refId}` : null;
          const v0 = refKey
            ? hover.payload.find((p: any) => p.dataKey === refKey)?.value
            : undefined;
          const hoverDoy = accumDiffConfig && !isMonthly ? mmddToDoy(hover.label) : null;

          const computeAccumDiff = (p: any): string | null => {
            if (!accumDiffConfig || !refId || typeof v0 !== 'number') return null;
            const t0id = targets[0]?.id;
            if (!t0id || typeof p.dataKey !== 'string') return null;

            // 通常キーと予報キーの両方を許容する
            const prefix = accumDiffConfig.refKeyPrefix;
            const forecastPrefixMap: Record<string, string> = {
              'accum_':           'forecast_accum_gdd_',
              'accumRadiation_':  'forecast_accum_radiation_',
              'accumPrecip_':     'forecast_accum_precip_',
              'accumSunshine_':   'forecast_accum_sunshine_',
            };
            const forecastPrefix = forecastPrefixMap[prefix];
            const isRegularKey  = p.dataKey === `${prefix}${t0id}`;
            const isForecastKey = !!forecastPrefix && p.dataKey === `${forecastPrefix}${t0id}`;
            if (!isRegularKey && !isForecastKey) return null;
            if (typeof p.value !== 'number') return null;

            const delta = p.value - v0;
            const deltaStr = accumDiffConfig.formatDelta(delta);

            // 月次モードは Δ値 のみ
            if (isMonthly) return `(${deltaStr})`;

            // Δ日 を出さない設定（降水量・日照時間）は Δ値 のみ
            if (!accumDiffConfig.showDays) return `(${deltaStr})`;

            // 序盤ガード: V0 が小さすぎる場合は Δ日 を出さない
            if (v0 < accumDiffConfig.threshold) return `(${deltaStr})`;
            if (hoverDoy == null) return `(${deltaStr})`;

            // Δ日逆引き: targets[0] の確定データ系列を使用（予報日でも同様）
            const series = accumDiffConfig.seriesByTarget?.get(t0id);
            if (!series) return `(${deltaStr})`;

            const crossDate = findDateByAccum(series, v0);
            if (!crossDate) return `(${deltaStr} / 未到達)`;

            const crossDoy = mmddToDoy(crossDate);
            if (crossDoy == null) return `(${deltaStr})`;

            const deltaDays = hoverDoy - crossDoy;
            const daysStr =
              deltaDays === 0 ? '同日'
              : deltaDays > 0 ? `${deltaDays}日早い`
              : `${-deltaDays}日遅い`;
            return `(${deltaStr} / ${daysStr})`;
          };

          return Array.from(groups.entries()).map(([color, groupItems], gi) => (
            <div key={gi} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem', marginTop: gi > 0 ? '0.2rem' : 0 }}>
              {groupItems.map((p: any, i: number) => {
                const metric = p.name.split(' ').slice(2).join(' ') || p.name;
                const diffNote = computeAccumDiff(p);
                return (
                  <span key={i} style={{ color, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {metric} <strong>{formatHoverEntry(p)}</strong>
                    {diffNote && (
                      <span style={{ marginLeft: '0.25rem', opacity: 0.85, fontSize: '0.72rem' }}>
                        {diffNote}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          ));
        })()}
      </div>
    );
  };

  // Recharts v3 では onMouseMove から activePayload が削除されたため、
  // <Tooltip content={fn}> 経由でペイロードを受け取る方式に変更。
  // setHover は RAF でスロットリング（最大 60fps）し、render中の setState 連鎖を防ぐ。
  const makeTooltipContent = useCallback((chartId: string) => (props: any) => {
    const { payload, label, active } = props;
    if (active && payload?.length && label != null) {
      pendingHoverRef.current = { chartId, payload: payload as any[], label };
      if (!hoverRafRef.current) {
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = 0;
          const p = pendingHoverRef.current;
          if (p) setHover(prev =>
            prev?.chartId === p.chartId && prev?.label === p.label ? prev
              : { chartId: p.chartId, payload: p.payload, label: p.label }
          );
        });
      }
    }
    return null;
  }, []);

  // tooltip content 関数をメモ化：JSX 内でインライン呼び出しすると毎描画で新参照になり
  // Recharts が cascade 再描画するため、useMemo で安定させる。
  const tooltipContents = useMemo(() => ({
    temp: makeTooltipContent('temp'),
    precip: makeTooltipContent('precip'),
    sunshine: makeTooltipContent('sunshine'),
    radiation: makeTooltipContent('radiation'),
    gdd: makeTooltipContent('gdd'),
    humid: makeTooltipContent('humid'),
    vpd: makeTooltipContent('vpd'),
  }), [makeTooltipContent]);

  const sectionStyle = {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    marginTop: '1rem'
  };

  // 累積開始日が非デフォルト（01-01）のときだけ、タイトル横に「4/20〜」バッジを表示
  const renderAccumBadge = (chart: 'precip' | 'sunshine' | 'radiation' | 'gdd') => {
    const mmdd = userSettings?.accumStartDates?.[chart];
    if (!mmdd || mmdd === '01-01') return null;
    const [m, d] = mmdd.split('-').map(Number);
    return (
      <span style={{
        marginLeft: '0.5rem',
        padding: '0.15rem 0.55rem',
        fontSize: '0.7rem',
        background: 'rgba(0,0,0,0.06)',
        borderRadius: '999px',
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
        fontWeight: 600,
      }}>
        累積: {m}/{d}〜
      </span>
    );
  };

  const renderCustomLegend = (types: { label: string, type: 'dashed' | 'solid' | 'thin-bar' | 'thick-bar' | 'range-bar' | 'dashed-range-bar' }[]) => {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginTop: '10px', marginBottom: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
          {targets.map((target, index) => (
            <div key={target.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: getYearColor(index, '') }}></span>
              <span>{getLocationName(target.locationId)} {target.year}年</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginLeft: 'auto' }}>
          {types.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {t.type === 'dashed' && <span style={{ display: 'inline-block', width: '20px', borderBottom: '2px dashed var(--text-secondary)' }}></span>}
              {t.type === 'solid' && <span style={{ display: 'inline-block', width: '20px', borderBottom: '2px solid var(--text-secondary)' }}></span>}
              {t.type === 'thin-bar' && <span style={{ display: 'inline-block', width: '8px', height: '12px', backgroundColor: 'var(--text-secondary)', borderRadius: '2px' }}></span>}
              {t.type === 'thick-bar' && <span style={{ display: 'inline-block', width: '16px', height: '12px', backgroundColor: 'var(--text-secondary)', opacity: 0.3, borderRadius: '2px' }}></span>}
              {t.type === 'range-bar' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '14px', width: '12px', position: 'relative', opacity: 0.5 }}>
                  <span style={{ position: 'absolute', top: '0', bottom: '0', left: '50%', width: '1.5px', marginLeft: '-0.75px', backgroundColor: 'var(--text-secondary)' }}></span>
                  <span style={{ position: 'absolute', top: '0', left: '25%', right: '25%', height: '1.5px', backgroundColor: 'var(--text-secondary)' }}></span>
                  <span style={{ position: 'absolute', bottom: '0', left: '25%', right: '25%', height: '1.5px', backgroundColor: 'var(--text-secondary)' }}></span>
                </span>
              )}
              {t.type === 'dashed-range-bar' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '12px', height: '14px', opacity: 0.7 }}>
                  <svg width="12" height="14">
                    <line x1="6" y1="1" x2="6" y2="13" stroke="var(--text-secondary)" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1="3" y1="1" x2="9" y2="1" stroke="var(--text-secondary)" strokeWidth="1.5" />
                    <line x1="3" y1="13" x2="9" y2="13" stroke="var(--text-secondary)" strokeWidth="1.5" />
                  </svg>
                </span>
              )}
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/icon.png" alt="loading" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      <div style={{
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1rem',
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        gap: '0.5rem',
      }}>
        {/* アプリアイコン（装飾のみ） */}
        <img
          src="/icon.png"
          alt=""
          aria-hidden="true"
          style={{ width: 24, height: 24, flexShrink: 0, pointerEvents: 'none', marginRight: '0.25rem' }}
        />

        {/* メインタブ */}
        <div className="premium-segmented-tab" style={{ background: 'rgba(167, 203, 192, 0.15)', flex: 1 }}>
          {(['weather', 'history', 'analysis', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTopTab(tab)}
              style={{
                padding: '0.5rem 1.2rem',
                background: topTab === tab ? 'linear-gradient(135deg, var(--accent-color) 0%, #0f766e 100%)' : 'transparent',
                color: topTab === tab ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                fontWeight: topTab === tab ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                borderRadius: 'calc(var(--radius-md) - 4px)',
                boxShadow: topTab === tab ? '0 4px 12px rgba(13, 148, 136, 0.15)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              {tab === 'weather' ? '天気情報'
                : tab === 'history' ? 'あの時の天気'
                : tab === 'analysis' ? '比較分析'
                : <><Settings size={13} /> 設定</>}
            </button>
          ))}
        </div>

        {/* Desktop のみ: アバター＋ログアウト */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0, marginLeft: '0.25rem' }}>
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                width={28}
                height={28}
                style={{ borderRadius: '50%', border: '1.5px solid var(--accent-color)' }}
              />
            )}
            <button
              className="secondary"
              onClick={() => signOut(auth)}
              title="ログアウト"
              style={{ padding: '0.4rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', borderRadius: 'var(--radius-md)' }}
            >
              <LogOut size={13} /> ログアウト
            </button>
          </div>
        )}
      </div>

      {topTab === 'weather' && <WeatherTab />}

      {topTab === 'history' && <HistoricalWeatherTab />}

      {topTab === 'analysis' && (
      <div className="app-container">
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>表示対象 (最大2件)</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <button
                onClick={() => {
                  setAnalysisGeoLoading(true);
                  setAnalysisGeoError('');
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const lat = parseFloat(position.coords.latitude.toFixed(6));
                      const lon = parseFloat(position.coords.longitude.toFixed(6));
                      setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
                      setTargets(prev => prev.map((t, i) => i === 0 ? { ...t, locationId: '__geo__' } : t));
                      setAnalysisGeoLoading(false);
                    },
                    (err) => {
                      setAnalysisGeoError(getGeoErrorMessage(err));
                      setAnalysisGeoLoading(false);
                    },
                    GEO_OPTIONS,
                  );
                }}
                disabled={analysisGeoLoading}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  background: 'rgba(13,148,136,0.12)',
                  color: 'var(--accent-color)',
                  border: '1px solid rgba(13,148,136,0.3)',
                  borderRadius: 'var(--radius-md, 6px)',
                  cursor: analysisGeoLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  opacity: analysisGeoLoading ? 0.7 : 1,
                }}
              >
                {analysisGeoLoading
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />取得中…</>
                  : <><MapPin size={14} />現在地を表示</>}
              </button>
              {analysisGeoError && (
                <span style={{ fontSize: '0.75rem', color: '#c62828' }}>⚠ {analysisGeoError}</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {targets.map((target, index) => (
              <div key={target.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', background: 'rgba(255, 255, 255, 0.45)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border-sub)' }}>
                <div style={{ flexShrink: 0, width: '4px', height: '24px', backgroundColor: getYearColor(index, 'var(--accent-color)'), borderRadius: '2px' }}></div>
                {index > 0 && (
                  <span
                    title="1件目との差が表示されます"
                    style={{
                      flexShrink: 0,
                      minWidth: '38px',
                      textAlign: 'center',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '999px',
                      background: 'rgba(2,132,199,0.08)',
                      color: 'var(--accent-blue)',
                      border: '1px solid rgba(2,132,199,0.2)',
                    }}
                  >
                    比較
                  </span>
                )}
                <select
                  value={target.locationId}
                  onChange={(e) => updateTarget(target.id, 'locationId', e.target.value)}
                  style={{ flex: 2, minWidth: 0, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                >
                  {geoLocation && <option value="__geo__">📍 現在地</option>}
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                  {!geoLocation && locations.length === 0 && <option value="">地点未設定</option>}
                </select>
                <select
                  value={target.year}
                  onChange={(e) => updateTarget(target.id, 'year', parseInt(e.target.value, 10))}
                  style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                >
                  {[...Array(new Date().getFullYear() - 2000 + 1)].map((_, i) => {
                    const y = new Date().getFullYear() - i;
                    return <option key={y} value={y}>{y}年</option>;
                  })}
                </select>
                {targets.length > 1 && (
                  <button
                    className="secondary"
                    onClick={() => removeTarget(target.id)}
                    style={{ flexShrink: 0, color: 'var(--chart-temp)', padding: '0.45rem', border: 'none', background: 'transparent', boxShadow: 'none' }}
                    title="この行を削除"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            {targets.length < 2 && (
              <button
                onClick={addTarget}
                className="secondary"
                style={{ alignSelf: 'flex-start', marginTop: '0.25rem', padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
              >
                <Plus size={15} /> 比較対象を追加
              </button>
            )}
          </div>
        </div>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* 表示期間 */}
        <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>表示期間</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem' }}>
            <select value={displayRange.startMM} onChange={e => handleRangeChange('startMM', +e.target.value)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
              {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
            </select>
            <span style={{ color: 'var(--text-secondary)' }}>〜</span>
            <select value={displayRange.endMM} onChange={e => handleRangeChange('endMM', +e.target.value)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
              {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
            </select>
            <button
              onClick={() => setDisplayRange({ startMM: 1, endMM: 12 })}
              className="secondary"
              style={{ marginLeft: '0.5rem', padding: '0.35rem 0.85rem', fontSize: '0.8rem', borderRadius: 'var(--radius-md)' }}
            >
              年間表示
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>表示単位</span>
            <div className="premium-segmented-tab" style={{ padding: '0.18rem', background: 'rgba(167, 203, 192, 0.15)' }}>
              {(['daily', 'monthly'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setChartViewMode(mode)}
                  style={{
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.8rem',
                    background: chartViewMode === mode ? 'linear-gradient(135deg, var(--accent-color) 0%, #0f766e 100%)' : 'transparent',
                    color: chartViewMode === mode ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    fontWeight: chartViewMode === mode ? 700 : 500,
                    borderRadius: 'calc(var(--radius-md) - 4px)',
                    cursor: 'pointer',
                    boxShadow: chartViewMode === mode ? '0 2px 8px rgba(13, 148, 136, 0.15)' : 'none',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {mode === 'daily' ? '日次' : '月次'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* チャート選択タブ */}
        <div
          className="glass-panel"
          style={{
            padding: '0.6rem 1rem',
            display: 'flex',
            gap: '0.6rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {CHART_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveChart(tab.id)}
              className={`premium-pill ${activeChart === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.2)', border: '1px solid var(--chart-temp)', borderRadius: '8px', color: 'var(--text-primary)' }}>
            ⚠️ エラーが発生しました: {error}
          </div>
        )}

        {/* 1. 気温 (Temperature) */}
        {activeChart === 'temp' && (
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><Thermometer size={18} /> 気温</h2>
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('temp', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis {...yAxisCommon} domain={['auto', 'auto']} label={{ value: '(℃)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.temp} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />
                    {targets.map((target, index) => {
                      const color = getYearColor(index, 'var(--chart-temp)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`t_${target.id}_tempRange`} name={`${getLocationName(target.locationId)} ${target.year}年 気温(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`t_${target.id}_monthlyMeanTemp`} name={`${getLocationName(target.locationId)} ${target.year}年 月平均気温`} stroke={color} strokeWidth={2.5} dot={false} connectNulls={true} isAnimationActive={false}>
                            {isMonthly && index === 0 && (
                              <LabelList dataKey={`t_${target.id}_monthlyMeanTemp`} position="top" formatter={(v: any) => typeof v === 'number' ? v.toFixed(1) : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                            )}
                          </Line>
                          {/* 10日予報（破線縦バー） */}
                          {currentTargetHasForecast && index === 0 && (
                            <Bar dataKey={`forecast_tempRange_${target.id}`} name={`${getLocationName(target.locationId)} ${target.year}年 予報気温`} fill={color} shape={<ForecastRangeBar />} legendType="none" isAnimationActive={false} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月間平均', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed-range-bar' as const }] : []),
              ])}
              {renderValueBox('temp')}
              <MonthsTable
                rowsDef={[
                  { key: 'meanTemp', label: '月平均気温 (℃)' },
                  { key: 'maxTemp', label: '月最高気温 (℃)' },
                  { key: 'minTemp', label: '月最低気温 (℃)' }
                ]}
                targets={targets}
                stats={monthlyStats}
                getYearColor={getYearColor}
                getLocationName={getLocationName}
              />
            </>
          )}
        </section>
        )}

        {/* 2. 降水量 (Precipitation) */}
        {activeChart === 'precip' && (
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><CloudRain size={18} /> 降水量</h2>
            {renderAccumBadge('precip')}
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('precip', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisCommon} label={{ value: '(mm)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisCommonRight} label={{ value: '(mm)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.precip} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />

                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-precip)');
                      return (
                        <Bar
                          key={`monthlyPrecip_${target.id}`}
                          yAxisId="left"
                          dataKey={`monthlyPrecip_${target.id}`}
                          name={`${name} 月合計降水`}
                          fill={color}
                          fillOpacity={isMonthly ? 0.5 : 1}
                          shape={isMonthly ? undefined : <CustomWideBar />}
                        >
                          <LabelList dataKey={`monthlyPrecip_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' ? Math.round(v).toString() : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                        </Bar>
                      );
                    })}
                    {!isMonthly && targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Bar
                          key={`precip_${target.id}`}
                          yAxisId="left"
                          dataKey={`precip_${target.id}`}
                          name={`${name} 日別降水`}
                          fill={getYearColor(index, 'var(--chart-precip)')}
                          opacity={index === 0 ? 0.9 : 0.6}
                        />
                      );
                    })}
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Line
                          key={`accumPrecip_${target.id}`}
                          yAxisId="right"
                          type="monotone"
                          dataKey={`accumPrecip_${target.id}`}
                          name={`${name} 累積降水`}
                          stroke={getYearColor(index, 'var(--chart-precip)')}
                          dot={false}
                          strokeWidth={index === 0 ? 3 : 2}
                          opacity={index === 0 ? 1 : 0.7}
                          isAnimationActive={false}
                        />
                      );
                    })}
                    {/* 10日予報累積降水量（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_precip_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予想累積降水`}
                          stroke={getYearColor(0, 'var(--chart-precip)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend(isMonthly ? [
                { label: '月間降水量', type: 'thick-bar' },
                { label: '累積降水量', type: 'solid' }
              ] : [
                { label: '降水量', type: 'thin-bar' },
                { label: '月間降水量', type: 'thick-bar' },
                { label: '累積降水量', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('precip')}
              <MonthsTable
                rowsDef={[
                  { key: 'sumPrecip', label: '月合計降水量 (mm)' }
                ]}
                targets={targets}
                stats={monthlyStats}
                getYearColor={getYearColor}
                getLocationName={getLocationName}
              />
            </>
          )}
        </section>
        )}

        {/* 3. 日照時間 (Sunshine Duration) */}
        {activeChart === 'sunshine' && (
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><Clock size={18} /> 日照時間</h2>
            {renderAccumBadge('sunshine')}
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('sunshine', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisCommon} label={{ value: isMonthly ? '(h/月)' : '(h/日)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisCommonRight} label={{ value: '(h)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.sunshine} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />

                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-sunshine)');
                      return (
                        <Bar
                          key={`sunshine_${target.id}`}
                          yAxisId="left"
                          dataKey={`sunshine_${target.id}`}
                          name={isMonthly ? `${name} 月合計日照` : `${name} 日別日照`}
                          fill={color}
                          opacity={index === 0 ? 0.5 : 0.3}
                        >
                          {isMonthly && (
                            <LabelList dataKey={`sunshine_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' ? Math.round(v).toString() : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                          )}
                        </Bar>
                      );
                    })}
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Line
                          key={`accumSunshine_${target.id}`}
                          yAxisId="right"
                          type="monotone"
                          dataKey={`accumSunshine_${target.id}`}
                          name={`${name} 累積日照`}
                          stroke={getYearColor(index, 'var(--chart-sunshine)')}
                          dot={false}
                          strokeWidth={index === 0 ? 3 : 2}
                          opacity={index === 0 ? 1 : 0.7}
                          isAnimationActive={false}
                        />
                      );
                    })}
                    {/* 10日予報累積日照時間（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_sunshine_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予想累積日照`}
                          stroke={getYearColor(0, 'var(--chart-sunshine)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '日照時間', type: 'thin-bar' },
                { label: '累積日照時間', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('sunshine')}
              <MonthsTable
                rowsDef={[
                  { key: 'meanSunshine', label: '月平均日照時間 (h/日)' },
                  { key: 'sumSunshine', label: '月合計日照時間 (h)' }
                ]}
                targets={targets}
                stats={monthlyStats}
                getYearColor={getYearColor}
                getLocationName={getLocationName}
              />
            </>
          )}
        </section>
        )}

        {/* 4. 日射量 (Solar Radiation) */}
        {activeChart === 'radiation' && (
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><Sun size={18} /> 日射量</h2>
            {renderAccumBadge('radiation')}
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('radiation', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisCommon} label={{ value: '(MJ/m²)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisCommonRight} label={{ value: '(MJ/m²)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.radiation} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />

                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-sunshine)');
                      return (
                        <Bar
                          key={`radiation_${target.id}`}
                          yAxisId="left"
                          dataKey={`radiation_${target.id}`}
                          name={isMonthly ? `${name} 月合計日射` : `${name} 日別日射`}
                          fill={color}
                          opacity={index === 0 ? 0.5 : 0.3}
                        >
                          {isMonthly && (
                            <LabelList dataKey={`radiation_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' ? Math.round(v).toString() : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                          )}
                        </Bar>
                      );
                    })}
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Line
                          key={`accumRadiation_${target.id}`}
                          yAxisId="right"
                          type="monotone"
                          dataKey={`accumRadiation_${target.id}`}
                          name={`${name} 累積日射`}
                          stroke={getYearColor(index, 'var(--chart-sunshine)')}
                          dot={false}
                          strokeWidth={index === 0 ? 3 : 2}
                          opacity={index === 0 ? 1 : 0.7}
                          isAnimationActive={false}
                        />
                      );
                    })}
                    {/* 10日予報累積日射量（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_radiation_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予想累積日射`}
                          stroke={getYearColor(0, 'var(--chart-sunshine)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '日射量', type: 'thin-bar' },
                { label: '累積日射量', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('radiation')}
              <MonthsTable
                rowsDef={[
                  { key: 'meanRad', label: '月平均日射量 (MJ/m²)' },
                  { key: 'sumRad', label: '月合計日射量 (MJ/m²)' }
                ]}
                targets={targets}
                stats={monthlyStats}
                getYearColor={getYearColor}
                getLocationName={getLocationName}
              />
            </>
          )}
        </section>
        )}

        {/* 4. 有効積算温度 (Accumulated Temperature) */}
        {activeChart === 'gdd' && (
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem', flex: 1 }}>
              <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><Leaf size={18} /> 有効積算温度</h2>
              {renderAccumBadge('gdd')}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(userSettings?.baseTempSettings ?? [10, 3.5]).map((temp, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedBaseTempIndex(i as 0 | 1)}
                  style={{
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.85rem',
                    background: i === selectedBaseTempIndex ? '#f4a7b9' : 'rgba(244,167,185,0.25)',
                    color: i === selectedBaseTempIndex ? '#7a2840' : 'var(--text-secondary)',
                    border: '1px solid rgba(244,167,185,0.6)',
                    borderRadius: 'var(--radius-md, 6px)',
                    fontWeight: i === selectedBaseTempIndex ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  基準温度 {temp}℃
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('gdd', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleGddChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisCommon} label={{ value: isMonthly ? '(℃/月)' : '(℃/日)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisCommonRight} label={{ value: '(℃)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.gdd} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />

                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-sunshine)');
                      return (
                        <Bar
                          key={`dailyAccum_${target.id}`}
                          yAxisId="left"
                          dataKey={`dailyAccum_${target.id}`}
                          name={isMonthly ? `${name} 月合計積算` : `${name} 日別積算`}
                          fill={color}
                          opacity={index === 0 ? 0.5 : 0.3}
                        >
                          {isMonthly && (
                            <LabelList dataKey={`dailyAccum_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' ? Math.round(v).toString() : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                          )}
                        </Bar>
                      );
                    })}
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Line
                          key={`accum_${target.id}`}
                          yAxisId="right"
                          type="monotone"
                          dataKey={`accum_${target.id}`}
                          name={`${name} 累積積算`}
                          stroke={getYearColor(index, 'var(--chart-sunshine)')}
                          dot={false}
                          strokeWidth={index === 0 ? 3 : 2}
                          opacity={index === 0 ? 1 : 0.7}
                          isAnimationActive={false}
                        />
                      );
                    })}
                    {/* 10日予報累積GDD（点線） */}
                    {currentTargetHasForecast && (() => {
                      const t0 = targets[0]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_gdd_${t0.id}`}
                          name={`${getLocationName(t0.locationId)} ${t0.year}年 予想累積積算`}
                          stroke={getYearColor(0, 'var(--chart-sunshine)')}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })()}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '有効積算温度', type: 'thin-bar' },
                { label: '累積有効積算温度', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('gdd')}
              <MonthsTable
                rowsDef={[
                  { key: 'monthMeanAccum', label: '月平均積算温度 (℃)' },
                  { key: 'monthAccumSum', label: '月合計積算温度 (℃)' }
                ]}
                targets={targets}
                stats={monthlyStats}
                getYearColor={getYearColor}
                getLocationName={getLocationName}
              />
            </>
          )}
        </section>
        )}

        {/* 5. 湿度 (Humidity) */}
        {activeChart === 'humid' && (
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><Droplets size={18} /> 湿度</h2>
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('humid', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis {...yAxisCommon} domain={['auto', 'auto']} label={{ value: '(%)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.humid} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-humid)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`humidRange_${target.id}`} name={`${name} 湿度(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`monthlyHumid_${target.id}`} name={`${name} 月平均湿度`} stroke={color} strokeWidth={2.5} dot={false} connectNulls={true} isAnimationActive={false}>
                            {isMonthly && index === 0 && (
                              <LabelList dataKey={`monthlyHumid_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' ? Math.round(v).toString() : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                            )}
                          </Line>
                          {/* 10日予報湿度（破線縦バー） */}
                          {currentTargetHasForecast && index === 0 && (
                            <Bar dataKey={`forecast_humidRange_${target.id}`} name={`${getLocationName(target.locationId)} ${target.year}年 予報湿度`} fill={color} shape={<ForecastRangeBar />} legendType="none" isAnimationActive={false} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月間平均', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed-range-bar' as const }] : []),
              ])}
              {renderValueBox('humid')}
              <MonthsTable
                rowsDef={[
                  { key: 'meanHumid', label: '月平均湿度 (%)' }
                ]}
                targets={targets}
                stats={monthlyStats}
                getYearColor={getYearColor}
                getLocationName={getLocationName}
              />
            </>
          )}
        </section>
        )}

        {/* 7. 飽差 (VPD) */}
        {activeChart === 'vpd' && (
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}><DropletOff size={18} /> 飽差</h2>
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('vpd', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis {...yAxisCommon} domain={['auto', 'auto']} label={{ value: '(g/m³)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.vpd} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />
{targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-humid)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`vpdRange_${target.id}`} name={`${name} 飽差(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`monthlyMeanVpdMax_${target.id}`} name={`${name} 月平均最高飽差`} stroke={color} strokeWidth={2.5} dot={false} connectNulls={true} isAnimationActive={false}>
                            {isMonthly && index === 0 && (
                              <LabelList dataKey={`monthlyMeanVpdMax_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' ? v.toFixed(1) : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                            )}
                          </Line>
                          {/* 10日予報飽差（破線縦バー） */}
                          {currentTargetHasForecast && index === 0 && (
                            <Bar dataKey={`forecast_vpdRange_${target.id}`} name={`${getLocationName(target.locationId)} ${target.year}年 予報飽差`} fill={color} shape={<ForecastRangeBar />} legendType="none" isAnimationActive={false} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月平均最高飽差', type: 'solid' },
                ...(currentTargetHasForecast ? [{ label: '10日予報', type: 'dashed-range-bar' as const }] : []),
              ])}
              {renderValueBox('vpd')}
              <MonthsTable
                rowsDef={[
                  { key: 'meanVpd', label: '月平均飽差 (g/m³)' },
                  { key: 'meanVpdMax', label: '月平均最高飽差 (g/m³)' },
                ]}
                targets={targets}
                stats={monthlyStats}
                getYearColor={getYearColor}
                getLocationName={getLocationName}
              />
            </>
          )}
        </section>
        )}

      <Footer />
      </main>

    </div>
    )}

    {topTab === 'settings' && <SettingsTab />}
  </>
  );
}

export default App;
