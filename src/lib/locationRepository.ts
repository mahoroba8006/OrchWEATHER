import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { LocationInfo } from '../store';

const locationsCol = (uid: string) =>
  collection(db, 'users', uid, 'locations');

export async function fetchLocations(uid: string): Promise<LocationInfo[]> {
  const snapshot = await getDocs(locationsCol(uid));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LocationInfo));
}

export async function addLocationToFirestore(
  uid: string,
  loc: Omit<LocationInfo, 'id'>
): Promise<string> {
  const ref = await addDoc(locationsCol(uid), {
    ...loc,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLocationInFirestore(
  uid: string,
  id: string,
  loc: Partial<LocationInfo>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'locations', id), loc);
}

export async function deleteLocationFromFirestore(
  uid: string,
  id: string
): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'locations', id));
}
