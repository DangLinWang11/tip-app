import React, { useEffect, useMemo, useState } from 'react';
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
import { saveGooglePlaceToFirestore } from '../../services/googlePlacesService';
import { MealTimeTag } from '../../dev/types/review';
import { getQualityColor } from '../../utils/qualityScore';

const MEAL_TIME_OPTIONS: Array<{ value: MealTimeTag; labelKey: string; emoji: string; fallback: string }> = [
  { value: 'breakfast', labelKey: 'mealTime.breakfast', emoji: '🌅', fallback: 'Breakfast' },
  { value: 'brunch', labelKey: 'mealTime.brunch', emoji: '🥂', fallback: 'Brunch' },
  { value: 'lunch', labelKey: 'mealTime.lunch', emoji: '🌤️', fallback: 'Lunch' },
  { value: 'dinner', labelKey: 'mealTime.dinner', emoji: '🌙', fallback: 'Dinner' },
  { value: 'late_night', labelKey: 'mealTime.lateNight', emoji: '🌃', fallback: 'Late Night' },
  { value: 'dessert', labelKey: 'mealTime.dessert', emoji: '🍰', fallback: 'Dessert' },
  { value: 'snack', labelKey: 'mealTime.snack', emoji: '🍿', fallback: 'Snack' }
];

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

