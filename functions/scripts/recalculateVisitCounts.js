/**
 * One-time cleanup script to recalculate visit counts for all user-restaurant pairs.
 *
 * This script:
 * 1. Queries all reviews where isDeleted is not true
 * 2. Groups reviews by (userId, restaurantId) pairs
 * 3. Counts the number of reviews for each pair
 * 4. Updates the user_restaurant_visits collection with the correct counts
 *
 * Usage:
 *   node scripts/recalculateVisitCounts.js
 *
 * Optional: To recalculate for a specific restaurant only:
 *   node scripts/recalculateVisitCounts.js --restaurantId=YOUR_RESTAURANT_ID
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load service account key, fallback to default credentials
let credential;
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  // Use service account key if it exists
  const serviceAccount = require(serviceAccountPath);
  credential = admin.credential.cert(serviceAccount);
  console.log('✅ Using service account key for authentication\n');
} else {
  // Fallback to application default credentials
  console.log('⚠️  No service account key found. Using default credentials.');
  console.log('💡 To avoid authentication issues, download serviceAccountKey.json:');
  console.log('   https://console.firebase.google.com/project/tip-sarasotav2/settings/serviceaccounts/adminsdk\n');
  credential = admin.credential.applicationDefault();
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: credential,
  projectId: 'tip-sarasotav2'
});

const db = admin.firestore();

/**
 * Main function to recalculate all visit counts
 */
async function recalculateVisitCounts(targetRestaurantId = null) {
  try {
    console.log('🔄 Starting visit count recalculation...\n');

    // Build query for active reviews
    let reviewsQuery = db.collection('reviews');

    if (targetRestaurantId) {
      console.log(`🎯 Targeting specific restaurant: ${targetRestaurantId}\n`);
      reviewsQuery = reviewsQuery.where('restaurantId', '==', targetRestaurantId);
    }

    // Fetch all reviews where isDeleted is not true
    const reviewsSnapshot = await reviewsQuery.get();
    console.log(`📊 Found ${reviewsSnapshot.size} total reviews in collection`);

    // Filter out deleted reviews
    const activeReviews = [];
    reviewsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.isDeleted !== true) {
        activeReviews.push({
          id: doc.id,
          userId: data.userId,
          restaurantId: data.restaurantId,
          createdAt: data.createdAt
        });
      }
    });

    console.log(`✅ Found ${activeReviews.length} active reviews (non-deleted)\n`);

    // Group reviews by (userId, restaurantId) pairs
    const visitGroups = new Map();

    activeReviews.forEach((review) => {
      const key = `${review.userId}___${review.restaurantId}`;

      if (!visitGroups.has(key)) {
        visitGroups.set(key, {
          userId: review.userId,
          restaurantId: review.restaurantId,
          reviews: []
        });
      }

      visitGroups.get(key).reviews.push(review);
    });

    console.log(`👥 Found ${visitGroups.size} unique (user, restaurant) pairs\n`);

    // Update user_restaurant_visits collection
    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;

    for (const [key, group] of visitGroups) {
      try {
        const visitCount = group.reviews.length;

        // Find existing visit document
        const visitsQuery = db.collection('user_restaurant_visits')
          .where('userId', '==', group.userId)
          .where('restaurantId', '==', group.restaurantId)
          .limit(1);

        const visitsSnapshot = await visitsQuery.get();

        if (visitsSnapshot.empty) {
          // Create new visit document
          await db.collection('user_restaurant_visits').add({
            userId: group.userId,
            restaurantId: group.restaurantId,
            visitCount: visitCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          createdCount++;
          console.log(`✨ Created: userId=${group.userId.substring(0, 8)}..., restaurantId=${group.restaurantId.substring(0, 8)}..., count=${visitCount}`);
        } else {
          // Update existing visit document
          const visitDoc = visitsSnapshot.docs[0];
          const currentCount = visitDoc.data().visitCount;

          if (currentCount !== visitCount) {
            await visitDoc.ref.update({
              visitCount: visitCount,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            updatedCount++;
            console.log(`🔧 Updated: userId=${group.userId.substring(0, 8)}..., restaurantId=${group.restaurantId.substring(0, 8)}..., ${currentCount} -> ${visitCount}`);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${key}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 RECALCULATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`✨ Created: ${createdCount} new visit records`);
    console.log(`🔧 Updated: ${updatedCount} existing visit records`);
    console.log(`❌ Errors: ${errorCount} failed operations`);
    console.log(`✅ Total processed: ${visitGroups.size} user-restaurant pairs`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Fatal error during recalculation:', error);
    throw error;
  }
}

/**
 * Helper function to recalculate for a specific restaurant (e.g., "Jack Dusty")
 */
async function recalculateForRestaurant(restaurantName) {
  try {
    console.log(`🔍 Looking up restaurant: "${restaurantName}"...\n`);

    // Find restaurant by name
    const restaurantsQuery = db.collection('restaurants')
      .where('name', '==', restaurantName)
      .limit(1);

    const restaurantsSnapshot = await restaurantsQuery.get();

    if (restaurantsSnapshot.empty) {
      console.error(`❌ Restaurant "${restaurantName}" not found`);
      return;
    }

    const restaurantDoc = restaurantsSnapshot.docs[0];
    const restaurantId = restaurantDoc.id;

    console.log(`✅ Found restaurant: ${restaurantName} (ID: ${restaurantId})\n`);

    // Recalculate for this specific restaurant
    await recalculateVisitCounts(restaurantId);

  } catch (error) {
    console.error('❌ Error looking up restaurant:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const restaurantIdArg = args.find(arg => arg.startsWith('--restaurantId='));
const restaurantNameArg = args.find(arg => arg.startsWith('--restaurantName='));

// Run the script
(async () => {
  try {
    if (restaurantIdArg) {
      const restaurantId = restaurantIdArg.split('=')[1];
      await recalculateVisitCounts(restaurantId);
    } else if (restaurantNameArg) {
      const restaurantName = restaurantNameArg.split('=')[1];
      await recalculateForRestaurant(restaurantName);
    } else {
      // Recalculate all
      await recalculateVisitCounts();
    }

    console.log('✅ Script completed successfully\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
})();
