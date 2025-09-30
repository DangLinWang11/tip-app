import { collection, documentId, getDocs, limit, orderBy, query, startAfter, writeBatch, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DEFAULT_BATCH_SIZE = 200;

export interface BackfillSoftDeleteResult {
  scanned: number;
  updated: number;
  batches: number;
}

export const backfillSoftDelete = async (batchSize = DEFAULT_BATCH_SIZE): Promise<BackfillSoftDeleteResult> => {
  const reviewsRef = collection(db, 'reviews');
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;
  let totalScanned = 0;
  let totalUpdated = 0;
  let batches = 0;

  while (true) {
    const batchQuery = lastDoc
      ? query(reviewsRef, orderBy(documentId()), startAfter(lastDoc), limit(batchSize))
      : query(reviewsRef, orderBy(documentId()), limit(batchSize));

    const snapshot = await getDocs(batchQuery);

    if (snapshot.empty) {
      break;
    }

    batches += 1;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    const batch = writeBatch(db);
    let batchUpdates = 0;

    snapshot.forEach((docSnap) => {
      totalScanned += 1;
      const data = docSnap.data() as { isDeleted?: boolean | null };

      if (data.isDeleted === undefined || data.isDeleted === null) {
        batch.update(docSnap.ref, { isDeleted: false });
        batchUpdates += 1;
      }
    });

    if (batchUpdates > 0) {
      await batch.commit();
      totalUpdated += batchUpdates;
      console.log(`[BackfillSoftDelete] Batch ${batches}: updated ${batchUpdates} documents.`);
    } else {
      console.log(`[BackfillSoftDelete] Batch ${batches}: no updates needed.`);
    }
  }

  console.log(`[BackfillSoftDelete] Completed. Scanned ${totalScanned} documents across ${batches} batches. Updated ${totalUpdated} documents.`);

  return {
    scanned: totalScanned,
    updated: totalUpdated,
    batches
  };
};
