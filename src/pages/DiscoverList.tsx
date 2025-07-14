import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MapPin, Star } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

const categories = [
  { id: 'all', name: 'All', icon: null },
  { id: 'nearme', name: 'Near Me', icon: '📍' },
  { id: 'fastfood', name: 'Fast Food', icon: '🍔' },
  { id: 'bbq', name: 'BBQ', icon: '🥩' },
  { id: 'mediterranean', name: 'Mediterranean', icon: '🫒' },
  { id: 'seafood', name: 'Seafood', icon: '🦐' },
  { id: 'casual', name: 'Casual', icon: '🍽️' },
  { id: 'italian', name: 'Italian', icon: '🍝' },
  { id: 'asian', name: 'Asian', icon: '🥢' },
  { id: 'mexican', name: 'Mexican', icon: '🌮' },
  { id: 'pizza', name: 'Pizza', icon: '🍕' },
  { id: 'steakhouse', name: 'Steakhouse', icon: '🥩' },
  { id: 'sushi', name: 'Sushi', icon: '🍣' },
  { id: 'american', name: 'American', icon: '🍽️' },
  { id: 'coffee', name: 'Coffee', icon: '☕' },
  { id: 'breakfast', name: 'Brunch', icon: '🥐' }
];

const DiscoverList: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [restaurants, setRestaurants] = useState<RestaurantWithExtras[]>([]);
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
      } catch (err: any) {
        console.error('Error fetching restaurants:', err);
        setError('Failed to load restaurants. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRestaurants();
  }, []);

  // Filter restaurants based on selected category
  const filteredRestaurants = restaurants.filter(restaurant => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'nearme') return true; // Could implement distance filtering
    return restaurant.cuisine.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/discover')} className="p-1">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-semibold">Discover List</h1>
          <button className="p-1">
            <Search size={20} />
          </button>
        </div>
      </header>

      {/* Category Carousel */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex overflow-x-auto space-x-2 scrollbar-hide">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-18 h-16 rounded-xl border-2 px-1 ${
                selectedCategory === category.id 
                  ? 'border-primary bg-primary/10' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              {category.icon && <span className="text-xl mb-1">{category.icon}</span>}
              <span className="text-xs font-medium text-center truncate">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Restaurant List */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-gray-600">Loading restaurants...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium">Error loading restaurants</p>
            <p className="text-red-500 text-sm">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRestaurants.length > 0 ? filteredRestaurants.map(restaurant => (
              <div 
                key={restaurant.id} 
                className="bg-white rounded-xl shadow-sm flex overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors" 
                onClick={() => navigate(`/restaurant/${restaurant.id}`)}
              >
                <img
                  src={restaurant.coverImage}
                  alt={restaurant.name}
                  className="w-20 h-20 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80';
                  }}
                />
                <div className="p-3 flex-1">
                  <h3 className="font-medium truncate">{restaurant.name}</h3>
                  <div className="flex items-center text-sm text-dark-gray">
                    <span>{restaurant.cuisine}</span>
                    <span className="mx-1">•</span>
                    <span>{restaurant.priceRange}</span>
                  </div>
                  <div className="flex items-center mt-1 justify-between">
                    <div className="flex items-center">
                      <Star size={16} className="text-accent mr-1" />
                      <span className="font-medium text-sm">{restaurant.rating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin size={14} className="text-dark-gray mr-1" />
                      <span className="text-xs text-dark-gray">{restaurant.distance}</span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-500">
                <p>No restaurants found</p>
                <p className="text-sm">Try selecting a different category</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverList;