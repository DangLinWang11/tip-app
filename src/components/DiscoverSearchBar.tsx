import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2, MapPin, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { getCuisineLabel } from '../utils/taxonomy';
import {
  searchPlaces,
  getPlaceDetails,
  saveGooglePlaceToFirestore
} from '../services/googlePlacesService';

interface DiscoverSearchBarProps {
  userLocation?: { lat: number; lng: number } | null;
  onRestaurantSelect?: (restaurantId: string) => void;
}

interface SavedRestaurant {
  id: string;
  name: string;
  location?: { formatted?: string };
  address?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  cuisines?: string[];
  qualityScore?: number | null;
  coverImage?: string | null;
  headerImage?: string | null;
  googlePhotos?: string[];
  googleRating?: number | null;
  googlePlaceId?: string;
}

interface PredictionMeta {
  distance?: number;
  photoUrl?: string;
  address?: string;
  rating?: number | null;
  details?: google.maps.places.PlaceResult;
}

const FALLBACK_IMAGE = 'https://source.unsplash.com/80x80/?restaurant,food';

const getQualityColor = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'bg-slate-200';
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-green-400';
  if (score >= 70) return 'bg-yellow-400';
  if (score >= 60) return 'bg-orange-400';
  return 'bg-red-400';
};

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

const formatCuisineLabel = (value: string) => getCuisineLabel(value);

