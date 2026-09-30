import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store';
import { useWeatherData, type CompareTarget } from '../../hooks/useWeather';
import { useForecast } from '../../hooks/useForecast';
import { logWeatherView } from '../../lib/analytics';
import {
  createViewportAround,
  horizontalPinchDistance,
  nextGestureMode,
  panViewport,
  shouldAcceptChartTooltip,
  zoomViewport,
  zoomViewportByFactor,
  type ChartGestureMode,
  type ChartViewport,
} from '../../lib/chartViewport';

export type ChartId = 'temp' | 'precip' | 'sunshine' | 'radiation' | 'gdd' | 'humid' | 'vpd';

// 飽差 = 飽和水蒸気量 - 実水蒸気量 [g/m³]（施設園芸の現場標準単位）
// e_s(T)[hPa] = 6.1078 × 10^(7.5T/(T+237.3))（Tetens式）
// 飽和水蒸気量[g/m³] = 216.67 × e_s / (T + 273.15) （理想気体の状態方程式）
const calcVPD = (tempC: number, humidPct: number): number => {
  const e_s_hPa = 6.1078 * Math.pow(10, 7.5 * tempC / (tempC + 237.3));
  const a_max = 216.67 * e_s_hPa / (tempC + 273.15);
  return a_max * (1 - humidPct / 100);
};

const MOBILE_INITIAL_DAILY_WINDOW = 120;
const DESKTOP_INITIAL_DAILY_WINDOW = 180;
const MIN_DAILY_WINDOW = 14;
const GESTURE_TOOLTIP_DELAY_MS = 200;

type ChartPointer = {
  startX: number;
  startY: number;
  x: number;
  y: number;
};

type ChartGesture = {
  mode: ChartGestureMode;
  chartId: string | null;
  pointers: Map<number, ChartPointer>;
  primaryPointerId: number | null;
  startViewport: ChartViewport | null;
  initialDistance: number;
  anchorRatio: number;
};

/**
 * 空くらべの state / データ取得 / ジェスチャー処理。
 * 空くらべタブを離れても state と取得を保持する（従来どおり AppContent 側で呼ぶ）ため、
 * AnalysisTab ではなく App から呼び出す。
 */
