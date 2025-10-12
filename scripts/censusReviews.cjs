/*
  Reviews Schema Census (read-only)

  Usage:
    node tip/scripts/censusReviews.js [--limit 2000]

  Auth:
    Requires Firebase Admin credentials. Set one of:
      - GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
      - Or run where default credentials are available (e.g., Cloud Shell)

  Behavior:
    - Samples up to N docs (default 2000) from the `reviews` collection using
      deterministic pagination by document ID.
    - Classifies each doc into buckets (V0, V1, V2) based on field presence/types.
    - Prints counts, example IDs, and additional stats.
    - No writes.
*/

const admin = require('firebase-admin');

function parseArgs(argv) {
  const out = { limit: 2000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit' && argv[i + 1]) {
      out.limit = Math.max(1, Math.min(20000, Number(argv[++i]) || 2000));
    }
  }
  return out;
}

function initAdmin() {
  if (admin.apps.length) return;
  try {
    admin.initializeApp();
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e);
    process.exit(1);
  }
}

function isTimestamp(v) {
  return !!v && typeof v === 'object' && v instanceof admin.firestore.Timestamp;
}

function classifyCreatedAt(v) {
  if (v === undefined) return 'missing';
  if (isTimestamp(v)) return 'Timestamp';
  if (typeof v === 'string') return 'string';
  return 'other';
}

function classifyLegacyTimestamp(v) {
  if (v === undefined) return 'missing';
  if (isTimestamp(v)) return 'Timestamp';
  if (typeof v === 'string') return 'string';
  return 'other';
}

function hasNestedFields(data) {
  const nestedKeys = ['media', 'facets', 'notes', 'stats'];
  return nestedKeys.some((k) => data && typeof data[k] === 'object' && data[k] !== null);
}

function determineVariant(data) {
  const createdAtType = classifyCreatedAt(data.createdAt);
  const hasIsDeletedBool = typeof data.isDeleted === 'boolean';
  const legacyTsType = classifyLegacyTimestamp(data.timestamp);
  const hasDishName = typeof data.dishName === 'string' && data.dishName.trim().length > 0;
  const hasMediaPhotos = Array.isArray(data?.media?.photos);
  const nested = hasNestedFields(data);

  const looksV0 = (legacyTsType === 'Timestamp' || legacyTsType === 'string' || createdAtType === 'string') && !hasIsDeletedBool;
  if (looksV0) return 'V0 legacy-flat';

  const looksV1 = hasDishName && createdAtType === 'string';
  if (looksV1) return 'V1 transitional';

  const looksV2 = createdAtType === 'Timestamp' && hasIsDeletedBool && (hasMediaPhotos || nested);
  if (looksV2) return 'V2 structured';

  return 'Unknown';
}

async function* iterateReviews(db, limit) {
  const col = db.collection('reviews');
  const order = col.orderBy(admin.firestore.FieldPath.documentId());
  let fetched = 0;
  let last = null;
  while (fetched < limit) {
    let q = order.limit(Math.min(1000, limit - fetched));
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return;
    for (const doc of snap.docs) {
      yield doc;
      fetched++;
      last = doc.id;
      if (fetched >= limit) return;
    }
  }
}

async function fetchDrunkenNoodles(db) {
  const outMap = new Map();
  const col = db.collection('reviews');
  const queries = [
    col.where('dishName', '==', 'Drunken Noodles').limit(20),
    col.where('dish', '==', 'Drunken Noodles').limit(20),
    col.where('dishName', '==', 'Drunken Noodles (Phat Khi Mao)').limit(20),
  ];
  for (const q of queries) {
    const snap = await q.get();
    for (const d of snap.docs) outMap.set(d.id, d);
  }
  // As a broader fallback, find by thai cuisine and then filter locally for name match
  try {
    const thaiSnap = await col.where('restaurantCuisines', 'array-contains', 'thai').limit(100).get();
    for (const d of thaiSnap.docs) {
      const data = d.data() || {};
      const name = String(data.dishName || data.dish || '').toLowerCase();
      if (name.includes('drunken noodles') || name.includes('phat khi mao')) {
        outMap.set(d.id, d);
      }
    }
  } catch (_) {
    // ignore if array-contains index not available
  }
  return Array.from(outMap.values());
}

