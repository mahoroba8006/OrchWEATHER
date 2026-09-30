import React from 'react';
import { CloudRain, Thermometer, Droplets, DropletOff, Leaf, Sun, Plus, Minus, Maximize2, X, Clock, Loader2, BarChart2 } from 'lucide-react';
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, LabelList } from 'recharts';
import { useAppStore } from '../../store';
import { DailyRawTable } from '../DailyRawTable';
import { Footer } from '../Footer';
import { SkyBand } from '../sky/SkyBand';
import { GEO_OPTIONS } from '../../lib/geo';
import { CustomWideBar, CustomRangeBar, ForecastRangeBar } from './chartShapes';
import type { ChartId, useAnalysisState } from './useAnalysisState';

const CHART_TABS: { id: ChartId; label: string }[] = [
  { id: 'temp',      label: '気温' },
  { id: 'precip',    label: '降水量' },
  { id: 'gdd',       label: '積算温度' },
  { id: 'radiation', label: '日射量' },
  { id: 'sunshine',  label: '日照時間' },
  { id: 'humid',     label: '湿度' },
  { id: 'vpd',       label: '飽差' },
];

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

export function AnalysisTab({ isMobile, analysis }: { isMobile: boolean; analysis: ReturnType<typeof useAnalysisState> }) {
  const { locations, userSettings, geoLocation, setGeoLocation } = useAppStore();
  const {
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
  } = analysis;

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
      <div style={{ height: '350px', width: '100%', background: '#ffffff', borderRadius: '8px' }}>
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
      return `${entry.value[0].toFixed(1)}～${entry.value[1].toFixed(1)}${unit}`;
    }
    if (typeof entry.value !== 'number') return '--';
    const isIntegerLike = entry.name.includes('日照') || entry.name.includes('日射') || entry.name.includes('積算');
    if (entry.name.includes('降水')) return `${entry.value.toFixed(1)}${unit}`;
    return `${isIntegerLike ? Math.round(entry.value) : entry.value.toFixed(1)}${unit}`;
  };

  const renderValueBox = (chartId: string) => {
    const boxStyle: React.CSSProperties = {
      marginTop: '0.5rem',
      marginBottom: '0.5rem',
      borderRadius: '8px',
      padding: '0.6rem 0.75rem',
      fontSize: '0.92rem',
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
        <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700 }}>
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
              seriesByTarget: sunshineData.seriesByTarget,
              threshold: 10,
              formatDelta: (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d) * 10) / 10}h`,
              showDays: true,
            }
            : null;

          const refId = accumDiffConfig && committedTargets.length > 1 ? committedTargets[1]?.id : null;
          const refKey = refId && accumDiffConfig ? `${accumDiffConfig.refKeyPrefix}${refId}` : null;
          // regular キーで値が取れない場合（予報日付）は forecast キーにフォールバック
          const refForecastPrefixMap: Record<string, string> = {
            'accum_':           'forecast_accum_gdd_',
            'accumRadiation_':  'forecast_accum_radiation_',
            'accumPrecip_':     'forecast_accum_precip_',
            'accumSunshine_':   'forecast_accum_sunshine_',
          };
          const refForecastKey = accumDiffConfig && refId
            ? `${refForecastPrefixMap[accumDiffConfig.refKeyPrefix] ?? ''}${refId}`
            : null;
          const v0 = refKey
            ? (hover.payload.find((p: any) => p.dataKey === refKey)?.value
               ?? (refForecastKey ? hover.payload.find((p: any) => p.dataKey === refForecastKey)?.value : undefined))
            : undefined;
          const hoverDoy = accumDiffConfig && !isMonthly ? mmddToDoy(hover.label) : null;

          const computeAccumDiff = (p: any): string | null => {
            if (!accumDiffConfig || !refId || typeof v0 !== 'number') return null;
            const t0id = committedTargets[0]?.id;
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

            // Δ日逆引き: targets[1]（比較年）の系列で「targets[0] の現在値に達した日」を検索
            // → targets[0] の series は予報末端で尽きるため「未到達」になりにくい
            const series = accumDiffConfig.seriesByTarget?.get(refId);
            if (!series) return `(${deltaStr})`;

            const crossDate = findDateByAccum(series, p.value);
            if (!crossDate) return `(${deltaStr})`;

            const crossDoy = mmddToDoy(crossDate);
            if (crossDoy == null) return `(${deltaStr})`;

            // crossDoy = 比較年が「targets[0] の現在値」に達した日
            // crossDoy < hoverDoy → 比較年の方が早く達した → targets[0] は遅い
            const deltaDays = crossDoy - hoverDoy;
            const daysStr =
              deltaDays === 0 ? '同日'
              : deltaDays > 0 ? `${deltaDays}日早い`
              : `${-deltaDays}日遅い`;
            return `(${deltaStr} / ${daysStr})`;
          };

          // 予想域でhistorical系列が先にペイロードに現れることで順序が逆転するため
          // targets の定義順（index 0 が上段）にグループを並べ直す
          const expectedColorOrder = committedTargets.map((_, i) => getYearColor(i, ''));
          const sortedGroupEntries = Array.from(groups.entries()).sort(([ca], [cb]) => {
            const ia = expectedColorOrder.indexOf(ca);
            const ib = expectedColorOrder.indexOf(cb);
            return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
          });

          // forecast_ dataKey に対して実績表示と一致するメトリック名を返す
          const metricShortLabel: Record<string, string> = {
            '日別積算': '日別', '日別日射': '日別', '日別日照': '日別', '日別降水': '日別',
            '累積積算': '累積', '累積日射': '累積', '累積日照': '累積', '累積降水': '累積',
            '月合計積算': '月合計', '月合計日射': '月合計', '月合計日照': '月合計', '月合計降水': '月合計',
          };

          const getForecastMetric = (dataKey: string, rawMetric: string): string => {
            if (dataKey.startsWith('forecast_tempRange_'))  return '気温(最低-最高)';
            if (dataKey.startsWith('forecast_humidRange_')) return '湿度(最低-最高)';
            if (dataKey.startsWith('forecast_vpdRange_'))   return '飽差(最低-最高)';
            // 累積系: 先頭の「予想」を除去して「累積積算」「累積降水」等に統一
            return rawMetric.replace(/^予想/, '');
          };

          return sortedGroupEntries.map(([color, groupItems], gi) => (
            <div key={gi} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem', marginTop: gi > 0 ? '0.2rem' : 0 }}>
              {groupItems.map((p: any, i: number) => {
                const isForecastItem = typeof p.dataKey === 'string' && p.dataKey.startsWith('forecast_');
                const rawMetric = p.name.split(' ').slice(2).join(' ') || p.name;
                const resolvedMetric = isForecastItem ? getForecastMetric(p.dataKey, rawMetric) : rawMetric;
                const metric = metricShortLabel[resolvedMetric] ?? resolvedMetric;
                const diffNote = computeAccumDiff(p);
                // 予報累積系（積算温度・日射量・日照時間）の日別値を取得
                let forecastDailyNote: { label: string; value: string } | null = null;
                const t0Id = committedTargets[0]?.id;
                const t1Id = committedTargets[1]?.id;
                const activeDailyMap = (t0Id && p.dataKey.endsWith(`_${t0Id}`))
                  ? forecastDailyMap
                  : (t1Id && p.dataKey.endsWith(`_${t1Id}`))
                  ? forecastDailyMap2
                  : null;
                if (isForecastItem && activeDailyMap) {
                  const daily = activeDailyMap.values.get(hover.label);
                  if (daily) {
                    if (p.dataKey.startsWith('forecast_accum_gdd_')) {
                      forecastDailyNote = { label: '日別', value: `${Math.round(daily.gdd)}℃` };
                    } else if (p.dataKey.startsWith('forecast_accum_radiation_')) {
                      forecastDailyNote = { label: '日別', value: `${Math.round(daily.radiation)} MJ/m²` };
                    } else if (p.dataKey.startsWith('forecast_accum_sunshine_')) {
                      forecastDailyNote = { label: '日別', value: `${Math.round(daily.sunshine)}h` };
                    } else if (p.dataKey.startsWith('forecast_accum_precip_')) {
                      forecastDailyNote = { label: '日別', value: `${daily.precip.toFixed(1)}mm` };
                    }
                  }
                }
                return (
                  <React.Fragment key={i}>
                    {forecastDailyNote && (
                      <span style={{ color, whiteSpace: 'nowrap', fontSize: '0.92rem' }}>
                        {forecastDailyNote.label} <strong>{forecastDailyNote.value}</strong>
                      </span>
                    )}
                    <span style={{ color, whiteSpace: 'nowrap', fontSize: '0.92rem' }}>
                      {metric} <strong>{formatHoverEntry(p)}</strong>
                      {isForecastItem && (
                        <span style={{ marginLeft: '0.25rem', opacity: 0.7, fontSize: '0.80rem', color: 'var(--text-secondary)' }}>
                          ※予報値
                        </span>
                      )}
                      {diffNote && (
                        <span style={{ marginLeft: '0.25rem', opacity: 0.85, fontSize: '0.84rem' }}>
                          {diffNote}
                        </span>
                      )}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          ));
        })()}
      </div>
    );
  };


  const sectionStyle = {
    padding: isMobile ? '0.75rem 1rem' : '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    background: 'rgba(255, 255, 255, 0.97)',
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
          {committedTargets.map((target, index) => (
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

  return (
      <>
      <SkyBand title="空くらべ" />
      <div className="sky-overlap">
      <div className="app-container" style={isMobile ? { gap: '0.25rem' } : undefined}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>表示対象</span>
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
                  <option value="__geo__">📍 現在地</option>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              {targets.length < 2 ? (
                <button
                  onClick={addTarget}
                  className="secondary"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
                >
                  <Plus size={15} /> 比較対象を追加
                </button>
              ) : (
                <div />
              )}
              <button
                disabled={isCommitting}
                onClick={async () => {
                  const needsGeo = targets.some(t => t.locationId === '__geo__');
                  if (needsGeo && !geoLocation) {
                    setIsCommitting(true);
                    try {
                      await new Promise<void>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(
                          pos => {
                            const lat = parseFloat(pos.coords.latitude.toFixed(6));
                            const lon = parseFloat(pos.coords.longitude.toFixed(6));
                            setGeoLocation({ id: '__geo__', name: '現在地', lat, lon });
                            resolve();
                          },
                          reject,
                          GEO_OPTIONS,
                        );
                      });
                    } catch {
                      // GPS 失敗時もそのまま commit（useWeatherData でエラー表示）
                    }
                    setIsCommitting(false);
                  }
                  setCommittedTargets([...targets]);
                }}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--accent-color) 0%, #0f766e 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: isCommitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
                  opacity: isCommitting ? 0.7 : 1,
                }}
              >
                {isCommitting
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> 取得中…</>
                  : <><BarChart2 size={16} /> 表示</>}
              </button>
            </div>
          </div>
        </div>

      <main ref={analysisChartsRef} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* 表示単位と日次グラフの操作案内 */}
        <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
          {!isMonthly && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                ドラッグで移動・Ctrl/⌘＋ホイールで拡大縮小
              </span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => zoomDailyViewport(1.25)}
                  title="縮小"
                  aria-label="グラフを縮小"
                  style={{ padding: '0.35rem', boxShadow: 'none' }}
                >
                  <Minus size={15} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => zoomDailyViewport(0.8)}
                  title="拡大"
                  aria-label="グラフを拡大"
                  style={{ padding: '0.35rem', boxShadow: 'none' }}
                >
                  <Plus size={15} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDailyViewport({ start: 0, end: chartData.length })}
                  title="全体表示"
                  aria-label="グラフを全体表示"
                  style={{ padding: '0.35rem', boxShadow: 'none' }}
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>
          )}
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
            ⚠️ {error}
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
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.temp} cursor={tooltipInteractionEnabled ? { stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 } : false} isAnimationActive={false} />
                    {committedTargets.map((target, index) => {
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
                          {(index === 0 ? currentTargetHasForecast : compareTargetHasForecast) && (
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
                ...(currentTargetHasForecast ? [{ label: '予報値', type: 'dashed-range-bar' as const }] : []),
              ])}
              {renderValueBox('temp')}
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
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.precip} cursor={tooltipInteractionEnabled ? { stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 } : false} isAnimationActive={false} />

                    {committedTargets.map((target, index) => {
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
                    {!isMonthly && committedTargets.map((target, index) => {
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
                    {committedTargets.map((target, index) => {
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
                      const t0 = committedTargets[0]!;
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
                    {compareTargetHasForecast && (() => {
                      const t1 = committedTargets[1]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_precip_${t1.id}`}
                          name={`${getLocationName(t1.locationId)} ${t1.year}年 予想累積降水`}
                          stroke={getYearColor(1, 'var(--chart-precip)')}
                          strokeWidth={2}
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
                ...(currentTargetHasForecast ? [{ label: '予報値', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('precip')}
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
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.sunshine} cursor={tooltipInteractionEnabled ? { stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 } : false} isAnimationActive={false} />

                    {committedTargets.map((target, index) => {
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
                    {committedTargets.map((target, index) => {
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
                      const t0 = committedTargets[0]!;
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
                    {compareTargetHasForecast && (() => {
                      const t1 = committedTargets[1]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_sunshine_${t1.id}`}
                          name={`${getLocationName(t1.locationId)} ${t1.year}年 予想累積日照`}
                          stroke={getYearColor(1, 'var(--chart-sunshine)')}
                          strokeWidth={2}
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
                ...(currentTargetHasForecast ? [{ label: '予報値', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('sunshine')}
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
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.radiation} cursor={tooltipInteractionEnabled ? { stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 } : false} isAnimationActive={false} />

                    {committedTargets.map((target, index) => {
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
                    {committedTargets.map((target, index) => {
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
                      const t0 = committedTargets[0]!;
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
                    {compareTargetHasForecast && (() => {
                      const t1 = committedTargets[1]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_radiation_${t1.id}`}
                          name={`${getLocationName(t1.locationId)} ${t1.year}年 予想累積日射`}
                          stroke={getYearColor(1, 'var(--chart-sunshine)')}
                          strokeWidth={2}
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
                ...(currentTargetHasForecast ? [{ label: '予報値', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('radiation')}
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
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.gdd} cursor={tooltipInteractionEnabled ? { stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 } : false} isAnimationActive={false} />

                    {committedTargets.map((target, index) => {
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
                    {committedTargets.map((target, index) => {
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
                      const t0 = committedTargets[0]!;
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
                    {compareTargetHasForecast && (() => {
                      const t1 = committedTargets[1]!;
                      return (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={`forecast_accum_gdd_${t1.id}`}
                          name={`${getLocationName(t1.locationId)} ${t1.year}年 予想累積積算`}
                          stroke={getYearColor(1, 'var(--chart-sunshine)')}
                          strokeWidth={2}
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
                ...(currentTargetHasForecast ? [{ label: '予報値', type: 'dashed' as const }] : []),
              ])}
              {renderValueBox('gdd')}
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
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.humid} cursor={tooltipInteractionEnabled ? { stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 } : false} isAnimationActive={false} />
                    {committedTargets.map((target, index) => {
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
                          {(index === 0 ? currentTargetHasForecast : compareTargetHasForecast) && (
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
                ...(currentTargetHasForecast ? [{ label: '予報値', type: 'dashed-range-bar' as const }] : []),
              ])}
              {renderValueBox('humid')}
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
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.vpd} cursor={tooltipInteractionEnabled ? { stroke: 'var(--text-secondary)', strokeWidth: 1, strokeOpacity: 0.35 } : false} isAnimationActive={false} />
{committedTargets.map((target, index) => {
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
                          {(index === 0 ? currentTargetHasForecast : compareTargetHasForecast) && (
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
                ...(currentTargetHasForecast ? [{ label: '予報値', type: 'dashed-range-bar' as const }] : []),
              ])}
              {renderValueBox('vpd')}
            </>
          )}
        </section>
        )}

        {/* 日別データスプレッドシート */}
        {Object.keys(weatherData).length > 0 && (
          <section className="glass-panel" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid rgba(13, 148, 136, 0.3)', boxShadow: '0 4px 20px rgba(13, 148, 136, 0.12), 0 2px 8px rgba(0,0,0,0.07)' }}>
            <DailyRawTable
              targets={committedTargets}
              weatherData={weatherData}
              getLocationName={getLocationName}
              accumStartDates={userSettings?.accumStartDates ?? { precip: '01-01', sunshine: '01-01', radiation: '01-01', gdd: '01-01' }}
              baseTempSettings={userSettings?.baseTempSettings ?? [10, 3.5]}
            />
          </section>
        )}

      <Footer />
      </main>

    </div>
      </div>
      </>
  );
}
