import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all Cloud Functions
export { updateRestaurantCuisines } from './updateRestaurantCuisines';
export { onReviewWrite } from './onReviewWrite';
export { onReviewPendingProof } from './verifyReceipt';
