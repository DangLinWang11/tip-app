# Google Places Caching System - Implementation Checklist

## ✅ Phase 1: Setup (Completed)

- [x] Create `src/services/googlePlacesCache.ts` with:
  - [x] `fetchOrCacheRestaurant()` function
  - [x] `mapGoogleTypesToCuisine()` type mapping
  - [x] `isFreshCache()` staleness detection
  - [x] `triggerBackgroundRefresh()` non-blocking update
  - [x] `getCacheStats()` analytics
  - [x] `checkFirebaseCache()` lookup
  - [x] `transformGoogleDataToRestaurant()` data transformation

- [x] Create documentation:
  - [x] `README.md` - Overview and quick start
  - [x] `QUICK_REFERENCE.md` - Code snippets and examples
  - [x] `GOOGLE_PLACES_CACHE_INTEGRATION.md` - Full integration guide
  - [x] `FIREBASE_SETUP.md` - Database configuration

## 📋 Phase 2: Firebase Schema (TODO - 30 min)

- [ ] **Update existing restaurant documents:**
  - [ ] Add `source` field ('manual' for all existing restaurants)
  - [ ] Add `googlePlaceId` field (null for existing)
  - [ ] Add `googleDataLastSynced` field (null for existing)
  - [ ] Add `googlePhotoReference` field (null for existing)

  **Script to run:**
  ```typescript
  // In Firebase Console → Cloud Functions or local script
  import { db } from './lib/firebase';
  import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

  const snapshot = await getDocs(collection(db, 'restaurants'));
  snapshot.forEach(async (docSnap) => {
    const data = docSnap.data();
    if (data.source === undefined) {
      await updateDoc(doc(db, 'restaurants', docSnap.id), {
        source: 'manual',
        googlePlaceId: null,
        googleDataLastSynced: null,
        googlePhotoReference: null,
      });
    }
  });
  ```

