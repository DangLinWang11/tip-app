import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tip-sarasotav2'
});

const db = admin.firestore();

async function checkIrmasTacos() {
  // First, find the restaurant
  const restaurantsSnapshot = await db.collection('restaurants')
    .where('name', '>=', 'Irma')
    .where('name', '<=', 'Irma\uf8ff')
    .get();

  console.log('🔍 Searching for Irma\'s Tacos...\n');

  if (restaurantsSnapshot.empty) {
    console.log('❌ No restaurants found matching "Irma"');
    return;
  }

  restaurantsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log('🏪 Restaurant Found:');
    console.log(`  ID: ${doc.id}`);
    console.log(`  Name: ${data.name}`);
    console.log(`  Address: ${data.address || 'N/A'}`);
    console.log(`  Location (GeoPoint): ${JSON.stringify(data.location)}`);
    console.log(`  Coordinates: ${JSON.stringify(data.coordinates)}`);
    console.log(`  Google Place ID: ${data.googlePlaceId || 'N/A'}`);
    console.log(`  Visit Count: ${data.visitCount || 0}`);
    console.log(`  Average Rating: ${data.averageRating || 'N/A'}`);
    console.log('');

    // Check if location is valid
    if (data.location && data.location._latitude !== undefined && data.location._longitude !== undefined) {
      console.log(`✅ Has valid GeoPoint: lat=${data.location._latitude}, lng=${data.location._longitude}`);
    } else {
      console.log('❌ INVALID LOCATION - Missing or malformed GeoPoint!');
      console.log('   This is why the pin doesn\'t show on the map!');
    }
    console.log('');
  });

  // Now check for reviews
  console.log('📊 Checking reviews for Irma\'s Tacos...\n');

  const allReviewsSnapshot = await db.collection('reviews').get();
  const irmasReviews: any[] = [];

  allReviewsSnapshot.forEach(doc => {
    const data = doc.data();
    const restaurantName = (data.restaurant || '').toLowerCase();
    if (restaurantName.includes('irma')) {
      irmasReviews.push({ id: doc.id, ...data });
    }
  });

  console.log(`Found ${irmasReviews.length} reviews mentioning "Irma":\n`);

  irmasReviews.forEach(review => {
    console.log(`Review ID: ${review.id}`);
    console.log(`  Restaurant: ${review.restaurant}`);
    console.log(`  Restaurant ID: ${review.restaurantId || 'N/A'}`);
    console.log(`  Dish: ${review.dish || review.dishName}`);
    console.log(`  Rating: ${review.rating}`);
    console.log(`  isDeleted: ${review.isDeleted || false}`);
    console.log('');
  });
}

checkIrmasTacos().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
