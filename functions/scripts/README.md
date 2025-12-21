# Visit Count Recalculation Script

This directory contains a one-time cleanup script to recalculate visit counts for the Tip PWA.

## Problem Statement

When reviews are soft-deleted (`isDeleted: true`), they create "ghost visits" - the visit count remains inflated because it was based on the total number of reviews (including deleted ones).

## Solution

This script recalculates the visit count for all user-restaurant pairs by:
1. Querying all active reviews (`isDeleted != true`)
2. Grouping by `(userId, restaurantId)` pairs
3. Counting the actual number of active reviews
4. Updating the `user_restaurant_visits` collection with correct counts

## Setup

### 1. Download Service Account Key

**Direct link for your project:**
https://console.firebase.google.com/project/tip-sarasotav2/settings/serviceaccounts/adminsdk

Steps:
1. Click the link above (or go to Firebase Console → Project Settings → Service Accounts)
2. Click **"Generate new private key"** button
3. Click **"Generate key"** in the confirmation popup
4. Save the downloaded JSON file as `serviceAccountKey.json` in the `tip/functions/` directory

⚠️ **IMPORTANT**: This file contains sensitive credentials. Never commit it to git (it's already in `.gitignore`).

### 2. Install Dependencies

```bash
cd tip/functions
npm install
```

## Usage

### Recalculate All Visit Counts

```bash
node scripts/recalculateVisitCounts.js
```

This will process all user-restaurant pairs in the database.

### Recalculate for Specific Restaurant (by ID)

```bash
node scripts/recalculateVisitCounts.js --restaurantId=YOUR_RESTAURANT_ID
```

### Recalculate for Specific Restaurant (by Name)

```bash
node scripts/recalculateVisitCounts.js --restaurantName="Jack Dusty"
```

This is useful for fixing a specific restaurant's visit counts (e.g., after discovering ghost visits).

## Example Output

```
🔄 Starting visit count recalculation...

📊 Found 1,234 total reviews in collection
✅ Found 1,150 active reviews (non-deleted)

👥 Found 87 unique (user, restaurant) pairs

✨ Created: userId=abc12345..., restaurantId=def67890..., count=3
🔧 Updated: userId=ghi11111..., restaurantId=jkl22222..., 5 -> 4

============================================================
📈 RECALCULATION COMPLETE
============================================================
✨ Created: 12 new visit records
🔧 Updated: 45 existing visit records
❌ Errors: 0 failed operations
✅ Total processed: 87 user-restaurant pairs
============================================================

✅ Script completed successfully
```

## What Gets Updated

The script updates documents in the `user_restaurant_visits` collection with this structure:

```javascript
{
  userId: "abc123...",
  restaurantId: "def456...",
  visitCount: 3,  // Recalculated count
  createdAt: Timestamp,
  updatedAt: Timestamp  // Updated when recalculated
}
```

## Automation (Cloud Function)

Once this script has cleaned up existing data, the `onReviewUpdate` Cloud Function will automatically maintain correct visit counts going forward:

- **Trigger**: When a review is updated
- **Condition**: When `isDeleted` changes from `false` to `true`
- **Action**: Decrements the visit count in `user_restaurant_visits` by 1

See [functions/src/onReviewUpdate.ts](../src/onReviewUpdate.ts) for implementation details.

## Troubleshooting

### Error: Cannot find module 'firebase-admin'

Run `npm install` in the `functions/` directory.

### Error: Could not load the default credentials

Make sure you've downloaded the `serviceAccountKey.json` file and placed it in `functions/` directory.

### Error: PERMISSION_DENIED

Your service account key may not have the correct permissions. Generate a new key from Firebase Console.

## Security Notes

- This script uses your Firebase login credentials (via Application Default Credentials)
- Make sure you have the appropriate Firestore permissions on your Firebase account
- The script requires read/write access to the `reviews` and `user_restaurant_visits` collections

## Questions?

For issues or questions, contact the development team or file an issue in the project repository.
