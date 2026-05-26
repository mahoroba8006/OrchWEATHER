import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  fetchLocations,
  addLocationToFirestore,
  updateLocationInFirestore,
  deleteLocationFromFirestore,
} from './lib/locationRepository';
import {
  getUserSettings,
  updateBaseTempSettings as updateBaseTempSettingsRemote,
  updateAccumStartDates as updateAccumStartDatesRemote,
  updateAccumDeltaThresholds as updateAccumDeltaThresholdsRemote,
  updateRiskThresholds as updateRiskThresholdsRemote,
} from './lib/userRepository';

export interface LocationInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

// 累積開始日（MM-DD）— precip/sunshine/radiation/gdd の4チャート分
export interface AccumStartDates {
  precip: string;
  sunshine: string;
  radiation: string;
  gdd: string;
}

// Δ日 ガード閾値（序盤の不安定な逆引きを抑制）
export interface AccumDeltaThresholds {
  gdd: number;
  radiation: number;
}

export type RiskSensitivity = 'low' | 'medium' | 'high';

export interface RiskThresholds {
  frost:              number;          // 霜：気温 ≤ X ℃             デフォルト: 3
  frostDewPoint:      number;          // 霜：露点温度 ≤ X ℃  ＆      デフォルト: 0  ※時間別のみ
  wind:               number;          // 強風：風速 ≥ X m/s           デフォルト: 15
  rainHourly:         number;          // 大雨：時間雨量 ≥ X mm/h      デフォルト: 30
  rainDaily:          number;          // 大雨：日雨量 ≥ X mm           デフォルト: 80
  heat:               number;          // 高温：気温 ≥ X ℃             デフォルト: 35
  dry:                number;          // 乾燥：湿度 ≤ X %             デフォルト: 30
  thunderSensitivity: RiskSensitivity; // 雷雨感度（CAPE閾値に内部マッピング） デフォルト: 'medium'
  hailSensitivity:    RiskSensitivity; // 雹感度（CAPE閾値に内部マッピング）   デフォルト: 'medium'
  hailFreezingLevel:  number;          // 雹：0℃層高度 ≤ X m    ＆    デフォルト: 3500  ※時間別のみ
}

export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  riskThresholds:       RiskThresholds;
}

const DEFAULT_BASE_TEMP_SETTINGS: [number, number] = [10, 3.5];
const DEFAULT_ACCUM_START_DATES: AccumStartDates = {
  precip: '01-01',
  sunshine: '01-01',
  radiation: '01-01',
  gdd: '01-01',
};
const DEFAULT_ACCUM_DELTA_THRESHOLDS: AccumDeltaThresholds = {
  gdd: 30,
  radiation: 100,
};

const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  frost:              3,
  frostDewPoint:      0,
  wind:               15,
  rainHourly:         30,
  rainDaily:          80,
  heat:               35,
  dry:                30,
  thunderSensitivity: 'medium',
  hailSensitivity:    'medium',
  hailFreezingLevel:  3500,
};

interface AppState {
  user: User | null;
  authLoading: boolean;
  locations: LocationInfo[];
  locationsLoading: boolean;
  userSettings: UserSettings | null;

  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  loadLocations: (uid: string) => Promise<void>;
  loadUserSettings: (uid: string) => Promise<void>;
  updateBaseTempSettings: (settings: [number, number]) => Promise<void>;
  updateAccumStartDates: (dates: AccumStartDates) => Promise<void>;
  updateAccumDeltaThresholds: (thresholds: AccumDeltaThresholds) => Promise<void>;
  updateRiskThresholds: (thresholds: RiskThresholds) => Promise<void>;
  addLocation: (loc: Omit<LocationInfo, 'id'>) => Promise<void>;
  updateLocation: (id: string, loc: Partial<LocationInfo>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>()((set, get) => ({
  user: null,
  authLoading: true,
  locations: [],
  locationsLoading: false,
  userSettings: null,

  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  loadLocations: async (uid) => {
    set({ locationsLoading: true });
    const locations = await fetchLocations(uid);
    set({ locations, locationsLoading: false });
  },

  loadUserSettings: async (uid) => {
    const settings = await getUserSettings(uid);
    set({ userSettings: settings });
  },

  updateBaseTempSettings: async (settings) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateBaseTempSettingsRemote(uid, settings);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, baseTempSettings: settings }
        : null,
    }));
  },

  updateAccumStartDates: async (dates) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateAccumStartDatesRemote(uid, dates);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, accumStartDates: dates }
        : null,
    }));
  },

  updateAccumDeltaThresholds: async (thresholds) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateAccumDeltaThresholdsRemote(uid, thresholds);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, accumDeltaThresholds: thresholds }
        : null,
    }));
  },

  updateRiskThresholds: async (thresholds) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateRiskThresholdsRemote(uid, thresholds);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, riskThresholds: thresholds }
        : null,
    }));
  },

  addLocation: async (loc) => {
    const uid = get().user?.uid;
    if (!uid) return;
    const id = await addLocationToFirestore(uid, loc);
    set((state) => ({
      locations: [...state.locations, { ...loc, id }],
    }));
  },

  updateLocation: async (id, loc) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateLocationInFirestore(uid, id, loc);
    set((state) => ({
      locations: state.locations.map((l) => (l.id === id ? { ...l, ...loc } : l)),
    }));
  },

  deleteLocation: async (id) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await deleteLocationFromFirestore(uid, id);
    set((state) => ({
      locations: state.locations.filter((l) => l.id !== id),
    }));
  },
}));

export {
  DEFAULT_BASE_TEMP_SETTINGS,
  DEFAULT_ACCUM_START_DATES,
  DEFAULT_ACCUM_DELTA_THRESHOLDS,
  DEFAULT_RISK_THRESHOLDS,
};
