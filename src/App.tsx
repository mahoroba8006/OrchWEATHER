import React, { useState, useMemo, useEffect } from 'react';
import { CloudRain, Thermometer, Droplets, Leaf, Settings, Sun, Plus, X, LogOut } from 'lucide-react';
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
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

function App() {
  const { locations, user, authLoading, setUser, setAuthLoading, loadLocations, loadUserSettings, userSettings } = useAppStore();
  const [selectedBaseTempIndex, setSelectedBaseTempIndex] = useState<0 | 1>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [displayRange, setDisplayRange] = useState({ startMM: 1, endMM: 12 });

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
          const curTemp = monthlyMean.get(monthStr);
          const curHumid = monthlyHumidMean.get(monthStr);
          if (prevTemp !== undefined && curTemp !== undefined) {
            entry[`t_${target.id}_monthlyMeanTemp`] = (prevTemp + curTemp) / 2;
          }
          if (prevHumid !== undefined && curHumid !== undefined) {
            entry[`monthlyHumid_${target.id}`] = (prevHumid + curHumid) / 2;
          }
        }

        entry[`humidRange_${target.id}`] = [day.humidMin, day.humidMax];

        if (dayStr === plotDayStr && monthlyPrecipSum.has(monthStr)) {
          entry[`monthlyPrecip_${target.id}`] = monthlyPrecipSum.get(monthStr);
        }

        entry[`precip_${target.id}`] = day.precipSum;
        entry[`accumPrecip_${target.id}`] = day.accumPrecip;
        entry[`humid_${target.id}`] = day.humidMean;
        entry[`radiation_${target.id}`] = day.radiation;
        entry[`accumRadiation_${target.id}`] = day.accumRadiation;
      });

      // 12/31：12月と翌年1月の中間値（翌年データがある場合のみ）
      if (data.nextJanMeans) {
        const dec31Entry = map.get('12-31');
        if (dec31Entry) {
          const decTemp  = monthlyMean.get('12');
          const decHumid = monthlyHumidMean.get('12');
          if (decTemp !== undefined) {
            dec31Entry[`t_${target.id}_monthlyMeanTemp`] = (decTemp + data.nextJanMeans.tempMean) / 2;
          }
          if (decHumid !== undefined) {
            dec31Entry[`monthlyHumid_${target.id}`] = (decHumid + data.nextJanMeans.humidMean) / 2;
          }
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [weatherData, targets]);

  const gddData = useMemo(() => {
    const selectedBaseTemp = userSettings?.baseTempSettings[selectedBaseTempIndex] ?? 10;
    const overlay = new Map<string, Record<string, number>>();

    targets.forEach((target) => {
      const data = weatherData[target.id];
      if (!data) return;
      let runningAccumTemp = 0;
      data.daily.forEach(day => {
        const mmdd = day.date.substring(5);
        const diff = day.tempMean - selectedBaseTemp;
        const dailyAccum = diff > 0 ? diff : 0;
        runningAccumTemp += dailyAccum;
        const existing = overlay.get(mmdd) ?? {};
        existing[`dailyAccum_${target.id}`] = dailyAccum;
        existing[`accum_${target.id}`] = runningAccumTemp;
        overlay.set(mmdd, existing);
      });
    });

    return overlay;
  }, [weatherData, targets, userSettings, selectedBaseTempIndex]);

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
    if (gddData.size === 0) return filteredBaseChartData;
    return filteredBaseChartData.map(entry => {
      const gdd = gddData.get(entry.dateStr);
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
        
        let monthAccumSum = 0;
        monthDays.forEach(d => {
          const diff = d.tempMean - baseT;
          if (diff > 0) monthAccumSum += diff;
        });
        
        const monthMeanAccum = monthAccumSum / monthDays.length;
        
        const meanHumid = monthDays.reduce((sum, d) => sum + d.humidMean, 0) / monthDays.length;
        
        stats[target.id][m] = {
          meanTemp,
          maxTemp,
          minTemp,
          meanPrecip,
          sumPrecip,
          meanRad,
          sumRad,
          monthAccumSum,
          monthMeanAccum,
          meanHumid
        };
      }
    });
    return stats;
  }, [weatherData, targets, userSettings, selectedBaseTempIndex]);

  const getYearColor = (index: number, _baseColor: string) => {
    const targetColors = [
      'var(--accent-color)', // 1つ目: グリーン系
      '#9b66d9',             // 2つ目: パープル系
      'var(--chart-precip)', // 3つ目: ブルー系
    ];
    return targetColors[index % targetColors.length];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
          <p style={{ margin: '0 0 5px', fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry: any, index: number) => {
            let unit = '℃';
            if (entry.name.includes('降水')) unit = 'mm';
            if (entry.name.includes('湿度')) unit = '%';
            if (entry.name.includes('日射')) unit = 'MJ/m²';
            let valueStr = typeof entry.value === 'number' ? entry.value.toFixed(1) : '--';
            if (Array.isArray(entry.value) && entry.value.length === 2) {
              valueStr = `${entry.value[0]?.toFixed(1)} ～ ${entry.value[1]?.toFixed(1)}`;
            }
            return (
              <div key={index} style={{ color: entry.color, fontSize: '0.875rem' }}>
                {entry.name}: {valueStr} {unit}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

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
              <div key={target.id} style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '4px', height: '100%', minHeight: '36px', backgroundColor: getYearColor(index, 'var(--accent-color)'), borderRadius: '2px' }}></div>
                <select
                  value={target.locationId}
                  onChange={(e) => updateTarget(target.id, 'locationId', e.target.value)}
                  style={{ flex: 2, minWidth: '150px' }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                  {locations.length === 0 && <option value="">地点未設定</option>}
                </select>
                <select
                  value={target.year}
                  onChange={(e) => updateTarget(target.id, 'year', parseInt(e.target.value, 10))}
                  style={{ flex: 1, minWidth: '100px' }}
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
                    style={{ color: 'var(--chart-temp)', padding: '0.6rem', border: 'none' }}
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
        </div>

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.2)', border: '1px solid var(--chart-temp)', borderRadius: '8px', color: 'var(--text-primary)' }}>
            ⚠️ エラーが発生しました: {error}
          </div>
        )}

        {/* 1. 気温 (Temperature) */}
        <section className="glass-panel" style={sectionStyle}>
          <h2 className="chart-title" style={{marginBottom: 0}}><Thermometer size={18} /> 気温</h2>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}><div style={{ height: '350px', minWidth: '700px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredBaseChartData} margin={{ top: 25, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={(val) => val.split('-').join('/')} ticks={filteredFirstOfMonths} />
                    <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} domain={['auto', 'auto']} label={{ value: '(℃)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    {targets.map((target, index) => {
                      const color = getYearColor(index, 'var(--chart-temp)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`t_${target.id}_tempRange`} name={`${getLocationName(target.locationId)} ${target.year}年 気温(最低-最高)`} fill={color} shape={<CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`t_${target.id}_monthlyMeanTemp`} name={`${getLocationName(target.locationId)} ${target.year}年 月平均気温`} stroke={color} strokeWidth={2.5} dot={false} connectNulls={true} />
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div></div>
              {renderCustomLegend([
                { label: '最低～最高', type: 'range-bar' },
                { label: '月間平均', type: 'solid' }
              ])}
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

        {/* 2. 降水量 (Precipitation) */}
        <section className="glass-panel" style={sectionStyle}>
          <h2 className="chart-title" style={{marginBottom: 0}}><CloudRain size={18} /> 降水量</h2>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}><div style={{ height: '350px', minWidth: '700px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredBaseChartData} margin={{ top: 25, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={(val) => val.split('-').join('/')} ticks={filteredFirstOfMonths} />
                    <YAxis yAxisId="left" stroke="var(--text-secondary)" tick={{fontSize: 12}} label={{ value: '(mm)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" tick={{fontSize: 12}} label={{ value: '(mm)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Bar 
                          key={`monthlyPrecip_${target.id}`}
                          yAxisId="left"
                          dataKey={`monthlyPrecip_${target.id}`} 
                          name={`${name} 月合計降水`} 
                          fill={getYearColor(index, 'var(--chart-precip)')} 
                          shape={<CustomWideBar />}
                        />
                      );
                    })}
                    {targets.map((target, index) => {
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
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div></div>
              {renderCustomLegend([
                { label: '降水量', type: 'thin-bar' },
                { label: '月間降水量', type: 'thick-bar' },
                { label: '累積降水量', type: 'solid' }
              ])}
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

        {/* 3. 日射量 (Solar Radiation) */}
        <section className="glass-panel" style={sectionStyle}>
          <h2 className="chart-title" style={{marginBottom: 0}}><Sun size={18} /> 日射量</h2>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}><div style={{ height: '350px', minWidth: '700px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredBaseChartData} margin={{ top: 25, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={(val) => val.split('-').join('/')} ticks={filteredFirstOfMonths} />
                    <YAxis yAxisId="left" stroke="var(--text-secondary)" tick={{fontSize: 12}} label={{ value: '(MJ/m²)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" tick={{fontSize: 12}} label={{ value: '(MJ/m²)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Bar 
                          key={`radiation_${target.id}`}
                          yAxisId="left"
                          dataKey={`radiation_${target.id}`} 
                          name={`${name} 日別日射`} 
                          fill={getYearColor(index, 'var(--chart-sunshine)')} 
                          opacity={index === 0 ? 0.5 : 0.3}
                        />
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
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div></div>
              {renderCustomLegend([
                { label: '日射量', type: 'thin-bar' },
                { label: '累積日射量', type: 'solid' }
              ])}
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

        {/* 4. 有効積算温度 (Accumulated Temperature) */}
        <section className="glass-panel" style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="chart-title" style={{ marginBottom: 0 }}><Leaf size={18} /> 有効積算温度</h2>
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
              <div style={{ overflowX: 'auto' }}><div style={{ height: '350px', minWidth: '700px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredGddChartData} margin={{ top: 25, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={(val) => val.split('-').join('/')} ticks={filteredFirstOfMonths} />
                    <YAxis yAxisId="left" stroke="var(--text-secondary)" tick={{fontSize: 12}} label={{ value: '(℃/日)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" tick={{fontSize: 12}} label={{ value: '(℃)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      return (
                        <Bar 
                          key={`dailyAccum_${target.id}`}
                          yAxisId="left"
                          dataKey={`dailyAccum_${target.id}`} 
                          name={`${name} 日別積算`} 
                          fill={getYearColor(index, 'var(--chart-sunshine)')}
                          opacity={index === 0 ? 0.5 : 0.3}
                        />
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
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div></div>
              {renderCustomLegend([
                { label: '有効積算温度', type: 'thin-bar' },
                { label: '累積有効積算温度', type: 'solid' }
              ])}
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

        {/* 5. 湿度 (Humidity) */}
        <section className="glass-panel" style={sectionStyle}>
          <h2 className="chart-title" style={{marginBottom: 0}}><Droplets size={18} /> 湿度</h2>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>データを取得中...</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}><div style={{ height: '350px', minWidth: '700px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredBaseChartData} margin={{ top: 25, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
                    <XAxis dataKey="dateStr" stroke="var(--text-secondary)" tick={{fontSize: 12}} tickFormatter={(val) => val.split('-').join('/')} ticks={filteredFirstOfMonths} />
                    <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} domain={['auto', 'auto']} label={{ value: '(%)', position: 'top', offset: 10, fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    {targets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-humid)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`humidRange_${target.id}`} name={`${name} 湿度(最低-最高)`} fill={color} shape={<CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`monthlyHumid_${target.id}`} name={`${name} 月平均湿度`} stroke={color} strokeWidth={2.5} dot={false} connectNulls={true} />
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div></div>
              {renderCustomLegend([
                { label: '最低～最高', type: 'range-bar' },
                { label: '月間平均', type: 'solid' }
              ])}
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
        
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </>
  );
}

export default App;
