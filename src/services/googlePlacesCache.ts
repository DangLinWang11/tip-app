import {
  collection,
  doc,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CUISINES } from '../utils/taxonomy';

export interface CachedRestaurant extends DocumentData {
  id: string;
  name: string;
  address: string;
  phone: string;
  cuisine: string;
  cuisines?: string[];
  coordinates?: {
    lat: number;
    lng: number;
    latitude?: number;
    longitude?: number;
  };
  source: 'manual' | 'google_places';
  googlePlaceId?: string | null;
  googleDataLastSynced?: Timestamp | null;
  googlePhotoReference?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  googlePhotos?: string[];
}

export interface GooglePlaceDetails {
  name: string;
  place_id: string;
  formatted_address: string;
  formatted_phone_number?: string;
  types: string[];
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  rating?: number;
  reviews?: any[];
}

// Map Google Place types to our cuisine taxonomy
const GOOGLE_TYPE_TO_CUISINE_MAP: Record<string, string> = {
  // Mexican
  mexican_restaurant: 'mexican',

  // Italian
  italian_restaurant: 'italian',

  // Chinese
  chinese_restaurant: 'chinese',

  // Japanese
  japanese_restaurant: 'japanese',
  sushi_restaurant: 'japanese',
  ramen_restaurant: 'japanese',

  // Thai
  thai_restaurant: 'thai',

  // Indian
  indian_restaurant: 'indian',

  // French
  french_restaurant: 'french',

  // Mediterranean/Middle Eastern
  mediterranean_restaurant: 'mediterranean',
  middle_eastern_restaurant: 'middle eastern',

  // Seafood
  seafood_restaurant: 'seafood',

  // Steakhouse
  steakhouse: 'steakhouse',

  // American
  american_restaurant: 'american',

  // Pizza
  pizza_restaurant: 'pizza',

  // BBQ
  barbecue_restaurant: 'bbq',

  // Coffee
  cafe: 'coffee',
  coffee: 'coffee',

  // Breakfast/Brunch
  breakfast_restaurant: 'breakfast',
  brunch_restaurant: 'brunch',

  // Fast Food
  fast_food_restaurant: 'fast food',

  // Korean
  korean_restaurant: 'korean',

  // Vietnamese
  vietnamese_restaurant: 'vietnamese',

  // Thai
  thai_restaurant: 'thai',

  // Greek
  greek_restaurant: 'greek',

  // Spanish/Tapas
  spanish_restaurant: 'spanish',
  tapas_restaurant: 'spanish',

  // Turkish
  turkish_restaurant: 'turkish',

  // Portuguese
  portuguese_restaurant: 'portuguese',

  // Brazilian
  brazilian_restaurant: 'brazilian',
};

/**
 * Map Google Place types array to a single cuisine string
 * Priority: exact matches first, then broader categories
 */
export function mapGoogleTypesToCuisine(types: string[]): string {
  if (!Array.isArray(types) || types.length === 0) {
    return 'american';
  }

  // First pass: look for exact matches in our map
  for (const type of types) {
    const normalized = type.toLowerCase();
    if (GOOGLE_TYPE_TO_CUISINE_MAP[normalized]) {
      return GOOGLE_TYPE_TO_CUISINE_MAP[normalized];
    }
  }

  // Second pass: look for keywords in the type names
  for (const type of types) {
    const lower = type.toLowerCase();

    // Check for specific cuisine keywords
    if (lower.includes('mexican')) return 'mexican';
    if (lower.includes('italian')) return 'italian';
    if (lower.includes('chinese')) return 'chinese';
    if (lower.includes('japanese')) return 'japanese';
    if (lower.includes('sushi')) return 'japanese';
    if (lower.includes('thai')) return 'thai';
    if (lower.includes('indian')) return 'indian';
    if (lower.includes('french')) return 'french';
    if (lower.includes('mediterranean')) return 'mediterranean';
    if (lower.includes('seafood')) return 'seafood';
    if (lower.includes('steak')) return 'steakhouse';
    if (lower.includes('bbq') || lower.includes('barbecue')) return 'bbq';
    if (lower.includes('pizza')) return 'pizza';
    if (lower.includes('coffee') || lower.includes('cafe')) return 'coffee';
    if (lower.includes('korean')) return 'korean';
    if (lower.includes('vietnamese')) return 'vietnamese';
    if (lower.includes('greek')) return 'greek';
    if (lower.includes('spanish') || lower.includes('tapas')) return 'spanish';
    if (lower.includes('turkish')) return 'turkish';
    if (lower.includes('portuguese')) return 'portuguese';
    if (lower.includes('brazilian')) return 'brazilian';
  }

  // Default fallback
  return 'american';
}

/**
 * Check if cached restaurant data is still fresh (less than 7 days old)
 */
