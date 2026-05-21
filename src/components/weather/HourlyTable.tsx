import type { HourlyForecast } from '../../api/forecast';
import { weatherCodeToEmoji } from '../../lib/riskDetection';

interface Props {
  hourly: HourlyForecast[];
}

const ROWS: {
  key: string;
  label: string;
  fmt: (h: HourlyForecast) => string;
  isRisk: (h: HourlyForecast) => boolean;
}[] = [
  {
    key: 'time',
    label: '時刻',
    fmt: h => h.time.slice(11, 16),
    isRisk: () => false,
  },
  {
    key: 'weather',
    label: '天気',
    fmt: h => weatherCodeToEmoji(h.weatherCode),
    isRisk: () => false,
  },
  {
    key: 'temperature',
    label: '気温(℃)',
    fmt: h => h.temperature.toFixed(1),
    isRisk: h => h.temperature >= 35 || h.temperature <= 3,
  },
  {
    key: 'precip',
    label: '降水(mm)',
    fmt: h => h.precipitation.toFixed(1),
    isRisk: h => h.precipitation >= 30,
  },
  {
    key: 'precipProb',
    label: '降水確率(%)',
    fmt: h => String(h.precipProb),
    isRisk: () => false,
  },
  {
    key: 'dewPoint',
    label: '露点(℃)',
    fmt: h => h.dewPoint.toFixed(1),
    isRisk: h => h.dewPoint <= 0,
  },
  {
    key: 'humidity',
    label: '湿度(%)',
    fmt: h => String(h.humidity),
    isRisk: h => h.humidity <= 30,
  },
  {
    key: 'windSpeed',
    label: '風速(m/s)',
    fmt: h => h.windSpeed.toFixed(1),
    isRisk: () => false,
  },
  {
    key: 'windGusts',
    label: '突風(m/s)',
    fmt: h => h.windGusts.toFixed(1),
    isRisk: h => h.windGusts >= 15,
  },
  {
    key: 'cape',
    label: 'CAPE(J/kg)',
    fmt: h => Math.round(h.cape).toString(),
    isRisk: h => h.cape >= 500,
  },
  {
    key: 'freezing',
    label: '0℃層高度(m)',
    fmt: h => Math.round(h.freezingLevel).toString(),
    isRisk: h => h.freezingLevel <= 3500 && h.cape >= 1000,
  },
  {
    key: 'pressure',
    label: '気圧(hPa)',
    fmt: h => h.pressure.toFixed(1),
    isRisk: () => false,
  },
];

export function HourlyTable({ hourly }: Props) {
  return (
    <div>
      <div style={{ padding: '0.9rem 1rem 0.4rem', fontSize: '0.75rem', color: '#8a93a6', letterSpacing: '0.05em' }}>
        時間別 ／ 72時間
      </div>
      <div
        style={{
          overflowX: 'auto',
          touchAction: 'pan-x',
          background: '#fff',
          borderTop: '1px solid #ebeef5',
          borderBottom: '1px solid #ebeef5',
        }}
      >
        <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.key} style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: '#f8f9fc',
                    padding: '0.3rem 0.6rem',
                    fontWeight: 500,
                    color: '#5b6478',
                    borderRight: '1px solid #ebeef5',
                    zIndex: 1,
                    minWidth: 90,
                  }}
                >
                  {row.label}
                </td>
                {hourly.map((h) => {
                  const risk = row.isRisk(h);
                  return (
                    <td
                      key={h.time}
                      style={{
                        padding: '0.3rem 0.4rem',
                        textAlign: 'center',
                        background: risk ? '#fafaf6' : undefined,
                        fontWeight: risk ? 700 : undefined,
                        minWidth: 50,
                        color: '#4b5563',
                      }}
                    >
                      {row.fmt(h)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