- [ ] **Create Firestore composite index:**
  1. Go to [Firebase Console](https://console.firebase.google.com)
  2. Select your project
  3. Navigate to Firestore → Indexes → Composite Indexes
  4. Click "Create Index"
  5. Fill in:
     - Collection ID: `restaurants`
     - Field 1: `googlePlaceId` (Ascending)
     - Field 2: `googleDataLastSynced` (Descending)
  6. Click Create
  7. Wait for "READY" status (1-2 minutes)

- [ ] **Update Firestore security rules:**
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /restaurants/{restaurantId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update: if
          request.auth != null &&
          (request.auth.token.admin == true ||
           request.auth.uid == resource.data.createdBy);
      }
    }
  }
  ```

## 🔧 Phase 3: Integration with Components (TODO - 1-2 hours)

### Step A: Create Google Places API Wrapper
- [ ] **Create `src/lib/googlePlacesAPI.ts`**

  ```typescript
  export async function getGooglePlaceDetails(
    placeId: string
  ): Promise<GooglePlaceDetails | null> {
    try {
      const service = new google.maps.places.PlacesService(
        document.createElement('div')
      );

      return new Promise((resolve, reject) => {
        service.getDetails(
          {
            placeId,
            fields: [
              'name',
              'formatted_address',
              'formatted_phone_number',
              'types',
              'geometry',
              'photos',
              'rating',
            ],
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              resolve({
                name: place.name || '',
                place_id: placeId,
                formatted_address: place.formatted_address || '',
                formatted_phone_number: place.formatted_phone_number,
                types: place.types || [],
                geometry: place.geometry,
                photos: place.photos,
                rating: place.rating,
              });
            } else {
              reject(new Error(`Google Places API: ${status}`));
            }
          }
        );
      });
    } catch (error) {
      console.error('Google Places API error:', error);
      return null;
    }
  }
  ```

### Step B: Integrate with Step1Basic.tsx (Restaurant Search)
- [ ] **File:** `src/components/reviews/Step1Basic.tsx`
- [ ] **Find:** `handleGooglePlaceSelected()` function
- [ ] **Replace with:**

  ```typescript
  import { fetchOrCacheRestaurant } from '../../services/googlePlacesCache';
  import { getGooglePlaceDetails } from '../../lib/googlePlacesAPI';

  const handleGooglePlaceSelected = async (placeId: string, description: string) => {
    try {
      setFetchingPlaceDetails(true);

      // Use caching system
      const restaurant = await fetchOrCacheRestaurant(
        placeId,
        getGooglePlaceDetails
      );

      if (restaurant) {
        onRestaurantSelected(restaurant);
      } else {
        // Fallback: show manual creation
        setShowCreateRestaurant(true);
      }
    } catch (error) {
      console.error('Error selecting restaurant:', error);
      setRestaurantError('Failed to load restaurant. Please try again.');
    } finally {
      setFetchingPlaceDetails(false);
    }
  };
  ```

### Step C: Integrate with DiscoverList.tsx (Background Refresh)
- [ ] **File:** `src/pages/DiscoverList.tsx`
- [ ] **Find:** `fetchRestaurants()` function
- [ ] **Add:** Background refresh for stale restaurants

  ```typescript
  import {
    triggerBackgroundRefresh,
    isFreshCache
  } from '../services/googlePlacesCache';
  import { getGooglePlaceDetails } from '../lib/googlePlacesAPI';

  // After creating restaurant object:
  if (
    data.source === 'google_places' &&
    data.googlePlaceId &&
    !isFreshCache(data.googleDataLastSynced)
  ) {
    // Fire and forget - don't await
    triggerBackgroundRefresh(
      restaurantId,
      data.googlePlaceId,
      getGooglePlaceDetails
    ).catch(err => console.warn('Background refresh failed:', err));
  }
  ```

### Step D: Integrate with LocationPickerModal.tsx (Optional)
- [ ] **File:** `src/components/LocationPickerModal.tsx`
- [ ] **Find:** `handleGooglePlaceSelected()` or similar
- [ ] **Apply:** Same pattern as Step1Basic if using Google Places

## 🔄 Phase 4: Background Refresh (Optional but Recommended - 30 min)

### Option A: Cloud Functions (Production Recommended)
- [ ] **Create `functions/src/refreshGooglePlaces.ts`**

  ```typescript
  import * as functions from 'firebase-functions';
  import * as admin from 'firebase-admin';

  export const refreshStaleGooglePlaces = functions
    .region('us-central1')
    .pubsub.schedule('0 2 * * *') // Daily at 2 AM UTC
    .timeZone('UTC')
    .onRun(async (context) => {
      const db = admin.firestore();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const snapshot = await db
        .collection('restaurants')
        .where('source', '==', 'google_places')
        .where('googleDataLastSynced', '<',
          admin.firestore.Timestamp.fromDate(sevenDaysAgo))
        .limit(50)
        .get();

      // Refresh each restaurant from Google Places API
      let successCount = 0;
      for (const doc of snapshot.docs) {
        const restaurant = doc.data();
        try {
          const googleData = await getGooglePlaceDetails(restaurant.googlePlaceId);
          if (googleData) {
            await doc.ref.update({
              name: googleData.name,
              address: googleData.formatted_address,
              phone: googleData.formatted_phone_number || '',
              googleDataLastSynced: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to refresh ${restaurant.name}:`, error);
        }
      }

      console.log(`Refreshed ${successCount} restaurants`);
      return { success: true, refreshed: successCount };
    });
  ```

- [ ] **Deploy Cloud Function:**
  ```bash
  cd functions
  npm run deploy
  ```

### Option B: Client-side Refresh (Simpler, Less Reliable)
- [ ] **Add to DiscoverList.tsx or main app:**

  ```typescript
  useEffect(() => {
    const refreshTask = setInterval(async () => {
      const staleRestaurants = await getStaleRestaurants();
      for (const restaurant of staleRestaurants) {
        triggerBackgroundRefresh(
          restaurant.id,
          restaurant.googlePlaceId,
          getGooglePlaceDetails
        ).catch(err => console.warn('Refresh failed:', err));
      }
    }, 3600000); // Every hour

    return () => clearInterval(refreshTask);
  }, []);
  ```

## 📊 Phase 5: Monitoring (TODO - 30 min)

- [ ] **Add monitoring to main app:**
  ```typescript
  import { getCacheStats } from './services/googlePlacesCache';

  // On app startup or daily
  useEffect(() => {
    const monitor = async () => {
      const stats = await getCacheStats();
      console.log('Cache Stats:', stats);

      // Alert if hit rate low
      if (stats.cacheHitRate < 0.5) {
        console.warn('Cache hit rate below 50%!');
      }
    };

    monitor();
  }, []);
  ```

- [ ] **Set up Firebase monitoring:**
  - Go to [Google Cloud Console](https://console.cloud.google.com)
  - Select your project
  - Go to Monitoring → Dashboards
  - Create dashboard for:
    - Firestore read/write operations
    - API costs (Firestore + Google Places)
    - Document count

- [ ] **Create alerts:**
  - Alert if monthly cost exceeds $50
  - Alert if read operations increase 10x
  - Alert if document count decreases unexpectedly

## 🧪 Phase 6: Testing (TODO - 1 hour)

- [ ] **Test cache hit scenario:**
  1. Manually create restaurant with `source='google_places'` and recent `googleDataLastSynced`
  2. Call `fetchOrCacheRestaurant(placeId, mockGoogleFn)`
  3. Verify `mockGoogleFn` was NOT called
  4. Verify returned restaurant matches the created one

- [ ] **Test cache miss scenario:**
  1. Create restaurant with `source='google_places'` but old `googleDataLastSynced` (>7 days)
  2. Mock Google API to return updated data
  3. Call `fetchOrCacheRestaurant(placeId, mockGoogleFn)`
  4. Verify `mockGoogleFn` WAS called
  5. Verify restaurant was updated in Firebase

- [ ] **Test API failure fallback:**
  1. Create restaurant with stale data
  2. Mock Google API to fail
  3. Call `fetchOrCacheRestaurant(placeId, failingFn)`
  4. Verify function returns stale cache (not null)

- [ ] **Test new restaurant creation:**
  1. Google Place ID not in Firebase
  2. Call `fetchOrCacheRestaurant(placeId, mockGoogleFn)`
  3. Verify new restaurant created in Firebase
  4. Verify `source='google_places'` set

- [ ] **Test cuisine mapping:**
  ```typescript
  import { mapGoogleTypesToCuisine } from './services/googlePlacesCache';

  expect(mapGoogleTypesToCuisine(['italian_restaurant'])).toBe('italian');
  expect(mapGoogleTypesToCuisine(['mexican_restaurant', 'restaurant'])).toBe('mexican');
  expect(mapGoogleTypesToCuisine(['unknown_type'])).toBe('american');
  ```

## 📈 Phase 7: Analytics & Business Setup (TODO - 30 min)

- [ ] **Track restaurant engagement:**
  - Add `searchCount` field to restaurants
  - Increment on each search
  - Track impressions for partnerships

- [ ] **Generate partner reports:**
  ```typescript
  async function generateRestaurantReport(restaurantId: string) {
    const restaurant = await db.collection('restaurants').doc(restaurantId).get();
    return {
      name: restaurant.data().name,
      searches: restaurant.data().searchCount || 0,
      reviews: restaurant.data().reviewCount || 0,
      quality: restaurant.data().qualityPercentage || null,
      partner_pitch: `Your restaurant appeared in ${restaurant.data().searchCount} searches this month!`
    };
  }
  ```

## ✅ Phase 8: Production Deployment (TODO - 30 min)

- [ ] **Before deploying:**
  - [ ] Backup existing restaurants data
  - [ ] Test cache hit rate on staging
  - [ ] Verify API costs reduced
  - [ ] Monitor logs for errors

- [ ] **Deploy steps:**
  ```bash
  # 1. Run migration script
  npm run migrate-restaurants

  # 2. Create Firebase index (wait for READY)
  # (done manually in Firebase Console)

  # 3. Deploy code changes
  npm run build
  firebase deploy

  # 4. Monitor for issues
  firebase functions:log
  ```

- [ ] **Post-deployment:**
  - [ ] Monitor cache stats daily for 1 week
  - [ ] Verify cache hit rate trending toward 70%+
  - [ ] Check API costs (should be ~$100 for first month)
  - [ ] Test manual restaurant creation still works

## 📞 Support & Troubleshooting

### Common Issues

**"Index not found" error in logs**
- Solution: Create composite index in Firebase Console
- Link: `https://console.firebase.google.com/project/YOUR_PROJECT/firestore/indexes`

**Cache not updating**
- Check: Is `googleDataLastSynced` field being set?
- Test: Manually update one restaurant's `googleDataLastSynced` to old date
- Verify: Run background refresh and check if updated

**API cost not decreasing**
- Check: Cache hit rate (should see `[Cache HIT]` in logs)
- Verify: Is refresh happening? (should see `[Update]` in logs)
- Monitor: Are new restaurants still high? (normal, building initial cache)

**Firebase quota exceeded**
- Solution: Upgrade to Blaze plan (pay-as-you-go)
- Alternative: Reduce refresh frequency from weekly to bi-weekly

## 🎯 Success Metrics

By end of implementation, you should see:

- ✅ Cache hit rate: 70%+ (after 1 month)
- ✅ API cost: ~$20/month (down from $700+)
- ✅ Response time: Faster (Firebase cache < Google API)
- ✅ Zero broken restaurant data (graceful fallback)
- ✅ Analytics ready (searchCount tracking enabled)

---

## Timeline

- **Phase 1 (Setup):** ✅ Completed
- **Phase 2 (Firebase):** ~30 min
- **Phase 3 (Integration):** 1-2 hours
- **Phase 4 (Background):** 30 min (optional)
- **Phase 5 (Monitoring):** 30 min
- **Phase 6 (Testing):** 1 hour
- **Phase 7 (Analytics):** 30 min
- **Phase 8 (Deployment):** 30 min

**Total Time:** ~4-5 hours for full implementation

---

**Status:** Ready to implement (core service complete, documentation complete)
**Next Action:** Start with Phase 2 (Firebase schema updates)
