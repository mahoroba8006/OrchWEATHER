import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { UserSettings, AccumStartDates, AccumDeltaThresholds, JmaWarningGroup, AiSection } from '../store';
import type { WeatherCodeMode } from './wmoSeverity';

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

// SYNC: store.ts の ALL_JMA_GROUPS と同期すること
const DEFAULT_JMA_GROUPS: JmaWarningGroup[] = [
  '大雨', '土砂災害', '洪水', '大雪', '強風', '風雪', '波浪', '高潮',
  '乾燥', '霜', '低温', '雷', '濃霧', 'なだれ', '融雪', '着氷', '着雪',
];

// SYNC: store.ts の DEFAULT_AI_SECTIONS と同期すること
const DEFAULT_AI_SECTIONS: AiSection[] = [
  'weatherOverview', 'generalWorkAdvice', 'sprayingAdvice', 'fertilizingAdvice',
];

// じぶん好み（カスタマイズ）プロンプトの初期値。
// フィールド未設定のユーザーにのみ適用（明示的に空保存した場合は空のまま）
export const DEFAULT_AI_CUSTOM_PROMPT =
  '気象データをもとに、この先1週間の畑仕事の見通しを整理して教えてください。親しみやすい言葉で、モチベーションの上がる一言を添えてください。';

// ユーザードキュメントを「存在しなければ作る」だけにする。
// 毎回 createdAt を上書きしていた旧実装は、並行する getDoc に
// 「createdAt のみ」の中間スナップショットを返す競合の原因になっていた
export async function ensureUserDocument(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { createdAt: serverTimestamp() });
  }
}

export async function getUserSettings(uid: string): Promise<UserSettings> {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const baseTempSettings = data?.baseTempSettings ?? DEFAULT_BASE_TEMP_SETTINGS;
  const accumStartDates: AccumStartDates = {
    ...DEFAULT_ACCUM_START_DATES,
    ...(data?.accumStartDates ?? {}),
  };
  const accumDeltaThresholds: AccumDeltaThresholds = {
    ...DEFAULT_ACCUM_DELTA_THRESHOLDS,
    ...(data?.accumDeltaThresholds ?? {}),
  };
  const defaultLocationId: string | null = data?.defaultLocationId ?? null;
  // 保存済みリストに新規デフォルトグループを自動追加（グループ追加時の前方互換）
  const savedJmaGroups = data?.enabledJmaGroups as JmaWarningGroup[] | undefined;
  const enabledJmaGroups: JmaWarningGroup[] = savedJmaGroups
    ? [...savedJmaGroups, ...DEFAULT_JMA_GROUPS.filter(g => !savedJmaGroups.includes(g))]
    : DEFAULT_JMA_GROUPS;
  // 保存済みリストに新規デフォルトセクションを自動追加（セクション追加時の前方互換）
  const savedAiSections = data?.enabledAiSections as AiSection[] | undefined;
  const enabledAiSections: AiSection[] = savedAiSections
    ? [...savedAiSections, ...DEFAULT_AI_SECTIONS.filter(s => !savedAiSections.includes(s))]
    : DEFAULT_AI_SECTIONS;
  const aiCustomPrompt: string = typeof data?.aiCustomPrompt === 'string' ? data.aiCustomPrompt : DEFAULT_AI_CUSTOM_PROMPT;
  const weatherCodeMode: WeatherCodeMode =
    data?.weatherCodeMode === 'frequency' ? 'frequency' : 'severity';
  return {
    baseTempSettings, accumStartDates, accumDeltaThresholds,
    defaultLocationId, enabledJmaGroups, enabledAiSections, aiCustomPrompt,
    weatherCodeMode,
  };
}

export async function updateBaseTempSettings(
  uid: string,
  settings: [number, number]
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { baseTempSettings: settings }, { merge: true });
}

export async function updateAccumStartDates(
  uid: string,
  dates: AccumStartDates
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { accumStartDates: dates }, { merge: true });
}

export async function updateAccumDeltaThresholds(
  uid: string,
  thresholds: AccumDeltaThresholds
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { accumDeltaThresholds: thresholds }, { merge: true });
}

export async function updateDefaultLocationId(
  uid: string,
  id: string | null
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { defaultLocationId: id }, { merge: true });
}

export async function updateEnabledJmaGroups(
  uid: string,
  groups: JmaWarningGroup[]
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { enabledJmaGroups: groups }, { merge: true });
}

export async function updateEnabledAiSections(
  uid: string,
  sections: AiSection[]
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { enabledAiSections: sections }, { merge: true });
}

export async function updateAiCustomPrompt(
  uid: string,
  prompt: string
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { aiCustomPrompt: prompt }, { merge: true });
}

export async function updateWeatherCodeMode(
  uid: string,
  mode: WeatherCodeMode,
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { weatherCodeMode: mode }, { merge: true });
}
