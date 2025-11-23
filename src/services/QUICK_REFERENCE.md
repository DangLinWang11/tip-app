# Google Places Cache - Quick Reference

## Import & Use

```typescript
import {
  fetchOrCacheRestaurant,
  triggerBackgroundRefresh,
  mapGoogleTypesToCuisine,
  isFreshCache,
  getCacheStats,
  checkFirebaseCache,
  transformGoogleDataToRestaurant,
} from '../services/googlePlacesCache';
```

## Common Patterns

### Pattern 1: Get or Create Restaurant (User Selection)

```typescript
// When user selects a Google Place result
const placeId = 'ChIJoesVY5EGDIkRYiZ_HHJ4hb4';

const restaurant = await fetchOrCacheRestaurant(
  placeId,
  async (id) => await getGooglePlaceDetails(id)
);

if (restaurant) {
  selectRestaurant(restaurant);
} else {
  // Fallback: manual creation or error
  setShowCreateRestaurant(true);
}
```

### Pattern 2: Background Refresh (Non-blocking)

```typescript
// In restaurant list loading
if (
  restaurant.source === 'google_places' &&
  restaurant.googlePlaceId &&
  !isFreshCache(restaurant.googleDataLastSynced)
) {
  // Fire and forget - don't await
  triggerBackgroundRefresh(
    restaurant.id,
    restaurant.googlePlaceId,
    async (id) => await getGooglePlaceDetails(id)
  ).catch(err => console.warn('Refresh failed:', err));
}
```

### Pattern 3: Check Cache Status

```typescript
// Determine if we need to fetch from API
const cached = await checkFirebaseCache(placeId);

if (cached && isFreshCache(cached.googleDataLastSynced)) {
  // Use cache
  return cached;
} else {
  // Fetch from API
  const fresh = await getGooglePlaceDetails(placeId);
  return transformGoogleDataToRestaurant(fresh);
}
```

### Pattern 4: Map Google Types to Cuisine

```typescript
const googleTypes = ['italian_restaurant', 'point_of_interest', 'establishment'];
const cuisine = mapGoogleTypesToCuisine(googleTypes);
// Result: 'italian'
```

### Pattern 5: Get Cache Analytics

```typescript
const stats = await getCacheStats();
console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
console.log(`API cost: ~$${stats.googleSourceCount * 0.07 / 52}/week`);
```

## Error Handling

### Handle API Failures Gracefully

```typescript
try {
  const restaurant = await fetchOrCacheRestaurant(placeId, googleDetailsFn);

  if (!restaurant) {
    // No cache and API failed
    throw new Error('Could not load restaurant data');
  }

  return restaurant;
} catch (error) {
  // Try to serve any available cache (even if stale)
  const staleCache = await checkFirebaseCache(placeId);
  if (staleCache) {
    console.warn('Serving stale cache due to error:', error);
    return staleCache;
  }

  // Last resort: show error to user
  throw error;
}
```

## Cost Tracking

### Calculate Estimated Monthly Cost

```typescript
async function estimateMonthlyAPICost() {
  const stats = await getCacheStats();

  // Assume ~250 new restaurants per month
  const newRestaurantsPerMonth = 250;

  // Weekly refreshes: (total Google restaurants / 52 weeks)
  const weeklyRefreshes = stats.googleSourceCount / 52;

  // Total API calls per month
  const totalCallsPerMonth = (newRestaurantsPerMonth + weeklyRefreshes * 4);

  // Each call costs ~$0.07
  const estimatedCost = totalCallsPerMonth * 0.07;

  return {
    newRestaurantsPerMonth,
    weeklyRefreshes,
    totalCallsPerMonth,
    estimatedCost: estimatedCost.toFixed(2),
  };
}
```

