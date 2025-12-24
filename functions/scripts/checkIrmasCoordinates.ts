import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tip-sarasotav2'
});

const db = admin.firestore();
const restaurantId = 'ChIJ20G-tV5Hw4gRtKi3lQBYQqY';

async function checkIrmasCoordinates() {
  console.log('🔍 Checking Irma\'s Tacos coordinates...\n');

  const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();

  if (!restaurantDoc.exists) {
    console.log('❌ Restaurant not found!');
    return;
  }

  const data = restaurantDoc.data();
  console.log('Restaurant Name:', data?.name);
  console.log('Address:', data?.address);
  console.log('\nLocation (GeoPoint):');
  console.log('  Raw:', data?.location);
  console.log('  _latitude:', data?.location?._latitude);
  console.log('  _longitude:', data?.location?._longitude);
  console.log('\nCoordinates object:');
  console.log('  Raw:', data?.coordinates);
  console.log('  lat:', data?.coordinates?.lat);
  console.log('  lng:', data?.coordinates?.lng);
  console.log('  latitude:', data?.coordinates?.latitude);
  console.log('  longitude:', data?.coordinates?.longitude);

  console.log('\n📍 What getUserVisitedRestaurants would extract:');

  let lat = 27.3364;
  let lng = -82.5307;

  if (data?.location?._latitude !== undefined && data?.location?._longitude !== undefined) {
    lat = data.location._latitude;
    lng = data.location._longitude;
    console.log(`  ✅ Extracted from GeoPoint: { lat: ${lat}, lng: ${lng} }`);
  } else if (data?.coordinates) {
    if (data.coordinates.latitude !== undefined && data.coordinates.longitude !== undefined) {
      lat = parseFloat(data.coordinates.latitude);
      lng = parseFloat(data.coordinates.longitude);
      console.log(`  ✅ Extracted from coordinates.latitude/longitude: { lat: ${lat}, lng: ${lng} }`);
    } else if (data.coordinates.lat !== undefined && data.coordinates.lng !== undefined) {
      lat = parseFloat(data.coordinates.lat);
      lng = parseFloat(data.coordinates.lng);
      console.log(`  ✅ Extracted from coordinates.lat/lng: { lat: ${lat}, lng: ${lng} }`);
    }
  } else {
    console.log(`  ⚠️ Using DEFAULT (Sarasota center): { lat: ${lat}, lng: ${lng} }`);
  }

  console.log('\n🗺️ Google Maps Link:');
  console.log(`  https://www.google.com/maps?q=${lat},${lng}`);
  console.log('\n📌 Actual Irma\'s Tacos location should be:');
  console.log('  3080 Fruitville Commons Blvd, Sarasota, FL 34240');
  console.log('  Approximate coordinates: 27.3392, -82.4435');
}

checkIrmasCoordinates().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
