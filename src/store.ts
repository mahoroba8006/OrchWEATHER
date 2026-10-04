import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { WeatherCodeMode } from './lib/wmoSeverity';
import type { ReviewBase, SeasonPaceModes } from './lib/seasonReview';
import { loadGuestHiddenHourlyRows, saveGuestHiddenHourlyRows, DEFAULT_HIDDEN_HOURLY_ROWS, type HourlyRowKey } from './lib/hourlyRows';
import { fetchAiAllowed } from './api/me';
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
  updateEnabledAiSections as updateEnabledAiSectionsRemote,
  updateAiCustomPrompt as updateAiCustomPromptRemote,
  updateWeatherCodeMode as updateWeatherCodeModeRemote,
  updateSeasonPaceModes as updateSeasonPaceModesRemote,
  updateSeasonReviewBase as updateSeasonReviewBaseRemote,
  updateHiddenHourlyRows as updateHiddenHourlyRowsRemote,
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

// ─── AI コメント 表示セクション ──────────────────────────────────────────────
export type AiSection =
  | 'weatherOverview'    // 空ごよみ
  | 'generalWorkAdvice'  // 畑しごと
  | 'sprayingAdvice'     // 散布どき
  | 'fertilizingAdvice'  // 施肥どき
  | 'custom';            // カスタマイズ（ユーザー入力プロンプト）

export const ALL_AI_SECTIONS: AiSection[] = [
  'weatherOverview', 'generalWorkAdvice', 'sprayingAdvice', 'fertilizingAdvice', 'custom',
];

// カスタマイズはデフォルト無効（明示的にオプトインする）
export const DEFAULT_AI_SECTIONS: AiSection[] = [
  'weatherOverview', 'generalWorkAdvice', 'sprayingAdvice', 'fertilizingAdvice',
];


export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  defaultLocationId:    string | null;
  enabledAiSections:    AiSection[];
  aiCustomPrompt:       string;
  weatherCodeMode:      WeatherCodeMode;
  seasonPaceModes:      SeasonPaceModes;
  seasonReviewBase:     ReviewBase;
  hiddenHourlyRows:     HourlyRowKey[];
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
  aiAllowed: boolean;
  guestMode: boolean;
  guestHiddenHourlyRows: HourlyRowKey[];

  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setGeoLocation: (loc: LocationInfo | null) => void;
  setGeoStatus: (status: 'idle' | 'loading' | 'error') => void;
  loadAiAllowed: () => Promise<void>;
  setAiAllowed: (allowed: boolean) => void;
  resetUserData: () => void;
  setGuestMode: (on: boolean) => void;
  loadLocations: (uid: string) => Promise<void>;
  loadUserSettings: (uid: string) => Promise<void>;
  updateBaseTempSettings: (settings: [number, number]) => Promise<void>;
  updateAccumStartDates: (dates: AccumStartDates) => Promise<void>;
  updateAccumDeltaThresholds: (thresholds: AccumDeltaThresholds) => Promise<void>;
  updateDefaultLocationId: (id: string | null) => Promise<void>;
  updateEnabledAiSections: (sections: AiSection[]) => Promise<void>;
  updateAiCustomPrompt: (prompt: string) => Promise<void>;
  updateWeatherCodeMode: (mode: WeatherCodeMode) => Promise<void>;
  updateSeasonPaceModes: (modes: SeasonPaceModes) => Promise<void>;
  updateSeasonReviewBase: (base: ReviewBase) => Promise<void>;
  updateHiddenHourlyRows: (rows: HourlyRowKey[]) => Promise<void>;
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
  aiAllowed: false,
  guestMode: typeof localStorage !== 'undefined' && localStorage.getItem('guestMode') === '1',
  guestHiddenHourlyRows: loadGuestHiddenHourlyRows(),

  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  setGeoLocation: (loc) => set({ geoLocation: loc }),
  setGeoStatus: (status) => set({ geoStatus: status }),
  setAiAllowed: (allowed) => set({ aiAllowed: allowed }),
  // ログアウト時に前ユーザーのデータを消去（ゲストモードへ残留させない）
  resetUserData: () => set({ locations: [], userSettings: null, aiAllowed: false }),
  setGuestMode: (on) => {
    try {
      if (on) localStorage.setItem('guestMode', '1');
      else localStorage.removeItem('guestMode');
    } catch { /* localStorage 不可環境は無視 */ }
    set({ guestMode: on });
  },
  loadAiAllowed: async () => {
    const allowed = await fetchAiAllowed();
    set({ aiAllowed: allowed });
  },

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

  updateSeasonPaceModes: async (modes) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateSeasonPaceModesRemote(uid, modes);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, seasonPaceModes: modes }
        : null,
    }));
  },

  updateSeasonReviewBase: async (base) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateSeasonReviewBaseRemote(uid, base);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, seasonReviewBase: base }
        : null,
    }));
  },

  // ログイン中は Firestore、ゲストは localStorage に保存（成功してから状態を更新）
  updateHiddenHourlyRows: async (rows) => {
    const uid = get().user?.uid;
    if (!uid) {
      saveGuestHiddenHourlyRows(rows);
      set({ guestHiddenHourlyRows: rows });
      return;
    }
    await updateHiddenHourlyRowsRemote(uid, rows);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, hiddenHourlyRows: rows }
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

  updateEnabledAiSections: async (sections) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateEnabledAiSectionsRemote(uid, sections);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, enabledAiSections: sections }
        : null,
    }));
  },

  updateAiCustomPrompt: async (prompt) => {
    const uid = get().user?.uid;
    if (!uid) return;
    await updateAiCustomPromptRemote(uid, prompt);
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, aiCustomPrompt: prompt }
        : null,
    }));
  },

  updateWeatherCodeMode: async (mode) => {
    const uid = get().user?.uid;
    if (!uid) return;
    set((state) => ({
      userSettings: state.userSettings
        ? { ...state.userSettings, weatherCodeMode: mode }
        : null,
    }));
    updateWeatherCodeModeRemote(uid, mode).catch(() => {/* best-effort */});
  },

  addLocation: async (loc) => {
    const uid = get().user?.uid;
    if (!uid) return;
    const limit = get().aiAllowed ? 50 : 10;
    if (get().locations.length >= limit) {
      throw new Error(`登録できる地点は最大${limit}件までです`);
    }
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

/** 時間別の表で非表示にする行（ログイン設定 → ゲスト値 → おすすめ） */
export function useHiddenHourlyRows(): HourlyRowKey[] {
  return useAppStore(s => s.userSettings?.hiddenHourlyRows ?? s.guestHiddenHourlyRows ?? DEFAULT_HIDDEN_HOURLY_ROWS);
}

export {
  DEFAULT_BASE_TEMP_SETTINGS,
  DEFAULT_ACCUM_START_DATES,
  DEFAULT_ACCUM_DELTA_THRESHOLDS,
};
