/*
  normalizeReviews.cjs

  CommonJS Admin SDK script to normalize legacy reviews to v2 structure.

  Modes:
    --dry-run   Print planned changes; no writes
    --commit    Apply changes in batches (<= 400 per batch)

  Options:
    --startAfter <docId>   Resume pagination after a document ID
    --batch <n>            Max ops per batch (default 400)
    --pageSize <n>         Page size per Firestore read (default 1000)

  Transformations (when userId and restaurantId are present):
    - createdAt: string -> Timestamp (parse ISO)
    - createdAt: if missing but legacy `timestamp` exists (Timestamp or ISO string) -> set createdAt
    - isDeleted: if missing -> false
    - dishName: if missing and `dish` exists -> set dishName
    - images[] -> media.photos[] if media.photos missing
    - schemaVersion = 2
    - updatedAt = serverTimestamp() (always)

  If userId or restaurantId is missing:
    - set isDeleted = true
    - set normalizeError = "missing foreign key"
    - do not attempt other inference

  Output totals at end: changed, skipped, quarantined.
*/

const admin = require('firebase-admin');

function parseArgs(argv) {
  const out = {
    mode: 'dry-run',
    startAfter: null,
    batchSize: 400,
    pageSize: 1000,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.mode = 'dry-run';
    else if (a === '--commit') out.mode = 'commit';
    else if (a === '--startAfter' && argv[i + 1]) out.startAfter = String(argv[++i]);
    else if (a === '--batch' && argv[i + 1]) out.batchSize = Math.max(1, Math.min(400, Number(argv[++i]) || 400));
    else if (a === '--pageSize' && argv[i + 1]) out.pageSize = Math.max(1, Math.min(1000, Number(argv[++i]) || 1000));
  }
  return out;
}

function initAdmin() {
  if (!admin.apps.length) admin.initializeApp();
}

function isFsTimestamp(v) {
  return !!v && typeof v === 'object' && v instanceof admin.firestore.Timestamp;
}

function parseToTimestamp(v) {
  if (isFsTimestamp(v)) return v;
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return admin.firestore.Timestamp.fromDate(new Date(ms));
  }
  return null;
}

function stringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x)).filter((s) => s.length > 0);
}

async function* iterateDocs(db, pageSize, startAfterId) {
  const col = db.collection('reviews');
  let q = col.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
  if (startAfterId) q = q.startAfter(startAfterId);
  while (true) {
    const snap = await q.get();
    if (snap.empty) return;
    for (const d of snap.docs) yield d;
    const last = snap.docs[snap.docs.length - 1];
    q = col.orderBy(admin.firestore.FieldPath.documentId()).startAfter(last.id).limit(pageSize);
  }
}

function buildUpdates(data) {
  const updates = {};
  let quarantined = false;

  const hasUserId = typeof data.userId === 'string' && data.userId.trim().length > 0;
  const hasRestaurantId = typeof data.restaurantId === 'string' && data.restaurantId.trim().length > 0;

  if (!hasUserId || !hasRestaurantId) {
    quarantined = true;
    if (data.isDeleted !== true) updates.isDeleted = true;
    if (data.normalizeError !== 'missing foreign key') updates.normalizeError = 'missing foreign key';
    if (data.schemaVersion !== 2) updates.schemaVersion = 2;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    return { updates, quarantined };
  }

  // createdAt normalization
  if (typeof data.createdAt === 'string') {
    const ts = parseToTimestamp(data.createdAt);
    if (ts) updates.createdAt = ts; else updates.normalizeError = 'invalid createdAt string';
  } else if (data.createdAt === undefined || data.createdAt === null) {
    const t2 = parseToTimestamp(data.timestamp);
    if (t2) updates.createdAt = t2;
  }

  // isDeleted default
  if (typeof data.isDeleted !== 'boolean') updates.isDeleted = false;

  // dishName mapping
  if ((data.dishName === undefined || data.dishName === null || String(data.dishName).trim().length === 0)
      && typeof data.dish === 'string' && data.dish.trim().length > 0) {
    updates.dishName = data.dish;
  }

  // images -> media.photos (if media.photos missing)
  const photosMissing = !(data.media && Array.isArray(data.media.photos));
  if (photosMissing && Array.isArray(data.images)) {
    const photos = stringArray(data.images);
    if (photos.length > 0) updates['media.photos'] = photos;
  }

  // schema version
  if (data.schemaVersion !== 2) updates.schemaVersion = 2;

  // always touch updatedAt
  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  return { updates, quarantined };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!['dry-run', 'commit'].includes(args.mode)) {
    console.error('Specify --dry-run or --commit');
    process.exit(1);
  }
  initAdmin();
  const db = admin.firestore();

  let processed = 0;
  let changed = 0;
  let skipped = 0;
  let quarantined = 0;
  let batchOps = 0;
  let batch = db.batch();

  const flush = async (force = false) => {
    if (args.mode !== 'commit') return;
    if (batchOps === 0) return;
    if (!force && batchOps < args.batchSize) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  console.log('[normalize] start', { mode: args.mode, startAfter: args.startAfter, batchSize: args.batchSize, pageSize: args.pageSize });

  for await (const doc of iterateDocs(db, args.pageSize, args.startAfter)) {
    processed++;
    const data = doc.data() || {};
    const { updates, quarantined: q } = buildUpdates(data);
    const hasChanges = Object.keys(updates).length > 0;

    if (q) quarantined++;

    if (!hasChanges) {
      skipped++;
    } else if (args.mode === 'dry-run') {
      changed++;
      console.log(`[dry-run] ${doc.id} -> ${JSON.stringify(updates)}`);
    } else {
      batch.update(doc.ref, updates);
      batchOps++;
      changed++;
      if (batchOps >= args.batchSize) {
        await flush(true);
      }
    }

    if (processed % 200 === 0) {
      console.log(`[normalize] processed=${processed} changed=${changed} skipped=${skipped} quarantined=${quarantined}`);
    }
  }

  await flush(true);

  console.log('[normalize] done', { processed, changed, skipped, quarantined });
}

main().catch((e) => {
  console.error('Normalize failed:', e);
  process.exit(1);
});

