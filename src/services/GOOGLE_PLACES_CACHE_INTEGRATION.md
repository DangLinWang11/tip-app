# Google Places Hybrid Caching System - Integration Guide

## Overview

This system reduces Google Places API costs by 90%+ by caching restaurant data in Firebase and refreshing weekly. It also enables restaurant analytics and partnership opportunities.

## Architecture

```
User selects restaurant from Google Places
    ↓
fetchOrCacheRestaurant(placeId)
    ↓
    ├─ Check Firebase for existing restaurant with this googlePlaceId
    │  (using index on googlePlaceId)
    │
    ├─ If found & data < 7 days old → Return cached version [COST: $0]
    │
    └─ If stale or not found → Fetch from Google Places API [COST: ~$0.07]
        ├─ Transform Google data to our schema
        ├─ Save/update in Firebase
        └─ Return restaurant data

Periodic background job (weekly):
    └─ For each restaurant in Firebase with source='google_places'
        ├─ Check if googleDataLastSynced > 7 days
        ├─ If yes → triggerBackgroundRefresh()
        └─ Update in Firebase silently
```

## Cost Impact

| Phase | Cost | Explanation |
|-------|------|-------------|
| **Month 1** | ~$300 | Building cache (~1000 new restaurants) |
| **Month 2** | ~$20 | Only new restaurants + weekly refreshes (~250 API calls) |
| **Month 3+** | ~$20 | Steady state, mostly cache hits |

**Total savings after 6 months: ~$1,600**

## Implementation Steps

### Step 1: Update Restaurant Schema in Firebase

Add these fields to all restaurant documents:

```typescript
{
  // Existing fields
  id: string;
  name: string;
  address: string;
  cuisine: string;
  coordinates: { lat, lng };

  // NEW CACHE FIELDS
  source: 'manual' | 'google_places';  // Where restaurant came from
  googlePlaceId?: string | null;        // Google's unique identifier
  googleDataLastSynced?: Timestamp;     // When we last fetched from Google
  googlePhotoReference?: string | null; // Reference for getting Google photos
}
```

### Step 2: Create Firebase Composite Index

**Path:** Firestore Console → Indexes → Create Composite Index

```
Collection: restaurants
Indexes:
  - googlePlaceId (Ascending)
  - googleDataLastSynced (Descending)
```

This enables efficient queries for:
- Finding restaurants by Google Place ID
- Finding restaurants that need refreshing (stale cache)

### Step 3: Integrate with Step1Basic.tsx (Restaurant Search)

**Location:** `src/components/reviews/Step1Basic.tsx`

When user selects a restaurant from Google Places autocomplete:

```typescript
// BEFORE: Direct creation (loses Google data)
const newRestaurant = {
  name: place.name,
  coordinates: { lat, lng },
  // ... other fields
};
selectRestaurant(newRestaurant);

// AFTER: Use caching system
import { fetchOrCacheRestaurant } from '../../services/googlePlacesCache';

// In handleGooglePlaceSelected():
const restaurant = await fetchOrCacheRestaurant(
  placeId,
  async (placeId) => {
    // Implement this function using Google Places API client
    return await getGooglePlaceDetails(placeId);
  }
);

if (restaurant) {
  selectRestaurant(restaurant);
} else {
  // Fallback: show error or allow manual creation
  setShowCreateRestaurant(true);
}
```

### Step 4: Integrate with DiscoverList.tsx (Background Refresh)

**Location:** `src/pages/DiscoverList.tsx`

In the restaurant loading logic:

```typescript
import {
  triggerBackgroundRefresh,
  isFreshCache
} from '../services/googlePlacesCache';

// In fetchRestaurants():
const restaurantList = restaurantSnapshot.docs.map((docSnap) => {
  const data = docSnap.data() as FirebaseRestaurant;
  const restaurant = { id: docSnap.id, ...data };

  // Non-blocking background refresh if stale
  if (
    data.source === 'google_places' &&
    data.googlePlaceId &&
    !isFreshCache(data.googleDataLastSynced)
  ) {
    // Fire and forget - don't await
    triggerBackgroundRefresh(
      docSnap.id,
      data.googlePlaceId,
      async (placeId) => {
        return await getGooglePlaceDetails(placeId);
      }
    ).catch(err => console.warn('Background refresh failed:', err));
  }

  return restaurant;
});
```

### Step 5: Implement getGooglePlaceDetails()

Create a wrapper around Google Places API:

```typescript
// src/lib/googlePlacesAPI.ts
import { PlacesService } from '@react-google-maps/api';

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
            'reviews',
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
              reviews: place.reviews,
            });
          } else {
            reject(new Error(`Google Places API error: ${status}`));
          }
        }
      );
    });
  } catch (error) {
    console.error('Error fetching Google Place details:', error);
    return null;
  }
}
```

## Error Handling & Fallbacks

