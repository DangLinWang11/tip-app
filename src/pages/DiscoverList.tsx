import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MapPin, Store, Utensils } from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateRestaurantQualityScore, ReviewWithCategory, FirebaseReview } from '../services/reviewService';
import { useLocationContext } from '../contexts/LocationContext';
import { DISH_TYPES, CUISINES, normalizeToken, inferFacetsFromText } from '../utils/taxonomy';
import { searchNearbyForDish, GoogleFallbackPlace } from '../services/googlePlacesService';
import RestaurantListCard from '../components/discover/RestaurantListCard';
import { tipRestaurantToCardModel, googlePlaceToCardModel } from '../utils/restaurantCardAdapters';

interface FirebaseRestaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  phone: string;
  coordinates?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  cuisines?: string[];
  createdAt: any;
  updatedAt: any;
  qualityScore?: number;
  googlePhotos?: string[];
  priceLevel?: number;
}

interface RestaurantWithExtras extends FirebaseRestaurant {
  averageRating: number;
  qualityPercentage: number | null;
  reviewCount: number;
  priceRange: string | null;
  coverImage: string | null;
  location: { lat: number | null; lng: number | null };
  normalizedCuisine: string;
  normalizedName: string;
  distanceMiles?: number | null;
  distanceLabel?: string;
  mostReviewedCuisine: string | null;
  topTags: string[];
}

interface DiscoverDish {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  restaurantCuisine?: string;
  category?: string;
  rating: number;
  coverImage?: string | null;
  location: { lat: number | null; lng: number | null };
  distanceMiles?: number | null;
  distanceLabel?: string;
}

const getQualityColor = (percentage: number): string => {
  if (percentage >= 95) return '#059669';
  if (percentage >= 90) return '#10B981';
  if (percentage >= 85) return '#34D399';
  if (percentage >= 80) return '#6EE7B7';
  if (percentage >= 75) return '#FDE047';
  if (percentage >= 70) return '#FACC15';
  if (percentage >= 65) return '#F59E0B';
  if (percentage >= 60) return '#F97316';
  if (percentage >= 55) return '#FB7185';
  return '#EF4444';
};

const capitalizeWords = (value: string) =>
  value.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const DISH_CATEGORIES = ['All', 'Near Me', 'Appetizer', 'Entrée', 'Handheld', 'Side', 'Dessert', 'Drink'];
const MIN_REVIEWS_FOR_TRUST = 5;

const getCategories = (mode: 'restaurant' | 'dish') => {
  if (mode === 'restaurant') {
    return ['All', 'Near Me', ...CUISINES.map((cuisine) => capitalizeWords(cuisine))];
  }
  return DISH_CATEGORIES;
};

const TAG_FILTERS = [
  { value: 'great_value', label: 'Great Value', tags: ['val_fair', 'val_good_value'], emoji: '💰' },
  { value: 'spicy', label: 'Spicy', tags: ['attr_spicy'], emoji: '🌶️' },
  { value: 'date_night', label: 'Date Night', tags: ['occasion_date_night'], emoji: '💕' },
  { value: 'vegetarian', label: 'Vegetarian', tags: ['dietary_vegetarian'], emoji: '🥗' },
  { value: 'vegan', label: 'Vegan', tags: ['dietary_vegan'], emoji: '🌱' },
  { value: 'family', label: 'Family Friendly', tags: ['occasion_family'], emoji: '👨‍👩‍👧‍👦' },
  { value: 'quick_bite', label: 'Quick Bite', tags: ['occasion_quick_lunch', 'service_fast'], emoji: '⏱️' },
];

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
  if (miles == null || Number.isNaN(miles)) return '-';
  if (miles < 0.1) return '<0.1 mi';
  if (miles >= 10) return `${Math.round(miles)} mi`;
  return `${miles.toFixed(1)} mi`;
};

const normalizeCategoryValue = (label: string) => {
  if (label === 'All') return 'all';
  if (label === 'Near Me') return 'nearme';
  // For dish categories, normalize to match Create flow categories
  if (label === 'Appetizer') return 'appetizer';
  if (label === 'Entrée') return 'entree';
  if (label === 'Handheld') return 'handheld';
  if (label === 'Side') return 'side';
  if (label === 'Dessert') return 'dessert';
  if (label === 'Drink') return 'drink';
  return normalizeToken(label);
};

