import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MapPin, Store, Utensils } from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateRestaurantQualityScore, ReviewWithCategory, FirebaseReview } from '../services/reviewService';
import { useLocationContext } from '../contexts/LocationContext';
import { DISH_TYPES, CUISINES, normalizeToken, inferFacetsFromText } from '../utils/taxonomy';

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
}

interface RestaurantWithExtras extends FirebaseRestaurant {
  averageRating: number;
  qualityPercentage: number | null;
  reviewCount: number;
  priceRange: string;
  coverImage: string | null;
  location: { lat: number | null; lng: number | null };
  normalizedCuisine: string;
  normalizedName: string;
  distanceMiles?: number | null;
  distanceLabel?: string;
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

const getCategories = (mode: 'restaurant' | 'dish') => {
  if (mode === 'restaurant') {
    return ['All', 'Near Me', ...CUISINES.map((cuisine) => capitalizeWords(cuisine))];
  }
  return ['All', 'Near Me', ...DISH_TYPES.map((dish) => capitalizeWords(dish))];
};

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
  const [restaurants, setRestaurants] = useState<RestaurantWithExtras[]>([]);
  const [dishes, setDishes] = useState<DiscoverDish[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState<boolean>(true);
  const [loadingDishes, setLoadingDishes] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => getCategories(viewMode), [viewMode]);
  const parsed = useMemo(() => inferFacetsFromText(searchQuery), [searchQuery]);
  const queryTokens = useMemo(() => normalizeToken(searchQuery).split(' ').filter(Boolean), [searchQuery]);

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

  const fetchRestaurantReviews = async (restaurantId: string): Promise<ReviewWithCategory[]> => {
    try {
      const reviewsQuery = query(collection(db, 'reviews'), where('restaurantId', '==', restaurantId));
      const reviewsSnapshot = await getDocs(reviewsQuery);
      const reviews = reviewsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as FirebaseReview));
      return reviews.map((review) => ({ ...review, category: review.category ?? 'custom' }));
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

          return {
            ...data,
            id: restaurantId,
            averageRating,
            qualityPercentage: computedQuality ?? null,
            reviewCount: reviews.length,
            priceRange: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)],
            coverImage: (data.googlePhotos && data.googlePhotos.length > 0) ? data.googlePhotos[0] : null,
            cuisines: normalizedCuisines,
            location: { lat, lng },
            normalizedCuisine: normalizeToken(data.cuisine || ''),
            normalizedName: normalizeToken(data.name || ''),
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
          : 0.8 + Math.random() * 3;
      const distanceMiles = km * 0.621371;

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

  const filteredRestaurants = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    return restaurantsWithDerived
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
      });
  }, [restaurantsWithDerived, selectedCategory, searchQuery, parsed, queryTokens]);

  const filteredDishes = useMemo(() => {
    return dishesWithDerived.filter((dish) => {
      if (selectedCategory !== 'all' && selectedCategory !== 'nearme') {
        const categoryLower = (dish.category || '').toLowerCase();
        if (!categoryLower.includes(selectedCategory)) {
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

  const isLoading = viewMode === 'restaurant' ? loadingRestaurants : loadingRestaurants || loadingDishes;

  const restaurantsForRender = selectedCategory === 'nearme' && coords
    ? [...filteredRestaurants].sort((a, b) => {
      const aLat = a.location.lat;
      const aLng = a.location.lng;
      const bLat = b.location.lat;
      const bLng = b.location.lng;

      const da =
        aLat != null && aLng != null
          ? haversine(coords, { lat: aLat, lng: aLng })
          : Number.POSITIVE_INFINITY;
      const db =
        bLat != null && bLng != null
          ? haversine(coords, { lat: bLat, lng: bLng })
          : Number.POSITIVE_INFINITY;

      return da - db;
    })
    : filteredRestaurants;

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
            className="flex-1 bg-transparent focus:outline-none text-gray-900 placeholder-gray-500"
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
          restaurantsForRender.length ? (
            restaurantsForRender.map((restaurant) => {
              const q = (restaurant as any).qualityScore ?? restaurant.qualityPercentage ?? null;

              return (
                <div
                  key={restaurant.id}
                  className="bg-white rounded-xl shadow-sm flex overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                >
                  <div className="w-20 h-20 bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {restaurant.coverImage ? (
                      <img
                        src={restaurant.coverImage}
                        alt={restaurant.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center">
                        <Store size={24} className="text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium truncate max-w-[160px] mr-4">{restaurant.name}</h3>
                      {q !== null && (
                        <div
                          className="px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getQualityColor(q) }}
                        >
                          <span className="text-xs font-medium text-white">{q}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center text-sm text-dark-gray space-x-2">
                        <span>{restaurant.cuisine || 'Unknown'}</span>
                        <span>{restaurant.priceRange}</span>
                      </div>
                      <div className="flex items-center text-xs text-dark-gray">
                        <MapPin size={14} className="text-dark-gray mr-1" />
                        <span>{restaurant.distanceLabel ?? '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No restaurants found</p>
              <p className="text-sm">Try selecting a different category</p>
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
      </div>
    </div>
  );
};

export default DiscoverList;


