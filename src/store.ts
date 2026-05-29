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
  updateDefaultLocationId as updateDefaultLocationIdRemote,
  updateEnabledJmaGroups as updateEnabledJmaGroupsRemote,
} from './lib/userRepository';

export interface LocationInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  jmaAreaCode?: string;  // 気象庁 class20s コード（7桁, 例: "0120200"）
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

// ─── JMA 注意報・警報 表示グループ ───────────────────────────────────────────
export type JmaWarningGroup =
  | '大雨' | '洪水' | '大雪' | '強風' | '風雪' | '波浪' | '高潮'
  | '乾燥' | '霜' | '低温' | '雷' | '濃霧' | 'なだれ' | '融雪' | '着氷' | '着雪';

export const JMA_GROUP_CODES: Record<JmaWarningGroup, string[]> = {
  '大雨': ['02', '21', '33'],
  '洪水': ['03', '22'],
  '大雪': ['12', '23', '40'],
  '強風': ['16', '20', '39'],
  '風雪': ['13', '19', '24', '38'],
  '波浪': ['17', '25', '37'],
  '高潮': ['18', '26', '35'],
  '乾燥': ['04'],
  '霜':   ['05'],
  '低温': ['07'],
  '雷':   ['15'],
  '濃霧': ['14'],
  'なだれ': ['06'],
  '融雪': ['10'],
  '着氷': ['08'],
  '着雪': ['09'],
};

export const ALL_JMA_GROUPS: JmaWarningGroup[] = [
  '大雨', '洪水', '大雪', '強風', '風雪', '波浪', '高潮',
  '乾燥', '霜', '低温', '雷', '濃霧', 'なだれ', '融雪', '着氷', '着雪',
];

export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  defaultLocationId:    string | null;
  enabledJmaGroups:     JmaWarningGroup[];
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
  geoLocation: LocationInfo | null;
  geoStatus: 'idle' | 'loading' | 'error';

  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setGeoLocation: (loc: LocationInfo | null) => void;
  setGeoStatus: (status: 'idle' | 'loading' | 'error') => void;
  loadLocations: (uid: string) => Promise<void>;
  loadUserSettings: (uid: string) => Promise<void>;
  updateBaseTempSettings: (settings: [number, number]) => Promise<void>;
  updateAccumStartDates: (dates: AccumStartDates) => Promise<void>;
  updateAccumDeltaThresholds: (thresholds: AccumDeltaThresholds) => Promise<void>;
  updateDefaultLocationId: (id: string | null) => Promise<void>;
  updateEnabledJmaGroups: (groups: JmaWarningGroup[]) => Promise<void>;
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
  geoLocation: null,
  geoStatus: 'idle',

  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  setGeoLocation: (loc) => set({ geoLocation: loc }),
  setGeoStatus: (status) => set({ geoStatus: status }),

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

  updateDefaultLocationId: async (id) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateDefaultLocationIdRemote(uid, id);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, defaultLocationId: id }
        : null,
    }));
  },

  updateEnabledJmaGroups: async (groups) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateEnabledJmaGroupsRemote(uid, groups);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, enabledJmaGroups: groups }
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
