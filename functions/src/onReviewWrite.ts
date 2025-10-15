import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * MVP stub: on review write, update a lightweight restaurant_stats doc
 * Note: For production, switch to robust aggregation with tag maps and windows.
 */
export const onReviewWrite = functions.firestore
  .document('reviews/{reviewId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    const restaurantId = (after && after.restaurantId) || (before && before.restaurantId);
    if (!restaurantId) return null;

    try {
      const db = admin.firestore();
      const reviewsSnap = await db.collection('reviews')
        .where('restaurantId', '==', restaurantId)
        .where('isDeleted', '==', false)
        .get();

      let photoCount = 0;
      reviewsSnap.forEach(doc => {
        const r = doc.data();
        const imgs = Array.isArray(r?.media?.photos) ? r.media.photos : (Array.isArray(r?.images) ? r.images : []);
        if (imgs.length > 0) photoCount += imgs.length;
      });

      await db.collection('restaurant_stats').doc(restaurantId).set({
        reviewCount: reviewsSnap.size,
        photoCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('onReviewWrite stats update error', e);
    }
    return null;
  });