export function useAnalysisState(isMobile: boolean) {
  const { locations, userSettings, geoLocation, authLoading } = useAppStore();
  const currentYear = new Date().getFullYear();
  const [selectedBaseTempIndex, setSelectedBaseTempIndex] = useState<0 | 1>(0);
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'monthly'>('daily');
  const [activeChart, setActiveChart] = useState<ChartId>('temp');
  const [hover, setHover] = useState<{ chartId: string; payload: any[]; label: string } | null>(null);
  const pendingHoverRef = useRef<{ chartId: string; payload: any[]; label: string } | null>(null);
  const hoverRafRef = useRef<number>(0);

  const [dailyViewport, setDailyViewport] = useState<{ start: number; end: number } | null>(null);
  const gestureRef = useRef<ChartGesture>({
    mode: 'idle',
    chartId: null,
    pointers: new Map(),
    primaryPointerId: null,
    startViewport: null,
    initialDistance: 0,
    anchorRatio: 0.5,
  });
  const [tooltipGestureMode, setTooltipGestureMode] = useState<ChartGestureMode>('idle');
  const tooltipGestureModeRef = useRef<ChartGestureMode>('idle');
  const tooltipDelayRef = useRef<number>(0);
  const panRafRef = useRef<number>(0);
  const pendingViewportRef = useRef<{ start: number; end: number } | null>(null);
  const chartFrameRef = useRef<HTMLDivElement | null>(null);
  const analysisChartsRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => () => {
    if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
    if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
    if (tooltipDelayRef.current) window.clearTimeout(tooltipDelayRef.current);
  }, []);

  const analysisInitializedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (analysisInitializedRef.current) return;
    analysisInitializedRef.current = true;

    const defaultLocId = userSettings?.defaultLocationId;
    const hasValidDefault = !!(defaultLocId && locations.some(l => l.id === defaultLocId));
    const locationId = hasValidDefault ? defaultLocId! : '__geo__';

    setTargets(prev => prev.map((t, i) => i === 0 ? { ...t, locationId } : t));
    setCommittedTargets(prev => prev.map((t, i) => i === 0 ? { ...t, locationId } : t));
  }, [authLoading, userSettings, locations]);

  const initialLocation = locations.length > 0 ? locations[0].id : '';
  const initialTargetIdRef = useRef(`t_${Date.now()}`);
  const [targets, setTargets] = useState<CompareTarget[]>([
    { id: initialTargetIdRef.current, locationId: initialLocation, year: new Date().getFullYear() }
  ]);
  const [committedTargets, setCommittedTargets] = useState<CompareTarget[]>([
    { id: initialTargetIdRef.current, locationId: initialLocation, year: new Date().getFullYear() }
  ]);
  const [isCommitting, setIsCommitting] = useState(false);

  // ターゲット（地点・年）が変わったときホバー値をクリア（古い payload で diff が計算されるのを防ぐ）
  useEffect(() => {
    setHover(null);
  }, [targets]);

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

  const { data: weatherData, loading, loadingStatus, error } = useWeatherData(committedTargets);

  // コア機能（天気データ表示）への到達を計測。logWeatherView 側でセッション1回に制限。
  useEffect(() => {
    if (Object.keys(weatherData).length > 0) {
      logWeatherView();
    }
  }, [weatherData]);

  // 分析タブ用予報データ（committedTargets[0] の地点のみ取得）
  const forecastLoc = useMemo(() => {
    const t = committedTargets[0];
    if (!t) return null;
    const loc = t.locationId === '__geo__'
      ? geoLocation
      : locations.find(l => l.id === t.locationId);
    return loc ? { lat: loc.lat, lon: loc.lon } : null;
  }, [committedTargets, locations, geoLocation]);

  const { data: forecastData } = useForecast(
    forecastLoc?.lat ?? null,
    forecastLoc?.lon ?? null,
  );

  const forecastLoc2 = useMemo(() => {
    const t = committedTargets[1];
    if (!t || t.year !== currentYear) return null;
    const loc = t.locationId === '__geo__'
      ? geoLocation
      : locations.find(l => l.id === t.locationId);
    return loc ? { lat: loc.lat, lon: loc.lon } : null;
  }, [committedTargets, locations, geoLocation, currentYear]);

  const { data: forecastData2 } = useForecast(
    forecastLoc2?.lat ?? null,
    forecastLoc2?.lon ?? null,
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

    committedTargets.forEach((target, index) => {
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

      // ── 予報オーバーレイ（今年のターゲットのみ） ──────────────────────────
      const fData = index === 0 ? forecastData : forecastData2;
      if (fData && target.year === currentYear) {
        fData.daily.forEach(fDay => {
          if (fDay.isPlaceholder) return; // データ未作成日はオーバーレイに描かない
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
  }, [weatherData, committedTargets, userSettings, forecastData, forecastData2, currentYear]);

  const gddData = useMemo(() => {
    const selectedBaseTemp = userSettings?.baseTempSettings[selectedBaseTempIndex] ?? 10;
    const gddStart = userSettings?.accumStartDates?.gdd ?? '01-01';
    const overlay = new Map<string, Record<string, number | null>>();
    const seriesByTarget = new Map<string, Array<{ mmdd: string; accum: number }>>();

    committedTargets.forEach((target) => {
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

      // ── 予報GDD累積（今年のターゲットのみ） ────────────────────────────────
      const targetIdx = committedTargets.findIndex(t => t.id === target.id);
      const fData = targetIdx === 0 ? forecastData : (targetIdx === 1 ? forecastData2 : null);
      if (fData && target.year === currentYear) {
        let forecastGddRunning = runningAccumTemp; // 昨日時点の累積GDD

        fData.daily.forEach(fDay => {
          if (fDay.isPlaceholder) return; // データ未作成日は累積に加算しない
          const mmdd = fDay.date.slice(5); // "YYYY-MM-DD" → "MM-DD"
          const existing = overlay.get(mmdd) ?? {};

          if (mmdd >= gddStart) {
            const tempMean = (fDay.tempMax + fDay.tempMin) / 2;
            const diff = tempMean - selectedBaseTemp;
            const dailyGdd = diff > 0 ? diff : 0;
            forecastGddRunning += dailyGdd;
            existing[`forecast_accum_gdd_${target.id}`] = forecastGddRunning;
            // Δ日逆引き用に予報期間も series に追加（確定データだけでは未到達と誤判定されるため）
            series.push({ mmdd, accum: forecastGddRunning });
          }
          overlay.set(mmdd, existing);
        });
      }
    });

    return { overlay, seriesByTarget };
  }, [weatherData, committedTargets, userSettings, selectedBaseTempIndex, forecastData, forecastData2, currentYear]);

  // 日射量チャート Δ日 逆引き用：累積日射量の MM-DD 系列
  // 累積は baseChartData と同じ開始日ベースで自前計算
  const radiationData = useMemo(() => {
    const radiationStart = userSettings?.accumStartDates?.radiation ?? '01-01';
    const seriesByTarget = new Map<string, Array<{ mmdd: string; accum: number }>>();
    committedTargets.forEach((target) => {
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
      // Δ日逆引き用に予報期間も series に追加（今年のターゲットのみ）
      const rTargetIdx = committedTargets.findIndex(t => t.id === target.id);
      const rFData = rTargetIdx === 0 ? forecastData : (rTargetIdx === 1 ? forecastData2 : null);
      if (rFData && target.year === currentYear) {
        rFData.daily.forEach(fDay => {
          const mmdd = fDay.date.slice(5);
          if (mmdd < radiationStart) return;
          running += fDay.radiationSum;
          series.push({ mmdd, accum: running });
        });
      }
    });
    return { seriesByTarget };
  }, [weatherData, committedTargets, userSettings, forecastData, forecastData2, currentYear]);

  // 日照時間チャート Δ日 逆引き用：累積日照時間の MM-DD 系列
  const sunshineData = useMemo(() => {
    const sunshineStart = userSettings?.accumStartDates?.sunshine ?? '01-01';
    const seriesByTarget = new Map<string, Array<{ mmdd: string; accum: number }>>();
    committedTargets.forEach((target) => {
      const data = weatherData[target.id];
      if (!data) return;
      const series: Array<{ mmdd: string; accum: number }> = [];
      let running = 0;
      data.daily.forEach(day => {
        const mmdd = day.date.substring(5);
        if (mmdd < sunshineStart) return;
        running += day.sunshineDuration;
        series.push({ mmdd, accum: running });
      });
      seriesByTarget.set(target.id, series);
      const sTargetIdx = committedTargets.findIndex(t => t.id === target.id);
      const sFData = sTargetIdx === 0 ? forecastData : (sTargetIdx === 1 ? forecastData2 : null);
      if (sFData && target.year === currentYear) {
        sFData.daily.forEach(fDay => {
          const mmdd = fDay.date.slice(5);
          if (mmdd < sunshineStart) return;
          running += fDay.sunshineDuration;
          series.push({ mmdd, accum: running });
        });
      }
    });
    return { seriesByTarget };
  }, [weatherData, committedTargets, userSettings, forecastData, forecastData2, currentYear]);

  // 予報ホバー日別値マップ（積算温度・日射量・日照時間の予報点タップ用）
  const forecastDailyMap = useMemo(() => {
    if (!forecastData || !committedTargets[0] || committedTargets[0].year !== currentYear) return null;
    const selectedBaseTemp = userSettings?.baseTempSettings[selectedBaseTempIndex] ?? 10;
    const map = new Map<string, { gdd: number; radiation: number; sunshine: number; precip: number }>();
    forecastData.daily.forEach(fDay => {
      if (fDay.isPlaceholder) return; // データ未作成日は予報タップ値に含めない
      const mmdd = fDay.date.slice(5);
      const tempMean = (fDay.tempMax + fDay.tempMin) / 2;
      const diff = tempMean - selectedBaseTemp;
      map.set(mmdd, {
        gdd: diff > 0 ? diff : 0,
        radiation: fDay.radiationSum,
        sunshine: fDay.sunshineDuration,
        precip: fDay.precipSum,
      });
    });
    return { targetId: committedTargets[0].id, values: map };
  }, [forecastData, committedTargets, userSettings, selectedBaseTempIndex, currentYear]);

  const forecastDailyMap2 = useMemo(() => {
    if (!forecastData2 || !committedTargets[1] || committedTargets[1].year !== currentYear) return null;
    const selectedBaseTemp = userSettings?.baseTempSettings[selectedBaseTempIndex] ?? 10;
    const map = new Map<string, { gdd: number; radiation: number; sunshine: number; precip: number }>();
    forecastData2.daily.forEach(fDay => {
      if (fDay.isPlaceholder) return; // データ未作成日は予報タップ値に含めない
      const mmdd = fDay.date.slice(5);
      const tempMean = (fDay.tempMax + fDay.tempMin) / 2;
      const diff = tempMean - selectedBaseTemp;
      map.set(mmdd, {
        gdd: diff > 0 ? diff : 0,
        radiation: fDay.radiationSum,
        sunshine: fDay.sunshineDuration,
        precip: fDay.precipSum,
      });
    });
    return { targetId: committedTargets[1].id, values: map };
  }, [forecastData2, committedTargets, userSettings, selectedBaseTempIndex, currentYear]);

  const filteredBaseChartData = baseChartData;

  const filteredGddChartData = useMemo(() => {
    if (gddData.overlay.size === 0) return filteredBaseChartData;
    return filteredBaseChartData.map(entry => {
      const gdd = gddData.overlay.get(entry.dateStr);
      return gdd ? { ...entry, ...gdd } : entry;
    });
  }, [filteredBaseChartData, gddData]);

  const filteredFirstOfMonths = firstOfMonths;



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

    committedTargets.forEach(target => {
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
  }, [weatherData, committedTargets, userSettings, selectedBaseTempIndex]);

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
      committedTargets.forEach(target => {
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
  }, [monthlyStats, committedTargets]);

  const filteredMonthlyChartData = monthlyChartData;

  // チャート切替用ヘルパー
  const isMonthly = chartViewMode === 'monthly';
  // 日次モード + 今年 + 予報取得済み の3条件が揃ったとき点線オーバーレイを表示
  const currentTargetHasForecast =
    !isMonthly && !!forecastData && committedTargets[0]?.year === currentYear;
  const compareTargetHasForecast =
    !isMonthly && !!forecastData2 && committedTargets[1]?.year === currentYear;
  const chartData = isMonthly ? filteredMonthlyChartData : filteredBaseChartData;
  const gddChartData = isMonthly ? filteredMonthlyChartData : filteredGddChartData;
  const xTickFormatterBase = isMonthly
    ? (val: string) => `${parseInt(val, 10)}月`
    : (val: string) => val.split('-').join('/');

  // 日次データが変わったら、モバイルは今日を中心とした約4か月、
  // デスクトップは年間全体を初期表示する。
  useEffect(() => {
    const total = filteredBaseChartData.length;
    if (total === 0) { setDailyViewport(null); return; }

    const now = new Date();
    const todayKey = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const firstOnOrAfterToday = filteredBaseChartData.findIndex(d => d.dateStr >= todayKey);
    const anchorIndex = firstOnOrAfterToday >= 0 ? firstOnOrAfterToday : total - 1;
    const requestedWindow = isMobile ? MOBILE_INITIAL_DAILY_WINDOW : DESKTOP_INITIAL_DAILY_WINDOW;
    setDailyViewport(createViewportAround(total, anchorIndex, requestedWindow));
  }, [filteredBaseChartData, isMobile]);

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
  const tooltipInteractionEnabled = shouldAcceptChartTooltip(tooltipGestureMode, 0, 0);

  const queueViewport = (viewport: ChartViewport) => {
    pendingViewportRef.current = viewport;
    if (panRafRef.current) return;
    panRafRef.current = requestAnimationFrame(() => {
      panRafRef.current = 0;
      const next = pendingViewportRef.current;
      if (next) setDailyViewport(next);
    });
  };

  const beginTooltipSuppression = (mode: 'pan' | 'pinch') => {
    if (tooltipDelayRef.current) window.clearTimeout(tooltipDelayRef.current);
    if (hoverRafRef.current) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = 0;
    }
    pendingHoverRef.current = null;
    tooltipGestureModeRef.current = mode;
    setTooltipGestureMode(mode);
    setHover(null);
  };

  const finishTooltipSuppression = () => {
    tooltipGestureModeRef.current = 'blocked';
    setTooltipGestureMode('blocked');
    if (tooltipDelayRef.current) window.clearTimeout(tooltipDelayRef.current);
    tooltipDelayRef.current = window.setTimeout(() => {
      tooltipGestureModeRef.current = 'idle';
      setTooltipGestureMode('idle');
      tooltipDelayRef.current = 0;
    }, GESTURE_TOOLTIP_DELAY_MS);
  };

  // Pointer Eventsでタップ、横パン、2本指ピンチ、縦スクロールを排他的に扱う。
  const handlePointerDown = (chartId: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMonthly || !dailyViewport || (e.pointerType === 'mouse' && e.button !== 0)) return;

    const gesture = gestureRef.current;
    gesture.pointers.set(e.pointerId, {
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
    });

    if (gesture.pointers.size === 1) {
      gesture.mode = 'pending';
      gesture.chartId = chartId;
      gesture.primaryPointerId = e.pointerId;
      gesture.startViewport = { ...dailyViewport };
      return;
    }

    if (nextGestureMode(gesture.mode, gesture.pointers.size, 0, 0) === 'pinch' && gesture.chartId === chartId) {
      const [first, second] = [...gesture.pointers.values()];
      gesture.mode = 'pinch';
      gesture.startViewport = { ...dailyViewport };
      gesture.initialDistance = horizontalPinchDistance(first, second);
      const bounds = e.currentTarget.getBoundingClientRect();
      const midpointX = (first.x + second.x) / 2;
      gesture.anchorRatio = Math.max(0, Math.min(1, (midpointX - bounds.left) / Math.max(1, bounds.width)));
      beginTooltipSuppression('pinch');
      for (const pointerId of gesture.pointers.keys()) {
        try { e.currentTarget.setPointerCapture(pointerId); } catch {
          // Pointer capture is optional and can fail after a native gesture cancellation.
        }
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const pointer = gesture.pointers.get(e.pointerId);
    if (!pointer || !gesture.startViewport || !dailyViewport) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (gesture.mode === 'pending' && gesture.primaryPointerId === e.pointerId) {
      const nextMode = nextGestureMode(
        gesture.mode,
        gesture.pointers.size,
        pointer.x - pointer.startX,
        pointer.y - pointer.startY,
      );
      gesture.mode = nextMode;
      if (nextMode === 'pan') {
        beginTooltipSuppression('pan');
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {
          // Continue without capture when the browser already released the pointer.
        }
      }
    }

    if (gesture.mode === 'pan' && gesture.primaryPointerId === e.pointerId) {
      e.preventDefault();
      queueViewport(panViewport(
        gesture.startViewport,
        chartData.length,
        pointer.x - pointer.startX,
        Math.max(1, chartPixelWidth - 8),
      ));
      return;
    }

    if (gesture.mode === 'pinch' && gesture.pointers.size >= 2) {
      e.preventDefault();
      const [first, second] = [...gesture.pointers.values()];
      const currentDistance = horizontalPinchDistance(first, second);
      queueViewport(zoomViewport({
        viewport: gesture.startViewport,
        total: chartData.length,
        initialDistance: gesture.initialDistance,
        currentDistance,
        anchorRatio: gesture.anchorRatio,
        minWindow: MIN_DAILY_WINDOW,
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const previousMode = gesture.mode;
    const completedGesture = previousMode === 'pan' || previousMode === 'pinch' || previousMode === 'blocked';
    gesture.pointers.delete(e.pointerId);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {
      // Releasing a pointer that was never captured is harmless.
    }

    if (completedGesture && gesture.pointers.size > 0) {
      gesture.mode = nextGestureMode(previousMode, gesture.pointers.size, 0, 0);
      return;
    }

    if (gesture.pointers.size === 0) {
      if (completedGesture) finishTooltipSuppression();
      gesture.mode = 'idle';
      gesture.chartId = null;
      gesture.primaryPointerId = null;
      gesture.startViewport = null;
    }
  };

  // マウスがチャート外へ出たらパネルをクリア（タッチはタップ後も値を維持するためスキップ）
  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    setHover(null);
  };

  const zoomDailyViewport = (factor: number, anchorRatio = 0.5) => {
    if (isMonthly) return;
    setDailyViewport(current => current && zoomViewportByFactor({
      viewport: current,
      total: chartData.length,
      factor,
      anchorRatio,
      minWindow: MIN_DAILY_WINDOW,
    }));
  };

  useEffect(() => {
    const charts = analysisChartsRef.current;
    if (!charts) return;

    const handleWheel = (e: WheelEvent) => {
      if (isMonthly || (!e.ctrlKey && !e.metaKey)) return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('.chart-bleed') : null;
      if (!target || !charts.contains(target)) return;

      e.preventDefault();
      const bounds = target.getBoundingClientRect();
      const anchorRatio = Math.max(0, Math.min(1, (e.clientX - bounds.left) / Math.max(1, bounds.width)));
      const factor = Math.exp(Math.max(-100, Math.min(100, e.deltaY)) * 0.002);
      beginTooltipSuppression('pinch');
      zoomDailyViewport(factor, anchorRatio);
      finishTooltipSuppression();
    };

    charts.addEventListener('wheel', handleWheel, { passive: false });
    return () => charts.removeEventListener('wheel', handleWheel);
  });

  // Recharts v3 では onMouseMove から activePayload が削除されたため、
  // <Tooltip content={fn}> 経由でペイロードを受け取る方式に変更。
  // setHover は RAF でスロットリング（最大 60fps）し、render中の setState 連鎖を防ぐ。
  const makeTooltipContent = useCallback((chartId: string) => (props: any) => {
    if (!tooltipInteractionEnabled) return null;
    const { payload, label, active } = props;
    if (active && payload?.length && label != null) {
      pendingHoverRef.current = { chartId, payload: payload as any[], label };
      if (!hoverRafRef.current) {
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = 0;
          if (!shouldAcceptChartTooltip(tooltipGestureModeRef.current, 0, 0)) {
            pendingHoverRef.current = null;
            return;
          }
          const p = pendingHoverRef.current;
          if (p) setHover(prev =>
            prev?.chartId === p.chartId && prev?.label === p.label ? prev
              : { chartId: p.chartId, payload: p.payload, label: p.label }
          );
        });
      }
    }
    return null;
  }, [tooltipInteractionEnabled]);

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

  return {
    targets, committedTargets, setCommittedTargets, isCommitting, setIsCommitting,
    addTarget, removeTarget, updateTarget, getLocationName,
    selectedBaseTempIndex, setSelectedBaseTempIndex, chartViewMode, setChartViewMode, isMonthly,
    activeChart, setActiveChart, hover,
    weatherData, loading, loadingStatus, error,
    gddData, radiationData, sunshineData, forecastDailyMap, forecastDailyMap2,
    currentTargetHasForecast, compareTargetHasForecast, chartData,
    visibleChartData, visibleGddChartData, xTicks, xTickFormatter,
    yAxisCommon, yAxisCommonRight, chartMargin, tooltipInteractionEnabled, tooltipContents,
    setDailyViewport, zoomDailyViewport, analysisChartsRef, chartFrameCbRef,
    handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave,
  };
}
