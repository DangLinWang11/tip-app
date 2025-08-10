import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MapPin, Store, Utensils } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateRestaurantQualityScore, ReviewWithCategory, FirebaseReview } from '../services/reviewService';

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
  qualityLabel: string;
  distance: string;
  priceRange: string;
  coverImage: string | null;
  location: {
    lat: number;
    lng: number;
  };
  reviewCount: number;
}

const getQualityColor = (percentage: number): string => {
  if (percentage >= 95) return '#059669'; // Bright Green (95-100%)
  if (percentage >= 90) return '#10B981'; // Green (90-94%)
  if (percentage >= 85) return '#34D399'; // Light Green (85-89%)
  if (percentage >= 80) return '#6EE7B7'; // Yellow-Green (80-84%)
  if (percentage >= 75) return '#FDE047'; // Yellow (75-79%)
  if (percentage >= 70) return '#FACC15'; // Orange-Yellow (70-74%)
  if (percentage >= 65) return '#F59E0B'; // Orange (65-69%)
  if (percentage >= 60) return '#F97316'; // Red-Orange (60-64%)
  if (percentage >= 55) return '#FB7185'; // Light Red (55-59%)
  return '#EF4444'; // Red (0-54%)
};

// Get categories based on view mode
const getCategories = (mode: 'restaurant' | 'dish') => {
  if (mode === 'restaurant') {
    return ['All', 'Near Me', 'Fast Food', 'BBQ', 'Mediterranean', 'Seafood', 'Italian', 'Asian', 'Mexican', 'Pizza', 'American'];
  } else {
    return ['All', 'Near Me', 'Burgers', 'Pizza', 'Tacos', 'Sushi', 'Pasta', 'Salads', 'Desserts', 'Sandwiches', 'Soup', 'Seafood'];
  }
};