function fieldType(v) {
  if (v === undefined) return 'missing';
  if (isTimestamp(v)) return 'Timestamp';
  return typeof v;
}

function summarizeDoc(d) {
  const data = d.data() || {};
  const createdAtT = classifyCreatedAt(data.createdAt);
  const legacyTsT = classifyLegacyTimestamp(data.timestamp);
  const variant = determineVariant(data);
  const mediaPhotos = Array.isArray(data?.media?.photos) ? data.media.photos.length : 0;
  return {
    id: d.id,
    createdAt: data.createdAt === undefined ? undefined : data.createdAt,
    createdAtType: createdAtT,
    updatedAtPresent: data.updatedAt !== undefined,
    legacyTimestampType: legacyTsT,
    isDeleted: typeof data.isDeleted === 'boolean' ? data.isDeleted : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    restaurantId: typeof data.restaurantId === 'string' ? data.restaurantId : undefined,
    dishName: typeof data.dishName === 'string' ? data.dishName : undefined,
    dishId: typeof data.dishId === 'string' ? data.dishId : undefined,
    dishCategory: typeof data.dishCategory === 'string' ? data.dishCategory : undefined,
    mediaPhotosCount: mediaPhotos,
    variant,
  };
}

async function replayQueries(db, docSummaries, opts = {}) {
  const results = [];
  for (const s of docSummaries) {
    const docRes = { id: s.id, checks: [] };
    // 1) Home feed: orderBy('createdAt','desc')
    try {
      const q1 = db.collection('reviews').orderBy('createdAt', 'desc').limit(1000);
      const snap1 = await q1.get();
      const found1 = snap1.docs.some(d => d.id === s.id);
      let reason1 = '';
      if (!found1) {
        if (!s.createdAtType || s.createdAtType === 'missing') reason1 = 'missing createdAt';
        else reason1 = 'not in top 1000 by createdAt';
      }
      docRes.checks.push({ query: "Home: orderBy('createdAt','desc')", appears: found1, reason: found1 ? undefined : reason1 });
    } catch (e) {
      docRes.checks.push({ query: "Home: orderBy('createdAt','desc')", appears: false, reason: `query failed: ${e.message || e}` });
    }

    // 2) Restaurant feed: where('restaurantId','==', theirs) orderBy('createdAt','desc')
    try {
      if (!s.restaurantId) {
        docRes.checks.push({ query: "Restaurant: where('restaurantId') + orderBy('createdAt')", appears: false, reason: 'missing restaurantId' });
      } else {
        let q2 = db.collection('reviews').where('restaurantId', '==', s.restaurantId).orderBy('createdAt', 'desc').limit(1000);
        let snap2;
        try {
          snap2 = await q2.get();
        } catch (e2) {
          // Fall back to no orderBy if index missing, sort client-side
          if (String(e2?.message || '').includes('failed-precondition') || String(e2?.code || '') === 'failed-precondition') {
            const snapNoOrder = await db.collection('reviews').where('restaurantId', '==', s.restaurantId).limit(1000).get();
            const foundNo = snapNoOrder.docs.some(d => d.id === s.id);
            docRes.checks.push({ query: "Restaurant: where('restaurantId') (no orderBy, fallback)", appears: foundNo, reason: foundNo ? undefined : 'not in first 1000 for restaurant' });
            // Skip normal path entry because fallback already logged
            snap2 = null;
          } else {
            throw e2;
          }
        }
        if (snap2) {
          const found2 = snap2.docs.some(d => d.id === s.id);
          let reason2 = '';
          if (!found2) {
            if (!s.createdAtType || s.createdAtType === 'missing') reason2 = 'missing createdAt';
            else reason2 = 'not in top 1000 by createdAt for restaurant';
          }
          docRes.checks.push({ query: "Restaurant: where('restaurantId') + orderBy('createdAt','desc')", appears: found2, reason: found2 ? undefined : reason2 });
        }
      }
    } catch (e) {
      docRes.checks.push({ query: "Restaurant: where('restaurantId') + orderBy('createdAt','desc')", appears: false, reason: `query failed: ${e.message || e}` });
    }

    // 3) User feed: where('userId','==', theirs) orderBy('createdAt','desc')
    try {
      if (!s.userId) {
        docRes.checks.push({ query: "User: where('userId') + orderBy('createdAt')", appears: false, reason: 'missing userId' });
      } else {
        let q3 = db.collection('reviews').where('userId', '==', s.userId).orderBy('createdAt', 'desc').limit(1000);
        let snap3;
        try {
          snap3 = await q3.get();
        } catch (e3) {
          if (String(e3?.message || '').includes('failed-precondition') || String(e3?.code || '') === 'failed-precondition') {
            const snapNoOrder = await db.collection('reviews').where('userId', '==', s.userId).limit(1000).get();
            const foundNo = snapNoOrder.docs.some(d => d.id === s.id);
            docRes.checks.push({ query: "User: where('userId') (no orderBy, fallback)", appears: foundNo, reason: foundNo ? undefined : 'not in first 1000 for user' });
            snap3 = null;
          } else {
            throw e3;
          }
        }
        if (snap3) {
          const found3 = snap3.docs.some(d => d.id === s.id);
          let reason3 = '';
          if (!found3) {
            if (!s.createdAtType || s.createdAtType === 'missing') reason3 = 'missing createdAt';
            else reason3 = 'not in top 1000 by createdAt for user';
          }
          docRes.checks.push({ query: "User: where('userId') + orderBy('createdAt','desc')", appears: found3, reason: found3 ? undefined : reason3 });
        }
      }
    } catch (e) {
      docRes.checks.push({ query: "User: where('userId') + orderBy('createdAt','desc')", appears: false, reason: `query failed: ${e.message || e}` });
    }

    results.push(docRes);
  }
  return results;
}

