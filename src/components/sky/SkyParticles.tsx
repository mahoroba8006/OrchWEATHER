// 天気別の粒子演出。描画は CSS アニメーション（transform / opacity のみ）で、JS は毎フレーム動かない。
// 位置・遅延・周期はすべて添字から決まる値なので、再描画しても動かない。
import type { CSSProperties } from 'react';
import type { SkyWeather } from '../../lib/sky';
import './sky.css';

type Kind = 'star' | 'cloud' | 'rain' | 'snow' | 'fog';

// eslint-disable-next-line react-refresh/only-export-components -- 仕様上 export が必要（テストで使用）
export function particleCount(weather: SkyWeather, isNight: boolean): number {
  switch (weather) {
    case 'clear': return isNight ? 24 : 0;
    case 'cloudy': return 4;
    case 'rain': return 40;
    case 'snow': return 30;
    case 'fog': return 3;
    case 'thunder': return 40;
  }
}

function kindOf(weather: SkyWeather): Kind {
  switch (weather) {
    case 'clear': return 'star';
    case 'cloudy': return 'cloud';
    case 'rain':
    case 'thunder': return 'rain';
    case 'snow': return 'snow';
    case 'fog': return 'fog';
  }
}

const frac = (v: number) => v - Math.floor(v);
const fix = (v: number, d = 2) => Number(v.toFixed(d));

/** 添字 i の粒子のスタイル（CSS 変数）を決定的に作る */
function particleStyle(kind: Kind, i: number): CSSProperties {
  const vars: Record<string, string> = {};
  switch (kind) {
    case 'star': {
      const dur = 2.6 + (i % 5) * 0.7;
      vars['--x'] = `${(i * 37) % 100}%`;
      vars['--y'] = `${(i * 53) % 78}%`;
      vars['--size'] = `${1 + (i % 3) * 0.6}px`;
      vars['--dur'] = `${fix(dur)}s`;
      vars['--delay'] = `${fix(-frac(i * 0.173) * dur)}s`;
      break;
    }
    case 'cloud': {
      const dur = 40 + ((i * 9) % 31);
      vars['--x'] = `${(i * 29) % 70}%`;
      vars['--y'] = `${(i * 23) % 45}%`;
      vars['--w'] = `${70 + ((i * 7) % 26)}%`;
      vars['--dur'] = `${dur}s`;
      vars['--delay'] = `${fix(-frac(i * 0.173 + i * 0.31) * dur, 1)}s`;
      break;
    }
    case 'rain': {
      const dur = 0.6 + ((i * 7) % 6) * 0.1;
      vars['--x'] = `${(i * 37) % 125}%`;
      vars['--y'] = `${(i * 53) % 100}%`;
      vars['--len'] = `${16 + (i % 4) * 4}px`;
      vars['--dur'] = `${fix(dur)}s`;
      vars['--delay'] = `${fix(-frac(i * 0.173) * dur * 3, 3)}s`;
      break;
    }
    case 'snow': {
      const dur = 6 + ((i * 17) % 6);
      vars['--x'] = `${(i * 37) % 100}%`;
      vars['--y'] = `${(i * 53) % 100}%`;
      vars['--size'] = `${3 + (i % 3)}px`;
      vars['--sway'] = `${8 + (i % 4) * 4}px`;
      vars['--dur'] = `${dur}s`;
      vars['--delay'] = `${fix(-frac(i * 0.173 + i * 0.41) * dur)}s`;
      break;
    }
    case 'fog': {
      vars['--y'] = `${10 + i * 30}%`;
      vars['--dur'] = `${18 + i * 6}s`;
      vars['--delay'] = `${-i * 5}s`;
      break;
    }
  }
  return vars as CSSProperties;
}

interface SkyParticlesProps {
  weather: SkyWeather;
  isNight: boolean;
  paused: boolean;
}

export function SkyParticles({ weather, isNight, paused }: SkyParticlesProps) {
  const kind = kindOf(weather);
  const count = particleCount(weather, isNight);
  return (
    <div className={`sky-particles${paused ? ' sky-particles--paused' : ''}`} aria-hidden="true">
      <div className="sky-breath" />
      {weather === 'clear' && !isNight && <div className="sky-sun" />}
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`sky-particle sky-particle--${kind}`} style={particleStyle(kind, i)} />
      ))}
      {weather === 'thunder' && <div className="sky-flash" />}
    </div>
  );
}
