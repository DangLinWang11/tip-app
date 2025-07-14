import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, FilterIcon, MapPinIcon, StarIcon } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import RestaurantMap from '../components/RestaurantMap';

interface FirebaseRestaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  phone: string;
  coordinates: {
    latitude: number;
    longitude: number;
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
  const [mapType, setMapType] = useState<'restaurant' | 'dish'>('restaurant');
  const [isListView, setIsListView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantWithExtras[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          
          // Add mock data for fields not in Firebase yet
          const mockExtras = {
            rating: 4.0 + Math.random() * 1.0, // Random rating between 4.0-5.0
            qualityPercentage: 80 + Math.floor(Math.random() * 20), // Random between 80-99
            distance: `${(0.5 + Math.random() * 2).toFixed(1)} mi`, // Random distance
            priceRange: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)], // Random price range
            coverImage: `https://images.unsplash.com/photo-${1579684947550 + index}?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80`,
            location: {
              lat: data.coordinates.latitude,
              lng: data.coordinates.longitude
            }
          };
          
          return {
            id: doc.id,
            ...data,
            ...mockExtras
          };
        });
        
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
                  lat: restaurant.coordinates.latitude + (Math.random() - 0.5) * 0.002,
                  lng: restaurant.coordinates.longitude + (Math.random() - 0.5) * 0.002
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
        // This will trigger the map to center on user location
        // The actual map centering is handled in RestaurantMap component
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

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    const deltaY = startY - currentY;
    if (Math.abs(deltaY) > 50) { // 50px threshold
      if (deltaY > 0) {
        setIsMenuOpen(true); // Swipe up to open
      } else {
        setIsMenuOpen(false); // Swipe down to close
      }
    }
    setStartY(0);
    setCurrentY(0);
  };

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="flex items-center mb-4">
          <div className="relative flex-1">
            <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-gray" />
            <input
              type="text"
              placeholder="Search restaurants, dishes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-light-gray rounded-full text-sm"
            />
          </div>
          <button className="ml-2 p-2 rounded-full bg-light-gray">
            <FilterIcon size={20} />
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
      <div className="relative">
        {loading ? (
          <div className="h-[calc(100vh-280px)] flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-gray-600">Loading restaurants...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-[calc(100vh-280px)] flex items-center justify-center bg-red-50">
            <div className="text-center">
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
        ) : (
          <div className="h-[calc(100vh-280px)]">
            <RestaurantMap mapType={mapType} restaurants={filteredRestaurants} dishes={dishes} onRestaurantClick={(id) => navigate(`/restaurant/${id}`)} />
          </div>
        )}
        
        {/* Location Button - positioned above sliding sheet */}
        <div className="absolute bottom-24 right-4 z-30">
          <button
            onClick={handleLocationRequest}
            className="bg-white rounded-full p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200"
            title="Show my location"
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="#00aeef"
            >
              <path d="M12 2L22 22L12 18L2 22L12 2Z"/>
            </svg>
          </button>
        </div>

        {/* Sliding Bottom Sheet */}
        <div 
          className={`fixed bottom-0 left-0 right-0 z-20 rounded-t-xl shadow-xl transition-transform duration-300 ${isMenuOpen ? 'translate-y-0' : 'translate-y-[calc(100%-120px)]'}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Handle bar with pancake icon */}
          <div className="flex justify-center py-4 border-b bg-white rounded-t-xl" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div className="w-10 h-1 bg-gray-400 rounded-full"></div>
          </div>
          
          {/* Card/List View toggle */}
          <div className="flex justify-center py-2 bg-white">
            <div className="flex bg-light-gray rounded-full">
              <button
                className={`px-4 py-1 text-sm rounded-full ${
                  !isListView ? 'bg-primary text-white' : 'text-gray-600'
                }`}
                onClick={() => setIsListView(false)}
              >
                Card View
              </button>
              <button
                className={`px-4 py-1 text-sm rounded-full ${
                  isListView ? 'bg-primary text-white' : 'text-gray-600'
                }`}
                onClick={() => setIsListView(true)}
              >
                List View
              </button>
            </div>
          </div>

          {/* Restaurant/Dish Cards (only visible when open) */}
          <div className={`bg-white ${isMenuOpen ? 'block' : 'hidden'}`}>
            {!loading && !error && (
              <>
                {mapType === 'restaurant' ? (
                  // Restaurant Cards
                  <>
                    {!isListView ? (
                      <div className="px-6 overflow-x-auto flex space-x-4 pb-6">
                        {filteredRestaurants.length > 0 ? filteredRestaurants.map(restaurant => (
                      <div key={restaurant.id} className="bg-white rounded-xl shadow-sm p-3 min-w-[180px] border cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/restaurant/${restaurant.id}`)}>
                        <img
                          src={restaurant.coverImage}
                          alt={restaurant.name}
                          className="w-full h-20 object-cover rounded-lg mb-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80';
                          }}
                        />
                        <h3 className="font-medium">{restaurant.name}</h3>
                        <div className="flex items-center text-sm text-dark-gray">
                          <span>{restaurant.cuisine}</span>
                          <span className="mx-1">•</span>
                          <span>{restaurant.distance}</span>
                        </div>
                        <div className="flex items-center mt-1">
                          <StarIcon size={16} className="text-accent mr-1" />
                          <span className="font-medium text-sm">{restaurant.rating.toFixed(1)}</span>
                          <div className="ml-2 px-2 py-0.5 bg-light-gray rounded-full">
                            <span className="text-xs">{restaurant.qualityPercentage}%</span>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No restaurants found</p>
                        {searchQuery && <p className="text-sm">Try adjusting your search</p>}
                      </div>
                    )}
                      </div>
                    ) : (
                      <div className="px-6">
                        <div className="space-y-4">
                          {filteredRestaurants.length > 0 ? filteredRestaurants.map(restaurant => (
                        <div key={restaurant.id} className="bg-white rounded-xl shadow-sm flex overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate(`/restaurant/${restaurant.id}`)}>
                          <img
                            src={restaurant.coverImage}
                            alt={restaurant.name}
                            className="w-20 h-20 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80';
                            }}
                          />
                          <div className="p-3 flex-1">
                            <h3 className="font-medium">{restaurant.name}</h3>
                            <div className="flex items-center text-sm text-dark-gray">
                              <span>{restaurant.cuisine}</span>
                              <span className="mx-1">•</span>
                              <span>{restaurant.priceRange}</span>
                            </div>
                            <div className="flex items-center mt-1 justify-between">
                              <div className="flex items-center">
                                <StarIcon size={16} className="text-accent mr-1" />
                                <span className="font-medium text-sm">{restaurant.rating.toFixed(1)}</span>
                              </div>
                              <div className="flex items-center">
                                <MapPinIcon size={14} className="text-dark-gray mr-1" />
                                <span className="text-xs text-dark-gray">{restaurant.distance}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No restaurants found</p>
                          {searchQuery && <p className="text-sm">Try adjusting your search</p>}
                        </div>
                      )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Dish Cards
                  <>
                    {!isListView ? (
                      <div className="px-6 overflow-x-auto flex space-x-4 pb-6">
                        {filteredItems.length > 0 ? filteredItems.map(dish => (
                          <div key={dish.id} className="bg-white rounded-xl shadow-sm p-3 min-w-[180px] border cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/dish/${dish.id}`)}>
                            <img
                              src={dish.coverImage}
                              alt={dish.name}
                              className="w-full h-20 object-cover rounded-lg mb-2"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80';
                              }}
                            />
                            <h3 className="font-medium">{dish.name}</h3>
                            <div className="flex items-center text-sm text-dark-gray">
                              <span>{dish.restaurantName}</span>
                              {dish.category && <><span className="mx-1">•</span><span>{dish.category}</span></>}
                            </div>
                            <div className="flex items-center mt-1 justify-between">
                              <div className="flex items-center">
                                <StarIcon size={16} className="text-accent mr-1" />
                                <span className="font-medium text-sm">{dish.rating.toFixed(1)}</span>
                              </div>
                              {dish.price && (
                                <div className="text-sm font-medium text-primary">
                                  ${dish.price}
                                </div>
                              )}
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8 text-gray-500">
                            <p>No dishes found</p>
                            {searchQuery && <p className="text-sm">Try adjusting your search</p>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-6">
                        <div className="space-y-4">
                          {filteredItems.length > 0 ? filteredItems.map(dish => (
                            <div key={dish.id} className="bg-white rounded-xl shadow-sm flex overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate(`/dish/${dish.id}`)}>
                              <img
                                src={dish.coverImage}
                                alt={dish.name}
                                className="w-20 h-20 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80';
                                }}
                              />
                              <div className="p-3 flex-1">
                                <h3 className="font-medium">{dish.name}</h3>
                                <div className="flex items-center text-sm text-dark-gray">
                                  <span>{dish.restaurantName}</span>
                                  {dish.category && <><span className="mx-1">•</span><span>{dish.category}</span></>}
                                </div>
                                <div className="flex items-center mt-1 justify-between">
                                  <div className="flex items-center">
                                    <StarIcon size={16} className="text-accent mr-1" />
                                    <span className="font-medium text-sm">{dish.rating.toFixed(1)}</span>
                                  </div>
                                  {dish.price && (
                                    <div className="text-sm font-medium text-primary">
                                      ${dish.price}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )) : (
                            <div className="text-center py-8 text-gray-500">
                              <p>No dishes found</p>
                              {searchQuery && <p className="text-sm">Try adjusting your search</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discover;