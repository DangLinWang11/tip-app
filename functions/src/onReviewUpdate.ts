import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function to handle "Ghost Visit" cleanup.
 *
 * When a review is soft-deleted (isDeleted: false -> true), this function:
 * 1. Detects the deletion by comparing before/after data
 * 2. Finds the corresponding user_restaurant_visits document
 * 3. Decrements the visit count to prevent "ghost visits"
 *
 * Note: The user_restaurant_visits collection stores aggregated visit counts
 * for each (userId, restaurantId) pair to optimize queries.
 */
export const onReviewUpdate = functions.firestore
  .document('reviews/{reviewId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if the review was just soft-deleted
    const wasDeleted = beforeData.isDeleted === false || beforeData.isDeleted === undefined;
    const isNowDeleted = afterData.isDeleted === true;

    if (!wasDeleted || !isNowDeleted) {
      // Not a deletion event, skip processing
      return null;
    }

    console.log(`🗑️ Review ${context.params.reviewId} was deleted. Processing ghost visit cleanup...`);

    const userId = afterData.userId || beforeData.userId;
    const restaurantId = afterData.restaurantId || beforeData.restaurantId;

    if (!userId || !restaurantId) {
      console.warn('⚠️ Missing userId or restaurantId in deleted review. Cannot update visit count.');
      return null;
    }

    try {
      const db = admin.firestore();

      // Find the user_restaurant_visits document for this user-restaurant pair
      const visitsQuery = db.collection('user_restaurant_visits')
        .where('userId', '==', userId)
        .where('restaurantId', '==', restaurantId)
        .limit(1);

      const visitsSnapshot = await visitsQuery.get();

      if (visitsSnapshot.empty) {
        console.warn(`⚠️ No user_restaurant_visits document found for userId=${userId}, restaurantId=${restaurantId}`);
        console.log('This may be expected if the visit count has not been initialized yet.');
        return null;
      }

      // Get the first (and should be only) matching document
      const visitDoc = visitsSnapshot.docs[0];
      const visitDocRef = db.collection('user_restaurant_visits').doc(visitDoc.id);

      // Decrement the visit count
      await visitDocRef.update({
        visitCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Successfully decremented visit count for userId=${userId}, restaurantId=${restaurantId}`);
      console.log(`   Document ID: ${visitDoc.id}`);

    } catch (error) {
      console.error('❌ Error updating visit count:', error);
      // Don't throw - we don't want to crash the function and trigger retries
      // The visit count will be slightly inaccurate but won't break the system
    }

    return null;
  });
