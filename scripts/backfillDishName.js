/*
 One-time backfill: set dishName = dish on /reviews/* where dishName is missing and dish exists.

 Usage:
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
   node tip/scripts/backfillDishName.js [--project your-project-id] [--dry-run]

 Notes:
 - Idempotent: only updates docs missing dishName and having non-empty dish.
 - Reports counts and samples.
 */

import admin from 'firebase-admin';

const args = process.argv.slice(2);
const projectArg = args.find(a => a === '--project');
const projectId = projectArg ? args[args.indexOf('--project') + 1] : process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || undefined;
const dryRun = args.includes('--dry-run');

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();

  const reviewsRef = db.collection('reviews');
  const snapshot = await reviewsRef.select('dish', 'dishName').get();

  let toUpdate = [];
  snapshot.forEach(doc => {
    const data = doc.data() || {};
    const dishName = data.dishName;
    const dish = data.dish;
    if ((!dishName || typeof dishName !== 'string' || dishName.trim() === '') && typeof dish === 'string' && dish.trim() !== '') {
      toUpdate.push({ id: doc.id, dish });
    }
  });

  console.log(`Found ${toUpdate.length} reviews missing dishName but having dish`);
  console.log('Sample up to 10:', toUpdate.slice(0, 10));

  if (dryRun || toUpdate.length === 0) {
    console.log(dryRun ? '[DRY RUN] Skipping updates' : 'No updates needed');
    return;
  }

  let updated = 0;
  // Batch in chunks of 400 writes (safety below max batch size 500)
  const chunkSize = 400;
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach(item => {
      const ref = reviewsRef.doc(item.id);
      batch.update(ref, { dishName: item.dish });
    });
    await batch.commit();
    updated += chunk.length;
    console.log(`Updated ${updated}/${toUpdate.length} so far...`);
  }

  console.log(`Backfill complete: updated ${updated} reviews.`);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});

