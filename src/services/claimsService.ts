import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, getCurrentUser } from '../lib/firebase';

export async function submitClaim(restaurantId: string, payload: { notes?: string; contactEmail?: string; supportingLink?: string }) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const data = {
    restaurantId,
    requesterUid: user.uid,
    status: 'pending',
    notes: payload.notes || null,
    contactEmail: payload.contactEmail || null,
    supportingLink: payload.supportingLink || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return addDoc(collection(db, 'owner_claims'), data);
}

export async function listMyClaims() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const q = query(collection(db, 'owner_claims'), where('requesterUid', '==', user.uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

// Admin-only helper to approve a claim and add owner to restaurant.ownerIds
export async function adminApproveClaim(claimId: string) {
  // Fetch claim
  const claimRef = doc(db, 'owner_claims', claimId);
  const claimSnap = await getDoc(claimRef);
  if (!claimSnap.exists()) throw new Error('Claim not found');
  const claim = claimSnap.data() as any;
  if (!claim.restaurantId || !claim.requesterUid) throw new Error('Invalid claim payload');

  // Update restaurant doc ownerIds (admin flow; rules enforce admin)
  const restRef = doc(db, 'restaurants', claim.restaurantId);
  await updateDoc(restRef, { ownerIds: arrayUnion(claim.requesterUid) });

  // Mark claim as approved
  await updateDoc(claimRef, { status: 'approved', updatedAt: serverTimestamp() });
}

export async function approveClaim(claimId: string) {
  return adminApproveClaim(claimId);
}

export async function rejectClaim(claimId: string) {
  const claimRef = doc(db, 'owner_claims', claimId);
  await updateDoc(claimRef, { status: 'rejected', updatedAt: serverTimestamp() });
}

export async function uploadClaimProofs(
  claimId: string,
  files: File[],
  onProgress?: (fileIndex: number, pct: number) => void
): Promise<string[]> {
  const storage = getStorage();
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${f.name}`;
    const storageRef = ref(storage, `owner_claims/${claimId}/proofs/${fileName}`);
    const task = uploadBytesResumable(storageRef, f);
    await new Promise<void>((resolve, reject) => {
      task.on('state_changed', (snap) => {
        const pct = Math.round((snap.bytesTransferred / Math.max(1, snap.totalBytes)) * 100);
        onProgress && onProgress(i, pct);
      }, reject, async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          urls.push(url);
          resolve();
        } catch (e) { reject(e); }
      });
    });
  }
  return urls;
}
