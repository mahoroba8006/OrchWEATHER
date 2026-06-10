import React from 'react';
import { Download } from 'lucide-react';
import type { CompareTarget } from '../hooks/useWeather';
import type { WeatherData } from '../api/weather';

interface DailyRawTableProps {
  targets: CompareTarget[];
  weatherData: Record<string, WeatherData>;
  getYearColor: (index: number, baseColor: string) => string;
  getLocationName: (id: string) => string;
  accumStartDates: { precip: string; sunshine: string; radiation: string; gdd: string };
  baseTempSettings: [number, number];
}

interface AccumRow {
  accumPrecip:    number | null;
  accumRadiation: number | null;
  accumSunshine:  number | null;
  dailyGdd1:  number | null;
  accumGdd1:  number | null;
  dailyGdd2:  number | null;
  accumGdd2:  number | null;
}

function calcVPD(tempC: number, humidPct: number): number {
  const e_s_hPa = 6.1078 * Math.pow(10, 7.5 * tempC / (tempC + 237.3));
  const a_max = 216.67 * e_s_hPa / (tempC + 273.15);
  return a_max * (1 - humidPct / 100);
}

interface DayRow {
  tempMax: number;
  tempMin: number;
  tempMean: number;
  precipSum: number;
  radiation: number;
  sunshineDuration: number;
  humidMax: number;
  humidMin: number;
  vpdMax: number;
  vpdMin: number;
}

const METRICS: { label: string; key: keyof DayRow; fixed: number }[] = [
  { label: '最高気温(℃)',   key: 'tempMax',          fixed: 1 },
  { label: '最低気温(℃)',   key: 'tempMin',          fixed: 1 },
  { label: '平均気温(℃)',   key: 'tempMean',         fixed: 1 },
  { label: '降水量(mm)',     key: 'precipSum',        fixed: 1 },
  { label: '日射量(MJ/m²)', key: 'radiation',        fixed: 2 },
  { label: '日照時間(h)',    key: 'sunshineDuration', fixed: 1 },
  { label: '最高湿度(%)',    key: 'humidMax',         fixed: 1 },
  { label: '最低湿度(%)',    key: 'humidMin',         fixed: 1 },
  { label: '最高飽差(g/m³)', key: 'vpdMax',          fixed: 2 },
  { label: '最低飽差(g/m³)', key: 'vpdMin',          fixed: 2 },
];

