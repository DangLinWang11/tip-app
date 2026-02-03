/**
 * One-time admin script:
 * - Fix invalid restaurant coordinates
 * - Backfill countryCode/countryName when missing
 *
 * Usage:
 *   npx tsx src/scripts/fixInvalidRestaurantCoords.ts
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS (Firebase Admin)
 *   - GOOGLE_GEOCODING_API_KEY (server-only)
 */

import admin from 'firebase-admin';

const GEOCODE_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY || '';
const hasAdminCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!hasAdminCreds) {
  console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS env variable is required for Firebase Admin');
  process.exit(1);
}

if (!GEOCODE_API_KEY) {
  console.error('ERROR: GOOGLE_GEOCODING_API_KEY environment variable is required');
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

type CountryResult = { code: string; name: string };

const normalizeLng = (lng: number): number => ((lng + 540) % 360) - 180;

const isMissingCoords = (lat: any, lng: any): boolean =>
  typeof lat !== 'number' ||
  typeof lng !== 'number' ||
  Number.isNaN(lat) ||
  Number.isNaN(lng);

const isZeroCoords = (lat: number, lng: number): boolean => lat === 0 && lng === 0;

const isLngOutOfRange = (lng: number): boolean => lng < -180 || lng > 180;

async function getCountryFromCoords(lat: number, lng: number): Promise<CountryResult | null> {
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

async function run() {
  console.log('Starting invalid coordinates fix...');
  console.log('Geocoding API key present:', !!GEOCODE_API_KEY);

  const restaurantsRef = db.collection('restaurants');
  const snapshot = await restaurantsRef.get();

  let fixedLng = 0;
  let skippedMissingCoords = 0;
  let updatedCountry = 0;
  let failed = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const coords = data.coordinates || {};
    const lat = coords.lat ?? coords.latitude;
    const lng = coords.lng ?? coords.longitude;

    if (isMissingCoords(lat, lng)) {
      skippedMissingCoords++;
      console.log(`  SKIP (missing coords): ${data.name || docSnap.id}`);
      continue;
    }

    if (isZeroCoords(lat, lng)) {
      skippedMissingCoords++;
      console.log(`  SKIP (0,0 coords): ${data.name || docSnap.id}`);
      continue;
    }

    let nextLat = lat;
    let nextLng = lng;
    let updated = false;

    if (isLngOutOfRange(lng)) {
      nextLng = normalizeLng(lng);
      updated = true;
      fixedLng++;
      console.log(`  FIXED LNG: ${data.name || docSnap.id} (${lng} -> ${nextLng})`);
    }

    if (updated) {
      await docSnap.ref.update({
        coordinates: {
          ...coords,
          lat: nextLat,
          lng: nextLng,
        },
      });
    }

    if (!data.countryCode) {
      try {
        const country = await getCountryFromCoords(nextLat, nextLng);
        if (country) {
          await docSnap.ref.update({
            countryCode: country.code,
            countryName: country.name,
          });
          updatedCountry++;
          console.log(`  UPDATED COUNTRY: ${data.name || docSnap.id} -> ${country.code} (${country.name})`);
        } else {
          failed++;
        }
      } catch (err: any) {
        failed++;
        console.error(`  ERROR: ${data.name || docSnap.id}:`, err?.message || err);
      }
      await sleep(100);
    }
  }

  console.log('\n--- Fix Complete ---');
  console.log(`  Fixed lng: ${fixedLng}`);
  console.log(`  Skipped (missing/0,0 coords): ${skippedMissingCoords}`);
  console.log(`  Updated country: ${updatedCountry}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${snapshot.size}`);
}

run().catch(console.error);