const DiscoverList: React.FC = () => {
  const navigate = useNavigate();
  const { currentLocation, requestLocationPermission } = useLocationContext();
  const coords = currentLocation
    ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
    : undefined;

  const [viewMode, setViewMode] = useState<'restaurant' | 'dish'>('restaurant');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedPriceLevel, setSelectedPriceLevel] = useState<number | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantWithExtras[]>([]);
  const [dishes, setDishes] = useState<DiscoverDish[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState<boolean>(true);
  const [loadingDishes, setLoadingDishes] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTagFilter, setLoadingTagFilter] = useState<boolean>(false);
  const [tagFilteredRestaurantIds, setTagFilteredRestaurantIds] = useState<string[]>([]);
  const [googleFallbackResults, setGoogleFallbackResults] = useState<GoogleFallbackPlace[]>([]);
  const [showGoogleFallback, setShowGoogleFallback] = useState<boolean>(false);
  const [loadingGoogleFallback, setLoadingGoogleFallback] = useState<boolean>(false);

  const debounceTimerRef = useRef<number | null>(null);

  const categories = useMemo(() => getCategories(viewMode), [viewMode]);
  const parsed = useMemo(() => inferFacetsFromText(searchQuery), [searchQuery]);
  const queryTokens = useMemo(() => normalizeToken(searchQuery).split(' ').filter(Boolean), [searchQuery]);
  const activeTagFilter = useMemo(
    () => TAG_FILTERS.find((filter) => filter.value === selectedTagFilter) ?? null,
    [selectedTagFilter]
  );

  const handleCategorySelect = async (value: string) => {
    setSelectedCategory(value);
    if (value === 'nearme' && !coords && requestLocationPermission) {
      try {
        await requestLocationPermission();
      } catch (err) {
        console.warn('Location permission request failed', err);
      }
    }
  };

  const handleTagFilterSelect = (value: string) => {
    setSelectedTagFilter((prev) => (prev === value ? null : value));
  };

  const handlePriceLevelSelect = (level: number) => {
    setSelectedPriceLevel((prev) => (prev === level ? null : level));
  };

  const handleClearFilters = () => {
    setSelectedTagFilter(null);
    setSelectedCategory('all');
    setSelectedPriceLevel(null);
  };

  /**
   * Determines the cuisine with the most reviews for a restaurant
   * Counts reviews where the cuisine field matches
   * Returns null if no reviews with cuisine tags exist
   */
  const getMostReviewedCuisine = (reviews: any[]): string | null => {
    if (!reviews || reviews.length === 0) return null;

    const cuisineCounts: Record<string, number> = {};

    // Count reviews per cuisine (only checking the cuisine field)
    reviews.forEach(review => {
      if (review.cuisine && typeof review.cuisine === 'string') {
        const normalized = review.cuisine.toLowerCase().trim();
        cuisineCounts[normalized] = (cuisineCounts[normalized] || 0) + 1;
      }
    });

    // Find cuisine with most reviews
    let maxCuisine: string | null = null;
    let maxCount = 0;

    Object.entries(cuisineCounts).forEach(([cuisine, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxCuisine = cuisine;
      }
    });

    return maxCuisine;
  };

  /**
   * Determines the 1-2 most frequently used tags across all reviews
   * Returns top 2 tags by frequency
   */
  const getMostUsedTags = (reviews: any[]): string[] => {
    if (!reviews || reviews.length === 0) return [];

    const tagCounts: Record<string, number> = {};

    // Count occurrences of each tag across all reviews
    reviews.forEach(review => {
      if (review.tags && Array.isArray(review.tags)) {
        review.tags.forEach((tag: string) => {
          if (tag) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        });
      }
    });

    // Sort by count descending, take top 2
    return Object.entries(tagCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 2)
      .map(([tag]) => tag);
  };

  const fetchRestaurantReviews = async (restaurantId: string): Promise<ReviewWithCategory[]> => {
    try {
      const reviewsQuery = query(collection(db, 'reviews'), where('restaurantId', '==', restaurantId));
      const reviewsSnapshot = await getDocs(reviewsQuery);
      const reviews = reviewsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as FirebaseReview));
      return reviews.map((review) => ({ ...review, category: review.category ?? review.dishCategory ?? 'custom' }));
    } catch (err) {
      console.error(`Error fetching reviews for restaurant ${restaurantId}:`, err);
      return [];
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true);
        setError(null);

        const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
        const restaurantPromises = restaurantsSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data() as FirebaseRestaurant;
          const restaurantId = docSnap.id;

          const reviews = await fetchRestaurantReviews(restaurantId);
          const storedQuality = typeof data.qualityScore === 'number' ? data.qualityScore : null;
          const computedQuality = storedQuality ?? calculateRestaurantQualityScore(reviews);

          const rawLat = (data as any)?.coordinates?.lat ?? (data as any)?.coordinates?.latitude;
          const rawLng = (data as any)?.coordinates?.lng ?? (data as any)?.coordinates?.longitude;
          const lat = typeof rawLat === 'number' ? rawLat : null;
          const lng = typeof rawLng === 'number' ? rawLng : null;
          const normalizedCuisines = Array.isArray((data as any)?.cuisines)
            ? (data as any)?.cuisines
              .map((value: unknown) => (typeof value === 'string' ? normalizeToken(value) : ''))
              .filter((value): value is string => Boolean(value))
            : undefined;

          const averageRating = reviews.length
            ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
            : 0;

          // Derive priceRange from priceLevel (1-4)
          const priceLevel = data.priceLevel;
          const priceRange = typeof priceLevel === 'number' && priceLevel >= 1 && priceLevel <= 4
            ? '$'.repeat(priceLevel)
            : null;

          // Calculate distance if coords is available
          let distanceMiles: number | null = null;
          let distanceLabel: string | undefined = undefined;
          if (coords && lat != null && lng != null) {
            const distanceKm = haversine(
              { lat: coords.lat, lng: coords.lng },
              { lat, lng }
            );
            distanceMiles = distanceKm * 0.621371; // Convert km to miles
            distanceLabel = formatDistanceLabel(distanceMiles);
          }

          // Precompute most reviewed cuisine
          const mostReviewedCuisine = getMostReviewedCuisine(reviews);

          // Precompute top 1-2 tags
          const topTags = getMostUsedTags(reviews);

          return {
            ...data,
            id: restaurantId,
            averageRating,
            qualityPercentage: computedQuality ?? null,
            reviewCount: reviews.length,
            priceRange,
            coverImage: (data.googlePhotos && data.googlePhotos.length > 0) ? data.googlePhotos[0] : null,
            cuisines: normalizedCuisines,
            location: { lat, lng },
            normalizedCuisine: normalizeToken(data.cuisine || ''),
            normalizedName: normalizeToken(data.name || ''),
            distanceMiles,
            distanceLabel,
            mostReviewedCuisine,
            topTags,
          } as RestaurantWithExtras;
        });

        const restaurantList = await Promise.all(restaurantPromises);
        if (!isCancelled) {
          setRestaurants(restaurantList);
        }
      } catch (err) {
        console.error('Error fetching restaurants:', err);
        if (!isCancelled) {
          setError('Failed to load restaurants. Please try again.');
        }
      } finally {
        if (!isCancelled) {
          setLoadingRestaurants(false);
        }
      }
    };

    fetchRestaurants();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'restaurant' || !activeTagFilter) {
      setTagFilteredRestaurantIds([]);
      setLoadingTagFilter(false);
      return;
    }
    let isCancelled = false;
    const fetchTagFilteredRestaurants = async () => {
      try {
        setLoadingTagFilter(true);
        const reviewsQueryRef = query(
          collection(db, 'reviews'),
          where('tags', 'array-contains-any', activeTagFilter.tags)
        );
        const snapshot = await getDocs(reviewsQueryRef);
        const ids = new Set<string>();
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as { restaurantId?: string };
          if (data.restaurantId) {
            ids.add(data.restaurantId);
          }
        });
        if (!isCancelled) {
          setTagFilteredRestaurantIds(Array.from(ids));
        }
      } catch (err) {
        console.error('Error fetching tag-filtered reviews:', err);
        if (!isCancelled) {
          setTagFilteredRestaurantIds([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingTagFilter(false);
        }
      }
    };
    fetchTagFilteredRestaurants();
    return () => {
      isCancelled = true;
    };
  }, [viewMode, activeTagFilter]);

  useEffect(() => {
    if (viewMode !== 'dish') {
      setLoadingDishes(false);
      return;
    }

    let isCancelled = false;

    const fetchDishes = async () => {
      try {
        setLoadingDishes(true);
        setError(null);

        const restaurantMap = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
        const menuItemsRef = collection(db, 'menuItems');
        const menuQuery = query(menuItemsRef, limit(40));
        const menuSnapshot = await getDocs(menuQuery);

        const dishResults = await Promise.all(
          menuSnapshot.docs.map(async (menuDoc) => {
            const data = menuDoc.data() as any;
            const restaurantId = data.restaurantId as string | undefined;
            const restaurantInfo = restaurantId ? restaurantMap.get(restaurantId) : undefined;

            const restaurantIdForDish = restaurantId ?? restaurantInfo?.id ?? '';

            let dishReviews: FirebaseReview[] = [];
            if (restaurantIdForDish) {
              const base = collection(db, 'reviews');
              const q1 = query(base, where('restaurantId', '==', restaurantIdForDish), where('menuItemId', '==', menuDoc.id));
              const q2 = query(base, where('restaurantId', '==', restaurantIdForDish), where('dishId', '==', menuDoc.id));
              const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
              const merged = [...snap1.docs, ...snap2.docs];
              const unique = new Map<string, any>();
              for (const d of merged) {
                const data = { id: d.id, ...(d.data() as any) } as FirebaseReview;
                if ((data as any)?.isDeleted === true) continue;
                unique.set(d.id, data);
              }
              dishReviews = Array.from(unique.values());
            }

            const rating = dishReviews.length
              ? dishReviews.reduce((sum, review) => sum + review.rating, 0) / dishReviews.length
              : 0;

            const location = restaurantInfo?.location ?? { lat: null, lng: null };

            // Determine cover image: prefer menu item coverImage, else first review with photos
            let coverImage: string | null = (data as any)?.coverImage ?? null;
            if (!coverImage && dishReviews.length) {
              const withPhotos = dishReviews.find((r: any) => {
                const mediaPhotos = Array.isArray(r?.media?.photos) ? r.media.photos : [];
                const legacyImages = Array.isArray(r?.images) ? r.images : [];
                return mediaPhotos.length > 0 || legacyImages.length > 0;
              });
              if (withPhotos) {
                const mediaPhotos = Array.isArray((withPhotos as any)?.media?.photos) ? (withPhotos as any).media.photos : [];
                const legacyImages = Array.isArray((withPhotos as any)?.images) ? (withPhotos as any).images : [];
                coverImage = (mediaPhotos[0] || legacyImages[0]) ?? null;
              }
            }

            return {
              id: menuDoc.id,
              name: data.name || 'Unknown Dish',
              restaurantId: restaurantId ?? 'unknown',
              restaurantName: restaurantInfo?.name || 'Unknown Restaurant',
              restaurantCuisine: restaurantInfo?.cuisine || '',
              category: data.category || '',
              rating,
              coverImage,
              location,
            } as DiscoverDish;
          })
        );

        if (!isCancelled) {
          setDishes(dishResults);
        }
      } catch (err) {
        console.error('Error fetching dishes:', err);
        if (!isCancelled) {
          setError('Failed to load dishes. Please try again.');
        }
      } finally {
        if (!isCancelled) {
          setLoadingDishes(false);
        }
      }
    };

    fetchDishes();

    return () => {
      isCancelled = true;
    };
  }, [viewMode, restaurants]);

  useEffect(() => {
    setSelectedCategory('all');
  }, [viewMode]);

  const restaurantsWithDerived = useMemo(() => {
    return restaurants.map((restaurant) => {
      const { lat, lng } = restaurant.location;
      const km =
        coords && lat != null && lng != null
          ? haversine(coords, { lat, lng })
          : null;
      const distanceMiles = km != null ? km * 0.621371 : null;

      return {
        ...restaurant,
        distanceMiles,
        distanceLabel: formatDistanceLabel(distanceMiles),
      };
    });
  }, [restaurants, coords]);

  const dishesWithDerived = useMemo(() => {
    return dishes.map((dish) => {
      const lat = dish.location?.lat ?? null;
      const lng = dish.location?.lng ?? null;
      let distanceMiles: number | null = null;

      if (coords && lat != null && lng != null) {
        distanceMiles = haversine(coords, { lat, lng }) * 0.621371;
      }

      return {
        ...dish,
        distanceMiles,
        distanceLabel: formatDistanceLabel(distanceMiles),
      };
    });
  }, [dishes, coords]);

  const tagFilterIdSet = useMemo(() => new Set(tagFilteredRestaurantIds), [tagFilteredRestaurantIds]);

  const filteredRestaurants = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    const base = restaurantsWithDerived
      .filter((restaurant) => {
        if (selectedCategory === 'all' || selectedCategory === 'nearme') return true;
        const normalizedCategory = selectedCategory;
        const normalizedCuisines = Array.isArray(restaurant.cuisines)
          ? restaurant.cuisines.map((value) => normalizeToken(value)).filter(Boolean)
          : [];

        if (normalizedCuisines.includes(normalizedCategory)) {
          return true;
        }

        const cuisineLower = (restaurant.cuisine || '').toLowerCase();
        return cuisineLower.includes(normalizedCategory);
      })
      .filter((restaurant) => {
        if (!trimmedQuery) return true;
        const cuisinesNormalized = Array.isArray(restaurant.cuisines)
          ? restaurant.cuisines.map((value) => normalizeToken(value)).filter(Boolean)
          : [];
        const cuisineLower = (restaurant.cuisine || '').toLowerCase();
        const nameLower = (restaurant.name || '').toLowerCase();

        const hitCuisine =
          parsed.cuisines.some((c) => cuisinesNormalized.includes(c)) ||
          parsed.cuisines.some((c) => cuisineLower.includes(c));

        const hitTokens = queryTokens.some((token) =>
          nameLower.includes(token) ||
          cuisinesNormalized.some((c) => c.includes(token)) ||
          cuisineLower.includes(token)
        );

        return hitCuisine || hitTokens;
      })
      .filter((restaurant) => {
        // Price level filtering
        if (selectedPriceLevel === null) return true;
        return restaurant.priceLevel === selectedPriceLevel;
      });

    if (viewMode !== 'restaurant' || !activeTagFilter || loadingTagFilter) {
      return base;
    }
    if (!tagFilterIdSet.size) {
      return [];
    }

    return base.filter((restaurant) => tagFilterIdSet.has(restaurant.id));
  }, [
    restaurantsWithDerived,
    selectedCategory,
    searchQuery,
    parsed,
    queryTokens,
    selectedPriceLevel,
    viewMode,
    activeTagFilter,
    loadingTagFilter,
    tagFilterIdSet
  ]);

  const filteredDishes = useMemo(() => {
    return dishesWithDerived.filter((dish) => {
      if (selectedCategory !== 'all' && selectedCategory !== 'nearme') {
        const dishCategoryNormalized = (dish.category || '').toLowerCase().trim();
        const selectedCategoryNormalized = selectedCategory.toLowerCase().trim();
        // Check for equality or containment (case-insensitive)
        if (dishCategoryNormalized !== selectedCategoryNormalized && !dishCategoryNormalized.includes(selectedCategoryNormalized)) {
          return false;
        }
      }

      if (!searchQuery.trim()) {
        return true;
      }

      const categoryLower = (dish.category || '').toLowerCase();
      const nameLower = (dish.name || '').toLowerCase();
      const restaurantNameLower = (dish.restaurantName || '').toLowerCase();

      const hitType = parsed.dishTypes.some((dt) => categoryLower.includes(dt));
      const hitTokens = queryTokens.some(
        (token) => nameLower.includes(token) || restaurantNameLower.includes(token)
      );

      return hitType || hitTokens;
    });
  }, [dishesWithDerived, selectedCategory, searchQuery, parsed, queryTokens]);

  const dishesForRender = filteredDishes;

  const isLoading = viewMode === 'restaurant' ? (loadingRestaurants || loadingTagFilter) : loadingRestaurants || loadingDishes;

  // Google fallback search effect with debouncing
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    // Clear previous debounce timer
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Reset fallback if query is too short
    if (trimmedQuery.length < 3) {
      setShowGoogleFallback(false);
      setGoogleFallbackResults([]);
      return;
    }

    // Check if we should trigger Google fallback (low TIP results)
    const shouldTriggerFallback =
      (viewMode === 'dish' && filteredDishes.length < 3) ||
      (viewMode === 'restaurant' && filteredRestaurants.length < 3);

    if (!shouldTriggerFallback || !coords) {
      setShowGoogleFallback(false);
      setGoogleFallbackResults([]);
      return;
    }

    // Debounce the Google API call
    debounceTimerRef.current = window.setTimeout(() => {
      let isCancelled = false;

      const fetchGoogleFallback = async () => {
        try {
          setLoadingGoogleFallback(true);
          const results = await searchNearbyForDish(trimmedQuery, coords);
          if (!isCancelled) {
            setGoogleFallbackResults(results);
            setShowGoogleFallback(results.length > 0);
          }
        } catch (err) {
          console.error('Google fallback search failed:', err);
          if (!isCancelled) {
            setGoogleFallbackResults([]);
            setShowGoogleFallback(false);
          }
        } finally {
          if (!isCancelled) {
            setLoadingGoogleFallback(false);
          }
        }
      };

      fetchGoogleFallback();

      return () => {
        isCancelled = true;
      };
    }, 500); // 500ms debounce

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, viewMode, filteredDishes.length, filteredRestaurants.length, coords]);

  const restaurantsForRender = [...filteredRestaurants].sort((a, b) => {
    // When "Near Me" is active, prioritize distance first
    if (selectedCategory === 'nearme') {
      // Restaurants with distance come before those without
      const da = a.distanceMiles;
      const db = b.distanceMiles;

      if (da != null && db == null) return -1;
      if (da == null && db != null) return 1;

      // Both have distance - sort by closest first
      if (da != null && db != null) {
        if (da !== db) {
          return da - db; // Ascending (closest first)
        }
      }
      // If distances equal, fall through to quality/sufficiency
    }

    // Growth-safe ranking: prioritize restaurants with sufficient data
    const aSufficient = a.reviewCount >= MIN_REVIEWS_FOR_TRUST;
    const bSufficient = b.reviewCount >= MIN_REVIEWS_FOR_TRUST;

    // First: sort by sufficient data (true first)
    if (aSufficient !== bSufficient) {
      return aSufficient ? -1 : 1;
    }

    // Second: sort by quality percentage (DESC)
    const aQuality = a.qualityPercentage ?? 0;
    const bQuality = b.qualityPercentage ?? 0;
    if (aQuality !== bQuality) {
      return bQuality - aQuality;
    }

    // Third: sort by distance (ASC) when available
    const finalDa = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const finalDb = b.distanceMiles ?? Number.POSITIVE_INFINITY;
    return finalDa - finalDb;
  });
  const noTagFilterResults =
    viewMode === 'restaurant' && Boolean(selectedTagFilter) && !loadingTagFilter && restaurantsForRender.length === 0;

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/discover')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>

          <h1 className="text-xl font-semibold text-gray-900">Discover List</h1>

          <div className="relative">
            <div
              className={`flex items-center bg-gray-200 rounded-full p-1 w-20 h-10 cursor-pointer transition-colors ${viewMode === 'dish' ? 'bg-red-100' : ''
                }`}
              onClick={() => setViewMode(viewMode === 'restaurant' ? 'dish' : 'restaurant')}
            >
              <div
                className={`absolute w-8 h-8 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${viewMode === 'dish' ? 'transform translate-x-10' : 'transform translate-x-0'
                  }`}
              />

              <div className="flex items-center justify-between w-full relative z-10">
                <div className="w-8 h-8 flex items-center justify-center">
                  <Store size={16} className={`${viewMode === 'restaurant' ? 'text-primary' : 'text-gray-500'}`} />
                </div>
                <div className="w-8 h-8 flex items-center justify-center">
                  <Utensils size={16} className={`${viewMode === 'dish' ? 'text-primary' : 'text-gray-500'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white px-4 py-3 border-b">
        <div className="flex items-center bg-gray-100 rounded-xl p-3">
          <Search size={20} className="text-gray-500 mr-3" />
          <input
            type="text"
            placeholder={viewMode === 'restaurant' ? 'Search restaurants...' : 'Search dishes...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent focus:outline-none text-base text-gray-900 placeholder-gray-500"
            aria-label="Search"
          />
        </div>
      </div>

      <div className="bg-white px-4 py-3 border-b">
        <div className="flex overflow-x-auto no-scrollbar space-x-2">
          {categories.map((category) => {
            const value = normalizeCategoryValue(category);
            const isActive = selectedCategory === value;
            return (
              <button
                key={value}
                onClick={() => handleCategorySelect(value)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === 'restaurant' && (
        <>
          <div className="bg-white px-4 py-3 border-b">
            {loadingTagFilter && selectedTagFilter ? (
              <div className="flex items-center text-sm text-gray-500 mb-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                <span>Finding {activeTagFilter?.label ?? selectedTagFilter} spots...</span>
              </div>
            ) : null}
            <div className="flex overflow-x-auto no-scrollbar space-x-2">
              {TAG_FILTERS.map((filter) => {
                const isActive = selectedTagFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    disabled={loadingTagFilter}
                    onClick={() => handleTagFilterSelect(filter.value)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                      isActive ? 'bg-gray-300 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${loadingTagFilter ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span>{filter.emoji}</span>
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white px-4 py-3 border-b">
            <div className="flex overflow-x-auto no-scrollbar space-x-2">
              {[1, 2, 3, 4].map((level) => {
                const isActive = selectedPriceLevel === level;
                const priceLabel = '$'.repeat(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handlePriceLevelSelect(level)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {priceLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="px-4 py-4">
        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium">{`Error loading ${viewMode === 'restaurant' ? 'restaurants' : 'dishes'}`}</p>
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-gray-600">Loading {viewMode === 'restaurant' ? 'restaurants' : 'dishes'}...</p>
            </div>
          </div>
        ) : viewMode === 'restaurant' ? (
          noTagFilterResults ? (
            <div className="text-center py-8 text-gray-500 space-y-3">
              <p>No restaurants found with {activeTagFilter?.label ?? selectedTagFilter}</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Clear Filters
              </button>
            </div>
          ) :
          restaurantsForRender.length ? (
            restaurantsForRender.map((restaurant) => {
              const card = tipRestaurantToCardModel(restaurant);
              return (
                <RestaurantListCard
                  key={card.id}
                  card={card}
                  onClick={() => navigate(`/restaurant/${card.restaurantId}`)}
                />
              );
            })
          ) : noTagFilterResults ? (
            <div className="text-center py-8 text-gray-500">
              <p className="font-medium">No restaurants found with {activeTagFilter?.label ?? selectedTagFilter}</p>
              <p className="text-sm">Try broadening your filters.</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-3 inline-flex items-center px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No restaurants found</p>
              <p className="text-sm">Try selecting a different category</p>
              {selectedTagFilter ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-3 inline-flex items-center px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Clear Tag Filter
                </button>
              ) : null}
            </div>
          )
        ) : dishesForRender.length ? (
          dishesForRender.map((dish) => (
            <div
              key={dish.id}
              className="bg-white rounded-xl shadow-sm flex overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors h-16"
              onClick={() => navigate(`/dish/${dish.id}`)}
            >
              <div className="w-16 h-16 bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {dish.coverImage ? (
                  <img src={dish.coverImage} alt={dish.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center">
                    <Utensils size={18} className="text-gray-500" />
                  </div>
                )}
              </div>
              <div className="p-2 flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h3 className="font-medium truncate text-sm">{dish.name}</h3>
                    <p className="text-xs text-gray-600 truncate">{dish.restaurantName}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-semibold ${dish.rating === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                      {dish.rating === 0 ? 'No reviews' : dish.rating.toFixed(1)}
                    </span>
                    <div className="flex items-center mt-1 text-xs text-dark-gray">
                      <MapPin size={12} className="text-dark-gray mr-1" />
                      <span>{dish.distanceLabel ?? '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No dishes found</p>
            <p className="text-sm">Try selecting a different category</p>
          </div>
        )}

        {/* Google fallback section */}
        {showGoogleFallback && googleFallbackResults.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Popular nearby (via Google Places)</h2>
            <div className="space-y-3">
              {googleFallbackResults.map((place) => {
                const card = googlePlaceToCardModel(place, coords);
                return (
                  <RestaurantListCard
                    key={card.id}
                    card={card}
                    onClick={() => {
                      // Open Google Maps in new tab as fallback
                      if (card.googlePlaceId) {
                        window.open(`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${card.googlePlaceId}`, '_blank');
                      }
                    }}
                  />
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3 italic">
              These are Google results, not yet rated in TIP. Be the first to review!
            </p>
          </div>
        )}

        {loadingGoogleFallback && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-2"></div>
              <p className="text-sm text-gray-600">Searching nearby...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverList;