const DiscoverSearchBar: React.FC<DiscoverSearchBarProps> = ({ userLocation, onRestaurantSelect }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [savedRestaurants, setSavedRestaurants] = useState<SavedRestaurant[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [googlePredictions, setGooglePredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [predictionMeta, setPredictionMeta] = useState<Record<string, PredictionMeta>>({});
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchSavedRestaurants = async () => {
      try {
        setLoadingSaved(true);
        const snapshot = await getDocs(collection(db, 'restaurants'));
        if (!mounted) return;
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as SavedRestaurant)
        }));
        setSavedRestaurants(list);
      } catch (error) {
        console.error('Failed to load saved restaurants', error);
        setSavedError('Unable to load restaurants right now.');
      } finally {
        if (mounted) setLoadingSaved(false);
      }
    };
    fetchSavedRestaurants();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!query || query.trim().length < 2) {
      setGooglePredictions([]);
      setPredictionMeta({});
      return () => {
        active = false;
      };
    }
    setLoadingGoogle(true);
    setGoogleError(null);
    searchPlaces(query.trim(), userLocation || undefined)
      .then((predictions) => {
        if (active) {
          setGooglePredictions(predictions.slice(0, 5));
        }
      })
      .catch((error) => {
        console.error('Google Places search failed', error);
        if (active) setGoogleError('Unable to load Google results.');
      })
      .finally(() => {
        if (active) setLoadingGoogle(false);
      });
    return () => {
      active = false;
    };
  }, [query, userLocation]);

  useEffect(() => {
    let cancelled = false;
    if (!googlePredictions.length) {
      setPredictionMeta({});
      return () => {
        cancelled = true;
      };
    }
    const hydratePredictions = async () => {
      const entries = await Promise.all(
        googlePredictions.map(async (prediction) => {
          try {
            const details = await getPlaceDetails(prediction.place_id);
            return { id: prediction.place_id, details };
          } catch (error) {
            console.error('Failed to load place preview', error);
            return null;
          }
        })
      );
      if (cancelled) return;
      const meta: Record<string, PredictionMeta> = {};
      entries.forEach((entry) => {
        if (!entry?.details) return;
        const { details, id } = entry;
        const lat = details.geometry?.location?.lat?.();
        const lng = details.geometry?.location?.lng?.();
        const distance =
          userLocation && typeof lat === 'number' && typeof lng === 'number'
            ? calculateDistance(userLocation.lat, userLocation.lng, lat, lng)
            : undefined;
        meta[id] = {
          distance,
          photoUrl: details.photos?.[0]?.getUrl({ maxWidth: 600, maxHeight: 600 }),
          address: details.formatted_address || details.vicinity || undefined,
          rating: details.rating ?? null,
          details
        };
      });
      setPredictionMeta(meta);
    };
    hydratePredictions();
    return () => {
      cancelled = true;
    };
  }, [googlePredictions, userLocation]);

  const filteredSaved = useMemo(() => {
    const enriched = savedRestaurants.map((restaurant) => {
      let distance: number | undefined;
      if (userLocation && restaurant.coordinates) {
        const lat =
          restaurant.coordinates.lat ??
          restaurant.coordinates.latitude;
        const lng =
          restaurant.coordinates.lng ??
          restaurant.coordinates.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
        }
      }
      return {
        ...restaurant,
        distance
      };
    });
    if (!query.trim()) {
      return enriched.slice(0, 5);
    }
    const lower = query.trim().toLowerCase();
    return enriched
      .filter((restaurant) => restaurant.name?.toLowerCase().includes(lower))
      .slice(0, 5);
  }, [query, savedRestaurants, userLocation]);

  const closeDropdown = () => setDropdownOpen(false);

  const handleRestaurantNavigate = (id: string) => {
    navigate(`/restaurant/${id}`);
    onRestaurantSelect?.(id);
    closeDropdown();
  };

  const handleSavedRestaurantClick = (restaurant: SavedRestaurant) => {
    handleRestaurantNavigate(restaurant.id);
  };

  const handleGoogleRestaurantClick = async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!prediction.place_id) return;
    const existing = savedRestaurants.find(
      (restaurant) => restaurant.id === prediction.place_id || restaurant.googlePlaceId === prediction.place_id
    );
    if (existing) {
      handleRestaurantNavigate(existing.id);
      return;
    }
    try {
      setSavingSelection(true);
      const cachedDetails = predictionMeta[prediction.place_id]?.details;
      const details = cachedDetails || (await getPlaceDetails(prediction.place_id));
      await saveGooglePlaceToFirestore(details);

      const lat = details.geometry?.location?.lat?.();
      const lng = details.geometry?.location?.lng?.();
      const newRestaurant: SavedRestaurant = {
        id: details.place_id || prediction.place_id,
        name: details.name || prediction.structured_formatting.main_text,
        location: { formatted: details.formatted_address || prediction.description },
        coordinates:
          typeof lat === 'number' && typeof lng === 'number'
            ? { lat, lng }
            : undefined,
        googlePlaceId: details.place_id,
        googlePhotos: predictionMeta[prediction.place_id]?.photoUrl
          ? [predictionMeta[prediction.place_id]?.photoUrl as string]
          : undefined,
        googleRating: details.rating ?? null,
        cuisines: details.types?.slice(0, 2)
      };
      setSavedRestaurants((prev) => {
        if (prev.find((restaurant) => restaurant.id === newRestaurant.id)) {
          return prev;
        }
        return [newRestaurant, ...prev];
      });
      handleRestaurantNavigate(newRestaurant.id);
    } catch (error) {
      console.error('Failed to save Google place to Firestore', error);
      setGoogleError('Unable to save this place right now.');
    } finally {
      setSavingSelection(false);
    }
  };

  const hasAnyResults = filteredSaved.length > 0 || googlePredictions.length > 0;

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={() => setDropdownOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search restaurants nearby..."
          className="w-full rounded-full border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
        />
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      </div>

      {dropdownOpen && (
        <div className="absolute z-30 mt-3 w-full rounded-3xl border border-slate-100 bg-white p-4 shadow-xl shadow-slate-200/70">
          {(loadingSaved || loadingGoogle || savingSelection) && (
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
              <Loader2 className="h-4 w-4 animate-spin text-red-500" />
              {savingSelection
                ? 'Saving restaurant...'
                : loadingGoogle
                ? 'Searching Google Places...'
                : 'Loading your restaurants...'}
            </div>
          )}

          {savedError ? <p className="text-xs text-red-500 mb-2">{savedError}</p> : null}
          {googleError ? <p className="text-xs text-red-500 mb-2">{googleError}</p> : null}

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Your Saved Restaurants
              </p>
              {filteredSaved.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No saved restaurants match this search.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {filteredSaved.map((restaurant) => {
                    const cuisines = restaurant.cuisines?.slice(0, 3) || [];
                    const image =
                      restaurant.coverImage ||
                      restaurant.headerImage ||
                      restaurant.googlePhotos?.[0] ||
                      FALLBACK_IMAGE;
                    return (
                      <button
                        key={restaurant.id}
                        type="button"
                        onClick={() => handleSavedRestaurantClick(restaurant)}
                        className="w-full rounded-2xl border border-slate-100 p-3 text-left transition hover:border-red-200 hover:bg-red-50/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                            <img src={image} alt={restaurant.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold text-slate-900">{restaurant.name}</p>
                              {restaurant.distance !== undefined && (
                                <span className="text-xs text-slate-400">{restaurant.distance.toFixed(1)} mi</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {restaurant.location?.formatted || restaurant.address || 'Address unavailable'}
                            </p>
                            {cuisines.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {cuisines.map((cuisine) => (
                                  <span
                                    key={cuisine}
                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                  >
                                    {formatCuisineLabel(cuisine)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {restaurant.qualityScore !== null && restaurant.qualityScore !== undefined ? (
                              <div
                                className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${getQualityColor(
                                  restaurant.qualityScore
                                )}`}
                              >
                                {restaurant.qualityScore}%
                              </div>
                            ) : restaurant.googleRating ? (
                              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-600">
                                ⭐ {restaurant.googleRating.toFixed(1)}
                              </div>
                            ) : (
                              <div className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                                New
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                From Google Places
              </p>
              {googlePredictions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No Google results for this search.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {googlePredictions.map((prediction) => {
                    const existing = savedRestaurants.find(
                      (restaurant) =>
                        restaurant.id === prediction.place_id || restaurant.googlePlaceId === prediction.place_id
                    );
                    const meta = predictionMeta[prediction.place_id];
                    const distance = meta?.distance;
                    const image = meta?.photoUrl || FALLBACK_IMAGE;
                    return (
                      <button
                        key={prediction.place_id}
                        type="button"
                        onClick={() => {
                          if (existing) {
                            handleSavedRestaurantClick(existing);
                          } else {
                            handleGoogleRestaurantClick(prediction);
                          }
                        }}
                        className="w-full rounded-2xl border border-slate-100 p-3 text-left transition hover:border-red-200 hover:bg-red-50/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                            <img src={image} alt={prediction.description} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold text-slate-900">
                                {prediction.structured_formatting.main_text}
                              </p>
                              {distance !== undefined && (
                                <span className="text-xs text-slate-400">{distance.toFixed(1)} mi</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {prediction.structured_formatting.secondary_text || meta?.address}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {existing ? (
                              <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                Saved
                              </div>
                            ) : (
                              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                🚀 Be first
                              </div>
                            )}
                            {meta?.rating ? (
                              <div className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-600 shadow">
                                ⭐ {meta.rating.toFixed(1)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!hasAnyResults && !loadingGoogle && !loadingSaved && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                No restaurants match that search yet.
              </div>
            )}
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={closeDropdown}
          >
            <MapPin className="h-4 w-4" />
            Close search
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverSearchBar;
