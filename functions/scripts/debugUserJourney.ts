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

async function debugUserJourney() {
  console.log('🗺️ Debugging User Journey Map for user:', userId);
  console.log('');

  // Step 1: Get all user reviews
  const reviewsSnapshot = await db.collection('reviews')
    .where('userId', '==', userId)
    .where('isDeleted', '==', false)
    .get();

  console.log(`📊 Found ${reviewsSnapshot.size} active reviews for user\n`);

  // Step 2: Group by restaurant
  const restaurantGroups = new Map<string, any[]>();

  reviewsSnapshot.forEach(doc => {
    const data = doc.data();
    const restaurantKey = data.restaurantId || data.restaurant;
    if (!restaurantGroups.has(restaurantKey)) {
      restaurantGroups.set(restaurantKey, []);
    }
    restaurantGroups.get(restaurantKey)!.push({ id: doc.id, ...data });
  });

  console.log(`🏪 User has visited ${restaurantGroups.size} unique restaurants:\n`);

  // Step 3: For each restaurant, check location data
  for (const [restaurantKey, reviews] of restaurantGroups) {
    const firstReview = reviews[0];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Restaurant: ${firstReview.restaurant || 'Unknown'}`);
    console.log(`Restaurant ID: ${restaurantKey}`);
    console.log(`Review count: ${reviews.length}`);

    if (firstReview.restaurantId) {
      try {
        const restaurantDoc = await db.collection('restaurants').doc(firstReview.restaurantId).get();

        if (restaurantDoc.exists) {
          const data = restaurantDoc.data();
          console.log(`\n✅ Restaurant document found:`);
          console.log(`  Name: ${data?.name}`);
          console.log(`  Location (GeoPoint):`, data?.location);
          console.log(`  Coordinates:`, data?.coordinates);
          console.log(`  Visit Count: ${data?.visitCount}`);

          // Check what getUserVisitedRestaurants would extract
          let lat = 27.3364;
          let lng = -82.5307;

          if (data?.location?._latitude && data?.location?._longitude) {
            lat = data.location._latitude;
            lng = data.location._longitude;
            console.log(`  ✅ Would extract GeoPoint: { lat: ${lat}, lng: ${lng} }`);
          } else if (data?.coordinates?.lat && data?.coordinates?.lng) {
            lat = parseFloat(data.coordinates.lat);
            lng = parseFloat(data.coordinates.lng);
            console.log(`  ✅ Would extract coordinates.lat/lng: { lat: ${lat}, lng: ${lng} }`);
          } else {
            console.log(`  ❌ Would use DEFAULT coordinates (Sarasota center)`);
          }
        } else {
          console.log(`❌ Restaurant document NOT FOUND in Firestore`);
        }
      } catch (error) {
        console.error(`❌ Error fetching restaurant:`, error);
      }
    } else {
      console.log(`⚠️ No restaurantId in review - manual entry`);
    }
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

debugUserJourney().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
