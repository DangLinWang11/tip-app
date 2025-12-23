import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function to maintain distributed follower/following counters
 *
 * Triggered when:
 * - A new follower document is created (users/{userId}/followers/{followerId})
 * - A follower document is deleted
 *
 * This function:
 * 1. Updates followerCount on the user being followed (users/{userId})
 * 2. Updates followingCount on the user who followed (users/{followerId})
 *
 * Benefits:
 * - O(1) reads for follower/following counts instead of O(n) collection queries
 * - Significantly reduces Firestore costs for profile pages
 * - Improves UI performance
 */
export const updateFollowerCounters = functions.firestore
  .document('users/{userId}/followers/{followerId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId; // User being followed
    const followerId = context.params.followerId; // User who followed

    const wasFollowing = change.before.exists;
    const isFollowing = change.after.exists;

    // Determine the change in follower count
    let followerDelta = 0;
    let followingDelta = 0;

    if (!wasFollowing && isFollowing) {
      // New follower
      followerDelta = 1;
      followingDelta = 1;
      console.log(`User ${followerId} started following ${userId}`);
    } else if (wasFollowing && !isFollowing) {
      // Unfollowed
      followerDelta = -1;
      followingDelta = -1;
      console.log(`User ${followerId} unfollowed ${userId}`);
    } else {
      // Document updated but following status unchanged
      console.log(`Follower document updated but no count change needed`);
      return null;
    }

    try {
      const batch = admin.firestore().batch();

      // Update follower count on the user being followed
      const userRef = admin.firestore().collection('users').doc(userId);
      batch.update(userRef, {
        followerCount: admin.firestore.FieldValue.increment(followerDelta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update following count on the user who followed
      const followerRef = admin.firestore().collection('users').doc(followerId);
      batch.update(followerRef, {
        followingCount: admin.firestore.FieldValue.increment(followingDelta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      console.log(`Successfully updated counters: ${userId} followerCount ${followerDelta > 0 ? '+' : ''}${followerDelta}, ${followerId} followingCount ${followingDelta > 0 ? '+' : ''}${followingDelta}`);

      return {
        userId,
        followerId,
        followerDelta,
        followingDelta
      };

    } catch (error) {
      console.error(`Error updating follower counters for ${userId} and ${followerId}:`, error);

      // Don't throw - we don't want to fail the follow operation if counter update fails
      // The counts can be manually recalculated if needed
      return null;
    }
  });

/**
 * Cloud Function to initialize follower/following counters for existing users
 *
 * This is a callable function that can be triggered manually to backfill counters
 * for users who were created before the counter system was implemented.
 *
 * Usage:
 * - Call from client: firebase.functions().httpsCallable('initializeFollowerCounters')({ userId: 'someUserId' })
 * - Or run for all users via admin script
 */
export const initializeFollowerCounters = functions.https.onCall(async (data, context) => {
  // Only allow authenticated users to initialize their own counters
  // Or allow admins to initialize any user's counters
  const requestingUserId = context.auth?.uid;
  const targetUserId = data.userId;

  if (!requestingUserId) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to initialize counters');
  }

  // For now, only allow users to initialize their own counters
  // You can add admin check here if needed
  if (requestingUserId !== targetUserId) {
    throw new functions.https.HttpsError('permission-denied', 'Can only initialize your own counters');
  }

  try {
    const userRef = admin.firestore().collection('users').doc(targetUserId);

    // Count followers
    const followersSnapshot = await admin.firestore()
      .collection('users')
      .doc(targetUserId)
      .collection('followers')
      .get();
    const followerCount = followersSnapshot.size;

    // Count following
    const followingSnapshot = await admin.firestore()
      .collection('users')
      .doc(targetUserId)
      .collection('following')
      .get();
    const followingCount = followingSnapshot.size;

    // Update user document
    await userRef.update({
      followerCount,
      followingCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Initialized counters for user ${targetUserId}: ${followerCount} followers, ${followingCount} following`);

    return {
      success: true,
      userId: targetUserId,
      followerCount,
      followingCount
    };

  } catch (error) {
    console.error(`Error initializing counters for user ${targetUserId}:`, error);
    throw new functions.https.HttpsError('internal', 'Failed to initialize counters');
  }
});