async function main() {
  const { limit } = parseArgs(process.argv);
  initAdmin();
  const db = admin.firestore();

  const counters = {
    variants: {
      'V0 legacy-flat': 0,
      'V1 transitional': 0,
      'V2 structured': 0,
      'Unknown': 0,
    },
    variantsCreatedAtString: {
      'V0 legacy-flat': 0,
      'V1 transitional': 0,
      'V2 structured': 0,
      'Unknown': 0,
    },
    variantsIsDeletedMissing: {
      'V0 legacy-flat': 0,
      'V1 transitional': 0,
      'V2 structured': 0,
      'Unknown': 0,
    },
    missingUserId: 0,
    missingRestaurantId: 0,
    fieldTotals: { haveUserId: 0, haveRestaurantId: 0, haveMenuItemId: 0, haveDishId: 0 },
    examples: {
      'V0 legacy-flat': [],
      'V1 transitional': [],
      'V2 structured': [],
      'Unknown': [],
    },
    createdAt: { Timestamp: 0, string: 0, missing: 0, other: 0 },
    isDeletedMissing: 0,
    total: 0,
  };

  console.log(`[census] Sampling up to ${limit} docs from reviews ...`);
  const sampledDocs = [];
  for await (const doc of iterateReviews(db, limit)) {
    const data = doc.data() || {};
    const createdAtType = classifyCreatedAt(data.createdAt);
    counters.createdAt[createdAtType] = (counters.createdAt[createdAtType] || 0) + 1;
    if (typeof data.isDeleted !== 'boolean') counters.isDeletedMissing++;

    const v = determineVariant(data);
    counters.variants[v] = (counters.variants[v] || 0) + 1;
    if (createdAtType === 'string') counters.variantsCreatedAtString[v] += 1;
    if (typeof data.isDeleted !== 'boolean') counters.variantsIsDeletedMissing[v] += 1;

    if (typeof data.userId === 'string') counters.fieldTotals.haveUserId += 1; else counters.missingUserId += 1;
    if (typeof data.restaurantId === 'string') counters.fieldTotals.haveRestaurantId += 1; else counters.missingRestaurantId += 1;
    if (typeof data.menuItemId === 'string') counters.fieldTotals.haveMenuItemId += 1;
    if (typeof data.dishId === 'string') counters.fieldTotals.haveDishId += 1;

    if (counters.examples[v].length < 5) counters.examples[v].push(doc.id);

    counters.total++;
    sampledDocs.push(doc);
  }

  // Drunken Noodles check
  const drunkenDocs = await fetchDrunkenNoodles(db);
  const drunkenResults = drunkenDocs.map((d) => {
    const data = d.data() || {};
    const variant = determineVariant(data);
    const createdAtType = classifyCreatedAt(data.createdAt);
    return { id: d.id, variant, createdAtType };
  });

  // Build rich summaries for A)
  const drunkenSummaries = drunkenDocs.map((d) => summarizeDoc(d));

  // Replay queries for B)
  const replay = await replayQueries(db, drunkenSummaries);

  // Output
  console.log('\n=== Reviews Schema Census ===');
  console.log(`Total sampled: ${counters.total}`);

  console.log('\n- Counts per variant:');
  for (const k of Object.keys(counters.variants)) {
    console.log(`  ${k}: ${counters.variants[k]}`);
  }

  console.log('\n- createdAt types:');
  for (const k of Object.keys(counters.createdAt)) {
    console.log(`  ${k}: ${counters.createdAt[k]}`);
  }

  console.log(`\n- Docs missing isDeleted: ${counters.isDeletedMissing}`);

  console.log('\n- Per-variant extras:');
  for (const k of Object.keys(counters.variants)) {
    console.log(`  ${k}: createdAt(string)=${counters.variantsCreatedAtString[k]}, isDeleted(missing)=${counters.variantsIsDeletedMissing[k]}`);
  }

  console.log('\n- Missing keys:');
  console.log(`  missing userId: ${counters.missingUserId}`);
  console.log(`  missing restaurantId: ${counters.missingRestaurantId}`);

  console.log('\n- Field presence totals (sample):');
  console.log(`  have userId: ${counters.fieldTotals.haveUserId}`);
  console.log(`  have restaurantId: ${counters.fieldTotals.haveRestaurantId}`);
  console.log(`  have menuItemId: ${counters.fieldTotals.haveMenuItemId}`);
  console.log(`  have dishId: ${counters.fieldTotals.haveDishId}`);

  console.log('\n- Example IDs per bucket (up to 5):');
  for (const k of Object.keys(counters.examples)) {
    console.log(`  ${k}: ${counters.examples[k].join(', ') || '(none)'}`);
  }

  console.log('\n- “Drunken Noodles” docs (variant and createdAt type):');
  if (drunkenResults.length === 0) {
    console.log('  None found by dishName or dish');
  } else {
    for (const r of drunkenResults) {
      const isV2 = r.variant === 'V2 structured';
      console.log(`  ${r.id}: variant=${r.variant} (isV2=${isV2}), createdAt=${r.createdAtType}`);
    }
  }

  // A) Full pin of the two docs
  if (drunkenSummaries.length > 0) {
    console.log('\n- Drunken Noodles pinned details:');
    for (const s of drunkenSummaries) {
      console.log(`  ${s.id}: variant=${s.variant}`);
      console.log(`    createdAt: ${s.createdAt ? JSON.stringify(s.createdAt) : 'missing'} (type=${s.createdAtType})`);
      console.log(`    updatedAt present: ${s.updatedAtPresent}`);
      console.log(`    legacy timestamp type: ${s.legacyTimestampType}`);
      console.log(`    isDeleted: ${s.isDeleted === undefined ? 'missing' : s.isDeleted}`);
      console.log(`    userId: ${s.userId || 'missing'}`);
      console.log(`    restaurantId: ${s.restaurantId || 'missing'}`);
      console.log(`    dishName: ${s.dishName || 'missing'}`);
      console.log(`    dishId: ${s.dishId || 'missing'}`);
      console.log(`    dishCategory: ${s.dishCategory || 'missing'}`);
      console.log(`    media.photos count: ${s.mediaPhotosCount}`);
    }
  }

  // B) Replay of app queries
  if (replay.length > 0) {
    console.log('\n- Replay against app query shapes:');
    for (const r of replay) {
      console.log(`  For doc ${r.id}:`);
      for (const c of r.checks) {
        console.log(`    ${c.query}: ${c.appears ? 'APPEARS' : 'MISSING'}${c.reason ? ` (${c.reason})` : ''}`);
      }
    }
  }

  // C) Recommendation line
  const legacyCount = counters.variants['V0 legacy-flat'] + counters.variants['V1 transitional'];
  const pctLegacy = counters.total > 0 ? Math.round((legacyCount / counters.total) * 100) : 0;
  const recommendation = pctLegacy <= 20 ? 'MIGRATE' : 'PURGE legacy';
  console.log(`\nRecommendation: ${recommendation} (${pctLegacy}% legacy = V0+V1)`);

  console.log('\n[census] Done.');
}

main().catch((err) => {
  console.error('Census failed:', err);
  process.exit(1);
});
