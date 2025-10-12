import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Emergency utility to undelete all reviews marked as deleted.
 * This should be run from the browser console when reviews have been accidentally deleted.
 */
export const undeleteAllReviews = async (): Promise<void> => {
  console.log('[undeleteAllReviews] Starting...');

  const reviewsRef = collection(db, 'reviews');

  // Find all reviews where isDeleted is true
  const q = query(reviewsRef, where('isDeleted', '==', true));
  const snapshot = await getDocs(q);

  console.log(`[undeleteAllReviews] Found ${snapshot.size} deleted reviews`);

  if (snapshot.empty) {
    console.log('[undeleteAllReviews] No deleted reviews found');
    return;
  }

  // Update in batches of 500 (Firestore limit)
  const batchSize = 500;
  let updated = 0;

  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchDocs = snapshot.docs.slice(i, i + batchSize);

    batchDocs.forEach((doc) => {
      batch.update(doc.ref, { isDeleted: false });
    });

    await batch.commit();
    updated += batchDocs.length;
    console.log(`[undeleteAllReviews] Updated ${updated}/${snapshot.size} reviews`);
  }

  console.log(`[undeleteAllReviews] ✅ Successfully undeleted ${updated} reviews`);
};
