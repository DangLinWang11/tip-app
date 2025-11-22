import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FilterIcon, MapPinIcon, StarIcon, Menu } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import RestaurantMap from '../components/RestaurantMap';
import DiscoverSearchBar from '../components/DiscoverSearchBar';

interface FirebaseRestaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  phone: string;
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

const Discover: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mapType, setMapType] = useState<'restaurant' | 'dish'>('restaurant');
  const [searchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantWithExtras[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number, accuracy?: number} | null>({
    lat: 40.7060,
    lng: -74.0086
  });
  const [mapReady, setMapReady] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    isFirstLoad.current = false;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMapReady(true), 100);
    return () => clearTimeout(timer);
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
            rating: 4.0 + Math.random() * 1.0, // Random rating between 4.0-5.0
            qualityPercentage: 80 + Math.floor(Math.random() * 20), // Random between 80-99
            distance: `${(0.5 + Math.random() * 2).toFixed(1)} mi`, // Random distance
            priceRange: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)], // Random price range
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

  // Filter restaurants based on search query
  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    restaurant.cuisine.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Filter data based on map type
  const filteredItems = mapType === 'restaurant' ? filteredRestaurants : dishes.filter(dish => 
    dish.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    dish.restaurantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        console.log('User location:', latitude, longitude);
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
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-white fixed top-0 left-0 right-0 z-50 px-4 py-3 shadow-sm" style={{overscrollBehavior: 'none', touchAction: 'none'}}>
        <div className="flex items-center mb-4 gap-3">
          <div className="flex-1">
            <DiscoverSearchBar
              userLocation={userLocation}
              onRestaurantSelect={(restaurantId) => {
                console.log('Restaurant selected:', restaurantId);
              }}
            />
          </div>
          <button
            onClick={() => navigate('/discover/list')}
            className="ml-2 p-2 rounded-full bg-light-gray hover:bg-gray-200 transition-colors"
            aria-label="View list"
          >
            <Menu size={20} className="text-dark-gray" />
          </button>
        </div>
        
        {/* Restaurant Map | Dish Map Toggle */}
        <div className="flex mx-4 mb-2">
          <button
            className={`flex-1 py-1 text-sm text-center rounded-l-full ${
              mapType === 'restaurant' ? 'bg-primary text-white' : 'bg-light-gray'
            }`}
            onClick={() => setMapType('restaurant')}
          >
            Restaurant Map
          </button>
          <button
            className={`flex-1 py-1 text-sm text-center rounded-r-full ${
              mapType === 'dish' ? 'bg-primary text-white' : 'bg-light-gray'
            }`}
            onClick={() => setMapType('dish')}
          >
            Dish Map
          </button>
        </div>
      </header>

      {/* Map Section */}
      <div className="flex-1 relative z-10 -mt-[10px]">
        <div className="h-full relative">
          {mapReady ? (
            <RestaurantMap 
              mapType={mapType} 
              restaurants={filteredRestaurants} 
              dishes={dishes} 
              userLocation={userLocation} 
              onRestaurantClick={(id) => navigate(`/restaurant/${id}`)} 
              onDishClick={(id) => navigate(`/dish/${id}`)}
              focusRestaurantId={new URLSearchParams(location.search).get('focusRestaurantId') || undefined}
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
        </div>
        {/* Removed duplicate location button — using the one inside RestaurantMap */}
      </div>
    </div>
  );
};

export default Discover;
