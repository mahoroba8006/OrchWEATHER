// src/components/weather/WeatherIcon.tsx
// Meteocons animated SVG icons (fill style) — files in /public/icons/weather/

// ── WMO code → Meteocons filename ────────────────────────────────────────────
function codeToIconFile(code: number, isNight: boolean): string {
  const d = isNight ? 'night' : 'day';

  if (code === 0)                    return `clear-${d}`;
  if (code <= 2)                     return `partly-cloudy-${d}`;
  if (code === 3)                    return 'overcast';
  if (code === 45 || code === 48)    return `fog-${d}`;
  if (code >= 51 && code <= 53)      return 'drizzle';
  if (code === 55)                   return 'overcast-drizzle';
  if (code === 56 || code === 66)    return `overcast-${d}-sleet`;   // 軽い氷雨・着氷性の雨
  if (code === 57 || code === 67)    return 'overcast-sleet';         // 強い氷雨・着氷性の雨
  if (code === 61 || code === 80 || code === 81) return `partly-cloudy-${d}-rain`;
  if (code === 63)                   return `overcast-${d}-rain`;
  if (code === 65)                   return 'overcast-rain';
  if (code === 82)                   return `extreme-${d}-rain`;
  if (code === 71 || code === 85)    return `partly-cloudy-${d}-snow`;
  if (code === 73 || code === 86)    return `overcast-${d}-snow`;
  if (code === 75 || code === 77)    return 'overcast-snow';
  if (code === 95)                   return `thunderstorms-${d}`;
  if (code === 96 || code === 99)    return `extreme-${d}-hail`;
  return 'not-available';
}

// ── Short label for AM/PM transition text ─────────────────────────────────────
function codeToShortLabel(code: number): string {
  if (code === 0)                          return '快晴';
  if (code === 1)                          return '晴れ';
  if (code === 2)                          return '晴れ曇';
  if (code === 3)                          return '曇り';
  if (code === 45 || code === 48)          return '霧';
  if (code >= 51 && code <= 55)            return '霧雨';
  if (code === 56 || code === 57)          return '氷雨';
  if (code >= 61 && code <= 65)            return '雨';
  if (code === 66 || code === 67)          return 'みぞれ';
  if (code >= 71 && code <= 77)            return '雪';
  if (code >= 80 && code <= 82)            return 'にわか雨';
  if (code >= 85 && code <= 86)            return 'にわか雪';
  if (code >= 95 && code <= 99)            return '雷雨';
  return '—';
}

export function dayTransitionLabel(amCode: number | null, pmCode: number | null): string | null {
  if (amCode === null) return null;
  const am = codeToShortLabel(amCode);
  if (pmCode === null) return am;
  const pm = codeToShortLabel(pmCode);
  return am === pm ? am : `${am}のち${pm}`;
}

export function codeToLabel(code: number): string {
  if (code === 0)                          return '快晴';
  if (code === 1)                          return '晴れ';
  if (code === 2)                          return '晴れ時々曇り';
  if (code === 3)                          return '曇り';
  if (code === 45 || code === 48)          return '霧';
  if (code >= 51 && code <= 53)            return '霧雨';
  if (code >= 54 && code <= 55)            return '霧雨（強）';
  if (code === 56 || code === 57)          return '氷雨';
  if (code >= 61 && code <= 63)            return '雨';
  if (code >= 64 && code <= 65)            return '大雨';
  if (code === 66 || code === 67)          return 'みぞれ';
  if (code >= 71 && code <= 73)            return '雪';
  if (code >= 74 && code <= 75)            return '大雪';
  if (code === 76 || code === 77)          return '小雪';
  if (code >= 80 && code <= 81)            return 'にわか雨';
  if (code === 82)                         return '激しいにわか雨';
  if (code >= 85 && code <= 86)            return 'にわか雪';
  if (code === 95)                         return '雷雨';
  if (code === 96 || code === 99)          return '雷雨（ひょう）';
  return '—';
}

// ── Component ─────────────────────────────────────────────────────────────────
interface WeatherIconProps {
  code: number;
  isNight?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

export function WeatherIcon({ code, isNight = false, size = 24, style }: WeatherIconProps) {
  const file = codeToIconFile(code, isNight);
  return (
    <img
      src={`/icons/weather/${file}.svg`}
      width={size}
      height={size}
      alt={codeToLabel(code)}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    />
  );
}
