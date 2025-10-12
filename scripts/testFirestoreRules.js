/* Minimal Firestore rules test (no framework)
   Verifies reviews create ALLOW with dishName, and DENY without dishName.

   Run: node tip/scripts/testFirestoreRules.js
*/

import fs from 'fs';
import path from 'path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const rulesPath = path.resolve(__dirname, '..', 'firestore.rules');
  const rules = await readFile(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-test',
    firestore: { rules }
  });

  try {
    const aliceCtx = testEnv.authenticatedContext('alice');
    const db = aliceCtx.firestore();

    const passDoc = db.collection('reviews').doc('ok1');
    const passPayload = {
      userId: 'alice',
      restaurantId: 'r1',
      dishName: 'Margherita Pizza',
      rating: 8.5,
      isDeleted: false,
      createdAt: new Date(), // emulator treats JS Date as timestamp
      updatedAt: new Date(),
    };

    const failDoc = db.collection('reviews').doc('bad1');
    const failPayload = {
      userId: 'alice',
      restaurantId: 'r1',
      // dishName intentionally missing
      rating: 8.5,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await assertSucceeds(passDoc.set(passPayload));
    await assertFails(failDoc.set(failPayload));

    console.log('Rules test passed: create ALLOW with dishName, DENY without.');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error('Rules test failed:', err);
  process.exit(1);
});

