import React, { useState, useEffect } from 'react';
import { SearchIcon, MapPinIcon, StarIcon, PlusIcon } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LocationPickerModal from './LocationPickerModal';

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

interface RestaurantForSearch extends FirebaseRestaurant {
  rating: number;
  distance: string;
  coverImage: string;
}

interface RestaurantSearchProps {
  onSelect: (restaurant: RestaurantForSearch) => void;
}
const RestaurantSearch: React.FC<RestaurantSearchProps> = ({
  onSelect
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantForSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  console.log('Modal state:', showLocationModal);
  const [pendingRestaurant, setPendingRestaurant] = useState<RestaurantForSearch | null>(null);

  // Fetch restaurants from Firebase
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const restaurantsCollection = collection(db, 'restaurants');
        const restaurantSnapshot = await getDocs(restaurantsCollection);
        
        const restaurantList: RestaurantForSearch[] = restaurantSnapshot.docs.map((doc, index) => {
          const data = doc.data() as FirebaseRestaurant;
          
          // Add mock data for fields not in Firebase yet
          const mockExtras = {
            rating: 4.0 + Math.random() * 1.0, // Random rating between 4.0-5.0
            distance: `${(0.5 + Math.random() * 2).toFixed(1)} mi`, // Random distance
            coverImage: `https://images.unsplash.com/photo-${1579684947550 + index}?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80`
          };
          
          return {
            id: doc.id,
            ...data,
            ...mockExtras
          };
        });
        
        setRestaurants(restaurantList);
        console.log(`Loaded ${restaurantList.length} restaurants for search`);
      } catch (err: any) {
        console.error('Error fetching restaurants:', err);
        setError('Failed to load restaurants');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRestaurants();
  }, []);

  const filteredRestaurants = restaurants.filter(restaurant => 
    restaurant.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleManualRestaurantAdd = () => {
    const manualRestaurant = {
      name: query,
      cuisine: 'Restaurant Added',
      id: `manual_${Date.now()}`,
      address: 'Restaurant Added',
      phone: '',
      coordinates: { latitude: 0, longitude: 0 },
      createdAt: null,
      updatedAt: null,
      rating: 0,
      distance: '0 mi',
      coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    };
    setPendingRestaurant(manualRestaurant);
    console.log('Setting showLocationModal to true');
    setShowLocationModal(true);
  };

  const handleLocationConfirm = (location: { latitude: number; longitude: number }) => {
    if (pendingRestaurant) {
      const updatedRestaurant = {
        ...pendingRestaurant,
        coordinates: location
      };
      onSelect(updatedRestaurant);
    }
    setShowLocationModal(false);
    setPendingRestaurant(null);
    setIsOpen(false);
  };

  const handleLocationCancel = () => {
    setShowLocationModal(false);
    setPendingRestaurant(null);
  };
  return <div className="relative">
      <div className="flex items-center border border-medium-gray rounded-xl p-3">
        <SearchIcon size={20} className="text-dark-gray mr-2" />
        <input type="text" placeholder="Search for a restaurant..." value={query} onChange={e => {
        setQuery(e.target.value);
        setIsOpen(true);
      }} className="flex-1 focus:outline-none" />
      </div>
      {isOpen && query && (
        <div className="absolute z-10 left-0 right-0 mt-2 bg-white rounded-xl shadow-lg max-h-64 overflow-y-auto border border-gray-200">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading restaurants...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">
              <p className="text-sm">{error}</p>
            </div>
          ) : filteredRestaurants.length > 0 ? (
            filteredRestaurants.map(restaurant => (
              <button 
                key={restaurant.id} 
                className="w-full p-3 flex items-start hover:bg-light-gray transition-colors" 
                onClick={() => {
                  onSelect(restaurant);
                  setQuery(restaurant.name);
                  setIsOpen(false);
                }}
              >
                <img 
                  src={restaurant.coverImage} 
                  alt={restaurant.name} 
                  className="w-12 h-12 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80';
                  }}
                />
                <div className="ml-3 flex-1 text-left">
                  <div className="flex items-center">
                    <span className="font-medium">{restaurant.name}</span>
                    <div className="ml-2 flex items-center">
                      <StarIcon size={14} className="text-accent" />
                      <span className="ml-1 text-sm">{restaurant.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-dark-gray mt-1">
                    <span className="mr-2">{restaurant.cuisine}</span>
                    <MapPinIcon size={14} className="mr-1" />
                    <span>{restaurant.distance}</span>
                  </div>
                </div>
              </button>
            ))
          ) : null}
          {query.trim() && (
            <button 
              className="w-full p-3 flex items-center hover:bg-blue-50 transition-colors border-t border-gray-100 bg-gray-50"
              onClick={handleManualRestaurantAdd}
            >
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <PlusIcon size={20} className="text-blue-600" />
              </div>
              <div className="ml-3 flex-1 text-left">
                <div className="font-medium text-blue-600">
                  + Add '{query}' as new restaurant
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Create a custom restaurant entry
                </div>
              </div>
            </button>
          )}
          {filteredRestaurants.length === 0 && !loading && !error && (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No restaurants found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
      {console.log('Rendering modal with isOpen:', showLocationModal)}
      <LocationPickerModal
        isOpen={showLocationModal}
        restaurantName={pendingRestaurant?.name || ''}
        onConfirm={handleLocationConfirm}
        onCancel={handleLocationCancel}
      />
    </div>;
};
export default RestaurantSearch;