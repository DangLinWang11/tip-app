import { RestaurantCardModel, getQualityColor } from '../components/discover/RestaurantListCard';
import { GoogleFallbackPlace } from '../services/googlePlacesService';

interface RestaurantWithExtras {
  id: string;
  name: string;
  coverImage: string | null;
  headerImage?: string | null;
  googlePhotos?: string[];
  recentReviewPhotos?: string[];
  priceRange: string | null;
  priceLevel?: number;
  cuisine: string;
  mostReviewedCuisine: string | null;
  topTags: string[];
  distanceLabel?: string;
  qualityPercentage: number | null;
  qualityScore?: number;
  reviewCount: number;
}

const MIN_REVIEWS_FOR_TRUST = 5;
const MIN_REVIEWS_FOR_COUNT_DISPLAY = 100;

const toRad = (n: number) => (n * Math.PI) / 180;

const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
};

const formatDistanceLabel = (miles: number | null | undefined) => {
  if (miles == null || Number.isNaN(miles)) return null;
  if (miles < 0.1) return '<0.1 mi';
  if (miles >= 10) return `${Math.round(miles)} mi`;
  return `${miles.toFixed(1)} mi`;
};

/**
 * Converts a TIP restaurant to the unified RestaurantCardModel
 */
export function tipRestaurantToCardModel(restaurant: RestaurantWithExtras): RestaurantCardModel {
  const q = (restaurant as any).qualityScore ?? restaurant.qualityPercentage ?? null;
  const hasSufficientData = restaurant.reviewCount >= MIN_REVIEWS_FOR_TRUST;
  const hasEnoughForCountDisplay = restaurant.reviewCount >= MIN_REVIEWS_FOR_COUNT_DISPLAY;

  let limitedRatingsText: string | null = null;
  let reviewCountText: string | null = null;

  if (hasEnoughForCountDisplay) {
    // Show review count for restaurants with >= 100 reviews
    reviewCountText = `${restaurant.reviewCount} reviews`;
  } else if (!hasSufficientData) {
    // Show limited ratings badge for restaurants with < 5 reviews
    limitedRatingsText = `Limited ratings (${restaurant.reviewCount})`;
  }

  // Image fallback chain: coverImage -> headerImage -> googlePhotos -> recentReviewPhotos -> null
  const coverImage = restaurant.coverImage ||
    restaurant.headerImage ||
    (restaurant.googlePhotos && restaurant.googlePhotos.length > 0 ? restaurant.googlePhotos[0] : null) ||
    (restaurant.recentReviewPhotos && restaurant.recentReviewPhotos.length > 0 ? restaurant.recentReviewPhotos[0] : null) ||
    null;

  return {
    id: restaurant.id,
    name: restaurant.name,
    coverImage,
    priceText: restaurant.priceRange,
    distanceLabel: restaurant.distanceLabel ?? null,
    subtitleText: restaurant.mostReviewedCuisine || '',
    badgeText: q !== null ? `${q}%` : null,
    badgeColor: q !== null ? getQualityColor(q) : null,
    limitedRatingsText,
    reviewCountText,
    tags: restaurant.topTags,
    source: 'tip',
    restaurantId: restaurant.id
  };
}

/**
 * Converts a Google Place to the unified RestaurantCardModel
 */
export function googlePlaceToCardModel(
  place: GoogleFallbackPlace,
  userLocation?: { lat: number; lng: number }
): RestaurantCardModel {
  // Extract cover image from photos
  let coverImage: string | null = null;
  if (place.photos && place.photos.length > 0) {
    try {
      coverImage = place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 });
    } catch (err) {
      console.warn('Failed to get photo URL:', err);
    }
  }

  // Calculate price text from price_level
  let priceText: string | null = null;
  if (typeof place.price_level === 'number' && place.price_level >= 1 && place.price_level <= 4) {
    priceText = '$'.repeat(place.price_level);
  }

  // Calculate distance if location is available
  let distanceLabel: string | null = null;
  if (userLocation && place.geometry?.location) {
    try {
      const placeLat = typeof place.geometry.location.lat === 'function'
        ? place.geometry.location.lat()
        : (place.geometry.location as any).lat;
      const placeLng = typeof place.geometry.location.lng === 'function'
        ? place.geometry.location.lng()
        : (place.geometry.location as any).lng;

      if (typeof placeLat === 'number' && typeof placeLng === 'number') {
        const km = haversine(userLocation, { lat: placeLat, lng: placeLng });
        const miles = km * 0.621371;
        distanceLabel = formatDistanceLabel(miles);
      }
    } catch (err) {
      console.warn('Failed to calculate distance:', err);
    }
  }



  // Create limited ratings text
  let limitedRatingsText: string | null = null;
  if (place.user_ratings_total) {
    limitedRatingsText = `Google reviews (${place.user_ratings_total})`;
  }

  return {
    id: `google:${place.place_id}`,
    name: place.name || 'Unknown',
    coverImage,
    priceText,
    distanceLabel,
    subtitleText: place.vicinity || 'Popular nearby',
    badgeText: null,
    badgeColor: null,
    limitedRatingsText,
    reviewCountText: null,
    source: 'google',
    googlePlaceId: place.place_id
  };
}
