// src/components/weather/WeatherIcon.tsx
// Meteocons animated SVG icons (fill style) — files in /public/icons/weather/

// ── WMO code → Meteocons filename ────────────────────────────────────────────
// 参照: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
// アイコン: basmilius/meteocons@dev production/fill/svg (全て200確認済み)
function codeToIconFile(code: number, isNight: boolean): string {
  const d = isNight ? 'night' : 'day';

  // 0: 快晴 / 1: おおむね晴れ / 2: 一部曇り / 3: 曇り
  if (code === 0)                 return `clear-${d}`;
  if (code === 1)                 return `mostly-clear-${d}`;
  if (code === 2)                 return `partly-cloudy-${d}`;
  if (code === 3)                 return 'overcast';

  // 45/48: 霧・着氷霧
  if (code === 45 || code === 48) return `fog-${d}`;

  // 51: 霧雨（弱） / 53-55: 霧雨（並〜強）
  if (code === 51)                                return 'drizzle';
  if (code === 53 || code === 55)                return 'overcast-drizzle';

  // 56: 着氷性の霧雨（弱） / 57: 着氷性の霧雨（強）
  if (code === 56 || code === 57) return 'sleet';

  // 61: 雨（弱） / 63: 雨（並） / 65: 雨（強）
  if (code === 61)                return 'rain';
  if (code === 63)                return 'overcast-rain';
  if (code === 65)                return 'extreme-rain';

  // 66: 着氷性の雨（弱） / 67: 着氷性の雨（強）
  if (code === 66)                return 'sleet';
  if (code === 67)                return 'extreme-sleet';

  // 71: 雪（弱） / 73: 雪（並） / 75: 雪（強） / 77: 雪粒
  if (code === 71)                return 'snow';
  if (code === 73)                return 'overcast-snow';
  if (code === 75)                 return 'extreme-snow';
  if (code === 77)                 return 'overcast-snow';

  // 80: にわか雨（弱） / 81: にわか雨（並） / 82: にわか雨（激）
  if (code === 80)                return `mostly-clear-${d}-drizzle`;
  if (code === 81)                return `partly-cloudy-${d}-drizzle`;
  if (code === 82)                return `partly-cloudy-${d}-rain`;

  // 85: にわか雪（弱） / 86: にわか雪（強）
  if (code === 85)                return `mostly-clear-${d}-snow`;
  if (code === 86)                return `partly-cloudy-${d}-snow`;

  // 95: 雷雨 / 96: 雷雨＋弱いひょう / 99: 雷雨＋強いひょう
  if (code === 95)                return 'thunderstorms-extreme-rain';
  if (code === 96)                return 'thunderstorms-extreme-sleet';
  if (code === 99)                return 'extreme-thunderstorms-extreme-sleet';

  return 'not-available';
}

// ── Short label for AM/PM transition text ─────────────────────────────────────
function codeToShortLabel(code: number): string {
  if (code === 0)                          return '快晴';
  if (code === 1)                          return '晴れ';
  if (code === 2)                          return '晴れ曇';
  if (code === 3)                          return '曇り';
  if (code === 45 || code === 48)          return '霧';
  if (code === 51)                         return '霧雨弱';
  if (code === 53)                         return '霧雨';
  if (code === 55)                         return '霧雨強';
  if (code === 56 || code === 57)          return '氷雨';
  if (code === 61)                         return '小雨';
  if (code === 63)                         return '雨';
  if (code === 65)                         return '大雨';
  if (code === 66 || code === 67)          return 'みぞれ';
  if (code === 71)                         return '小雪';
  if (code === 73)                         return '雪';
  if (code === 75 || code === 77)          return '大雪';
  if (code === 80)                         return 'にわか雨弱';
  if (code === 81)                         return 'にわか雨';
  if (code === 82)                         return '激にわか雨';
  if (code === 85)                         return 'にわか雪弱';
  if (code === 86)                         return 'にわか雪';
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
  if (code === 51)                         return '霧雨（弱）';    // partly-cloudy-drizzle
  if (code === 53)                         return '霧雨';           // overcast-drizzle
  if (code === 55)                         return '霧雨（強）';    // overcast-drizzle (dense)
  if (code === 56 || code === 57)          return '氷雨';
  if (code === 61)                         return '小雨';           // partly-cloudy-rain
  if (code === 63)                         return '雨';             // overcast-rain
  if (code === 65)                         return '大雨';           // overcast-rain (no day/night)
  if (code === 66 || code === 67)          return 'みぞれ';
  if (code === 71)                         return '小雪';           // partly-cloudy-snow
  if (code === 73)                         return '雪';             // overcast-snow
  if (code === 75 || code === 77)          return '大雪';           // overcast-snow (no day/night)
  if (code === 80)                         return 'にわか雨（弱）'; // partly-cloudy-rain shower
  if (code === 81)                         return 'にわか雨';       // overcast-rain shower
  if (code === 82)                         return '激しいにわか雨'; // extreme-rain
  if (code === 85)                         return 'にわか雪（弱）'; // partly-cloudy-snow shower
  if (code === 86)                         return 'にわか雪';       // overcast-snow shower
  if (code === 95)                         return '雷雨';
  if (code === 96 || code === 99)          return '雷雨（ひょう）';
  return '—';
}

// ── Component ─────────────────────────────────────────────────────────────────
interface WeatherIconProps {
  code: number;
  isNight?: boolean;
  size?: number;
  animated?: boolean;  // true(default)=アニメSVG(日別用), false=静的SVG(時間別用)
  style?: React.CSSProperties;
}

export function WeatherIcon({ code, isNight = false, size = 24, animated = true, style }: WeatherIconProps) {
  const file = codeToIconFile(code, isNight);
  const folder = animated ? '/icons/weather' : '/icons/weather-static';
  return (
    <img
      src={`${folder}/${file}.svg`}
      width={size}
      height={size}
      alt={codeToLabel(code)}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    />
  );
}
