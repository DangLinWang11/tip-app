import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MapPin, Store } from 'lucide-react';
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
  qualityPercentage: number | null;
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
  if (percentage >= 90) return '#10B981'; // Green for high ratings (90%+)
  if (percentage >= 80) return '#34D399'; // Light green (80-89%)
  if (percentage >= 70) return '#FCD34D'; // Yellow (70-79%)
  if (percentage >= 60) return '#FBBF24'; // Orange-yellow (60-69%)
  if (percentage >= 50) return '#FB923C'; // Orange (50-59%)
  return '#EF4444'; // Red for low ratings (<50%)
};

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
          
          // Determine quality label and percentage
          let qualityPercentage: number | null = null;
          let qualityLabel: string = 'New';
          
          if (qualityScore !== null) {
            qualityPercentage = Math.round(qualityScore * 20); // Convert 0-5 scale to 0-100%
            qualityLabel = `${qualityPercentage}%`;
          }
          
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
        </div>
      </header>

      {/* Category Carousel */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex overflow-x-auto space-x-2 scrollbar-hide">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 ${
                selectedCategory === category.id 
                  ? 'text-primary border-b-2 border-primary' 
                  : 'text-gray-600'
              }`}
            >
              {category.icon && <span className="text-lg mb-1">{category.icon}</span>}
              <span className="text-xs font-medium text-center whitespace-nowrap">{category.name}</span>
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
                    {restaurant.qualityPercentage === null && (
                      <div className="px-2 py-0.5 rounded-full bg-gray-400 ml-2">
                        <span className="text-xs font-medium text-white">New</span>
                      </div>
                    )}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverList;