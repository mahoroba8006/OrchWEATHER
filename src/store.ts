import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { WeatherCodeMode } from './lib/wmoSeverity';
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
  updateEnabledAiSections as updateEnabledAiSectionsRemote,
  updateAiCustomPrompt as updateAiCustomPromptRemote,
  updateWeatherCodeMode as updateWeatherCodeModeRemote,
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
  | 'disasterPrep'       // 天気の備え
  | 'custom';            // カスタマイズ（ユーザー入力プロンプト）

export const ALL_AI_SECTIONS: AiSection[] = [
  'weatherOverview', 'generalWorkAdvice', 'sprayingAdvice', 'fertilizingAdvice', 'disasterPrep', 'custom',
];

// カスタマイズはデフォルト無効（明示的にオプトインする）
export const DEFAULT_AI_SECTIONS: AiSection[] = [
  'weatherOverview', 'generalWorkAdvice', 'sprayingAdvice', 'fertilizingAdvice', 'disasterPrep',
];

// ─── JMA 注意報・警報 表示グループ ───────────────────────────────────────────
export type JmaWarningGroup =
  | '大雨' | '土砂災害' | '洪水' | '大雪' | '強風' | '風雪' | '波浪' | '高潮'
  | '乾燥' | '霜' | '低温' | '雷' | '濃霧' | 'なだれ' | '融雪' | '着氷' | '着雪';

/**
 * 警報・注意報の名前からグループを導出する。
 * r8 フォーマットでは JmaWarningItem.code の体系が変わったため、
 * name ベースのマッチングに切り替えた。
 * '暴風雪' は '暴風' より先にチェックすること（前方一致の誤判定を防ぐ）。
 */
export function warningNameToGroup(name: string): JmaWarningGroup | null {
  if (name.startsWith('大雨'))     return '大雨';
  if (name.startsWith('土砂災害')) return '土砂災害';
  if (name.startsWith('洪水'))     return '洪水';
  if (name.startsWith('大雪'))   return '大雪';
  if (name.startsWith('暴風雪') || name.startsWith('風雪')) return '風雪';
  if (name.startsWith('暴風')  || name.startsWith('強風')) return '強風';
  if (name.startsWith('波浪'))   return '波浪';
  if (name.startsWith('高潮'))   return '高潮';
  if (name.startsWith('乾燥'))   return '乾燥';
  if (name.startsWith('霜'))     return '霜';
  if (name.startsWith('低温'))   return '低温';
  if (name.startsWith('雷'))     return '雷';
  if (name.startsWith('濃霧'))   return '濃霧';
  if (name.startsWith('なだれ')) return 'なだれ';
  if (name.startsWith('融雪'))   return '融雪';
  if (name.startsWith('着氷'))   return '着氷';
  if (name.startsWith('着雪'))   return '着雪';
  return null; // 上記以外の未知の現象 → 常に表示（JMA 追加時の安全策）
}

export const ALL_JMA_GROUPS: JmaWarningGroup[] = [
  '大雨', '土砂災害', '洪水', '大雪', '強風', '風雪', '波浪', '高潮',
  '乾燥', '霜', '低温', '雷', '濃霧', 'なだれ', '融雪', '着氷', '着雪',
];

export interface UserSettings {
  baseTempSettings:     [number, number];
  accumStartDates:      AccumStartDates;
  accumDeltaThresholds: AccumDeltaThresholds;
  defaultLocationId:    string | null;
  enabledJmaGroups:     JmaWarningGroup[];
  enabledAiSections:    AiSection[];
  aiCustomPrompt:       string;
  weatherCodeMode:      WeatherCodeMode;
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
  updateEnabledAiSections: (sections: AiSection[]) => Promise<void>;
  updateAiCustomPrompt: (prompt: string) => Promise<void>;
  updateWeatherCodeMode: (mode: WeatherCodeMode) => Promise<void>;
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