const DiscoverList: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [restaurants, setRestaurants] = useState<RestaurantWithExtras[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'restaurant' | 'dish'>('restaurant');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = getCategories(viewMode);
  // Function to fetch reviews for a restaurant
  const fetchRestaurantReviews = async (restaurantId: string): Promise<ReviewWithCategory[]> => {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'), 
        where('restaurantId', '==', restaurantId)
      );
      const reviewsSnapshot = await getDocs(reviewsQuery);
      const reviews = reviewsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as FirebaseReview));
      
      // Convert to ReviewWithCategory format (using default category for now)
      return reviews.map(review => ({ ...review, category: 'main' }));
    } catch (error) {
      console.error(`Error fetching reviews for restaurant ${restaurantId}:`, error);
      return [];
    }
  };


  // Fetch restaurants from Firebase
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const restaurantsCollection = collection(db, 'restaurants');
        const restaurantSnapshot = await getDocs(restaurantsCollection);
        
        // Fetch restaurants with real review data
        const restaurantPromises = restaurantSnapshot.docs.map(async (doc) => {
          const data = doc.data() as FirebaseRestaurant;
          const restaurantId = doc.id;
          
          // Fetch reviews for this restaurant
          const reviews = await fetchRestaurantReviews(restaurantId);
          
          // Calculate quality score
          const qualityScore = calculateRestaurantQualityScore(reviews);
          
          // Calculate quality percentage (always available now)
          const qualityPercentage = qualityScore; // qualityScore is now always a number
          const qualityLabel = `${qualityPercentage}%`;
          
          // Mock data that we don't have yet
          const mockExtras = {
            rating: reviews.length > 0 
              ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
              : 0,
            qualityPercentage,
            qualityLabel,
            reviewCount: reviews.length,
            distance: `${(0.5 + Math.random() * 2).toFixed(1)} mi`, // Still mock for now
            priceRange: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)], // Still mock
            coverImage: null, // Back to store icons
            location: {
              lat: data.coordinates.latitude,
              lng: data.coordinates.longitude
            }
          };
          
          return {
            id: restaurantId,
            ...data,
            ...mockExtras
          } as RestaurantWithExtras;
        });
        
        const restaurantList = await Promise.all(restaurantPromises);
        
        setRestaurants(restaurantList);
        console.log(`Loaded ${restaurantList.length} restaurants from Firebase`);
        
        // Fetch dishes for each restaurant
        const allDishes: any[] = [];
        
        // For each restaurant, query its menu items
        const dishPromises = restaurantList.map(async (restaurant) => {
          const menuQuery = query(
            collection(db, 'menuItems'), 
            where('restaurantId', '==', restaurant.id)
          );
          const menuSnapshot = await getDocs(menuQuery);
          
          const restaurantDishes = await Promise.all(
            menuSnapshot.docs.map(async (doc) => {
              const menuItem = { id: doc.id, ...doc.data() };
              
              // Get reviews for this dish and calculate average rating
              const reviewsQuery = query(
                collection(db, 'reviews'),
                where('restaurantId', '==', restaurant.id),
                where('dishId', '==', menuItem.id)
              );
              const reviewsSnapshot = await getDocs(reviewsQuery);
              const dishReviews = reviewsSnapshot.docs.map(doc => doc.data() as FirebaseReview);
              
              // Calculate average rating on 0-10 scale
              const rating = dishReviews.length > 0
                ? (dishReviews.reduce((sum, review) => sum + review.rating, 0) / dishReviews.length) * 2
                : 0;
              
              // Mock distance for now
              const distance = `${(0.5 + Math.random() * 2).toFixed(1)} mi`;
              
              return {
                id: menuItem.id,
                name: menuItem.name || 'Unknown Dish',
                restaurantName: restaurant.name, // Restaurant name is already known
                rating: Math.round(rating * 10) / 10, // Round to 1 decimal place
                category: menuItem.category || 'Other',
                distance
              };
            })
          );
          
          return restaurantDishes;
        });
        
        const restaurantDishArrays = await Promise.all(dishPromises);
        const dishList = restaurantDishArrays.flat(); // Flatten all dishes into a single array
        
        setDishes(dishList);
        console.log(`Loaded ${dishList.length} dishes from Firebase`);
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

  // Filter dishes based on selected category
  const filteredDishes = dishes.filter(dish => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'nearme') return true; // Could implement distance filtering
    return dish.category.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          {/* Left: Back button */}
          <button onClick={() => navigate('/discover')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          
          {/* Center: Title */}
          <h1 className="text-xl font-semibold text-gray-900">Discover List</h1>
          
          {/* Right: Toggle switch */}
          <div className="relative">
            <div 
              className={`flex items-center bg-gray-200 rounded-full p-1 w-20 h-10 cursor-pointer transition-colors ${
                viewMode === 'dish' ? 'bg-red-100' : ''
              }`}
              onClick={() => setViewMode(viewMode === 'restaurant' ? 'dish' : 'restaurant')}
            >
              {/* Sliding white circle */}
              <div 
                className={`absolute w-8 h-8 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${
                  viewMode === 'dish' ? 'transform translate-x-10' : 'transform translate-x-0'
                }`}
              />
              
              {/* Icons */}
              <div className="flex items-center justify-between w-full px-1 relative z-10">
                <Store 
                  size={16} 
                  className={`transition-colors ${
                    viewMode === 'restaurant' ? 'text-primary' : 'text-gray-500'
                  }`} 
                />
                <Utensils 
                  size={16} 
                  className={`transition-colors ${
                    viewMode === 'dish' ? 'text-primary' : 'text-gray-500'
                  }`} 
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Category Carousel */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex overflow-x-auto space-x-2 scrollbar-hide">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category.toLowerCase())}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category.toLowerCase()
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-4 bg-white border-b">
        <div className="flex items-center bg-gray-100 rounded-xl p-3">
          <Search size={20} className="text-gray-500 mr-3" />
          <input
            type="text"
            placeholder={viewMode === 'restaurant' ? 'Search restaurants...' : 'Search dishes...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent focus:outline-none text-gray-900 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Content List */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-gray-600">Loading {viewMode === 'restaurant' ? 'restaurants' : 'dishes'}...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium">Error loading {viewMode === 'restaurant' ? 'restaurants' : 'dishes'}</p>
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
            {viewMode === 'restaurant' ? (
              // Restaurant Cards
              filteredRestaurants.length > 0 ? filteredRestaurants.map(restaurant => (
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
                        <Store size={56} className="text-gray-500" strokeWidth={2} />
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium truncate flex-1">{restaurant.name}</h3>
                      <div className="px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: getQualityColor(restaurant.qualityPercentage) }}>
                        <span className="text-xs font-medium text-white">{restaurant.qualityPercentage}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-dark-gray">
                        <span>{restaurant.cuisine}</span>
                        <span className="mx-1">•</span>
                        <span>{restaurant.priceRange}</span>
                      </div>
                      <div className="flex items-center mt-2">
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
              )
            ) : (
              // Dish Cards
              filteredDishes.length > 0 ? filteredDishes.map(dish => (
                <div 
                  key={dish.id} 
                  className="bg-white rounded-xl shadow-sm flex overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors h-16" 
                  onClick={() => navigate(`/dish/${dish.id}`)}
                >
                  <div className="w-16 h-16 bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center">
                      <Utensils size={18} className="text-gray-500" />
                    </div>
                  </div>
                  <div className="p-2 flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium truncate text-sm">{dish.name}</h3>
                        <p className="text-xs text-gray-600">{dish.restaurantName}</p>
                      </div>
                      <div className="ml-2 text-right flex flex-col items-end">
                        <span className={`text-sm font-semibold ${dish.rating === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                          {dish.rating === 0 ? 'No reviews' : dish.rating}
                        </span>
                        <div className="flex items-center mt-0.5">
                          <MapPin size={12} className="text-dark-gray mr-1" />
                          <span className="text-xs text-dark-gray">{dish.distance}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No dishes found</p>
                  <p className="text-sm">Try selecting a different category</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverList;