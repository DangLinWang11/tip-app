# Backfill Cuisines Usage Guide

## Overview
The `runBackfillCuisines` function populates the `restaurants.cuisines[]` array by merging data from:
- Existing `restaurant.cuisine` (string field)
- Any `review.restaurantCuisines[]` from reviews linked to that restaurant

## How to Run

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Open Browser Console
Navigate to your app in the browser and open DevTools console.

### 3. Run Commands

#### Dry Run (Safe - No Writes)
Shows what changes would be made without actually writing to Firestore:
```javascript
await window.runBackfillCuisines({ dryRun: true, includeReviewScan: true })
```

#### Real Run (Writes to Firestore)
Actually updates restaurant documents:
```javascript
await window.runBackfillCuisines({ dryRun: false, includeReviewScan: true })
```

#### Test on Limited Subset
Test on first 10 restaurants only:
```javascript
await window.runBackfillCuisines({
  dryRun: false,
  includeReviewScan: true,
  limitRestaurants: 10
})
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dryRun` | boolean | `true` | If true, no writes occur - just logs what would change |
| `includeReviewScan` | boolean | `true` | Scan all reviews for each restaurant to merge `restaurantCuisines` |
| `batchSize` | number | `400` | Firestore batch size (max 500) |
| `limitRestaurants` | number | `undefined` | Limit to first N restaurants (useful for testing) |

## Return Value

The function returns an object with:
```javascript
{
  updated: number,    // Restaurants that had changes
  unchanged: number,  // Restaurants with no changes needed
  skipped: number     // Restaurants with no cuisine data
}
```

## Safety Features

1. **Safe to Re-run**: De-duplicates and skips unchanged documents
2. **Preserves Existing Data**: Never modifies `restaurant.cuisine` string
3. **Normalized Values**: All cuisines normalized to lowercase, trimmed
4. **Batched Writes**: Uses Firestore batch writes for efficiency

## Example Console Output

### Dry Run
```
[backfillCuisines] start { dryRun: true, includeReviewScan: true, batchSize: 400, limitRestaurants: undefined }
[backfillCuisines][dry] would update abc123 { cuisines: ['mexican', 'latin'] }
[backfillCuisines][dry] would update def456 { cuisines: ['italian', 'pizza'] }
[backfillCuisines] done { updated: 2, unchanged: 15, skipped: 3, dryRun: true, includeReviewScan: true }
```

### Real Run
```
[backfillCuisines] start { dryRun: false, includeReviewScan: true, batchSize: 400, limitRestaurants: undefined }
[backfillCuisines] committed batch (2 updates)
[backfillCuisines] done { updated: 2, unchanged: 15, skipped: 3, dryRun: false, includeReviewScan: true }
```

## Recommended Workflow

1. **Test with Dry Run First**
   ```javascript
   await window.runBackfillCuisines({ dryRun: true })
   ```

2. **Test on Small Subset**
   ```javascript
   await window.runBackfillCuisines({
     dryRun: false,
     limitRestaurants: 5
   })
   ```

3. **Verify Changes in Firestore Console**
   Check that the first few restaurants look correct

4. **Run Full Backfill**
   ```javascript
   await window.runBackfillCuisines({ dryRun: false })
   ```

## Notes

- Only available in DEV mode (`import.meta.env.DEV`)
- Requires Firestore write permissions
- Composite indexes may be needed for complex queries on `cuisines[]` array
- All cuisine values are normalized using `normalizeToken()` from `utils/taxonomy.ts`
