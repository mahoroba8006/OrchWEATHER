// src/components/weather/WeatherLoader.tsx
//
// 波打つアイコン列＋点滅ドットのローディング表示。
// AI コメント読み込み中の演出として作られ、アプリ起動時（認証待ち）でも流用する。
// label で見出しテキストを差し替え可能（既定「お天気を分析中」）。

import { CloudSun, Shovel, Droplets, Sprout, Pencil } from 'lucide-react';

// AiCommentCard のタブアイコン（空ごよみ/畑しごと/散布/施肥/じぶん好み）と同じ並び
const LOADER_ICONS = [CloudSun, Shovel, Droplets, Sprout, Pencil];

interface WeatherLoaderProps {
  label?: string;
  iconSize?: number;
}

export function WeatherLoader({ label = 'お天気を分析中', iconSize = 28 }: WeatherLoaderProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {LOADER_ICONS.map((Icon, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              color: 'var(--accent-color)',
              animation: 'iconWaveBounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          >
            <Icon size={iconSize} />
          </span>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--accent-color)' }}>
        {label}<span className="dot-pulse">…</span>
      </div>
    </div>
  );
}
