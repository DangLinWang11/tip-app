/**
 * One-time cleanup script to recalculate global restaurant statistics.
 *
 * This script fixes map inaccuracies by:
 * 1. Fetching all reviews where isDeleted != true
 * 2. Grouping them by restaurantId
 * 3. Calculating visitCount and averageRating for each restaurant
 * 4. Overwriting the corresponding restaurants/{id} document with correct stats
 *
 * Usage:
 *   npx ts-node scripts/recalculateStats.ts
 *
 * Optional: To recalculate for a specific restaurant only:
 *   npx ts-node scripts/recalculateStats.ts --restaurantId=YOUR_RESTAURANT_ID
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Try to load service account key, fallback to default credentials
let credential: admin.credential.Credential;
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

interface ReviewData {
  id: string;
  restaurantId: string;
  rating: number;
  userId: string;
  isDeleted?: boolean;
}

interface RestaurantStats {
  restaurantId: string;
  visitCount: number;
  totalRating: number;
  averageRating: number;
  reviewCount: number;
}

/**
 * Main function to recalculate all restaurant statistics
 */
async function recalculateStats(targetRestaurantId: string | null = null): Promise<void> {
  try {
    console.log('🔄 Starting restaurant statistics recalculation...\n');

    // Build query for reviews
    let reviewsQuery: admin.firestore.Query = db.collection('reviews');

    if (targetRestaurantId) {
      console.log(`🎯 Targeting specific restaurant: ${targetRestaurantId}\n`);
      reviewsQuery = reviewsQuery.where('restaurantId', '==', targetRestaurantId);
    }

    // Fetch all reviews
    const reviewsSnapshot = await reviewsQuery.get();
    console.log(`📊 Found ${reviewsSnapshot.size} total reviews in collection`);

    // Filter out deleted reviews and collect active ones
    const activeReviews: ReviewData[] = [];
    reviewsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.isDeleted !== true) {
        activeReviews.push({
          id: doc.id,
          restaurantId: data.restaurantId,
          rating: data.rating || 0,
          userId: data.userId,
          isDeleted: data.isDeleted
        });
      }
    });

    console.log(`✅ Found ${activeReviews.length} active reviews (non-deleted)\n`);

    // Group reviews by restaurantId and calculate stats
    const restaurantStatsMap = new Map<string, RestaurantStats>();

    activeReviews.forEach((review) => {
      if (!review.restaurantId) {
        console.warn(`⚠️  Review ${review.id} has no restaurantId, skipping`);
        return;
      }

      if (!restaurantStatsMap.has(review.restaurantId)) {
        restaurantStatsMap.set(review.restaurantId, {
          restaurantId: review.restaurantId,
          visitCount: 0,
          totalRating: 0,
          averageRating: 0,
          reviewCount: 0
        });
      }

      const stats = restaurantStatsMap.get(review.restaurantId)!;
      stats.reviewCount += 1;
      stats.totalRating += review.rating;
      // Visit count will be calculated from unique user-restaurant pairs
    });

    // Calculate visit counts (unique userId per restaurant)
    const restaurantVisitsMap = new Map<string, Set<string>>();
    activeReviews.forEach((review) => {
      if (!review.restaurantId || !review.userId) return;

      if (!restaurantVisitsMap.has(review.restaurantId)) {
        restaurantVisitsMap.set(review.restaurantId, new Set());
      }
      restaurantVisitsMap.get(review.restaurantId)!.add(review.userId);
    });

    // Update stats with visit counts and calculate averages
    restaurantStatsMap.forEach((stats, restaurantId) => {
      const uniqueUsers = restaurantVisitsMap.get(restaurantId);
      stats.visitCount = uniqueUsers ? uniqueUsers.size : 0;
      stats.averageRating = stats.reviewCount > 0
        ? Number((stats.totalRating / stats.reviewCount).toFixed(2))
        : 0;
    });

    console.log(`🏪 Found ${restaurantStatsMap.size} unique restaurants\n`);

    // Update restaurant documents with calculated stats
    let updatedCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    for (const [restaurantId, stats] of restaurantStatsMap) {
      try {
        const restaurantRef = db.collection('restaurants').doc(restaurantId);
        const restaurantDoc = await restaurantRef.get();

        if (!restaurantDoc.exists) {
          notFoundCount++;
          console.warn(`⚠️  Restaurant ${restaurantId} not found in restaurants collection`);
          continue;
        }

        const currentData = restaurantDoc.data();
        const currentVisitCount = currentData?.visitCount || 0;
        const currentAvgRating = currentData?.averageRating || 0;

        // Update the restaurant document with new stats
        await restaurantRef.update({
          visitCount: stats.visitCount,
          averageRating: stats.averageRating,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        updatedCount++;
        const restaurantName = currentData?.name || 'Unknown';
        console.log(
          `🔧 Updated: ${restaurantName.substring(0, 30)} | ` +
          `Visits: ${currentVisitCount} -> ${stats.visitCount} | ` +
          `Rating: ${currentAvgRating} -> ${stats.averageRating}`
        );

      } catch (error: any) {
        errorCount++;
        console.error(`❌ Error updating restaurant ${restaurantId}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 RECALCULATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`🔧 Updated: ${updatedCount} restaurant records`);
    console.log(`⚠️  Not Found: ${notFoundCount} restaurants missing from collection`);
    console.log(`❌ Errors: ${errorCount} failed operations`);
    console.log(`✅ Total processed: ${restaurantStatsMap.size} restaurants`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Fatal error during recalculation:', error);
    throw error;
  }
}

/**
 * Helper function to recalculate for a specific restaurant by name
 */
async function recalculateForRestaurantByName(restaurantName: string): Promise<void> {
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
    await recalculateStats(restaurantId);

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
      await recalculateStats(restaurantId);
    } else if (restaurantNameArg) {
      const restaurantName = restaurantNameArg.split('=')[1];
      await recalculateForRestaurantByName(restaurantName);
    } else {
      // Recalculate all
      await recalculateStats();
    }

    console.log('✅ Script completed successfully\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
})();
