import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function to automatically update restaurant business tags based on reviews
 *
 * Triggered when:
 * - A new review is created
 * - An existing review is updated
 * - A review is deleted
 *
 * This function:
 * 1. Extracts the restaurantId from the review
 * 2. Queries all active (non-deleted) reviews for that restaurant
 * 3. Collects all businessTags from those reviews
 * 4. Counts frequency of each tag
 * 5. Updates the restaurant document with tagCounts map and topTags array (top 5)
 */
export const updateRestaurantTags = functions.firestore
  .document('reviews/{reviewId}')
  .onWrite(async (change, context) => {
    const reviewId = context.params.reviewId;

    // Get the review data (before and after)
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    // Extract restaurantId (use after if exists, otherwise before)
    const restaurantId = afterData?.restaurantId || beforeData?.restaurantId;

    if (!restaurantId) {
      console.log(`Review ${reviewId} has no restaurantId, skipping tag update`);
      return null;
    }

    console.log(`Updating tags for restaurant ${restaurantId} due to review ${reviewId} change`);

    try {
      // Get all reviews for this restaurant (non-deleted only)
      const reviewsSnapshot = await admin.firestore()
        .collection('reviews')
        .where('restaurantId', '==', restaurantId)
        .where('isDeleted', '==', false)
        .get();

      // Collect all business tags from reviews
      const tagCounts = new Map<string, number>();

      reviewsSnapshot.forEach(doc => {
        const reviewData = doc.data();
        const businessTags = reviewData.businessTags;

        if (Array.isArray(businessTags)) {
          businessTags.forEach((tag: string) => {
            if (tag && typeof tag === 'string') {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
          });
        }
      });

      console.log(`Found ${tagCounts.size} unique business tags across ${reviewsSnapshot.size} reviews`);

      // Convert Map to object for Firestore
      const tagCountsObject: Record<string, number> = {};
      tagCounts.forEach((count, tag) => {
        tagCountsObject[tag] = count;
      });

      // Get top 5 tags sorted by frequency
      const topTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);

      // Update the restaurant document
      const restaurantRef = admin.firestore().collection('restaurants').doc(restaurantId);

      await restaurantRef.update({
        tagCounts: tagCountsObject,
        topTags: topTags,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Successfully updated restaurant ${restaurantId} with ${topTags.length} top tags:`, topTags);

      return {
        restaurantId,
        tagCount: tagCounts.size,
        topTags
      };

    } catch (error) {
      console.error(`Error updating tags for restaurant ${restaurantId}:`, error);

      // Don't throw - we don't want to fail the review operation if tag update fails
      return null;
    }
  });
