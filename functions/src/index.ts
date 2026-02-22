import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all Cloud Functions
export { updateRestaurantCuisines } from './updateRestaurantCuisines';
export { updateRestaurantTags } from './updateRestaurantTags';
export { updateFollowerCounters, initializeFollowerCounters } from './counters';
export { backfillThumbnails, getThumbnailStats } from './backfillThumbnails';
export { onReviewWrite } from './onReviewWrite';
export { onReviewPendingProof } from './verifyReceipt';
export { onReviewUpdate } from './onReviewUpdate';
export { translateMenuItemToEs } from './translateMenuItemToEs';
