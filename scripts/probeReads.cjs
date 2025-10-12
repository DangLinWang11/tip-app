/*
  Read-only E2E probes for v2 reads.

  Usage:
    node tip/scripts/probeReads.js

  Requires Admin SDK credentials via GOOGLE_APPLICATION_CREDENTIALS.
*/

const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp();
}

function isTimestamp(v) {
  return !!v && typeof v === 'object' && v instanceof admin.firestore.Timestamp;
}

function passFail(ok, reason) {
  return ok ? `PASS` : `FAIL (${reason})`;
}

async function fetchDrunkenNoodles(db) {
  const col = db.collection('reviews');
  const out = new Map();
  const queries = [
    col.where('dishName', '==', 'Drunken Noodles').limit(10),
    col.where('dish', '==', 'Drunken Noodles').limit(10),
    col.where('dishName', '==', 'Drunken Noodles (Phat Khi Mao)').limit(10),
  ];
  for (const q of queries) {
    const snap = await q.get();
    for (const d of snap.docs) out.set(d.id, d);
  }
  return Array.from(out.values());
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  // 0) Locate a DN doc
  const dn = await fetchDrunkenNoodles(db);
  const target = dn[0];
  if (!target) {
    console.log('No “Drunken Noodles” docs found. Skipping restaurant/user-specific probes.');
  }

  // 1) Home feed top 20
  try {
    const homeQ = db.collection('reviews').where('isDeleted', '==', false).orderBy('createdAt', 'desc').limit(20);
    const snap = await homeQ.get();
    let mismatch = '';
    for (const d of snap.docs) {
      const data = d.data();
      if (!isTimestamp(data.createdAt)) { mismatch = `createdAt not Timestamp for ${d.id}`; break; }
      if (data.isDeleted !== false) { mismatch = `isDeleted not false for ${d.id}`; break; }
    }
    console.log(`Home feed (20): ${passFail(!mismatch, mismatch || 'all OK')}`);
  } catch (e) {
    console.log(`Home feed (20): FAIL (${e.message || e})`);
  }

  // 2) Restaurant feed top 10 for DN's restaurant
  if (target) {
    const rId = target.get('restaurantId');
    if (typeof rId === 'string') {
      try {
        const rQ = db.collection('reviews')
          .where('restaurantId', '==', rId)
          .where('isDeleted', '==', false)
          .orderBy('createdAt', 'desc')
          .limit(10);
        const snap = await rQ.get();
        let mismatch = '';
        for (const d of snap.docs) {
          const data = d.data();
          if (!isTimestamp(data.createdAt)) { mismatch = `createdAt not Timestamp for ${d.id}`; break; }
          if (data.isDeleted !== false) { mismatch = `isDeleted not false for ${d.id}`; break; }
          if (data.restaurantId !== rId) { mismatch = `restaurantId mismatch for ${d.id}`; break; }
        }
        console.log(`Restaurant feed (10) for ${rId}: ${passFail(!mismatch, mismatch || 'all OK')}`);
      } catch (e) {
        console.log(`Restaurant feed (10) for ${rId}: FAIL (${e.message || e})`);
      }
    } else {
      console.log('Restaurant feed: FAIL (DN doc missing restaurantId)');
    }
  }

  // 3) User feed top 10 for DN's author
  if (target) {
    const uId = target.get('userId');
    if (typeof uId === 'string') {
      try {
        const uQ = db.collection('reviews')
          .where('userId', '==', uId)
          .where('isDeleted', '==', false)
          .orderBy('createdAt', 'desc')
          .limit(10);
        const snap = await uQ.get();
        let mismatch = '';
        for (const d of snap.docs) {
          const data = d.data();
          if (!isTimestamp(data.createdAt)) { mismatch = `createdAt not Timestamp for ${d.id}`; break; }
          if (data.isDeleted !== false) { mismatch = `isDeleted not false for ${d.id}`; break; }
          if (data.userId !== uId) { mismatch = `userId mismatch for ${d.id}`; break; }
        }
        console.log(`User feed (10) for ${uId}: ${passFail(!mismatch, mismatch || 'all OK')}`);
      } catch (e) {
        console.log(`User feed (10) for ${uId}: FAIL (${e.message || e})`);
      }
    } else {
      console.log('User feed: FAIL (DN doc missing userId)');
    }
  }

  // 4) Following feed for 3–5 userIds (latest authors)
  try {
    const latest = await db.collection('reviews').orderBy('createdAt', 'desc').limit(50).get();
    const uids = Array.from(new Set(latest.docs.map(d => d.get('userId')).filter(x => typeof x === 'string'))).slice(0, 5);
    if (uids.length === 0) {
      console.log('Following feed: FAIL (no candidate userIds)');
    } else {
      const fQ = db.collection('reviews')
        .where('userId', 'in', uids)
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(20);
      const snap = await fQ.get();
      let mismatch = '';
      for (const d of snap.docs) {
        const data = d.data();
        if (!isTimestamp(data.createdAt)) { mismatch = `createdAt not Timestamp for ${d.id}`; break; }
        if (data.isDeleted !== false) { mismatch = `isDeleted not false for ${d.id}`; break; }
        if (!uids.includes(data.userId)) { mismatch = `userId not in probe list for ${d.id}`; break; }
      }
      console.log(`Following feed (${uids.length} users): ${passFail(!mismatch, mismatch || 'all OK')}`);
    }
  } catch (e) {
    console.log(`Following feed: FAIL (${e.message || e})`);
  }
}

main().catch((e) => {
  console.error('Probe failed:', e);
  process.exit(1);
});

