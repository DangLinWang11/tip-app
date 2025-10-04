// src/dev/backfillCuisines.ts
import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeToken } from '../utils/taxonomy';

type Options = {
  dryRun?: boolean;              // default true: no writes, just logs
  includeReviewScan?: boolean;   // default true: merge cuisines seen in reviews
  batchSize?: number;            // default 400
  limitRestaurants?: number;     // optional limit for testing
};

export async function runBackfillCuisines(opts: Options = {}) {
  const {
    dryRun = true,
    includeReviewScan = true,
    batchSize = 400,
    limitRestaurants,
  } = opts;

  console.log('[backfillCuisines] start', { dryRun, includeReviewScan, batchSize, limitRestaurants });

  const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
  const allRestaurants = restaurantsSnap.docs.slice(0, limitRestaurants ?? restaurantsSnap.docs.length);

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  let batch = writeBatch(db);
  let opsInBatch = 0;

  const commitIfNeeded = async (force = false) => {
    if (dryRun) return; // never commit in dry-run
    if (force || opsInBatch >= batchSize) {
      await batch.commit();
      console.log(`[backfillCuisines] committed batch (${opsInBatch} updates)`);
      batch = writeBatch(db);
      opsInBatch = 0;
    }
  };

  for (const rDoc of allRestaurants) {
    const rData = rDoc.data() as any;

    // Gather candidates
    const out = new Set<string>();

    const single = normalizeToken(String(rData.cuisine ?? ''));
    if (single) out.add(single);

    const arr = Array.isArray(rData.cuisines) ? rData.cuisines : [];
    for (const c of arr) {
      const t = normalizeToken(String(c ?? ''));
      if (t) out.add(t);
    }

    // Optionally scan reviews for this restaurant
    if (includeReviewScan) {
      const revQ = query(
        collection(db, 'reviews'),
        where('restaurantId', '==', rDoc.id)
      );
      const revSnap = await getDocs(revQ);
      for (const rev of revSnap.docs) {
        const rd = rev.data() as any;
        const reviewCuisines: string[] = Array.isArray(rd.restaurantCuisines) ? rd.restaurantCuisines : [];
        for (const c of reviewCuisines) {
          const t = normalizeToken(String(c ?? ''));
          if (t) out.add(t);
        }
      }
    }

    // Final merged list
    const merged = Array.from(out).filter(Boolean);
    const existing = Array.isArray(rData.cuisines) ? rData.cuisines.map((x: any) => normalizeToken(String(x ?? ''))) : [];

    // If nothing to change, skip
    const equalLength = merged.length === existing.length;
    const sameSet =
      equalLength &&
      merged.every((x) => existing.includes(x));

    if (sameSet) {
      unchanged++;
      continue;
    }

    if (merged.length === 0) {
      // no useful data — skip
      skipped++;
      continue;
    }

    // Schedule update
    const ref = doc(db, 'restaurants', rDoc.id);
    if (dryRun) {
      console.log(`[backfillCuisines][dry] would update ${rDoc.id}`, { cuisines: merged });
    } else {
      batch.update(ref, {
        cuisines: merged,
        updatedAt: serverTimestamp(),
      });
      opsInBatch++;
      await commitIfNeeded(false);
    }
    updated++;
  }

  await commitIfNeeded(true);

  console.log('[backfillCuisines] done', { updated, unchanged, skipped, dryRun, includeReviewScan });
  return { updated, unchanged, skipped };
}
