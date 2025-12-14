import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Debug script to investigate the Ringling Grill Room issue
 */

export const debugRinglingGrill = async () => {
  console.log('🔍 Debugging Ringling Grill Room...\n');

  try {
    // Step 1: Find all reviews
    console.log('Step 1: Finding reviews...');
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('restaurant', '==', 'The Ringling Grill Room')
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);

    console.log(`Found ${reviewsSnapshot.docs.length} reviews\n`);

    if (reviewsSnapshot.empty) {
      console.log('❌ No reviews found');
      return;
    }

    // Step 2: Check each review's data
    console.log('Step 2: Checking review data...');
    reviewsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\nReview ${index + 1}:`, {
        reviewId: doc.id,
        restaurantId: data.restaurantId || '❌ MISSING',
        restaurantName: data.restaurant,
        dish: data.dish || data.dishName,
        userId: data.userId,
        isDeleted: data.isDeleted,
        visibility: data.visibility
      });
    });

    // Step 3: Check all restaurants with similar names
    console.log('\n\nStep 3: Searching for restaurant documents...');
    const allRestaurantsQuery = query(collection(db, 'restaurants'));
    const allRestaurantsSnapshot = await getDocs(allRestaurantsQuery);

    const matchingRestaurants = allRestaurantsSnapshot.docs.filter(doc => {
      const name = doc.data().name?.toLowerCase() || '';
      return name.includes('ringling') || name.includes('grill');
    });

    console.log(`Found ${matchingRestaurants.length} matching restaurants:\n`);

    matchingRestaurants.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\nRestaurant ${index + 1}:`, {
        id: doc.id,
        name: data.name,
        googlePlaceId: data.googlePlaceId,
        address: data.location?.formatted || data.address,
        coordinates: data.coordinates,
        source: data.source
      });
    });

    // Step 4: Check if restaurantIds match
    console.log('\n\nStep 4: Checking if reviews are linked to restaurants...');

    const firstReview = reviewsSnapshot.docs[0].data();
    const reviewRestaurantId = firstReview.restaurantId;

    if (!reviewRestaurantId) {
      console.log('❌ Reviews have NO restaurantId - they need to be linked!');
      console.log('\n💡 Solution: We need to update the reviews to add the restaurantId');
    } else {
      const restaurantExists = matchingRestaurants.some(doc => doc.id === reviewRestaurantId);

      if (restaurantExists) {
        console.log('✅ Reviews are linked to a valid restaurant');
        console.log(`Restaurant ID: ${reviewRestaurantId}`);
        console.log(`\n🔗 The restaurant detail URL should be: /restaurant/${reviewRestaurantId}`);
      } else {
        console.log(`❌ Reviews point to restaurantId "${reviewRestaurantId}" but that restaurant doesn't exist!`);
        console.log('\n💡 Solution: We need to update the reviews to point to the correct restaurant');
      }
    }

    // Step 5: Return the data for fixing
    return {
      reviews: reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        restaurantId: doc.data().restaurantId,
        data: doc.data()
      })),
      restaurants: matchingRestaurants.map(doc => ({
        id: doc.id,
        data: doc.data()
      }))
    };

  } catch (error) {
    console.error('❌ Error debugging:', error);
    throw error;
  }
};

// Make it available in the browser console for development
if (import.meta.env.DEV) {
  (window as any).debugRinglingGrill = debugRinglingGrill;
}
