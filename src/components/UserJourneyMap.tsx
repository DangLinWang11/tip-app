import React, { useState, useEffect } from 'react';
import RestaurantMap from './RestaurantMap';
import UserRestaurantModal from './UserRestaurantModal';
import { getUserVisitedRestaurants, UserVisitedRestaurant } from '../services/reviewService';

interface UserJourneyMapProps {
  className?: string;
}

const UserJourneyMap: React.FC<UserJourneyMapProps> = ({ className = '' }) => {
  const [visitedRestaurants, setVisitedRestaurants] = useState<UserVisitedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<UserVisitedRestaurant | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Load user's visited restaurants on component mount
  useEffect(() => {
    const loadVisitedRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const restaurants = await getUserVisitedRestaurants();
        setVisitedRestaurants(restaurants);
        
        console.log(`✅ Loaded ${restaurants.length} visited restaurants for user journey map`);
      } catch (err) {
        console.error('❌ Error loading visited restaurants:', err);
        setError('Failed to load your restaurant visits');
      } finally {
        setLoading(false);
      }
    };

    loadVisitedRestaurants();
  }, []);

  // Handle restaurant pin click
  const handleRestaurantClick = (restaurantId: string) => {
    console.log(`🏪 Restaurant pin clicked: ${restaurantId}`);
    
    // Find the restaurant data
    const restaurant = visitedRestaurants.find(r => r.id === restaurantId);
    if (restaurant) {
      setSelectedRestaurant(restaurant);
      setShowModal(true);
    } else {
      console.warn(`⚠️ Restaurant not found for ID: ${restaurantId}`);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRestaurant(null);
  };

  // Convert UserVisitedRestaurant to format expected by RestaurantMap
  const mapRestaurants = visitedRestaurants.map(restaurant => ({
    id: parseInt(restaurant.id) || Math.random(), // RestaurantMap expects number
    name: restaurant.name,
    qualityPercentage: 0,
    location: restaurant.location,
    cuisine: restaurant.cuisine,
    rating: restaurant.averageRating,
    priceRange: '$', // Default since we don't track this per user visit
  }));

  // Loading state
  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}>
        <div className="text-center p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your food journey...</p>
          <p className="text-gray-500 text-sm">Mapping your restaurant visits</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 rounded-lg`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to Load Map</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state - user has no restaurant visits
  if (visitedRestaurants.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-50 rounded-lg`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-2xl">🗺️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Restaurant Visits Yet</h3>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            Start reviewing restaurants to see your food journey on the map!
          </p>
          <button 
            onClick={() => window.location.href = '/create'} 
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Add Your First Review
          </button>
        </div>
      </div>
    );
  }

  // Main map display
  return (
    <>
      <div className={className}>
        <RestaurantMap
          mapType="restaurant"
          restaurants={mapRestaurants}
          onRestaurantClick={handleRestaurantClick}
          showQualityPercentages={false}
          className="w-full h-full"
        />
      </div>

      {/* Restaurant Details Modal */}
      {showModal && selectedRestaurant && (
        <UserRestaurantModal
          restaurant={selectedRestaurant}
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default UserJourneyMap;