// 「今の空」を WeatherTab（発行側）と ヘッダー・空帯（購読側）で共有する。
import { create } from 'zustand';
import { jstMinutesOfDay, skyPalette, timeOfDay, type SkyWeather, type TimeOfDay } from './lib/sky';

export interface SkyState {
  tod: TimeOfDay;
  weather: SkyWeather;
  top: string;
  bottom: string;
  isNight: boolean;
}

export interface SkySummary {
  temperature: number;
  weatherCode: number;
  locationName: string;
}

interface SkyStore {
  sky: SkyState | null;
  summary: SkySummary | null;
  /** 空もようのヒーローが画面内に見えているか（ヘッダーの縮小表示の切替に使う） */
  heroVisible: boolean;
  publish: (sky: SkyState, summary: SkySummary | null) => void;
  setHeroVisible: (visible: boolean) => void;
}

export const useSkyStore = create<SkyStore>(set => ({
  sky: null,
  summary: null,
  heroVisible: true,
  publish: (sky, summary) => set({ sky, summary }),
  setHeroVisible: heroVisible => set({ heroVisible }),
}));

/** 予報未取得時の空: 日の出6時・日の入り18時とみなした晴れ */
export function fallbackSky(now: Date = new Date()): SkyState {
  const tod = timeOfDay(jstMinutesOfDay(now), 6 * 60, 18 * 60);
  return { tod, weather: 'clear', ...skyPalette(tod, 'clear') };
}
