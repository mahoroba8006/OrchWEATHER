import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CloudRain, Thermometer, Droplets, Leaf, Settings, Sun, Plus, X, LogOut, Clock } from 'lucide-react';
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, LabelList } from 'recharts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useAppStore } from './store';
import { SettingsModal } from './SettingsModal';
import { useWeatherData, type CompareTarget } from './hooks/useWeather';
import { MonthsTable } from './components/MonthsTable';
import { LoginScreen } from './components/LoginScreen';
import { auth } from './lib/firebase';
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

type ChartId = 'temp' | 'precip' | 'sunshine' | 'radiation' | 'gdd' | 'humid' | 'vpd';

const CHART_TABS: { id: ChartId; label: string }[] = [
  { id: 'temp',      label: '気温' },
  { id: 'precip',    label: '降水量' },
  { id: 'sunshine',  label: '日照時間' },
  { id: 'radiation', label: '日射量' },
  { id: 'gdd',       label: '積算温度' },
  { id: 'humid',     label: '湿度' },
  { id: 'vpd',       label: '飽差' },
];

// 飽差（VPD）= 飽和水蒸気圧 × (1 - RH/100) [kPa]
const calcVPD = (tempC: number, humidPct: number): number =>
  0.6108 * Math.exp(17.27 * tempC / (tempC + 237.3)) * (1 - humidPct / 100);

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