## Firebase Rules (Copy-Paste)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /restaurants/{restaurantId} {
      // Readable by everyone
      allow read: if true;

      // Writable by authenticated users or admin
      allow create, write: if
        request.auth != null &&
        (request.auth.token.admin == true ||
         request.auth.uid == resource.data.createdBy);

      // Admin can always write
      allow update: if request.auth.token.admin == true;
    }
  }
}
```

## Firebase Index (Copy-Paste)

Go to Firebase Console and create this index:

```
Collection: restaurants
Field 1: googlePlaceId (Ascending)
Field 2: googleDataLastSynced (Descending)
```

## Schema (Copy-Paste)

Add these fields to your restaurant documents:

```typescript
{
  // Existing fields...
  name: string;
  address: string;
  cuisine: string;
  coordinates: { lat: number; lng: number };

  // New cache fields
  source?: 'manual' | 'google_places';
  googlePlaceId?: string | null;
  googleDataLastSynced?: Timestamp | null;
  googlePhotoReference?: string | null;
}
```

## Testing Helpers

```typescript
// Mock Google Places response
const mockGoogleData = {
  name: 'Test Restaurant',
  place_id: 'ChIJtest123',
  formatted_address: '123 Main St, City, State',
  formatted_phone_number: '+1 (555) 123-4567',
  types: ['italian_restaurant', 'restaurant'],
  geometry: {
    location: { lat: 40.7128, lng: -74.0060 },
  },
  photos: [{
    photo_reference: 'photo_ref_123',
    height: 800,
    width: 1200,
  }],
};

// Test cache transformation
const restaurant = transformGoogleDataToRestaurant(mockGoogleData);
console.log(restaurant);
// {
//   name: 'Test Restaurant',
//   address: '123 Main St, City, State',
//   phone: '+1 (555) 123-4567',
//   cuisine: 'italian',
//   cuisines: ['italian'],
//   source: 'google_places',
//   googlePlaceId: 'ChIJtest123',
//   googleDataLastSynced: Timestamp(...),
// }
```

## Debugging

### Check Cache Status

```typescript
// In browser console
const restaurant = (await db.collection('restaurants')
  .where('googlePlaceId', '==', 'ChIJtest')
  .get()).docs[0].data();

console.log({
  cached: !!restaurant,
  fresh: restaurant?.googleDataLastSynced?.toDate(),
  source: restaurant?.source,
});
```

### Monitor API Calls

```typescript
// Add logging to getGooglePlaceDetails wrapper
const originalFetch = getGooglePlaceDetails;

window.getGooglePlaceDetails = async (placeId) => {
  console.time(`Google API: ${placeId}`);
  const result = await originalFetch(placeId);
  console.timeEnd(`Google API: ${placeId}`);
  console.log('Google API call:', placeId, result);
  return result;
};
```

## Performance Tips

1. **Batch refreshes** - Don't refresh all stale restaurants at once
2. **Use background jobs** - Refresh in Cloud Functions, not on user load
3. **Cache 7+ days** - Longer cache = fewer API calls = lower cost
4. **Monitor hit rate** - Track `getCacheStats()` weekly

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing index" error | Create composite index in Firebase Console |
| Cache not updating | Check `googleDataLastSynced` field in document |
| API quota exceeded | Reduce refresh frequency or add to Blaze plan |
| Stale data showing | Trigger manual refresh button or lower cache duration |

## Key Metrics

- **Cache hit rate goal:** 70%+ (70% served from Firebase, 30% from Google API)
- **Cost target:** <$20/month (vs $700+ without cache)
- **Refresh latency:** <2 seconds (background job)
- **Fallback success rate:** 99%+ (cache available if API fails)

## Migration Checklist

- [ ] Add cache fields to Firebase schema
- [ ] Create composite index
- [ ] Migrate existing restaurants (set source='manual')
- [ ] Integrate with Step1Basic.tsx
- [ ] Integrate with DiscoverList.tsx
- [ ] Implement Google Places wrapper
- [ ] Test cache hit/miss scenarios
- [ ] Set up monitoring dashboard
- [ ] Deploy to production
- [ ] Track savings vs old system

## Cost Savings Timeline

| Timeline | Action | Cost |
|----------|--------|------|
| Week 1 | Implement caching | ~$50 |
| Week 2-4 | Build initial cache | ~$100 |
| Month 2 | Cache hit rate 60% | ~$150 |
| Month 3+ | Cache hit rate 80% | ~$20/month |
| **Year 1 Total** | | ~$150 vs $8,400 (98% savings) |

---

**Questions?** See [GOOGLE_PLACES_CACHE_INTEGRATION.md](./GOOGLE_PLACES_CACHE_INTEGRATION.md) for full documentation.
