import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Camera, Loader2, MapPin, Plus, Trash2, Video, X, AlertCircle, Bookmark } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';
import { db } from '../../lib/firebase';
import { useI18n } from '../../lib/i18n/useI18n';
import { RestaurantOption, DishOption } from './types';
import { useReviewWizard } from './WizardContext';
import CreateRestaurantModal from './CreateRestaurantModal';
import AddDishInline from './AddDishInline';
import { CUISINES, getCuisineLabel } from '../../utils/taxonomy';
import { saveGooglePlaceToFirestore, searchNearbyRestaurants, GoogleFallbackPlace } from '../../services/googlePlacesService';
import { MealTimeTag } from '../../dev/types/review';
import { getQualityColor } from '../../utils/qualityScore';

const MEAL_TIME_OPTIONS: Array<{ value: MealTimeTag; labelKey: string; emoji: string; fallback: string }> = [
  { value: 'breakfast', labelKey: 'mealTime.breakfast', emoji: '\u{1F373}', fallback: 'Breakfast' },
  { value: 'brunch', labelKey: 'mealTime.brunch', emoji: '\u{1F942}', fallback: 'Brunch' },
  { value: 'lunch', labelKey: 'mealTime.lunch', emoji: '\u{1F96A}', fallback: 'Lunch' },
  { value: 'dinner', labelKey: 'mealTime.dinner', emoji: '\u{1F37D}\uFE0F', fallback: 'Dinner' },
  { value: 'late_night', labelKey: 'mealTime.lateNight', emoji: '\u{1F319}', fallback: 'Late Night' },
  { value: 'dessert', labelKey: 'mealTime.dessert', emoji: '\u{1F370}', fallback: 'Dessert' },
  { value: 'date_night', labelKey: 'mealTime.dateNight', emoji: '\u2764\uFE0F', fallback: 'Date Night' }
];

const PRICE_LEVELS: Array<'$' | '$$' | '$$$' | '$$$$'> = ['$', '$$', '$$$', '$$$$'];

const NEARBY_RADIUS_MILES = 5;
const MAX_NEARBY_RESULTS = 10;

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const libraries: ('places')[] = ['places'];

// Memoized Restaurant Search Input to prevent re-renders from mediaItems changes
const RestaurantSearchInput = React.memo(({
  value,
  onChange,
  placeholder,
  className,
  inputRef,
  onClear
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  className: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onClear?: () => void;
}) => {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Prevent page scroll when input focuses
    e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  const showClear = value.trim().length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        inputMode="search"
        enterKeyHint="search"
        onFocus={handleFocus}
        ref={inputRef}
      />
      {showClear ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <MapPin className="absolute right-4 top-3.5 h-5 w-5 text-slate-400" />
      )}
    </div>
  );
});

RestaurantSearchInput.displayName = 'RestaurantSearchInput';

// Memoized Location Banner to prevent re-renders
const LocationBanner = React.memo(({
  onEnable,
  onDismiss,
  isLoading
}: {
  onEnable: () => void;
  onDismiss: () => void;
  isLoading: boolean;
}) => {
  return (
    <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-slate-900 shadow-sm">
      <div className="text-center text-sm font-semibold mb-3">
        📍 Enable location for nearby restaurants
      </div>
      <div className="grid grid-cols-5 items-center">
        <div />
        <div className="flex justify-center">
          <button
            onClick={onEnable}
            disabled={isLoading}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Enabling...' : 'Enable'}
          </button>
        </div>
        <div />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
          >
            Maybe Later
          </button>
        </div>
        <div />
      </div>
    </div>
  );
});

LocationBanner.displayName = 'LocationBanner';

