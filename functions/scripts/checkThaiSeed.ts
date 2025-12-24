import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tip-sarasotav2'
});

const db = admin.firestore();
const userId = 'JXA2n332f0RPzkvKLylqCGoG4TC2';
const restaurantId = '0Of1NFtNkPJoPQljb4iZ';

async function checkThaiSeed() {
  console.log('🔍 Checking Thai Seed reviews...\n');

  // Get all reviews for this restaurant
  const allReviewsSnapshot = await db.collection('reviews')
    .where('restaurantId', '==', restaurantId)
    .get();

  console.log(`Total reviews for Thai Seed: ${allReviewsSnapshot.size}\n`);

  allReviewsSnapshot.forEach(doc => {
    const data = doc.data();
    const dishName = data.dish || data.dishName || 'Unknown';
    console.log(`Review ID: ${doc.id}`);
    console.log(`  User: ${data.userId}`);
    console.log(`  Dish: ${dishName}`);
    console.log(`  Rating: ${data.rating}`);
    console.log(`  isDeleted: ${data.isDeleted || false}`);
    console.log(`  Images:`, data.images);
    console.log('');
  });

  // Now get user's reviews specifically
  console.log(`\nFetching reviews for user ${userId} at Thai Seed...\n`);

  const userReviewsSnapshot = await db.collection('reviews')
    .where('restaurantId', '==', restaurantId)
    .where('userId', '==', userId)
    .get();

  console.log(`User reviews found: ${userReviewsSnapshot.size}\n`);

  userReviewsSnapshot.forEach(doc => {
    const data = doc.data();
    const dishName = data.dish || data.dishName || 'Unknown';
    console.log(`✅ User Review ID: ${doc.id}`);
    console.log(`  Dish: ${dishName}`);
    console.log(`  Rating: ${data.rating}`);
    console.log(`  isDeleted: ${data.isDeleted || false}`);
    console.log(`  Images:`, data.images);
    console.log(`  Media:`, data.media);
    console.log('');
  });

  // Check with isDeleted filter
  const activeUserReviewsSnapshot = await db.collection('reviews')
    .where('restaurantId', '==', restaurantId)
    .where('userId', '==', userId)
    .where('isDeleted', '==', false)
    .get();

  console.log(`\nActive (non-deleted) user reviews: ${activeUserReviewsSnapshot.size}`);
}

checkThaiSeed().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
