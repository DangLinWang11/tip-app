/*
  Minimal index verification for reviews v2 queries.

  Usage:
    node tip/scripts/testIndexes.js

  Requires Admin SDK credentials via GOOGLE_APPLICATION_CREDENTIALS.
*/

const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp();
}

async function needIndex(promise) {
  try {
    await promise;
    return false;
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('FAILED_PRECONDITION') || msg.includes('failed-precondition')) return true;
    throw e;
  }
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  // Use dummy values; index requirement is evaluated regardless of match count
  const uid = 'TEST_USER_ID';
  const rid = 'TEST_RESTAURANT_ID';
  const mid = 'TEST_MENU_ID';
  const did = 'TEST_DISH_ID';

  const checks = [];

  // A) Home feed
  checks.push({
    name: "Home: isDeleted + createdAt",
    run: () => db.collection('reviews')
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1).get()
  });

  // B) User feed
  checks.push({
    name: "User: userId + isDeleted + createdAt",
    run: () => db.collection('reviews')
      .where('userId', '==', uid)
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1).get()
  });

  // C) Restaurant feed
  checks.push({
    name: "Restaurant: restaurantId + isDeleted + createdAt",
    run: () => db.collection('reviews')
      .where('restaurantId', '==', rid)
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1).get()
  });

  // D1) Menu path
  checks.push({
    name: "Menu: menuItemId + isDeleted + createdAt",
    run: () => db.collection('reviews')
      .where('menuItemId', '==', mid)
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1).get()
  });

  // D2) Dish path
  checks.push({
    name: "Dish: dishId + isDeleted + createdAt",
    run: () => db.collection('reviews')
      .where('dishId', '==', did)
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1).get()
  });

  // E) Following feed (IN)
  checks.push({
    name: "Following: userId IN + isDeleted + createdAt",
    run: () => db.collection('reviews')
      .where('userId', 'in', [uid])
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1).get()
  });

  const results = [];
  for (const c of checks) {
    const needs = await needIndex(c.run());
    results.push({ query: c.name, needsIndex: needs });
  }

  console.log('\nIndex check results:');
  for (const r of results) {
    console.log(`- ${r.query}: ${r.needsIndex ? 'NEEDS INDEX' : 'OK'}`);
  }
}

main().catch((e) => {
  console.error('Index test failed:', e);
  process.exit(1);
});

