# Firebase Configuration for Google Places Caching

## Firebase Schema Update

### Restaurant Document Schema

Update your Firestore rules to include the new cache fields:

```typescript
// Existing restaurant document
{
  id: string;
  name: string;
  address: string;
  cuisine: string;
  cuisines?: string[];
  phone?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  createdAt?: timestamp;
  updatedAt?: timestamp;
  googlePhotos?: string[];
  qualityScore?: number;

  // NEW FIELDS FOR CACHING
  source?: 'manual' | 'google_places';
  googlePlaceId?: string | null;
  googleDataLastSynced?: timestamp | null;
  googlePhotoReference?: string | null;
}
```

## Firebase Composite Index Setup

### Method 1: Automatic (Recommended)

When you run a query in Cloud Firestore that requires a composite index, Firestore will:
1. Detect the missing index
2. Show a notification in the console
3. Provide a one-click link to create the index
4. Index will be created automatically

**Steps:**
1. Deploy the code with `googlePlacesCache.ts`
2. Run a query to find stale restaurants
3. Firestore will suggest index creation
4. Click the link and confirm

### Method 2: Manual via Firebase Console

**Direct Link Template:**
```
https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/indexes
```

**Steps:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Firestore Database → Indexes
4. Click "Create Index"
5. Fill in the following:

**Index Details:**
- **Collection ID:** `restaurants`
- **Fields:**
  - Field: `googlePlaceId` | Direction: Ascending
  - Field: `googleDataLastSynced` | Direction: Descending
  - Query Scope: Collection

6. Click "Create Index"
7. Wait for index to build (usually 1-2 minutes)

### Method 3: Firestore Security Rules

Update your Firestore security rules to allow reading by `googlePlaceId`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Existing rules...

    match /restaurants/{document=**} {
      allow read: if request.auth != null || true; // Adjust based on your auth
      allow write: if request.auth != null && request.auth.token.admin == true;

      // Allow indexed queries by googlePlaceId
      allow read: if resource.data.googlePlaceId != null;
    }
  }
}
```

## Firestore Query Examples

### Query 1: Find restaurant by Google Place ID

```typescript
import { collection, query, where, getDocs } from 'firebase/firestore';

const q = query(
  collection(db, 'restaurants'),
  where('googlePlaceId', '==', 'ChIJoesVY5EGDIkRYiZ_HHJ4hb4')
);

const snapshot = await getDocs(q);
const restaurant = snapshot.docs[0]?.data();
```

### Query 2: Find stale restaurants needing refresh

```typescript
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const q = query(
  collection(db, 'restaurants'),
  where('source', '==', 'google_places'),
  where('googleDataLastSynced', '<', Timestamp.fromDate(sevenDaysAgo))
);

const snapshot = await getDocs(q);
const staleRestaurants = snapshot.docs.map(doc => doc.data());
```

### Query 3: Get cache statistics

```typescript
// Google-sourced restaurants
const googleQ = query(
  collection(db, 'restaurants'),
  where('source', '==', 'google_places')
);
const googleSnapshot = await getDocs(googleQ);

// Manually-created restaurants
const manualQ = query(
  collection(db, 'restaurants'),
  where('source', '==', 'manual')
);
const manualSnapshot = await getDocs(manualQ);

const stats = {
  total: googleSnapshot.size + manualSnapshot.size,
  googleSourced: googleSnapshot.size,
  manual: manualSnapshot.size,
  cacheHitRate: googleSnapshot.size / (googleSnapshot.size + manualSnapshot.size),
};
```

## Firestore Rules for Cache Operations

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Restaurants collection
    match /restaurants/{restaurantId} {
      // Anyone can read (adjust for your auth model)
      allow read: if true;

      // Only authenticated users can create
      allow create: if request.auth != null;

      // Only document owner or admin can update
      allow update: if
        request.auth != null &&
        (request.auth.uid == resource.data.createdBy ||
         request.auth.token.admin == true);

      // Only admin can delete
      allow delete: if request.auth.token.admin == true;

      // Allow updates to cache fields (system writes)
      allow update: if
        request.auth.token.admin == true &&
        // Only cache-related fields being updated
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'googleDataLastSynced',
          'googlePhotoReference',
          'updatedAt'
        ]);
    }
  }
}
```

## Background Refresh Scheduling

### Option 1: Cloud Functions (Recommended for Production)

Create a scheduled Cloud Function to refresh stale restaurants:

