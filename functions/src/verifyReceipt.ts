import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { ReviewDoc, RestaurantDoc } from './types';

export const AUTO_VERIFY_THRESHOLD = 0.8;
const REWARD_POINTS = 50; // keep in sync with client config as needed

async function scoreReceipt(
  review: ReviewDoc,
  restaurant: RestaurantDoc | null
): Promise<{ matchScore: number; breakdown: { text: number; date: number; geo: number } }> {
  // TODO: Plug OCR/EXIF here. For now, return zeros.
  const text = 0.0; // e.g., fuzzy match restaurant name vs OCR text
  const date = 0.0; // e.g., receipt date proximity to createdAt
  const geo = 0.0; // e.g., EXIF geotag proximity to restaurant coords

  // Simple weighted sum stub
  const matchScore = (0.6 * text) + (0.25 * date) + (0.15 * geo);
  return { matchScore, breakdown: { text, date, geo } };
}

export const onReviewPendingProof = functions.firestore
  .document('reviews/{reviewId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as ReviewDoc | undefined;
    const after = change.after.data() as ReviewDoc | undefined;
    if (!after) return null;

    const prevState = before?.verification?.state;
    const nextState = after?.verification?.state;

    // Only run when transitioning into pending_proof
    if (nextState !== 'pending_proof' || prevState === 'pending_proof') {
      return null;
    }

    // Guard: if already final state, exit
    if (nextState === 'verified' || nextState === 'rejected') return null;

    const db = admin.firestore();
    const restaurant = after.restaurantId
      ? (await db.collection('restaurants').doc(after.restaurantId).get()).data() as RestaurantDoc | null
      : null;

    const { matchScore } = await scoreReceipt(after, restaurant);

    const reviewRef = db.collection('reviews').doc(context.params.reviewId);

    if (matchScore >= AUTO_VERIFY_THRESHOLD) {
      // Auto-approve server-side
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(reviewRef);
        if (!snap.exists) return;
        const current = snap.data() as any;
        if (current?.verification?.state === 'verified' || current?.verification?.state === 'rejected') return;
        tx.update(reviewRef, {
          'verification.state': 'verified',
          'verification.verifiedAt': admin.firestore.FieldValue.serverTimestamp(),
          'verification.verifiedBy': 'system',
          'verification.matchScore': matchScore,
          'reward.pointsAwarded': REWARD_POINTS,
          'reward.pointsAwardedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        const auditRef = db.collection('rewardsEvents').doc(context.params.reviewId);
        tx.set(auditRef, {
          reviewId: context.params.reviewId,
          userId: current?.userId || null,
          restaurantId: current?.restaurantId || null,
          points: REWARD_POINTS,
          method: 'auto',
          at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
    } else {
      // Move to pending_review with stored matchScore
      await reviewRef.set({
        verification: {
          state: 'pending_review',
          matchScore,
        }
      }, { merge: true });
    }

    return null;
  });