const StepVisit: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();
  const {
    visitDraft,
    setVisitDraft,
    mediaItems,
    uploadMedia,
    removeMedia,
    pendingUploadCount,
    selectedRestaurant,
    selectRestaurant,
    goNext,
    currentStep,
    goBack,
    dishDrafts,
  } = useReviewWizard();

  // Helper function to count how many dishes use a specific media item
  const getAttachedDishCount = (mediaId: string): number => {
    return dishDrafts.filter(d => d.mediaIds.includes(mediaId)).length;
  };

  const [restaurantQuery, setRestaurantQuery] = useState('');
  const restaurantSearchRef = useRef<HTMLInputElement>(null);
  const restaurantResultsRef = useRef<HTMLDivElement>(null);
  const [didFocusSearch, setDidFocusSearch] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [showCreateRestaurant, setShowCreateRestaurant] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries
  });
  const [placePredictions, setPlacePredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [fetchingPlaceDetails, setFetchingPlaceDetails] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [predictionDistances, setPredictionDistances] = useState<Record<string, number | undefined>>({});
  const [showLocationBanner, setShowLocationBanner] = useState(!userLocation);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [nearbyGooglePlaces, setNearbyGooglePlaces] = useState<GoogleFallbackPlace[]>([]);
  const [loadingNearbyPlaces, setLoadingNearbyPlaces] = useState(false);


  useEffect(() => {
    const shouldFocus = Boolean((location.state as any)?.focusRestaurantSearch);
    if (!shouldFocus || didFocusSearch) return;
    setDidFocusSearch(true);
    window.setTimeout(() => {
      restaurantSearchRef.current?.focus();
    }, 100);
  }, [location.state, didFocusSearch]);

  const requestLocationPermission = React.useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setRequestingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setShowLocationBanner(false);
        setRequestingLocation(false);
      },
      (error) => {
        setRequestingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Enable it in your browser settings.');
          setShowLocationBanner(false);
        } else {
          setLocationError('Unable to get location. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, []);

  const isFoodOrDrinkPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!prediction.types || prediction.types.length === 0) return true;
    return prediction.types.some((type) =>
      type.includes('restaurant') ||
      type.includes('food') ||
      type.includes('cafe') ||
      type.includes('bar') ||
      type.includes('brewery') ||
      type.includes('winery') ||
      type.includes('distillery') ||
      type.includes('night_club') ||
      type === 'meal_takeaway' ||
      type === 'meal_delivery'
    );
  };

  const fetchGooglePlaces = async (searchText: string) => {
    if (!searchText || searchText.length < 2 || !mapsLoaded || typeof google === 'undefined') return;

    try {
      const service = new google.maps.places.AutocompleteService();
      const request = {
        input: searchText,
        types: ['establishment']
      };

      service.getPlacePredictions(request, async (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          const filtered = predictions.filter(isFoodOrDrinkPrediction);
          const finalList = filtered.length > 0 ? filtered : predictions;
          setPlacePredictions(finalList.slice(0, 5));
        } else {
          setPlacePredictions([]);
        }
      });
    } catch (error) {
      console.error('Error fetching Google Places:', error);
    }
  };

  // Fetch Firebase restaurants - only when location is available, filtered to nearby
  useEffect(() => {
    // If no location, don't preload restaurants (user will still see results when they search)
    if (!userLocation) {
      setRestaurants([]);
      return;
    }

    const fetchNearbyRestaurants = async () => {
      try {
        setLoadingRestaurants(true);
        // Fetch all restaurants from Firebase
        const snapshot = await getDocs(collection(db, 'restaurants'));
        const allRestaurants: RestaurantOption[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as RestaurantOption)
        }));

        // Filter to only restaurants within radius that have quality scores
        const nearbyWithQuality = allRestaurants.filter((restaurant) => {
          if (!restaurant.coordinates) return false;

          const lat = restaurant.coordinates.lat || (restaurant.coordinates as any).latitude || 0;
          const lng = restaurant.coordinates.lng || (restaurant.coordinates as any).longitude || 0;

          if (!lat || !lng) return false;

          const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
          return distance <= NEARBY_RADIUS_MILES && restaurant.qualityScore != null;
        });

        setRestaurants(nearbyWithQuality);
      } catch (error) {
        console.error('Failed to load restaurants', error);
        setRestaurantError(t('createWizard.status.error'));
      } finally {
        setLoadingRestaurants(false);
      }
    };
    fetchNearbyRestaurants();
  }, [userLocation, t]);

  // Fetch nearby Google Places when location is available
  useEffect(() => {
    if (!userLocation || !mapsLoaded) {
      setNearbyGooglePlaces([]);
      return;
    }

    const fetchNearbyGooglePlaces = async () => {
      setLoadingNearbyPlaces(true);
      try {
        const places = await searchNearbyRestaurants(
          userLocation,
          NEARBY_RADIUS_MILES,
          MAX_NEARBY_RESULTS,
          { allowBeverage: true }
        );
        setNearbyGooglePlaces(places);
      } catch (error) {
        console.error('Failed to fetch nearby Google Places:', error);
        setNearbyGooglePlaces([]);
      } finally {
        setLoadingNearbyPlaces(false);
      }
    };

    fetchNearbyGooglePlaces();
  }, [userLocation, mapsLoaded]);

  useEffect(() => {
    if (selectedRestaurant) {
      setRestaurantQuery(selectedRestaurant.name);
    }
  }, [selectedRestaurant]);

  const handleRestaurantQueryChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setRestaurantQuery(value);

    if (!userLocation && showLocationBanner && value.length > 0 && !requestingLocation) {
      requestLocationPermission();
    }

    if (mapsLoaded && value.length >= 2) {
      fetchGooglePlaces(value);
    } else {
      setPlacePredictions([]);
    }
  }, [userLocation, showLocationBanner, requestingLocation, mapsLoaded, requestLocationPermission]);

  const handleClearRestaurantQuery = () => {
    setRestaurantQuery('');
    setPlacePredictions([]);
    setRestaurantError(null);
  };

  const nearbyRestaurants = useMemo(() => {
    // If user is searching, filter and return search results
    if (restaurantQuery.trim().length >= 2) {
      const lower = restaurantQuery.toLowerCase();
      const filtered = restaurants.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(lower)
      );

      // Add distance calculation and sorting
      const withDistance = filtered.map((restaurant) => {
        const lat = restaurant.coordinates?.lat || (restaurant.coordinates as any)?.latitude || 0;
        const lng = restaurant.coordinates?.lng || (restaurant.coordinates as any)?.longitude || 0;
        const distance = userLocation && lat && lng
          ? calculateDistance(userLocation.lat, userLocation.lng, lat, lng)
          : undefined;
        return { ...restaurant, calculatedDistance: distance };
      });

      withDistance.sort((a, b) => {
        // Sort by distance first, then quality score
        if (userLocation) {
          const distA = a.calculatedDistance ?? Infinity;
          const distB = b.calculatedDistance ?? Infinity;
          if (distA !== distB) return distA - distB;
        }
        const scoreA = a.qualityScore ?? 0;
        const scoreB = b.qualityScore ?? 0;
        return scoreB - scoreA;
      });

      return withDistance.slice(0, MAX_NEARBY_RESULTS);
    }

    // No search query - show hybrid nearby results
    if (!userLocation) {
      return []; // No preloaded results without location
    }

    // Firebase restaurants with quality scores (already filtered in fetch)
    const firebaseNearby = restaurants.map((restaurant) => {
      const lat = restaurant.coordinates?.lat || (restaurant.coordinates as any)?.latitude || 0;
      const lng = restaurant.coordinates?.lng || (restaurant.coordinates as any)?.longitude || 0;
      const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
      return { ...restaurant, calculatedDistance: distance };
    });

    // Sort Firebase results by quality score (distance already filtered)
    firebaseNearby.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

    // Calculate how many slots Google Places should fill
    const firebaseCount = firebaseNearby.length;
    const googleSlotsNeeded = Math.max(0, MAX_NEARBY_RESULTS - firebaseCount);

    // Convert Google Places to RestaurantOption format
    const googlePlacesAsOptions: (RestaurantOption & { calculatedDistance?: number })[] = nearbyGooglePlaces
      .slice(0, googleSlotsNeeded)
      .filter((place) => {
        // Exclude places that already exist in Firebase results
        return !firebaseNearby.some((r) => r.googlePlaceId === place.place_id);
      })
      .map((place) => {
        const lat = typeof place.geometry?.location?.lat === 'function'
          ? place.geometry.location.lat()
          : (place.geometry?.location as any)?.lat || 0;
        const lng = typeof place.geometry?.location?.lng === 'function'
          ? place.geometry.location.lng()
          : (place.geometry?.location as any)?.lng || 0;

        const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);

        return {
          id: place.place_id,
          name: place.name,
          address: place.vicinity,
          coordinates: { lat, lng, latitude: lat, longitude: lng },
          googlePlaceId: place.place_id,
          source: 'google_places' as const,
          qualityScore: null,
          calculatedDistance: distance,
        };
      });

    // Combine: Firebase first (sorted by quality), then Google Places
    return [...firebaseNearby, ...googlePlacesAsOptions].slice(0, MAX_NEARBY_RESULTS);
  }, [restaurantQuery, restaurants, nearbyGooglePlaces, userLocation]);

  const normalizedRestaurantQuery = restaurantQuery.trim().toLowerCase();
  const hasExactMatch = Boolean(
    normalizedRestaurantQuery &&
      (nearbyRestaurants.some((restaurant) =>
        restaurant.name?.toLowerCase() === normalizedRestaurantQuery
      ) ||
        restaurants.some((restaurant) =>
          restaurant.name?.toLowerCase() === normalizedRestaurantQuery
        ) ||
        placePredictions.some((prediction) => {
          const mainText = prediction.structured_formatting?.main_text?.toLowerCase() || '';
          const description = prediction.description?.toLowerCase() || '';
          return mainText === normalizedRestaurantQuery || description === normalizedRestaurantQuery;
        }))
  );
  const showCreateRestaurantOption = normalizedRestaurantQuery.length >= 2 && !hasExactMatch;

  useEffect(() => {
    if (!restaurantQuery.trim()) return;
    const target = restaurantResultsRef.current;
    if (!target) return;
    const raf = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [restaurantQuery, placePredictions.length, nearbyRestaurants.length]);

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setMediaError(null);
    try {
      await uploadMedia(Array.from(files));
    } catch (error) {
      console.error('Upload error', error);
      setMediaError(t('media.errors.unknown'));
    } finally {
      event.target.value = '';
    }
  };

  const onRestaurantSelected = (restaurant: RestaurantOption) => {
    selectRestaurant(restaurant);
    setShowCreateRestaurant(false);
    setRestaurantQuery(restaurant.name || '');
    setPlacePredictions([]);
  };

  const handleGooglePlaceSelected = async (placeId: string, description: string) => {
    if (typeof google === 'undefined') {
      return;
    }
    const predictionMatch = placePredictions.find((prediction) => prediction.place_id === placeId);
    setFetchingPlaceDetails(true);

    const container = document.createElement('div');
    const service = new google.maps.places.PlacesService(container);

    service.getDetails(
      {
        placeId,
        fields: [
          'name',
          'formatted_address',
          'formatted_phone_number',
          'geometry',
          'place_id',
          'types',
          'photos',
          'opening_hours',
          'website',
          'price_level',
          'rating',
          'address_components'
        ]
      },
      async (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          try {
            const placeQuery = query(collection(db, 'restaurants'), where('googlePlaceId', '==', placeId));
            const snapshot = await getDocs(placeQuery);

            if (!snapshot.empty) {
              const docSnap = snapshot.docs[0];
              const existing =
                restaurants.find((restaurant) => restaurant.id === docSnap.id) ??
                ({
                  id: docSnap.id,
                  ...(docSnap.data() as RestaurantOption)
                } as RestaurantOption);
              if (existing) {
                onRestaurantSelected(existing);
              }
            } else {
              const lat = place.geometry?.location?.lat() || 0;
              const lng = place.geometry?.location?.lng() || 0;
              const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, lat, lng) : undefined;

              // Extract country from address_components
              const countryComponent = (place as any).address_components?.find(
                (c: any) => c.types?.includes('country')
              );
              const countryCode = countryComponent?.short_name || '';
              const countryName = countryComponent?.long_name || '';

              const newRestaurant: RestaurantOption = {
                id: placeId,
                name: place.name || predictionMatch?.structured_formatting?.main_text || description,
                address: place.formatted_address || '',
                location: { formatted: place.formatted_address || '' },
                coordinates: {
                  lat,
                  lng,
                  latitude: lat,
                  longitude: lng
                },
                googlePlaceId: placeId,
                cuisines: [],
                distance,
                source: 'google_places',
                ...(countryCode ? { countryCode, countryName } : {}),
              };
              onRestaurantSelected(newRestaurant);
              setRestaurants((prev) => {
                if (prev.some((r) => r.id === newRestaurant.id)) {
                  return prev;
                }
                return [...prev, newRestaurant];
              });

              saveGooglePlaceToFirestore(place).catch((error) => {
                console.warn('Failed to save Google place to Firestore:', error);
              });
            }

            setRestaurantQuery(place.name || predictionMatch?.description || description);
            setPlacePredictions([]);
          } catch (error) {
            console.error('Error handling Google place selection', error);
          }
        }
        setFetchingPlaceDetails(false);
      }
    );
  };

  useEffect(() => {
    if (!mapsLoaded || typeof google === 'undefined') {
      return;
    }
    if (!placePredictions.length || !userLocation) {
      setPredictionDistances({});
      return;
    }

    const container = document.createElement('div');
    const service = new google.maps.places.PlacesService(container);
    let isCancelled = false;

    setPredictionDistances({});

    placePredictions.forEach((prediction) => {
      service.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['geometry']
        },
        (place, status) => {
          if (isCancelled) {
            return;
          }
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            if (typeof lat === 'number' && typeof lng === 'number') {
              const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
              setPredictionDistances((prev) => ({
                ...prev,
                [prediction.place_id]: distance
              }));
            }
          }
        }
      );
    });

    return () => {
      isCancelled = true;
    };
  }, [placePredictions, mapsLoaded, userLocation]);

  const canProceed = !!selectedRestaurant;

  const handleNext = () => {
    if (!canProceed) return;
    goNext();
  };

  const toggleMealTime = (time: MealTimeTag) => {
    setVisitDraft(prev => ({
      ...prev,
      mealTime: prev.mealTime === time ? undefined : time,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Media Upload */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('review.addMedia')}</h2>
          <p className="text-sm text-slate-500">{t('media.imageLimit')} / {t('media.videoLimit')}</p>
          {pendingUploadCount > 0 ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading {pendingUploadCount} file{pendingUploadCount !== 1 ? 's' : ''}...
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 text-center transition hover:border-red-200 hover:bg-red-50">
            <input type="file" accept="image/*,video/mp4,video/webm" multiple className="hidden" onChange={handleFileInput} />
            <div className="rounded-full bg-red-100 p-3 text-red-500">
              <Camera className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">{t('media.addMedia')}</p>
            <p className="text-xs text-slate-400">{t('media.dragDrop')} <span className="text-red-500">{t('media.browse')}</span></p>
          </label>
          {mediaError ? <p className="text-sm text-red-500">{mediaError}</p> : null}
          {mediaItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" style={{ contentVisibility: 'auto', contain: 'layout style paint' }}>
              {mediaItems.map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200">
                  {item.kind === 'photo' ? (
                    <img
                      src={item.downloadURL || item.previewUrl}
                      alt="Visit media"
                      className="h-36 w-full object-cover"
                      decoding="async"
                      loading="lazy"
                    />
                  ) : (
                    <div className="relative h-36 w-full overflow-hidden bg-black/5">
                      <video src={item.downloadURL || item.previewUrl} className="h-full w-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-8 w-8 text-white drop-shadow" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col justify-between p-3">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className={`rounded-full px-2 py-1 text-white ${item.status === 'uploaded' ? 'bg-emerald-500' : item.status === 'uploading' ? 'bg-amber-500' : item.status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`}>
                        {item.status === 'uploading' && t('createWizard.status.autosaving')}
                        {item.status === 'uploaded' && t('createWizard.status.saved')}
                        {item.status === 'error' && t('createWizard.status.error')}
                        {item.status === 'idle' && ''}
                      </span>
                      {getAttachedDishCount(item.id) > 0 && (
                        <span className="rounded-full bg-blue-500 px-2 py-1 text-white shadow-sm">
                          Used in {getAttachedDishCount(item.id)} dish{getAttachedDishCount(item.id) > 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => removeMedia(item.id)} className="flex items-center gap-1 self-end rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-red-500 opacity-0 transition group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                      {t('media.remove')}
                    </button>
                  </div>
                  {item.status === 'uploading' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                      <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                    </div>
                  ) : null}
                  {item.error ? (
                    <div className="absolute inset-x-0 bottom-0 bg-red-500/90 p-2 text-xs text-white">
                      {item.error}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Restaurant Selection */}
      <section
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6"
        data-tour="create-visit-intro"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('basic.restaurant')}</h2>
        </div>

        {showLocationBanner && !userLocation && (
          <LocationBanner
            onEnable={requestLocationPermission}
            onDismiss={() => setShowLocationBanner(false)}
            isLoading={requestingLocation}
          />
        )}

        {locationError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">
                Location access needed to see nearby restaurants
              </p>
              <p className="text-xs text-red-700 mt-1">
                Enable location in your browser settings or try again
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {/* Selected Restaurant Display */}
          {selectedRestaurant ? (
            <div className="mt-4">
              <div className="w-full rounded-2xl border-2 border-red-400 bg-red-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedRestaurant.name}</p>
                      {(selectedRestaurant.address || selectedRestaurant.location?.formatted) && (
                        <p className="text-xs text-slate-500">
                          {selectedRestaurant.address || selectedRestaurant.location?.formatted}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      selectRestaurant(null);
                      setRestaurantQuery('');
                      setPlacePredictions([]);
                    }}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4">
                <RestaurantSearchInput
                  value={restaurantQuery}
                  onChange={handleRestaurantQueryChange}
                  placeholder="Search for a restaurant..."
                  className="w-full rounded-2xl border border-slate-200 px-4 pr-12 py-3 text-base text-slate-700 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                  inputRef={restaurantSearchRef}
                  onClear={handleClearRestaurantQuery}
                />
              </div>
              {restaurantError ? <p className="text-sm text-red-500">{restaurantError}</p> : null}
              <div className="mt-4" ref={restaurantResultsRef}>
            {loadingRestaurants || fetchingPlaceDetails ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {fetchingPlaceDetails ? 'Loading restaurant details...' : t('createWizard.status.loading')}
              </div>
            ) : (
              <>
                {placePredictions.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">From Google Places</p>
                    {placePredictions.map((prediction) => {
                      const existingRestaurant = restaurants.find((r) => r.googlePlaceId === prediction.place_id);
                      const distance = predictionDistances[prediction.place_id];

                      return (
                        <button
                          key={prediction.place_id}
                          type="button"
                          onClick={() => {
                            if (existingRestaurant) {
                              onRestaurantSelected(existingRestaurant);
                              setRestaurantQuery(existingRestaurant.name);
                              setPlacePredictions([]);
                            } else {
                              handleGooglePlaceSelected(prediction.place_id, prediction.description);
                            }
                          }}
                          className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{prediction.structured_formatting.main_text}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  {prediction.structured_formatting.secondary_text}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {typeof distance === 'number' && (
                                <span className="text-xs text-gray-500">{distance.toFixed(1)} mi</span>
                              )}
                              {existingRestaurant?.qualityScore != null ? (
                                <div className={`px-2 py-0.5 rounded-full ${getQualityColor(existingRestaurant.qualityScore)} flex items-center`}>
                                  <span className="text-xs font-medium text-white">
                                    {Math.round(existingRestaurant.qualityScore)}%
                                  </span>
                                </div>
                              ) : existingRestaurant ? (
                                <span className="text-xs text-gray-500">⭐ Be first</span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Only show nearby section when location is enabled OR user is searching */}
                {(userLocation || restaurantQuery.trim().length >= 2) && (
                  <div className="mb-4 space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {restaurantQuery.trim().length >= 2 ? 'Matching Restaurants' : 'Nearby Restaurants'}
                    </p>
                    {loadingNearbyPlaces && !restaurantQuery.trim() ? (
                      <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Finding nearby restaurants...
                      </div>
                    ) : nearbyRestaurants.length > 0 ? (
                      nearbyRestaurants.map((restaurant) => {
                        const distanceFromUser = (restaurant as any).calculatedDistance;
                        const isGoogleOnly = restaurant.source === 'google_places' && restaurant.qualityScore == null;

                        return (
                          <button
                            key={restaurant.id}
                            type="button"
                            onClick={() => onRestaurantSelected(restaurant)}
                            className="w-full rounded-2xl border px-3 py-2 text-left transition border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <div className="flex gap-2 flex-1 min-w-0 items-center">
                                <MapPin className={`w-4 h-4 flex-shrink-0 ${isGoogleOnly ? 'text-red-500' : 'text-gray-400'}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{restaurant.name}</p>
                                  {restaurant.address && (
                                    <p className="text-xs text-slate-500 truncate">{restaurant.address}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {restaurant.qualityScore != null ? (
                                  <div className={`px-2 py-0.5 rounded-full ${getQualityColor(restaurant.qualityScore)} flex items-center`}>
                                    <span className="text-xs font-medium text-white">
                                      {Math.round(restaurant.qualityScore)}%
                                    </span>
                                  </div>
                                ) : (
                                  <div className="px-2 py-0.5 rounded-full bg-gray-200 flex items-center">
                                    <span className="text-xs font-medium text-gray-600">New</span>
                                  </div>
                                )}
                                {typeof distanceFromUser === 'number' && (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {distanceFromUser.toFixed(1)} mi
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500 py-2">
                        {restaurantQuery.trim() ? 'No matching restaurants found' : 'No nearby restaurants found'}
                      </p>
                    )}
                  </div>
                )}

                {/* Hint when no location and not searching */}
                {!userLocation && restaurantQuery.trim().length < 2 && (
                  <p className="text-xs text-slate-400 py-2 text-center">
                    Enable location to see nearby restaurants, or search above
                  </p>
                )}

                {showCreateRestaurantOption && (
                  <button
                    type="button"
                    onClick={() => setShowCreateRestaurant(true)}
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-left transition hover:border-red-300 hover:bg-red-50"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-slate-700">
                        Add "{restaurantQuery.trim()}" as a new vendor
                      </span>
                    </div>
                  </button>
                )}
              </>
            )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* To-Go Order Selection */}
      {selectedRestaurant && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Did you order to-go?</h3>
            <p className="text-sm text-slate-500">Select one</p>
          </div>
          <div className="flex gap-2">
            {(['yes', 'no'] as const).map((option) => {
              const active = visitDraft.isToGo === (option === 'yes');
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisitDraft((prev) => ({
                    ...prev,
                    isToGo: option === 'yes'
                  }))}
                  className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition ${
                    active
                      ? 'bg-red-500 text-white shadow-md shadow-red-200/60'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Restaurant Price Level */}
      {selectedRestaurant && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">How expensive is this restaurant?</h3>
            <p className="text-sm text-slate-500">Select one</p>
          </div>
          <div className="flex gap-2">
            {PRICE_LEVELS.map((level) => {
              const active = visitDraft.restaurantPriceLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setVisitDraft((prev) => ({
                    ...prev,
                    restaurantPriceLevel: prev.restaurantPriceLevel === level ? null : level
                  }))}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    active
                      ? 'bg-red-500 text-white shadow-md shadow-red-200/60'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Meal Time Selection */}
      {selectedRestaurant && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Why did you dine?</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {MEAL_TIME_OPTIONS.map((option) => {
              const active = visitDraft.mealTime === option.value;
              const label = t(option.labelKey);
              const displayLabel = label && label !== option.labelKey ? label : option.fallback;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleMealTime(option.value)}
                  className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200/60'
                      : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  <span>{option.emoji}</span>
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={currentStep === 0}
          className="flex-1 rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          className="flex-1 rounded-2xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      {showCreateRestaurant && (
        <CreateRestaurantModal
          isOpen={showCreateRestaurant}
          defaultName={restaurantQuery}
          userId={''}
          onClose={() => setShowCreateRestaurant(false)}
          onCreated={onRestaurantSelected}
        />
      )}
    </div>
  );
};

export default StepVisit;
