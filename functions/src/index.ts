import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all Cloud Functions
export { updateRestaurantCuisines } from './updateRestaurantCuisines';
