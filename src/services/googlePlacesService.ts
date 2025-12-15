import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDH-MgeMBC3_yvge3yLz_gaCl_2x8Ra6PY';
const GOOGLE_MAPS_LIBRARIES = ['places'];

type LatLngLiteral = { lat: number; lng: number };

export interface SavedGooglePlace {
  name: string;
  address: string;
  phone?: string;
  coordinates: LatLngLiteral;
  cuisine: string;
  googlePlaceId: string;
  googlePhotos: string[];
  hours?: Record<string, string>;
  website?: string;
  priceLevel?: number | null;
  googleRating?: number | null;
  source: 'google_places';
  createdAt: ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

type PlaceDetailsResult = google.maps.places.PlaceResult;

let googleMapsPromise: Promise<void> | null = null;

const ensureGoogleMapsLoaded = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps is only available in the browser.');
  }

  if (typeof google !== 'undefined' && google.maps?.places) {
    return;
  }

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
      if (existingScript && existingScript.dataset.tipPlacesLoaded === 'true') {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=${GOOGLE_MAPS_LIBRARIES.join(',')}`;
      script.async = true;
      script.defer = true;
      script.dataset.tipPlacesLoaded = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }

  await googleMapsPromise;
};

const createPlacesService = () => {
  const div = document.createElement('div');
  return new google.maps.places.PlacesService(div);
};

const deriveCuisineFromTypes = (types?: string[]): string => {
  if (!types || !types.length) return 'Restaurant';
  const restaurantType = types.find((type) => type.endsWith('_restaurant') || type.includes('restaurant'));
  if (!restaurantType) {
    const fallback = types[0];
    return fallback.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const cleaned = restaurantType.replace(/_restaurant$/, '').replace(/_/g, ' ');
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Restaurant';
};

const buildHoursObject = (weekdayText?: string[]): Record<string, string> | undefined => {
  if (!weekdayText || !weekdayText.length) return undefined;
  return weekdayText.reduce<Record<string, string>>((acc, line) => {
    const [day, ...rest] = line.split(':');
    if (!day) return acc;
    acc[day.trim()] = rest.join(':').trim();
    return acc;
  }, {});
};

export const searchPlaces = async (query: string, location?: LatLngLiteral) => {
  if (!query || query.length < 2) return [];
  await ensureGoogleMapsLoaded();

  return new Promise<google.maps.places.AutocompletePrediction[]>((resolve, reject) => {
    const service = new google.maps.places.AutocompleteService();
    const request: google.maps.places.AutocompletionRequest = {
      input: query,
      types: ['restaurant'],
      componentRestrictions: { country: 'us' }
    };

    if (location) {
      request.location = new google.maps.LatLng(location.lat, location.lng);
      request.radius = 50000;
    }

    service.getPlacePredictions(request, (predictions, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        resolve(predictions);
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error(`Autocomplete failed: ${status}`));
      }
    });
  });
};

export const getPlaceDetails = async (placeId: string): Promise<PlaceDetailsResult> => {
  if (!placeId) {
    throw new Error('placeId is required');
  }

  await ensureGoogleMapsLoaded();

  return new Promise<PlaceDetailsResult>((resolve, reject) => {
    const service = createPlacesService();
    const request: google.maps.places.PlaceDetailsRequest = {
      placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'formatted_phone_number',
        'geometry',
        'types',
        'photos',
        'opening_hours',
        'website',
        'price_level',
        'rating',
        'utc_offset_minutes'
      ]
    };

    service.getDetails(request, (result, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && result) {
        resolve(result);
      } else {
        reject(new Error(`Failed to fetch place details: ${status}`));
      }
    });
  });
};

export const saveGooglePlaceToFirestore = async (placeDetails: PlaceDetailsResult) => {
  if (!placeDetails.place_id) {
    throw new Error('Place details must include place_id');
  }
  const location = placeDetails.geometry?.location;
  if (!location) {
    throw new Error('Place details must include geometry');
  }

  const coordinates: LatLngLiteral = {
    lat: typeof location.lat === 'function' ? location.lat() : (location as any).lat,
    lng: typeof location.lng === 'function' ? location.lng() : (location as any).lng
  };

  const docRef = doc(db, 'restaurants', placeDetails.place_id);
  const payload: SavedGooglePlace = {
    name: placeDetails.name || 'Unnamed Restaurant',
    address: placeDetails.formatted_address || '',
    phone: placeDetails.formatted_phone_number || undefined,
    coordinates,
    cuisine: deriveCuisineFromTypes(placeDetails.types),
    googlePlaceId: placeDetails.place_id,
    googlePhotos: (placeDetails.photos || []).slice(0, 6).map((photo) =>
      photo.getUrl({ maxWidth: 1600, maxHeight: 1600 })
    ),
    hours: buildHoursObject(placeDetails.opening_hours?.weekday_text),
    website: placeDetails.website || undefined,
    priceLevel: placeDetails.price_level ?? undefined,
    googleRating: placeDetails.rating ?? undefined,
    source: 'google_places',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(docRef, payload, { merge: true });
  return payload;
};

export interface GoogleFallbackPlace {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: google.maps.places.PlacePhoto[];
  geometry?: {
    location?: google.maps.LatLng | google.maps.LatLngLiteral;
  };
}

export const searchNearbyForDish = async (
  keyword: string,
  location: LatLngLiteral
): Promise<GoogleFallbackPlace[]> => {
  if (!keyword || keyword.length < 3 || !location) {
    return [];
  }

  await ensureGoogleMapsLoaded();

  return new Promise<GoogleFallbackPlace[]>((resolve, reject) => {
    const service = createPlacesService();
    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(location.lat, location.lng),
      radius: 10000, // 10km
      type: 'restaurant',
      keyword
    };

    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const mapped = results.slice(0, 5).map((result) => ({
          place_id: result.place_id || `google_${Math.random()}`,
          name: result.name || 'Unknown',
          vicinity: result.vicinity || '',
          rating: result.rating,
          user_ratings_total: result.user_ratings_total,
          price_level: result.price_level,
          photos: result.photos,
          geometry: result.geometry
        }));
        resolve(mapped);
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error(`Nearby search failed: ${status}`));
      }
    });
  });
};
