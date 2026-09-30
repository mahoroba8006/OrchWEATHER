import { BarChart2, Clock, Sun } from 'lucide-react';

export type MainTab = 'weather' | 'analysis' | 'history';

export const MAIN_TABS = [
  { id: 'weather',  label: '空もよう', Icon: Sun },
  { id: 'analysis', label: '空くらべ', Icon: BarChart2 },
  { id: 'history',  label: '空しらべ', Icon: Clock },
] as const;

export const tabIndex = (t: MainTab) => MAIN_TABS.findIndex(x => x.id === t);
