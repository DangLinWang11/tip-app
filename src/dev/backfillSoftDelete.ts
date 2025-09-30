import { collection, documentId, getDocs, limit, orderBy, query, startAfter, writeBatch, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const runBackfillSoftDelete = async (batchSize = 1000): Promise<void> => {
  const reviewsRef = collection(db, 'reviews');
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;
  let totalScanned = 0;
  let totalUpdated = 0;

  while (true) {
    const batchQuery = lastDoc
      ? query(reviewsRef, orderBy(documentId()), startAfter(lastDoc), limit(batchSize))
      : query(reviewsRef, orderBy(documentId()), limit(batchSize));

    const snapshot = await getDocs(batchQuery);

    if (snapshot.empty) {
      break;
    }

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
    }
  }

  console.log('[runBackfillSoftDelete] Completed', { scanned: totalScanned, updated: totalUpdated });
};
