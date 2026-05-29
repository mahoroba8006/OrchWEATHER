import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { UserSettings, AccumStartDates, AccumDeltaThresholds, RiskThresholds, RiskType } from '../store';

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

// SYNC: このオブジェクトは src/store.ts・src/lib/riskDetection.ts にも
//       ローカルコピーがある（循環 import 回避のため）。新フィールド追加時は3箇所を同時に更新すること。
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
  snow:               3,
  cold:               0,
  enabledRisks:       [
    'frost', 'thunder', 'hail', 'rain', 'wind', 'heat', 'dry', 'cold', 'snow',
  ] as RiskType[],
};

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
  const riskThresholds: RiskThresholds = {
    ...DEFAULT_RISK_THRESHOLDS,
    ...(data?.riskThresholds ?? {}),
  };
  const defaultLocationId: string | null = data?.defaultLocationId ?? null;
  return { baseTempSettings, accumStartDates, accumDeltaThresholds, riskThresholds, defaultLocationId };
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

export async function updateRiskThresholds(
  uid: string,
  thresholds: RiskThresholds
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { riskThresholds: thresholds }, { merge: true });
}

export async function updateDefaultLocationId(
  uid: string,
  id: string | null
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { defaultLocationId: id }, { merge: true });
}
