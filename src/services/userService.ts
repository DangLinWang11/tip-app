import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

// Ensure a minimal user profile exists for the given Firebase Auth user.
// Does not override existing profile fields; only creates if missing and bumps lastLoginAt.
export async function ensureUserProfile(user: User) {
  // Owners are normal users; owner permissions are derived from restaurants.ownerIds
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
    return;
  }
  await updateDoc(ref, { lastLoginAt: serverTimestamp() });
}