function App() {
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings } = useAppStore();
  const [selectedBaseTempIndex, setSelectedBaseTempIndex] = useState<0 | 1>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [displayRange, setDisplayRange] = useState({ startMM: 1, endMM: 12 });
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'monthly'>('daily');
  const [activeChart, setActiveChart] = useState<ChartId>('temp');
  const [hover, setHover] = useState<{ chartId: string; payload: any[]; label: string } | null>(null);
  const pendingHoverRef = useRef<{ chartId: string; payload: any[]; label: string } | null>(null);
  const hoverRafRef = useRef<number>(0);

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
        await Promise.all([
          loadLocations(firebaseUser.uid),
          loadUserSettings(firebaseUser.uid),
        ]);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const initialLocation = locations.length > 0 ? locations[0].id : '';
  const [targets, setTargets] = useState<CompareTarget[]>([
    { id: `t_${Date.now()}`, locationId: initialLocation, year: new Date().getFullYear() }
  ]);

  // マスターデータから削除された地点を掴んでいるターゲットを自動復旧させる
  useEffect(() => {
    setTargets(prev => {
      let changed = false;
      const validIds = new Set(locations.map(l => l.id));
      const next = prev.map(t => {
        if (!validIds.has(t.locationId)) {
          changed = true;
          return { ...t, locationId: locations.length > 0 ? locations[0].id : '' };
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, [locations]);

  const firstOfMonths = Array.from({length: 12}, (_, i) => `${String(i + 1).padStart(2, '0')}-01`);

  const lastDayOfMonth = (mm: number) => new Date(2000, mm, 0).getDate();

  const handleRangeChange = (field: 'startMM' | 'endMM', value: number) => {
    setDisplayRange(prev => {
      const next = { ...prev, [field]: value };
      if (next.startMM > next.endMM) return prev;
      return next;
    });
  };

  const { data: weatherData, loading, error } = useWeatherData(targets);

  const addTarget = () => {
    if (targets.length >= 3) return;
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
        entry[`accumPrecip_${target.id}`] = day.accumPrecip;
        entry[`humid_${target.id}`] = day.humidMean;
        entry[`radiation_${target.id}`] = day.radiation;
        entry[`accumRadiation_${target.id}`] = day.accumRadiation;
        entry[`sunshine_${target.id}`] = day.sunshineDuration;
        entry[`accumSunshine_${target.id}`] = day.accumSunshineDuration;
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
    });

    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [weatherData, targets]);

  const gddData = useMemo(() => {
    const selectedBaseTemp = userSettings?.baseTempSettings[selectedBaseTempIndex] ?? 10;
    const overlay = new Map<string, Record<string, number>>();
    const seriesByTarget = new Map<string, Array<{ mmdd: string; accum: number }>>();

    targets.forEach((target) => {
      const data = weatherData[target.id];
      if (!data) return;
      let runningAccumTemp = 0;
      const series: Array<{ mmdd: string; accum: number }> = [];
      data.daily.forEach(day => {
        const mmdd = day.date.substring(5);
        const diff = day.tempMean - selectedBaseTemp;
        const dailyAccum = diff > 0 ? diff : 0;
        runningAccumTemp += dailyAccum;
        const existing = overlay.get(mmdd) ?? {};
        existing[`dailyAccum_${target.id}`] = dailyAccum;
        existing[`accum_${target.id}`] = runningAccumTemp;
        overlay.set(mmdd, existing);
        series.push({ mmdd, accum: runningAccumTemp });
      });
      seriesByTarget.set(target.id, series);
    });

    return { overlay, seriesByTarget };
  }, [weatherData, targets, userSettings, selectedBaseTempIndex]);

  // 日射量チャート Δ日 逆引き用：累積日射量の MM-DD 系列
  // overlay は既存の baseChartData の accumRadiation_${id} を流用するため不要
  const radiationData = useMemo(() => {
    const seriesByTarget = new Map<string, Array<{ mmdd: string; accum: number }>>();
    targets.forEach((target) => {
      const data = weatherData[target.id];
      if (!data) return;
      const series: Array<{ mmdd: string; accum: number }> = [];
      data.daily.forEach(day => {
        series.push({ mmdd: day.date.substring(5), accum: day.accumRadiation });
      });
      seriesByTarget.set(target.id, series);
    });
    return { seriesByTarget };
  }, [weatherData, targets]);

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

    targets.forEach(target => {
      const data = weatherData[target.id];
      
      if (!data) return;
      stats[target.id] = {};
      
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${target.year}-${String(m).padStart(2, '0')}`;
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

        entry[`monthlyPrecip_${target.id}`] = s.sumPrecip;
        entry[`sunshine_${target.id}`] = s.sumSunshine;
        entry[`radiation_${target.id}`] = s.sumRad;
        entry[`dailyAccum_${target.id}`] = s.monthAccumSum;

        entry[`humidRange_${target.id}`] = [s.minHumid, s.maxHumid];
        entry[`monthlyHumid_${target.id}`] = s.meanHumid;

        entry[`vpdRange_${target.id}`] = [s.meanVpdMin, s.meanVpdMax];
        entry[`vpdMean_${target.id}`] = s.meanVpd;
        entry[`monthlyMeanVpdMax_${target.id}`] = s.meanVpdMax;

        if (!isInProgressMonth) {
          accumPrecip[target.id] = (accumPrecip[target.id] || 0) + s.sumPrecip;
          entry[`accumPrecip_${target.id}`] = accumPrecip[target.id];

          accumSunshine[target.id] = (accumSunshine[target.id] || 0) + s.sumSunshine;
          entry[`accumSunshine_${target.id}`] = accumSunshine[target.id];

          accumRadiation[target.id] = (accumRadiation[target.id] || 0) + s.sumRad;
          entry[`accumRadiation_${target.id}`] = accumRadiation[target.id];

          accumGdd[target.id] = (accumGdd[target.id] || 0) + s.monthAccumSum;
          entry[`accum_${target.id}`] = accumGdd[target.id];
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
  const chartData = isMonthly ? filteredMonthlyChartData : filteredBaseChartData;
  const gddChartData = isMonthly ? filteredMonthlyChartData : filteredGddChartData;
  const xTickFormatterBase = isMonthly
    ? (val: string) => `${parseInt(val, 10)}月`
    : (val: string) => val.split('-').join('/');

  // 日次データのレンジが変わるたびに viewport を末尾90日にリセット
  useEffect(() => {
    const total = filteredBaseChartData.length;
    if (total === 0) { setDailyViewport(null); return; }
    const w = Math.min(DAILY_WINDOW, total);
    setDailyViewport({ start: total - w, end: total });
  }, [filteredBaseChartData.length]);

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
    else if (entry.name.includes('飽差')) unit = 'kPa';
    if (Array.isArray(entry.value) && entry.value.length === 2) {
      return `${entry.value[0]?.toFixed(2)}～${entry.value[1]?.toFixed(2)}${unit}`;
    }
    if (typeof entry.value !== 'number') return '--';
    const isIntegerLike = entry.name.includes('降水') || entry.name.includes('日照') || entry.name.includes('日射') || entry.name.includes('積算');
    const isVpd = entry.name.includes('飽差');
    return `${isIntegerLike ? Math.round(entry.value) : isVpd ? entry.value.toFixed(2) : entry.value.toFixed(1)}${unit}`;
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

          // 1本目を基準とした Δ値 / Δ日 注釈（GDD / 累積日射量に対応）
          const accumDiffConfig: {
            refKeyPrefix: string;
            seriesByTarget: Map<string, Array<{ mmdd: string; accum: number }>>;
            threshold: number;
            formatDelta: (d: number) => string;
          } | null =
            chartId === 'gdd' ? {
              refKeyPrefix: 'accum_',
              seriesByTarget: gddData.seriesByTarget,
              threshold: GDD_DELTA_DAYS_MIN_V0,
              formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d))}℃`,
            }
            : chartId === 'radiation' ? {
              refKeyPrefix: 'accumRadiation_',
              seriesByTarget: radiationData.seriesByTarget,
              threshold: RADIATION_DELTA_DAYS_MIN_V0,
              formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d))} MJ/m²`,
            }
            : null;

          const refId = accumDiffConfig && targets.length > 1 ? targets[0]?.id : null;
          const refKey = refId && accumDiffConfig ? `${accumDiffConfig.refKeyPrefix}${refId}` : null;
          const v0 = refKey
            ? hover.payload.find((p: any) => p.dataKey === refKey)?.value
            : undefined;
          const hoverDoy = accumDiffConfig && !isMonthly ? mmddToDoy(hover.label) : null;

          const computeAccumDiff = (p: any): string | null => {
            if (!accumDiffConfig || !refId || typeof v0 !== 'number') return null;
            const prefix = accumDiffConfig.refKeyPrefix;
            if (typeof p.dataKey !== 'string' || !p.dataKey.startsWith(prefix)) return null;
            const targetId = p.dataKey.slice(prefix.length);
            if (targetId === refId || typeof p.value !== 'number') return null;

            const delta = p.value - v0;
            const deltaStr = accumDiffConfig.formatDelta(delta);

            // 月次モードは Δ値 のみ
            if (isMonthly) return `(${deltaStr})`;

            // 序盤ガード: V0 が小さすぎる場合は Δ日 を出さない
            if (v0 < accumDiffConfig.threshold) return `(${deltaStr})`;
            if (hoverDoy == null) return `(${deltaStr})`;

            const series = accumDiffConfig.seriesByTarget.get(targetId);
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

  const renderCustomLegend = (types: { label: string, type: 'dashed' | 'solid' | 'thin-bar' | 'thick-bar' | 'range-bar' }[]) => {
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
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/icon.png" alt="Orch.Weather" style={{ width: 32, height: 32 }} />
            <h1 className="title">Orch.Weather</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                width={28}
                height={28}
                style={{ borderRadius: '50%' }}
              />
            )}
            <button
              className="secondary"
              onClick={() => signOut(auth)}
              title="ログアウト"
              style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
            >
              <LogOut size={14} /> ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="app-container">
        <div className="controls-bar" style={{ flexDirection: 'column', alignItems: 'stretch', background: 'var(--card-bg)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>表示対象 (最大3件)</span>
            <button className="secondary" title="設定" onClick={() => setIsSettingsOpen(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              <Settings size={14} /> 設定
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {targets.map((target, index) => (
              <div key={target.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flexShrink: 0, width: '4px', height: '100%', minHeight: '36px', backgroundColor: getYearColor(index, 'var(--accent-color)'), borderRadius: '2px' }}></div>
                <select
                  value={target.locationId}
                  onChange={(e) => updateTarget(target.id, 'locationId', e.target.value)}
                  style={{ flex: 2, minWidth: 0 }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                  {locations.length === 0 && <option value="">地点未設定</option>}
                </select>
                <select
                  value={target.year}
                  onChange={(e) => updateTarget(target.id, 'year', parseInt(e.target.value, 10))}
                  style={{ flex: 1, minWidth: 0 }}
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
                    style={{ flexShrink: 0, color: 'var(--chart-temp)', padding: '0.6rem', border: 'none' }}
                    title="この行を削除"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            {targets.length < 3 && (
              <button
                onClick={addTarget}
                className="secondary"
                style={{ alignSelf: 'flex-start', marginTop: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                <Plus size={16} /> 表示を追加
              </button>
            )}
          </div>
        </div>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* 表示期間 */}
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>表示期間</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <select value={displayRange.startMM} onChange={e => handleRangeChange('startMM', +e.target.value)} style={{ padding: '0.3rem 0.5rem' }}>
              {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
            </select>
            <span>〜</span>
            <select value={displayRange.endMM} onChange={e => handleRangeChange('endMM', +e.target.value)} style={{ padding: '0.3rem 0.5rem' }}>
              {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
            </select>
            <button
              onClick={() => setDisplayRange({ startMM: 1, endMM: 12 })}
              style={{ marginLeft: '0.75rem', padding: '0.35rem 0.8rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid rgba(244,167,185,0.6)', background: 'rgba(244,167,185,0.25)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              年間表示
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>表示単位</span>
            <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(244,167,185,0.6)' }}>
              {(['daily', 'monthly'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setChartViewMode(mode)}
                  style={{
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.85rem',
                    background: chartViewMode === mode ? '#f4a7b9' : 'rgba(244,167,185,0.15)',
                    color: chartViewMode === mode ? '#7a2840' : 'var(--text-secondary)',
                    border: 'none',
                    fontWeight: chartViewMode === mode ? 600 : 400,
                    cursor: 'pointer',
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
            padding: '0.5rem 1rem',
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {CHART_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveChart(tab.id)}
              style={{
                flexShrink: 0,
                padding: '0.3rem 0.9rem',
                borderRadius: '20px',
                fontSize: '0.85rem',
                border: activeChart === tab.id
                  ? '1px solid #f4a7b9'
                  : '1px solid rgba(244,167,185,0.35)',
                background: activeChart === tab.id
                  ? '#f4a7b9'
                  : 'transparent',
                color: activeChart === tab.id
                  ? '#7a2840'
                  : 'var(--text-secondary)',
                fontWeight: activeChart === tab.id ? 700 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              {chartFrame('temp', (
                <ResponsiveContainer width="100%" height="100%">
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
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月間平均', type: 'solid' }
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
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              {chartFrame('precip', (
                <ResponsiveContainer width="100%" height="100%">
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
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend(isMonthly ? [
                { label: '月間降水量', type: 'thick-bar' },
                { label: '累積降水量', type: 'solid' }
              ] : [
                { label: '降水量', type: 'thin-bar' },
                { label: '月間降水量', type: 'thick-bar' },
                { label: '累積降水量', type: 'solid' }
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
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              {chartFrame('sunshine', (
                <ResponsiveContainer width="100%" height="100%">
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
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '日照時間', type: 'thin-bar' },
                { label: '累積日照時間', type: 'solid' }
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
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              {chartFrame('radiation', (
                <ResponsiveContainer width="100%" height="100%">
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
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '日射量', type: 'thin-bar' },
                { label: '累積日射量', type: 'solid' }
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              {chartFrame('gdd', (
                <ResponsiveContainer width="100%" height="100%">
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
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '有効積算温度', type: 'thin-bar' },
                { label: '累積有効積算温度', type: 'solid' }
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              {chartFrame('humid', (
                <ResponsiveContainer width="100%" height="100%">
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
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月間平均', type: 'solid' }
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
            <h2 className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}>💧 飽差</h2>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              {chartFrame('vpd', (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis {...yAxisCommon} domain={['auto', 'auto']} label={{ value: '(kPa)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={tooltipContents.vpd} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 }} isAnimationActive={false} />
{targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-humid)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`vpdRange_${target.id}`} name={`${name} 飽差(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`monthlyMeanVpdMax_${target.id}`} name={`${name} 月平均最高飽差`} stroke={color} strokeWidth={2.5} dot={false} connectNulls={true} isAnimationActive={false}>
                            {isMonthly && index === 0 && (
                              <LabelList dataKey={`monthlyMeanVpdMax_${target.id}`} position="top" formatter={(v: any) => typeof v === 'number' ? v.toFixed(2) : ''} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
                            )}
                          </Line>
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              ), true)}
              {renderCustomLegend([
                { label: '最低～最高', type: isMonthly ? 'thick-bar' : 'range-bar' },
                { label: '月平均最高飽差', type: 'solid' },
              ])}
              {renderValueBox('vpd')}
              <MonthsTable
                rowsDef={[
                  { key: 'meanVpd', label: '月平均飽差 (kPa)' },
                  { key: 'meanVpdMax', label: '月平均最高飽差 (kPa)' },
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

      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </>
  );
}

export default App;