const StepVisit: React.FC = () => {
  const { t } = useI18n();
  const {
    visitDraft,
    setVisitDraft,
    mediaItems,
    uploadMedia,
    removeMedia,
    pendingUploads,
    selectedRestaurant,
    selectRestaurant,
    goNext,
    currentStep,
    goBack,
  } = useReviewWizard();

  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [showCreateRestaurant, setShowCreateRestaurant] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: 'AIzaSyDH-MgeMBC3_yvge3yLz_gaCl_2x8Ra6PY',
    libraries
  });
  const [placePredictions, setPlacePredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [fetchingPlaceDetails, setFetchingPlaceDetails] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [predictionDistances, setPredictionDistances] = useState<Record<string, number | undefined>>({});
  const [showLocationBanner, setShowLocationBanner] = useState(!userLocation);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);

  const requestLocationPermission = async () => {
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
  };

  const fetchGooglePlaces = async (searchText: string) => {
    if (!searchText || searchText.length < 2 || !mapsLoaded || typeof google === 'undefined') return;

    try {
      const service = new google.maps.places.AutocompleteService();
      const request = {
        input: searchText,
        types: ['restaurant'],
        componentRestrictions: { country: 'us' }
      };

      service.getPlacePredictions(request, async (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setPlacePredictions(predictions.slice(0, 5));
        } else {
          setPlacePredictions([]);
        }
      });
    } catch (error) {
      console.error('Error fetching Google Places:', error);
    }
  };

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true);
        const snapshot = await getDocs(collection(db, 'restaurants'));
        const list: RestaurantOption[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as RestaurantOption)
        }));
        setRestaurants(list);
      } catch (error) {
        console.error('Failed to load restaurants', error);
        setRestaurantError(t('createWizard.status.error'));
      } finally {
        setLoadingRestaurants(false);
      }
    };
    fetchRestaurants();
  }, [t]);

  useEffect(() => {
    if (selectedRestaurant) {
      setRestaurantQuery(selectedRestaurant.name);
    }
  }, [selectedRestaurant]);

  const handleRestaurantQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const filteredRestaurants = useMemo(() => {
    if (!restaurantQuery.trim()) return restaurants.slice(0, 6);
    const lower = restaurantQuery.toLowerCase();
    return restaurants.filter((restaurant) => restaurant.name.toLowerCase().includes(lower)).slice(0, 6);
  }, [restaurantQuery, restaurants]);

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
          'rating'
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

              const newRestaurant: RestaurantOption = {
                id: placeId,
                name: place.name || predictionMatch?.structured_formatting?.main_text || description,
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
                source: 'google_places'
              };
              onRestaurantSelected(newRestaurant);

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

  const canProceed = !!selectedRestaurant && !pendingUploads;

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
    <div className="space-y-8">
      {/* Media Upload */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('review.addMedia')}</h2>
          <p className="text-sm text-slate-500">{t('media.imageLimit')} / {t('media.videoLimit')}</p>
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {mediaItems.map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200">
                  {item.kind === 'photo' ? (
                    <img src={item.downloadURL || item.previewUrl} alt="Visit media" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="relative h-36 w-full overflow-hidden bg-black/5">
                      <video src={item.downloadURL || item.previewUrl} className="h-full w-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-8 w-8 text-white drop-shadow" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col justify-between p-3">
                    <div className="flex justify-between text-xs">
                      <span className={`rounded-full px-2 py-1 text-white ${item.status === 'uploaded' ? 'bg-emerald-500' : item.status === 'uploading' ? 'bg-amber-500' : item.status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`}>
                        {item.status === 'uploading' && t('createWizard.status.autosaving')}
                        {item.status === 'uploaded' && t('createWizard.status.saved')}
                        {item.status === 'error' && t('createWizard.status.error')}
                        {item.status === 'idle' && ''}
                      </span>
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
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('basic.restaurant')}</h2>
        </div>

        {showLocationBanner && !userLocation && (
          <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-slate-900 shadow-sm">
            <div className="text-center text-sm font-semibold mb-3">
              📍 Enable location for nearby restaurants
            </div>
            <div className="grid grid-cols-5 items-center">
              <div />
              <div className="flex justify-center">
                <button
                  onClick={requestLocationPermission}
                  disabled={requestingLocation}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requestingLocation ? 'Enabling...' : 'Enable'}
                </button>
              </div>
              <div />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowLocationBanner(false)}
                  className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
                >
                  Maybe Later
                </button>
              </div>
              <div />
            </div>
          </div>
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
          <div className="relative mt-4">
            <input
              type="text"
              value={restaurantQuery}
              onChange={handleRestaurantQueryChange}
              placeholder="Search for a restaurant..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-700 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <MapPin className="absolute right-4 top-3.5 h-5 w-5 text-slate-400" />
          </div>
          {restaurantError ? <p className="text-sm text-red-500">{restaurantError}</p> : null}
          <div className="mt-4">
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-sm truncate">{prediction.structured_formatting.main_text}</span>
                              </div>
                              <p className="text-xs text-slate-500 truncate pl-6">
                                {prediction.structured_formatting.secondary_text}
                              </p>
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
                              {existingRestaurant ? (
                                <Bookmark className="w-4 h-4 text-primary" />
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mb-4 space-y-1.5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Saved Restaurants</p>
                  {filteredRestaurants.length > 0 ? (
                    filteredRestaurants.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        type="button"
                        onClick={() => onRestaurantSelected(restaurant)}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition ${selectedRestaurant?.id === restaurant.id ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm truncate">{restaurant.name}</span>
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
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-2">No restaurants found</p>
                  )}
                </div>
                {selectedRestaurant && restaurantQuery.trim() && !filteredRestaurants.find(r => r.id === selectedRestaurant.id) && (
                  <button
                    type="button"
                    onClick={() => setShowCreateRestaurant(true)}
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-left transition hover:border-red-300 hover:bg-red-50"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-slate-700">Add "{restaurantQuery}" as a new restaurant</span>
                    </div>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Meal Time Selection */}
      {selectedRestaurant && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">When are you dining?</h2>
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

      {/* Visit Text */}
      {selectedRestaurant && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Comments or Concerns?</h2>
          </div>
          <textarea
            value={visitDraft.overallText || ''}
            onChange={(e) => setVisitDraft(prev => ({ ...prev, overallText: e.target.value || undefined }))}
            placeholder="Share what made this visit special..."
            rows={4}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
          />
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
