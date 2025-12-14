import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Script to check and fix the Ringling Grill Room restaurant
 * Run this from the browser console or as a one-time admin script
 */

export const checkAndFixRinglingGrill = async () => {
  console.log('🔍 Checking for Ringling Grill/Grillroom restaurant...');

  try {
    // Step 1: Check if reviews exist for Ringling Grill - search by restaurantId (Google Place ID)
    const googlePlaceId = 'ChIJ838yTWIVw4gR3Hd9Auqcdas';
    const reviewsByPlaceIdQuery = query(
      collection(db, 'reviews'),
      where('restaurantId', '==', googlePlaceId)
    );
    const reviewsByPlaceIdSnapshot = await getDocs(reviewsByPlaceIdQuery);

    // Also search by name variations
    const allReviewsQuery = query(collection(db, 'reviews'));
    const allReviewsSnapshot = await getDocs(allReviewsQuery);

    const ringlingReviews = allReviewsSnapshot.docs.filter(doc => {
      const data = doc.data();
      const restaurantName = (data.restaurant || '').toLowerCase();
      return restaurantName.includes('ringling') && (restaurantName.includes('grill') || restaurantName.includes('grillroom'));
    });

    console.log(`Found ${reviewsByPlaceIdSnapshot.docs.length} reviews with Google Place ID`);
    console.log(`Found ${ringlingReviews.length} reviews matching "Ringling Grill*"`);

    // Combine results
    const allRinglingReviewDocs = [
      ...reviewsByPlaceIdSnapshot.docs,
      ...ringlingReviews.filter(doc =>
        !reviewsByPlaceIdSnapshot.docs.some(d => d.id === doc.id)
      )
    ];

    if (allRinglingReviewDocs.length === 0) {
      console.log('❌ No reviews found for Ringling Grill');
      return;
    }

    console.log(`\nTotal unique reviews found: ${allRinglingReviewDocs.length}`);
    const reviewsSnapshot = { docs: allRinglingReviewDocs, empty: allRinglingReviewDocs.length === 0 };

    // Get the first review to check if it has a restaurantId
    const firstReview = reviewsSnapshot.docs[0];
    const reviewData = firstReview.data();

    console.log('📝 Review data:', {
      id: firstReview.id,
      restaurantId: reviewData.restaurantId,
      restaurant: reviewData.restaurant,
      location: reviewData.location
    });

    // Step 2: Check if the restaurant exists in the restaurants collection
    if (reviewData.restaurantId) {
      const restaurantDoc = await getDocs(
        query(collection(db, 'restaurants'), where('__name__', '==', reviewData.restaurantId))
      );

      if (!restaurantDoc.empty) {
        const restData = restaurantDoc.docs[0].data();
        console.log('✅ Restaurant exists:', {
          id: restaurantDoc.docs[0].id,
          name: restData.name,
          googlePlaceId: restData.googlePlaceId,
          coordinates: restData.coordinates,
          location: restData.location
        });
        return;
      } else {
        console.log('⚠️ Restaurant ID exists on review but restaurant document not found');
      }
    }

    // Step 3: Search for restaurant by Google Place ID first, then by name
    const restaurantsByPlaceIdQuery = query(
      collection(db, 'restaurants'),
      where('googlePlaceId', '==', googlePlaceId)
    );
    const restaurantsByPlaceIdSnapshot = await getDocs(restaurantsByPlaceIdQuery);

    if (!restaurantsByPlaceIdSnapshot.empty) {
      const existingRestaurant = restaurantsByPlaceIdSnapshot.docs[0];
      console.log('✅ Found restaurant by Google Place ID:', {
        id: existingRestaurant.id,
        data: existingRestaurant.data()
      });

      // Update all reviews to have this restaurantId
      console.log('🔧 Updating reviews to link to restaurant (replacing Google Place ID)...');
      const updatePromises = reviewsSnapshot.docs.map(doc =>
        updateDoc(doc.ref, { restaurantId: existingRestaurant.id })
      );
      await Promise.all(updatePromises);
      console.log(`✅ Updated ${reviewsSnapshot.docs.length} reviews to point to restaurant ID: ${existingRestaurant.id}`);

      return existingRestaurant.id;
    }

    // Search by name as fallback
    const allRestaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
    const matchingByName = allRestaurantsSnapshot.docs.filter(doc => {
      const name = (doc.data().name || '').toLowerCase();
      return name.includes('ringling') && (name.includes('grill') || name.includes('grillroom'));
    });

    if (matchingByName.length > 0) {
      const existingRestaurant = matchingByName[0];
      console.log('✅ Found restaurant by name:', {
        id: existingRestaurant.id,
        name: existingRestaurant.data().name,
        data: existingRestaurant.data()
      });

      // Update all reviews to have this restaurantId
      console.log('🔧 Updating reviews to link to restaurant...');
      const updatePromises = reviewsSnapshot.docs.map(doc =>
        updateDoc(doc.ref, { restaurantId: existingRestaurant.id })
      );
      await Promise.all(updatePromises);
      console.log(`✅ Updated ${reviewsSnapshot.docs.length} reviews`);

      return existingRestaurant.id;
    }

    // Step 4: Create the restaurant if it doesn't exist
    console.log('🏗️ Creating new restaurant for The Ringling Grill Room...');

    const newRestaurant = {
      name: 'The Ringling Grill Room',
      cuisines: ['American', 'Fine Dining'],
      location: {
        formatted: reviewData.location || '5401 Bay Shore Rd, Sarasota, FL 34243'
      },
      address: reviewData.location || '5401 Bay Shore Rd, Sarasota, FL 34243',
      phone: '(941) 360-7399',
      coordinates: {
        lat: 27.3764,
        lng: -82.5569,
        latitude: 27.3764,
        longitude: -82.5569
      },
      googlePlaceId: 'ChIJdUbxXgG_3YgRgGmN5cF7Qww', // Ringling Grill Room Google Place ID
      qualityScore: null,
      source: 'google_places',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      hours: {
        Monday: 'Closed',
        Tuesday: '11:00 AM – 3:00 PM',
        Wednesday: '11:00 AM – 3:00 PM',
        Thursday: '11:00 AM – 3:00 PM',
        Friday: '11:00 AM – 3:00 PM',
        Saturday: '11:00 AM – 3:00 PM',
        Sunday: '11:00 AM – 3:00 PM'
      },
      website: 'https://www.ringling.org/visit/museum-cafe',
      priceLevel: 2
    };

    const restaurantRef = await addDoc(collection(db, 'restaurants'), newRestaurant);
    console.log('✅ Created restaurant with ID:', restaurantRef.id);

    // Step 5: Update all reviews to link to the new restaurant
    console.log('🔧 Linking all reviews to new restaurant...');
    const updatePromises = reviewsSnapshot.docs.map(doc =>
      updateDoc(doc.ref, { restaurantId: restaurantRef.id })
    );
    await Promise.all(updatePromises);
    console.log('✅ All reviews linked to restaurant');

    return restaurantRef.id;

  } catch (error) {
    console.error('❌ Error checking/fixing Ringling Grill Room:', error);
    throw error;
  }
};
