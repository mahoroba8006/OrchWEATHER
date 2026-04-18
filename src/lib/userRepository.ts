import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { UserSettings } from '../store';

const DEFAULT_BASE_TEMP_SETTINGS: [number, number] = [10, 3.5];

export async function ensureUserDocument(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { createdAt: serverTimestamp() }, { merge: true });
}

export async function getUserSettings(uid: string): Promise<UserSettings> {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const baseTempSettings = data?.baseTempSettings ?? DEFAULT_BASE_TEMP_SETTINGS;
  return { baseTempSettings };
}

export async function updateBaseTempSettings(
  uid: string,
  settings: [number, number]
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { baseTempSettings: settings }, { merge: true });
}
