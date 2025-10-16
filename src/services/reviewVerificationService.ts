import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { arrayUnion, collection, doc, getFirestore, runTransaction, serverTimestamp, setDoc, updateDoc, getDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db, storage, getCurrentUser } from '../lib/firebase';
import { DAILY_VERIFIED_CAP } from '../config/rewards';

export async function uploadReviewProofs(
  reviewId: string,
  files: File[],
  onProgress?: (ratio: number) => void
): Promise<string[]> {
  if (!storage) throw new Error('Storage not initialized');
  if (!db) throw new Error('Firestore not initialized');
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const urls: string[] = [];

  for (const f of files) {
    const stamp = Date.now();
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `reviews/${reviewId}/proofs/${user.uid}_${stamp}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, f, { contentType: f.type || 'image/jpeg' });
    await new Promise<void>((resolve, reject) => {
      task.on('state_changed', (snap) => {
        if (onProgress && snap.total > 0) onProgress(snap.bytesTransferred / snap.total);
      }, reject, () => resolve());
    });
    const url = await getDownloadURL(task.snapshot.ref);
    urls.push(url);

    try {
      const usageId = btoa(unescape(encodeURIComponent(url))).replace(/=+$/,'');
      await setDoc(doc(getFirestore(), 'proof_file_usage', usageId), {
        url,
        reviewId,
        userId: user.uid,
        createdAt: serverTimestamp(),
      }, { merge: true });
    } catch {}
  }

  return urls;
}

export async function markReviewPendingProof(reviewId: string, proofUrls: string[]): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  await updateDoc(doc(db, 'reviews', reviewId), {
    'verification.state': 'pending_proof',
    'verification.proofType': 'receipt',
    'verification.requestedAt': serverTimestamp(),
    'verification.proofUrls': arrayUnion(...proofUrls),
  } as any);
}

export async function adminApproveReview(reviewId: string, points: number, verifiedBy: string) {
  const fs = getFirestore();
  const reviewRef = doc(fs, 'reviews', reviewId);
  const auditRef = doc(fs, 'rewardsEvents', reviewId); // deterministic id for idempotency

  // Daily cap pre-check (outside transaction)
  const pre = await getDoc(reviewRef);
  if (!pre.exists()) throw new Error('Review not found');
  const preData = pre.data() as any;
  if (await hasReachedDailyCap(fs, preData?.userId)) {
    const err: any = new Error('Daily verified limit reached');
    err.code = 'DAILY_CAP';
    throw err;
  }

  await runTransaction(fs, async (tx) => {
    const snap = await tx.get(reviewRef);
    if (!snap.exists()) throw new Error('Review not found');
    const data = snap.data() as any;
    const alreadyVerified = data?.verification?.state === 'verified';
    const pointsAwarded = data?.reward?.pointsAwarded;
    if (alreadyVerified && pointsAwarded) return; // idempotent

    tx.update(reviewRef, {
      'verification.state': 'verified',
      'verification.verifiedAt': serverTimestamp(),
      'verification.verifiedBy': verifiedBy,
      'reward.pointsAwarded': points,
      'reward.pointsAwardedAt': serverTimestamp(),
    } as any);

    const auditSnap = await tx.get(auditRef);
    if (!auditSnap.exists()) {
      tx.set(auditRef, {
        reviewId,
        userId: data?.userId || null,
        restaurantId: data?.restaurantId || null,
        points,
        method: 'admin',
        at: serverTimestamp(),
      });
    }
  });
}

export async function adminRejectReview(reviewId: string, reason: string, verifiedBy: string) {
  const fs = getFirestore();
  await updateDoc(doc(fs, 'reviews', reviewId), {
    'verification.state': 'rejected',
    'verification.verifiedAt': serverTimestamp(),
    'verification.verifiedBy': verifiedBy,
    'verification.notes': reason || 'Rejected',
  } as any);
}

async function hasReachedDailyCap(fs: ReturnType<typeof getFirestore>, userId?: string) {
  if (!userId || !DAILY_VERIFIED_CAP) return false;
  const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const qy = query(
    collection(fs, 'reviews'),
    where('userId', '==', userId),
    where('verification.state', '==', 'verified'),
    where('verification.verifiedAt', '>=', since)
  );
  const snap = await getDocs(qy);
  return snap.size >= DAILY_VERIFIED_CAP;
}