### Scenario 1: Google API Fails, Fresh Cache Exists
```
User action → Google API timeout
  ↓
fetchOrCacheRestaurant() catches error
  ↓
Found fresh cache in Firebase
  ↓
✅ Serve cached data (user doesn't notice API failure)
```

### Scenario 2: Google API Fails, Only Stale Cache Exists
```
User action → Google API fails
  ↓
fetchOrCacheRestaurant() catches error
  ↓
Found stale cache (>7 days old)
  ↓
✅ Serve stale cache with warning log
✅ User experience not broken
```

### Scenario 3: Google API Fails, No Cache
```
User action → Google API fails
  ↓
fetchOrCacheRestaurant() catches error
  ↓
No cache found
  ↓
❌ Return null
  ↓
Fallback to manual restaurant creation
```

### Scenario 4: Google Quota Exceeded
```
Handle 403 Forbidden status
  ↓
Check if cache exists
  ↓
If yes → serve cache
If no → show error message, suggest manual creation
```

## Monitoring & Analytics

### Cache Metrics to Track

```typescript
// Use this in monitoring dashboard
const stats = await getCacheStats();

{
  totalRestaurants: 1200,      // Total restaurants in database
  googleSourceCount: 950,      // Created from Google Places
  manualSourceCount: 250,      // Manually created
  cacheHitRate: 0.79,         // 79% of requests served from cache
}
```

### Cost Tracking

```typescript
// Each API call costs ~$0.07 per Details request
// Weekly refresh: ~(googleSourceCount / 52) calls

Weekly API cost = (950 / 52) * $0.07 = ~$1.28
Monthly API cost = $1.28 * 4.3 = ~$5.50

vs. Old system without cache:
Monthly API cost = 10,000 calls * $0.07 = $700
```

## Firebase Index Specification

**Important:** Create this index in Firebase Console for optimal performance

```yaml
Collection: restaurants
Index Name: googlePlaceId-googleDataLastSynced

Fields:
  - Field Path: googlePlaceId
    Direction: Ascending
  - Field Path: googleDataLastSynced
    Direction: Descending
```

**Link to Firebase Console:**
```
https://console.firebase.google.com/project/[PROJECT_ID]/firestore/indexes
```

## Testing

### Test Cache Hit
```typescript
// 1. Manually create restaurant with googlePlaceId and recent googleDataLastSynced
// 2. Call fetchOrCacheRestaurant(placeId, googleDetailsFn)
// 3. Verify googleDetailsFn was NOT called (cache hit)
// 4. Check logs for "[Cache HIT]" message
```

### Test Cache Miss & Refresh
```typescript
// 1. Create restaurant with googlePlaceId but old googleDataLastSynced (>7 days)
// 2. Call fetchOrCacheRestaurant(placeId, googleDetailsFn)
// 3. Verify googleDetailsFn WAS called (cache miss)
// 4. Verify restaurant updated in Firebase
// 5. Check logs for "[Cache MISS]" and "[Update]" messages
```

### Test Fallback to Stale Cache
```typescript
// 1. Create restaurant with stale googleDataLastSynced
// 2. Mock Google API to fail
// 3. Call fetchOrCacheRestaurant(placeId, failingFn)
// 4. Verify function returns stale cache (not null)
// 5. Check logs for "[Fallback]" message
```

## Configuration

### Cache Freshness Duration

Currently set to 7 days. To change:

```typescript
// In googlePlacesCache.ts, isFreshCache():
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
//                                      ↑
//                           Change this number
//                           (3 for 3 days, 14 for 2 weeks)
```

### Cuisine Type Mapping

Add new Google type mappings in `GOOGLE_TYPE_TO_CUISINE_MAP`:

```typescript
const GOOGLE_TYPE_TO_CUISINE_MAP: Record<string, string> = {
  'your_new_type': 'your_cuisine',
  // ... existing mappings
};
```

## Next Steps

1. ✅ Create `googlePlacesCache.ts` service
2. 📋 Add cache fields to Firebase restaurant documents
3. 📋 Create composite index in Firebase Console
4. 📋 Integrate with Step1Basic.tsx
5. 📋 Integrate with DiscoverList.tsx
6. 📋 Implement Google Places API wrapper
7. 📋 Add monitoring dashboard
8. 📋 Track savings and ROI

## FAQ

**Q: Will cache cause stale restaurant data?**
A: No - we refresh weekly and serve stale cache only if Google API fails.

**Q: What if user expects real-time data?**
A: 7-day cache is reasonable for restaurant info (hours/phone rarely change). For critical info, add manual refresh button.

**Q: How much can we save?**
A: ~$1,600/month after 6 months. Year 1 savings: ~$3,000.

**Q: Can we use this for analytics?**
A: Yes! Track search/impression counts by restaurant via `googlePlaceId` field.

**Q: What about restaurants added manually?**
A: They keep `source: 'manual'` and won't be refreshed. Users can manually update them.
