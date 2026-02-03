/**
 * One-time backfill script: Adds countryCode and countryName to existing
 * restaurant documents that are missing these fields.
 *
 * Usage:
 *   node --env-file=.env.local node_modules/.bin/tsx src/scripts/backfillCountryCodes.ts
 *
 * Requirements:
 *   - GOOGLE_GEOCODING_API_KEY env variable (server-only; not VITE_)
 *   - Firebase Admin SDK or client SDK with appropriate permissions
 *
 * Rate limiting: 10 requests/sec to respect Geocoding API quotas.
 */

import admin from 'firebase-admin';

const GEOCODE_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY || '';

const hasAdminCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!hasAdminCreds) {
  console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS env variable is required for Firebase Admin');
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

async function getCountryFromCoords(lat: number, lng: number): Promise<{ code: string; name: string } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=country&key=${GEOCODE_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`  GEOCODE_HTTP_ERROR: ${response.status} for ${lat},${lng}`);
    return null;
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.length) {
    const message = data.error_message ? ` (${data.error_message})` : '';
    console.warn(`  GEOCODE_STATUS: ${data.status}${message} for ${lat},${lng}`);
    return null;
  }

  const result = data.results[0];
  const countryComponent = result.address_components?.find(
    (c: any) => c.types.includes('country')
  );

  if (!countryComponent) return null;

  return {
    code: countryComponent.short_name,
    name: countryComponent.long_name,
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidCoord(lat: number, lng: number): boolean {
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

async function backfill() {
  console.log('Starting country code backfill...');
  console.log('Geocoding API key present:', !!GEOCODE_API_KEY);

  if (!GEOCODE_API_KEY) {
    console.error('ERROR: GOOGLE_GEOCODING_API_KEY environment variable is required');
    process.exit(1);
  }

  const restaurantsRef = db.collection('restaurants');
  const snapshot = await restaurantsRef.get();

  console.log(`Found ${snapshot.size} total restaurants`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let invalidCoords = 0;
  const failureBuckets: Record<string, number> = {
    ZERO_RESULTS: 0,
    REQUEST_DENIED: 0,
    INVALID_REQUEST: 0,
    OVER_DAILY_LIMIT: 0,
    OVER_QUERY_LIMIT: 0,
    UNKNOWN_ERROR: 0,
    HTTP_ERROR: 0,
    NO_COUNTRY: 0,
  };

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Skip if already has countryCode
    if (data.countryCode) {
      skipped++;
      continue;
    }

    // Extract coordinates
    const coords = data.coordinates || {};
    const lat = coords.lat ?? coords.latitude;
    const lng = coords.lng ?? coords.longitude;

    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      invalidCoords++;
      console.log(`  SKIP (invalid coords): ${data.name || docSnap.id}`);
      continue;
    }

    if (!isValidCoord(lat, lng)) {
      invalidCoords++;
      console.log(`  SKIP (out of range): ${data.name || docSnap.id} (${lat}, ${lng})`);
      continue;
    }

    try {
      const country = await getCountryFromCoords(lat, lng);

      if (country) {
        await docSnap.ref.update({
          countryCode: country.code,
          countryName: country.name,
        });
        updated++;
        console.log(`  UPDATED: ${data.name} -> ${country.code} (${country.name})`);
      } else {
        failed++;
        failureBuckets.NO_COUNTRY += 1;
        console.log(`  FAILED (no country result): ${data.name} (${lat}, ${lng})`);
      }
    } catch (err: any) {
      failed++;
      const status = err?.status || 'UNKNOWN_ERROR';
      if (failureBuckets[status] !== undefined) {
        failureBuckets[status] += 1;
      } else {
        failureBuckets.UNKNOWN_ERROR += 1;
      }
      console.error(`  ERROR: ${data.name}:`, err?.message || err);
    }

    // Rate limit: 10 req/sec
    await sleep(100);
  }

  console.log('\n--- Backfill Complete ---');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already has code): ${skipped}`);
  console.log(`  Skipped (invalid coords): ${invalidCoords}`);
  console.log(`  Failed: ${failed}`);
  console.log('  Failure buckets:', failureBuckets);
  console.log(`  Total: ${snapshot.size}`);
}

backfill().catch(console.error);
