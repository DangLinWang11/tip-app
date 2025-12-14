import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Simple script to fix the Ringling Grillroom review
 * Searches by the visitId we can see in the console logs
 */

export const fixRinglingGrillSimple = async () => {
  console.log('🔍 Fixing Ringling Grillroom review...\n');

  try {
    const googlePlaceId = 'ChIJ838yTWIVw4gR3Hd9Auqcdas';
    const visitId = 'visit_1765154486920_wml1brt65'; // From console logs

    // Find reviews by visitId
    console.log('Step 1: Finding reviews by visitId:', visitId);
    const reviewsByVisitIdQuery = query(
      collection(db, 'reviews'),
      where('visitId', '==', visitId)
    );
    const reviewsByVisitIdSnapshot = await getDocs(reviewsByVisitIdQuery);

    console.log(`Found ${reviewsByVisitIdSnapshot.docs.length} reviews with visitId\n`);

    if (reviewsByVisitIdSnapshot.empty) {
      console.log('❌ No reviews found with that visitId');
      return;
    }

    // Check if restaurant exists by Google Place ID
    console.log('Step 2: Finding restaurant by Google Place ID:', googlePlaceId);
    const restaurantQuery = query(
      collection(db, 'restaurants'),
      where('googlePlaceId', '==', googlePlaceId)
    );
    const restaurantSnapshot = await getDocs(restaurantQuery);

    let restaurantId: string;

    if (!restaurantSnapshot.empty) {
      restaurantId = restaurantSnapshot.docs[0].id;
      const restaurantData = restaurantSnapshot.docs[0].data();
      console.log('✅ Found existing restaurant:', {
        id: restaurantId,
        name: restaurantData.name
      });
    } else {
      console.log('❌ No restaurant found with that Google Place ID');
      console.log('Creating restaurant document...');

      // Create the restaurant
      const { addDoc, serverTimestamp } = await import('firebase/firestore');
      const newRestaurant = {
        name: 'The Ringling Grillroom',
        cuisines: ['American', 'Cafe'],
        location: {
          formatted: '5401 Bay Shore Rd, Sarasota, FL 34243'
        },
        address: '5401 Bay Shore Rd, Sarasota, FL 34243',
        phone: '(941) 359-5700',
        coordinates: {
          lat: 27.3764,
          lng: -82.5569,
          latitude: 27.3764,
          longitude: -82.5569
        },
        googlePlaceId: googlePlaceId,
        qualityScore: null,
        source: 'google_places',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const restaurantRef = await addDoc(collection(db, 'restaurants'), newRestaurant);
      restaurantId = restaurantRef.id;
      console.log('✅ Created restaurant with ID:', restaurantId);
    }

    // Update all reviews to use the Firebase restaurant ID
    console.log('\nStep 3: Updating reviews...');
    const updatePromises = reviewsByVisitIdSnapshot.docs.map(doc => {
      console.log(`  Updating review ${doc.id}`);
      return updateDoc(doc.ref, { restaurantId });
    });

    await Promise.all(updatePromises);

    console.log(`\n✅ SUCCESS! Updated ${reviewsByVisitIdSnapshot.docs.length} review(s)`);
    console.log(`✅ Restaurant ID: ${restaurantId}`);
    console.log(`✅ You can now navigate to: /restaurant/${restaurantId}`);

    return restaurantId;

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

// Make it available in the browser console
if (import.meta.env.DEV) {
  (window as any).fixRinglingGrillSimple = fixRinglingGrillSimple;
}
