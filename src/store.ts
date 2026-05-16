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

export interface UserSettings {
  baseTempSettings: [number, number];
  accumStartDates: AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
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
};
