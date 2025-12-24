import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tip-sarasotav2'
});

const db = admin.firestore();

async function checkReviews() {
  const reviewsSnapshot = await db.collection('reviews')
    .where('restaurantId', '==', 'ChIJIQ2iRxBAw4gRjUzOb2f_KIE')
    .get();

  console.log('📊 All Reviews for Jack Dusty:\n');

  reviewsSnapshot.forEach(doc => {
    const data = doc.data();
    const dishName = data.dish || data.dishName || 'Unknown';
    console.log(`ID: ${doc.id}`);
    console.log(`  Dish: ${dishName}`);
    console.log(`  Rating: ${data.rating}`);
    console.log(`  isDeleted: ${data.isDeleted || false}`);
    console.log(`  visitId: ${data.visitId || 'N/A'}`);
    console.log(`  userId: ${data.userId}`);
    console.log('');
  });

  console.log(`Total reviews found: ${reviewsSnapshot.size}`);
  const activeCount = reviewsSnapshot.docs.filter(d => d.data().isDeleted !== true).length;
  console.log(`Active (non-deleted): ${activeCount}`);
}

checkReviews().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
