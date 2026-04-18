import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  fetchLocations,
  addLocationToFirestore,
  updateLocationInFirestore,
  deleteLocationFromFirestore,
} from './lib/locationRepository';
import { ensureUserDocument, getUserSettings, updateBaseTempSettings } from './lib/userRepository';

export interface LocationInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface UserSettings {
  baseTempSettings: [number, number];
}

const DEFAULT_BASE_TEMP_SETTINGS: [number, number] = [10, 3.5];

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
    await ensureUserDocument(uid);
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
    await updateBaseTempSettings(uid, settings);
    set((state) => ({
      userSettings: { ...state.userSettings, baseTempSettings: settings },
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

export { DEFAULT_BASE_TEMP_SETTINGS };