export function isFreshCache(lastSynced: Timestamp | null | undefined): boolean {
  if (!lastSynced) {
    return false;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const lastSyncMs = lastSynced.toMillis?.() ?? (lastSynced as any).getTime?.() ?? 0;

  return lastSyncMs > sevenDaysAgo;
}

/**
 * Check Firebase cache for existing restaurant with given Google Place ID
 */
export async function checkFirebaseCache(placeId: string): Promise<CachedRestaurant | null> {
  try {
    const q = query(
      collection(db, 'restaurants'),
      where('googlePlaceId', '==', placeId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as CachedRestaurant;
  } catch (error) {
    console.error(`Error checking Firebase cache for place ${placeId}:`, error);
    return null;
  }
}

/**
 * Transform Google Place API response to our restaurant schema
 */
export function transformGoogleDataToRestaurant(
  googleData: GooglePlaceDetails
): Omit<CachedRestaurant, 'id'> {
  const cuisine = mapGoogleTypesToCuisine(googleData.types || []);
  const photoUrl = googleData.photos?.[0]?.photo_reference || null;

  return {
    name: googleData.name,
    address: googleData.formatted_address || '',
    phone: googleData.formatted_phone_number || '',
    cuisine,
    cuisines: [cuisine],
    coordinates: {
      lat: googleData.geometry?.location?.lat ?? 0,
      lng: googleData.geometry?.location?.lng ?? 0,
      latitude: googleData.geometry?.location?.lat ?? 0,
      longitude: googleData.geometry?.location?.lng ?? 0,
    },
    source: 'google_places',
    googlePlaceId: googleData.place_id,
    googlePhotoReference: photoUrl,
    googleDataLastSynced: serverTimestamp(),
  };
}

/**
 * Fetch or retrieve cached restaurant data
 * 1. Check Firebase cache
 * 2. If fresh, return cached version
 * 3. If stale/missing, fetch from Google Places API
 * 4. Save/update in Firebase
 */
export async function fetchOrCacheRestaurant(
  placeId: string,
  fetchGooglePlaceDetails: (placeId: string) => Promise<GooglePlaceDetails | null>
): Promise<CachedRestaurant | null> {
  try {
    // Check Firebase cache
    const cached = await checkFirebaseCache(placeId);

    // If found and fresh, return cached version
    if (cached && isFreshCache(cached.googleDataLastSynced)) {
      console.log(`[Cache HIT] Restaurant ${placeId} served from Firebase cache`);
      return cached;
    }

    console.log(`[Cache MISS] Restaurant ${placeId} needs refresh from Google Places API`);

    // Fetch from Google Places API
    const googleData = await fetchGooglePlaceDetails(placeId);

    if (!googleData) {
      // If Google API fails and we have stale cache, serve it anyway
      if (cached) {
        console.warn(`[Fallback] Google API failed for ${placeId}, serving stale cache`);
        return cached;
      }
      return null;
    }

    // Transform Google data
    const restaurantData = transformGoogleDataToRestaurant(googleData);

    // Save or update in Firebase
    if (cached) {
      console.log(`[Update] Refreshing restaurant ${cached.id} from Google Places`);
      await updateDoc(doc(db, 'restaurants', cached.id), {
        ...restaurantData,
        updatedAt: serverTimestamp(),
      });
      return {
        id: cached.id,
        ...restaurantData,
      } as CachedRestaurant;
    } else {
      console.log(`[Insert] Creating new restaurant from Google Places ${placeId}`);
      const docRef = await addDoc(collection(db, 'restaurants'), {
        ...restaurantData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        id: docRef.id,
        ...restaurantData,
      } as CachedRestaurant;
    }
  } catch (error) {
    console.error(`Error in fetchOrCacheRestaurant for ${placeId}:`, error);

    // Try to serve stale cache as fallback
    const cached = await checkFirebaseCache(placeId);
    if (cached) {
      console.warn(`[Fallback] Error during fetch, serving stale cache for ${placeId}`);
      return cached;
    }

    return null;
  }
}

/**
 * Trigger background refresh of restaurant data from Google Places
 * Does not block UI - runs in background and updates silently
 */
export async function triggerBackgroundRefresh(
  restaurantId: string,
  placeId: string,
  fetchGooglePlaceDetails: (placeId: string) => Promise<GooglePlaceDetails | null>
): Promise<void> {
  try {
    const googleData = await fetchGooglePlaceDetails(placeId);

    if (!googleData) {
      return;
    }

    const restaurantData = transformGoogleDataToRestaurant(googleData);

    await updateDoc(doc(db, 'restaurants', restaurantId), {
      ...restaurantData,
      updatedAt: serverTimestamp(),
    });

    console.log(`[Background Refresh] Updated restaurant ${restaurantId}`);
  } catch (error) {
    console.error(`Error in background refresh for ${restaurantId}:`, error);
    // Silently fail - don't break user experience
  }
}

/**
 * Get cache statistics for analytics/monitoring
 * Returns metrics about cache performance
 */
export async function getCacheStats(): Promise<{
  totalRestaurants: number;
  googleSourceCount: number;
  manualSourceCount: number;
  cacheHitRate: number;
}> {
  try {
    const allDocsSnapshot = await getDocs(collection(db, 'restaurants'));
    const googleDocsSnapshot = await getDocs(
      query(collection(db, 'restaurants'), where('source', '==', 'google_places'))
    );
    const manualDocsSnapshot = await getDocs(
      query(collection(db, 'restaurants'), where('source', '==', 'manual'))
    );

    return {
      totalRestaurants: allDocsSnapshot.size,
      googleSourceCount: googleDocsSnapshot.size,
      manualSourceCount: manualDocsSnapshot.size,
      cacheHitRate: googleDocsSnapshot.size / (allDocsSnapshot.size || 1),
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalRestaurants: 0,
      googleSourceCount: 0,
      manualSourceCount: 0,
      cacheHitRate: 0,
    };
  }
}