export function DailyRawTable({ targets, weatherData, getYearColor, getLocationName, accumStartDates, baseTempSettings }: DailyRawTableProps) {
  // すべてのターゲットの MM-DD を収集してソート
  const allDates = React.useMemo(() => {
    const dateSet = new Set<string>();
    targets.forEach(t => {
      const wd = weatherData[t.id];
      if (!wd) return;
      wd.daily.forEach(d => dateSet.add(d.date.substring(5)));
    });
    return Array.from(dateSet).sort();
  }, [targets, weatherData]);

  // ターゲットごとの MM-DD → DayRow マップ
  const rowMaps = React.useMemo(() => {
    return targets.map(t => {
      const map = new Map<string, DayRow>();
      const wd = weatherData[t.id];
      if (!wd) return map;
      wd.daily.forEach(d => {
        const mmdd = d.date.substring(5);
        map.set(mmdd, {
          tempMax: d.tempMax,
          tempMin: d.tempMin,
          tempMean: d.tempMean,
          precipSum: d.precipSum,
          radiation: d.radiation,
          sunshineDuration: d.sunshineDuration,
          humidMax: d.humidMax,
          humidMin: d.humidMin,
          vpdMax: calcVPD(d.tempMax, d.humidMin),  // 最高気温+最低湿度 → 最高飽差
          vpdMin: calcVPD(d.tempMin, d.humidMax),  // 最低気温+最高湿度 → 最低飽差
        });
      });
      return map;
    });
  }, [targets, weatherData]);

  // ターゲットごとの累積値マップ（CSV専用）
  const accumMaps = React.useMemo(() => {
    const [b1, b2] = baseTempSettings;
    return targets.map(t => {
      const map = new Map<string, AccumRow>();
      const wd = weatherData[t.id];
      if (!wd) return map;
      let runPrecip = 0, runRadiation = 0, runSunshine = 0;
      let runGdd1 = 0, runGdd2 = 0;
      wd.daily.forEach(d => {
        const mmdd = d.date.substring(5);
        const inPrecip    = mmdd >= accumStartDates.precip;
        const inRadiation = mmdd >= accumStartDates.radiation;
        const inSunshine  = mmdd >= accumStartDates.sunshine;
        const inGdd       = mmdd >= accumStartDates.gdd;
        if (inPrecip)    runPrecip    += d.precipSum;
        if (inRadiation) runRadiation += d.radiation;
        if (inSunshine)  runSunshine  += d.sunshineDuration;
        const daily1 = Math.max(0, d.tempMean - b1);
        const daily2 = Math.max(0, d.tempMean - b2);
        if (inGdd) { runGdd1 += daily1; runGdd2 += daily2; }
        map.set(mmdd, {
          accumPrecip:    inPrecip    ? runPrecip    : null,
          accumRadiation: inRadiation ? runRadiation : null,
          accumSunshine:  inSunshine  ? runSunshine  : null,
          dailyGdd1: inGdd ? daily1   : null,
          accumGdd1: inGdd ? runGdd1  : null,
          dailyGdd2: inGdd ? daily2   : null,
          accumGdd2: inGdd ? runGdd2  : null,
        });
      });
      return map;
    });
  }, [targets, weatherData, accumStartDates, baseTempSettings]);

  const isTwoTargets = targets.length >= 2;

  // ターゲットごとのラベル（地点名+年）
  const targetLabels = targets.map(t => `${getLocationName(t.locationId)}${t.year}年`);

  function formatDate(mmdd: string): string {
    return mmdd.replace('-', '/');
  }

  function formatValue(row: DayRow | undefined, metric: { key: keyof DayRow; fixed: number }): string {
    if (!row) return '-';
    const v = row[metric.key];
    if (v == null || isNaN(v)) return '-';
    return (v as number).toFixed(metric.fixed);
  }

  function handleDownload() {
    const firstTarget = targets[0];
    if (!firstTarget) return;

    const fileName = `weather_${getLocationName(firstTarget.locationId)}_${firstTarget.year}.csv`;
    const [b1, b2] = baseTempSettings;

    const ACCUM_COLS: { label: string; key: keyof AccumRow; fixed: number }[] = [
      { label: `累計降水量(mm)`,                    key: 'accumPrecip',    fixed: 1 },
      { label: `累計日射量(MJ/m²)`,                 key: 'accumRadiation', fixed: 2 },
      { label: `累計日照時間(h)`,                    key: 'accumSunshine',  fixed: 1 },
      { label: `有効積算温度_日別(基準${b1}℃)`,      key: 'dailyGdd1',      fixed: 1 },
      { label: `累計積算温度(基準${b1}℃)`,           key: 'accumGdd1',      fixed: 1 },
      { label: `有効積算温度_日別(基準${b2}℃)`,      key: 'dailyGdd2',      fixed: 1 },
      { label: `累計積算温度(基準${b2}℃)`,           key: 'accumGdd2',      fixed: 1 },
    ];

    function formatAccum(row: AccumRow | undefined, col: { key: keyof AccumRow; fixed: number }): string {
      if (!row) return '-';
      const v = row[col.key];
      if (v === null || v === undefined) return '-';
      return (v as number).toFixed(col.fixed);
    }

    // ヘッダー行
    let header: string;
    if (!isTwoTargets) {
      const labels = [
        ...METRICS.map(m => m.label),
        ...ACCUM_COLS.map(c => c.label),
      ];
      header = '日付,' + labels.join(',');
    } else {
      const cols: string[] = ['日付'];
      METRICS.forEach(m => {
        targetLabels.forEach(label => cols.push(`${m.label}_${label}`));
      });
      ACCUM_COLS.forEach(c => {
        targetLabels.forEach(label => cols.push(`${c.label}_${label}`));
      });
      header = cols.join(',');
    }

    const rows: string[] = [header];
    allDates.forEach(mmdd => {
      const cells: string[] = [formatDate(mmdd)];
      if (!isTwoTargets) {
        const row = rowMaps[0]?.get(mmdd);
        METRICS.forEach(m => cells.push(formatValue(row, m)));
        const arow = accumMaps[0]?.get(mmdd);
        ACCUM_COLS.forEach(c => cells.push(formatAccum(arow, c)));
      } else {
        METRICS.forEach(m => {
          rowMaps.forEach(map => cells.push(formatValue(map.get(mmdd), m)));
        });
        ACCUM_COLS.forEach(c => {
          accumMaps.forEach(map => cells.push(formatAccum(map.get(mmdd), c)));
        });
      }
      rows.push(cells.join(','));
    });

    const bom = '﻿';
    const csvContent = bom + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  if (allDates.length === 0) return null;

  return (
    <div>
      {/* タイトル行 + CSVボタン */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
          日別データ ({allDates.length}日)
        </span>
        <button
          className="secondary"
          onClick={handleDownload}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.8rem' }}
        >
          <Download size={14} />
          CSV ダウンロード
        </button>
      </div>

      {/* テーブル */}
      <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
        <table className="glass-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            {!isTwoTargets ? (
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>日付</th>
                {METRICS.map(m => (
                  <th key={m.key} style={{ position: 'sticky', top: 0, zIndex: 1 }}>{m.label}</th>
                ))}
              </tr>
            ) : (
              <>
                <tr>
                  <th rowSpan={2} style={{ position: 'sticky', top: 0, zIndex: 1 }}>日付</th>
                  {METRICS.map(m => (
                    <th key={m.key} colSpan={targets.length} style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      {m.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {METRICS.map(m =>
                    targets.map((t, i) => (
                      <th
                        key={`${m.key}-${t.id}`}
                        style={{
                          position: 'sticky',
                          top: '32px',
                          zIndex: 1,
                          color: getYearColor(i, 'var(--text-primary)'),
                          fontSize: '0.75rem',
                        }}
                      >
                        {getLocationName(t.locationId)}<br />{t.year}年
                      </th>
                    ))
                  )}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {allDates.map(mmdd => (
              <tr key={mmdd}>
                <td style={{ fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {formatDate(mmdd)}
                </td>
                {!isTwoTargets
                  ? METRICS.map(m => {
                      const row = rowMaps[0]?.get(mmdd);
                      return (
                        <td key={m.key} className="text-right" style={{ whiteSpace: 'nowrap' }}>
                          {formatValue(row, m)}
                        </td>
                      );
                    })
                  : METRICS.map(m =>
                      rowMaps.map((map, i) => {
                        const row = map.get(mmdd);
                        return (
                          <td key={`${m.key}-${i}`} className="text-right" style={{ whiteSpace: 'nowrap' }}>
                            {formatValue(row, m)}
                          </td>
                        );
                      })
                    )
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
