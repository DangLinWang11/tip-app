import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Backfill Cloud Function to trigger thumbnail generation for existing images
 *
 * This callable function processes existing review images and triggers the
 * Firebase Resize Images extension to create thumbnails (_200x200 and _800x800).
 *
 * How it works:
 * 1. Queries reviews collection in batches
 * 2. For each review with images, checks if thumbnails exist in Storage
 * 3. If thumbnails are missing, triggers resize by re-uploading the file
 * 4. The Resize Images extension automatically detects the new upload and creates variants
 *
 * Safety features:
 * - Batch processing (50 reviews at a time)
 * - Timeout protection (max 9 minutes)
 * - Progress tracking
 * - Error handling with detailed logging
 *
 * Usage:
 * firebase functions:call backfillThumbnails --data='{"batchSize": 50, "offset": 0}'
 */

interface BackfillRequest {
  batchSize?: number;  // Number of reviews to process (default: 50, max: 100)
  offset?: number;     // Starting offset for pagination (default: 0)
  dryRun?: boolean;    // If true, only reports what would be done without making changes
}

interface BackfillResult {
  success: boolean;
  processedReviews: number;
  processedImages: number;
  triggeredResize: number;
  skippedImages: number;
  errors: string[];
  nextOffset: number | null;
  message: string;
}

/**
 * Helper to check if a file exists in Storage
 */
async function fileExists(bucket: admin.storage.Bucket, filePath: string): Promise<boolean> {
  try {
    const [exists] = await bucket.file(filePath).exists();
    return exists;
  } catch (error) {
    console.error(`Error checking file existence for ${filePath}:`, error);
    return false;
  }
}

/**
 * Helper to extract storage path from Firebase Storage URL
 */
function extractStoragePath(url: string): string | null {
  try {
    // Firebase Storage URLs look like:
    // https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media&token=...
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    return null;
  } catch (error) {
    console.error(`Error parsing storage URL: ${url}`, error);
    return null;
  }
}

/**
 * Helper to generate thumbnail path from original path
 */
function getThumbnailPath(originalPath: string, size: '200x200' | '800x800'): string {
  const lastDotIndex = originalPath.lastIndexOf('.');
  if (lastDotIndex === -1) return originalPath;

  const baseWithoutExt = originalPath.substring(0, lastDotIndex);
  const ext = originalPath.substring(lastDotIndex);

  return `${baseWithoutExt}_${size}${ext}`;
}

/**
 * Helper to trigger thumbnail generation by copying file to itself
 * This tricks the Resize Images extension into processing it as a new upload
 */
async function triggerThumbnailGeneration(
  bucket: admin.storage.Bucket,
  filePath: string
): Promise<boolean> {
  try {
    const file = bucket.file(filePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`Original file does not exist: ${filePath}`);
      return false;
    }

    // Copy file to a temporary location
    const tempPath = `${filePath}.temp_resize`;
    await file.copy(tempPath);

    // Move temp file back to original location
    // This triggers the Resize Images extension as if it's a new upload
    const tempFile = bucket.file(tempPath);
    await tempFile.move(filePath);

    console.log(`Successfully triggered resize for: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error triggering thumbnail generation for ${filePath}:`, error);
    return false;
  }
}

