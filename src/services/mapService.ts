import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DishCardData } from '../components/discover/DishCard';
import { RestaurantCardData } from '../components/discover/RestaurantCard';

/**
 * Simple in-memory cache with TTL
 */
class MapDataCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private TTL = 5 * 60 * 1000; // 5 minutes

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const mapDataCache = new MapDataCache();

/**
 * Haversine formula for distance calculation
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Fetch all dishes from a specific restaurant
 */
export const fetchRestaurantDishes = async (restaurantId: string): Promise<DishCardData[]> => {
  const cacheKey = `restaurant_dishes_${restaurantId}`;
  const cached = mapDataCache.get(cacheKey);
  if (cached) return cached;

  try {
    // Fetch restaurant info first for address
    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);
    const restaurantData = restaurantSnap.exists() ? restaurantSnap.data() : null;

    // Fetch dishes
    const dishesRef = collection(db, 'menuItems');
    const q = query(
      dishesRef,
      where('restaurantId', '==', restaurantId),
      where('isDeleted', '==', false)
    );

    const snapshot = await getDocs(q);

    const dishes: DishCardData[] = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.dish || 'Unknown Dish',
          rating: data.rating || 0,
          restaurantName: data.restaurantName || restaurantData?.name || 'Unknown Restaurant',
          restaurantId: data.restaurantId,
          category: data.category ? [data.category] : [],
          address: restaurantData?.address || '',
          priceRange: data.price || '$',
          imageUrl: data.imageUrl || `https://source.unsplash.com/400x300/?${encodeURIComponent(data.name || 'food')},food`
        };
      })
      .filter(dish => dish.rating > 0) // Only include rated dishes
      .sort((a, b) => b.rating - a.rating); // Sort by rating descending

    mapDataCache.set(cacheKey, dishes);
    return dishes;
  } catch (error) {
    console.error('Error fetching restaurant dishes:', error);
    return [];
  }
};

/**
 * Fetch nearby restaurants based on location
 */
export const fetchNearbyRestaurants = async (
  lat: number,
  lng: number,
  radiusMeters: number = 1000
): Promise<RestaurantCardData[]> => {
  const cacheKey = `nearby_restaurants_${lat.toFixed(4)}_${lng.toFixed(4)}_${radiusMeters}`;
  const cached = mapDataCache.get(cacheKey);
  if (cached) return cached;

  try {
    const restaurantsRef = collection(db, 'restaurants');
    const snapshot = await getDocs(restaurantsRef);

    // Filter by distance and map to card format
    const nearby = snapshot.docs
      .map(doc => {
        const data = doc.data();
        const coords = data.coordinates || {};
        const rLat = coords.lat || coords.latitude;
        const rLng = coords.lng || coords.longitude;

        if (!rLat || !rLng) return null;

        const distance = calculateDistance(lat, lng, rLat, rLng);
        const distanceMeters = distance * 1000;

        if (distanceMeters > radiusMeters) return null;

        return {
          id: doc.id,
          name: data.name || 'Unknown Restaurant',
          qualityPercentage: data.qualityPercentage || 80 + Math.floor(Math.random() * 20),
          averageRating: data.averageMenuRating || data.rating || 4.0 + Math.random(),
          cuisineType: data.cuisine || 'Restaurant',
          priceRange: data.priceRange || '$$',
          address: data.address || '',
          reviewCount: data.reviewCount || Math.floor(Math.random() * 100) + 10,
          imageUrl: data.coverImage || `https://source.unsplash.com/400x300/?restaurant`,
          distance
        };
      })
      .filter((r): r is RestaurantCardData & { distance: number } => r !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)
      .map(({ distance, ...rest }) => rest); // Remove distance from final result

    mapDataCache.set(cacheKey, nearby);
    return nearby;
  } catch (error) {
    console.error('Error fetching nearby restaurants:', error);
    return [];
  }
};
