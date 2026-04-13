import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LocationInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  baseTemp: number;
}

interface AppState {
  locations: LocationInfo[];
  addLocation: (loc: Omit<LocationInfo, 'id'>) => void;
  updateLocation: (id: string, loc: Partial<LocationInfo>) => void;
  deleteLocation: (id: string) => void;
}

const defaultLocations: LocationInfo[] = [
  { id: '1', name: 'A農場 (山梨)', lat: 35.66, lon: 138.56, baseTemp: 10 },
  { id: '2', name: 'B畑 (長野)', lat: 36.64, lon: 138.19, baseTemp: 4 },
];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      locations: defaultLocations,
      
      addLocation: (loc) => set((state) => {
        const newId = Date.now().toString();
        return {
          locations: [...state.locations, { ...loc, id: newId }]
        };
      }),
      
      updateLocation: (id, loc) => set((state) => ({
        locations: state.locations.map(l => l.id === id ? { ...l, ...loc } : l)
      })),
      
      deleteLocation: (id) => set((state) => ({
        locations: state.locations.filter(l => l.id !== id)
      })),
    }),
    {
      name: 'agri-weather-storage',
    }
  )
);