export const backfillThumbnails = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes (max for callable functions)
    memory: '1GB'
  })
  .https.onCall(async (data: BackfillRequest, context): Promise<BackfillResult> => {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to run backfill'
      );
    }

    // Optional: Restrict to admin users only
    // You can add admin check here if needed
    // For now, any authenticated user can run this (consider adding admin-only restriction)

    const batchSize = Math.min(data.batchSize || 50, 100); // Cap at 100
    const offset = data.offset || 0;
    const dryRun = data.dryRun || false;

    console.log(`Starting thumbnail backfill: batchSize=${batchSize}, offset=${offset}, dryRun=${dryRun}`);

    const result: BackfillResult = {
      success: true,
      processedReviews: 0,
      processedImages: 0,
      triggeredResize: 0,
      skippedImages: 0,
      errors: [],
      nextOffset: null,
      message: ''
    };

    try {
      const bucket = admin.storage().bucket();

      // Query reviews in batches
      const reviewsSnapshot = await admin.firestore()
        .collection('reviews')
        .orderBy('createdAt', 'desc')
        .offset(offset)
        .limit(batchSize)
        .get();

      if (reviewsSnapshot.empty) {
        result.message = 'No more reviews to process. Backfill complete!';
        return result;
      }

      result.processedReviews = reviewsSnapshot.size;

      // Process each review
      for (const reviewDoc of reviewsSnapshot.docs) {
        const reviewData = reviewDoc.data();

        // Collect all image URLs from the review
        const imageUrls: string[] = [];

        // Check legacy images field
        if (Array.isArray(reviewData.images)) {
          imageUrls.push(...reviewData.images);
        }

        // Check new media.photos field
        if (reviewData.media?.photos && Array.isArray(reviewData.media.photos)) {
          imageUrls.push(...reviewData.media.photos);
        }

        // Check visitMedia field
        if (Array.isArray(reviewData.visitMedia)) {
          imageUrls.push(...reviewData.visitMedia);
        }

        // Process each image
        for (const imageUrl of imageUrls) {
          if (!imageUrl || typeof imageUrl !== 'string') continue;

          result.processedImages++;

          const storagePath = extractStoragePath(imageUrl);
          if (!storagePath) {
            result.errors.push(`Failed to extract storage path from URL: ${imageUrl}`);
            result.skippedImages++;
            continue;
          }

          // Check if thumbnails already exist
          const thumbnail200Path = getThumbnailPath(storagePath, '200x200');
          const thumbnail800Path = getThumbnailPath(storagePath, '800x800');

          const [has200, has800] = await Promise.all([
            fileExists(bucket, thumbnail200Path),
            fileExists(bucket, thumbnail800Path)
          ]);

          if (has200 && has800) {
            // Thumbnails already exist, skip
            result.skippedImages++;
            continue;
          }

          // Thumbnails missing, trigger generation
          console.log(`Missing thumbnails for: ${storagePath} (200x200: ${has200}, 800x800: ${has800})`);

          if (!dryRun) {
            const success = await triggerThumbnailGeneration(bucket, storagePath);
            if (success) {
              result.triggeredResize++;
            } else {
              result.errors.push(`Failed to trigger resize for: ${storagePath}`);
            }
          } else {
            console.log(`[DRY RUN] Would trigger resize for: ${storagePath}`);
            result.triggeredResize++;
          }
        }
      }

      // Calculate next offset
      result.nextOffset = reviewsSnapshot.size === batchSize ? offset + batchSize : null;

      if (result.nextOffset !== null) {
        result.message = `Processed ${result.processedReviews} reviews. Continue with offset=${result.nextOffset}`;
      } else {
        result.message = 'Batch complete. No more reviews to process.';
      }

      console.log('Backfill summary:', result);

      return result;

    } catch (error) {
      console.error('Backfill error:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.message = 'Backfill failed with errors';

      return result;
    }
  });

/**
 * Helper function to get backfill progress
 * Returns statistics about thumbnail coverage
 */
export const getThumbnailStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to get stats'
    );
  }

  try {
    const reviewsSnapshot = await admin.firestore()
      .collection('reviews')
      .limit(1000) // Sample first 1000 reviews
      .get();

    let totalReviews = 0;
    let reviewsWithImages = 0;
    let totalImages = 0;

    reviewsSnapshot.forEach(doc => {
      totalReviews++;
      const data = doc.data();

      const imageUrls: string[] = [];
      if (Array.isArray(data.images)) {
        imageUrls.push(...data.images);
      }
      if (data.media?.photos && Array.isArray(data.media.photos)) {
        imageUrls.push(...data.media.photos);
      }
      if (Array.isArray(data.visitMedia)) {
        imageUrls.push(...data.visitMedia);
      }

      if (imageUrls.length > 0) {
        reviewsWithImages++;
        totalImages += imageUrls.length;
      }
    });

    return {
      totalReviews,
      reviewsWithImages,
      totalImages,
      avgImagesPerReview: reviewsWithImages > 0 ? (totalImages / reviewsWithImages).toFixed(2) : 0
    };

  } catch (error) {
    console.error('Error getting thumbnail stats:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get stats');
  }
});
