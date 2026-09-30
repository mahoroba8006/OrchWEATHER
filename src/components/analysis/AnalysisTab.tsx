import React, { useEffect } from 'react';
import { m } from 'motion/react';
import { CloudRain, Thermometer, Droplets, DropletOff, Leaf, Sun, Plus, Minus, Maximize2, X, Clock, Loader2, BarChart2 } from 'lucide-react';
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, LabelList } from 'recharts';
import { useAppStore } from '../../store';
import { DailyRawTable } from '../DailyRawTable';
import { Footer } from '../Footer';
import { SkyBand } from '../sky/SkyBand';
import { GEO_OPTIONS } from '../../lib/geo';
import { springs } from '../../lib/motion';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { CustomWideBar, CustomRangeBar, ForecastRangeBar } from './chartShapes';
import type { ChartId, useAnalysisState } from './useAnalysisState';
import './analysis.css';

const CHART_TABS: { id: ChartId; label: string }[] = [
  { id: 'temp',      label: '気温' },
  { id: 'precip',    label: '降水量' },
  { id: 'gdd',       label: '積算温度' },
  { id: 'radiation', label: '日射量' },
  { id: 'sunshine',  label: '日照時間' },
  { id: 'humid',     label: '湿度' },
  { id: 'vpd',       label: '飽差' },
];

