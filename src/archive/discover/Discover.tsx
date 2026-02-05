import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import RestaurantMap from '../components/RestaurantMap';
import DiscoverHeader from '../components/discover/DiscoverHeader';
import FloatingModeToggle from '../components/discover/FloatingModeToggle';
import { groupRestaurantsByCity, type CityRestaurantGroup } from '../utils/mapShared';

interface FirebaseRestaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  phone: string;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  coordinates?: {
    lat?: number; lng?: number; latitude?: number; longitude?: number;
  };
  createdAt: any;
  updatedAt: any;
}

interface RestaurantWithExtras extends FirebaseRestaurant {
  rating: number;
  qualityPercentage: number;
  distance: string;
  priceRange: string;
  coverImage: string;
  location: {
    lat: number;
    lng: number;
  };
}

// Haversine distance in km
const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const Discover: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mapType, setMapType] = useState<'restaurant' | 'dish'>('restaurant');
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantWithExtras[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number, accuracy?: number} | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoomLevel, setMapZoomLevel] = useState<number>(3);
  const [cityClusters, setCityClusters] = useState<CityRestaurantGroup[]>([]);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    isFirstLoad.current = false;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMapReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const viewMode: 'nearMe' | 'global' = mapZoomLevel > 15 ? 'nearMe' : 'global';

  useEffect(() => {
    if ((mapType === 'restaurant' || mapType === 'dish') && viewMode === 'global') {
      setCityClusters(groupRestaurantsByCity(restaurants, 5));
      return;
    }
    setCityClusters([]);
  }, [mapType, viewMode, restaurants]);

  // Auto-request user location on mount for Near Me mode
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? undefined,
        });
      },
      () => { /* silently fail */ },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);


  // Fetch restaurants from Firebase
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);

        const restaurantsCollection = collection(db, 'restaurants');
        const restaurantSnapshot = await getDocs(restaurantsCollection);

        const restaurantList: RestaurantWithExtras[] = restaurantSnapshot.docs.map((doc, index) => {
          const data = doc.data() as FirebaseRestaurant;
          const coords = (data as any)?.coordinates || {};
          const latRaw = (coords as any).lat ?? (coords as any).latitude;
          const lngRaw = (coords as any).lng ?? (coords as any).longitude;
          const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
          const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);

          // Add mock data for fields not in Firebase yet
          const mockExtras = {
            rating: 4.0 + Math.random() * 1.0,
            qualityPercentage: 80 + Math.floor(Math.random() * 20),
            distance: `${(0.5 + Math.random() * 2).toFixed(1)} mi`,
            priceRange: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)],
            coverImage: `https://images.unsplash.com/photo-${1579684947550 + index}?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80`,
            location: {
              lat: lat,
              lng: lng,
            }
          };

          return {
            id: doc.id,
            ...data,
            ...mockExtras
          };
        }).filter(restaurant => !isNaN(restaurant.location.lat) && !isNaN(restaurant.location.lng));

        setRestaurants(restaurantList);
        console.log(`Loaded ${restaurantList.length} restaurants from Firebase`);

        // Fetch dishes after restaurants are loaded
        const fetchDishes = async () => {
          try {
            const menuItemsCollection = collection(db, 'menuItems');
            const menuSnapshot = await getDocs(menuItemsCollection);

            const dishList = menuSnapshot.docs.map(doc => {
              const menuItem = doc.data();
              const restaurant = restaurantList.find(r => r.id === menuItem.restaurantId);

              return {
                id: doc.id,
                name: menuItem.name,
                rating: 7.0 + Math.random() * 3.0,
                restaurantName: restaurant?.name || 'Unknown Restaurant',
                restaurantId: menuItem.restaurantId,
                category: menuItem.category,
                price: menuItem.price ? `${menuItem.price}` : undefined,
                location: restaurant ? {
                  lat: restaurant.location.lat + (Math.random() - 0.5) * 0.002,
                  lng: restaurant.location.lng + (Math.random() - 0.5) * 0.002
                } : { lat: 27.3364, lng: -82.5307 },
                coverImage: `https://source.unsplash.com/300x200/?${encodeURIComponent(menuItem.name)},food`
              };
            });

            setDishes(dishList);
          } catch (error) {
            console.error('Error fetching dishes:', error);
          }
        };

        fetchDishes();
      } catch (err: any) {
        console.error('Error fetching restaurants:', err);
        setError('Failed to load restaurants. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Apply distance filtering for Near Me mode (50km radius)
  const displayRestaurants = useMemo(() => {
    if (viewMode === 'global') return restaurants;
    if (!userLocation) return restaurants;
    return restaurants.filter(r =>
      haversineKm(userLocation, r.location) <= 50
    );
  }, [viewMode, restaurants, userLocation]);

  const filteredRestaurants = useMemo(() => {
    if (!normalizedQuery) return displayRestaurants;
    return displayRestaurants.filter((restaurant) => {
      const nameMatch = restaurant.name?.toLowerCase().includes(normalizedQuery);
      const cuisineMatch = restaurant.cuisine?.toLowerCase().includes(normalizedQuery);
      return nameMatch || cuisineMatch;
    });
  }, [displayRestaurants, normalizedQuery]);

  const filteredDishes = useMemo(() => {
    if (!normalizedQuery) return dishes;
    return dishes.filter((dish) => {
      const nameMatch = dish.name?.toLowerCase().includes(normalizedQuery);
      const categoryMatch = dish.category?.toLowerCase().includes(normalizedQuery);
      return nameMatch || categoryMatch;
    });
  }, [dishes, normalizedQuery]);

  const filteredItemsCount = mapType === 'restaurant' ? filteredRestaurants.length : filteredDishes.length;
  const isSearchActive = normalizedQuery.length > 0;

  // Map center/zoom based on view mode
  const mapCenter = useMemo(() => {
    if (viewMode === 'nearMe' && userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    return { lat: 20, lng: 0 }; // World view for global
  }, [viewMode, userLocation]);

  const mapZoom = viewMode === 'global' ? 3 : 12;

  // Location button handler
  const handleLocationRequest = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude, accuracy: position.coords.accuracy ?? undefined };
        setUserLocation(newLocation);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('Location access needed to show your position on the map.');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            alert('Location request timed out.');
            break;
          default:
            alert('An unknown error occurred.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };


  return (
    <div className="relative flex flex-col h-screen bg-white">
      <DiscoverHeader
        mode={mapType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery('')}
        onMenuClick={() => navigate('/discover/list')}
      />

      {/* Map Section */}
      <div className="flex-1 relative z-10">
        <div className="h-full relative">
          <FloatingModeToggle mode={mapType} onModeChange={setMapType} />
          {mapReady ? (
            <RestaurantMap
              key={mapType}
              mapType={mapType}
              restaurants={filteredRestaurants}
              dishes={filteredDishes}
              userLocation={userLocation}
              onRestaurantClick={(id) => navigate(`/restaurant/${id}`)}
              onDishClick={(id) => navigate(`/dish/${id}`)}
              focusRestaurantId={new URLSearchParams(location.search).get('focusRestaurantId') || undefined}
              showGoogleControl={false}
              myLocationButtonOffset={80}
              initialCenter={mapCenter}
              initialZoom={mapZoom}
              useClusterer={viewMode === 'global'}
              cityClusters={isSearchActive ? [] : cityClusters}
              searchActive={isSearchActive}
              searchPoints={
                isSearchActive
                  ? (mapType === 'restaurant'
                    ? filteredRestaurants.map((restaurant) => restaurant.location)
                    : filteredDishes.map((dish) => dish.location))
                  : []
              }
              onZoomChanged={setMapZoomLevel}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-gray-500">Loading map...</div>
            </div>
          )}

          {loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md text-sm z-50">
              Loading restaurants...
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 z-40">
              <div className="text-center bg-white rounded-xl shadow px-4 py-3">
                <p className="text-red-600 font-medium">Error loading restaurants</p>
                <p className="text-red-500 text-sm">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {isSearchActive && filteredItemsCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-40">
              <div className="rounded-xl bg-white/95 px-4 py-2 text-sm font-medium text-slate-600 shadow-lg">
                No results found
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Discover;