**File:** `functions/src/refreshGooglePlaces.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getGooglePlaceDetails } from '../src/lib/googlePlacesAPI';

const db = admin.firestore();

/**
 * Scheduled function to refresh stale Google Place data
 * Runs daily at 2 AM UTC
 */
export const refreshStaleGooglePlaces = functions
  .region('us-central1')
  .pubsub.schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting stale Google Places refresh...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      // Find stale restaurants
      const snapshot = await db
        .collection('restaurants')
        .where('source', '==', 'google_places')
        .where('googleDataLastSynced', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
        .limit(50) // Refresh in batches to avoid quota
        .get();

      console.log(`Found ${snapshot.size} stale restaurants to refresh`);

      let successCount = 0;
      let errorCount = 0;

      for (const doc of snapshot.docs) {
        const restaurant = doc.data();

        if (!restaurant.googlePlaceId) {
          continue;
        }

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
            console.log(`✓ Refreshed ${restaurant.name}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`✗ Failed to refresh ${restaurant.name}:`, error);
        }
      }

      console.log(`Refresh complete: ${successCount} success, ${errorCount} errors`);

      return {
        success: true,
        refreshed: successCount,
        errors: errorCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in refreshStaleGooglePlaces:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });
```

**Deploy the function:**
```bash
firebase deploy --only functions:refreshStaleGooglePlaces
```

### Option 2: Client-side Refresh (For Now)

Implement refresh in `DiscoverList.tsx` or a periodic check:

```typescript
import { triggerBackgroundRefresh } from '../services/googlePlacesCache';

// In a useEffect or periodic check
const refreshTask = setInterval(async () => {
  const staleRestaurants = await getStaleRestaurants();
  for (const restaurant of staleRestaurants) {
    triggerBackgroundRefresh(
      restaurant.id,
      restaurant.googlePlaceId,
      getGooglePlaceDetails
    ).catch(err => console.warn('Background refresh failed:', err));
  }
}, 60000); // Check every minute

return () => clearInterval(refreshTask);
```

## Costs & Billing

### Firestore Pricing (as of 2024)

| Operation | Cost |
|-----------|------|
| Read | $0.06 per 100,000 reads |
| Write | $0.18 per 100,000 writes |
| Delete | $0.02 per 100,000 deletes |

### Cache System Costs

| Month | Reads | Writes | Deletes | Cost |
|-------|-------|--------|---------|------|
| 1 | 100K | 10K | 0 | ~$7.80 |
| 2+ | 50K | 1K | 0 | ~$3.20 |

**Monthly Firestore cost:** ~$3-8 (minimal)
**Google Places API cost:** ~$5-20 (vs $700 without cache)

## Monitoring

### Setup Cloud Monitoring Dashboard

```
Firebase Console → Firestore → Metrics
```

Monitor:
- Read operations
- Write operations
- Storage size
- Query latency

### Alert on High Costs

Set up billing alerts in [Google Cloud Console](https://console.cloud.google.com/billing):

1. Go to Billing → Budgets and alerts
2. Create alert for Firestore
3. Set threshold at $50/month
4. Alert via email

## Data Backup & Recovery

### Enable Automatic Backups

```bash
# Create a backup schedule using gcloud CLI
gcloud firestore backups create \
  --retention=30d \
  --location=us-central1
```

### Manual Export

```bash
# Export all restaurants data
gcloud firestore export gs://YOUR_BUCKET/restaurants-backup

# Import data
gcloud firestore import gs://YOUR_BUCKET/restaurants-backup
```

## Migration Guide

### For Existing Restaurants

If you have existing restaurants in Firestore without cache fields:

```typescript
// Migration script to add cache fields
async function migrateExistingRestaurants() {
  const snapshot = await db.collection('restaurants').get();
  const batch = db.batch();

  snapshot.forEach(doc => {
    const data = doc.data();

    // Only update if not already migrated
    if (data.source === undefined) {
      batch.update(doc.ref, {
        source: 'manual', // Assume manually created
        googlePlaceId: null,
        googleDataLastSynced: null,
        googlePhotoReference: null,
      });
    }
  });

  await batch.commit();
  console.log(`Migrated ${snapshot.size} restaurants`);
}

// Run once
migrateExistingRestaurants();
```

## Troubleshooting

### Index Not Found Error

**Error:** "The query requires an index..."

**Solution:**
1. Check Firebase Console → Firestore → Indexes
2. Verify the index exists and is in `READY` status
3. If missing, create it manually using the link provided in the error
4. Wait 1-2 minutes for index to build

### Stale Cache Not Updating

**Check:**
1. Verify `googleDataLastSynced` field exists in documents
2. Run manual refresh test
3. Check Cloud Functions logs for errors
4. Verify Google Places API key has quota remaining

### Firebase Quota Exceeded

**Solutions:**
1. Check pricing plan (Spark plan has daily quota)
2. Upgrade to Blaze plan for unlimited reads/writes
3. Reduce refresh frequency or batch size
4. Add caching at application level

## Next Steps

1. ✅ Review schema changes
2. Create composite index in Firebase Console
3. Update existing restaurants with migration script
4. Deploy Cloud Function for scheduled refresh
5. Monitor costs and cache hit rates