// チャート共通の見た目（軸線なし・淡い横グリッド・等幅数字の小さな目盛り）
const TICK_STYLE = { fontVariantNumeric: 'tabular-nums' } as const;
const GRID_PROPS = { vertical: false, stroke: 'var(--grid-color)' } as const;
const X_AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
  tick: { fontSize: 11, fill: 'var(--ink-3)', style: TICK_STYLE },
} as const;
const CROSSHAIR = { stroke: 'var(--ink-2)', strokeWidth: 1, strokeOpacity: 0.35 } as const;
const unitLabel = (value: string) => ({ value, position: 'top' as const, offset: 10, fill: 'var(--ink-3)', fontSize: 11 });

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

  // Y軸は共通propsに文字色・等幅数字だけ上書き（軸の幅・mirror 等はそのまま）
  const yTick = { fontSize: 11, fill: 'var(--ink-3)', style: TICK_STYLE };
  const yAxisLeft = { ...yAxisCommon, tick: yTick };
  const yAxisRight = { ...yAxisCommonRight, tick: yTick };

  // 選択中のグラフ種別タブが横スクロールの外なら見える位置へ（ページの縦スクロールは動かさない）
  useEffect(() => {
    const tab = document.getElementById(`analysis-chart-tab-${activeChart}`);
    const scroller = tab?.closest<HTMLElement>('.analysis-tab-scroller');
    if (!tab || !scroller) return;
    const tabLeft = tab.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    const tabRight = tabLeft + tab.offsetWidth;
    if (tabLeft < scroller.scrollLeft) scroller.scrollLeft = tabLeft;
    else if (tabRight > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = tabRight - scroller.clientWidth;
  }, [activeChart]);

  const chartLoading = (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '350px', gap: '0.9rem' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink-2)', letterSpacing: '0.02em' }}>
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
      <div className="analysis-chart-frame">
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
    if (hover?.chartId !== chartId) {
      return (
        <div className="analysis-value analysis-value--empty">
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
      <div className="analysis-value analysis-value--filled">
        <div className="analysis-value__label">
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
            <div key={gi} className="analysis-value__row">
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
                      <span className="analysis-value__item">
                        <span className="analysis-value__dot" style={{ background: color }} />
                        <span>{forecastDailyNote.label} <strong>{forecastDailyNote.value}</strong></span>
                      </span>
                    )}
                    <span className="analysis-value__item">
                      <span className="analysis-value__dot" style={{ background: color }} />
                      <span>
                        {metric}{' '}
                        <strong>
                          <m.span
                            key={formatHoverEntry(p)}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={springs.press}
                            style={{ display: 'inline-block' }}
                          >
                            {formatHoverEntry(p)}
                          </m.span>
                        </strong>
                        {isForecastItem && <span className="analysis-value__note"> ※予報値</span>}
                        {diffNote && <span className="analysis-value__note"> {diffNote}</span>}
                      </span>
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


  // 累積開始日が非デフォルト（01-01）のときだけ、タイトル横に「4/20〜」バッジを表示
  const renderAccumBadge = (chart: 'precip' | 'sunshine' | 'radiation' | 'gdd') => {
    const mmdd = userSettings?.accumStartDates?.[chart];
    if (!mmdd || mmdd === '01-01') return null;
    const [m, d] = mmdd.split('-').map(Number);
    return (
      <span className="analysis-badge">
        累積: {m}/{d}〜
      </span>
    );
  };

  const renderCustomLegend = (types: { label: string, type: 'dashed' | 'solid' | 'thin-bar' | 'thick-bar' | 'range-bar' | 'dashed-range-bar' }[]) => {
    const mark = 'var(--ink-2)';
    return (
      <div className="analysis-legend">
        <div className="analysis-legend__group">
          {committedTargets.map((target, index) => (
            <div key={target.id} className="analysis-legend__item">
              <span className="analysis-legend__dot" style={{ backgroundColor: getYearColor(index, '') }}></span>
              <span>{getLocationName(target.locationId)} {target.year}年</span>
            </div>
          ))}
        </div>
        <div className="analysis-legend__group" style={{ marginLeft: 'auto' }}>
          {types.map((t, i) => (
            <div key={i} className="analysis-legend__item">
              {t.type === 'dashed' && <span style={{ display: 'inline-block', width: '20px', borderBottom: `1.5px dashed ${mark}` }}></span>}
              {t.type === 'solid' && <span style={{ display: 'inline-block', width: '20px', borderBottom: `2px solid ${mark}` }}></span>}
              {t.type === 'thin-bar' && <span style={{ display: 'inline-block', width: '6px', height: '12px', backgroundColor: mark, opacity: 0.55, borderRadius: '2px' }}></span>}
              {t.type === 'thick-bar' && <span style={{ display: 'inline-block', width: '16px', height: '12px', backgroundColor: mark, opacity: 0.3, borderRadius: '2px' }}></span>}
              {t.type === 'range-bar' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '14px', width: '12px', position: 'relative', opacity: 0.38 }}>
                  <span style={{ position: 'absolute', top: '0', bottom: '0', left: '50%', width: '1.5px', marginLeft: '-0.75px', backgroundColor: mark }}></span>
                  <span style={{ position: 'absolute', top: '0', left: '25%', right: '25%', height: '1.5px', backgroundColor: mark }}></span>
                  <span style={{ position: 'absolute', bottom: '0', left: '25%', right: '25%', height: '1.5px', backgroundColor: mark }}></span>
                </span>
              )}
              {t.type === 'dashed-range-bar' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '12px', height: '14px', opacity: 0.48 }}>
                  <svg width="12" height="14">
                    <line x1="6" y1="1" x2="6" y2="13" stroke={mark} strokeWidth="1.5" strokeDasharray="4 3" />
                    <line x1="3" y1="1" x2="9" y2="1" stroke={mark} strokeWidth="1.5" />
                    <line x1="3" y1="13" x2="9" y2="13" stroke={mark} strokeWidth="1.5" />
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
      <div className="app-container analysis-page" style={{ gap: isMobile ? '12px' : '16px' }}>
        <div className="analysis-card analysis-card--controls">
          <h2 className="analysis-card__heading">表示対象</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {targets.map((target, index) => (
              <div key={target.id} className="analysis-target">
                <div className="analysis-target__bar" style={{ backgroundColor: getYearColor(index, 'var(--accent)') }}></div>
                {index > 0 && (
                  <span className="analysis-target__badge" title="1件目との差が表示されます">
                    比較
                  </span>
                )}
                <select
                  value={target.locationId}
                  onChange={(e) => updateTarget(target.id, 'locationId', e.target.value)}
                  style={{ flex: 2 }}
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
                  style={{ flex: 1 }}
                >
                  {[...Array(new Date().getFullYear() - 2000 + 1)].map((_, i) => {
                    const y = new Date().getFullYear() - i;
                    return <option key={y} value={y}>{y}年</option>;
                  })}
                </select>
                {targets.length > 1 && (
                  <Button
                    variant="ghost"
                    className="analysis-icon-btn"
                    onClick={() => removeTarget(target.id)}
                    title="この行を削除"
                    aria-label="この行を削除"
                  >
                    <X size={18} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {targets.length < 2 ? (
              <Button variant="ghost" className="analysis-btn-sm" onClick={addTarget}>
                <Plus size={15} /> 比較対象を追加
              </Button>
            ) : (
              <div />
            )}
            <Button
              variant="primary"
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
            >
              {isCommitting
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> 取得中…</>
                : <><BarChart2 size={16} /> 表示</>}
            </Button>
          </div>
        </div>

      <main ref={analysisChartsRef} className="analysis-stack">

        {/* 表示単位と日次グラフの操作案内 */}
        <div className="analysis-card analysis-card--bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="analysis-card__heading">表示単位</span>
            <SegmentedControl
              variant="pill"
              className="ui-seg--compact"
              layoutId="analysis-unit"
              ariaLabel="表示単位"
              options={[{ value: 'daily', label: '日次' }, { value: 'monthly', label: '月次' }] as const}
              value={chartViewMode}
              onChange={setChartViewMode}
            />
          </div>
          {!isMonthly && (
          <>
              <span className="analysis-hint">
                ドラッグで移動・Ctrl/⌘＋ホイールで拡大縮小
              </span>
              <div className="analysis-zoom">
                <Button
                  variant="ghost"
                  className="analysis-icon-btn"
                  onClick={() => zoomDailyViewport(1.25)}
                  title="縮小"
                  aria-label="グラフを縮小"
                >
                  <Minus size={15} />
                </Button>
                <Button
                  variant="ghost"
                  className="analysis-icon-btn"
                  onClick={() => zoomDailyViewport(0.8)}
                  title="拡大"
                  aria-label="グラフを拡大"
                >
                  <Plus size={15} />
                </Button>
                <Button
                  variant="ghost"
                  className="analysis-icon-btn"
                  onClick={() => setDailyViewport({ start: 0, end: chartData.length })}
                  title="全体表示"
                  aria-label="グラフを全体表示"
                >
                  <Maximize2 size={15} />
                </Button>
              </div>
          </>
          )}
        </div>

        {/* チャート選択タブ */}
        <div className="analysis-card analysis-card--tabs">
          <div className="ai-tab-bar analysis-tab-scroller">
            <SegmentedControl
              variant="underline"
              className="ai-seg"
              layoutId="analysis-chart"
              ariaLabel="グラフの種類"
              idPrefix="analysis-chart-tab"
              options={CHART_TABS.map(tab => ({ value: tab.id, label: tab.label }))}
              value={activeChart}
              onChange={setActiveChart}
            />
          </div>
        </div>

        {error && (
          <div className="analysis-error">
            ⚠️ {error}
          </div>
        )}

        {/* 1. 気温 (Temperature) */}
        {activeChart === 'temp' && (
        <section className="analysis-card analysis-card--chart" role="tabpanel" aria-labelledby={`analysis-chart-tab-${activeChart}`}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="analysis-chart-title"><Thermometer size={18} style={{ color: 'var(--chart-temp)' }} /> 気温</h2>
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('temp', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="dateStr" {...X_AXIS_PROPS} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis {...yAxisLeft} domain={['auto', 'auto']} label={unitLabel('(℃)')} />
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.temp} cursor={tooltipInteractionEnabled ? CROSSHAIR : false} isAnimationActive={false} />
                    {committedTargets.map((target, index) => {
                      const color = getYearColor(index, 'var(--chart-temp)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`t_${target.id}_tempRange`} name={`${getLocationName(target.locationId)} ${target.year}年 気温(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`t_${target.id}_monthlyMeanTemp`} name={`${getLocationName(target.locationId)} ${target.year}年 月平均気温`} stroke={color} strokeWidth={2} dot={false} connectNulls={true} isAnimationActive={false}>
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
        <section className="analysis-card analysis-card--chart" role="tabpanel" aria-labelledby={`analysis-chart-tab-${activeChart}`}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="analysis-chart-title"><CloudRain size={18} style={{ color: 'var(--chart-precip)' }} /> 降水量</h2>
            {renderAccumBadge('precip')}
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('precip', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="dateStr" {...X_AXIS_PROPS} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisLeft} label={unitLabel('(mm)')} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisRight} label={unitLabel('(mm)')} />
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.precip} cursor={tooltipInteractionEnabled ? CROSSHAIR : false} isAnimationActive={false} />

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
                          strokeWidth={index === 0 ? 2 : 1.5}
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
                          strokeWidth={2}
                          strokeDasharray="4 3"
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
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
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
        <section className="analysis-card analysis-card--chart" role="tabpanel" aria-labelledby={`analysis-chart-tab-${activeChart}`}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="analysis-chart-title"><Clock size={18} style={{ color: 'var(--chart-sunshine)' }} /> 日照時間</h2>
            {renderAccumBadge('sunshine')}
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('sunshine', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="dateStr" {...X_AXIS_PROPS} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisLeft} label={unitLabel(isMonthly ? '(h/月)' : '(h/日)')} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisRight} label={unitLabel('(h)')} />
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.sunshine} cursor={tooltipInteractionEnabled ? CROSSHAIR : false} isAnimationActive={false} />

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
                          strokeWidth={index === 0 ? 2 : 1.5}
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
                          strokeWidth={2}
                          strokeDasharray="4 3"
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
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
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
        <section className="analysis-card analysis-card--chart" role="tabpanel" aria-labelledby={`analysis-chart-tab-${activeChart}`}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="analysis-chart-title"><Sun size={18} style={{ color: 'var(--chart-sunshine)' }} /> 日射量</h2>
            {renderAccumBadge('radiation')}
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('radiation', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="dateStr" {...X_AXIS_PROPS} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisLeft} label={unitLabel('(MJ/m²)')} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisRight} label={unitLabel('(MJ/m²)')} />
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.radiation} cursor={tooltipInteractionEnabled ? CROSSHAIR : false} isAnimationActive={false} />

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
                          strokeWidth={index === 0 ? 2 : 1.5}
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
                          strokeWidth={2}
                          strokeDasharray="4 3"
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
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
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
        <section className="analysis-card analysis-card--chart" role="tabpanel" aria-labelledby={`analysis-chart-tab-${activeChart}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem', flex: '1 1 auto' }}>
              <h2 className="analysis-chart-title"><Leaf size={18} style={{ color: 'var(--chart-accum)' }} /> 有効積算温度</h2>
              {renderAccumBadge('gdd')}
            </div>
            <SegmentedControl
              variant="pill"
              className="ui-seg--compact"
              layoutId="analysis-basetemp"
              ariaLabel="基準温度"
              options={(userSettings?.baseTempSettings ?? [10, 3.5]).map((temp, i) => ({ value: String(i), label: `基準温度 ${temp}℃` }))}
              value={String(selectedBaseTempIndex)}
              onChange={v => setSelectedBaseTempIndex(Number(v) as 0 | 1)}
            />
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('gdd', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleGddChartData} margin={chartMargin}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="dateStr" {...X_AXIS_PROPS} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis yAxisId="left" {...yAxisLeft} label={unitLabel(isMonthly ? '(℃/月)' : '(℃/日)')} />
                    <YAxis yAxisId="right" orientation="right" {...yAxisRight} label={unitLabel('(℃)')} />
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.gdd} cursor={tooltipInteractionEnabled ? CROSSHAIR : false} isAnimationActive={false} />

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
                          strokeWidth={index === 0 ? 2 : 1.5}
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
                          strokeWidth={2}
                          strokeDasharray="4 3"
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
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
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
        <section className="analysis-card analysis-card--chart" role="tabpanel" aria-labelledby={`analysis-chart-tab-${activeChart}`}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="analysis-chart-title"><Droplets size={18} style={{ color: 'var(--chart-humid)' }} /> 湿度</h2>
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('humid', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="dateStr" {...X_AXIS_PROPS} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis {...yAxisLeft} domain={['auto', 'auto']} label={unitLabel('(%)')} />
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.humid} cursor={tooltipInteractionEnabled ? CROSSHAIR : false} isAnimationActive={false} />
                    {committedTargets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-humid)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`humidRange_${target.id}`} name={`${name} 湿度(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`monthlyHumid_${target.id}`} name={`${name} 月平均湿度`} stroke={color} strokeWidth={2} dot={false} connectNulls={true} isAnimationActive={false}>
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
        <section className="analysis-card analysis-card--chart" role="tabpanel" aria-labelledby={`analysis-chart-tab-${activeChart}`}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.25rem' }}>
            <h2 className="analysis-chart-title"><DropletOff size={18} style={{ color: 'var(--chart-humid)' }} /> 飽差</h2>
          </div>
          {loading ? (
            chartLoading
          ) : (
            <>
              {chartFrame('vpd', (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={visibleChartData} margin={chartMargin}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="dateStr" {...X_AXIS_PROPS} tickFormatter={xTickFormatter} ticks={xTicks} />
                    <YAxis {...yAxisLeft} domain={['auto', 'auto']} label={unitLabel('(g/m³)')} />
                    <Tooltip active={tooltipInteractionEnabled ? undefined : false} content={tooltipContents.vpd} cursor={tooltipInteractionEnabled ? CROSSHAIR : false} isAnimationActive={false} />
{committedTargets.map((target, index) => {
                      const name = `${getLocationName(target.locationId)} ${target.year}年`;
                      const color = getYearColor(index, 'var(--chart-humid)');
                      return (
                        <React.Fragment key={target.id}>
                          <Bar dataKey={`vpdRange_${target.id}`} name={`${name} 飽差(最低-最高)`} fill={color} fillOpacity={isMonthly ? 0.3 : 1} shape={isMonthly ? undefined : <CustomRangeBar />} isAnimationActive={false} />
                          <Line type="monotone" dataKey={`monthlyMeanVpdMax_${target.id}`} name={`${name} 月平均最高飽差`} stroke={color} strokeWidth={2} dot={false} connectNulls={true} isAnimationActive={false}>
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
          <section className="analysis-card">
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
