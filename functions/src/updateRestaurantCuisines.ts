import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { cleanCuisines } from './utils/profanityFilter';

/**
 * Cloud Function to automatically update restaurant cuisines based on reviews
 *
 * Triggered when:
 * - A new review is created
 * - An existing review is updated
 * - A review is deleted
 *
 * This function:
 * 1. Extracts the restaurantId from the review
 * 2. Queries all active (non-deleted) reviews for that restaurant
 * 3. Collects all cuisine tags from those reviews
 * 4. Filters out profanity and invalid terms
 * 5. Updates the restaurant document with the aggregated cuisines
 */
export const updateRestaurantCuisines = functions.firestore
  .document('reviews/{reviewId}')
  .onWrite(async (change, context) => {
    const reviewId = context.params.reviewId;

    // Get the review data (before and after)
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    // Extract restaurantId (use after if exists, otherwise before)
    const restaurantId = afterData?.restaurantId || beforeData?.restaurantId;

    if (!restaurantId) {
      console.log(`Review ${reviewId} has no restaurantId, skipping cuisine update`);
      return null;
    }

    console.log(`Updating cuisines for restaurant ${restaurantId} due to review ${reviewId} change`);

    try {
      // Get all reviews for this restaurant (non-deleted only)
      const reviewsSnapshot = await admin.firestore()
        .collection('reviews')
        .where('restaurantId', '==', restaurantId)
        .where('isDeleted', '==', false)
        .get();

      // Collect all cuisines from reviews
      const allCuisines: string[] = [];

      reviewsSnapshot.forEach(doc => {
        const reviewData = doc.data();

        // Check both restaurantCuisines and cuisines fields
        const cuisines = reviewData.restaurantCuisines || reviewData.cuisines || [];

        if (Array.isArray(cuisines)) {
          allCuisines.push(...cuisines);
        }
      });

      // Clean cuisines (remove profanity, validate, deduplicate, normalize)
      const cleanedCuisines = cleanCuisines(allCuisines);

      console.log(`Found ${allCuisines.length} total cuisine tags, cleaned to ${cleanedCuisines.length} valid cuisines`);

      // Count frequency of each cuisine
      const cuisineFrequency = new Map<string, number>();
      cleanedCuisines.forEach(cuisine => {
        cuisineFrequency.set(cuisine, (cuisineFrequency.get(cuisine) || 0) + 1);
      });

      // Get unique cuisines sorted by frequency (most common first)
      const sortedCuisines = Array.from(cuisineFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      // Update the restaurant document
      const restaurantRef = admin.firestore().collection('restaurants').doc(restaurantId);

      await restaurantRef.update({
        cuisines: sortedCuisines,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Successfully updated restaurant ${restaurantId} with cuisines:`, sortedCuisines);

      return {
        restaurantId,
        cuisineCount: sortedCuisines.length,
        cuisines: sortedCuisines
      };

    } catch (error) {
      console.error(`Error updating cuisines for restaurant ${restaurantId}:`, error);

      // Don't throw - we don't want to fail the review operation if cuisine update fails
      return null;
    }
  });
